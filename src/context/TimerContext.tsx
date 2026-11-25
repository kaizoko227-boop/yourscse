import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { db, enqueueSync } from '../db/database';
import { generateId } from '../lib/crypto';
import { getTodayISO } from '../lib/dateUtils';
import type { FocusLap, FocusSession } from '../types/models';

export type TimerMode = 'pomodoro' | 'custom' | 'stopwatch';
export type PomodoroPhase = 'focus' | 'short_break' | 'long_break';

interface TimerContextValue {
  mode: TimerMode;
  setMode: (mode: TimerMode) => void;
  isRunning: boolean;
  label: string;
  setLabel: (label: string) => void;
  moduleId: string;
  setModuleId: (id: string) => void;

  // Pomodoro & Custom countdown state
  pomodoroPhase: PomodoroPhase;
  setPomodoroPhase: (phase: PomodoroPhase) => void;
  pomodoroFocusMins: number;
  setPomodoroFocusMins: (m: number) => void;
  pomodoroShortMins: number;
  setPomodoroShortMins: (m: number) => void;
  pomodoroLongMins: number;
  setPomodoroLongMins: (m: number) => void;
  customMinutes: number;
  setCustomMinutes: (m: number) => void;
  remainingSeconds: number;
  totalCountdownSeconds: number;

  // Stopwatch state
  elapsedMs: number;
  laps: FocusLap[];

  // Controls
  start: () => void;
  pause: () => void;
  reset: () => void;
  recordLap: () => void;
  finishAndSaveSession: () => Promise<FocusSession | null>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function playCompletionTone() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch {
    // ignore audio restrictions
  }
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<TimerMode>('pomodoro');
  const [isRunning, setIsRunning] = useState(false);
  const [label, setLabel] = useState('');
  const [moduleId, setModuleId] = useState('');

  const [pomodoroPhase, setPomodoroPhaseState] = useState<PomodoroPhase>('focus');
  const [pomodoroFocusMins, setPomodoroFocusMins] = useState(25);
  const [pomodoroShortMins, setPomodoroShortMins] = useState(5);
  const [pomodoroLongMins, setPomodoroLongMins] = useState(15);
  const [customMinutes, setCustomMinutes] = useState(45);

  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [laps, setLaps] = useState<FocusLap[]>([]);

  const startedAtRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const activeRunSecondsRef = useRef<number>(0);

  const getPhaseDurationSeconds = (
    m: TimerMode,
    phase: PomodoroPhase,
    pFocus: number,
    pShort: number,
    pLong: number,
    cMins: number
  ) => {
    if (m === 'custom') return Math.max(1, cMins) * 60;
    if (phase === 'short_break') return Math.max(1, pShort) * 60;
    if (phase === 'long_break') return Math.max(1, pLong) * 60;
    return Math.max(1, pFocus) * 60;
  };

  const totalCountdownSeconds = getPhaseDurationSeconds(
    mode,
    pomodoroPhase,
    pomodoroFocusMins,
    pomodoroShortMins,
    pomodoroLongMins,
    customMinutes
  );

  // Sync countdown when config changes while paused & fresh
  useEffect(() => {
    if (!isRunning && mode !== 'stopwatch') {
      setRemainingSeconds(totalCountdownSeconds);
      activeRunSecondsRef.current = 0;
    }
  }, [totalCountdownSeconds, mode, isRunning]);

  const persistSession = async (durationSeconds: number, sessionLaps?: FocusLap[]): Promise<FocusSession | null> => {
    if (durationSeconds < 5) return null;
    const completedAt = new Date().toISOString();
    const session: FocusSession = {
      id: generateId('focus'),
      mode,
      label:
        label.trim() ||
        (mode === 'pomodoro'
          ? pomodoroPhase === 'focus'
            ? 'Pomodoro Focus'
            : 'Pomodoro Break'
          : mode === 'custom'
          ? 'Custom Focus Session'
          : 'Stopwatch Session'),
      moduleId: moduleId || undefined,
      durationSeconds,
      laps: sessionLaps && sessionLaps.length > 0 ? sessionLaps : undefined,
      date: getTodayISO(),
      startedAt: startedAtRef.current || completedAt,
      completedAt,
    };

    await db.focusSessions.put(session);
    await enqueueSync('focusSessions', session.id, 'upsert', session);

    // If linked to an academic module and not a break, increment module studyMinutes
    if (moduleId && !(mode === 'pomodoro' && pomodoroPhase !== 'focus')) {
      const mod = await db.modules.get(moduleId);
      if (mod) {
        const addedMins = Math.max(1, Math.round(durationSeconds / 60));
        const updated = {
          ...mod,
          studyMinutes: (mod.studyMinutes || 0) + addedMins,
          status: mod.status === 'not_started' ? ('in_progress' as const) : mod.status,
          updatedAt: completedAt,
        };
        await db.modules.put(updated);
        await enqueueSync('modules', updated.id, 'upsert', updated);
      }
    }

    return session;
  };

  useEffect(() => {
    if (!isRunning) return;
    lastTickRef.current = Date.now();

    if (mode === 'stopwatch') {
      const interval = window.setInterval(() => {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;
        setElapsedMs((prev) => prev + delta);
      }, 37);
      return () => window.clearInterval(interval);
    }

    const interval = window.setInterval(() => {
      activeRunSecondsRef.current += 1;
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setIsRunning(false);
          playCompletionTone();
          const logged = activeRunSecondsRef.current;
          activeRunSecondsRef.current = 0;
          void persistSession(logged);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, mode, pomodoroPhase, moduleId, label]);

  const setMode = (nextMode: TimerMode) => {
    if (isRunning) return;
    setModeState(nextMode);
    if (nextMode === 'stopwatch') {
      setElapsedMs(0);
      setLaps([]);
    } else {
      setRemainingSeconds(
        getPhaseDurationSeconds(
          nextMode,
          pomodoroPhase,
          pomodoroFocusMins,
          pomodoroShortMins,
          pomodoroLongMins,
          customMinutes
        )
      );
    }
    activeRunSecondsRef.current = 0;
  };

  const setPomodoroPhase = (phase: PomodoroPhase) => {
    if (isRunning) return;
    setPomodoroPhaseState(phase);
    setRemainingSeconds(
      getPhaseDurationSeconds(mode, phase, pomodoroFocusMins, pomodoroShortMins, pomodoroLongMins, customMinutes)
    );
    activeRunSecondsRef.current = 0;
  };

  const start = () => {
    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
    }
    if (mode !== 'stopwatch' && remainingSeconds === 0) {
      setRemainingSeconds(totalCountdownSeconds);
    }
    setIsRunning(true);
  };

  const pause = () => {
    setIsRunning(false);
  };

  const reset = () => {
    setIsRunning(false);
    startedAtRef.current = null;
    activeRunSecondsRef.current = 0;
    if (mode === 'stopwatch') {
      setElapsedMs(0);
      setLaps([]);
    } else {
      setRemainingSeconds(totalCountdownSeconds);
    }
  };

  const recordLap = () => {
    if (mode !== 'stopwatch' || elapsedMs <= 0) return;
    setLaps((prev) => {
      const prevElapsed = prev.length > 0 ? prev[0].elapsedMs : 0;
      const newLap: FocusLap = {
        lapNumber: prev.length + 1,
        elapsedMs,
        splitMs: elapsedMs - prevElapsed,
      };
      return [newLap, ...prev];
    });
  };

  const finishAndSaveSession = async (): Promise<FocusSession | null> => {
    setIsRunning(false);
    const seconds =
      mode === 'stopwatch' ? Math.floor(elapsedMs / 1000) : activeRunSecondsRef.current;
    const saved = await persistSession(seconds, mode === 'stopwatch' ? laps : undefined);
    startedAtRef.current = null;
    activeRunSecondsRef.current = 0;
    if (mode === 'stopwatch') {
      setElapsedMs(0);
      setLaps([]);
    } else {
      setRemainingSeconds(totalCountdownSeconds);
    }
    return saved;
  };

  return (
    <TimerContext.Provider
      value={{
        mode,
        setMode,
        isRunning,
        label,
        setLabel,
        moduleId,
        setModuleId,
        pomodoroPhase,
        setPomodoroPhase,
        pomodoroFocusMins,
        setPomodoroFocusMins,
        pomodoroShortMins,
        setPomodoroShortMins,
        pomodoroLongMins,
        setPomodoroLongMins,
        customMinutes,
        setCustomMinutes,
        remainingSeconds,
        totalCountdownSeconds,
        elapsedMs,
        laps,
        start,
        pause,
        reset,
        recordLap,
        finishAndSaveSession,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
