// ============================================================================
// Frozen Domain Contracts — 咩時光 (MeiSchedule)
// Single Source of Truth matching survey_spec_miner_1/handoff.md § 2.3 A
// ============================================================================

export type DesignTheme = 'sky-glass' | 'minimal-linear' | 'warm-journal';
export type ColorMode = 'light' | 'dark' | 'system';
export type ScheduleViewMode = 'day' | '3day' | 'week' | 'month' | 'agenda';
export type CalendarSetId = 'all' | 'personal' | 'work' | 'study' | 'shared';
export type CalendarRole = 'owner' | 'editor' | 'viewer';
export type EventStatus = 'scheduled' | 'completed' | 'canceled';
export type PriorityLevel = 1 | 2 | 3; // 1 = High, 2 = Medium, 3 = Low
export type ColorToken = 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'teal' | 'orange' | 'slate';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'every_n_days';
export type RecurrenceEditScope = 'single' | 'this_and_following' | 'all';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;           // >= 1 (e.g., 1 for weekly, N for every_n_days)
  byWeekday?: number[];       // 0=Sun .. 6=Sat (used when freq === 'weekly')
  byMonthDay?: number;        // 1..31 (optional for freq === 'monthly'; defaults to startAt day)
  until?: string | null;      // Inclusive ISO date 'YYYY-MM-DD' or ISO timestamp
  count?: number | null;      // Maximum total occurrences (mutually exclusive precedence: earliest stop wins)
  exceptions?: string[];      // Excluded occurrence local dates ['YYYY-MM-DD']
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface CalendarMember {
  calendarId: string;
  userId: string;
  displayName: string;
  role: CalendarRole;
  joinedAt: string;           // ISO 8601
}

export interface Calendar {
  id: string;                 // UUID v4
  ownerId: string;            // auth.users UUID or 'local-guest'
  name: string;               // max 80 chars
  description: string;
  colorToken: ColorToken;
  icon: string;               // Lucide kebab-case name (e.g. 'calendar', 'briefcase', 'users')
  calendarSet: Exclude<CalendarSetId, 'all'>; // 'personal' | 'work' | 'study' | 'shared'
  isShared: boolean;
  inviteCode?: string | null; // 6-char uppercase alphanumeric [A-Z2-9] when isShared=true
  visible?: boolean;          // Local UI toggle state (default true)
  members?: CalendarMember[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEvent {
  id: string;                 // UUID v4
  calendarId: string;
  creatorId: string;
  title: string;              // 1..200 chars
  notes: string;
  location: string;
  startAt: string;            // ISO 8601 TIMESTAMPTZ
  endAt: string;              // ISO 8601 TIMESTAMPTZ (must be > startAt)
  allDay: boolean;
  colorToken: ColorToken;
  categoryTag: string;        // max 48 chars, default '一般'
  priority: PriorityLevel;    // 1..3, default 2
  bufferBeforeMin: number;    // >= 0, default 0
  bufferAfterMin: number;     // >= 0, default 0
  isFlexible: boolean;        // true => eligible for SmartReschedule push; false => locked
  status: EventStatus;        // 'scheduled' | 'completed' | 'canceled'
  completedAt?: string | null;
  releasedMinutes?: number;   // Computed/recorded when completed early
  recurrenceRule?: RecurrenceRule | null;
  subtasks: Subtask[];
  reminderMinutes: number[];  // e.g., [15]
  externalUid?: string | null;// RFC 5545 UID / Google Calendar sync key
  createdAt: string;
  updatedAt: string;
}

export interface ExpandedEventInstance extends ScheduleEvent {
  instanceId: string;         // `${masterEventId}::${occurrenceDate}` or `id` for non-recurring
  masterEventId: string;
  occurrenceDate: string;     // Local 'YYYY-MM-DD'
  isRecurringInstance: boolean;
}

export interface ScheduleTask {
  id: string;                 // UUID v4
  userId: string;
  calendarId?: string | null;
  scheduledEventId?: string | null;
  title: string;              // 1..200 chars
  notes: string;
  estimatedMinutes: number;   // default 30, min 15
  priority: PriorityLevel;    // 1..3, default 2
  dueDate?: string | null;    // 'YYYY-MM-DD'
  categoryTag: string;        // default '待辦'
  completed: boolean;
  subtasks: Subtask[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventComment {
  id: string;                 // UUID v4
  eventId: string;
  authorId: string;
  authorName: string;         // max 100 chars
  body: string;               // non-empty sanitized text
  createdAt: string;
}

export interface FocusSession {
  id: string;                 // UUID v4
  userId: string;
  eventId?: string | null;
  taskId?: string | null;
  categoryTag: string;        // default '專注'
  plannedMinutes: number;     // default 25
  actualMinutes: number;      // >= 1
  completed: boolean;
  startedAt: string;
  endedAt: string;
}

export interface UserPreferences {
  userId: string;
  designTheme: DesignTheme;          // default 'sky-glass'
  colorMode: ColorMode;              // default 'system'
  workStartHour: number;             // 0..23, default 9
  workEndHour: number;               // 1..24, default 18 (must be > workStartHour)
  defaultEventMinutes: number;       // 15..240, default 45
  weekStartsOn: 0 | 1;               // 1=Monday (default), 0=Sunday
  activeCalendarSet: CalendarSetId;  // default 'all'
  autoWrapTitles?: boolean;          // default true — wrap full schedule/task titles without ellipsis
  updatedAt: string;
}

export interface ConflictInfo {
  eventIdA: string;
  eventIdB: string;
  overlapStart: string;
  overlapEnd: string;
  overlapMinutes: number;
  conflictType: 'direct' | 'buffer';
}

export interface ScheduleProposal {
  id: string;
  action: 'schedule_task' | 'reschedule_event';
  targetId: string;           // taskId or eventId
  title: string;
  priority: PriorityLevel;
  categoryTag: string;
  isFlexible: boolean;
  originalStartAt: string | null;
  originalEndAt: string | null;
  proposedStartAt: string;
  proposedEndAt: string;
  reason: string;             // Traditional Chinese explanation
  selected: boolean;          // User can toggle individual proposals in Diff Drawer
}

export interface SmartProposalResult {
  proposals: ScheduleProposal[];
  lockedEventIds: string[];
  unscheduledItems: Array<{ id: string; title: string; reason: string }>;
}

export interface ParsedQuickCapture {
  rawInput: string;
  title: string;
  startAt: string;            // ISO 8601
  endAt: string;              // ISO 8601
  durationMinutes: number;
  allDay: boolean;
  categoryTag: string;
  colorToken: ColorToken;
  priority: PriorityLevel;
  isFlexible: boolean;
  recurrenceRule: RecurrenceRule | null;
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
  tokensDetected: Array<{
    kind: 'date' | 'time' | 'duration' | 'tag' | 'recurrence' | 'priority' | 'allDay' | 'flexible';
    label: string;
  }>;
}

export interface SyncQueueItem {
  id: string;
  entity: 'calendars' | 'calendar_members' | 'events' | 'tasks' | 'event_comments' | 'focus_sessions' | 'preferences';
  operation: 'upsert' | 'delete';
  recordId: string;
  payload?: Record<string, unknown>;
  queuedAt: string;
  retryCount: number;
}

export interface HistoryEntry {
  id: string;
  label: string;              // Shown in Undo/Redo Toast (Traditional Chinese)
  timestamp: number;
  before: ScheduleDataSnapshot;
  after: ScheduleDataSnapshot;
}

export interface ScheduleDataSnapshot {
  calendars: Calendar[];
  events: ScheduleEvent[];
  tasks: ScheduleTask[];
  comments: EventComment[];
  focusSessions: FocusSession[];
}

export interface DesktopBridgeApi {
  isElectron: boolean;
  platform: 'darwin' | 'win32' | 'linux' | string;
  sendNativeNotification: (payload: { title: string; body: string; eventId?: string }) => Promise<boolean>;
  toggleTrayWindow: () => Promise<void>;
  getPlatformInfo: () => Promise<{ platform: string; version: string; isPackaged: boolean }>;
  onQuickCaptureTriggered?: (cb: () => void) => () => void;
}

// ============================================================================
// Auxiliary Store / UI / Global Bridge Types
// ============================================================================

export type SyncStatus =
  | 'local-only'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline-queued'
  | 'error';

export interface ToastState {
  id: string;
  message: string;
  icon?: string;
  actionLabel?: string;
  undoEntryId?: string;
  onAction?: () => void;
  isExiting?: boolean;
  durationMs?: number;
  timestamp?: number;
}

export interface ColorTokenStyle {
  token: ColorToken;
  label: string;
  hex: string;
  accentBarClass: string;
  surfaceClass: string;
  borderClass: string;
  badgeClass: string;
  dotClass: string;
}

export interface CalendarSetMeta {
  id: CalendarSetId;
  label: string;
  description: string;
  icon: string;
}

export interface DesignThemeOption {
  id: DesignTheme;
  name: string;
  subtitle: string;
  icon: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
}

export interface MeiStudioSsoGlobal {
  currentMember?: Record<string, unknown> | null;
  getMember?: () => Record<string, unknown> | null;
  getToken?: () => string | null;
  generateToken?: (member?: Record<string, unknown> | null) => Promise<string | null> | string | null;
  verifyToken?: (token: string) =>
    | Promise<{
        valid: boolean;
        payload?: Record<string, unknown> | null;
        member?: Record<string, unknown> | null;
        profile?: Record<string, unknown> | null;
        error?: string | null;
        reason?: string;
      }>
    | {
        valid: boolean;
        payload?: Record<string, unknown> | null;
        member?: Record<string, unknown> | null;
        profile?: Record<string, unknown> | null;
        error?: string | null;
        reason?: string;
      };
  onAuthStateChange?: (cb: (member: Record<string, unknown> | null) => void) => () => void;
  _notify?: (member: Record<string, unknown> | null) => void;
}

export type StudioDockVisibilityMode = 'visible' | 'edge-hidden' | 'completely-hidden';

export interface MeiStudioDockGlobal {
  getMode: () => StudioDockVisibilityMode;
  setMode: (mode: StudioDockVisibilityMode) => StudioDockVisibilityMode;
  show: () => StudioDockVisibilityMode;
  hideToEdge: () => StudioDockVisibilityMode;
  hideCompletely: () => StudioDockVisibilityMode;
  toggle: () => StudioDockVisibilityMode;
  onModeChange: (cb: (mode: StudioDockVisibilityMode) => void) => () => void;
}

declare global {
  interface Window {
    MeiDesktop?: DesktopBridgeApi;
    MeiStudioSSO?: MeiStudioSsoGlobal;
    MeiStudioDock?: MeiStudioDockGlobal;
    __MEI_STUDIO_DOCK_SET_PROJECT__?: (title: string) => void;
    __MEI_STUDIO_DOCK_MOUNTED__?: boolean;
    __TEST_PREFERS_DARK__?: boolean;
  }
}
