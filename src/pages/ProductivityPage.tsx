import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, CheckCircle2, Clock, Flame, Trophy } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db } from '../db/database';
import { addDaysISO, computeStreaks, getCurrentMonthISO, getTodayISO } from '../lib/dateUtils';
import { EmptyState, PageHeader } from '../components/ui/Modal';

export function ProductivityPage() {
  const todayISO = getTodayISO();
  const currentMonth = getCurrentMonthISO();

  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const routines = useLiveQuery(() => db.routines.toArray(), []) ?? [];
  const focusSessions = useLiveQuery(() => db.focusSessions.toArray(), []) ?? [];
  const diaryEntries = useLiveQuery(() => db.diaryEntries.toArray(), []) ?? [];

  const analytics = useMemo(() => {
    // Activity map: date -> count of real actions (completed tasks + routines + focus sessions + diary)
    const activityMap = new Map<string, number>();
    const bump = (date: string, amount = 1) => {
      if (!date) return;
      activityMap.set(date, (activityMap.get(date) ?? 0) + amount);
    };

    tasks.forEach((t) => {
      if (t.completed) bump(t.date, 1);
    });
    routines.forEach((r) => {
      r.completedDates.forEach((d) => bump(d, 1));
    });
    focusSessions.forEach((s) => bump(s.date, Math.max(1, Math.round(s.durationSeconds / 1500))));
    diaryEntries.forEach((d) => bump(d.date, 1));

    const streaks = computeStreaks(activityMap.keys());

    // Today completion
    const todayTasks = tasks.filter((t) => t.date === todayISO);
    const todayDone = todayTasks.filter((t) => t.completed).length;
    const dailyCompletionPct =
      todayTasks.length > 0 ? Math.round((todayDone / todayTasks.length) * 100) : 0;

    // Weekly (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO, -(6 - i)));
    const weeklyChart = last7Days.map((iso) => {
      const dTasks = tasks.filter((t) => t.date === iso && t.completed).length;
      const dRoutines = routines.filter((r) => r.completedDates.includes(iso)).length;
      const dFocusMins = Math.round(
        focusSessions.filter((s) => s.date === iso).reduce((sum, s) => sum + s.durationSeconds, 0) / 60
      );
      return {
        day: iso.slice(5),
        completed: dTasks + dRoutines,
        focusMins: dFocusMins,
      };
    });

    const weekTasksTotal = tasks.filter((t) => last7Days.includes(t.date)).length;
    const weekTasksDone = tasks.filter((t) => last7Days.includes(t.date) && t.completed).length;
    const weeklyProductivityPct =
      weekTasksTotal > 0 ? Math.round((weekTasksDone / weekTasksTotal) * 100) : 0;

    // Monthly productivity
    const monthTasks = tasks.filter((t) => t.date.startsWith(currentMonth));
    const monthTasksDone = monthTasks.filter((t) => t.completed).length;
    const monthlyProductivityPct =
      monthTasks.length > 0 ? Math.round((monthTasksDone / monthTasks.length) * 100) : 0;

    const totalFocusHours = +(
      focusSessions.reduce((s, f) => s + f.durationSeconds, 0) / 3600
    ).toFixed(1);

    // Monthly 30-day trend
    const last30 = Array.from({ length: 30 }, (_, i) => addDaysISO(todayISO, -(29 - i)));
    const monthlyChart = last30.map((iso) => ({
      date: iso.slice(5),
      activity: activityMap.get(iso) ?? 0,
      focusMins: Math.round(
        focusSessions.filter((s) => s.date === iso).reduce((sum, s) => sum + s.durationSeconds, 0) / 60
      ),
    }));

    // GitHub-style 52-week heatmap (364 days ending today)
    const heatmapWeeks: { date: string; count: number }[][] = [];
    const totalDays = 52 * 7;
    const startISO = addDaysISO(todayISO, -(totalDays - 1));
    for (let w = 0; w < 52; w++) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const iso = addDaysISO(startISO, w * 7 + d);
        week.push({ date: iso, count: activityMap.get(iso) ?? 0 });
      }
      heatmapWeeks.push(week);
    }

    const totalActiveDays = activityMap.size;

    return {
      streaks,
      dailyCompletionPct,
      weeklyProductivityPct,
      monthlyProductivityPct,
      totalFocusHours,
      weeklyChart,
      monthlyChart,
      heatmapWeeks,
      totalActiveDays,
      hasAnyActivity: totalActiveDays > 0 || tasks.length > 0,
    };
  }, [tasks, routines, focusSessions, diaryEntries, todayISO, currentMonth]);

  const heatColor = (count: number) => {
    if (count <= 0) return 'bg-slate-900/[0.07] dark:bg-white/[0.08] border border-slate-900/[0.04] dark:border-white/[0.05]';
    if (count === 1) return 'bg-emerald-200 dark:bg-emerald-900/70';
    if (count <= 3) return 'bg-emerald-400 dark:bg-emerald-700';
    if (count <= 5) return 'bg-emerald-500 dark:bg-emerald-500';
    return 'bg-emerald-600 dark:bg-emerald-400';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productivity & Activity"
        subtitle="100% real-time analytics generated from your completed tasks, routines, focus sessions, and diary logs"
      />

      {/* Top KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="os-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {analytics.dailyCompletionPct}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Daily completion</div>
        </div>

        <div className="os-card p-4">
          <div className="text-xs text-slate-500">Weekly Rate</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {analytics.weeklyProductivityPct}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Last 7 days</div>
        </div>

        <div className="os-card p-4">
          <div className="text-xs text-slate-500">Monthly Rate</div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {analytics.monthlyProductivityPct}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{currentMonth}</div>
        </div>

        <div className="os-card p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Focus Hours</span>
            <Clock className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {analytics.totalFocusHours}h
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {focusSessions.length} session{focusSessions.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="os-card p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Streaks</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {analytics.streaks.currentStreak}d
          </div>
          <div className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-500" />
            Best: {analytics.streaks.bestStreak}d
          </div>
        </div>
      </div>

      {/* GitHub-Style 52-Week Activity Heatmap */}
      <div className="os-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-semibold">52-Week Consistency Heatmap</h2>
            <p className="text-xs text-slate-500">
              {analytics.totalActiveDays} active day{analytics.totalActiveDays === 1 ? '' : 's'} logged
              across tasks, routines, focus sessions, and diary entries
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Less</span>
            {[0, 1, 2, 4, 6].map((n) => (
              <span key={n} className={`w-3 h-3 rounded-xs ${heatColor(n)}`} />
            ))}
            <span>More</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex gap-1">
            {analytics.heatmapWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} activity point${day.count === 1 ? '' : 's'}`}
                    className={`w-3 h-3 rounded-[3px] transition-colors ${heatColor(day.count)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly & Monthly Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="os-card p-5">
          <h2 className="text-sm font-semibold mb-1">Last 7 Days — Completed Work & Focus</h2>
          <p className="text-xs text-slate-500 mb-4">Tasks/routines completed & focus minutes</p>
          {!analytics.hasAnyActivity ? (
            <EmptyState
              compact
              icon={<Activity className="w-5 h-5" />}
              title="Waiting for your first completed session"
              description="Complete a task, check off a routine, or run a focus timer — real weekly graphs will appear here."
            />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.weeklyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="completed" name="Completed Items" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="focusMins" name="Focus Minutes" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="os-card p-5">
          <h2 className="text-sm font-semibold mb-1">30-Day Activity Output</h2>
          <p className="text-xs text-slate-500 mb-4">Daily total activity points</p>
          {!analytics.hasAnyActivity ? (
            <EmptyState
              compact
              icon={<Flame className="w-5 h-5" />}
              title="No 30-day trend data yet"
              description="Zero placeholder statistics — your real daily consistency builds this chart automatically."
            />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="activity" name="Activity Points" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
