import Dexie, { type EntityTable } from 'dexie';
import type {
  AcademicAssessment,
  AcademicModule,
  CyberLog,
  CyberSkill,
  DiaryEntry,
  FinanceAccount,
  FinanceBudget,
  FinanceTransaction,
  FocusSession,
  LifeGoal,
  LifeNote,
  PlannerTask,
  RoutineItem,
  SavingsGoal,
  StudyResource,
  SyncQueueItem,
  UserProfile,
} from '../types/models';
import { buildInitialCyberSkills, buildInitialModules, YEAR3_OPTIONAL_MODULES } from '../data/curriculumSeed';
import { generateId, generateSalt, hashPin } from '../lib/crypto';

export class MyLifeOSDB extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>;
  modules!: EntityTable<AcademicModule, 'id'>;
  assessments!: EntityTable<AcademicAssessment, 'id'>;
  studyResources!: EntityTable<StudyResource, 'id'>;
  tasks!: EntityTable<PlannerTask, 'id'>;
  routines!: EntityTable<RoutineItem, 'id'>;
  lifeGoals!: EntityTable<LifeGoal, 'id'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  accounts!: EntityTable<FinanceAccount, 'id'>;
  transactions!: EntityTable<FinanceTransaction, 'id'>;
  budgets!: EntityTable<FinanceBudget, 'id'>;
  savingsGoals!: EntityTable<SavingsGoal, 'id'>;
  diaryEntries!: EntityTable<DiaryEntry, 'id'>;
  lifeNotes!: EntityTable<LifeNote, 'id'>;
  cyberSkills!: EntityTable<CyberSkill, 'id'>;
  cyberLogs!: EntityTable<CyberLog, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('MyLifeOS_Shaurav_DB');
    this.version(1).stores({
      profile: 'id',
      modules: 'id, code, year, semester, status',
      assessments: 'id, moduleId, type, dueDate, status',
      studyResources: 'id, moduleId, kind, createdAt',
      tasks: 'id, date, priority, category, completed, recurrence',
      routines: 'id, timeOfDay',
      lifeGoals: 'id, targetAge, category, status',
      focusSessions: 'id, mode, moduleId, date, startedAt',
      accounts: 'id, type, name',
      transactions: 'id, type, category, date, accountId, paymentMethod',
      budgets: 'id, category, month',
      savingsGoals: 'id, deadline',
      diaryEntries: 'id, &date, mood',
      lifeNotes: 'id, category, isFavorite, updatedAt',
      cyberSkills: 'id, category, level',
      cyberLogs: 'id, kind, status, date',
      syncQueue: 'id, tableName, recordId, status, timestamp',
    });
  }
}

export const db = new MyLifeOSDB();

let initPromise: Promise<UserProfile> | null = null;

export async function initializeDatabase(): Promise<UserProfile> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const existingProfile = await db.profile.get('primary');
    const now = new Date().toISOString();

    if (!existingProfile) {
      const salt = generateSalt();
      const pinHash = await hashPin('1234', salt);
      const profile: UserProfile = {
        id: 'primary',
        name: 'Shaurav',
        college: 'Global College of Technology (GCT)',
        degree: 'BSc (Hons) Computer Science with Cybersecurity',
        durationYears: 4,
        totalCredits: 480,
        currentYear: 1,
        country: 'Nepal',
        currency: 'NPR',
        timezone: 'Asia/Kathmandu',
        pinHash,
        pinSalt: salt,
        pinIsDefault: true,
        autoLockMinutes: 15,
        theme: 'system',
        notificationsEnabled: false,
        selectedYear3OptionalId: YEAR3_OPTIONAL_MODULES[0].id,
        updatedAt: now,
      };
      await db.profile.put(profile);
    }

    const moduleCount = await db.modules.count();
    if (moduleCount === 0) {
      await db.modules.bulkPut(buildInitialModules());
    }

    const cyberCount = await db.cyberSkills.count();
    if (cyberCount === 0) {
      await db.cyberSkills.bulkPut(buildInitialCyberSkills());
    }

    const finalProfile = await db.profile.get('primary');
    return finalProfile!;
  })();
  return initPromise;
}

type SyncHook = (item: SyncQueueItem) => void;
let onEnqueueHook: SyncHook | null = null;

export function registerSyncHook(fn: SyncHook): void {
  onEnqueueHook = fn;
}

export async function enqueueSync(
  tableName: string,
  recordId: string,
  operation: 'upsert' | 'delete',
  payload?: unknown
): Promise<void> {
  const item: SyncQueueItem = {
    id: generateId('sync'),
    tableName,
    recordId,
    operation,
    payload,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  await db.syncQueue.put(item);
  if (onEnqueueHook) {
    onEnqueueHook(item);
  }
}

export const ALL_SYNC_TABLES = [
  'profile',
  'modules',
  'assessments',
  'studyResources',
  'tasks',
  'routines',
  'lifeGoals',
  'focusSessions',
  'accounts',
  'transactions',
  'budgets',
  'savingsGoals',
  'diaryEntries',
  'lifeNotes',
  'cyberSkills',
  'cyberLogs',
] as const;

export type SyncTableName = (typeof ALL_SYNC_TABLES)[number];

export async function exportFullBackupJSON(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const table of ALL_SYNC_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data[table] = await (db as any)[table].toArray();
  }
  return JSON.stringify(
    {
      app: 'My Life OS',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2
  );
}

export async function restoreFullBackupJSON(jsonString: string): Promise<{ restoredTables: number; totalRecords: number }> {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Invalid My Life OS backup file format.');
  }

  let restoredTables = 0;
  let totalRecords = 0;

  await db.transaction('rw', db.tables, async () => {
    for (const table of ALL_SYNC_TABLES) {
      const records = parsed.data[table];
      if (Array.isArray(records)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tbl = (db as any)[table];
        await tbl.clear();
        if (records.length > 0) {
          await tbl.bulkPut(records);
          totalRecords += records.length;
        }
        restoredTables++;
      }
    }
  });

  return { restoredTables, totalRecords };
}

export async function resetAllLocalData(): Promise<void> {
  initPromise = null;
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
  await initializeDatabase();
}
