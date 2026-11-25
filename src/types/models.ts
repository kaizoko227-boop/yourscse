export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserProfile {
  id: string; // always 'primary'
  name: string;
  college: string;
  degree: string;
  durationYears: number;
  totalCredits: number;
  currentYear: 1 | 2 | 3 | 4;
  country: string;
  currency: string;
  timezone: string;
  pinHash: string;
  pinSalt: string;
  pinIsDefault: boolean;
  autoLockMinutes: number; // 0 = never
  theme: ThemeMode;
  notificationsEnabled: boolean;
  selectedYear3OptionalId: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  lastSyncedAt?: string;
  updatedAt: string;
}

export interface ModuleTopic {
  id: string;
  title: string;
  completed: boolean;
}

export type ModuleStatus = 'not_started' | 'in_progress' | 'completed';

export interface AcademicModule {
  id: string;
  code: string;
  title: string;
  year: 1 | 2 | 3 | 4;
  semester: number; // 1..8
  semesterEnd?: number; // e.g., 8 for Individual Project spanning Sem 7 & 8
  credits: number;
  isOptionalSlot?: boolean;
  status: ModuleStatus;
  grade: string; // empty until entered
  percentage: number | null; // null until entered
  studyMinutes: number;
  topics: ModuleTopic[];
  notes: string;
  updatedAt: string;
}

export type AssessmentType = 'assignment' | 'exam' | 'lab' | 'presentation';
export type AssessmentStatus = 'upcoming' | 'in_progress' | 'submitted' | 'graded';

export interface AcademicAssessment {
  id: string;
  moduleId: string;
  title: string;
  type: AssessmentType;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string;
  weight: number; // percentage weight
  score: number | null;
  maxScore: number;
  status: AssessmentStatus;
  notes: string;
  updatedAt: string;
}

export interface StudyResource {
  id: string;
  moduleId: string; // 'timetable' for global timetables or module.id
  title: string;
  kind: 'material' | 'timetable' | 'link' | 'syllabus';
  url?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileDataUrl?: string; // base64 data URL stored offline in IndexedDB
  createdAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface PlannerTask {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  priority: TaskPriority;
  category: 'Study' | 'Cyber Lab' | 'Personal' | 'Finance' | 'Health' | 'Career';
  completed: boolean;
  completedAt?: string;
  recurrence: TaskRecurrence;
  reminderTime?: string;
  isTimeBlock: boolean;
  updatedAt: string;
}

export interface RoutineItem {
  id: string;
  title: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  scheduledTime: string;
  completedDates: string[]; // YYYY-MM-DD strings
  createdAt: string;
  updatedAt: string;
}

export interface LifeGoalMilestone {
  id: string;
  title: string;
  done: boolean;
}

export interface LifeGoal {
  id: string;
  targetAge: number;
  title: string;
  category: 'Career' | 'Education' | 'Finance' | 'Health' | 'Personal' | 'Travel';
  description: string;
  milestones: LifeGoalMilestone[];
  status: 'planned' | 'in_progress' | 'achieved';
  createdAt: string;
  updatedAt: string;
}

export interface FocusLap {
  lapNumber: number;
  elapsedMs: number;
  splitMs: number;
}

export interface FocusSession {
  id: string;
  mode: 'pomodoro' | 'custom' | 'stopwatch';
  label: string;
  moduleId?: string;
  durationSeconds: number;
  laps?: FocusLap[];
  date: string; // YYYY-MM-DD
  startedAt: string;
  completedAt: string;
}

export type AccountType = 'cash' | 'bank' | 'esewa' | 'khalti' | 'imepay' | 'savings' | 'other';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'eSewa' | 'Khalti' | 'IME Pay' | 'ConnectIPS' | 'Debit/Credit Card' | 'Other';

export interface FinanceAccount {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency: string;
  color: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  description: string;
  counterparty: string; // source or recipient
  accountId: string;
  toAccountId?: string; // for transfers
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceBudget {
  id: string;
  category: string;
  month: string; // YYYY-MM
  limitAmount: number;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type MoodLevel = 1 | 2 | 3 | 4 | 5; // 1=Very Bad, 2=Bad, 3=Okay, 4=Good, 5=Great

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD (unique per day)
  mood: MoodLevel;
  energy: number; // 1-10
  performance: number; // 1-10
  achievements: string;
  lessons: string;
  problems: string;
  tomorrowsPlan: string;
  freeWrite: string;
  updatedAt: string;
}

export interface NoteAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export type NoteCategory =
  | 'Personal Memories'
  | 'Motivation'
  | 'Ideas'
  | 'Important Events'
  | 'Lessons'
  | 'General';

export interface LifeNote {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  isFavorite: boolean;
  attachments: NoteAttachment[];
  createdAt: string;
  updatedAt: string;
}

export type SkillLevel = 'not_started' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface CyberSubSkill {
  id: string;
  title: string;
  completed: boolean;
}

export interface CyberSkill {
  id: string;
  domain: string;
  category: 'Foundations' | 'Offensive' | 'Defensive' | 'Cloud & AppSec';
  level: SkillLevel;
  subSkills: CyberSubSkill[];
  notes: string;
  updatedAt: string;
}

export interface CyberLog {
  id: string;
  kind: 'lab' | 'ctf' | 'cert' | 'project';
  title: string;
  platform: string; // TryHackMe, HTB, CompTIA, GitHub, etc.
  status: 'planned' | 'in_progress' | 'completed' | 'earned';
  date: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Insane';
  scoreOrResult?: string;
  url?: string;
  tags: string[];
  writeup: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  tableName: string;
  recordId: string;
  operation: 'upsert' | 'delete';
  payload?: unknown;
  timestamp: string;
  status: 'pending' | 'synced' | 'conflict' | 'error';
  conflictRemotePayload?: unknown;
  errorMessage?: string;
}

export type NavSection =
  | 'home'
  | 'study'
  | 'planner'
  | 'finance'
  | 'diary'
  | 'notes'
  | 'cyber'
  | 'focus'
  | 'productivity'
  | 'settings';
