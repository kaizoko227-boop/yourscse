import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Plus,
  Repeat,
  Target,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sparkles,
} from 'lucide-react';
import { db, enqueueSync } from '../db/database';
import { generateId } from '../lib/crypto';
import { addDaysISO, computeStreaks, formatShortDate, getTodayISO } from '../lib/dateUtils';
import type {
  LifeGoal,
  PlannerTask,
  RoutineItem,
  TaskPriority,
  TaskRecurrence,
} from '../types/models';
import { EmptyState, Modal, PageHeader } from '../components/ui/Modal';

type PlannerTab = 'day' | 'week' | 'month' | 'year' | 'routines' | 'goals';

const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);

export function PlannerPage() {
  const todayISO = getTodayISO();
  const [activeTab, setActiveTab] = useState<PlannerTab>('day');
  const [selectedDate, setSelectedDate] = useState(todayISO);

  // Task modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDate, setTaskDate] = useState(todayISO);
  const [taskStart, setTaskStart] = useState('');
  const [taskEnd, setTaskEnd] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskCategory, setTaskCategory] = useState<PlannerTask['category']>('Study');
  const [taskRecurrence, setTaskRecurrence] = useState<TaskRecurrence>('none');
  const [taskReminder, setTaskReminder] = useState('');

  // Routine modal state
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [routineTitle, setRoutineTitle] = useState('');
  const [routinePeriod, setRoutinePeriod] = useState<RoutineItem['timeOfDay']>('morning');
  const [routineTime, setRoutineTime] = useState('07:00');

  // Life Goal modal state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalAge, setGoalAge] = useState('22');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<LifeGoal['category']>('Career');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalMilestonesText, setGoalMilestonesText] = useState('');

  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const routines = useLiveQuery(() => db.routines.toArray(), []) ?? [];
  const lifeGoals = useLiveQuery(() => db.lifeGoals.toArray(), []) ?? [];
  const assessments = useLiveQuery(() => db.assessments.toArray(), []) ?? [];

  const openNewTask = (date = selectedDate, startTime = '') => {
    setTaskDate(date);
    setTaskStart(startTime);
    setTaskEnd('');
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('medium');
    setTaskRecurrence('none');
    setTaskReminder('');
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    const now = new Date().toISOString();
    const record: PlannerTask = {
      id: generateId('task'),
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      date: taskDate,
      startTime: taskStart || undefined,
      endTime: taskEnd || undefined,
      priority: taskPriority,
      category: taskCategory,
      completed: false,
      recurrence: taskRecurrence,
      reminderTime: taskReminder || undefined,
      isTimeBlock: Boolean(taskStart),
      updatedAt: now,
    };
    await db.tasks.put(record);
    await enqueueSync('tasks', record.id, 'upsert', record);
    setTaskModalOpen(false);
  };

  const toggleTask = async (task: PlannerTask) => {
    const nextDone = !task.completed;
    const now = new Date().toISOString();
    const updated: PlannerTask = {
      ...task,
      completed: nextDone,
      completedAt: nextDone ? now : undefined,
      updatedAt: now,
    };
    await db.tasks.put(updated);
    await enqueueSync('tasks', updated.id, 'upsert', updated);

    // If recurring task is marked completed, schedule next occurrence cleanly
    if (nextDone && task.recurrence !== 'none') {
      const nextDate =
        task.recurrence === 'daily'
          ? addDaysISO(task.date, 1)
          : task.recurrence === 'weekly'
          ? addDaysISO(task.date, 7)
          : addDaysISO(task.date, 30);

      const exists = tasks.some(
        (t) => t.title === task.title && t.date === nextDate && t.recurrence === task.recurrence
      );
      if (!exists) {
        const nextTask: PlannerTask = {
          ...task,
          id: generateId('task'),
          date: nextDate,
          completed: false,
          completedAt: undefined,
          updatedAt: now,
        };
        await db.tasks.put(nextTask);
        await enqueueSync('tasks', nextTask.id, 'upsert', nextTask);
      }
    }
  };

  const deleteTask = async (id: string) => {
    await db.tasks.delete(id);
    await enqueueSync('tasks', id, 'delete');
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineTitle.trim()) return;
    const now = new Date().toISOString();
    const item: RoutineItem = {
      id: generateId('routine'),
      title: routineTitle.trim(),
      timeOfDay: routinePeriod,
      scheduledTime: routineTime,
      completedDates: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.routines.put(item);
    await enqueueSync('routines', item.id, 'upsert', item);
    setRoutineTitle('');
    setRoutineModalOpen(false);
  };

  const toggleRoutineToday = async (r: RoutineItem) => {
    const hasToday = r.completedDates.includes(todayISO);
    const nextDates = hasToday
      ? r.completedDates.filter((d) => d !== todayISO)
      : [...r.completedDates, todayISO];
    const updated: RoutineItem = {
      ...r,
      completedDates: nextDates,
      updatedAt: new Date().toISOString(),
    };
    await db.routines.put(updated);
    await enqueueSync('routines', updated.id, 'upsert', updated);
  };

  const deleteRoutine = async (id: string) => {
    await db.routines.delete(id);
    await enqueueSync('routines', id, 'delete');
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    const now = new Date().toISOString();
    const milestones = goalMilestonesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title) => ({ id: generateId('ms'), title, done: false }));

    const item: LifeGoal = {
      id: generateId('goal'),
      targetAge: Math.max(15, parseInt(goalAge, 10) || 22),
      title: goalTitle.trim(),
      category: goalCategory,
      description: goalDesc.trim(),
      milestones,
      status: 'planned',
      createdAt: now,
      updatedAt: now,
    };
    await db.lifeGoals.put(item);
    await enqueueSync('lifeGoals', item.id, 'upsert', item);
    setGoalTitle('');
    setGoalDesc('');
    setGoalMilestonesText('');
    setGoalModalOpen(false);
  };

  const toggleGoalMilestone = async (goal: LifeGoal, msId: string) => {
    const nextMs = goal.milestones.map((m) => (m.id === msId ? { ...m, done: !m.done } : m));
    const allDone = nextMs.length > 0 && nextMs.every((m) => m.done);
    const anyDone = nextMs.some((m) => m.done);
    const updated: LifeGoal = {
      ...goal,
      milestones: nextMs,
      status: allDone ? 'achieved' : anyDone ? 'in_progress' : 'planned',
      updatedAt: new Date().toISOString(),
    };
    await db.lifeGoals.put(updated);
    await enqueueSync('lifeGoals', updated.id, 'upsert', updated);
  };

  const deleteGoal = async (id: string) => {
    await db.lifeGoals.delete(id);
    await enqueueSync('lifeGoals', id, 'delete');
  };

  // Derived calendar views
  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.date === selectedDate)
        .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99')),
    [tasks, selectedDate]
  );

  const weekDates = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dow = dt.getUTCDay(); // 0=Sun
    const startOffset = -dow;
    return Array.from({ length: 7 }, (_, i) => addDaysISO(selectedDate, startOffset + i));
  }, [selectedDate]);

  const monthMeta = useMemo(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    const firstDay = new Date(Date.UTC(y, m - 1, 1));
    const startWeekday = firstDay.getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return {
      year: y,
      month: m,
      label: firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      cells,
    };
  }, [selectedDate]);

  const goalsByAge = useMemo(() => {
    const map = new Map<number, LifeGoal[]>();
    [...lifeGoals]
      .sort((a, b) => a.targetAge - b.targetAge)
      .forEach((g) => {
        const list = map.get(g.targetAge) ?? [];
        list.push(g);
        map.set(g.targetAge, list);
      });
    return Array.from(map.entries());
  }, [lifeGoals]);

  const priorityColors: Record<TaskPriority, string> = {
    urgent: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
    high: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    medium: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10',
    low: 'text-slate-500 dark:text-slate-400 bg-slate-500/10',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planner & Life Roadmap"
        subtitle="Daily time blocking, calendars, recurring tasks, routines, and age-based life goals"
        actions={
          <>
            <button
              type="button"
              onClick={() => setRoutineModalOpen(true)}
              className="os-btn-secondary text-xs py-2 px-3"
            >
              <Repeat className="w-3.5 h-3.5" />
              New Routine
            </button>
            <button
              type="button"
              onClick={() => setGoalModalOpen(true)}
              className="os-btn-secondary text-xs py-2 px-3"
            >
              <Target className="w-3.5 h-3.5" />
              New Life Goal
            </button>
            <button
              type="button"
              onClick={() => openNewTask(selectedDate)}
              className="os-btn-primary text-xs py-2 px-3.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Task
            </button>
          </>
        }
      />

      {/* Tabs + Date Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-white/55 dark:bg-white/[0.07] border border-white/75 dark:border-white/[0.12] backdrop-blur-xl p-1 rounded-full shadow-xs">
          {(
            [
              { id: 'day', label: 'Day' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'year', label: 'Year' },
              { id: 'routines', label: `Routines (${routines.length})` },
              { id: 'goals', label: `Goals by Age (${lifeGoals.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-[0_4px_14px_-3px_rgba(6,182,212,0.55)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(activeTab === 'day' || activeTab === 'week' || activeTab === 'month' || activeTab === 'year') && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  addDaysISO(
                    selectedDate,
                    activeTab === 'day' ? -1 : activeTab === 'week' ? -7 : activeTab === 'month' ? -30 : -365
                  )
                )
              }
              className="p-2 rounded-xl os-card hover:bg-white/75 dark:hover:bg-white/[0.1] cursor-pointer"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="os-input py-1.5 px-3 text-xs font-mono !w-auto"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(todayISO)}
              className="os-btn-secondary py-1.5 px-3 text-xs"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  addDaysISO(
                    selectedDate,
                    activeTab === 'day' ? 1 : activeTab === 'week' ? 7 : activeTab === 'month' ? 30 : 365
                  )
                )
              }
              className="p-2 rounded-xl os-card hover:bg-white/75 dark:hover:bg-white/[0.1] cursor-pointer"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* DAY VIEW WITH TIME BLOCKING */}
      {activeTab === 'day' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Task List */}
          <div className="lg:col-span-6 os-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">{formatShortDate(selectedDate)}</h2>
                <p className="text-xs text-slate-500">
                  {dayTasks.filter((t) => t.completed).length} of {dayTasks.length} completed
                </p>
              </div>
              <button
                type="button"
                onClick={() => openNewTask(selectedDate)}
                className="os-btn-secondary py-1.5 px-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Task
              </button>
            </div>

            {dayTasks.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarIcon className="w-5 h-5" />}
                title="No tasks scheduled for this day"
                description="Create tasks with priorities, time blocks, reminders, or recurring schedules."
              />
            ) : (
              <div className="space-y-2.5">
                {dayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      className="flex items-start gap-3 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4.5 h-4.5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            task.completed ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-white/[0.06]">
                            {task.category}
                          </span>
                          {task.startTime && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {task.startTime}
                              {task.endTime ? `–${task.endTime}` : ''}
                            </span>
                          )}
                          {task.recurrence !== 'none' && (
                            <span className="inline-flex items-center gap-1 text-cyan-500">
                              <Repeat className="w-3 h-3" />
                              {task.recurrence}
                            </span>
                          )}
                          {task.reminderTime && (
                            <span className="inline-flex items-center gap-1 text-amber-500 font-mono">
                              <Bell className="w-3 h-3" />
                              {task.reminderTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Time Blocking Schedule */}
          <div className="lg:col-span-6 os-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Time Blocking Timeline</h2>
                <p className="text-xs text-slate-500">Click any hour slot to schedule a time block</p>
              </div>
              <span className="text-xs font-mono text-slate-400">06:00 – 23:00</span>
            </div>

            <div className="space-y-1 max-h-[540px] overflow-y-auto pr-1">
              {TIME_SLOTS.map((slot) => {
                const hourPrefix = slot.slice(0, 2);
                const slotTasks = dayTasks.filter(
                  (t) => t.startTime && t.startTime.slice(0, 2) === hourPrefix
                );
                return (
                  <div
                    key={slot}
                    className="flex items-stretch gap-3 min-h-[40px] border-t border-white/50 dark:border-white/[0.08] py-1"
                  >
                    <button
                      type="button"
                      onClick={() => openNewTask(selectedDate, slot)}
                      className="w-14 shrink-0 text-left font-mono text-[11px] text-slate-400 hover:text-cyan-500 pt-1 cursor-pointer"
                      title={`Add time block at ${slot}`}
                    >
                      {slot}
                    </button>
                    <div className="flex-1 space-y-1">
                      {slotTasks.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => openNewTask(selectedDate, slot)}
                          className="w-full h-full min-h-[30px] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] text-left px-2 text-[11px] text-transparent hover:text-slate-400 transition-colors cursor-pointer"
                        >
                          + Block {slot}
                        </button>
                      ) : (
                        slotTasks.map((t) => (
                          <div
                            key={t.id}
                            className={`px-3 py-1.5 rounded-xl text-xs border flex items-center justify-between ${
                              t.completed
                                ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-cyan-50/80 dark:bg-cyan-500/15 border-cyan-200/70 dark:border-cyan-500/30 text-cyan-900 dark:text-cyan-200'
                            }`}
                          >
                            <span className="font-medium truncate">{t.title}</span>
                            <span className="font-mono text-[10px] shrink-0 ml-2">
                              {t.startTime}
                              {t.endTime ? `–${t.endTime}` : ''}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {activeTab === 'week' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekDates.map((iso) => {
            const [y, m, d] = iso.split('-').map(Number);
            const dt = new Date(Date.UTC(y, m - 1, d));
            const dayName = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
            const items = tasks.filter((t) => t.date === iso);
            const isToday = iso === todayISO;
            return (
              <div
                key={iso}
                className={`os-card p-3.5 flex flex-col min-h-[240px] ${
                  isToday ? 'ring-2 ring-cyan-500/40 border-cyan-500/50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/50 dark:border-white/[0.08]">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">{dayName}</div>
                    <div className="text-base font-semibold font-mono">{d}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openNewTask(iso)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-cyan-500 cursor-pointer"
                    title="Add task"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5 flex-1">
                  {items.length === 0 ? (
                    <div className="text-[11px] text-slate-400 text-center py-6">No tasks</div>
                  ) : (
                    items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTask(t)}
                        className={`w-full text-left p-2 rounded-lg text-xs border transition-colors cursor-pointer ${
                          t.completed
                            ? 'bg-slate-50 dark:bg-white/[0.02] border-transparent text-slate-400 line-through'
                            : 'bg-slate-50 dark:bg-white/[0.04] border-white/65 dark:border-white/[0.1]'
                        }`}
                      >
                        <div className="font-medium truncate">{t.title}</div>
                        {t.startTime && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {t.startTime}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MONTH VIEW */}
      {activeTab === 'month' && (
        <div className="os-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">{monthMeta.label}</h2>
            <span className="text-xs text-slate-500">Click any date to inspect or plan</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-400 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthMeta.cells.map((iso, idx) => {
              if (!iso) return <div key={`empty_${idx}`} className="min-h-[76px]" />;
              const dayItems = tasks.filter((t) => t.date === iso);
              const dayExams = assessments.filter((a) => a.dueDate === iso);
              const isToday = iso === todayISO;
              const isSelected = iso === selectedDate;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(iso);
                    setActiveTab('day');
                  }}
                  className={`min-h-[78px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-500/10'
                      : isToday
                      ? 'border-slate-900 dark:border-cyan-400/50 bg-slate-50 dark:bg-white/[0.04]'
                      : 'border-white/65 dark:border-white/[0.1] hover:border-slate-300 dark:hover:border-white/[0.14]'
                  }`}
                >
                  <span
                    className={`text-xs font-mono font-semibold ${
                      isToday ? 'text-cyan-600 dark:text-cyan-400' : ''
                    }`}
                  >
                    {Number(iso.slice(-2))}
                  </span>
                  <div className="space-y-1">
                    {dayItems.length > 0 && (
                      <div className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 truncate">
                        {dayItems.length} task{dayItems.length > 1 ? 's' : ''}
                      </div>
                    )}
                    {dayExams.length > 0 && (
                      <div className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300 truncate">
                        {dayExams.length} due
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* YEAR VIEW */}
      {activeTab === 'year' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {Array.from({ length: 12 }, (_, idx) => {
            const yr = Number(selectedDate.slice(0, 4));
            const ym = `${yr}-${String(idx + 1).padStart(2, '0')}`;
            const mName = new Date(Date.UTC(yr, idx, 1)).toLocaleDateString('en-US', {
              month: 'long',
              timeZone: 'UTC',
            });
            const mTasks = tasks.filter((t) => t.date.startsWith(ym));
            const mDone = mTasks.filter((t) => t.completed).length;
            const mExams = assessments.filter((a) => a.dueDate.startsWith(ym));
            return (
              <button
                key={ym}
                type="button"
                onClick={() => {
                  setSelectedDate(`${ym}-01`);
                  setActiveTab('month');
                }}
                className="os-card p-4 text-left hover:border-cyan-400/60 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">{mName}</span>
                  <span className="font-mono text-xs text-slate-400">{yr}</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Tasks</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {mDone}/{mTasks.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exams / Deadlines</span>
                    <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                      {mExams.length}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ROUTINES VIEW */}
      {activeTab === 'routines' && (
        <div className="os-card p-5">
          {routines.length === 0 ? (
            <EmptyState
              icon={<Repeat className="w-5 h-5" />}
              title="No daily routines configured yet"
              description="Build repeatable morning, study, workout, or evening routines and track real daily streaks."
              action={
                <button
                  type="button"
                  onClick={() => setRoutineModalOpen(true)}
                  className="os-btn-primary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Routine
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {routines.map((r) => {
                const doneToday = r.completedDates.includes(todayISO);
                const { currentStreak, bestStreak } = computeStreaks(r.completedDates);
                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => toggleRoutineToday(r)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      {doneToday ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{r.title}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 capitalize">
                          <span>{r.timeOfDay}</span>
                          <span>•</span>
                          <span className="font-mono">{r.scheduledTime}</span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                          <Flame className="w-3.5 h-3.5" />
                          {currentStreak}d
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">best {bestStreak}d</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteRoutine(r.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
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

      {/* AGE-BASED LIFE GOALS */}
      {activeTab === 'goals' && (
        <div className="space-y-5">
          {goalsByAge.length === 0 ? (
            <div className="os-card p-5">
              <EmptyState
                icon={<Sparkles className="w-5 h-5" />}
                title="Design your long-term life roadmap by age"
                description="Map out milestones by target age — graduation, first cybersecurity certification, financial independence, career roles, and personal ambitions."
                action={
                  <button
                    type="button"
                    onClick={() => setGoalModalOpen(true)}
                    className="os-btn-primary text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add First Age-Based Goal
                  </button>
                }
              />
            </div>
          ) : (
            goalsByAge.map(([age, goals]) => (
              <div key={age} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-sm font-mono text-xs font-semibold">
                    Age {age}
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/[0.08]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {goals.map((g) => {
                    const doneMs = g.milestones.filter((m) => m.done).length;
                    const pct =
                      g.milestones.length > 0
                        ? Math.round((doneMs / g.milestones.length) * 100)
                        : g.status === 'achieved'
                        ? 100
                        : 0;

                    return (
                      <div key={g.id} className="os-card p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                              {g.category}
                            </span>
                            <h3 className="text-base font-semibold mt-1.5">{g.title}</h3>
                            {g.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {g.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteGoal(g.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>Progress</span>
                            <span className="font-mono">{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-900/[0.07] dark:bg-white/[0.09] overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {g.milestones.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {g.milestones.map((ms) => (
                              <button
                                key={ms.id}
                                type="button"
                                onClick={() => toggleGoalMilestone(g, ms.id)}
                                className="w-full flex items-center gap-2 text-left text-xs py-1 cursor-pointer"
                              >
                                {ms.done ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                                )}
                                <span className={ms.done ? 'line-through text-slate-400' : ''}>
                                  {ms.title}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* NEW TASK MODAL */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Schedule Task or Time Block"
      >
        <form onSubmit={handleSaveTask} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Task Title</label>
            <input
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Complete Computational Thinking Lab 2"
              className="os-input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea
              rows={2}
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="Optional details or checklist notes..."
              className="os-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                required
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                className="os-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value as PlannerTask['category'])}
                className="os-input"
              >
                <option value="Study">Study</option>
                <option value="Cyber Lab">Cyber Lab</option>
                <option value="Personal">Personal</option>
                <option value="Finance">Finance</option>
                <option value="Health">Health</option>
                <option value="Career">Career</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Start Time (opt.)</label>
              <input
                type="time"
                value={taskStart}
                onChange={(e) => setTaskStart(e.target.value)}
                className="os-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">End Time (opt.)</label>
              <input
                type="time"
                value={taskEnd}
                onChange={(e) => setTaskEnd(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                className="os-input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Recurrence</label>
              <select
                value={taskRecurrence}
                onChange={(e) => setTaskRecurrence(e.target.value as TaskRecurrence)}
                className="os-input"
              >
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reminder</label>
              <input
                type="time"
                value={taskReminder}
                onChange={(e) => setTaskReminder(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTaskModalOpen(false)}
              className="os-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Task
            </button>
          </div>
        </form>
      </Modal>

      {/* NEW ROUTINE MODAL */}
      <Modal
        open={routineModalOpen}
        onClose={() => setRoutineModalOpen(false)}
        title="Create Daily Routine"
      >
        <form onSubmit={handleSaveRoutine} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Routine Name</label>
            <input
              required
              value={routineTitle}
              onChange={(e) => setRoutineTitle(e.target.value)}
              placeholder="e.g. 45 min Python & Linux Practice"
              className="os-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Time of Day</label>
              <select
                value={routinePeriod}
                onChange={(e) => setRoutinePeriod(e.target.value as RoutineItem['timeOfDay'])}
                className="os-input"
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target Time</label>
              <input
                type="time"
                value={routineTime}
                onChange={(e) => setRoutineTime(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRoutineModalOpen(false)}
              className="os-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Routine
            </button>
          </div>
        </form>
      </Modal>

      {/* NEW LIFE GOAL MODAL */}
      <Modal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title="Add Age-Based Life Goal"
      >
        <form onSubmit={handleSaveGoal} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target Age</label>
              <input
                type="number"
                min={16}
                max={90}
                required
                value={goalAge}
                onChange={(e) => setGoalAge(e.target.value)}
                className="os-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={goalCategory}
                onChange={(e) => setGoalCategory(e.target.value as LifeGoal['category'])}
                className="os-input"
              >
                <option value="Career">Career</option>
                <option value="Education">Education</option>
                <option value="Finance">Finance</option>
                <option value="Health">Health</option>
                <option value="Personal">Personal</option>
                <option value="Travel">Travel</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Goal Title</label>
            <input
              required
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. Graduate First-Class Honours & Earn Security+"
              className="os-input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea
              rows={2}
              value={goalDesc}
              onChange={(e) => setGoalDesc(e.target.value)}
              placeholder="Why this matters..."
              className="os-input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Milestones (one per line)
            </label>
            <textarea
              rows={3}
              value={goalMilestonesText}
              onChange={(e) => setGoalMilestonesText(e.target.value)}
              placeholder={'Complete Year 1–4 with 70%+ average\nBuild 5 GitHub security projects\nPass CompTIA Security+'}
              className="os-input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setGoalModalOpen(false)}
              className="os-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Life Goal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
