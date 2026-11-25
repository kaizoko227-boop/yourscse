import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, enqueueSync, initializeDatabase } from './db/database';
import { runCloudSync, type SyncReport, type SyncState } from './lib/syncEngine';
import type { NavSection, ThemeMode } from './types/models';
import { TimerProvider } from './context/TimerContext';
import { LockScreen } from './components/LockScreen';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { StudyPage } from './pages/StudyPage';
import { PlannerPage } from './pages/PlannerPage';
import { FinancePage } from './pages/FinancePage';
import { DiaryPage } from './pages/DiaryPage';
import { LifeNotesPage } from './pages/LifeNotesPage';
import { CyberLabPage } from './pages/CyberLabPage';
import { FocusPage } from './pages/FocusPage';
import { ProductivityPage } from './pages/ProductivityPage';
import { SettingsPage } from './pages/SettingsPage';

function AppInner() {
  const [dbReady, setDbReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [autoLocked, setAutoLocked] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncReport, setLastSyncReport] = useState<SyncReport | null>(null);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  const inactivityTimerRef = useRef<number | null>(null);

  useEffect(() => {
    initializeDatabase().then(() => setDbReady(true));
  }, []);

  const profile = useLiveQuery(() => db.profile.get('primary'), [dbReady]);
  const pendingSyncCount =
    useLiveQuery(() => db.syncQueue.where('status').equals('pending').count(), [dbReady]) ?? 0;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedDark =
    profile?.theme === 'dark' || (profile?.theme !== 'light' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [resolvedDark]);

  const handleManualSync = useCallback(async (): Promise<SyncReport> => {
    setSyncState('syncing');
    const report = await runCloudSync();
    setSyncState(report.state);
    setLastSyncReport(report);
    return report;
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void handleManualSync();
    };
    const onOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [handleManualSync]);

  // Immediately sync on unlock so all 16 Supabase tables stay live automatically
  useEffect(() => {
    if (!unlocked || !isOnline) return;
    void handleManualSync();
  }, [unlocked, isOnline, handleManualSync]);

  // Fast auto-sync whenever any new entry is added, edited, or deleted
  useEffect(() => {
    if (!unlocked || !isOnline || pendingSyncCount === 0) return;
    const t = window.setTimeout(() => {
      void handleManualSync();
    }, 800);
    return () => window.clearTimeout(t);
  }, [unlocked, isOnline, pendingSyncCount, handleManualSync]);

  useEffect(() => {
    if (!unlocked || !profile || !profile.autoLockMinutes || profile.autoLockMinutes <= 0) return;

    const timeoutMs = profile.autoLockMinutes * 60 * 1000;
    const resetTimer = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = window.setTimeout(() => {
        setUnlocked(false);
        setAutoLocked(true);
      }, timeoutMs);
    };

    resetTimer();
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [unlocked, profile?.autoLockMinutes]);

  const handleToggleTheme = async (next: ThemeMode) => {
    if (!profile) return;
    const updated = {
      ...profile,
      theme: next,
      updatedAt: new Date().toISOString(),
    };
    await db.profile.put(updated);
    await enqueueSync('profile', updated.id, 'upsert', updated);
  };

  if (!dbReady || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="liquid-wallpaper" />
        <div className="relative z-10 flex flex-col items-center gap-3 liquid-dock px-7 py-5 rounded-3xl">
          <div className="w-7 h-7 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Initialising My Life OS...
          </p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <LockScreen
        profile={profile}
        autoLockedReason={autoLocked}
        onUnlock={() => {
          setUnlocked(true);
          setAutoLocked(false);
        }}
      />
    );
  }

  return (
    <AppShell
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      profile={profile}
      resolvedDark={resolvedDark}
      onToggleTheme={handleToggleTheme}
      onLock={() => {
        setUnlocked(false);
        setAutoLocked(false);
      }}
      isOnline={isOnline}
      syncState={syncState}
      pendingSyncCount={pendingSyncCount}
      onManualSync={() => void handleManualSync()}
    >
      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {activeSection === 'home' && (
          <HomePage profile={profile} onNavigate={setActiveSection} />
        )}
        {activeSection === 'study' && <StudyPage profile={profile} />}
        {activeSection === 'planner' && <PlannerPage />}
        {activeSection === 'finance' && <FinancePage />}
        {activeSection === 'diary' && <DiaryPage />}
        {activeSection === 'notes' && <LifeNotesPage />}
        {activeSection === 'cyber' && <CyberLabPage />}
        {activeSection === 'focus' && <FocusPage />}
        {activeSection === 'productivity' && <ProductivityPage />}
        {activeSection === 'settings' && (
          <SettingsPage
            profile={profile}
            onLockNow={() => {
              setUnlocked(false);
              setAutoLocked(false);
            }}
            onManualSync={handleManualSync}
            isOnline={isOnline}
            syncState={syncState}
            lastSyncReport={lastSyncReport}
          />
        )}
      </motion.div>
    </AppShell>
  );
}

export default function App() {
  return (
    <TimerProvider>
      <AppInner />
    </TimerProvider>
  );
}
