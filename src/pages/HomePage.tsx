import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle2,
  Circle,
  GraduationCap,
  Clock,
  Flame,
  Wallet,
  CalendarClock,
  Plus,
  ArrowUpRight,
  Timer,
  Shield,
  BookOpen,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { db, enqueueSync } from '../db/database';
import {
  computeStreaks,
  daysUntil,
  formatKathmanduDate,
  formatKathmanduTime,
  formatNPR,
  formatShortDate,
  getCurrentMonthISO,
  getDynamicGreeting,
  getTodayISO,
} from '../lib/dateUtils';
import { generateId } from '../lib/crypto';
import type { NavSection, PlannerTask, UserProfile } from '../types/models';
import { EmptyState } from '../components/ui/Modal';

interface HomePageProps {
  profile: UserProfile;
  onNavigate: (section: NavSection) => void;
}

export function HomePage({ profile, onNavigate }: HomePageProps) {
  const [now, setNow] = useState(() => new Date());
  const [quickTaskTitle, setQuickTaskTitle] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const todayISO = getTodayISO();
  const currentMonth = getCurrentMonthISO();

  const modules = useLiveQuery(() => db.modules.toArray(), []) ?? [];
  const assessments = useLiveQuery(() => db.assessments.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const routines = useLiveQuery(() => db.routines.toArray(), []) ?? [];
  const focusSessions = useLiveQuery(() => db.focusSessions.toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const diaryEntries = useLiveQuery(() => db.diaryEntries.toArray(), []) ?? [];

  const academicStats = useMemo(() => {
    const totalCredits = modules.reduce((sum, m) => sum + m.credits, 0);
    const completedCredits = modules
      .filter((m) => m.status === 'completed')
      .reduce((sum, m) => sum + m.credits, 0);
    const totalTopics = modules.reduce((sum, m) => sum + m.topics.length, 0);
    const completedTopics = modules.reduce(
      (sum, m) => sum + m.topics.filter((t) => t.completed).length,
      0
    );
    const totalStudyMins =
      modules.reduce((sum, m) => sum + (m.studyMinutes || 0), 0) +
      focusSessions
        .filter((s) => !s.moduleId)
        .reduce((sum, s) => sum + Math.round(s.durationSeconds / 60), 0);

    return {
      totalCredits: totalCredits || 480,
      completedCredits,
      totalTopics,
      completedTopics,
      studyHours: +(totalStudyMins / 60).toFixed(1),
    };
  }, [modules, focusSessions]);

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.date === todayISO)
        .sort((a, b) => Number(a.completed) - Number(b.completed)),
    [tasks, todayISO]
  );

  const completedTodayCount = todayTasks.filter((t) => t.completed).length;
  const completedAllCount = tasks.filter((t) => t.completed).length;
  const todayCompletionPct =
    todayTasks.length > 0 ? Math.round((completedTodayCount / todayTasks.length) * 100) : 0;

  const upcomingAssessments = useMemo(() => {
    const modMap = new Map(modules.map((m) => [m.id, m]));
    return assessments
      .filter((a) => a.status !== 'graded' && a.status !== 'submitted' && a.dueDate >= todayISO)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5)
      .map((a) => ({ ...a, module: modMap.get(a.moduleId) }));
  }, [assessments, modules, todayISO]);

  const streaks = useMemo(() => {
    const activeDates = new Set<string>();
    tasks.forEach((t) => {
      if (t.completed) activeDates.add(t.date);
    });
    routines.forEach((r) => {
      r.completedDates.forEach((d) => activeDates.add(d));
    });
    focusSessions.forEach((s) => activeDates.add(s.date));
    diaryEntries.forEach((d) => activeDates.add(d.date));
    return computeStreaks(activeDates);
  }, [tasks, routines, focusSessions, diaryEntries]);

  const financeStats = useMemo(() => {
    const monthTx = transactions.filter((t) => t.date.startsWith(currentMonth));
    const monthIncome = monthTx
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const monthExpense = monthTx
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netBalance =
      accounts.reduce((sum, a) => sum + a.initialBalance, 0) +
      transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0) -
      transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    return {
      monthIncome,
      monthExpense,
      netBalance,
      hasData: accounts.length > 0 || transactions.length > 0,
    };
  }, [accounts, transactions, currentMonth]);

  const todayDiary = useMemo(
    () => diaryEntries.find((d) => d.date === todayISO),
    [diaryEntries, todayISO]
  );

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    const item: PlannerTask = {
      id: generateId('task'),
      title: quickTaskTitle.trim(),
      description: '',
      date: todayISO,
      priority: 'medium',
      category: 'Study',
      completed: false,
      recurrence: 'none',
      isTimeBlock: false,
      updatedAt: new Date().toISOString(),
    };
    await db.tasks.put(item);
    await enqueueSync('tasks', item.id, 'upsert', item);
    setQuickTaskTitle('');
  };

  const toggleTask = async (task: PlannerTask) => {
    const updated: PlannerTask = {
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };
    await db.tasks.put(updated);
    await enqueueSync('tasks', updated.id, 'upsert', updated);
  };

  const priorityBadge: Record<PlannerTask['priority'], string> = {
    urgent: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/20',
    high: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20',
    medium: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20',
    low: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/15',
  };

  return (
    <div className="space-y-5">
      {/* Liquid Glass Greeting Hero Banner */}
      <div className="os-card p-6 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-cyan-400/25 via-sky-400/15 to-pink-400/20 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-white/10 border border-white/70 dark:border-white/15 text-[11px] font-medium text-slate-700 dark:text-cyan-100 mb-3">
              <span>{formatKathmanduDate(now)}</span>
              <span className="opacity-40">•</span>
              <span className="font-mono tabular-nums">{formatKathmanduTime(now)} NPT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {getDynamicGreeting(profile.name)}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300/85 mt-1">
              {profile.degree} • Year {profile.currentYear} • {profile.college}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('focus')}
              className="os-btn-primary text-xs py-2.5 px-4"
            >
              <Timer className="w-3.5 h-3.5" />
              Start Focus
            </button>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="os-btn-secondary text-xs py-2.5 px-4"
            >
              <Plus className="w-3.5 h-3.5" />
              Plan Day
            </button>
            <button
              type="button"
              onClick={() => onNavigate('diary')}
              className="os-btn-secondary text-xs py-2.5 px-4"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {todayDiary ? 'Edit Journal' : 'Write Diary'}
            </button>
          </div>
        </div>
      </div>

      {/* iOS Liquid Glass Control Center Stat Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('study')}
          className="os-card p-4.5 text-left hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Academic Credits
            </span>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center text-white shadow-[0_6px_16px_-4px_rgba(6,182,212,0.55)]">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {academicStats.completedCredits}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              /{academicStats.totalCredits}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-900/[0.07] dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all"
              style={{
                width: `${Math.min(100, (academicStats.completedCredits / academicStats.totalCredits) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300/80 mt-1.5">
            {academicStats.completedTopics}/{academicStats.totalTopics} syllabus topics done
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('focus')}
          className="os-card p-4.5 text-left hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Logged Study Hours
            </span>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-fuchsia-400 to-rose-500 flex items-center justify-center text-white shadow-[0_6px_16px_-4px_rgba(244,63,94,0.48)]">
              <Clock className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {academicStats.studyHours}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> hrs</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300/80 mt-3.5">
            {focusSessions.length} recorded focus session{focusSessions.length === 1 ? '' : 's'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('productivity')}
          className="os-card p-4.5 text-left hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Productivity & Streak
            </span>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-[0_6px_16px_-4px_rgba(245,158,11,0.5)]">
              <Flame className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {streaks.currentStreak}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> days</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300/80 mt-3.5">
            Best: {streaks.bestStreak}d • Today: {todayCompletionPct}% ({completedAllCount} done)
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="os-card p-4.5 text-left hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Net Balance ({profile.currency})
            </span>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-[0_6px_16px_-4px_rgba(16,185,129,0.5)]">
              <Wallet className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white truncate">
            {formatNPR(financeStats.netBalance)}
          </div>
          <div className="flex items-center gap-3 text-[11px] mt-3.5">
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-mono">
              <TrendingUp className="w-3 h-3" />
              {formatNPR(financeStats.monthIncome)}
            </span>
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-mono">
              <TrendingDown className="w-3 h-3" />
              {formatNPR(financeStats.monthExpense)}
            </span>
          </div>
        </button>
      </div>

      {/* Main 2-Column Glass Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 os-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Today&apos;s Tasks
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300/80">
                {todayTasks.length === 0
                  ? 'No tasks scheduled for today yet'
                  : `${completedTodayCount} of ${todayTasks.length} completed`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="os-btn-ghost text-xs py-1.5 px-3"
            >
              Open Planner
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleQuickAddTask} className="flex gap-2 mb-4">
            <input
              type="text"
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              placeholder="Quick add a task for today..."
              className="os-input py-2 text-sm"
            />
            <button type="submit" className="os-btn-primary py-2 px-4 shrink-0">
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>

          {todayTasks.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 className="w-5 h-5" />}
              title="Clean slate for today"
              description="Add your study goals, assignments, or daily priorities above to start building today's completion score."
            />
          ) : (
            <div className="space-y-2">
              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className="os-card-subtle flex items-center justify-between gap-3 p-3 hover:bg-white/70 dark:hover:bg-white/[0.09] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task)}
                    className="flex items-center gap-3 min-w-0 text-left flex-1 cursor-pointer"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4.5 h-4.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          task.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </div>
                      {(task.startTime || task.category) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{task.category}</span>
                          {task.startTime && (
                            <span className="font-mono">
                              {task.startTime}
                              {task.endTime ? `–${task.endTime}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full shrink-0 ${priorityBadge[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="lg:col-span-5 space-y-5">
          <section className="os-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Upcoming Exams & Deadlines
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300/80">
                  Assignments, labs & exam countdowns
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('study')}
                className="os-btn-ghost text-xs py-1.5 px-3"
              >
                Manage
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingAssessments.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarClock className="w-5 h-5" />}
                title="No upcoming exams or deadlines"
                description="Add assignment deadlines or exam dates inside any Study module or Settings."
                action={
                  <button
                    type="button"
                    onClick={() => onNavigate('study')}
                    className="os-btn-secondary text-xs py-1.5 px-3.5"
                  >
                    Go to Study Modules
                  </button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {upcomingAssessments.map((item) => {
                  const days = daysUntil(item.dueDate);
                  return (
                    <div
                      key={item.id}
                      className="os-card-subtle flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                            {item.type}
                          </span>
                          <span className="text-xs text-slate-500 truncate">
                            {item.module?.code}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate mt-1">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Due {formatShortDate(item.dueDate)}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                          days <= 3
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                            : days <= 10
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-white/60 dark:bg-white/10 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {days === 0 ? 'Today' : `${days}d left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="os-card p-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Important Reminders
            </h2>
            <div className="space-y-2.5">
              {profile.pinIsDefault && (
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="w-full flex items-start gap-3 p-3 rounded-2xl bg-amber-400/15 border border-amber-400/35 text-left cursor-pointer hover:bg-amber-400/20 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                      Personalise your 4-digit security PIN
                    </div>
                    <div className="text-[11px] text-amber-800/85 dark:text-amber-200/80 mt-0.5">
                      You are using the default PIN (1234). Update it in Settings → Security.
                    </div>
                  </div>
                </button>
              )}

              {!todayDiary && (
                <button
                  type="button"
                  onClick={() => onNavigate('diary')}
                  className="w-full os-card-subtle flex items-start gap-3 p-3 text-left hover:bg-white/75 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      Daily Journal not logged yet
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300/80 mt-0.5">
                      Record today&apos;s mood, energy, achievements, and tomorrow&apos;s plan.
                    </div>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigate('cyber')}
                className="w-full os-card-subtle flex items-start gap-3 p-3 text-left hover:bg-white/75 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Cybersecurity Career Roadmap
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300/80 mt-0.5">
                    13 skill domains ready to track alongside your GCT BSc (Hons) modules.
                  </div>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
