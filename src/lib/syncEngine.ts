import { ALL_SYNC_TABLES, db, registerSyncHook, type SyncTableName } from '../db/database';
import type { SyncQueueItem } from '../types/models';
import { supabase } from './supabase';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';

export interface SyncReport {
  state: SyncState;
  pushed: number;
  pulled: number;
  conflicts: number;
  message: string;
  timestamp: string;
}

export const PERSONAL_OWNER_ID = '00000000-0000-0000-0000-000000000001';

export const SUPABASE_TABLE_MAP: Record<SyncTableName, string> = {
  profile: 'user_profiles',
  modules: 'academic_modules',
  assessments: 'academic_assessments',
  studyResources: 'study_resources',
  tasks: 'planner_tasks',
  routines: 'routines',
  lifeGoals: 'life_goals',
  focusSessions: 'focus_sessions',
  accounts: 'finance_accounts',
  transactions: 'finance_transactions',
  budgets: 'finance_budgets',
  savingsGoals: 'savings_goals',
  diaryEntries: 'diary_entries',
  lifeNotes: 'life_notes',
  cyberSkills: 'cyber_skills',
  cyberLogs: 'cyber_logs',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRemoteRow(tableName: SyncTableName, userId: string, record: any, deleted: boolean, ts: string): Record<string, unknown> {
  const base = { id: record?.id, user_id: userId, deleted, updated_at: record?.updatedAt || ts };
  if (deleted || !record) return base;

  switch (tableName) {
    case 'profile':
      return {
        ...base,
        name: record.name,
        college: record.college,
        degree: record.degree,
        duration_years: record.durationYears,
        total_credits: record.totalCredits,
        current_year: record.currentYear,
        country: record.country,
        currency: record.currency,
        timezone: record.timezone,
        pin_hash: record.pinHash,
        pin_salt: record.pinSalt,
        pin_is_default: record.pinIsDefault,
        auto_lock_minutes: record.autoLockMinutes,
        theme: record.theme,
        notifications_enabled: record.notificationsEnabled,
        selected_year3_optional_id: record.selectedYear3OptionalId,
        last_synced_at: record.lastSyncedAt ?? ts,
      };
    case 'modules':
      return {
        ...base,
        code: record.code,
        title: record.title,
        year: record.year,
        semester: record.semester,
        semester_end: record.semesterEnd ?? null,
        credits: record.credits,
        is_optional_slot: Boolean(record.isOptionalSlot),
        status: record.status,
        grade: record.grade ?? '',
        percentage: record.percentage ?? null,
        study_minutes: record.studyMinutes ?? 0,
        topics: record.topics ?? [],
        notes: record.notes ?? '',
      };
    case 'assessments':
      return {
        ...base,
        module_id: record.moduleId,
        title: record.title,
        type: record.type,
        due_date: record.dueDate,
        due_time: record.dueTime ?? null,
        weight: record.weight ?? 0,
        score: record.score ?? null,
        max_score: record.maxScore ?? 100,
        status: record.status,
        notes: record.notes ?? '',
      };
    case 'studyResources':
      return {
        ...base,
        module_id: record.moduleId,
        title: record.title,
        kind: record.kind,
        url: record.url ?? null,
        file_name: record.fileName ?? null,
        file_type: record.fileType ?? null,
        file_size: record.fileSize ?? null,
        file_data_url: record.fileDataUrl ?? null,
        created_at: record.createdAt || ts,
      };
    case 'tasks':
      return {
        ...base,
        title: record.title,
        description: record.description ?? '',
        date: record.date,
        start_time: record.startTime ?? null,
        end_time: record.endTime ?? null,
        priority: record.priority,
        category: record.category,
        completed: Boolean(record.completed),
        completed_at: record.completedAt ?? null,
        recurrence: record.recurrence,
        reminder_time: record.reminderTime ?? null,
        is_time_block: Boolean(record.isTimeBlock),
      };
    case 'routines':
      return {
        ...base,
        title: record.title,
        time_of_day: record.timeOfDay,
        scheduled_time: record.scheduledTime,
        completed_dates: record.completedDates ?? [],
        created_at: record.createdAt || ts,
      };
    case 'lifeGoals':
      return {
        ...base,
        target_age: record.targetAge,
        title: record.title,
        category: record.category,
        description: record.description ?? '',
        milestones: record.milestones ?? [],
        status: record.status,
        created_at: record.createdAt || ts,
      };
    case 'focusSessions':
      return {
        ...base,
        mode: record.mode,
        label: record.label,
        module_id: record.moduleId ?? null,
        duration_seconds: record.durationSeconds,
        laps: record.laps ?? null,
        date: record.date,
        started_at: record.startedAt || ts,
        completed_at: record.completedAt || ts,
      };
    case 'accounts':
      return {
        ...base,
        name: record.name,
        type: record.type,
        initial_balance: record.initialBalance ?? 0,
        currency: record.currency || 'NPR',
        color: record.color || '#06B6D4',
        notes: record.notes ?? '',
        created_at: record.createdAt || ts,
      };
    case 'transactions':
      return {
        ...base,
        type: record.type,
        amount: record.amount,
        category: record.category,
        date: record.date,
        description: record.description ?? '',
        counterparty: record.counterparty ?? '',
        account_id: record.accountId,
        to_account_id: record.toAccountId ?? null,
        payment_method: record.paymentMethod,
        notes: record.notes ?? '',
        created_at: record.createdAt || ts,
      };
    case 'budgets':
      return {
        ...base,
        category: record.category,
        month: record.month,
        limit_amount: record.limitAmount,
      };
    case 'savingsGoals':
      return {
        ...base,
        title: record.title,
        target_amount: record.targetAmount,
        current_amount: record.currentAmount,
        deadline: record.deadline ?? '',
        notes: record.notes ?? '',
        created_at: record.createdAt || ts,
      };
    case 'diaryEntries':
      return {
        ...base,
        date: record.date,
        mood: record.mood,
        energy: record.energy,
        performance: record.performance,
        achievements: record.achievements ?? '',
        lessons: record.lessons ?? '',
        problems: record.problems ?? '',
        tomorrows_plan: record.tomorrowsPlan ?? '',
        free_write: record.freeWrite ?? '',
      };
    case 'lifeNotes':
      return {
        ...base,
        title: record.title,
        content: record.content ?? '',
        category: record.category,
        tags: record.tags ?? [],
        is_favorite: Boolean(record.isFavorite),
        attachments: record.attachments ?? [],
        created_at: record.createdAt || ts,
      };
    case 'cyberSkills':
      return {
        ...base,
        domain: record.domain,
        category: record.category,
        level: record.level,
        sub_skills: record.subSkills ?? [],
        notes: record.notes ?? '',
      };
    case 'cyberLogs':
      return {
        ...base,
        kind: record.kind,
        title: record.title,
        platform: record.platform ?? '',
        status: record.status,
        date: record.date,
        difficulty: record.difficulty ?? null,
        score_or_result: record.scoreOrResult ?? null,
        url: record.url ?? null,
        tags: record.tags ?? [],
        writeup: record.writeup ?? '',
      };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRemoteRow(tableName: SyncTableName, row: any): Record<string, unknown> {
  const updatedAt = row.updated_at || new Date().toISOString();
  switch (tableName) {
    case 'profile':
      return {
        id: row.id,
        name: row.name,
        college: row.college,
        degree: row.degree,
        durationYears: Number(row.duration_years),
        totalCredits: Number(row.total_credits),
        currentYear: Number(row.current_year),
        country: row.country,
        currency: row.currency,
        timezone: row.timezone,
        pinHash: row.pin_hash,
        pinSalt: row.pin_salt,
        pinIsDefault: Boolean(row.pin_is_default),
        autoLockMinutes: Number(row.auto_lock_minutes),
        theme: row.theme,
        notificationsEnabled: Boolean(row.notifications_enabled),
        selectedYear3OptionalId: row.selected_year3_optional_id,
        lastSyncedAt: row.last_synced_at ?? undefined,
        updatedAt,
      };
    case 'modules':
      return {
        id: row.id,
        code: row.code,
        title: row.title,
        year: Number(row.year),
        semester: Number(row.semester),
        semesterEnd: row.semester_end ? Number(row.semester_end) : undefined,
        credits: Number(row.credits),
        isOptionalSlot: Boolean(row.is_optional_slot),
        status: row.status,
        grade: row.grade ?? '',
        percentage: row.percentage !== null && row.percentage !== undefined ? Number(row.percentage) : null,
        studyMinutes: Number(row.study_minutes || 0),
        topics: Array.isArray(row.topics) ? row.topics : [],
        notes: row.notes ?? '',
        updatedAt,
      };
    case 'assessments':
      return {
        id: row.id,
        moduleId: row.module_id,
        title: row.title,
        type: row.type,
        dueDate: row.due_date,
        dueTime: row.due_time ?? undefined,
        weight: Number(row.weight || 0),
        score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
        maxScore: Number(row.max_score || 100),
        status: row.status,
        notes: row.notes ?? '',
        updatedAt,
      };
    case 'studyResources':
      return {
        id: row.id,
        moduleId: row.module_id,
        title: row.title,
        kind: row.kind,
        url: row.url ?? undefined,
        fileName: row.file_name ?? undefined,
        fileType: row.file_type ?? undefined,
        fileSize: row.file_size ? Number(row.file_size) : undefined,
        fileDataUrl: row.file_data_url ?? undefined,
        createdAt: row.created_at || updatedAt,
      };
    case 'tasks':
      return {
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        date: row.date,
        startTime: row.start_time ?? undefined,
        endTime: row.end_time ?? undefined,
        priority: row.priority,
        category: row.category,
        completed: Boolean(row.completed),
        completedAt: row.completed_at ?? undefined,
        recurrence: row.recurrence,
        reminderTime: row.reminder_time ?? undefined,
        isTimeBlock: Boolean(row.is_time_block),
        updatedAt,
      };
    case 'routines':
      return {
        id: row.id,
        title: row.title,
        timeOfDay: row.time_of_day,
        scheduledTime: row.scheduled_time,
        completedDates: Array.isArray(row.completed_dates) ? row.completed_dates : [],
        createdAt: row.created_at || updatedAt,
        updatedAt,
      };
    case 'lifeGoals':
      return {
        id: row.id,
        targetAge: Number(row.target_age),
        title: row.title,
        category: row.category,
        description: row.description ?? '',
        milestones: Array.isArray(row.milestones) ? row.milestones : [],
        status: row.status,
        createdAt: row.created_at || updatedAt,
        updatedAt,
      };
    case 'focusSessions':
      return {
        id: row.id,
        mode: row.mode,
        label: row.label,
        moduleId: row.module_id ?? undefined,
        durationSeconds: Number(row.duration_seconds || 0),
        laps: Array.isArray(row.laps) ? row.laps : undefined,
        date: row.date,
        startedAt: row.started_at || updatedAt,
        completedAt: row.completed_at || updatedAt,
      };
    case 'accounts':
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        initialBalance: Number(row.initial_balance || 0),
        currency: row.currency || 'NPR',
        color: row.color || '#06B6D4',
        notes: row.notes ?? '',
        createdAt: row.created_at || updatedAt,
        updatedAt,
      };
    case 'transactions':
      return {
        id: row.id,
        type: row.type,
        amount: Number(row.amount || 0),
        category: row.category,
        date: row.date,
        description: row.description ?? '',
        counterparty: row.counterparty ?? '',
        accountId: row.account_id,
        toAccountId: row.to_account_id ?? undefined,
        paymentMethod: row.payment_method,
        notes: row.notes ?? '',
        createdAt: row.created_at || updatedAt,
        updatedAt,
      };
    case 'budgets':
      return {
        id: row.id,
        category: row.category,
        month: row.month,
        limitAmount: Number(row.limit_amount || 0),
        updatedAt,
      };
    case 'savingsGoals':
      return {
        id: row.id,
        title: row.title,
        targetAmount: Number(row.target_amount || 0),
        currentAmount: Number(row.current_amount || 0),
        deadline: row.deadline ?? '',
        notes: row.notes ?? '',
        createdAt: row.created_at || updatedAt,
        updatedAt,
      };
    case 'diaryEntries':
      return {
        id: row.id,
        date: row.date,
        mood: Number(row.mood),
        energy: Number(row.energy),
        performance: Number(row.performance),
        achievements: row.achievements ?? '',
        lessons: row.lessons ?? '',
        problems: row.problems ?? '',
        tomorrowsPlan: row.tomorrows_plan ?? '',
        freeWrite: row.free_write ?? '',
        updatedAt,
      };
    case 'lifeNotes':
      return {
        id: row.id,
        title: row.title,
        content: row.content ?? '',
        category: row.category,
        tags: Array.isArray(row.tags) ? row.tags : [],
        isFavorite: Boolean(row.is_favorite),
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        createdAt: row.created_at || updatedAt,
        updatedAt,
      };
    case 'cyberSkills':
      return {
        id: row.id,
        domain: row.domain,
        category: row.category,
        level: row.level,
        subSkills: Array.isArray(row.sub_skills) ? row.sub_skills : [],
        notes: row.notes ?? '',
        updatedAt,
      };
    case 'cyberLogs':
      return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        platform: row.platform ?? '',
        status: row.status,
        date: row.date,
        difficulty: row.difficulty ?? undefined,
        scoreOrResult: row.score_or_result ?? undefined,
        url: row.url ?? undefined,
        tags: Array.isArray(row.tags) ? row.tags : [],
        writeup: row.writeup ?? '',
        updatedAt,
      };
  }
}

async function pushSingleQueueItem(item: SyncQueueItem): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const localTable = item.tableName as SyncTableName;
  const remoteTable = SUPABASE_TABLE_MAP[localTable];
  if (!remoteTable) {
    await db.syncQueue.update(item.id, { status: 'synced' });
    return true;
  }

  try {
    if (item.operation === 'delete') {
      const { error } = await supabase
        .from(remoteTable)
        .update({ deleted: true, updated_at: item.timestamp })
        .eq('user_id', PERSONAL_OWNER_ID)
        .eq('id', item.recordId);
      if (error) {
        await db.syncQueue.update(item.id, { status: 'error', errorMessage: error.message });
        return false;
      }
    } else {
      const mapped = toRemoteRow(localTable, PERSONAL_OWNER_ID, item.payload, false, item.timestamp);
      const { error } = await supabase
        .from(remoteTable)
        .upsert(mapped, { onConflict: 'user_id,id' });
      if (error) {
        await db.syncQueue.update(item.id, { status: 'error', errorMessage: error.message });
        return false;
      }
    }

    await db.syncQueue.update(item.id, { status: 'synced', errorMessage: undefined });
    await db.profile.update('primary', { lastSyncedAt: new Date().toISOString() });
    return true;
  } catch (err) {
    await db.syncQueue.update(item.id, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Network error',
    });
    return false;
  }
}

// Automatically write every local change directly to Supabase immediately
registerSyncHook((item) => {
  void pushSingleQueueItem(item);
});

export async function runCloudSync(): Promise<SyncReport> {
  const timestamp = new Date().toISOString();

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      state: 'offline',
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      message: 'Offline — changes are saved in IndexedDB and will auto-sync when online.',
      timestamp,
    };
  }

  const ownerId = PERSONAL_OWNER_ID;
  let pushed = 0;
  let pulled = 0;
  let conflicts = 0;

  try {
    // 1. Push pending (and previously errored) offline queue mutations directly to their dedicated PostgreSQL tables
    const pendingItems = await db.syncQueue
      .filter((q) => q.status === 'pending' || q.status === 'error')
      .toArray();

    for (const item of pendingItems) {
      const localTable = item.tableName as SyncTableName;
      const remoteTable = SUPABASE_TABLE_MAP[localTable];
      if (!remoteTable) {
        await db.syncQueue.update(item.id, { status: 'synced' });
        continue;
      }

      const { data: remoteRow, error: fetchErr } = await supabase
        .from(remoteTable)
        .select('*')
        .eq('user_id', ownerId)
        .eq('id', item.recordId)
        .maybeSingle();

      if (fetchErr) {
        await db.syncQueue.update(item.id, { status: 'error', errorMessage: fetchErr.message });
        return {
          state: 'error',
          pushed,
          pulled,
          conflicts,
          message: `Supabase permission error on "${remoteTable}": ${fetchErr.message}`,
          timestamp,
        };
      }

      if (
        remoteRow &&
        new Date(remoteRow.updated_at).getTime() > new Date(item.timestamp).getTime() + 1000 &&
        item.operation === 'upsert'
      ) {
        conflicts++;
        await db.syncQueue.update(item.id, {
          status: 'conflict',
          conflictRemotePayload: fromRemoteRow(localTable, remoteRow),
        });
        continue;
      }

      if (item.operation === 'delete') {
        const { error: delErr } = await supabase
          .from(remoteTable)
          .update({ deleted: true, updated_at: item.timestamp })
          .eq('user_id', ownerId)
          .eq('id', item.recordId);
        if (delErr) {
          await db.syncQueue.update(item.id, { status: 'error', errorMessage: delErr.message });
        } else {
          await db.syncQueue.update(item.id, { status: 'synced' });
          pushed++;
        }
      } else {
        const mapped = toRemoteRow(localTable, ownerId, item.payload, false, item.timestamp);
        const { error: upsertErr } = await supabase
          .from(remoteTable)
          .upsert(mapped, { onConflict: 'user_id,id' });

        if (upsertErr) {
          await db.syncQueue.update(item.id, { status: 'error', errorMessage: upsertErr.message });
        } else {
          await db.syncQueue.update(item.id, { status: 'synced' });
          pushed++;
        }
      }
    }

    // 2. Full bidirectional reconciliation across all 16 dedicated PostgreSQL tables
    for (const localTable of ALL_SYNC_TABLES) {
      const remoteTable = SUPABASE_TABLE_MAP[localTable];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dexieTbl = (db as any)[localTable];
      if (!dexieTbl) continue;

      const { data: remoteRows, error: pullErr } = await supabase
        .from(remoteTable)
        .select('*')
        .eq('user_id', ownerId);

      if (pullErr) {
        return {
          state: 'error',
          pushed,
          pulled,
          conflicts,
          message: `Sync error on "${remoteTable}": ${pullErr.message}`,
          timestamp,
        };
      }

      const remoteMap = new Map<string, Record<string, unknown>>();
      for (const row of remoteRows ?? []) {
        remoteMap.set(String(row.id), row);
        if (row.deleted) {
          const existsLocal = await dexieTbl.get(row.id);
          if (existsLocal) {
            await dexieTbl.delete(row.id);
            pulled++;
          }
          continue;
        }

        const local = await dexieTbl.get(row.id);
        const remoteTs = new Date(row.updated_at).getTime();
        const localTs = local?.updatedAt
          ? new Date(local.updatedAt).getTime()
          : local?.createdAt
          ? new Date(local.createdAt).getTime()
          : 0;

        if (!local || remoteTs > localTs + 500) {
          await dexieTbl.put(fromRemoteRow(localTable, row));
          pulled++;
        }
      }

      // Push any local records not yet present in Supabase (initial device bootstrap!)
      const localRows = await dexieTbl.toArray();
      const missingRemote = localRows.filter((r: { id: string }) => !remoteMap.has(r.id));
      if (missingRemote.length > 0) {
        const batch = missingRemote.map((r: unknown) =>
          toRemoteRow(localTable, ownerId, r, false, timestamp)
        );
        const { error: seedErr } = await supabase
          .from(remoteTable)
          .upsert(batch, { onConflict: 'user_id,id' });
        if (!seedErr) {
          pushed += batch.length;
        } else {
          return {
            state: 'error',
            pushed,
            pulled,
            conflicts,
            message: `Push error on "${remoteTable}": ${seedErr.message}`,
            timestamp,
          };
        }
      }
    }

    await db.profile.update('primary', { lastSyncedAt: timestamp });

    return {
      state: conflicts > 0 ? 'conflict' : 'synced',
      pushed,
      pulled,
      conflicts,
      message:
        conflicts > 0
          ? `Synced 16 tables with ${conflicts} conflict(s) needing review.`
          : `All 16 Supabase tables synced (${pushed} pushed, ${pulled} pulled).`,
      timestamp,
    };
  } catch (err) {
    return {
      state: 'error',
      pushed,
      pulled,
      conflicts,
      message: err instanceof Error ? err.message : 'Unexpected sync failure.',
      timestamp,
    };
  }
}

export async function resolveConflict(queueId: string, strategy: 'keep_local' | 'keep_cloud'): Promise<void> {
  const item = await db.syncQueue.get(queueId);
  if (!item) return;

  if (strategy === 'keep_cloud' && item.conflictRemotePayload) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tbl = (db as any)[item.tableName];
    if (tbl) {
      await tbl.put(item.conflictRemotePayload);
    }
    await db.syncQueue.update(queueId, { status: 'synced', conflictRemotePayload: undefined });
  } else {
    await db.syncQueue.update(queueId, {
      status: 'pending',
      timestamp: new Date().toISOString(),
      conflictRemotePayload: undefined,
    });
    await runCloudSync();
  }
}
