import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Calendar,
  Check,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db, enqueueSync } from '../db/database';
import { generateId } from '../lib/crypto';
import { formatShortDate, getCurrentMonthISO, getTodayISO } from '../lib/dateUtils';
import type { DiaryEntry, MoodLevel } from '../types/models';
import { EmptyState, PageHeader } from '../components/ui/Modal';

const MOODS: { level: MoodLevel; label: string; color: string; pill: string }[] = [
  { level: 1, label: 'Very Bad', color: '#EF4444', pill: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  { level: 2, label: 'Bad', color: '#F97316', pill: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { level: 3, label: 'Okay', color: '#EAB308', pill: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { level: 4, label: 'Good', color: '#22C55E', pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  { level: 5, label: 'Great', color: '#06B6D4', pill: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' },
];

export function DiaryPage() {
  const todayISO = getTodayISO();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [calendarMonth, setCalendarMonth] = useState(getCurrentMonthISO());
  const [savedNotice, setSavedNotice] = useState(false);

  const entries = useLiveQuery(() => db.diaryEntries.toArray(), []) ?? [];
  const entryMap = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
  const existing = entryMap.get(selectedDate);

  const [mood, setMood] = useState<MoodLevel>(4);
  const [energy, setEnergy] = useState(7);
  const [performance, setPerformance] = useState(7);
  const [achievements, setAchievements] = useState('');
  const [lessons, setLessons] = useState('');
  const [problems, setProblems] = useState('');
  const [tomorrowsPlan, setTomorrowsPlan] = useState('');
  const [freeWrite, setFreeWrite] = useState('');

  useEffect(() => {
    if (existing) {
      setMood(existing.mood);
      setEnergy(existing.energy);
      setPerformance(existing.performance);
      setAchievements(existing.achievements);
      setLessons(existing.lessons);
      setProblems(existing.problems);
      setTomorrowsPlan(existing.tomorrowsPlan);
      setFreeWrite(existing.freeWrite);
    } else {
      setMood(4);
      setEnergy(7);
      setPerformance(7);
      setAchievements('');
      setLessons('');
      setProblems('');
      setTomorrowsPlan('');
      setFreeWrite('');
    }
  }, [selectedDate, existing?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const record: DiaryEntry = {
      id: existing?.id || generateId('diary'),
      date: selectedDate,
      mood,
      energy,
      performance,
      achievements: achievements.trim(),
      lessons: lessons.trim(),
      problems: problems.trim(),
      tomorrowsPlan: tomorrowsPlan.trim(),
      freeWrite: freeWrite.trim(),
      updatedAt: new Date().toISOString(),
    };
    await db.diaryEntries.put(record);
    await enqueueSync('diaryEntries', record.id, 'upsert', record);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleDelete = async () => {
    if (!existing) return;
    await db.diaryEntries.delete(existing.id);
    await enqueueSync('diaryEntries', existing.id, 'delete');
  };

  const monthCalendar = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startDow = first.getUTCDay();
    const daysCount = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysCount; d++) {
      cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return { cells, year: y, month: m };
  }, [calendarMonth]);

  const monthAnalytics = useMemo(() => {
    const mEntries = entries
      .filter((e) => e.date.startsWith(calendarMonth))
      .sort((a, b) => a.date.localeCompare(b.date));

    const avgMood =
      mEntries.length > 0
        ? +(mEntries.reduce((s, e) => s + e.mood, 0) / mEntries.length).toFixed(1)
        : null;
    const avgEnergy =
      mEntries.length > 0
        ? +(mEntries.reduce((s, e) => s + e.energy, 0) / mEntries.length).toFixed(1)
        : null;
    const avgPerf =
      mEntries.length > 0
        ? +(mEntries.reduce((s, e) => s + e.performance, 0) / mEntries.length).toFixed(1)
        : null;

    const chartData = mEntries.map((e) => ({
      day: e.date.slice(-2),
      mood: e.mood * 2, // scaled to 10 for clean comparison
      energy: e.energy,
      performance: e.performance,
    }));

    const distribution = MOODS.map((m) => ({
      ...m,
      count: mEntries.filter((e) => e.mood === m.level).length,
    }));

    return { mEntries, avgMood, avgEnergy, avgPerf, chartData, distribution };
  }, [entries, calendarMonth]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Diary & Mood"
        subtitle="Reflect daily on mood, energy, performance, achievements, lessons, and tomorrow's focus"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setCalendarMonth(e.target.value.slice(0, 7));
                }
              }}
              className="os-input py-2 px-3 text-xs font-mono !w-auto"
            />
            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayISO);
                setCalendarMonth(getCurrentMonthISO());
              }}
              className="os-btn-secondary py-2 px-3 text-xs"
            >
              Today
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily Journal Composer */}
        <form onSubmit={handleSave} className="lg:col-span-7 os-card p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-white/50 dark:border-white/[0.08] pb-3.5">
            <div>
              <h2 className="text-base font-semibold">
                {formatShortDate(selectedDate)} {selectedDate === todayISO ? '(Today)' : ''}
              </h2>
              <p className="text-xs text-slate-500">
                {existing ? 'Saved entry — edit anytime' : 'New journal entry'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {existing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                  title="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button type="submit" className="os-btn-primary text-xs py-2 px-4">
                {savedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : (
                  'Save Journal'
                )}
              </button>
            </div>
          </div>

          {/* 5-Tier Mood Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              How was your mood?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.level}
                  type="button"
                  onClick={() => setMood(m.level)}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    mood === m.level
                      ? `${m.pill} ring-2 ring-offset-1 dark:ring-offset-[#12151E] ring-current`
                      : 'border-white/70 dark:border-white/[0.12] text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full mx-auto mb-1.5"
                    style={{ backgroundColor: m.color }}
                  />
                  <span className="block truncate">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy & Performance Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="os-card-subtle p-3.5">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium text-slate-600 dark:text-slate-300">Energy Level</span>
                <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                  {energy}/10
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="os-card-subtle p-3.5">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Performance Rating
                </span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {performance}/10
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={performance}
                onChange={(e) => setPerformance(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Structured Prompts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Daily Achievements
              </label>
              <textarea
                rows={3}
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="What wins did you earn today?"
                className="os-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Lessons Learned
              </label>
              <textarea
                rows={3}
                value={lessons}
                onChange={(e) => setLessons(e.target.value)}
                placeholder="Insights from lectures, labs, or life..."
                className="os-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Problems / Challenges
              </label>
              <textarea
                rows={3}
                value={problems}
                onChange={(e) => setProblems(e.target.value)}
                placeholder="What slowed you down or felt tough?"
                className="os-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Tomorrow&apos;s Plan
              </label>
              <textarea
                rows={3}
                value={tomorrowsPlan}
                onChange={(e) => setTomorrowsPlan(e.target.value)}
                placeholder="Top 1–3 priorities for tomorrow..."
                className="os-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Free Reflection
            </label>
            <textarea
              rows={3}
              value={freeWrite}
              onChange={(e) => setFreeWrite(e.target.value)}
              placeholder="Write anything on your mind..."
              className="os-input text-xs"
            />
          </div>
        </form>

        {/* Right Column: Mood Calendar + Monthly Mood Analytics */}
        <div className="lg:col-span-5 space-y-5">
          {/* Mood Calendar */}
          <div className="os-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-500" />
                <h2 className="text-sm font-semibold">Mood Calendar</h2>
              </div>
              <input
                type="month"
                value={calendarMonth}
                onChange={(e) => e.target.value && setCalendarMonth(e.target.value)}
                className="os-input py-1 px-2.5 text-xs font-mono !w-auto"
              />
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mb-1.5">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {monthCalendar.cells.map((iso, i) => {
                if (!iso) return <div key={`e_${i}`} className="h-9" />;
                const ent = entryMap.get(iso);
                const moodObj = ent ? MOODS.find((m) => m.level === ent.mood) : null;
                const isSelected = iso === selectedDate;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                    className={`h-9 rounded-xl flex flex-col items-center justify-center text-xs font-mono border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500 ring-2 ring-cyan-500/25 font-semibold'
                        : 'border-white/65 dark:border-white/[0.1] hover:border-slate-300'
                    }`}
                    style={
                      moodObj
                        ? {
                            backgroundColor: `${moodObj.color}22`,
                            borderColor: isSelected ? undefined : `${moodObj.color}55`,
                          }
                        : undefined
                    }
                    title={ent ? `${iso} — ${moodObj?.label} (Perf ${ent.performance}/10)` : iso}
                  >
                    <span>{Number(iso.slice(-2))}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-white/50 dark:border-white/[0.08]">
              {MOODS.map((m) => (
                <span key={m.level} className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Monthly Mood Analytics */}
          <div className="os-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-semibold">Monthly Mood Analytics</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {monthAnalytics.mEntries.length} entries
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="os-card-subtle p-2.5">
                <div className="text-[10px] text-slate-500">Avg Mood</div>
                <div className="text-base font-semibold font-mono mt-0.5">
                  {monthAnalytics.avgMood !== null ? `${monthAnalytics.avgMood}/5` : '—'}
                </div>
              </div>
              <div className="os-card-subtle p-2.5">
                <div className="text-[10px] text-slate-500">Avg Energy</div>
                <div className="text-base font-semibold font-mono mt-0.5">
                  {monthAnalytics.avgEnergy !== null ? `${monthAnalytics.avgEnergy}/10` : '—'}
                </div>
              </div>
              <div className="os-card-subtle p-2.5">
                <div className="text-[10px] text-slate-500">Avg Perf.</div>
                <div className="text-base font-semibold font-mono mt-0.5">
                  {monthAnalytics.avgPerf !== null ? `${monthAnalytics.avgPerf}/10` : '—'}
                </div>
              </div>
            </div>

            {monthAnalytics.chartData.length === 0 ? (
              <EmptyState
                compact
                icon={<Sparkles className="w-4 h-4" />}
                title="No analytics for this month yet"
                description="Save your daily journal entries to see real mood, energy, and performance curves."
              />
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthAnalytics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="performance"
                      name="Performance"
                      stroke="#10B981"
                      fill="#10B98122"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="energy"
                      name="Energy"
                      stroke="#0EA5E9"
                      fill="#0EA5E922"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {monthAnalytics.mEntries.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-white/50 dark:border-white/[0.08]">
                {monthAnalytics.distribution.map((d) => (
                  <div key={d.level} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-slate-500 text-[11px]">{d.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-900/[0.07] dark:bg-white/[0.09] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(d.count / Math.max(1, monthAnalytics.mEntries.length)) * 100}%`,
                          backgroundColor: d.color,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[11px] w-5 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {entries.length > 0 && (
            <div className="os-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold">Recent Entries</h3>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {[...entries]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 8)
                  .map((ent) => {
                    const mObj = MOODS.find((m) => m.level === ent.mood);
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => setSelectedDate(ent.date)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/75 dark:hover:bg-white/[0.1] text-left cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium">{formatShortDate(ent.date)}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {ent.achievements || ent.freeWrite || 'Journal recorded'}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/60 dark:bg-white/[0.09] shrink-0">
                          {mObj?.label}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
