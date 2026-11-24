import type {
  Calendar,
  CalendarSetMeta,
  ColorToken,
  ColorTokenStyle,
  DesignThemeOption,
  EventComment,
  FocusSession,
  ScheduleDataSnapshot,
  ScheduleEvent,
  ScheduleTask,
  UserPreferences
} from '../types/schedule';

// ============================================================================
// Semantic Color Token Palette (8 Tokens — Light & Dark High-Contrast Safe)
// ============================================================================

export const COLOR_TOKEN_PALETTE: Record<ColorToken, ColorTokenStyle> = {
  sky: {
    token: 'sky',
    label: '晴空藍',
    hex: '#38BDF8',
    accentBarClass: 'bg-sky-500 dark:bg-sky-400',
    surfaceClass: 'bg-sky-50/90 dark:bg-sky-950/60 text-sky-950 dark:text-sky-100',
    borderClass: 'border-sky-300/80 dark:border-sky-500/40',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-900/70 dark:text-sky-200',
    dotClass: 'bg-sky-500'
  },
  emerald: {
    token: 'emerald',
    label: '森境綠',
    hex: '#10B981',
    accentBarClass: 'bg-emerald-500 dark:bg-emerald-400',
    surfaceClass: 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100',
    borderClass: 'border-emerald-300/80 dark:border-emerald-500/40',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200',
    dotClass: 'bg-emerald-500'
  },
  amber: {
    token: 'amber',
    label: '暖陽琥珀',
    hex: '#F59E0B',
    accentBarClass: 'bg-amber-500 dark:bg-amber-400',
    surfaceClass: 'bg-amber-50/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100',
    borderClass: 'border-amber-300/80 dark:border-amber-500/40',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200',
    dotClass: 'bg-amber-500'
  },
  violet: {
    token: 'violet',
    label: '星雲紫',
    hex: '#8B5CF6',
    accentBarClass: 'bg-violet-500 dark:bg-violet-400',
    surfaceClass: 'bg-violet-50/90 dark:bg-violet-950/60 text-violet-950 dark:text-violet-100',
    borderClass: 'border-violet-300/80 dark:border-violet-500/40',
    badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-200',
    dotClass: 'bg-violet-500'
  },
  rose: {
    token: 'rose',
    label: '晨曦玫紅',
    hex: '#F43F5E',
    accentBarClass: 'bg-rose-500 dark:bg-rose-400',
    surfaceClass: 'bg-rose-50/90 dark:bg-rose-950/60 text-rose-950 dark:text-rose-100',
    borderClass: 'border-rose-300/80 dark:border-rose-500/40',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/70 dark:text-rose-200',
    dotClass: 'bg-rose-500'
  },
  teal: {
    token: 'teal',
    label: '湖水青',
    hex: '#14B8A6',
    accentBarClass: 'bg-teal-500 dark:bg-teal-400',
    surfaceClass: 'bg-teal-50/90 dark:bg-teal-950/60 text-teal-950 dark:text-teal-100',
    borderClass: 'border-teal-300/80 dark:border-teal-500/40',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/70 dark:text-teal-200',
    dotClass: 'bg-teal-500'
  },
  orange: {
    token: 'orange',
    label: '夕陽橘',
    hex: '#F97316',
    accentBarClass: 'bg-orange-500 dark:bg-orange-400',
    surfaceClass: 'bg-orange-50/90 dark:bg-orange-950/60 text-orange-950 dark:text-orange-100',
    borderClass: 'border-orange-300/80 dark:border-orange-500/40',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/70 dark:text-orange-200',
    dotClass: 'bg-orange-500'
  },
  slate: {
    token: 'slate',
    label: '靜謐石板',
    hex: '#64748B',
    accentBarClass: 'bg-slate-500 dark:bg-slate-400',
    surfaceClass: 'bg-slate-100/90 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100',
    borderClass: 'border-slate-300/80 dark:border-slate-600/50',
    badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
    dotClass: 'bg-slate-500'
  }
};

export const COLOR_TOKEN_LIST: ColorTokenStyle[] = Object.values(COLOR_TOKEN_PALETTE);

// ============================================================================
// Calendar Sets & Design Theme Options Metadata
// ============================================================================

export const CALENDAR_SET_META: CalendarSetMeta[] = [
  { id: 'all', label: '全部行事曆', description: '檢視所有情境與團隊排程', icon: 'layers' },
  { id: 'personal', label: '個人生活', description: '運動、日常習慣與私人事務', icon: 'user' },
  { id: 'work', label: '工作專案', description: '專注開發、會議與交付里程碑', icon: 'briefcase' },
  { id: 'study', label: '學習成長', description: '閱讀筆記、課程與技能精進', icon: 'book-open' },
  { id: 'shared', label: '多人共享', description: '團隊協作日曆與即時行程留言', icon: 'users' }
];

export const DESIGN_THEME_OPTIONS: DesignThemeOption[] = [
  {
    id: 'sky-glass',
    name: '晴空',
    subtitle: '預設承襲咩創意工作室澄澈冰藍質感',
    icon: 'cloud',
    previewBg: '#F4F9FF',
    previewCard: 'rgba(255,255,255,0.84)',
    previewAccent: '#38BDF8'
  },
  {
    id: 'minimal-linear',
    name: '極簡',
    subtitle: '高資訊密度、俐落細線與低飽和專業色塊',
    icon: 'sliders-horizontal',
    previewBg: '#FFFFFF',
    previewCard: '#F8FAFC',
    previewAccent: '#2563EB'
  },
  {
    id: 'warm-journal',
    name: '溫暖',
    subtitle: '象牙紙感、圓潤膠囊與柔和琥珀光影',
    icon: 'book-open',
    previewBg: '#FAF6F0',
    previewCard: '#FFFDF9',
    previewAccent: '#D97706'
  }
];

// ============================================================================
// Deterministic Seed UUID Constants
// ============================================================================

export const SEED_CAL_WORK = '10000000-0000-4000-8000-000000000001';
export const SEED_CAL_PERSONAL = '10000000-0000-4000-8000-000000000002';
export const SEED_CAL_STUDY = '10000000-0000-4000-8000-000000000003';
export const SEED_CAL_SHARED = '10000000-0000-4000-8000-000000000004';

export const SEED_EVT_STANDUP = '20000000-0000-4000-8000-000000000001';
export const SEED_EVT_DEEP_WORK = '20000000-0000-4000-8000-000000000002';
export const SEED_EVT_SHARED_REVIEW = '20000000-0000-4000-8000-000000000003';
export const SEED_EVT_STUDY = '20000000-0000-4000-8000-000000000004';
export const SEED_EVT_WORKOUT = '20000000-0000-4000-8000-000000000005';
export const SEED_EVT_ALL_DAY = '20000000-0000-4000-8000-000000000006';
export const SEED_EVT_TOMORROW_MEETING = '20000000-0000-4000-8000-000000000007';

// ============================================================================
// Local-Date Anchoring Helpers
// ============================================================================

function pad2(num: number): string {
  return String(num).padStart(2, '0');
}

export function formatLocalDate(baseDate: Date, dayOffset = 0): string {
  const target = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + dayOffset
  );
  return `${target.getFullYear()}-${pad2(target.getMonth() + 1)}-${pad2(target.getDate())}`;
}

export function atLocalTime(
  baseDate: Date,
  dayOffset: number,
  hour: number,
  minute: number
): string {
  const target = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + dayOffset,
    hour,
    minute,
    0,
    0
  );
  return target.toISOString();
}

export function createDefaultPreferences(userId = 'local-guest'): UserPreferences {
  return {
    userId,
    designTheme: 'sky-glass',
    colorMode: 'system',
    workStartHour: 9,
    workEndHour: 18,
    defaultEventMinutes: 45,
    weekStartsOn: 1,
    activeCalendarSet: 'all',
    updatedAt: new Date().toISOString()
  };
}

/**
 * Generates first-run Traditional Chinese demo schedule anchored to today
 * Zero Unicode Emoji, valid RFC 4122 UUID v4 identifiers
 */
export function createSeedScheduleData(
  referenceDate: Date = new Date(),
  ownerId = 'local-guest'
): { snapshot: ScheduleDataSnapshot; preferences: UserPreferences } {
  const nowIso = referenceDate.toISOString();
  const todayStr = formatLocalDate(referenceDate, 0);
  const tomorrowStr = formatLocalDate(referenceDate, 1);
  const plus2Str = formatLocalDate(referenceDate, 2);
  const plus3Str = formatLocalDate(referenceDate, 3);

  const calendars: Calendar[] = [
    {
      id: SEED_CAL_WORK,
      ownerId,
      name: '產品與工作',
      description: '專案開發、核心評審與每日深度專注時間塊',
      colorToken: 'sky',
      icon: 'briefcase',
      calendarSet: 'work',
      isShared: false,
      inviteCode: null,
      visible: true,
      members: [
        {
          calendarId: SEED_CAL_WORK,
          userId: ownerId,
          displayName: '我 (本機使用者)',
          role: 'owner',
          joinedAt: nowIso
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_CAL_PERSONAL,
      ownerId,
      name: '個人生活',
      description: '運動習慣、居家採買與生活節奏安排',
      colorToken: 'emerald',
      icon: 'calendar',
      calendarSet: 'personal',
      isShared: false,
      inviteCode: null,
      visible: true,
      members: [
        {
          calendarId: SEED_CAL_PERSONAL,
          userId: ownerId,
          displayName: '我 (本機使用者)',
          role: 'owner',
          joinedAt: nowIso
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_CAL_STUDY,
      ownerId,
      name: '深度學習',
      description: '系統架構閱讀、語言學習與知識整理',
      colorToken: 'amber',
      icon: 'book-open',
      calendarSet: 'study',
      isShared: false,
      inviteCode: null,
      visible: true,
      members: [
        {
          calendarId: SEED_CAL_STUDY,
          userId: ownerId,
          displayName: '我 (本機使用者)',
          role: 'owner',
          joinedAt: nowIso
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_CAL_SHARED,
      ownerId,
      name: '咩創協作團隊',
      description: '跨平台產品協作與多人即時行程留言共享日曆',
      colorToken: 'violet',
      icon: 'users',
      calendarSet: 'shared',
      isShared: true,
      inviteCode: 'MEI248',
      visible: true,
      members: [
        {
          calendarId: SEED_CAL_SHARED,
          userId: ownerId,
          displayName: '我 (擁有者)',
          role: 'owner',
          joinedAt: nowIso
        },
        {
          calendarId: SEED_CAL_SHARED,
          userId: 'demo-editor-lin',
          displayName: '林小語',
          role: 'editor',
          joinedAt: nowIso
        },
        {
          calendarId: SEED_CAL_SHARED,
          userId: 'demo-viewer-chen',
          displayName: '陳宇航',
          role: 'viewer',
          joinedAt: nowIso
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];

  const events: ScheduleEvent[] = [
    {
      id: SEED_EVT_STANDUP,
      calendarId: SEED_CAL_WORK,
      creatorId: ownerId,
      title: '每日站會與重點同步',
      notes: '快速同步今日三大目標與跨平台進度阻礙。',
      location: '咩創線上會議室',
      startAt: atLocalTime(referenceDate, 0, 9, 30),
      endAt: atLocalTime(referenceDate, 0, 10, 0),
      allDay: false,
      colorToken: 'sky',
      categoryTag: '工作',
      priority: 1,
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
      isFlexible: false,
      status: 'scheduled',
      completedAt: null,
      recurrenceRule: {
        freq: 'weekly',
        interval: 1,
        byWeekday: [1, 2, 3, 4, 5]
      },
      subtasks: [
        { id: 'sub-standup-1', title: '彙整昨日交付項目', done: true },
        { id: 'sub-standup-2', title: '確認今日高優先排程', done: false }
      ],
      reminderMinutes: [15],
      externalUid: 'mei-seed-standup@meischedule.app',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_EVT_DEEP_WORK,
      calendarId: SEED_CAL_WORK,
      creatorId: ownerId,
      title: '介面原型設計與時間軸打磨',
      notes: '專注微調時間塊視覺層次與行動端響應式手感。',
      location: '工作室專注區',
      startAt: atLocalTime(referenceDate, 0, 10, 30),
      endAt: atLocalTime(referenceDate, 0, 12, 0),
      allDay: false,
      colorToken: 'sky',
      categoryTag: '工作',
      priority: 1,
      bufferBeforeMin: 10,
      bufferAfterMin: 10,
      isFlexible: true,
      status: 'scheduled',
      completedAt: null,
      recurrenceRule: null,
      subtasks: [
        { id: 'sub-deep-1', title: '整理多比例行動端間距', done: true },
        { id: 'sub-deep-2', title: '檢查三套主題深色對比度', done: false },
        { id: 'sub-deep-3', title: '優化拖曳吸附手感', done: false }
      ],
      reminderMinutes: [15],
      externalUid: 'mei-seed-deepwork@meischedule.app',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_EVT_SHARED_REVIEW,
      calendarId: SEED_CAL_SHARED,
      creatorId: ownerId,
      title: '咩創跨平台設計評審會',
      notes: '與設計與工程夥伴確認五端互動細節與發布排程。',
      location: '咩創線上會議室 A',
      startAt: atLocalTime(referenceDate, 0, 14, 0),
      endAt: atLocalTime(referenceDate, 0, 15, 0),
      allDay: false,
      colorToken: 'violet',
      categoryTag: '共享',
      priority: 1,
      bufferBeforeMin: 5,
      bufferAfterMin: 10,
      isFlexible: false,
      status: 'scheduled',
      completedAt: null,
      recurrenceRule: null,
      subtasks: [],
      reminderMinutes: [15],
      externalUid: 'mei-seed-review@meischedule.app',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_EVT_STUDY,
      calendarId: SEED_CAL_STUDY,
      creatorId: ownerId,
      title: '系統架構閱讀與筆記整理',
      notes: '閱讀離線優先架構與 IndexedDB 雙向同步案例。',
      location: '書房',
      startAt: atLocalTime(referenceDate, 0, 15, 30),
      endAt: atLocalTime(referenceDate, 0, 16, 30),
      allDay: false,
      colorToken: 'amber',
      categoryTag: '學習',
      priority: 2,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      isFlexible: true,
      status: 'scheduled',
      completedAt: null,
      recurrenceRule: null,
      subtasks: [
        { id: 'sub-study-1', title: '研讀離線優先同步設計', done: false },
        { id: 'sub-study-2', title: '整理效能優化要點', done: false }
      ],
      reminderMinutes: [10],
      externalUid: 'mei-seed-study@meischedule.app',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_EVT_WORKOUT,
      calendarId: SEED_CAL_PERSONAL,
      creatorId: ownerId,
      title: '傍晚核心伸展與慢跑',
      notes: '維持體能節奏，每兩日進行 60 分鐘有氧與伸展。',
      location: '河濱步道',
      startAt: atLocalTime(referenceDate, 0, 18, 30),
      endAt: atLocalTime(referenceDate, 0, 19, 30),
      allDay: false,
      colorToken: 'emerald',
      categoryTag: '個人',
      priority: 3,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      isFlexible: true,
      status: 'scheduled',
      completedAt: null,
      recurrenceRule: {
        freq: 'every_n_days',
        interval: 2
      },
      subtasks: [],
      reminderMinutes: [15],
      externalUid: 'mei-seed-workout@meischedule.app',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_EVT_ALL_DAY,
      calendarId: SEED_CAL_WORK,
      creatorId: ownerId,
      title: '咩時光版本發布準備日',
      notes: '全天檢視五端打包與大廳整合里程碑。',
      location: '',
      startAt: atLocalTime(referenceDate, 0, 0, 0),
      endAt: atLocalTime(referenceDate, 0, 23, 59),
      allDay: true,
      colorToken: 'teal',
      categoryTag: '工作',
      priority: 2,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      isFlexible: false,
      status: 'scheduled',
      completedAt: null,
      recurrenceRule: null,
      subtasks: [],
      reminderMinutes: [],
      externalUid: 'mei-seed-allday@meischedule.app',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: SEED_EVT_TOMORROW_MEETING,
      calendarId: SEED_CAL_SHARED,
      creatorId: ownerId,
      title: '客戶需求對齊與排程檢視',
      notes: '確認下一階段產品里程碑與回饋優先順序。',
      location: '台北信義共享會議室',
      startAt: atLocalTime(referenceDate, 1, 11, 0),
      endAt: atLocalTime(referenceDate, 1, 12, 0),
      allDay: false,
      colorToken: 'rose',
      categoryTag: '共享',
      priority: 1,
      bufferBeforeMin: 10,
      bufferAfterMin: 10,
      isFlexible: false,
      status: 'scheduled',
      completedAt: null,
      recurrenceRule: null,
      subtasks: [],
      reminderMinutes: [15],
      externalUid: 'mei-seed-tomorrow@meischedule.app',
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];

  const tasks: ScheduleTask[] = [
    {
      id: '30000000-0000-4000-8000-000000000001',
      userId: ownerId,
      calendarId: SEED_CAL_WORK,
      scheduledEventId: null,
      title: '整理跨五端發布檢核清單',
      notes: '核對 Web、macOS、Windows、iOS 與 Android 建置腳本。',
      estimatedMinutes: 45,
      priority: 1,
      dueDate: todayStr,
      categoryTag: '工作',
      completed: false,
      subtasks: [
        { id: 'sub-task-1', title: '核對 PWA 離線快取策略', done: false },
        { id: 'sub-task-2', title: '確認桌面系統匣快捷鍵設定', done: false }
      ],
      sortOrder: 0,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: '30000000-0000-4000-8000-000000000002',
      userId: ownerId,
      calendarId: SEED_CAL_WORK,
      scheduledEventId: null,
      title: '回覆設計回饋並調整月總覽字距',
      notes: '確保窄屏手機月曆事件條仍能清楚閱讀標題。',
      estimatedMinutes: 30,
      priority: 2,
      dueDate: tomorrowStr,
      categoryTag: '工作',
      completed: false,
      subtasks: [],
      sortOrder: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: '30000000-0000-4000-8000-000000000003',
      userId: ownerId,
      calendarId: SEED_CAL_STUDY,
      scheduledEventId: null,
      title: '完成日文聽力練習與單字複習',
      notes: '跟讀新聞音檔並整理核心文法筆記。',
      estimatedMinutes: 30,
      priority: 2,
      dueDate: plus2Str,
      categoryTag: '學習',
      completed: false,
      subtasks: [],
      sortOrder: 2,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: '30000000-0000-4000-8000-000000000004',
      userId: ownerId,
      calendarId: SEED_CAL_PERSONAL,
      scheduledEventId: null,
      title: '採買週末居家食材與咖啡豆',
      notes: '補齊燕麥奶、中淺焙手沖豆與新鮮蔬果。',
      estimatedMinutes: 30,
      priority: 3,
      dueDate: plus3Str,
      categoryTag: '個人',
      completed: false,
      subtasks: [],
      sortOrder: 3,
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];

  const comments: EventComment[] = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      eventId: SEED_EVT_SHARED_REVIEW,
      authorId: 'demo-editor-lin',
      authorName: '林小語',
      body: '已將最新的手機版月總覽截圖與三套風格色票上傳，下午會議可直接對照檢視。',
      createdAt: atLocalTime(referenceDate, 0, 10, 15)
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      eventId: SEED_EVT_SHARED_REVIEW,
      authorId: 'demo-viewer-chen',
      authorName: '陳宇航',
      body: '收到，我也補充了電腦版系統匣迷你視窗的操作動線建議，準時上線討論。',
      createdAt: atLocalTime(referenceDate, 0, 11, 20)
    }
  ];

  const focusSessions: FocusSession[] = [
    {
      id: '50000000-0000-4000-8000-000000000001',
      userId: ownerId,
      eventId: SEED_EVT_DEEP_WORK,
      taskId: null,
      categoryTag: '工作',
      plannedMinutes: 25,
      actualMinutes: 25,
      completed: true,
      startedAt: atLocalTime(referenceDate, 0, 8, 30),
      endedAt: atLocalTime(referenceDate, 0, 8, 55)
    },
    {
      id: '50000000-0000-4000-8000-000000000002',
      userId: ownerId,
      eventId: SEED_EVT_DEEP_WORK,
      taskId: null,
      categoryTag: '工作',
      plannedMinutes: 25,
      actualMinutes: 25,
      completed: true,
      startedAt: atLocalTime(referenceDate, 0, 10, 35),
      endedAt: atLocalTime(referenceDate, 0, 11, 0)
    },
    {
      id: '50000000-0000-4000-8000-000000000003',
      userId: ownerId,
      eventId: null,
      taskId: null,
      categoryTag: '學習',
      plannedMinutes: 50,
      actualMinutes: 50,
      completed: true,
      startedAt: atLocalTime(referenceDate, -1, 14, 0),
      endedAt: atLocalTime(referenceDate, -1, 14, 50)
    },
    {
      id: '50000000-0000-4000-8000-000000000004',
      userId: ownerId,
      eventId: null,
      taskId: null,
      categoryTag: '個人',
      plannedMinutes: 25,
      actualMinutes: 25,
      completed: true,
      startedAt: atLocalTime(referenceDate, -1, 19, 0),
      endedAt: atLocalTime(referenceDate, -1, 19, 25)
    }
  ];

  return {
    snapshot: {
      calendars,
      events,
      tasks,
      comments,
      focusSessions
    },
    preferences: createDefaultPreferences(ownerId)
  };
}
