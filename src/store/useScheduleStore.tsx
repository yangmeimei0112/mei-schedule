import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react';
import {
  COLOR_MODE_TRANSITION_MS,
  THEME_BOOT_STORAGE_KEY,
  THEME_TRANSITION_MS
} from '../services/preloadEngine';
import type {
  Calendar,
  CalendarRole,
  CalendarSetId,
  EventComment,
  FocusSession,
  HistoryEntry,
  ScheduleDataSnapshot,
  ScheduleEvent,
  ScheduleProposal,
  ScheduleTask,
  ScheduleViewMode,
  SyncQueueItem,
  SyncStatus,
  ToastState,
  UserPreferences
} from '../types/schedule';
import {
  createDefaultPreferences,
  createSeedScheduleData,
  formatLocalDate
} from '../data/seedData';
import * as localStore from '../services/localStore';
import {
  initAuthListener,
  isValidUuid,
  loadCurrentMember,
  sanitizeInputText,
  type MemberProfile
} from '../services/memberAuthService';
import {
  calendarMemberToRow,
  calendarToRow,
  commentToRow,
  eventToRow,
  flushSyncQueue,
  focusSessionToRow,
  generateUuidV4,
  joinSharedCalendarRemote,
  mergeLocalAndCloudOnSignIn,
  preferencesToRow,
  subscribeScheduleRealtime,
  taskToRow
} from '../services/scheduleSyncService';

// ============================================================================
// Constants & Types
// ============================================================================

export const MAX_HISTORY_DEPTH = 50;

export type ActiveModalType =
  | null
  | 'member'
  | 'appearance'
  | 'focus'
  | 'analytics'
  | 'smart'
  | 'shared'
  | 'sync'
  | 'command'
  | 'event-create';

export interface ShowToastOptions {
  icon?: string;
  actionLabel?: string;
  undoEntryId?: string;
  onAction?: () => void;
  durationMs?: number;
}

export interface ScheduleStoreState {
  hydrated: boolean;
  currentMember: MemberProfile | null;
  syncStatus: SyncStatus;
  syncStatusMessage: string;
  lastSyncedAt: string | null;
  syncQueue: SyncQueueItem[];
  present: ScheduleDataSnapshot;
  preferences: UserPreferences;
  resolvedColorMode: 'light' | 'dark';
  past: HistoryEntry[];
  future: HistoryEntry[];
  viewMode: ScheduleViewMode;
  selectedDate: string;
  selectedEventId: string | null;
  selectedInstanceDate: string | null;
  searchQuery: string;
  sidebarOpen: boolean;
  inboxDrawerOpen: boolean;
  activeModal: ActiveModalType;
  focusTargetEventId: string | null;
  focusTargetTaskId: string | null;
  toast: ToastState | null;
}

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

function resolveSystemColorMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
      return 'dark';
    }
  } catch {
    // Fallback to light
  }
  return 'light';
}

function computeResolvedColorMode(mode: UserPreferences['colorMode']): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return resolveSystemColorMode();
}

function readCachedBootTheme(): {
  designTheme?: UserPreferences['designTheme'];
  colorMode?: UserPreferences['colorMode'];
} {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage?.getItem(THEME_BOOT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      designTheme?: string;
      colorMode?: string;
    };
    const validThemes: Array<UserPreferences['designTheme']> = [
      'sky-glass',
      'minimal-linear',
      'warm-journal'
    ];
    const validModes: Array<UserPreferences['colorMode']> = ['system', 'light', 'dark'];
    return {
      designTheme: validThemes.includes(parsed.designTheme as UserPreferences['designTheme'])
        ? (parsed.designTheme as UserPreferences['designTheme'])
        : undefined,
      colorMode: validModes.includes(parsed.colorMode as UserPreferences['colorMode'])
        ? (parsed.colorMode as UserPreferences['colorMode'])
        : undefined
    };
  } catch {
    return {};
  }
}

function buildInitialState(): ScheduleStoreState {
  const seed = createSeedScheduleData(new Date(), 'local-guest');
  const cachedTheme = readCachedBootTheme();
  const initialPreferences: UserPreferences = {
    ...seed.preferences,
    ...(cachedTheme.designTheme ? { designTheme: cachedTheme.designTheme } : {}),
    ...(cachedTheme.colorMode ? { colorMode: cachedTheme.colorMode } : {})
  };
  const member = loadCurrentMember();
  const isDesktopViewport =
    typeof window === 'undefined' ? true : window.innerWidth >= 1024;
  return {
    hydrated: false,
    currentMember: member,
    syncStatus: 'local-only',
    syncStatusMessage: '本機離線優先模式',
    lastSyncedAt: null,
    syncQueue: [],
    present: seed.snapshot,
    preferences: initialPreferences,
    resolvedColorMode: computeResolvedColorMode(initialPreferences.colorMode),
    past: [],
    future: [],
    viewMode: 'day',
    selectedDate: formatLocalDate(new Date(), 0),
    selectedEventId: null,
    selectedInstanceDate: null,
    searchQuery: '',
    sidebarOpen: isDesktopViewport,
    inboxDrawerOpen: false,
    activeModal: null,
    focusTargetEventId: null,
    focusTargetTaskId: null,
    toast: null
  };
}

// ============================================================================
// Reducer Actions
// ============================================================================

type Action =
  | {
      type: 'HYDRATE';
      snapshot: ScheduleDataSnapshot;
      preferences: UserPreferences;
      syncQueue: SyncQueueItem[];
      lastSyncedAt: string | null;
    }
  | {
      type: 'COMMIT_SNAPSHOT';
      entryId: string;
      label: string;
      timestamp: number;
      nextSnapshot: ScheduleDataSnapshot;
    }
  | {
      type: 'REPLACE_SNAPSHOT_SILENT';
      snapshot: ScheduleDataSnapshot;
      preferences?: UserPreferences;
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_PREFERENCES'; preferences: UserPreferences }
  | { type: 'SET_RESOLVED_COLOR_MODE'; mode: 'light' | 'dark' }
  | { type: 'SET_MEMBER'; member: MemberProfile | null }
  | {
      type: 'SET_SYNC_STATE';
      syncStatus: SyncStatus;
      syncStatusMessage?: string;
      lastSyncedAt?: string | null;
      syncQueue?: SyncQueueItem[];
    }
  | { type: 'SET_VIEW_MODE'; viewMode: ScheduleViewMode }
  | { type: 'SET_SELECTED_DATE'; date: string }
  | { type: 'SELECT_EVENT'; eventId: string | null; instanceDate?: string | null }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SIDEBAR_OPEN'; open: boolean }
  | { type: 'SET_INBOX_DRAWER_OPEN'; open: boolean }
  | {
      type: 'OPEN_MODAL';
      modal: ActiveModalType;
      focusTargetEventId?: string | null;
      focusTargetTaskId?: string | null;
    }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_TOAST'; toast: ToastState | null }
  | { type: 'MARK_TOAST_EXITING' }
  | { type: 'REMOTE_EVENT_UPSERT'; event: ScheduleEvent }
  | { type: 'REMOTE_EVENT_DELETE'; eventId: string }
  | { type: 'REMOTE_COMMENT_UPSERT'; comment: EventComment }
  | { type: 'REMOTE_COMMENT_DELETE'; commentId: string };

function scheduleReducer(state: ScheduleStoreState, action: Action): ScheduleStoreState {
  switch (action.type) {
    case 'HYDRATE': {
      return {
        ...state,
        hydrated: true,
        present: action.snapshot,
        preferences: action.preferences,
        resolvedColorMode: computeResolvedColorMode(action.preferences.colorMode),
        syncQueue: action.syncQueue,
        lastSyncedAt: action.lastSyncedAt
      };
    }

    case 'COMMIT_SNAPSHOT': {
      const entry: HistoryEntry = {
        id: action.entryId,
        label: action.label,
        timestamp: action.timestamp,
        before: state.present,
        after: action.nextSnapshot
      };
      const nextPast = [...state.past, entry].slice(-MAX_HISTORY_DEPTH);
      return {
        ...state,
        present: action.nextSnapshot,
        past: nextPast,
        future: []
      };
    }

    case 'REPLACE_SNAPSHOT_SILENT': {
      const nextPrefs = action.preferences ?? state.preferences;
      return {
        ...state,
        present: action.snapshot,
        preferences: nextPrefs,
        resolvedColorMode: computeResolvedColorMode(nextPrefs.colorMode)
      };
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const top = state.past[state.past.length - 1];
      return {
        ...state,
        present: top.before,
        past: state.past.slice(0, -1),
        future: [top, ...state.future].slice(0, MAX_HISTORY_DEPTH)
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const [nextEntry, ...restFuture] = state.future;
      return {
        ...state,
        present: nextEntry.after,
        past: [...state.past, nextEntry].slice(-MAX_HISTORY_DEPTH),
        future: restFuture
      };
    }

    case 'SET_PREFERENCES': {
      return {
        ...state,
        preferences: action.preferences,
        resolvedColorMode: computeResolvedColorMode(action.preferences.colorMode)
      };
    }

    case 'SET_RESOLVED_COLOR_MODE': {
      return { ...state, resolvedColorMode: action.mode };
    }

    case 'SET_MEMBER': {
      return { ...state, currentMember: action.member };
    }

    case 'SET_SYNC_STATE': {
      return {
        ...state,
        syncStatus: action.syncStatus,
        syncStatusMessage: action.syncStatusMessage ?? state.syncStatusMessage,
        lastSyncedAt: action.lastSyncedAt !== undefined ? action.lastSyncedAt : state.lastSyncedAt,
        syncQueue: action.syncQueue !== undefined ? action.syncQueue : state.syncQueue
      };
    }

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.viewMode };

    case 'SET_SELECTED_DATE':
      return { ...state, selectedDate: action.date };

    case 'SELECT_EVENT':
      return {
        ...state,
        selectedEventId: action.eventId,
        selectedInstanceDate: action.instanceDate ?? null
      };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.open };

    case 'SET_INBOX_DRAWER_OPEN':
      return { ...state, inboxDrawerOpen: action.open };

    case 'OPEN_MODAL':
      return {
        ...state,
        activeModal: action.modal,
        focusTargetEventId:
          action.focusTargetEventId !== undefined ? action.focusTargetEventId : state.focusTargetEventId,
        focusTargetTaskId:
          action.focusTargetTaskId !== undefined ? action.focusTargetTaskId : state.focusTargetTaskId
      };

    case 'CLOSE_MODAL':
      return { ...state, activeModal: null };

    case 'SET_TOAST':
      return { ...state, toast: action.toast };

    case 'MARK_TOAST_EXITING':
      if (!state.toast) return state;
      return { ...state, toast: { ...state.toast, isExiting: true } };

    case 'REMOTE_EVENT_UPSERT': {
      const exists = state.present.events.some((e) => e.id === action.event.id);
      const nextEvents = exists
        ? state.present.events.map((e) => (e.id === action.event.id ? action.event : e))
        : [...state.present.events, action.event];
      return {
        ...state,
        present: { ...state.present, events: nextEvents }
      };
    }

    case 'REMOTE_EVENT_DELETE': {
      return {
        ...state,
        present: {
          ...state.present,
          events: state.present.events.filter((e) => e.id !== action.eventId)
        }
      };
    }

    case 'REMOTE_COMMENT_UPSERT': {
      const exists = state.present.comments.some((c) => c.id === action.comment.id);
      const nextComments = exists
        ? state.present.comments.map((c) => (c.id === action.comment.id ? action.comment : c))
        : [...state.present.comments, action.comment];
      nextComments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        ...state,
        present: { ...state.present, comments: nextComments }
      };
    }

    case 'REMOTE_COMMENT_DELETE': {
      return {
        ...state,
        present: {
          ...state.present,
          comments: state.present.comments.filter((c) => c.id !== action.commentId)
        }
      };
    }

    default:
      return state;
  }
}

// ============================================================================
// Context Interface
// ============================================================================

export interface ScheduleStoreContextValue {
  state: ScheduleStoreState;
  // Direct convenience aliases
  hydrated: boolean;
  currentMember: MemberProfile | null;
  syncStatus: SyncStatus;
  syncStatusMessage: string;
  lastSyncedAt: string | null;
  calendars: Calendar[];
  events: ScheduleEvent[];
  tasks: ScheduleTask[];
  comments: EventComment[];
  focusSessions: FocusSession[];
  preferences: UserPreferences;
  resolvedColorMode: 'light' | 'dark';
  viewMode: ScheduleViewMode;
  selectedDate: string;
  selectedEventId: string | null;
  selectedInstanceDate: string | null;
  searchQuery: string;
  sidebarOpen: boolean;
  inboxDrawerOpen: boolean;
  activeModal: ActiveModalType;
  focusTargetEventId: string | null;
  focusTargetTaskId: string | null;
  toast: ToastState | null;
  canUndo: boolean;
  canRedo: boolean;
  historyDepth: number;

  // Event CRUD & Workflows
  createEvent: (input: Partial<ScheduleEvent> & { title: string; startAt: string; endAt: string }) => ScheduleEvent;
  updateEvent: (eventId: string, updates: Partial<ScheduleEvent>, historyLabel?: string) => void;
  moveOrResizeEvent: (eventId: string, startAt: string, endAt: string) => void;
  deleteEvent: (eventId: string) => void;
  replaceEventsAtomic: (nextEvents: ScheduleEvent[], historyLabel: string) => string;
  toggleEventSubtask: (eventId: string, subtaskId: string) => void;
  completeEventEarly: (eventId: string, now?: Date) => { releasedMinutes: number; entryId: string | null };
  toggleEventComplete: (eventId: string, now?: Date) => void;

  // Smart Scheduler Atomic Commit
  applySmartProposals: (proposals: ScheduleProposal[]) => { appliedCount: number; entryId: string | null };

  // Task Inbox CRUD
  createTask: (input: Partial<ScheduleTask> & { title: string }) => ScheduleTask;
  updateTask: (taskId: string, updates: Partial<ScheduleTask>) => void;
  toggleTaskComplete: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  scheduleTaskToTimeBlock: (
    taskId: string,
    startAt: string,
    endAt?: string,
    calendarId?: string
  ) => ScheduleEvent | null;

  // Calendars & Shared Collaboration
  createCalendar: (input: Partial<Calendar> & { name: string }) => Calendar;
  updateCalendar: (calendarId: string, updates: Partial<Calendar>) => void;
  deleteCalendar: (calendarId: string) => boolean;
  toggleCalendarVisibility: (calendarId: string) => void;
  setActiveCalendarSet: (setId: CalendarSetId) => void;
  joinSharedCalendar: (inviteCode: string) => Promise<{ success: boolean; calendar?: Calendar; error?: string }>;
  updateCalendarMemberRole: (calendarId: string, userId: string, role: CalendarRole) => void;
  removeCalendarMember: (calendarId: string, userId: string) => boolean;
  getCurrentUserRoleForCalendar: (calendarId: string) => CalendarRole;

  // Comments & Focus Sessions
  addEventComment: (eventId: string, body: string) => EventComment | null;
  deleteEventComment: (commentId: string) => void;
  recordFocusSession: (input: Omit<FocusSession, 'id' | 'userId'>) => FocusSession;

  // Preferences, History, Auth, Navigation & Toast
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  undo: (expectedEntryId?: string) => boolean;
  redo: () => boolean;
  setCurrentMember: (member: MemberProfile | null) => void;
  triggerCloudSync: () => Promise<void>;
  setViewMode: (mode: ScheduleViewMode) => void;
  setSelectedDate: (dateStr: string) => void;
  goToToday: () => void;
  navigateDate: (deltaDays: number) => void;
  selectEvent: (eventId: string | null, instanceDate?: string | null) => void;
  setSearchQuery: (q: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setInboxDrawerOpen: (open: boolean) => void;
  openModal: (
    modal: ActiveModalType,
    ctx?: { focusTargetEventId?: string | null; focusTargetTaskId?: string | null }
  ) => void;
  closeModal: () => void;
  showToast: (
    message: string,
    iconOrOptions?: string | ShowToastOptions,
    options?: ShowToastOptions
  ) => void;
  dismissToast: () => void;
}

export interface ThemeTransitionPayload {
  key: number;
  kind: 'theme' | 'color-mode';
  targetMode: 'light' | 'dark';
}

interface ToastContextValue {
  toast: ToastState | null;
  dismissToast: () => void;
}

const ScheduleStoreContext = createContext<ScheduleStoreContextValue | null>(null);
const ToastStateContext = createContext<ToastContextValue>({
  toast: null,
  dismissToast: () => {}
});
const ThemeTransitionContext = createContext<ThemeTransitionPayload | null>(null);

// ============================================================================
// Provider Implementation
// ============================================================================

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(scheduleReducer, undefined, buildInitialState);
  const stateRef = useRef<ScheduleStoreState>(state);
  stateRef.current = state;
  const mutatedBeforeHydrateRef = useRef(false);

  // Isolated Toast & Theme Transition states prevent full-tree re-renders
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [themeTransition, setThemeTransition] = useState<ThemeTransitionPayload | null>(null);

  const dispatch = useCallback((action: Action) => {
    if (
      !stateRef.current.hydrated &&
      (action.type === 'COMMIT_SNAPSHOT' || action.type === 'REPLACE_SNAPSHOT_SILENT')
    ) {
      mutatedBeforeHydrateRef.current = true;
    }
    stateRef.current = scheduleReducer(stateRef.current, action);
    rawDispatch(action);
  }, []);

  const toastTimersRef = useRef<{ stay?: ReturnType<typeof setTimeout>; exit?: ReturnType<typeof setTimeout> }>({});

  const clearToastTimers = useCallback(() => {
    if (toastTimersRef.current.stay) clearTimeout(toastTimersRef.current.stay);
    if (toastTimersRef.current.exit) clearTimeout(toastTimersRef.current.exit);
    toastTimersRef.current = {};
  }, []);

  const dismissToast = useCallback(() => {
    clearToastTimers();
    setToastState(null);
  }, [clearToastTimers]);

  const showToast = useCallback(
    (
      message: string,
      iconOrOptions?: string | ShowToastOptions,
      extraOptions?: ShowToastOptions
    ) => {
      clearToastTimers();
      const opts: ShowToastOptions =
        typeof iconOrOptions === 'string'
          ? { ...(extraOptions || {}), icon: iconOrOptions }
          : iconOrOptions || extraOptions || {};

      const duration = opts.durationMs ?? (opts.actionLabel ? 4600 : 2800);
      const toastPayload: ToastState = {
        id: generateUuidV4(),
        message,
        icon: opts.icon || 'circle-check',
        actionLabel: opts.actionLabel,
        undoEntryId: opts.undoEntryId,
        onAction: opts.onAction,
        isExiting: false,
        durationMs: duration,
        timestamp: Date.now()
      };

      setToastState(toastPayload);

      toastTimersRef.current.stay = setTimeout(() => {
        setToastState((prev) => (prev ? { ...prev, isExiting: true } : null));
        toastTimersRef.current.exit = setTimeout(() => {
          setToastState(null);
        }, 340);
      }, duration);
    },
    [clearToastTimers]
  );

  // Enqueue sync items when authenticated with cloud UUID
  const enqueueCloudOps = useCallback((items: SyncQueueItem[]) => {
    const member = stateRef.current.currentMember;
    if (!member || !isValidUuid(member.uid) || items.length === 0) return;

    void localStore.enqueueSyncItems(items).then((nextQueue) => {
      dispatch({ type: 'SET_SYNC_STATE', syncStatus: stateRef.current.syncStatus, syncQueue: nextQueue });
      if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
        void flushSyncQueue(member.uid, nextQueue).then((res) => {
          void localStore.saveSyncQueue(res.remainingQueue);
          dispatch({
            type: 'SET_SYNC_STATE',
            syncStatus: res.status,
            syncQueue: res.remainingQueue,
            ...(res.status === 'synced' ? { lastSyncedAt: new Date().toISOString() } : {})
          });
        });
      } else {
        dispatch({
          type: 'SET_SYNC_STATE',
          syncStatus: 'offline-queued',
          syncStatusMessage: '目前離線，變更已寫入本機佇列'
        });
      }
    });
  }, []);

  const persistSnapshot = useCallback((snapshot: ScheduleDataSnapshot) => {
    void localStore.saveSnapshot(snapshot, { broadcast: true });
  }, []);

  const getActiveUserId = useCallback((): string => {
    return stateRef.current.currentMember?.uid || 'local-guest';
  }, []);

  const getCurrentUserRoleForCalendar = useCallback((calendarId: string): CalendarRole => {
    const cal = stateRef.current.present.calendars.find((c) => c.id === calendarId);
    if (!cal) return 'owner';
    const uid = stateRef.current.currentMember?.uid || 'local-guest';
    if (cal.ownerId === uid || cal.ownerId === 'local-guest') return 'owner';
    const membership = cal.members?.find((m) => m.userId === uid);
    return membership?.role || 'owner';
  }, []);

  // ==========================================================================
  // Atomic Undo / Redo Engine (50-Depth Cap + Stale Toast Guard)
  // ==========================================================================

  const undo = useCallback(
    (expectedEntryId?: string): boolean => {
      const cur = stateRef.current;
      if (cur.past.length === 0) return false;
      const top = cur.past[cur.past.length - 1];
      if (expectedEntryId && top.id !== expectedEntryId) {
        showToast('已有後續變更，無法復原該筆舊操作', { icon: 'circle-alert' });
        return false;
      }
      dispatch({ type: 'UNDO' });
      persistSnapshot(top.before);
      showToast(`已復原：${top.label}`, { icon: 'undo-2' });
      return true;
    },
    [persistSnapshot, showToast]
  );

  const redo = useCallback((): boolean => {
    const cur = stateRef.current;
    if (cur.future.length === 0) return false;
    const nextEntry = cur.future[0];
    dispatch({ type: 'REDO' });
    persistSnapshot(nextEntry.after);
    showToast(`已重做：${nextEntry.label}`, { icon: 'redo-2' });
    return true;
  }, [persistSnapshot, showToast]);

  const commitUndoable = useCallback(
    (
      label: string,
      transform: (prev: ScheduleDataSnapshot) => ScheduleDataSnapshot,
      toastOpts?: { toastMessage?: string; icon?: string; silent?: boolean }
    ): { entryId: string; nextSnapshot: ScheduleDataSnapshot } => {
      const entryId = generateUuidV4();
      const nextSnapshot = transform(stateRef.current.present);
      dispatch({ type: 'COMMIT_SNAPSHOT', entryId, label, timestamp: Date.now(), nextSnapshot });
      persistSnapshot(nextSnapshot);

      if (!toastOpts?.silent) {
        showToast(toastOpts?.toastMessage || label, {
          icon: toastOpts?.icon || 'circle-check',
          actionLabel: '復原',
          undoEntryId: entryId,
          onAction: () => {
            undo(entryId);
          }
        });
      }

      return { entryId, nextSnapshot };
    },
    [persistSnapshot, showToast, undo]
  );

  // ==========================================================================
  // 1. Event CRUD & Workflows
  // ==========================================================================

  const createEvent = useCallback(
    (input: Partial<ScheduleEvent> & { title: string; startAt: string; endAt: string }): ScheduleEvent => {
      const nowIso = new Date().toISOString();
      const uid = getActiveUserId();
      const defaultCalId = stateRef.current.present.calendars[0]?.id || generateUuidV4();
      const startMs = Date.parse(input.startAt);
      let endIso = input.endAt;
      if (!Number.isNaN(startMs) && (Number.isNaN(Date.parse(endIso)) || Date.parse(endIso) <= startMs)) {
        endIso = new Date(startMs + 30 * 60000).toISOString();
      }

      const newEvent: ScheduleEvent = {
        id: input.id || generateUuidV4(),
        calendarId: input.calendarId || defaultCalId,
        creatorId: input.creatorId || uid,
        title: sanitizeInputText(input.title).slice(0, 200) || '未命名行程',
        notes: sanitizeInputText(input.notes || ''),
        location: sanitizeInputText(input.location || ''),
        startAt: input.startAt,
        endAt: endIso,
        allDay: Boolean(input.allDay),
        colorToken: input.colorToken || 'sky',
        categoryTag: sanitizeInputText(input.categoryTag || '一般').slice(0, 48) || '一般',
        priority: input.priority || 2,
        bufferBeforeMin: Math.max(0, input.bufferBeforeMin || 0),
        bufferAfterMin: Math.max(0, input.bufferAfterMin || 0),
        isFlexible: Boolean(input.isFlexible),
        status: input.status || 'scheduled',
        completedAt: input.completedAt ?? null,
        recurrenceRule: input.recurrenceRule ?? null,
        subtasks: input.subtasks || [],
        reminderMinutes: input.reminderMinutes || [15],
        externalUid: input.externalUid ?? `mei-${generateUuidV4()}@meischedule.app`,
        createdAt: input.createdAt || nowIso,
        updatedAt: nowIso
      };

      commitUndoable(`已新增行程「${newEvent.title}」`, (prev) => ({
        ...prev,
        events: [...prev.events, newEvent]
      }), { icon: 'calendar-plus' });

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'events',
          operation: 'upsert',
          recordId: newEvent.id,
          payload: eventToRow(newEvent),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);

      return newEvent;
    },
    [commitUndoable, enqueueCloudOps, getActiveUserId]
  );

  const updateEvent = useCallback(
    (eventId: string, updates: Partial<ScheduleEvent>, historyLabel?: string) => {
      const target = stateRef.current.present.events.find((e) => e.id === eventId);
      if (!target) return;
      if (getCurrentUserRoleForCalendar(target.calendarId) === 'viewer') {
        showToast('您在此共享日曆為檢視者權限，無法編輯行程', { icon: 'lock' });
        return;
      }

      const nowIso = new Date().toISOString();
      const updatedEvent: ScheduleEvent = {
        ...target,
        ...updates,
        title: updates.title !== undefined ? sanitizeInputText(updates.title).slice(0, 200) || target.title : target.title,
        notes: updates.notes !== undefined ? sanitizeInputText(updates.notes) : target.notes,
        location: updates.location !== undefined ? sanitizeInputText(updates.location) : target.location,
        updatedAt: nowIso
      };

      commitUndoable(historyLabel || `已更新行程「${updatedEvent.title}」`, (prev) => ({
        ...prev,
        events: prev.events.map((e) => (e.id === eventId ? updatedEvent : e))
      }));

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'events',
          operation: 'upsert',
          recordId: updatedEvent.id,
          payload: eventToRow(updatedEvent),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
    },
    [commitUndoable, enqueueCloudOps, getCurrentUserRoleForCalendar, showToast]
  );

  const moveOrResizeEvent = useCallback(
    (eventId: string, startAt: string, endAt: string) => {
      const startMs = Date.parse(startAt);
      let endMs = Date.parse(endAt);
      if (Number.isNaN(startMs)) return;
      if (Number.isNaN(endMs) || endMs - startMs < 15 * 60000) {
        endMs = startMs + 15 * 60000;
      }
      updateEvent(
        eventId,
        { startAt: new Date(startMs).toISOString(), endAt: new Date(endMs).toISOString() },
        '已調整行程時間塊'
      );
    },
    [updateEvent]
  );

  const deleteEvent = useCallback(
    (eventId: string) => {
      const target = stateRef.current.present.events.find((e) => e.id === eventId);
      if (!target) return;
      if (getCurrentUserRoleForCalendar(target.calendarId) === 'viewer') {
        showToast('您在此共享日曆為檢視者權限，無法刪除行程', { icon: 'lock' });
        return;
      }

      const nowIso = new Date().toISOString();
      commitUndoable(`已刪除行程「${target.title}」`, (prev) => ({
        ...prev,
        events: prev.events.filter((e) => e.id !== eventId),
        tasks: prev.tasks.map((t) =>
          t.scheduledEventId === eventId ? { ...t, scheduledEventId: null, updatedAt: nowIso } : t
        ),
        comments: prev.comments.filter((c) => c.eventId !== eventId)
      }), { icon: 'trash-2' });

      if (stateRef.current.selectedEventId === eventId) {
        dispatch({ type: 'SELECT_EVENT', eventId: null });
      }

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'events',
          operation: 'delete',
          recordId: eventId,
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
    },
    [commitUndoable, enqueueCloudOps, getCurrentUserRoleForCalendar, showToast]
  );

  const replaceEventsAtomic = useCallback(
    (nextEvents: ScheduleEvent[], historyLabel: string): string => {
      const { entryId } = commitUndoable(historyLabel, (prev) => ({
        ...prev,
        events: nextEvents
      }));
      return entryId;
    },
    [commitUndoable]
  );

  const toggleEventSubtask = useCallback(
    (eventId: string, subtaskId: string) => {
      const target = stateRef.current.present.events.find((e) => e.id === eventId);
      if (!target) return;
      const nextSubtasks = target.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, done: !s.done } : s
      );
      updateEvent(eventId, { subtasks: nextSubtasks }, '已更新子任務狀態');
    },
    [updateEvent]
  );

  const completeEventEarly = useCallback(
    (eventId: string, now: Date = new Date()): { releasedMinutes: number; entryId: string | null } => {
      const target = stateRef.current.present.events.find((e) => e.id === eventId);
      if (!target) return { releasedMinutes: 0, entryId: null };
      if (getCurrentUserRoleForCalendar(target.calendarId) === 'viewer') {
        showToast('您在此共享日曆為檢視者權限，無法變更行程狀態', { icon: 'lock' });
        return { releasedMinutes: 0, entryId: null };
      }

      const startMs = Date.parse(target.startAt);
      const endMs = Date.parse(target.endAt);
      const nowMs = now.getTime();
      const releasedMinutes =
        !Number.isNaN(startMs) && !Number.isNaN(endMs) && nowMs > startMs && nowMs < endMs
          ? Math.max(1, Math.round((endMs - nowMs) / 60000))
          : 0;

      const completedIso = now.toISOString();
      const updatedEvent: ScheduleEvent = {
        ...target,
        status: 'completed',
        completedAt: completedIso,
        releasedMinutes,
        updatedAt: completedIso
      };

      const label =
        releasedMinutes > 0
          ? `已完成行程，提前釋放 ${releasedMinutes} 分鐘空檔`
          : '已標記行程完成';

      const { entryId } = commitUndoable(
        label,
        (prev) => ({
          ...prev,
          events: prev.events.map((e) => (e.id === eventId ? updatedEvent : e))
        }),
        { icon: 'circle-check' }
      );

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'events',
          operation: 'upsert',
          recordId: updatedEvent.id,
          payload: eventToRow(updatedEvent),
          queuedAt: completedIso,
          retryCount: 0
        }
      ]);

      return { releasedMinutes, entryId };
    },
    [commitUndoable, enqueueCloudOps, getCurrentUserRoleForCalendar, showToast]
  );

  const toggleEventComplete = useCallback(
    (eventId: string, now: Date = new Date()) => {
      const target = stateRef.current.present.events.find((e) => e.id === eventId);
      if (!target) return;
      if (target.status === 'completed') {
        updateEvent(
          eventId,
          { status: 'scheduled', completedAt: null, releasedMinutes: 0 },
          '已重新開啟行程'
        );
      } else {
        completeEventEarly(eventId, now);
      }
    },
    [completeEventEarly, updateEvent]
  );

  // ==========================================================================
  // 2. Atomic Smart Scheduler Commit (F17 + F20)
  // ==========================================================================

  const applySmartProposals = useCallback(
    (proposals: ScheduleProposal[]): { appliedCount: number; entryId: string | null } => {
      const selected = proposals.filter((p) => p.selected);
      if (selected.length === 0) {
        return { appliedCount: 0, entryId: null };
      }

      const nowIso = new Date().toISOString();
      const uid = getActiveUserId();
      const defaultCalId = stateRef.current.present.calendars[0]?.id || generateUuidV4();
      const queueBatch: SyncQueueItem[] = [];
      let appliedCount = 0;

      const { entryId } = commitUndoable(
        `已套用 ${selected.length} 項智慧排程建議`,
        (prev) => {
          let nextEvents = [...prev.events];
          let nextTasks = [...prev.tasks];

          for (const prop of selected) {
            if (prop.action === 'schedule_task') {
              const task = nextTasks.find((t) => t.id === prop.targetId);
              if (!task) continue;
              const newEvt: ScheduleEvent = {
                id: generateUuidV4(),
                calendarId: task.calendarId || defaultCalId,
                creatorId: uid,
                title: task.title,
                notes: task.notes,
                location: '',
                startAt: prop.proposedStartAt,
                endAt: prop.proposedEndAt,
                allDay: false,
                colorToken: 'sky',
                categoryTag: task.categoryTag || '工作',
                priority: task.priority,
                bufferBeforeMin: 0,
                bufferAfterMin: 0,
                isFlexible: true,
                status: 'scheduled',
                completedAt: null,
                recurrenceRule: null,
                subtasks: task.subtasks.map((s) => ({ ...s })),
                reminderMinutes: [15],
                externalUid: `mei-${generateUuidV4()}@meischedule.app`,
                createdAt: nowIso,
                updatedAt: nowIso
              };
              nextEvents.push(newEvt);
              const updatedTask: ScheduleTask = {
                ...task,
                scheduledEventId: newEvt.id,
                updatedAt: nowIso
              };
              nextTasks = nextTasks.map((t) => (t.id === task.id ? updatedTask : t));
              queueBatch.push(
                {
                  id: generateUuidV4(),
                  entity: 'events',
                  operation: 'upsert',
                  recordId: newEvt.id,
                  payload: eventToRow(newEvt),
                  queuedAt: nowIso,
                  retryCount: 0
                },
                {
                  id: generateUuidV4(),
                  entity: 'tasks',
                  operation: 'upsert',
                  recordId: updatedTask.id,
                  payload: taskToRow(updatedTask),
                  queuedAt: nowIso,
                  retryCount: 0
                }
              );
              appliedCount++;
            } else if (prop.action === 'reschedule_event') {
              const existing = nextEvents.find((e) => e.id === prop.targetId);
              // Defensive lock guard: NEVER move non-flexible events
              if (!existing || !existing.isFlexible) continue;
              const shifted: ScheduleEvent = {
                ...existing,
                startAt: prop.proposedStartAt,
                endAt: prop.proposedEndAt,
                updatedAt: nowIso
              };
              nextEvents = nextEvents.map((e) => (e.id === existing.id ? shifted : e));
              queueBatch.push({
                id: generateUuidV4(),
                entity: 'events',
                operation: 'upsert',
                recordId: shifted.id,
                payload: eventToRow(shifted),
                queuedAt: nowIso,
                retryCount: 0
              });
              appliedCount++;
            }
          }

          return {
            ...prev,
            events: nextEvents,
            tasks: nextTasks
          };
        },
        {
          icon: 'wand-sparkles',
          toastMessage: `已套用 ${selected.length} 項智慧排程建議`
        }
      );

      enqueueCloudOps(queueBatch);
      return { appliedCount, entryId };
    },
    [commitUndoable, enqueueCloudOps, getActiveUserId]
  );

  // ==========================================================================
  // 3. Task Inbox CRUD & Drag-to-Timeline
  // ==========================================================================

  const createTask = useCallback(
    (input: Partial<ScheduleTask> & { title: string }): ScheduleTask => {
      const nowIso = new Date().toISOString();
      const uid = getActiveUserId();
      const newTask: ScheduleTask = {
        id: input.id || generateUuidV4(),
        userId: input.userId || uid,
        calendarId: input.calendarId ?? stateRef.current.present.calendars[0]?.id ?? null,
        scheduledEventId: input.scheduledEventId ?? null,
        title: sanitizeInputText(input.title).slice(0, 200) || '未命名待辦',
        notes: sanitizeInputText(input.notes || ''),
        estimatedMinutes: Math.max(15, input.estimatedMinutes || 30),
        priority: input.priority || 2,
        dueDate: input.dueDate ?? null,
        categoryTag: sanitizeInputText(input.categoryTag || '待辦').slice(0, 48) || '待辦',
        completed: Boolean(input.completed),
        subtasks: input.subtasks || [],
        sortOrder: input.sortOrder ?? stateRef.current.present.tasks.length,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      commitUndoable(`已新增待辦「${newTask.title}」`, (prev) => ({
        ...prev,
        tasks: [...prev.tasks, newTask]
      }), { icon: 'list-todo' });

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'tasks',
          operation: 'upsert',
          recordId: newTask.id,
          payload: taskToRow(newTask),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
      return newTask;
    },
    [commitUndoable, enqueueCloudOps, getActiveUserId]
  );

  const updateTask = useCallback(
    (taskId: string, updates: Partial<ScheduleTask>) => {
      const target = stateRef.current.present.tasks.find((t) => t.id === taskId);
      if (!target) return;
      const nowIso = new Date().toISOString();
      const updatedTask: ScheduleTask = {
        ...target,
        ...updates,
        title: updates.title !== undefined ? sanitizeInputText(updates.title).slice(0, 200) || target.title : target.title,
        notes: updates.notes !== undefined ? sanitizeInputText(updates.notes) : target.notes,
        updatedAt: nowIso
      };

      commitUndoable(`已更新待辦「${updatedTask.title}」`, (prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? updatedTask : t))
      }));

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'tasks',
          operation: 'upsert',
          recordId: updatedTask.id,
          payload: taskToRow(updatedTask),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
    },
    [commitUndoable, enqueueCloudOps]
  );

  const toggleTaskComplete = useCallback(
    (taskId: string) => {
      const target = stateRef.current.present.tasks.find((t) => t.id === taskId);
      if (!target) return;
      updateTask(taskId, { completed: !target.completed });
    },
    [updateTask]
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      const target = stateRef.current.present.tasks.find((t) => t.id === taskId);
      if (!target) return;
      const nowIso = new Date().toISOString();
      commitUndoable(`已刪除待辦「${target.title}」`, (prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId)
      }), { icon: 'trash-2' });

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'tasks',
          operation: 'delete',
          recordId: taskId,
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
    },
    [commitUndoable, enqueueCloudOps]
  );

  const scheduleTaskToTimeBlock = useCallback(
    (taskId: string, startAt: string, endAt?: string, calendarId?: string): ScheduleEvent | null => {
      const task = stateRef.current.present.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const startMs = Date.parse(startAt);
      if (Number.isNaN(startMs)) return null;
      const resolvedEnd =
        endAt || new Date(startMs + Math.max(15, task.estimatedMinutes || 30) * 60000).toISOString();
      const nowIso = new Date().toISOString();
      const uid = getActiveUserId();
      const newEvt: ScheduleEvent = {
        id: generateUuidV4(),
        calendarId: calendarId || task.calendarId || stateRef.current.present.calendars[0]?.id || generateUuidV4(),
        creatorId: uid,
        title: task.title,
        notes: task.notes,
        location: '',
        startAt,
        endAt: resolvedEnd,
        allDay: false,
        colorToken: 'sky',
        categoryTag: task.categoryTag || '工作',
        priority: task.priority,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        isFlexible: true,
        status: 'scheduled',
        completedAt: null,
        recurrenceRule: null,
        subtasks: task.subtasks.map((s) => ({ ...s })),
        reminderMinutes: [15],
        externalUid: `mei-${generateUuidV4()}@meischedule.app`,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const updatedTask: ScheduleTask = { ...task, scheduledEventId: newEvt.id, updatedAt: nowIso };
      commitUndoable(`已將待辦「${task.title}」排入時間軸`, (prev) => ({
        ...prev,
        events: [...prev.events, newEvt],
        tasks: prev.tasks.map((t) => (t.id === taskId ? updatedTask : t))
      }), { icon: 'calendar-check' });

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'events',
          operation: 'upsert',
          recordId: newEvt.id,
          payload: eventToRow(newEvt),
          queuedAt: nowIso,
          retryCount: 0
        },
        {
          id: generateUuidV4(),
          entity: 'tasks',
          operation: 'upsert',
          recordId: updatedTask.id,
          payload: taskToRow(updatedTask),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);

      return newEvt;
    },
    [commitUndoable, enqueueCloudOps, getActiveUserId]
  );

  // ==========================================================================
  // 4. Calendars, Calendar Sets & Shared Collaboration
  // ==========================================================================

  const createCalendar = useCallback(
    (input: Partial<Calendar> & { name: string }): Calendar => {
      const nowIso = new Date().toISOString();
      const uid = getActiveUserId();
      const displayName = stateRef.current.currentMember?.displayName || '我 (擁有者)';
      const isShared = Boolean(input.isShared);
      const id = input.id || generateUuidV4();
      const newCal: Calendar = {
        id,
        ownerId: input.ownerId || uid,
        name: sanitizeInputText(input.name).slice(0, 80) || '新行事曆',
        description: sanitizeInputText(input.description || ''),
        colorToken: input.colorToken || 'sky',
        icon: input.icon || (isShared ? 'users' : 'calendar'),
        calendarSet: input.calendarSet || (isShared ? 'shared' : 'personal'),
        isShared,
        inviteCode: isShared ? input.inviteCode || generateInviteCode(6) : null,
        visible: true,
        members: input.members
          ? input.members.map((m) => ({ ...m, calendarId: m.calendarId || id }))
          : [
              {
                calendarId: id,
                userId: uid,
                displayName,
                role: 'owner',
                joinedAt: nowIso
              }
            ],
        createdAt: nowIso,
        updatedAt: nowIso
      };

      commitUndoable(`已建立行事曆「${newCal.name}」`, (prev) => ({
        ...prev,
        calendars: [...prev.calendars, newCal]
      }), { icon: isShared ? 'users' : 'calendar' });

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'calendars',
          operation: 'upsert',
          recordId: newCal.id,
          payload: calendarToRow(newCal),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);

      return newCal;
    },
    [commitUndoable, enqueueCloudOps, getActiveUserId]
  );

  const updateCalendar = useCallback(
    (calendarId: string, updates: Partial<Calendar>) => {
      const target = stateRef.current.present.calendars.find((c) => c.id === calendarId);
      if (!target) return;
      const nowIso = new Date().toISOString();
      const updated: Calendar = {
        ...target,
        ...updates,
        name: updates.name !== undefined ? sanitizeInputText(updates.name).slice(0, 80) || target.name : target.name,
        updatedAt: nowIso
      };
      commitUndoable(`已更新行事曆「${updated.name}」`, (prev) => ({
        ...prev,
        calendars: prev.calendars.map((c) => (c.id === calendarId ? updated : c))
      }));
      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'calendars',
          operation: 'upsert',
          recordId: updated.id,
          payload: calendarToRow(updated),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
    },
    [commitUndoable, enqueueCloudOps]
  );

  const deleteCalendar = useCallback(
    (calendarId: string): boolean => {
      if (stateRef.current.present.calendars.length <= 1) {
        showToast('至少需保留一個行事曆', { icon: 'circle-alert' });
        return false;
      }
      const target = stateRef.current.present.calendars.find((c) => c.id === calendarId);
      if (!target) return false;
      const nowIso = new Date().toISOString();
      commitUndoable(`已刪除行事曆「${target.name}」`, (prev) => ({
        ...prev,
        calendars: prev.calendars.filter((c) => c.id !== calendarId),
        events: prev.events.filter((e) => e.calendarId !== calendarId)
      }), { icon: 'trash-2' });

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'calendars',
          operation: 'delete',
          recordId: calendarId,
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
      return true;
    },
    [commitUndoable, enqueueCloudOps, showToast]
  );

  const toggleCalendarVisibility = useCallback(
    (calendarId: string) => {
      const nextSnapshot: ScheduleDataSnapshot = {
        ...stateRef.current.present,
        calendars: stateRef.current.present.calendars.map((c) =>
          c.id === calendarId ? { ...c, visible: c.visible === false ? true : false } : c
        )
      };
      dispatch({ type: 'REPLACE_SNAPSHOT_SILENT', snapshot: nextSnapshot });
      persistSnapshot(nextSnapshot);
    },
    [persistSnapshot]
  );

  const updatePreferences = useCallback(
    (updates: Partial<UserPreferences>) => {
      const nowIso = new Date().toISOString();
      const nextPrefs: UserPreferences = {
        ...stateRef.current.preferences,
        ...updates,
        updatedAt: nowIso
      };
      dispatch({ type: 'SET_PREFERENCES', preferences: nextPrefs });
      void localStore.savePreferences(nextPrefs, { broadcast: true });
      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'preferences',
          operation: 'upsert',
          recordId: nextPrefs.userId,
          payload: preferencesToRow(nextPrefs),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
    },
    [enqueueCloudOps]
  );

  const setActiveCalendarSet = useCallback(
    (setId: CalendarSetId) => {
      updatePreferences({ activeCalendarSet: setId });
    },
    [updatePreferences]
  );

  const joinSharedCalendar = useCallback(
    async (inviteCode: string): Promise<{ success: boolean; calendar?: Calendar; error?: string }> => {
      const cleanCode = inviteCode.trim().toUpperCase();
      if (!cleanCode || cleanCode.length < 4) {
        return { success: false, error: '請輸入有效的共享日曆邀請碼' };
      }

      const member = stateRef.current.currentMember;
      const uid = getActiveUserId();
      const displayName = member?.displayName || '本機協作成員';

      if (member && isValidUuid(member.uid)) {
        const remote = await joinSharedCalendarRemote(cleanCode, displayName);
        if (remote.mode === 'cloud') {
          if (remote.error || !remote.calendar) {
            return { success: false, error: remote.error || '無效或已過期的邀請碼' };
          }
          const exists = stateRef.current.present.calendars.some((c) => c.id === remote.calendar!.id);
          const mergedEvents = [...stateRef.current.present.events];
          for (const evt of remote.events) {
            if (!mergedEvents.some((e) => e.id === evt.id)) mergedEvents.push(evt);
          }
          commitUndoable(`已加入共享日曆「${remote.calendar.name}」`, (prev) => ({
            ...prev,
            calendars: exists
              ? prev.calendars.map((c) => (c.id === remote.calendar!.id ? remote.calendar! : c))
              : [...prev.calendars, remote.calendar!],
            events: mergedEvents
          }), { icon: 'users' });
          return { success: true, calendar: remote.calendar };
        }
      }

      // Offline / Pre-migration Local Demo Join
      const existingLocal = stateRef.current.present.calendars.find(
        (c) => c.isShared && c.inviteCode?.toUpperCase() === cleanCode
      );
      if (existingLocal) {
        showToast(`您已在共享日曆「${existingLocal.name}」中`, { icon: 'users' });
        return { success: true, calendar: existingLocal };
      }

      const demoCal = createCalendar({
        name: `共享協作日曆 (${cleanCode})`,
        description: '透過邀請碼加入的離線示範共享日曆，連上雲端後將自動同步',
        colorToken: 'violet',
        icon: 'users',
        calendarSet: 'shared',
        isShared: true,
        inviteCode: cleanCode,
        members: [
          {
            calendarId: '',
            userId: uid,
            displayName,
            role: 'editor',
            joinedAt: new Date().toISOString()
          }
        ]
      });
      return { success: true, calendar: demoCal };
    },
    [commitUndoable, createCalendar, getActiveUserId, showToast]
  );

  const updateCalendarMemberRole = useCallback(
    (calendarId: string, userId: string, role: CalendarRole) => {
      const target = stateRef.current.present.calendars.find((c) => c.id === calendarId);
      if (!target) return;
      if (getCurrentUserRoleForCalendar(calendarId) !== 'owner') {
        showToast('僅共享日曆擁有者可變更成員權限', { icon: 'lock' });
        return;
      }
      const member = (target.members || []).find((m) => m.userId === userId);
      if (!member || member.role === 'owner') return;

      const updatedMember = { ...member, role };
      const nextMembers = (target.members || []).map((m) =>
        m.userId === userId ? updatedMember : m
      );
      updateCalendar(calendarId, { members: nextMembers });

      if (isValidUuid(calendarId) && isValidUuid(userId)) {
        enqueueCloudOps([
          {
            id: generateUuidV4(),
            entity: 'calendar_members',
            operation: 'upsert',
            recordId: `${calendarId}::${userId}`,
            payload: calendarMemberToRow(updatedMember),
            queuedAt: new Date().toISOString(),
            retryCount: 0
          }
        ]);
      }
    },
    [enqueueCloudOps, getCurrentUserRoleForCalendar, showToast, updateCalendar]
  );

  const removeCalendarMember = useCallback(
    (calendarId: string, memberUserId: string): boolean => {
      const target = stateRef.current.present.calendars.find((c) => c.id === calendarId);
      if (!target) return false;

      const member = (target.members || []).find((m) => m.userId === memberUserId);
      if (!member) return false;

      if (member.role === 'owner' || target.ownerId === memberUserId) {
        showToast('無法移除共享日曆擁有者', { icon: 'lock' });
        return false;
      }

      const activeUserId = getActiveUserId();
      const myRole = getCurrentUserRoleForCalendar(calendarId);
      if (myRole !== 'owner' && memberUserId !== activeUserId) {
        showToast('僅共享日曆擁有者可移除成員', { icon: 'lock' });
        return false;
      }

      const nowIso = new Date().toISOString();
      const nextMembers = (target.members || []).filter((m) => m.userId !== memberUserId);

      commitUndoable(
        `已移除成員「${member.displayName}」`,
        (prev) => ({
          ...prev,
          calendars: prev.calendars.map((c) =>
            c.id === calendarId ? { ...c, members: nextMembers, updatedAt: nowIso } : c
          )
        }),
        { icon: 'user-minus' }
      );

      if (isValidUuid(calendarId) && isValidUuid(memberUserId)) {
        enqueueCloudOps([
          {
            id: generateUuidV4(),
            entity: 'calendar_members',
            operation: 'delete',
            recordId: `${calendarId}::${memberUserId}`,
            payload: { calendar_id: calendarId, user_id: memberUserId },
            queuedAt: nowIso,
            retryCount: 0
          }
        ]);
      }

      return true;
    },
    [commitUndoable, enqueueCloudOps, getActiveUserId, getCurrentUserRoleForCalendar, showToast]
  );

  // ==========================================================================
  // 5. Per-Event Comments & Focus Pomodoro Sessions
  // ==========================================================================

  const addEventComment = useCallback(
    (eventId: string, body: string): EventComment | null => {
      const evt = stateRef.current.present.events.find((e) => e.id === eventId);
      if (!evt) return null;
      if (getCurrentUserRoleForCalendar(evt.calendarId) === 'viewer') {
        showToast('檢視者權限僅能閱讀留言，無法發表新留言', { icon: 'lock' });
        return null;
      }
      const cleanBody = sanitizeInputText(body);
      if (!cleanBody) return null;

      const nowIso = new Date().toISOString();
      const comment: EventComment = {
        id: generateUuidV4(),
        eventId,
        authorId: getActiveUserId(),
        authorName: stateRef.current.currentMember?.displayName || '本機使用者',
        body: cleanBody,
        createdAt: nowIso
      };

      const nextSnapshot: ScheduleDataSnapshot = {
        ...stateRef.current.present,
        comments: [...stateRef.current.present.comments, comment]
      };
      dispatch({ type: 'REPLACE_SNAPSHOT_SILENT', snapshot: nextSnapshot });
      persistSnapshot(nextSnapshot);

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'event_comments',
          operation: 'upsert',
          recordId: comment.id,
          payload: commentToRow(comment),
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
      return comment;
    },
    [enqueueCloudOps, getActiveUserId, getCurrentUserRoleForCalendar, persistSnapshot, showToast]
  );

  const deleteEventComment = useCallback(
    (commentId: string) => {
      const nowIso = new Date().toISOString();
      const nextSnapshot: ScheduleDataSnapshot = {
        ...stateRef.current.present,
        comments: stateRef.current.present.comments.filter((c) => c.id !== commentId)
      };
      dispatch({ type: 'REPLACE_SNAPSHOT_SILENT', snapshot: nextSnapshot });
      persistSnapshot(nextSnapshot);
      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'event_comments',
          operation: 'delete',
          recordId: commentId,
          queuedAt: nowIso,
          retryCount: 0
        }
      ]);
    },
    [enqueueCloudOps, persistSnapshot]
  );

  const recordFocusSession = useCallback(
    (input: Omit<FocusSession, 'id' | 'userId'>): FocusSession => {
      const session: FocusSession = {
        ...input,
        id: generateUuidV4(),
        userId: getActiveUserId(),
        actualMinutes: Math.max(1, Math.round(input.actualMinutes))
      };

      const nextSnapshot: ScheduleDataSnapshot = {
        ...stateRef.current.present,
        focusSessions: [session, ...stateRef.current.present.focusSessions]
      };
      dispatch({ type: 'REPLACE_SNAPSHOT_SILENT', snapshot: nextSnapshot });
      persistSnapshot(nextSnapshot);

      enqueueCloudOps([
        {
          id: generateUuidV4(),
          entity: 'focus_sessions',
          operation: 'upsert',
          recordId: session.id,
          payload: focusSessionToRow(session),
          queuedAt: new Date().toISOString(),
          retryCount: 0
        }
      ]);

      showToast(`已紀錄 ${session.actualMinutes} 分鐘專注時段`, { icon: 'timer' });
      return session;
    },
    [enqueueCloudOps, getActiveUserId, persistSnapshot, showToast]
  );

  // ==========================================================================
  // 6. Cloud Sync Trigger & Navigation Helpers
  // ==========================================================================

  const triggerCloudSync = useCallback(async () => {
    const member = stateRef.current.currentMember;
    if (!member || !isValidUuid(member.uid)) {
      dispatch({
        type: 'SET_SYNC_STATE',
        syncStatus: 'local-only',
        syncStatusMessage: '本機離線優先模式'
      });
      return;
    }

    dispatch({ type: 'SET_SYNC_STATE', syncStatus: 'syncing', syncStatusMessage: '正在同步雲端排程...' });
    const res = await mergeLocalAndCloudOnSignIn(
      member.uid,
      stateRef.current.present,
      stateRef.current.preferences,
      stateRef.current.syncQueue
    );

    dispatch({
      type: 'REPLACE_SNAPSHOT_SILENT',
      snapshot: res.mergedSnapshot,
      preferences: res.mergedPreferences
    });
    dispatch({
      type: 'SET_SYNC_STATE',
      syncStatus: res.status,
      syncStatusMessage: res.statusMessage,
      lastSyncedAt: res.lastSyncedAt,
      syncQueue: res.remainingQueue
    });

    await localStore.saveSnapshot(res.mergedSnapshot, { broadcast: false });
    await localStore.savePreferences(res.mergedPreferences, { broadcast: false });
    await localStore.saveSyncQueue(res.remainingQueue);
    await localStore.setLastSyncedAt(res.lastSyncedAt);
  }, []);

  const setCurrentMember = useCallback((member: MemberProfile | null) => {
    dispatch({ type: 'SET_MEMBER', member });
    if (!member) {
      dispatch({
        type: 'SET_SYNC_STATE',
        syncStatus: 'local-only',
        syncStatusMessage: '已登出，持續使用本機離線排程'
      });
    }
  }, []);

  const setViewMode = useCallback((viewMode: ScheduleViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', viewMode });
  }, []);

  const setSelectedDate = useCallback((date: string) => {
    dispatch({ type: 'SET_SELECTED_DATE', date });
  }, []);

  const goToToday = useCallback(() => {
    dispatch({ type: 'SET_SELECTED_DATE', date: formatLocalDate(new Date(), 0) });
  }, []);

  const navigateDate = useCallback((deltaDays: number) => {
    const [y, m, d] = stateRef.current.selectedDate.split('-').map(Number);
    const base = new Date(y, (m || 1) - 1, d || 1);
    dispatch({ type: 'SET_SELECTED_DATE', date: formatLocalDate(base, deltaDays) });
  }, []);

  const selectEvent = useCallback((eventId: string | null, instanceDate?: string | null) => {
    dispatch({ type: 'SELECT_EVENT', eventId, instanceDate });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_OPEN', open });
  }, []);

  const setInboxDrawerOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_INBOX_DRAWER_OPEN', open });
  }, []);

  const openModal = useCallback(
    (
      modal: ActiveModalType,
      ctx?: { focusTargetEventId?: string | null; focusTargetTaskId?: string | null }
    ) => {
      dispatch({
        type: 'OPEN_MODAL',
        modal,
        focusTargetEventId: ctx?.focusTargetEventId,
        focusTargetTaskId: ctx?.focusTargetTaskId
      });
    },
    []
  );

  const closeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_MODAL' });
  }, []);

  // ==========================================================================
  // 7. Side Effects: Hydration, Theme DOM Sync, Auth/Realtime, Online, Multi-Tab
  // ==========================================================================

  useEffect(() => {
    let cancelled = false;
    void localStore
      .loadInitialScheduleState(() =>
        createSeedScheduleData(new Date(), stateRef.current.currentMember?.uid || 'local-guest')
      )
      .then((res) => {
        if (cancelled) return;
        const effectiveSnapshot = mutatedBeforeHydrateRef.current
          ? stateRef.current.present
          : res.snapshot;
        dispatch({
          type: 'HYDRATE',
          snapshot: effectiveSnapshot,
          preferences: res.preferences || createDefaultPreferences(),
          syncQueue: res.syncQueue,
          lastSyncedAt: res.lastSyncedAt
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const prevVisualRef = useRef<{
    initialized: boolean;
    designTheme: string;
    resolvedColorMode: 'light' | 'dark';
  }>({
    initialized: false,
    designTheme: state.preferences.designTheme || 'sky-glass',
    resolvedColorMode: state.resolvedColorMode
  });
  const themeTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionSeqRef = useRef(0);

  // Theme & Color Mode DOM Synchronization + Dual-Speed Style B Cross-Dissolve
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const nextTheme = state.preferences.designTheme || 'sky-glass';
    const nextMode = state.resolvedColorMode;

    // Persist tiny boot cache so index.html eliminates reload FOUC before React mounts
    try {
      window.localStorage?.setItem(
        THEME_BOOT_STORAGE_KEY,
        JSON.stringify({
          designTheme: nextTheme,
          colorMode: state.preferences.colorMode,
          resolvedColorMode: nextMode
        })
      );
    } catch {
      // Ignore storage restrictions
    }

    const prev = prevVisualRef.current;
    if (!prev.initialized) {
      prevVisualRef.current = {
        initialized: true,
        designTheme: nextTheme,
        resolvedColorMode: nextMode
      };
      html.setAttribute('data-design-theme', nextTheme);
      html.classList.toggle('dark', nextMode === 'dark');
      return;
    }

    const colorModeChanged = prev.resolvedColorMode !== nextMode;
    const themeChanged = prev.designTheme !== nextTheme;
    prevVisualRef.current = {
      initialized: true,
      designTheme: nextTheme,
      resolvedColorMode: nextMode
    };

    if (colorModeChanged || themeChanged) {
      if (themeTransitionTimerRef.current) {
        clearTimeout(themeTransitionTimerRef.current);
      }

      const kind: 'color-mode' | 'theme' = colorModeChanged ? 'color-mode' : 'theme';
      const durationMs = colorModeChanged ? COLOR_MODE_TRANSITION_MS : THEME_TRANSITION_MS;

      html.classList.remove('theme-transitioning', 'color-mode-transitioning');
      html.classList.add(colorModeChanged ? 'color-mode-transitioning' : 'theme-transitioning');

      transitionSeqRef.current += 1;
      setThemeTransition({
        key: transitionSeqRef.current,
        kind,
        targetMode: nextMode
      });

      themeTransitionTimerRef.current = setTimeout(() => {
        html.classList.remove('theme-transitioning', 'color-mode-transitioning');
        setThemeTransition(null);
        themeTransitionTimerRef.current = null;
      }, durationMs + 50);
    }

    html.setAttribute('data-design-theme', nextTheme);
    html.classList.toggle('dark', nextMode === 'dark');
  }, [state.preferences.designTheme, state.preferences.colorMode, state.resolvedColorMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const wrapMode = state.preferences.autoWrapTitles === false ? 'nowrap' : 'wrap';
    document.documentElement.setAttribute('data-title-wrap', wrapMode);
  }, [state.preferences.autoWrapTitles]);

  useEffect(() => {
    return () => {
      if (themeTransitionTimerRef.current) {
        clearTimeout(themeTransitionTimerRef.current);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('theme-transitioning', 'color-mode-transitioning');
      }
    };
  }, []);

  // Listen to OS prefers-color-scheme when colorMode === 'system'
  useEffect(() => {
    if (state.preferences.colorMode !== 'system' || typeof window === 'undefined') return;
    try {
      const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
      if (!mql) return;
      dispatch({ type: 'SET_RESOLVED_COLOR_MODE', mode: mql.matches ? 'dark' : 'light' });
      const onChange = (e: MediaQueryListEvent) => {
        dispatch({ type: 'SET_RESOLVED_COLOR_MODE', mode: e.matches ? 'dark' : 'light' });
      };
      mql.addEventListener?.('change', onChange);
      return () => mql.removeEventListener?.('change', onChange);
    } catch {
      return undefined;
    }
  }, [state.preferences.colorMode]);

  // Auth listener
  useEffect(() => {
    return initAuthListener((member) => {
      dispatch({ type: 'SET_MEMBER', member });
    });
  }, []);

  // Cloud merge & Realtime subscription when authenticated & hydrated
  useEffect(() => {
    const uid = state.currentMember?.uid;
    if (!state.hydrated || !uid || !isValidUuid(uid)) return;

    void triggerCloudSync();

    const unsubRealtime = subscribeScheduleRealtime(uid, {
      onEventUpsert: (evt) => {
        dispatch({ type: 'REMOTE_EVENT_UPSERT', event: evt });
      },
      onEventDelete: (eventId) => {
        dispatch({ type: 'REMOTE_EVENT_DELETE', eventId });
      },
      onCommentUpsert: (comment) => {
        dispatch({ type: 'REMOTE_COMMENT_UPSERT', comment });
      },
      onCommentDelete: (commentId) => {
        dispatch({ type: 'REMOTE_COMMENT_DELETE', commentId });
      }
    });

    return () => {
      unsubRealtime();
    };
  }, [state.hydrated, state.currentMember?.uid, triggerCloudSync]);

  // Online / Offline Recovery
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => {
      const member = stateRef.current.currentMember;
      if (member && isValidUuid(member.uid)) {
        void flushSyncQueue(member.uid, stateRef.current.syncQueue).then((res) => {
          void localStore.saveSyncQueue(res.remainingQueue);
          dispatch({
            type: 'SET_SYNC_STATE',
            syncStatus: res.status,
            syncStatusMessage: res.status === 'synced' ? '網路已恢復，排程同步完成' : '部分項目待重試',
            syncQueue: res.remainingQueue,
            ...(res.status === 'synced' ? { lastSyncedAt: new Date().toISOString() } : {})
          });
        });
      }
    };
    const onOffline = () => {
      dispatch({
        type: 'SET_SYNC_STATE',
        syncStatus: 'offline-queued',
        syncStatusMessage: '目前處於離線模式，變更將暫存本機'
      });
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Multi-tab / Electron #/tray BroadcastChannel Sync
  useEffect(() => {
    return localStore.subscribeLocalBroadcast(() => {
      void localStore.loadFullLocalState().then((res) => {
        if (!res) return;
        dispatch({
          type: 'REPLACE_SNAPSHOT_SILENT',
          snapshot: res.snapshot,
          preferences: res.preferences ?? undefined
        });
      });
    });
  }, []);

  useEffect(() => {
    return () => clearToastTimers();
  }, [clearToastTimers]);

  const value = useMemo<ScheduleStoreContextValue>(
    () => ({
      state,
      hydrated: state.hydrated,
      currentMember: state.currentMember,
      syncStatus: state.syncStatus,
      syncStatusMessage: state.syncStatusMessage,
      lastSyncedAt: state.lastSyncedAt,
      calendars: state.present.calendars,
      events: state.present.events,
      tasks: state.present.tasks,
      comments: state.present.comments,
      focusSessions: state.present.focusSessions,
      preferences: state.preferences,
      resolvedColorMode: state.resolvedColorMode,
      viewMode: state.viewMode,
      selectedDate: state.selectedDate,
      selectedEventId: state.selectedEventId,
      selectedInstanceDate: state.selectedInstanceDate,
      searchQuery: state.searchQuery,
      sidebarOpen: state.sidebarOpen,
      inboxDrawerOpen: state.inboxDrawerOpen,
      activeModal: state.activeModal,
      focusTargetEventId: state.focusTargetEventId,
      focusTargetTaskId: state.focusTargetTaskId,
      toast: state.toast,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      historyDepth: state.past.length,
      createEvent,
      updateEvent,
      moveOrResizeEvent,
      deleteEvent,
      replaceEventsAtomic,
      toggleEventSubtask,
      completeEventEarly,
      toggleEventComplete,
      applySmartProposals,
      createTask,
      updateTask,
      toggleTaskComplete,
      deleteTask,
      scheduleTaskToTimeBlock,
      createCalendar,
      updateCalendar,
      deleteCalendar,
      toggleCalendarVisibility,
      setActiveCalendarSet,
      joinSharedCalendar,
      updateCalendarMemberRole,
      removeCalendarMember,
      getCurrentUserRoleForCalendar,
      addEventComment,
      deleteEventComment,
      recordFocusSession,
      updatePreferences,
      undo,
      redo,
      setCurrentMember,
      triggerCloudSync,
      setViewMode,
      setSelectedDate,
      goToToday,
      navigateDate,
      selectEvent,
      setSearchQuery,
      setSidebarOpen,
      setInboxDrawerOpen,
      openModal,
      closeModal,
      showToast,
      dismissToast
    }),
    [
      state,
      createEvent,
      updateEvent,
      moveOrResizeEvent,
      deleteEvent,
      replaceEventsAtomic,
      toggleEventSubtask,
      completeEventEarly,
      toggleEventComplete,
      applySmartProposals,
      createTask,
      updateTask,
      toggleTaskComplete,
      deleteTask,
      scheduleTaskToTimeBlock,
      createCalendar,
      updateCalendar,
      deleteCalendar,
      toggleCalendarVisibility,
      setActiveCalendarSet,
      joinSharedCalendar,
      updateCalendarMemberRole,
      removeCalendarMember,
      getCurrentUserRoleForCalendar,
      addEventComment,
      deleteEventComment,
      recordFocusSession,
      updatePreferences,
      undo,
      redo,
      setCurrentMember,
      triggerCloudSync,
      setViewMode,
      setSelectedDate,
      goToToday,
      navigateDate,
      selectEvent,
      setSearchQuery,
      setSidebarOpen,
      setInboxDrawerOpen,
      openModal,
      closeModal,
      showToast,
      dismissToast
    ]
  );

  const toastContextValue = useMemo<ToastContextValue>(
    () => ({
      toast: toastState,
      dismissToast
    }),
    [toastState, dismissToast]
  );

  return (
    <ScheduleStoreContext.Provider value={value}>
      <ToastStateContext.Provider value={toastContextValue}>
        <ThemeTransitionContext.Provider value={themeTransition}>
          {children}
        </ThemeTransitionContext.Provider>
      </ToastStateContext.Provider>
    </ScheduleStoreContext.Provider>
  );
}

export function useScheduleStore(): ScheduleStoreContextValue {
  const ctx = useContext(ScheduleStoreContext);
  if (!ctx) {
    throw new Error('useScheduleStore must be used within a ScheduleProvider');
  }
  return ctx;
}

export function useToastState(): ToastContextValue {
  return useContext(ToastStateContext);
}

export function useThemeTransition(): ThemeTransitionPayload | null {
  return useContext(ThemeTransitionContext);
}
