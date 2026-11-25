import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Award,
  CheckCircle2,
  Circle,
  Code2,
  ExternalLink,
  Flag,
  FolderGit2,
  Plus,
  Shield,
  Terminal,
  Trash2,
  Compass,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db, enqueueSync } from '../db/database';
import { CYBER_CAREER_TRACKS } from '../data/curriculumSeed';
import { generateId } from '../lib/crypto';
import { formatShortDate, getTodayISO } from '../lib/dateUtils';
import type { CyberLog, CyberSkill, SkillLevel } from '../types/models';
import { EmptyState, Modal, PageHeader } from '../components/ui/Modal';

type CyberTab = 'roadmap' | 'labs' | 'certs' | 'projects' | 'careers';

const LEVEL_SCORE: Record<SkillLevel, number> = {
  not_started: 0,
  beginner: 25,
  intermediate: 50,
  advanced: 75,
  expert: 100,
};

const LEVEL_LABEL: Record<SkillLevel, string> = {
  not_started: 'Not Started',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

export function CyberLabPage() {
  const [activeTab, setActiveTab] = useState<CyberTab>('roadmap');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [newSubSkill, setNewSubSkill] = useState('');

  // Add Log Modal (Lab / CTF / Cert / Project)
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logKind, setLogKind] = useState<CyberLog['kind']>('lab');
  const [logTitle, setLogTitle] = useState('');
  const [logPlatform, setLogPlatform] = useState('');
  const [logStatus, setLogStatus] = useState<CyberLog['status']>('in_progress');
  const [logDate, setLogDate] = useState(getTodayISO());
  const [logDifficulty, setLogDifficulty] = useState<NonNullable<CyberLog['difficulty']>>('Medium');
  const [logScore, setLogScore] = useState('');
  const [logUrl, setLogUrl] = useState('');
  const [logTags, setLogTags] = useState('');
  const [logWriteup, setLogWriteup] = useState('');

  const skills = useLiveQuery(() => db.cyberSkills.toArray(), []) ?? [];
  const logs = useLiveQuery(() => db.cyberLogs.toArray(), []) ?? [];

  const activeSkill = useMemo(
    () => skills.find((s) => s.id === selectedSkillId) ?? null,
    [skills, selectedSkillId]
  );

  const labAndCtfLogs = useMemo(
    () =>
      logs
        .filter((l) => l.kind === 'lab' || l.kind === 'ctf')
        .sort((a, b) => b.date.localeCompare(a.date)),
    [logs]
  );
  const certLogs = useMemo(() => logs.filter((l) => l.kind === 'cert'), [logs]);
  const projectLogs = useMemo(() => logs.filter((l) => l.kind === 'project'), [logs]);

  const skillProgress = (skill: CyberSkill) => {
    const levelVal = LEVEL_SCORE[skill.level];
    const subDone = skill.subSkills.filter((s) => s.completed).length;
    const subPct = skill.subSkills.length > 0 ? Math.round((subDone / skill.subSkills.length) * 100) : 0;
    return Math.max(levelVal, subPct);
  };

  const overallReadiness = useMemo(() => {
    if (skills.length === 0) return 0;
    const sum = skills.reduce((acc, s) => acc + skillProgress(s), 0);
    return Math.round(sum / skills.length);
  }, [skills]);

  const chartData = useMemo(
    () =>
      skills.map((s) => ({
        name: s.domain.replace(' & Systems Administration', '').replace(' for Security', ''),
        score: skillProgress(s),
      })),
    [skills]
  );

  const updateSkill = async (skill: CyberSkill, patch: Partial<CyberSkill>) => {
    const updated: CyberSkill = {
      ...skill,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await db.cyberSkills.put(updated);
    await enqueueSync('cyberSkills', updated.id, 'upsert', updated);
  };

  const openAddLog = (kind: CyberLog['kind']) => {
    setLogKind(kind);
    setLogTitle('');
    setLogPlatform(
      kind === 'lab'
        ? 'TryHackMe'
        : kind === 'ctf'
        ? 'PicoCTF / HTB'
        : kind === 'cert'
        ? 'CompTIA'
        : 'GitHub'
    );
    setLogStatus(kind === 'cert' ? 'planned' : 'completed');
    setLogDate(getTodayISO());
    setLogScore('');
    setLogUrl('');
    setLogTags('');
    setLogWriteup('');
    setLogModalOpen(true);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTitle.trim()) return;
    const record: CyberLog = {
      id: generateId('cyb'),
      kind: logKind,
      title: logTitle.trim(),
      platform: logPlatform.trim() || 'Self-Hosted Lab',
      status: logStatus,
      date: logDate,
      difficulty: logKind === 'lab' || logKind === 'ctf' ? logDifficulty : undefined,
      scoreOrResult: logScore.trim() || undefined,
      url: logUrl.trim() || undefined,
      tags: logTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      writeup: logWriteup.trim(),
      updatedAt: new Date().toISOString(),
    };
    await db.cyberLogs.put(record);
    await enqueueSync('cyberLogs', record.id, 'upsert', record);
    setLogModalOpen(false);
  };

  const deleteLog = async (id: string) => {
    await db.cyberLogs.delete(id);
    await enqueueSync('cyberLogs', id, 'delete');
  };

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cyber Lab & Career Development"
        subtitle="13 cybersecurity domains, authorised lab journals, CTF records, certifications, projects & career tracks"
        actions={
          <>
            <button
              type="button"
              onClick={() => openAddLog('lab')}
              className="os-btn-secondary text-xs py-2 px-3"
            >
              <Terminal className="w-3.5 h-3.5" />
              Log Lab / CTF
            </button>
            <button
              type="button"
              onClick={() => openAddLog('cert')}
              className="os-btn-secondary text-xs py-2 px-3"
            >
              <Award className="w-3.5 h-3.5" />
              Add Certification
            </button>
            <button
              type="button"
              onClick={() => openAddLog('project')}
              className="os-btn-primary text-xs py-2 px-3.5"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              Add GitHub Project
            </button>
          </>
        }
      />

      {/* KPI Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="os-card p-4">
          <div className="text-xs text-slate-500">Overall Skill Readiness</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">{overallReadiness}%</div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-900/[0.07] dark:bg-white/[0.09] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full"
              style={{ width: `${overallReadiness}%` }}
            />
          </div>
        </div>
        <div className="os-card p-4">
          <div className="text-xs text-slate-500">Authorised Labs & CTFs</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {labAndCtfLogs.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">Practical writeups recorded</div>
        </div>
        <div className="os-card p-4">
          <div className="text-xs text-slate-500">Certifications</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {certLogs.filter((c) => c.status === 'earned' || c.status === 'completed').length}
            <span className="text-sm font-normal text-slate-400"> / {certLogs.length}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">Earned vs tracked</div>
        </div>
        <div className="os-card p-4">
          <div className="text-xs text-slate-500">Security Portfolio</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {projectLogs.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">GitHub tools & repos</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-white/55 dark:bg-white/[0.07] border border-white/75 dark:border-white/[0.12] backdrop-blur-xl p-1 rounded-full shadow-xs w-fit">
        {(
          [
            { id: 'roadmap', label: 'Skill Roadmap (13)' },
            { id: 'labs', label: `Labs & CTFs (${labAndCtfLogs.length})` },
            { id: 'certs', label: `Certifications (${certLogs.length})` },
            { id: 'projects', label: `GitHub Projects (${projectLogs.length})` },
            { id: 'careers', label: 'Career Tracks (4)' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
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

      {/* TAB 1: 13-DOMAIN CYBERSECURITY ROADMAP */}
      {activeTab === 'roadmap' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => {
              const pct = skillProgress(skill);
              const doneSubs = skill.subSkills.filter((s) => s.completed).length;
              return (
                <div
                  key={skill.id}
                  onClick={() => setSelectedSkillId(skill.id)}
                  className="os-card p-4 hover:border-cyan-400/60 dark:hover:border-cyan-400/40 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/60 dark:bg-white/[0.09] text-slate-600 dark:text-slate-400">
                        {skill.category}
                      </span>
                      <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                        {LEVEL_LABEL[skill.level]}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {skill.domain}
                    </h3>
                    <div className="mt-3 flex justify-between text-[11px] text-slate-500">
                      <span>
                        Checkpoints: {doneSubs}/{skill.subSkills.length}
                      </span>
                      <span className="font-mono">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-900/[0.07] dark:bg-white/[0.09] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {skills.some((s) => skillProgress(s) > 0) && (
            <div className="os-card p-5">
              <h2 className="text-sm font-semibold mb-4">Skill Proficiency Overview</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ bottom: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="score" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUTHORISED LABS & CTFS */}
      {activeTab === 'labs' && (
        <div className="os-card p-5">
          {labAndCtfLogs.length === 0 ? (
            <EmptyState
              icon={<Flag className="w-5 h-5" />}
              title="No authorised labs or CTF achievements logged yet"
              description="Document TryHackMe rooms, Hack The Box machines, PortSwigger labs, home lab exercises, and CTF writeups."
              action={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openAddLog('lab')}
                    className="os-btn-primary text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log Lab
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddLog('ctf')}
                    className="os-btn-secondary text-xs"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Log CTF
                  </button>
                </div>
              }
            />
          ) : (
            <div className="space-y-3">
              {labAndCtfLogs.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                        {item.kind}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{item.platform}</span>
                      {item.difficulty && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.08]">
                          {item.difficulty}
                        </span>
                      )}
                      {item.scoreOrResult && (
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                          {item.scoreOrResult}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    {item.writeup && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line">
                        {item.writeup}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-slate-400">
                      {formatShortDate(item.date)}
                    </span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-500"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteLog(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CERTIFICATIONS */}
      {activeTab === 'certs' && (
        <div className="os-card p-5">
          {certLogs.length === 0 ? (
            <EmptyState
              icon={<Award className="w-5 h-5" />}
              title="No certifications tracked yet"
              description="Track CompTIA Security+, eJPT, BTL1, PNPT, AWS Security, OSCP, and exam target dates."
              action={
                <button
                  type="button"
                  onClick={() => openAddLog('cert')}
                  className="os-btn-primary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Track Certification
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {certLogs.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {c.status.replace('_', ' ')}
                    </span>
                    <h3 className="text-sm font-semibold mt-1.5">{c.title}</h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.platform} • Target/Earned: {formatShortDate(c.date)}
                    </div>
                    {c.scoreOrResult && (
                      <div className="text-xs font-mono text-cyan-500 mt-1">
                        Credential / Score: {c.scoreOrResult}
                      </div>
                    )}
                    {c.writeup && <p className="text-xs text-slate-500 mt-1.5">{c.writeup}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteLog(c.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GITHUB PROJECTS & PORTFOLIO */}
      {activeTab === 'projects' && (
        <div className="os-card p-5">
          {projectLogs.length === 0 ? (
            <EmptyState
              icon={<Code2 className="w-5 h-5" />}
              title="No cybersecurity projects in your portfolio yet"
              description="Showcase Python security tools, network scanners, SIEM homelab repos, and open-source work."
              action={
                <button
                  type="button"
                  onClick={() => openAddLog('project')}
                  className="os-btn-primary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add GitHub Project
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectLogs.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                        {p.status.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-1">
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-cyan-500"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteLog(p.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold mt-1.5">{p.title}</h3>
                    {p.writeup && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.writeup}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.08]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CAREER TRACKS */}
      {activeTab === 'careers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CYBER_CAREER_TRACKS.map((track) => {
            const matchedSkills = track.requiredSkillIds
              .map((id) => skillMap.get(id))
              .filter(Boolean) as CyberSkill[];
            const readiness =
              matchedSkills.length > 0
                ? Math.round(
                    matchedSkills.reduce((s, sk) => s + skillProgress(sk), 0) /
                      matchedSkills.length
                  )
                : 0;

            return (
              <div key={track.id} className="os-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 mb-1">
                      <Compass className="w-3.5 h-3.5" />
                      Career Pathway
                    </div>
                    <h3 className="text-base font-semibold">{track.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {track.tagline}
                    </p>
                  </div>
                  <span className="font-mono text-lg font-semibold text-cyan-600 dark:text-cyan-400 shrink-0">
                    {readiness}%
                  </span>
                </div>

                <div className="h-2 rounded-full bg-slate-900/[0.07] dark:bg-white/[0.09] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full transition-all"
                    style={{ width: `${readiness}%` }}
                  />
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-2">
                    Core Skill Alignment
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchedSkills.map((sk) => (
                      <button
                        key={sk.id}
                        type="button"
                        onClick={() => setSelectedSkillId(sk.id)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-white/55 dark:bg-white/[0.08] hover:bg-cyan-50 dark:hover:bg-cyan-500/15 transition-colors cursor-pointer"
                      >
                        {sk.domain}:{' '}
                        <span className="font-mono font-semibold">{skillProgress(sk)}%</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/50 dark:border-white/[0.08]">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                    Recommended Certifications
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {track.recommendedCerts.map((cert) => (
                      <span
                        key={cert}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/70 dark:border-white/[0.12] text-slate-600 dark:text-slate-300"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SKILL WORKSPACE MODAL */}
      <Modal
        open={Boolean(activeSkill)}
        onClose={() => setSelectedSkillId(null)}
        title={activeSkill?.domain || ''}
        subtitle={activeSkill ? `${activeSkill.category} • Cybersecurity Roadmap` : ''}
        maxWidth="max-w-xl"
      >
        {activeSkill && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Current Proficiency Level
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['not_started', 'beginner', 'intermediate', 'advanced', 'expert'] as const).map(
                  (lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => updateSkill(activeSkill, { level: lvl })}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-medium border transition-all cursor-pointer ${
                        activeSkill.level === lvl
                          ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white border-white/40 shadow-[0_4px_14px_-3px_rgba(6,182,212,0.55)]'
                          : 'border-white/70 dark:border-white/[0.12] text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {LEVEL_LABEL[lvl]}
                    </button>
                  )
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span>Key Checkpoints</span>
                <span className="font-mono text-slate-500">
                  {activeSkill.subSkills.filter((s) => s.completed).length}/
                  {activeSkill.subSkills.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {activeSkill.subSkills.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      const nextSubs = activeSkill.subSkills.map((s) =>
                        s.id === sub.id ? { ...s, completed: !s.completed } : s
                      );
                      void updateSkill(activeSkill, { subSkills: nextSubs });
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/55 dark:bg-white/[0.05] text-left cursor-pointer"
                  >
                    {sub.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <span className={`text-xs ${sub.completed ? 'line-through text-slate-400' : ''}`}>
                      {sub.title}
                    </span>
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubSkill.trim()) return;
                  void updateSkill(activeSkill, {
                    subSkills: [
                      ...activeSkill.subSkills,
                      { id: generateId('sub'), title: newSubSkill.trim(), completed: false },
                    ],
                  });
                  setNewSubSkill('');
                }}
                className="flex gap-2 mt-2.5"
              >
                <input
                  value={newSubSkill}
                  onChange={(e) => setNewSubSkill(e.target.value)}
                  placeholder="Add custom skill checkpoint..."
                  className="os-input py-2 text-xs"
                />
                <button type="submit" className="os-btn-secondary py-2 px-3 text-xs shrink-0">
                  + Add
                </button>
              </form>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">Study Notes & Resources</label>
              <textarea
                rows={4}
                value={activeSkill.notes}
                onChange={(e) => updateSkill(activeSkill, { notes: e.target.value })}
                placeholder="Commands, cheat sheets, tools, authorised practice notes..."
                className="os-input text-xs"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ADD LOG MODAL */}
      <Modal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title={
          logKind === 'lab'
            ? 'Log Authorised Lab'
            : logKind === 'ctf'
            ? 'Log CTF Achievement'
            : logKind === 'cert'
            ? 'Track Certification'
            : 'Add GitHub / Portfolio Project'
        }
      >
        <form onSubmit={handleSaveLog} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Entry Type</label>
              <select
                value={logKind}
                onChange={(e) => setLogKind(e.target.value as CyberLog['kind'])}
                className="os-input"
              >
                <option value="lab">Authorised Lab</option>
                <option value="ctf">CTF Challenge</option>
                <option value="cert">Certification</option>
                <option value="project">GitHub Project</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={logStatus}
                onChange={(e) => setLogStatus(e.target.value as CyberLog['status'])}
                className="os-input"
              >
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="earned">Earned</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input
              required
              value={logTitle}
              onChange={(e) => setLogTitle(e.target.value)}
              placeholder="e.g. Blue Room / CompTIA Security+ SY0-701 / Python Port Scanner"
              className="os-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Platform / Issuer
              </label>
              <input
                value={logPlatform}
                onChange={(e) => setLogPlatform(e.target.value)}
                placeholder="TryHackMe, HTB, CompTIA, GitHub..."
                className="os-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(logKind === 'lab' || logKind === 'ctf') && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Difficulty</label>
                <select
                  value={logDifficulty}
                  onChange={(e) =>
                    setLogDifficulty(e.target.value as NonNullable<CyberLog['difficulty']>)
                  }
                  className="os-input"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                  <option value="Insane">Insane</option>
                </select>
              </div>
            )}
            <div className={logKind === 'lab' || logKind === 'ctf' ? '' : 'col-span-2'}>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Result / Score / Credential ID
              </label>
              <input
                value={logScore}
                onChange={(e) => setLogScore(e.target.value)}
                placeholder="e.g. Rank #12, 820/900, Flag captured"
                className="os-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              GitHub / Lab / Credential URL (optional)
            </label>
            <input
              type="url"
              value={logUrl}
              onChange={(e) => setLogUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="os-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Tags (comma separated)
            </label>
            <input
              value={logTags}
              onChange={(e) => setLogTags(e.target.value)}
              placeholder="nmap, python, siem, linux, owasp"
              className="os-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Writeup / Key Takeaways
            </label>
            <textarea
              rows={3}
              value={logWriteup}
              onChange={(e) => setLogWriteup(e.target.value)}
              placeholder="Methodology, defensive lessons, architecture notes..."
              className="os-input text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setLogModalOpen(false)} className="os-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Entry
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
