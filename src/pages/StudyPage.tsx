import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  FileUp,
  GraduationCap,
  Link as LinkIcon,
  Plus,
  Trash2,
  Calendar,
  FileText,
  Download,
  SlidersHorizontal,
  Award,
  Sparkles,
} from 'lucide-react';
import { db, enqueueSync } from '../db/database';
import { YEAR3_OPTIONAL_MODULES } from '../data/curriculumSeed';
import { generateId } from '../lib/crypto';
import { daysUntil, formatShortDate } from '../lib/dateUtils';
import type {
  AcademicAssessment,
  AcademicModule,
  AssessmentType,
  ModuleStatus,
  StudyResource,
  UserProfile,
} from '../types/models';
import { EmptyState, Modal, PageHeader } from '../components/ui/Modal';

interface StudyPageProps {
  profile: UserProfile;
}

export function StudyPage({ profile }: StudyPageProps) {
  const [activeTab, setActiveTab] = useState<'syllabus' | 'assessments' | 'resources'>('syllabus');
  const [selectedYear, setSelectedYear] = useState<1 | 2 | 3 | 4>(profile.currentYear);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [showOptionalPicker, setShowOptionalPicker] = useState(false);

  // Module Workspace sub-states
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [addStudyMins, setAddStudyMins] = useState('30');
  const [editingCode, setEditingCode] = useState(false);
  const [codeDraft, setCodeDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');

  // Assessment Modal
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const [assModuleId, setAssModuleId] = useState('');
  const [assTitle, setAssTitle] = useState('');
  const [assType, setAssType] = useState<AssessmentType>('assignment');
  const [assDueDate, setAssDueDate] = useState('');
  const [assWeight, setAssWeight] = useState('30');
  const [assMaxScore, setAssMaxScore] = useState('100');
  const [assScore, setAssScore] = useState('');
  const [assNotes, setAssNotes] = useState('');

  // Resource / Timetable Upload Modal
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resModuleId, setResModuleId] = useState('timetable');
  const [resTitle, setResTitle] = useState('');
  const [resKind, setResKind] = useState<StudyResource['kind']>('material');
  const [resUrl, setResUrl] = useState('');
  const [resFile, setResFile] = useState<{
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  } | null>(null);

  const modules = useLiveQuery(() => db.modules.toArray(), []) ?? [];
  const assessments = useLiveQuery(() => db.assessments.toArray(), []) ?? [];
  const resources = useLiveQuery(() => db.studyResources.toArray(), []) ?? [];

  const activeModule = useMemo(
    () => modules.find((m) => m.id === activeModuleId) ?? null,
    [modules, activeModuleId]
  );

  const degreeSummary = useMemo(() => {
    // Individual Project is 1 record with credits=40 (spanning Sem 7 & 8), so summing unique modules counts it ONCE -> exactly 480 credits.
    const totalCredits = modules.reduce((s, m) => s + m.credits, 0);
    const completedCredits = modules
      .filter((m) => m.status === 'completed')
      .reduce((s, m) => s + m.credits, 0);
    const inProgressCredits = modules
      .filter((m) => m.status === 'in_progress')
      .reduce((s, m) => s + m.credits, 0);
    const graded = modules.filter((m) => m.percentage !== null);
    const avgPct =
      graded.length > 0
        ? +(graded.reduce((s, m) => s + (m.percentage ?? 0), 0) / graded.length).toFixed(1)
        : null;
    const totalHours = +(
      modules.reduce((s, m) => s + (m.studyMinutes || 0), 0) / 60
    ).toFixed(1);

    return { totalCredits, completedCredits, inProgressCredits, avgPct, totalHours };
  }, [modules]);

  const yearModules = useMemo(
    () =>
      modules
        .filter((m) => m.year === selectedYear)
        .sort((a, b) => a.semester - b.semester || a.code.localeCompare(b.code)),
    [modules, selectedYear]
  );

  const semestersInYear = useMemo(() => {
    const sems = Array.from(new Set(yearModules.map((m) => m.semester))).sort((a, b) => a - b);
    return sems;
  }, [yearModules]);

  const updateModule = async (mod: AcademicModule, patch: Partial<AcademicModule>) => {
    const updated: AcademicModule = {
      ...mod,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await db.modules.put(updated);
    await enqueueSync('modules', updated.id, 'upsert', updated);
  };

  const toggleTopic = async (mod: AcademicModule, topicId: string) => {
    const nextTopics = mod.topics.map((t) =>
      t.id === topicId ? { ...t, completed: !t.completed } : t
    );
    const allDone = nextTopics.length > 0 && nextTopics.every((t) => t.completed);
    const anyDone = nextTopics.some((t) => t.completed);
    const nextStatus: ModuleStatus =
      mod.status === 'completed'
        ? 'completed'
        : allDone
        ? 'completed'
        : anyDone
        ? 'in_progress'
        : mod.status;
    await updateModule(mod, { topics: nextTopics, status: nextStatus });
  };

  const addTopic = async (e: React.FormEvent, mod: AcademicModule) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;
    const nextTopics = [
      ...mod.topics,
      { id: generateId('topic'), title: newTopicTitle.trim(), completed: false },
    ];
    await updateModule(mod, { topics: nextTopics });
    setNewTopicTitle('');
  };

  const removeTopic = async (mod: AcademicModule, topicId: string) => {
    await updateModule(mod, { topics: mod.topics.filter((t) => t.id !== topicId) });
  };

  const handleLogStudyMinutes = async (mod: AcademicModule) => {
    const mins = parseInt(addStudyMins, 10);
    if (!Number.isFinite(mins) || mins <= 0) return;
    await updateModule(mod, {
      studyMinutes: (mod.studyMinutes || 0) + mins,
      status: mod.status === 'not_started' ? 'in_progress' : mod.status,
    });
  };

  const handleSelectOptionalModule = async (optId: string) => {
    const chosen = YEAR3_OPTIONAL_MODULES.find((o) => o.id === optId);
    const slotMod = modules.find((m) => m.isOptionalSlot);
    if (!chosen || !slotMod) return;

    await updateModule(slotMod, {
      code: chosen.code,
      title: chosen.title,
      credits: chosen.credits,
      topics: chosen.topics.map((title, idx) => ({
        id: `${slotMod.id}_${chosen.id}_${idx}`,
        title,
        completed: false,
      })),
    });
    const updatedProfile = {
      ...profile,
      selectedYear3OptionalId: chosen.id,
      updatedAt: new Date().toISOString(),
    };
    await db.profile.put(updatedProfile);
    await enqueueSync('profile', updatedProfile.id, 'upsert', updatedProfile);
    setShowOptionalPicker(false);
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assModuleId || !assTitle.trim() || !assDueDate) return;
    const scoreNum = assScore.trim() === '' ? null : Number(assScore);
    const record: AcademicAssessment = {
      id: generateId('ass'),
      moduleId: assModuleId,
      title: assTitle.trim(),
      type: assType,
      dueDate: assDueDate,
      weight: Number(assWeight) || 0,
      maxScore: Number(assMaxScore) || 100,
      score: scoreNum,
      status: scoreNum !== null ? 'graded' : 'upcoming',
      notes: assNotes.trim(),
      updatedAt: new Date().toISOString(),
    };
    await db.assessments.put(record);
    await enqueueSync('assessments', record.id, 'upsert', record);
    setAssessmentModalOpen(false);
    setAssTitle('');
    setAssScore('');
    setAssNotes('');
  };

  const deleteAssessment = async (id: string) => {
    await db.assessments.delete(id);
    await enqueueSync('assessments', id, 'delete');
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      alert('Please keep offline attachments under 6 MB for fast IndexedDB performance.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setResFile({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: String(reader.result),
      });
      if (!resTitle.trim()) setResTitle(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) return;
    const record: StudyResource = {
      id: generateId('res'),
      moduleId: resModuleId,
      title: resTitle.trim(),
      kind: resKind,
      url: resUrl.trim() || undefined,
      fileName: resFile?.name,
      fileType: resFile?.type,
      fileSize: resFile?.size,
      fileDataUrl: resFile?.dataUrl,
      createdAt: new Date().toISOString(),
    };
    await db.studyResources.put(record);
    await enqueueSync('studyResources', record.id, 'upsert', record);
    setResourceModalOpen(false);
    setResTitle('');
    setResUrl('');
    setResFile(null);
  };

  const deleteResource = async (id: string) => {
    await db.studyResources.delete(id);
    await enqueueSync('studyResources', id, 'delete');
  };

  const statusStyles: Record<ModuleStatus, string> = {
    not_started: 'bg-white/60 dark:bg-white/[0.09] text-slate-600 dark:text-slate-400',
    in_progress: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  const statusLabel: Record<ModuleStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
  };

  const moduleMap = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Management"
        subtitle={`${profile.degree} • ${profile.college} • 4 Years / ${degreeSummary.totalCredits} Credits`}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setAssModuleId(yearModules[0]?.id || modules[0]?.id || '');
                setAssessmentModalOpen(true);
              }}
              className="os-btn-secondary text-xs py-2 px-3"
            >
              <Calendar className="w-3.5 h-3.5" />
              Add Exam / Assignment
            </button>
            <button
              type="button"
              onClick={() => {
                setResModuleId(activeModuleId || 'timetable');
                setResourceModalOpen(true);
              }}
              className="os-btn-primary text-xs py-2 px-3"
            >
              <FileUp className="w-3.5 h-3.5" />
              Upload Material / Timetable
            </button>
          </>
        }
      />

      {/* Top Academic Summary Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="os-card p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Completed Credits</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {degreeSummary.completedCredits}
            <span className="text-sm font-normal text-slate-400"> / {degreeSummary.totalCredits}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-900/[0.07] dark:bg-white/[0.09] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full"
              style={{
                width: `${(degreeSummary.completedCredits / Math.max(1, degreeSummary.totalCredits)) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="os-card p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Active Credits</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {degreeSummary.inProgressCredits}
            <span className="text-sm font-normal text-slate-400"> cr</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            Individual Project (40 cr) counted once
          </div>
        </div>

        <div className="os-card p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Average Grade</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {degreeSummary.avgPct !== null ? `${degreeSummary.avgPct}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {degreeSummary.avgPct !== null ? 'Based on entered grades' : 'Enter module grades to compute'}
          </div>
        </div>

        <div className="os-card p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Study Hours</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {degreeSummary.totalHours}
            <span className="text-sm font-normal text-slate-400"> hrs</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            Synced with Focus Timer logs
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/55 dark:border-white/[0.08] pb-3">
        <div className="flex items-center gap-1 bg-white/55 dark:bg-white/[0.07] border border-white/75 dark:border-white/[0.12] backdrop-blur-xl p-1 rounded-full shadow-xs">
          {[
            { id: 'syllabus', label: '4-Year Syllabus' },
            { id: 'assessments', label: `Assignments & Exams (${assessments.length})` },
            { id: 'resources', label: `Materials & Timetables (${resources.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-[0_4px_14px_-3px_rgba(6,182,212,0.55)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'syllabus' && (
          <div className="flex items-center gap-1.5">
            {([1, 2, 3, 4] as const).map((yr) => {
              const yrMods = modules.filter((m) => m.year === yr);
              const yrDone = yrMods.filter((m) => m.status === 'completed').length;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white border-white/40 shadow-[0_4px_14px_-3px_rgba(6,182,212,0.55)]'
                      : 'bg-white/55 dark:bg-white/[0.06] border-white/75 dark:border-white/[0.12] backdrop-blur-md text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  Year {yr}
                  <span className="ml-1.5 font-mono text-[10px] opacity-75">
                    {yrDone}/{yrMods.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TAB 1: 4-YEAR SYLLABUS */}
      {activeTab === 'syllabus' && (
        <div className="space-y-6">
          {selectedYear === 3 && (
            <div className="os-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cyan-50/50 dark:bg-cyan-500/[0.06] border-cyan-200/70 dark:border-cyan-500/20">
              <div className="flex items-start gap-3">
                <Sparkles className="w-4.5 h-4.5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Year 3 Optional Module (20 Credits)
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Choose your official Semester 6 optional module from the GCT / Huddersfield catalogue, or edit the module details directly.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOptionalPicker(true)}
                className="os-btn-primary text-xs py-2 px-3.5 shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Select Optional Module
              </button>
            </div>
          )}

          {semestersInYear.map((sem) => {
            const semMods = yearModules.filter((m) => m.semester === sem);
            const semCredits = semMods.reduce((s, m) => s + m.credits, 0);
            return (
              <div key={sem} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    Semester {sem}
                    {sem === 7 && (
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        (includes 40-cr Individual Project spanning Sem 7 & 8)
                      </span>
                    )}
                  </h2>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {semCredits} credits
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {semMods.map((mod) => {
                    const doneTopics = mod.topics.filter((t) => t.completed).length;
                    const topicPct =
                      mod.topics.length > 0
                        ? Math.round((doneTopics / mod.topics.length) * 100)
                        : 0;
                    const modAssessCount = assessments.filter((a) => a.moduleId === mod.id).length;

                    return (
                      <div
                        key={mod.id}
                        onClick={() => {
                          setActiveModuleId(mod.id);
                          setEditingCode(false);
                          setCodeDraft(mod.code);
                          setTitleDraft(mod.title);
                        }}
                        className="os-card p-4 hover:border-cyan-400/60 dark:hover:border-cyan-400/40 transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded-md">
                              {mod.code}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {mod.isOptionalSlot && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                  Optional
                                </span>
                              )}
                              <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {mod.credits} cr
                                {mod.semesterEnd ? ` (Sem ${mod.semester}–${mod.semesterEnd})` : ''}
                              </span>
                            </div>
                          </div>

                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors leading-snug">
                            {mod.title}
                          </h3>

                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>
                              Topics: {doneTopics}/{mod.topics.length}
                            </span>
                            <span className="font-mono">{topicPct}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-900/[0.07] dark:bg-white/[0.09] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-cyan-500 transition-all"
                              style={{ width: `${topicPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/50 dark:border-white/[0.08] flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-full font-medium ${statusStyles[mod.status]}`}
                          >
                            {statusLabel[mod.status]}
                          </span>
                          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-mono">
                            {mod.grade && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {mod.grade}
                              </span>
                            )}
                            <span>{+(mod.studyMinutes / 60).toFixed(1)}h</span>
                            {modAssessCount > 0 && <span>{modAssessCount} task</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: ASSIGNMENTS & EXAMS */}
      {activeTab === 'assessments' && (
        <div className="os-card p-5">
          {assessments.length === 0 ? (
            <EmptyState
              icon={<Award className="w-5 h-5" />}
              title="No exams or assignments tracked yet"
              description="Add your GCT coursework deadlines, lab submissions, and final exam dates to track countdowns and grades."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setAssModuleId(yearModules[0]?.id || modules[0]?.id || '');
                    setAssessmentModalOpen(true);
                  }}
                  className="os-btn-primary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add First Assessment
                </button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {[...assessments]
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .map((item) => {
                  const mod = moduleMap.get(item.moduleId);
                  const dLeft = daysUntil(item.dueDate);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                            {mod?.code || 'Module'}
                          </span>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300">
                            {item.type}
                          </span>
                          <span className="text-xs text-slate-500">Weight: {item.weight}%</span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {mod?.title} • Due {formatShortDate(item.dueDate)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {item.score !== null && (
                          <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {item.score}/{item.maxScore}
                          </span>
                        )}
                        <select
                          value={item.status}
                          onChange={async (e) => {
                            const updated = {
                              ...item,
                              status: e.target.value as AcademicAssessment['status'],
                              updatedAt: new Date().toISOString(),
                            };
                            await db.assessments.put(updated);
                            await enqueueSync('assessments', updated.id, 'upsert', updated);
                          }}
                          className="os-input py-1 px-2 text-xs !w-auto"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="in_progress">In Progress</option>
                          <option value="submitted">Submitted</option>
                          <option value="graded">Graded</option>
                        </select>
                        {item.status !== 'graded' && item.status !== 'submitted' && (
                          <span className="font-mono text-xs text-slate-500">
                            {dLeft < 0 ? `${Math.abs(dLeft)}d ago` : dLeft === 0 ? 'Today' : `${dLeft}d`}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteAssessment(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COURSE MATERIALS & TIMETABLES */}
      {activeTab === 'resources' && (
        <div className="os-card p-5">
          {resources.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-5 h-5" />}
              title="No course materials or timetables uploaded yet"
              description="Upload lecture slides, official syllabus PDFs, GCT semester timetables, or bookmark study links — available offline in IndexedDB."
              action={
                <button
                  type="button"
                  onClick={() => setResourceModalOpen(true)}
                  className="os-btn-primary text-xs"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  Upload Material or Timetable
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {resources.map((res) => {
                const mod = moduleMap.get(res.moduleId);
                return (
                  <div
                    key={res.id}
                    className="p-4 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                          {res.kind}
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                          {mod ? `${mod.code} — ${mod.title}` : 'College Timetable / General'}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1.5 truncate">
                        {res.title}
                      </div>
                      {res.fileName && (
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                          {res.fileName} ({Math.round((res.fileSize || 0) / 1024)} KB)
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {res.fileDataUrl && (
                        <a
                          href={res.fileDataUrl}
                          download={res.fileName || `${res.title}.file`}
                          className="p-2 rounded-lg bg-white dark:bg-white/[0.06] border border-white/70 dark:border-white/[0.12] text-slate-600 dark:text-slate-300 hover:text-cyan-600"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      {res.url && (
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-white dark:bg-white/[0.06] border border-white/70 dark:border-white/[0.12] text-slate-600 dark:text-slate-300 hover:text-cyan-600"
                          title="Open link"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteResource(res.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODULE WORKSPACE MODAL */}
      <Modal
        open={Boolean(activeModule)}
        onClose={() => setActiveModuleId(null)}
        title={activeModule ? `${activeModule.code} — ${activeModule.title}` : ''}
        subtitle={
          activeModule
            ? `Year ${activeModule.year} • Semester ${activeModule.semester}${
                activeModule.semesterEnd ? `–${activeModule.semesterEnd}` : ''
              } • ${activeModule.credits} Credits`
            : ''
        }
        maxWidth="max-w-2xl"
      >
        {activeModule && (
          <div className="space-y-6">
            {/* Inline Code/Title Customiser */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/50 dark:border-white/[0.08]">
              {editingCode ? (
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <input
                    value={codeDraft}
                    onChange={(e) => setCodeDraft(e.target.value)}
                    className="os-input py-1.5 text-xs font-mono w-28"
                    placeholder="Code"
                  />
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="os-input py-1.5 text-xs flex-1 min-w-[180px]"
                    placeholder="Module title"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await updateModule(activeModule, {
                        code: codeDraft.trim() || activeModule.code,
                        title: titleDraft.trim() || activeModule.title,
                      });
                      setEditingCode(false);
                    }}
                    className="os-btn-primary py-1.5 px-3 text-xs"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <GraduationCap className="w-4 h-4 text-cyan-500" />
                    <span>Need to match exact printed sheet code?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCode(true)}
                    className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Edit Code / Title
                  </button>
                </>
              )}
            </div>

            {/* Status, Grade, Study Hours Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select
                  value={activeModule.status}
                  onChange={(e) =>
                    updateModule(activeModule, { status: e.target.value as ModuleStatus })
                  }
                  className="os-input py-2 text-xs"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Grade (e.g. A, First)
                </label>
                <input
                  type="text"
                  value={activeModule.grade}
                  onChange={(e) => updateModule(activeModule, { grade: e.target.value })}
                  placeholder="Not graded yet"
                  className="os-input py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Percentage (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={activeModule.percentage ?? ''}
                  onChange={(e) =>
                    updateModule(activeModule, {
                      percentage: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="0–100"
                  className="os-input py-2 text-xs font-mono"
                />
              </div>
            </div>

            {/* Study Hours Logger */}
            <div className="os-card-subtle p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-sky-500" />
                <div>
                  <div className="text-xs font-semibold">
                    Logged Study Time: {+(activeModule.studyMinutes / 60).toFixed(1)} hours (
                    {activeModule.studyMinutes} mins)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Add manual study time or link this module in Focus Timer.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={addStudyMins}
                  onChange={(e) => setAddStudyMins(e.target.value)}
                  className="os-input py-1.5 text-xs font-mono w-20"
                />
                <button
                  type="button"
                  onClick={() => handleLogStudyMinutes(activeModule)}
                  className="os-btn-secondary py-1.5 px-3 text-xs shrink-0"
                >
                  + Log mins
                </button>
              </div>
            </div>

            {/* Syllabus Topics Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-sm font-semibold">Syllabus Topics</h4>
                <span className="text-xs font-mono text-slate-500">
                  {activeModule.topics.filter((t) => t.completed).length}/{activeModule.topics.length}{' '}
                  completed
                </span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {activeModule.topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md"
                  >
                    <button
                      type="button"
                      onClick={() => toggleTopic(activeModule, topic.id)}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      {topic.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                      <span
                        className={`text-xs ${
                          topic.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {topic.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTopic(activeModule, topic.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      aria-label="Remove topic"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => addTopic(e, activeModule)} className="flex gap-2 mt-2.5">
                <input
                  type="text"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="Add syllabus topic from your lecture outline..."
                  className="os-input py-2 text-xs"
                />
                <button type="submit" className="os-btn-secondary py-2 px-3 text-xs shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                  Add Topic
                </button>
              </form>
            </div>

            {/* Module Notes */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
                <BookOpen className="w-4 h-4 text-cyan-500" />
                Module Notes
              </label>
              <textarea
                rows={4}
                value={activeModule.notes}
                onChange={(e) => updateModule(activeModule, { notes: e.target.value })}
                placeholder="Key lecture notes, formulas, exam tips, lecturer office hours..."
                className="os-input text-xs leading-relaxed"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* YEAR 3 OPTIONAL MODULE PICKER MODAL */}
      <Modal
        open={showOptionalPicker}
        onClose={() => setShowOptionalPicker(false)}
        title="Select Year 3 Optional Module"
        subtitle="Semester 6 • 20 Credits (counts toward your 480-credit BSc Honours degree)"
      >
        <div className="space-y-2.5">
          {YEAR3_OPTIONAL_MODULES.map((opt) => {
            const isSelected = profile.selectedYear3OptionalId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectOptionalModule(opt.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-500/10'
                    : 'border-white/70 dark:border-white/[0.12] hover:border-cyan-300 dark:hover:border-white/[0.2]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                    {opt.code}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{opt.credits} credits</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  {opt.title}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {opt.topics.slice(0, 3).join(' • ')}
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* ADD ASSESSMENT MODAL */}
      <Modal
        open={assessmentModalOpen}
        onClose={() => setAssessmentModalOpen(false)}
        title="Add Assignment or Exam"
        subtitle="Track coursework deadlines, weightings, and grades"
      >
        <form onSubmit={handleCreateAssessment} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Module</label>
            <select
              required
              value={assModuleId}
              onChange={(e) => setAssModuleId(e.target.value)}
              className="os-input text-sm"
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  Y{m.year} S{m.semester} • {m.code} — {m.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input
              required
              value={assTitle}
              onChange={(e) => setAssTitle(e.target.value)}
              placeholder="e.g. Coursework 1 Report or Final Written Exam"
              className="os-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                value={assType}
                onChange={(e) => setAssType(e.target.value as AssessmentType)}
                className="os-input"
              >
                <option value="assignment">Assignment</option>
                <option value="exam">Exam</option>
                <option value="lab">Practical Lab</option>
                <option value="presentation">Presentation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Due / Exam Date</label>
              <input
                type="date"
                required
                value={assDueDate}
                onChange={(e) => setAssDueDate(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Weight (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={assWeight}
                onChange={(e) => setAssWeight(e.target.value)}
                className="os-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Score (opt.)</label>
              <input
                type="number"
                value={assScore}
                onChange={(e) => setAssScore(e.target.value)}
                placeholder="—"
                className="os-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Max Score</label>
              <input
                type="number"
                value={assMaxScore}
                onChange={(e) => setAssMaxScore(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea
              rows={2}
              value={assNotes}
              onChange={(e) => setAssNotes(e.target.value)}
              placeholder="Submission portal, rubric notes, exam room..."
              className="os-input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAssessmentModalOpen(false)}
              className="os-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Assessment
            </button>
          </div>
        </form>
      </Modal>

      {/* UPLOAD RESOURCE / TIMETABLE MODAL */}
      <Modal
        open={resourceModalOpen}
        onClose={() => setResourceModalOpen(false)}
        title="Upload Course Material or Timetable"
        subtitle="Stored offline in IndexedDB and queued for Supabase Storage sync"
      >
        <form onSubmit={handleSaveResource} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={resKind}
                onChange={(e) => setResKind(e.target.value as StudyResource['kind'])}
                className="os-input"
              >
                <option value="material">Course Material</option>
                <option value="timetable">Class Timetable</option>
                <option value="syllabus">Official Syllabus</option>
                <option value="link">Web Resource Link</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Attach To</label>
              <select
                value={resModuleId}
                onChange={(e) => setResModuleId(e.target.value)}
                className="os-input"
              >
                <option value="timetable">General / College Timetable</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input
              required
              value={resTitle}
              onChange={(e) => setResTitle(e.target.value)}
              placeholder="e.g. Semester 1 GCT Timetable or Week 3 Slides"
              className="os-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Upload File (PDF, Image, Doc — max 6 MB)
            </label>
            <input
              type="file"
              onChange={handleFilePick}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-white/[0.08] file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 cursor-pointer"
            />
            {resFile && (
              <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                Ready: {resFile.name} ({Math.round(resFile.size / 1024)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Or Resource URL (optional)
            </label>
            <input
              type="url"
              value={resUrl}
              onChange={(e) => setResUrl(e.target.value)}
              placeholder="https://..."
              className="os-input"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setResourceModalOpen(false)}
              className="os-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Resource
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
