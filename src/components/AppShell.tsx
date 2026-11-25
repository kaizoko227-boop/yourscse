import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Home,
  GraduationCap,
  CalendarDays,
  Wallet,
  BookOpen,
  StickyNote,
  Shield,
  Timer,
  Activity,
  Settings,
  Lock,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  RefreshCw,
  MoreHorizontal,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Command,
} from 'lucide-react';
import type { NavSection, ThemeMode, UserProfile } from '../types/models';
import { useTimer } from '../context/TimerContext';
import { formatKathmanduTime, formatStopwatch } from '../lib/dateUtils';
import type { SyncState } from '../lib/syncEngine';

interface NavItem {
  id: NavSection;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', shortLabel: 'Home', description: 'Personal overview & daily pulse', icon: Home },
  { id: 'study', label: 'Study', shortLabel: 'Study', description: '4-year 480-credit GCT syllabus', icon: GraduationCap },
  { id: 'planner', label: 'Planner', shortLabel: 'Planner', description: 'Calendars, time blocks & age goals', icon: CalendarDays },
  { id: 'finance', label: 'Finance', shortLabel: 'Finance', description: 'NPR wallets, budgets & reports', icon: Wallet },
  { id: 'diary', label: 'Diary', shortLabel: 'Diary', description: 'Daily journal & mood analytics', icon: BookOpen },
  { id: 'notes', label: 'Life Notes', shortLabel: 'Notes', description: 'Ideas, memories & attachments', icon: StickyNote },
  { id: 'cyber', label: 'Cyber Lab', shortLabel: 'Cyber', description: '13 security domains, labs & CTFs', icon: Shield },
];

export const UTILITY_NAV_ITEMS: NavItem[] = [
  { id: 'focus', label: 'Focus & Timer', shortLabel: 'Focus', description: 'Pomodoro, focus & stopwatch', icon: Timer },
  { id: 'productivity', label: 'Productivity', shortLabel: 'Stats', description: '52-week heatmap & streaks', icon: Activity },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', description: 'PIN, Supabase RLS & backups', icon: Settings },
];

interface AppShellProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  profile: UserProfile;
  resolvedDark: boolean;
  onToggleTheme: (next: ThemeMode) => void;
  onLock: () => void;
  isOnline: boolean;
  syncState: SyncState;
  pendingSyncCount: number;
  onManualSync: () => void;
  children: React.ReactNode;
}

export function AppShell({
  activeSection,
  onSelectSection,
  profile,
  resolvedDark,
  onToggleTheme,
  onLock,
  isOnline,
  syncState,
  pendingSyncCount,
  onManualSync,
  children,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const timer = useTimer();

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 20000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlightOpen((o) => !o);
        setSpotlightQuery('');
      } else if (e.key === 'Escape' && spotlightOpen) {
        setSpotlightOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spotlightOpen]);

  const formatMiniTimer = () => {
    if (timer.mode === 'stopwatch') return formatStopwatch(timer.elapsedMs);
    const m = Math.floor(timer.remainingSeconds / 60);
    const s = timer.remainingSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const allNavItems = useMemo(() => [...MAIN_NAV_ITEMS, ...UTILITY_NAV_ITEMS], []);
  const mobilePrimaryIds: NavSection[] = ['home', 'study', 'planner', 'finance'];
  const mobilePrimaryItems = MAIN_NAV_ITEMS.filter((i) => mobilePrimaryIds.includes(i.id));
  const mobileMoreItems = allNavItems.filter((i) => !mobilePrimaryIds.includes(i.id));
  const isMoreActive = mobileMoreItems.some((i) => i.id === activeSection);
  const activeNavMeta = allNavItems.find((i) => i.id === activeSection);

  const spotlightResults = useMemo(() => {
    const q = spotlightQuery.trim().toLowerCase();
    if (!q) return allNavItems;
    return allNavItems.filter(
      (i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    );
  }, [allNavItems, spotlightQuery]);

  return (
    <div className="min-h-screen flex relative text-slate-900 dark:text-slate-50">
      {/* Living Apple iOS 26 / macOS Tahoe Silk Refractive Wallpaper */}
      <div className="liquid-wallpaper">
        <div className="liquid-orb liquid-orb-1" />
        <div className="liquid-orb liquid-orb-2" />
        <div className="liquid-orb liquid-orb-3" />
      </div>

      {/* =========================================================
          iPadOS 26 NATIVE FLOATING LIQUID RAIL (md: 768px - 1023px)
          ========================================================= */}
      <aside className="hidden md:flex lg:hidden flex-col items-center shrink-0 sticky top-3.5 h-[calc(100vh-1.75rem)] ml-3.5 my-3.5 w-[84px] rounded-[32px] liquid-dock z-20 py-3.5 justify-between">
        <button
          type="button"
          onClick={() => onSelectSection('home')}
          className="w-11 h-11 rounded-[18px] bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(6,182,212,0.55)] border border-white/50 cursor-pointer"
          title="My Life OS"
        >
          <Shield className="w-5 h-5 text-white" />
        </button>

        <nav className="flex-1 overflow-y-auto w-full px-2 py-3 flex flex-col items-center gap-1.5">
          {allNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                title={item.label}
                className={`relative w-12 h-11 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  active
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/55 dark:hover:bg-white/10'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="ipadNavPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-2xl bg-gradient-to-b from-cyan-400 to-sky-600 shadow-[0_8px_18px_-4px_rgba(6,182,212,0.6)] border border-white/45"
                  />
                )}
                <Icon className="relative z-10 w-[18px] h-[18px]" />
                <span className="relative z-10 text-[9px] font-medium mt-0.5 leading-none">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-white/45 dark:border-white/[0.08] w-full px-2">
          <button
            type="button"
            onClick={() => onToggleTheme(resolvedDark ? 'light' : 'dark')}
            className="w-10 h-10 rounded-full bg-white/55 dark:bg-white/[0.09] hover:bg-white/85 dark:hover:bg-white/15 border border-white/65 dark:border-white/12 flex items-center justify-center cursor-pointer"
            title="Toggle appearance"
          >
            {resolvedDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-600" />}
          </button>
          <button
            type="button"
            onClick={onLock}
            className="w-10 h-10 rounded-full bg-white/55 dark:bg-white/[0.09] hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-300 border border-white/65 dark:border-white/12 flex items-center justify-center cursor-pointer"
            title="Lock My Life OS"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* =========================================================
          macOS TAHOE FLOATING LIQUID SIDEBAR (lg: >= 1024px)
          ========================================================= */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-3.5 h-[calc(100vh-1.75rem)] ml-3.5 my-3.5 rounded-[30px] liquid-dock z-20 transition-all duration-300 overflow-hidden ${
          sidebarCollapsed ? 'w-[82px]' : 'w-[262px]'
        }`}
      >
        {/* macOS Tahoe Top Brand & Collapse */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/50 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => onSelectSection('home')}
            className="flex items-center gap-3 overflow-hidden cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-[14px] bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center shrink-0 shadow-[0_8px_20px_-4px_rgba(6,182,212,0.5)] border border-white/55 group-hover:scale-105 transition-transform">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="text-left leading-tight truncate">
                <div className="text-[14px] font-semibold tracking-tight text-slate-900 dark:text-white">
                  My Life OS
                </div>
                <div className="text-[11px] text-slate-500 dark:text-cyan-200/70 truncate">
                  {profile.name} • Year {profile.currentYear}
                </div>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Tahoe Spotlight Search Pill */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setSpotlightOpen(true);
                setSpotlightQuery('');
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-full bg-white/55 dark:bg-white/[0.06] hover:bg-white/80 dark:hover:bg-white/[0.11] border border-white/75 dark:border-white/[0.1] text-xs text-slate-500 dark:text-slate-300/80 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                <span>Jump to space...</span>
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                <Command className="w-2.5 h-2.5" />K
              </span>
            </button>
          </div>
        )}

        {/* Navigation Links with Fluid Sliding Liquid Pill */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500/80 dark:text-cyan-200/50">
                Spaces
              </div>
            )}
            <div className="space-y-1">
              {MAIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-full text-[13.5px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'text-white'
                        : 'text-slate-700 dark:text-slate-200/85 hover:bg-white/55 dark:hover:bg-white/[0.08] hover:text-slate-950 dark:hover:text-white'
                    } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    {active && (
                      <motion.div
                        layoutId="tahoeActivePill"
                        transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 shadow-[0_8px_20px_-6px_rgba(6,182,212,0.65)] border border-white/45"
                      />
                    )}
                    <Icon className="relative z-10 w-[18px] h-[18px] shrink-0" />
                    {!sidebarCollapsed && <span className="relative z-10 truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2.5 border-t border-white/50 dark:border-white/[0.08]">
            {!sidebarCollapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500/80 dark:text-cyan-200/50">
                Focus & System
              </div>
            )}
            <div className="space-y-1">
              {UTILITY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`relative w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-full text-[13.5px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'text-white'
                        : 'text-slate-700 dark:text-slate-200/85 hover:bg-white/55 dark:hover:bg-white/[0.08] hover:text-slate-950 dark:hover:text-white'
                    } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    {active && (
                      <motion.div
                        layoutId="tahoeActivePill"
                        transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 shadow-[0_8px_20px_-6px_rgba(6,182,212,0.65)] border border-white/45"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2.5 truncate">
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCollapsed && item.id === 'focus' && timer.isRunning && (
                      <span className="relative z-10 font-mono text-[10px] tabular-nums px-2 py-0.5 rounded-full bg-emerald-400/25 text-emerald-900 dark:text-emerald-200 border border-emerald-400/40">
                        {formatMiniTimer()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Bottom Status & Controls */}
        <div className="p-3 border-t border-white/50 dark:border-white/[0.08] space-y-2">
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={onManualSync}
              className="w-full flex items-center justify-between px-3 py-2 rounded-full bg-white/55 dark:bg-white/[0.07] hover:bg-white/80 dark:hover:bg-white/[0.12] border border-white/70 dark:border-white/10 text-xs transition-all cursor-pointer"
              title="Click to sync"
            >
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                {isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span className="truncate">
                  {!isOnline
                    ? 'Offline Ready'
                    : syncState === 'syncing'
                    ? 'Syncing...'
                    : syncState === 'synced'
                    ? 'Cloud Synced'
                    : 'IndexedDB Ready'}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {pendingSyncCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-800 dark:text-cyan-200">
                    {pendingSyncCount}
                  </span>
                )}
                <RefreshCw
                  className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-300 ${
                    syncState === 'syncing' ? 'animate-spin' : ''
                  }`}
                />
              </span>
            </button>
          )}

          <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? 'flex-col' : 'justify-between'}`}>
            <button
              type="button"
              onClick={() => onToggleTheme(resolvedDark ? 'light' : 'dark')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-full bg-white/60 dark:bg-white/[0.08] hover:bg-white/85 dark:hover:bg-white/[0.15] border border-white/70 dark:border-white/12 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
              title="Toggle light/dark mode"
            >
              {resolvedDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-sky-600" />}
              {!sidebarCollapsed && <span>{resolvedDark ? 'Light' : 'Dark'}</span>}
            </button>
            <button
              type="button"
              onClick={onLock}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-full bg-white/60 dark:bg-white/[0.08] hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-300 border border-white/70 dark:border-white/12 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
              title="Lock My Life OS"
            >
              <Lock className="w-3.5 h-3.5" />
              {!sidebarCollapsed && <span>Lock</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Desktop & iPad Floating macOS Tahoe Glass Top Bar */}
        <div className="hidden md:flex items-center justify-between px-6 lg:px-8 pt-4 pb-1">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full liquid-dock text-xs font-medium text-slate-700 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-cyan-400 to-sky-500 shadow-[0_0_8px_rgba(6,182,212,0.85)]" />
            <span>{activeNavMeta?.label || 'Workspace'}</span>
            <span className="hidden xl:inline text-slate-400 dark:text-slate-500">•</span>
            <span className="text-slate-500 dark:text-slate-400 font-normal hidden xl:inline">
              {activeNavMeta?.description}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Dynamic Island Live Activity & Kathmandu Clock */}
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-950/88 dark:bg-black/78 text-white border border-white/15 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.5)] backdrop-blur-2xl text-xs">
              <span className="font-mono tabular-nums text-cyan-300">{formatKathmanduTime(clock)} NPT</span>
              {timer.isRunning && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <button
                    type="button"
                    onClick={() => onSelectSection('focus')}
                    className="inline-flex items-center gap-1.5 font-mono text-emerald-300 hover:text-emerald-200 cursor-pointer"
                  >
                    <Timer className="w-3.5 h-3.5 animate-pulse" />
                    {formatMiniTimer()}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* iPhone Floating Liquid Top Header */}
        <header className="md:hidden sticky top-2.5 z-30 mx-3 px-3.5 h-13 rounded-full liquid-dock flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectSection('home')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center shadow-sm border border-white/55">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight">{activeNavMeta?.label || 'My Life OS'}</span>
          </button>

          <div className="flex items-center gap-1">
            {timer.isRunning && (
              <button
                type="button"
                onClick={() => onSelectSection('focus')}
                className="font-mono text-[11px] tabular-nums px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 cursor-pointer"
              >
                {formatMiniTimer()}
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleTheme(resolvedDark ? 'light' : 'dark')}
              className="p-2 rounded-full hover:bg-white/55 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer"
              aria-label="Toggle theme"
            >
              {resolvedDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-600" />}
            </button>
            <button
              type="button"
              onClick={onLock}
              className="p-2 rounded-full hover:bg-white/55 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer"
              aria-label="Lock app"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Content */}
        <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-28 md:pb-8">
          {children}
        </main>
      </div>

      {/* =========================================================
          iPHONE iOS 26 FLOATING LIQUID GLASS CAPSULE TAB BAR
          ========================================================= */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 z-30 rounded-full liquid-dock-bar px-2 py-1.5">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  onSelectSection(item.id);
                }}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-full transition-colors cursor-pointer ${
                  active ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="iosTabPill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-gradient-to-b from-cyan-400 to-sky-600 shadow-[0_6px_16px_-4px_rgba(6,182,212,0.65)] border border-white/45"
                  />
                )}
                <Icon className="relative z-10 w-4.5 h-4.5" />
                <span className="relative z-10 text-[10px] font-medium mt-0.5">{item.shortLabel}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMoreOpen((o) => !o)}
            className={`relative flex flex-col items-center justify-center py-1.5 rounded-full transition-colors cursor-pointer ${
              isMoreActive || mobileMoreOpen ? 'text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {(isMoreActive || mobileMoreOpen) && (
              <motion.div
                layoutId="iosTabPill"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="absolute inset-0 rounded-full bg-gradient-to-b from-cyan-400 to-sky-600 shadow-[0_6px_16px_-4px_rgba(6,182,212,0.65)] border border-white/45"
              />
            )}
            <MoreHorizontal className="relative z-10 w-4.5 h-4.5" />
            <span className="relative z-10 text-[10px] font-medium mt-0.5">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Frosted Liquid Glass "More" Sheet */}
      <AnimatePresence>
        {mobileMoreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-md flex items-end p-2.5"
            onClick={() => setMobileMoreOpen(false)}
          >
            <motion.div
              initial={{ y: 90, opacity: 0.7 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 90, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="w-full liquid-dock rounded-[34px] p-5 pb-safe"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-slate-400/50 mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">All Spaces</span>
                <button
                  type="button"
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-1.5 rounded-full bg-white/55 dark:bg-white/10 text-slate-600 dark:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2.5 pb-2">
                {mobileMoreItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectSection(item.id);
                        setMobileMoreOpen(false);
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-[22px] border text-xs font-medium transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-br from-cyan-400 to-sky-600 text-white border-white/45 shadow-lg'
                          : 'bg-white/55 dark:bg-white/[0.07] border-white/75 dark:border-white/12 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-center leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* macOS Tahoe Spotlight Command Palette (⌘K) */}
      <AnimatePresence>
        {spotlightOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-md flex items-start justify-center pt-20 p-4"
            onClick={() => setSpotlightOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              className="w-full max-w-lg liquid-dock rounded-[28px] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/50 dark:border-white/[0.08]">
                <Search className="w-4.5 h-4.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <input
                  autoFocus
                  value={spotlightQuery}
                  onChange={(e) => setSpotlightQuery(e.target.value)}
                  placeholder="Spotlight Search — jump to any space..."
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSpotlightOpen(false)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/60 dark:bg-white/10 text-slate-500 cursor-pointer"
                >
                  ESC
                </button>
              </div>
              <div className="p-2 max-h-80 overflow-y-auto space-y-1">
                {spotlightResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectSection(item.id);
                        setSpotlightOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl hover:bg-white/65 dark:hover:bg-white/10 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400/20 to-sky-500/15 border border-white/60 dark:border-white/10 flex items-center justify-center text-cyan-700 dark:text-cyan-300 shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {item.label}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      {activeSection === item.id && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
