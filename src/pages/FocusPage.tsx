import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle2,
  Clock,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Save,
  Timer,
  Trash2,
} from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { db, enqueueSync } from '../db/database';
import { formatDuration, formatShortDate, formatStopwatch } from '../lib/dateUtils';
import { EmptyState, PageHeader } from '../components/ui/Modal';

export function FocusPage() {
  const timer = useTimer();
  const modules = useLiveQuery(() => db.modules.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.focusSessions.toArray(), []) ?? [];

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    [sessions]
  );

  const moduleMap = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  const formatCountdown = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPct =
    timer.mode === 'stopwatch'
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((timer.totalCountdownSeconds - timer.remainingSeconds) /
              Math.max(1, timer.totalCountdownSeconds)) *
              100
          )
        );

  const deleteSession = async (id: string) => {
    await db.focusSessions.delete(id);
    await enqueueSync('focusSessions', id, 'delete');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Focus Timer & Stopwatch"
        subtitle="Pomodoro deep work, custom study timers, precision stopwatch with laps, and automatic study-hour logging"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Timer Console */}
        <div className="lg:col-span-7 os-card p-6 flex flex-col items-center">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-white/55 dark:bg-white/[0.07] border border-white/75 dark:border-white/[0.12] backdrop-blur-xl p-1 rounded-full shadow-xs mb-6">
            {(
              [
                { id: 'pomodoro', label: 'Pomodoro' },
                { id: 'custom', label: 'Custom Focus' },
                { id: 'stopwatch', label: 'Stopwatch' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={timer.isRunning}
                onClick={() => timer.setMode(m.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer disabled:opacity-50 ${
                  timer.mode === m.id
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-[0_4px_14px_-3px_rgba(6,182,212,0.55)]'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Pomodoro Phase Pills */}
          {timer.mode === 'pomodoro' && (
            <div className="flex items-center gap-2 mb-6">
              {(
                [
                  { id: 'focus', label: `Focus (${timer.pomodoroFocusMins}m)` },
                  { id: 'short_break', label: `Short Break (${timer.pomodoroShortMins}m)` },
                  { id: 'long_break', label: `Long Break (${timer.pomodoroLongMins}m)` },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={timer.isRunning}
                  onClick={() => timer.setPomodoroPhase(p.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                    timer.pomodoroPhase === p.id
                      ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-300'
                      : 'border-white/70 dark:border-white/[0.12] text-slate-500'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Custom Focus Duration Input */}
          {timer.mode === 'custom' && !timer.isRunning && (
            <div className="flex items-center gap-2.5 mb-6">
              <span className="text-xs text-slate-500">Duration (minutes):</span>
              <input
                type="number"
                min={1}
                max={300}
                value={timer.customMinutes}
                onChange={(e) => timer.setCustomMinutes(Math.max(1, Number(e.target.value) || 1))}
                className="os-input py-1.5 px-3 text-xs font-mono w-24 text-center"
              />
            </div>
          )}

          {/* Luminous Liquid Glass Radial Chronometer */}
          <div className="relative w-68 h-68 sm:w-76 sm:h-76 flex items-center justify-center my-3">
            <div className="absolute inset-4 rounded-full liquid-dock pointer-events-none" />
            <svg className="relative z-10 w-full h-full -rotate-90 drop-shadow-[0_0_16px_rgba(6,182,212,0.32)]" viewBox="0 0 220 220">
              <defs>
                <linearGradient id="focusRingCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id="focusRingMint" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <circle
                cx="110"
                cy="110"
                r="96"
                stroke="currentColor"
                className="text-white/55 dark:text-white/[0.08]"
                strokeWidth="9"
                fill="none"
              />
              <circle
                cx="110"
                cy="110"
                r="96"
                stroke={
                  timer.mode === 'pomodoro' && timer.pomodoroPhase !== 'focus'
                    ? 'url(#focusRingMint)'
                    : 'url(#focusRingCyan)'
                }
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={2 * Math.PI * 96}
                strokeDashoffset={2 * Math.PI * 96 * (1 - progressPct / 100)}
                style={{ transition: 'stroke-dashoffset 0.35s ease' }}
              />
            </svg>
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center">
              <div className="font-mono text-4xl sm:text-[46px] font-light tabular-nums tracking-[-0.03em] text-slate-900 dark:text-white">
                {timer.mode === 'stopwatch'
                  ? formatStopwatch(timer.elapsedMs)
                  : formatCountdown(timer.remainingSeconds)}
              </div>
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/60 dark:bg-white/10 border border-white/75 dark:border-white/15 text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-600 dark:text-cyan-200">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    timer.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-cyan-500'
                  }`}
                />
                {timer.isRunning ? 'In Focus' : 'Ready'}
              </div>
            </div>
          </div>

          {/* Primary Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
            {timer.isRunning ? (
              <button type="button" onClick={timer.pause} className="os-btn-primary px-6 py-3">
                <Pause className="w-4 h-4" />
                Pause
              </button>
            ) : (
              <button type="button" onClick={timer.start} className="os-btn-primary px-6 py-3">
                <Play className="w-4 h-4" />
                Start
              </button>
            )}

            {timer.mode === 'stopwatch' && (
              <button
                type="button"
                disabled={!timer.isRunning && timer.elapsedMs === 0}
                onClick={timer.recordLap}
                className="os-btn-secondary px-4 py-3"
              >
                <Flag className="w-4 h-4" />
                Lap
              </button>
            )}

            <button
              type="button"
              onClick={() => void timer.finishAndSaveSession()}
              className="os-btn-secondary px-4 py-3"
              title="Finish and log session to history"
            >
              <Save className="w-4 h-4" />
              Save Log
            </button>

            <button
              type="button"
              onClick={timer.reset}
              className="os-btn-ghost px-3.5 py-3"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Session Metadata Inputs */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-7 pt-5 border-t border-white/50 dark:border-white/[0.08]">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Session Label</label>
              <input
                value={timer.label}
                onChange={(e) => timer.setLabel(e.target.value)}
                placeholder="e.g. Revision, Python Lab, TryHackMe..."
                className="os-input text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Link to Study Module (auto-logs hours)
              </label>
              <select
                value={timer.moduleId}
                onChange={(e) => timer.setModuleId(e.target.value)}
                className="os-input text-xs py-2"
              >
                <option value="">General Focus (No Module)</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    Y{m.year} • {m.code} — {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pomodoro Intervals Config */}
          {timer.mode === 'pomodoro' && !timer.isRunning && (
            <div className="w-full grid grid-cols-3 gap-2.5 mt-4">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Focus (min)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={timer.pomodoroFocusMins}
                  onChange={(e) => timer.setPomodoroFocusMins(Math.max(1, Number(e.target.value) || 25))}
                  className="os-input py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Short Break</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={timer.pomodoroShortMins}
                  onChange={(e) => timer.setPomodoroShortMins(Math.max(1, Number(e.target.value) || 5))}
                  className="os-input py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Long Break</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={timer.pomodoroLongMins}
                  onChange={(e) => timer.setPomodoroLongMins(Math.max(1, Number(e.target.value) || 15))}
                  className="os-input py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Stopwatch Laps + Session History */}
        <div className="lg:col-span-5 space-y-5">
          {timer.mode === 'stopwatch' && (
            <div className="os-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Stopwatch Laps</h2>
                <span className="text-xs font-mono text-slate-400">{timer.laps.length} laps</span>
              </div>
              {timer.laps.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Start the stopwatch and press <strong>Lap</strong> to record split intervals.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {timer.laps.map((lap) => (
                    <div
                      key={lap.lapNumber}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/55 dark:bg-white/[0.05] text-xs font-mono"
                    >
                      <span className="text-slate-500">Lap {lap.lapNumber}</span>
                      <span className="text-cyan-600 dark:text-cyan-400">
                        +{formatStopwatch(lap.splitMs)}
                      </span>
                      <span className="font-semibold">{formatStopwatch(lap.elapsedMs)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="os-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Session History</h2>
                <p className="text-xs text-slate-500">
                  {sessions.length} saved session{sessions.length === 1 ? '' : 's'}
                </p>
              </div>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>

            {sortedSessions.length === 0 ? (
              <EmptyState
                compact
                icon={<Timer className="w-5 h-5" />}
                title="No focus sessions logged yet"
                description="Complete a Pomodoro, custom focus block, or save a stopwatch run to populate your study analytics."
              />
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {sortedSessions.map((s) => {
                  const mod = s.moduleId ? moduleMap.get(s.moduleId) : null;
                  return (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/70 dark:border-white/[0.1] backdrop-blur-md flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-xs font-semibold truncate">{s.label}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="capitalize">{s.mode}</span>
                          {mod && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-cyan-500">{mod.code}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatShortDate(s.date)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                          {formatDuration(s.durationSeconds)}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteSession(s.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
