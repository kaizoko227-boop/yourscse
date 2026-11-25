import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  Bell,
  Check,
  Copy,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Lock,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  ALL_SYNC_TABLES,
  db,
  enqueueSync,
  exportFullBackupJSON,
  resetAllLocalData,
  restoreFullBackupJSON,
} from '../db/database';
import { generateSalt, hashPin, verifyPin } from '../lib/crypto';
import { SUPABASE_GRANT_FIX_SQL } from '../lib/supabase';
import { resolveConflict, type SyncReport, type SyncState } from '../lib/syncEngine';
import type { ThemeMode, UserProfile } from '../types/models';
import { PageHeader } from '../components/ui/Modal';

interface SettingsPageProps {
  profile: UserProfile;
  onLockNow: () => void;
  onManualSync: () => Promise<SyncReport>;
  isOnline: boolean;
  syncState: SyncState;
  lastSyncReport: SyncReport | null;
}

type SettingsTab = 'profile' | 'security' | 'backend' | 'data';

export function SettingsPage({
  profile,
  onLockNow,
  onManualSync,
  isOnline,
  syncState,
  lastSyncReport,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile Form
  const [name, setName] = useState(profile.name);
  const [college, setCollege] = useState(profile.college);
  const [degree, setDegree] = useState(profile.degree);
  const [currentYear, setCurrentYear] = useState<1 | 2 | 3 | 4>(profile.currentYear);
  const [country, setCountry] = useState(profile.country);
  const [currency, setCurrency] = useState(profile.currency);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [profileSaved, setProfileSaved] = useState(false);

  // PIN Form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Storage & Restore status
  const [storageUsage, setStorageUsage] = useState<{ usedMB: string; quotaMB: string } | null>(null);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [restoreMsg, setRestoreMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedGrantSql, setCopiedGrantSql] = useState(false);

  const syncQueue = useLiveQuery(() => db.syncQueue.toArray(), []) ?? [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];

  const conflicts = syncQueue.filter((q) => q.status === 'conflict');
  const pendingItems = syncQueue.filter((q) => q.status === 'pending' || q.status === 'error');

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageUsage({
          usedMB: ((est.usage || 0) / (1024 * 1024)).toFixed(2),
          quotaMB: ((est.quota || 0) / (1024 * 1024)).toFixed(0),
        });
      });
    }
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      for (const tbl of ALL_SYNC_TABLES) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        counts[tbl] = await (db as any)[tbl].count();
      }
      setTableCounts(counts);
    };
    void loadCounts();
  }, [activeTab, syncQueue.length]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...profile,
      name: name.trim() || 'Shaurav',
      college: college.trim(),
      degree: degree.trim(),
      currentYear,
      country: country.trim(),
      currency: currency.trim() || 'NPR',
      timezone: timezone.trim() || 'Asia/Kathmandu',
      updatedAt: new Date().toISOString(),
    };
    await db.profile.put(updated);
    await enqueueSync('profile', updated.id, 'upsert', updated);
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleThemeChange = async (theme: ThemeMode) => {
    const updated = { ...profile, theme, updatedAt: new Date().toISOString() };
    await db.profile.put(updated);
    await enqueueSync('profile', updated.id, 'upsert', updated);
  };

  const handleAutoLockChange = async (mins: number) => {
    const updated = { ...profile, autoLockMinutes: mins, updatedAt: new Date().toISOString() };
    await db.profile.put(updated);
    await enqueueSync('profile', updated.id, 'upsert', updated);
  };

  const handleNotificationsToggle = async () => {
    if (!profile.notificationsEnabled && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }
    const updated = {
      ...profile,
      notificationsEnabled: !profile.notificationsEnabled,
      updatedAt: new Date().toISOString(),
    };
    await db.profile.put(updated);
    await enqueueSync('profile', updated.id, 'upsert', updated);
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (!/^\d{4}$/.test(newPin)) {
      setPinMsg({ type: 'err', text: 'New PIN must be exactly 4 numeric digits.' });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ type: 'err', text: 'New PIN and confirmation do not match.' });
      return;
    }
    const valid = await verifyPin(currentPin, profile.pinSalt, profile.pinHash);
    if (!valid) {
      setPinMsg({ type: 'err', text: 'Current PIN is incorrect.' });
      return;
    }
    const newSalt = generateSalt();
    const newHash = await hashPin(newPin, newSalt);
    const updated = {
      ...profile,
      pinSalt: newSalt,
      pinHash: newHash,
      pinIsDefault: false,
      updatedAt: new Date().toISOString(),
    };
    await db.profile.put(updated);
    await enqueueSync('profile', updated.id, 'upsert', updated);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinMsg({ type: 'ok', text: 'Security PIN updated & auto-saved to Supabase.' });
  };

  const handleExportJSON = async () => {
    const json = await exportFullBackupJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-life-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFinanceCSV = () => {
    const accMap = new Map(accounts.map((a) => [a.id, a.name]));
    const header = ['Date', 'Type', 'Amount (NPR)', 'Category', 'Description', 'Counterparty', 'Account', 'Payment Method'];
    const rows = transactions.map((t) => [
      t.date,
      t.type,
      String(t.amount),
      t.category,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.counterparty.replace(/"/g, '""')}"`,
      `"${(accMap.get(t.accountId) || '').replace(/"/g, '""')}"`,
      t.paymentMethod,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-life-os-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await restoreFullBackupJSON(String(reader.result));
        setRestoreMsg({
          type: 'ok',
          text: `Restored ${res.totalRecords} records across ${res.restoredTables} tables & syncing to Supabase.`,
        });
        void onManualSync();
      } catch (err) {
        setRestoreMsg({
          type: 'err',
          text: err instanceof Error ? err.message : 'Restore failed.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleResetLocal = async () => {
    const confirmed = window.confirm(
      'Reset all local IndexedDB records? Your 4-year curriculum and cybersecurity roadmap will re-initialise to clean empty states.'
    );
    if (!confirmed) return;
    await resetAllLocalData();
    setRestoreMsg({ type: 'ok', text: 'Local database reset to clean initial state.' });
  };

  const isPermissionError =
    lastSyncReport?.state === 'error' &&
    (lastSyncReport.message.toLowerCase().includes('permission denied') ||
      lastSyncReport.message.toLowerCase().includes('row-level security'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Sync"
        subtitle="Profile, security PIN, live Supabase cloud sync, and offline backups"
        actions={
          <button type="button" onClick={onLockNow} className="os-btn-secondary text-xs py-2 px-3.5">
            <Lock className="w-3.5 h-3.5" />
            Lock Now
          </button>
        }
      />

      {/* Settings Tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-white/55 dark:bg-white/[0.07] border border-white/75 dark:border-white/[0.12] backdrop-blur-xl p-1 rounded-full shadow-xs w-fit">
        {(
          [
            { id: 'profile', label: 'Profile & Appearance' },
            { id: 'security', label: 'PIN & Auto-Lock' },
            { id: 'backend', label: 'Cloud Sync Status' },
            { id: 'data', label: 'Backups & Data' },
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

      {/* TAB 1: PROFILE & APPEARANCE */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleSaveProfile} className="lg:col-span-7 os-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/50 dark:border-white/[0.08]">
              <UserIcon className="w-4 h-4 text-cyan-500" />
              <h2 className="text-sm font-semibold">Personal & Academic Profile</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="os-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Current Year</label>
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(Number(e.target.value) as 1 | 2 | 3 | 4)}
                  className="os-input"
                >
                  <option value={1}>Year 1</option>
                  <option value={2}>Year 2</option>
                  <option value={3}>Year 3</option>
                  <option value={4}>Year 4</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">College / University</label>
              <input value={college} onChange={(e) => setCollege(e.target.value)} className="os-input" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Degree Programme</label>
              <input value={degree} onChange={(e) => setDegree(e.target.value)} className="os-input" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Country</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className="os-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Currency</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="os-input font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Timezone</label>
                <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="os-input font-mono text-xs" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="os-btn-primary text-xs">
                {profileSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved & Synced
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>

          <div className="lg:col-span-5 space-y-5">
            <div className="os-card p-5 space-y-4">
              <h2 className="text-sm font-semibold">Appearance & Theme</h2>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                    { id: 'system', label: 'System', icon: ShieldCheck },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = profile.theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleThemeChange(item.id)}
                      className={`p-3 rounded-2xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white border-white/40 shadow-[0_4px_14px_-3px_rgba(6,182,212,0.55)]'
                          : 'border-white/70 dark:border-white/[0.12] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="os-card p-5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Reminders & Notifications</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Allow browser notifications for deadlines & focus sessions
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleNotificationsToggle}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer ${
                  profile.notificationsEnabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-white/60 dark:bg-white/[0.09] text-slate-600 dark:text-slate-300'
                }`}
              >
                {profile.notificationsEnabled ? 'Enabled' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY PIN & AUTO-LOCK */}
      {activeTab === 'security' && (
        <div className="max-w-xl">
          <form onSubmit={handleChangePin} className="os-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/50 dark:border-white/[0.08]">
              <KeyRound className="w-4 h-4 text-cyan-500" />
              <div>
                <h2 className="text-sm font-semibold">Change 4-Digit Security PIN</h2>
                <p className="text-xs text-slate-500">Salted SHA-256 hash synced automatically to Supabase</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Current PIN {profile.pinIsDefault ? '(default: 1234)' : ''}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                required
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="os-input font-mono tracking-widest"
                placeholder="••••"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">New 4-Digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="os-input font-mono tracking-widest"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="os-input font-mono tracking-widest"
                  placeholder="••••"
                />
              </div>
            </div>

            {pinMsg && (
              <div
                className={`text-xs p-2.5 rounded-2xl ${
                  pinMsg.type === 'ok'
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                }`}
              >
                {pinMsg.text}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Auto-lock after:</label>
                <select
                  value={profile.autoLockMinutes}
                  onChange={(e) => handleAutoLockChange(Number(e.target.value))}
                  className="os-input py-1.5 px-2.5 text-xs !w-auto"
                >
                  <option value={1}>1 min</option>
                  <option value={5}>5 mins</option>
                  <option value={15}>15 mins</option>
                  <option value={30}>30 mins</option>
                  <option value={0}>Never</option>
                </select>
              </div>
              <button type="submit" className="os-btn-primary text-xs">
                Update PIN
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CLEAN LIVE CLOUD SYNC STATUS */}
      {activeTab === 'backend' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="os-card p-4 flex items-start gap-3">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <WifiOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-semibold">Network</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {isOnline ? 'Online' : 'Offline — local mode'}
                </div>
              </div>
            </div>

            <div className="os-card p-4 flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">Offline Cache (IndexedDB)</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {Object.values(tableCounts).reduce((a, b) => a + b, 0)} local records
                  {storageUsage ? ` (${storageUsage.usedMB} MB)` : ''}
                </div>
              </div>
            </div>

            <div className="os-card p-4 flex items-start gap-3">
              <Database className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">Supabase PostgreSQL</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  16 tables • Auto-saving live
                </div>
              </div>
            </div>

            <div className="os-card p-4 flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <RefreshCw
                  className={`w-5 h-5 text-cyan-500 shrink-0 mt-0.5 ${
                    syncState === 'syncing' ? 'animate-spin' : ''
                  }`}
                />
                <div>
                  <div className="text-xs font-semibold">Sync Queue</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {pendingItems.length === 0 ? 'All changes synced' : `${pendingItems.length} pending`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onManualSync()}
                className="os-btn-primary py-1.5 px-3 text-[11px] shrink-0"
              >
                Sync Now
              </button>
            </div>
          </div>

          {lastSyncReport && (
            <div
              className={`os-card p-4 text-xs flex flex-col gap-3 ${
                lastSyncReport.state === 'error'
                  ? 'border-rose-400/50 text-rose-700 dark:text-rose-300'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{lastSyncReport.message}</span>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  {new Date(lastSyncReport.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {isPermissionError && (
                <div className="space-y-2 pt-2 border-t border-rose-500/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold">
                      Run this 3-line Grant SQL once in Supabase SQL Editor to allow instant auto-save:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SUPABASE_GRANT_FIX_SQL);
                        setCopiedGrantSql(true);
                        window.setTimeout(() => setCopiedGrantSql(false), 2000);
                      }}
                      className="os-btn-secondary py-1 px-2.5 text-[11px]"
                    >
                      {copiedGrantSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedGrantSql ? 'Copied' : 'Copy SQL'}
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 text-cyan-200 text-[11px] font-mono overflow-x-auto">
                    {SUPABASE_GRANT_FIX_SQL}
                  </pre>
                </div>
              )}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="os-card p-5 border-amber-400/50 space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4" />
                Sync Conflicts ({conflicts.length})
              </div>
              {conflicts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold">
                      {c.tableName} • {c.recordId}
                    </div>
                    <div className="text-slate-500">Remote copy was updated more recently.</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void resolveConflict(c.id, 'keep_local')}
                      className="os-btn-secondary py-1.5 px-3 text-xs"
                    >
                      Keep Local
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolveConflict(c.id, 'keep_cloud')}
                      className="os-btn-primary py-1.5 px-3 text-xs"
                    >
                      Keep Cloud
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BACKUPS & DATA MANAGEMENT */}
      {activeTab === 'data' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="os-card p-5 space-y-3">
              <h2 className="text-sm font-semibold">Export Complete Backup</h2>
              <p className="text-xs text-slate-500">
                Download your entire My Life OS database as JSON, or export financial transactions as CSV.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={handleExportJSON} className="os-btn-primary text-xs">
                  <Download className="w-3.5 h-3.5" />
                  Export Full JSON Backup
                </button>
                <button
                  type="button"
                  onClick={handleExportFinanceCSV}
                  className="os-btn-secondary text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Finance CSV
                </button>
              </div>
            </div>

            <div className="os-card p-5 space-y-3">
              <h2 className="text-sm font-semibold">Restore from JSON Backup</h2>
              <p className="text-xs text-slate-500">
                Import a previously exported My Life OS JSON backup file to restore and sync all tables.
              </p>
              <label className="os-btn-secondary text-xs w-fit cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Select Backup JSON File
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreJSON}
                  className="hidden"
                />
              </label>
              {restoreMsg && (
                <div
                  className={`text-xs p-2.5 rounded-2xl ${
                    restoreMsg.type === 'ok'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {restoreMsg.text}
                </div>
              )}
            </div>
          </div>

          <div className="os-card p-5 border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                Clear Local IndexedDB Cache & Reset
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Wipes local cache and re-initialises the clean GCT 4-year syllabus & cybersecurity roadmap.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetLocal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium px-4 py-2.5 transition-colors shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset Local Cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
