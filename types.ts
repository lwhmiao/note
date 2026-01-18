
export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  tag?: string;
}

export interface Note {
  id: string;
  title?: string;
  content: string;
  type: 'inspiration' | 'rambling' | 'journal';
  createdAt: string;
}

export interface DailySummary {
  date: string;
  content: string;
}

// --- Plan Board / Backlog Types ---

export enum Quadrant {
  Q1 = 1, // Important & Urgent
  Q2 = 2, // Important & Not Urgent
  Q3 = 3, // Not Important & Urgent
  Q4 = 4  // Not Important & Not Urgent
}

export type TaskType = 'once' | 'longterm';

export interface BacklogTask {
  id: string;
  title: string;
  quadrant: Quadrant;
  type: TaskType;
  createdAt: string;
}

// --- Health / Body & Mind Station Types ---

export type HealthMode = 'self_care' | 'ttc' | 'pregnancy';

export interface HealthLog {
  date: string; // YYYY-MM-DD
  isPeriodStart?: boolean;
  duration?: number; // Duration in days (e.g. 5)
  isPeriodEnd?: boolean;
  flow?: 'light' | 'medium' | 'heavy';
  flowLevel?: number; // 1-5 scale
  mood?: string; // Emoji
  energy?: number; // 1-10
  symptoms?: string[]; 
  weight?: number;
  sexualActivity?: {
    times: number;
    protection: string; // '无措施', '安全套', '避孕药', etc.
  };
  note?: string;
}

export interface HealthAnalysis {
  cycleLength: number; // Average cycle days
  periodLength: number; // Average period days
  lastPeriodDate: string; // YYYY-MM-DD
  nextPeriodDate: string; // Predicted YYYY-MM-DD
  
  // Dynamic status calculated by AI
  currentPhase: string; // e.g. "高能期", "排卵期", "孕中期"
  dayInPhase: number; // e.g. 5 (5th day of the current phase)
  dayInCycle: number; // e.g. 14 (14th day of total cycle)
  
  // Mode specific
  conceptionChance?: string; // "70%"
  pregnancyWeek?: number;
  pregnancyDay?: number;
  babySize?: string; // "Lemon"
  
  advice: string; // Short advice string
}

export interface HealthState {
  mode: HealthMode;
  logs: HealthLog[];
  analysis: HealthAnalysis;
  // User input for baseline if no logs exist yet
  baseline?: {
    lastPeriodDate: string;
    cycleLength: number;
    periodLength: number;
    dueDate?: string; // For pregnancy
  };
}

export interface AppState {
  tasks: Task[];
  notes: Note[];
  summaries: DailySummary[];
  backlogTasks: BacklogTask[];
  health: HealthState; // New Module
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system' | 'function';
  text?: string;
  image?: string; // Base64 string for user uploaded images
  parts?: any[]; 
  timestamp: number;
  isError?: boolean;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  CALENDAR = 'CALENDAR',
  NOTES = 'NOTES',
  PLAN_BOARD = 'PLAN_BOARD',
  HEALTH = 'HEALTH', // New View
  DAILY_REVIEW = 'DAILY_REVIEW',
  SETTINGS = 'SETTINGS'
}

export interface ApiPreset {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  disableTools?: boolean; // New: Compatibility mode to fix 500 errors
}

export type ThemeId = 'sakura' | 'terracotta' | 'matcha' | 'ocean' | 'dark';

export interface AppSettings {
  // Connection Settings
  activePresetId: string;
  presets: ApiPreset[];

  // Persona
  aiName: string;
  aiPersona: string;
  aiAvatarUrl: string;
  userName: string;
  userPersona: string;
  userAvatarUrl: string;
  historyLimit: number;
  
  // Appearance
  themeId: ThemeId;
  globalBackgroundImageUrl: string;
  fontSize: number; 
  customFontUrl: string;

  // Chat Specific
  chatBackgroundImageUrl: string;
  customCss: string;
}

export const DEFAULT_PRESET: ApiPreset = {
  id: 'default',
  name: 'Google Official',
  apiKey: '',
  baseUrl: '',
  model: 'gemini-1.5-flash',
  disableTools: false
};

export const DEFAULT_SETTINGS: AppSettings = {
  activePresetId: 'default',
  presets: [DEFAULT_PRESET],
  
  aiName: 'LifeOS',
  aiPersona: '你是一个温柔、细心且富有同理心的生活助手。',
  aiAvatarUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png',
  
  userName: '旅行者',
  userPersona: '我是这个数字花园的主人。',
  userAvatarUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
  
  historyLimit: 20,
  
  themeId: 'sakura',
  globalBackgroundImageUrl: '',
  fontSize: 14, 
  customFontUrl: '',
  
  chatBackgroundImageUrl: '',
  customCss: ''
};
