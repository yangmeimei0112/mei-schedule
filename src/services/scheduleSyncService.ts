import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Calendar,
  CalendarMember,
  CalendarRole,
  CalendarSetId,
  ColorMode,
  ColorToken,
  DesignTheme,
  EventComment,
  EventStatus,
  FocusSession,
  PriorityLevel,
  RecurrenceRule,
  ScheduleDataSnapshot,
  ScheduleEvent,
  ScheduleTask,
  Subtask,
  SyncQueueItem,
  SyncStatus,
  UserPreferences
} from '../types/schedule';
import { isValidUuid } from './memberAuthService';
import { supabase } from './supabaseClient';

// ============================================================================
// Bidirectional Cloud Sync, UUID Re-Keying, Offline Queue & Realtime Service
// ============================================================================

export type CloudSyncStatus = SyncStatus;

export interface CloudMergeResult {
  status: CloudSyncStatus;
  statusMessage: string;
  tablesMigrated: boolean;
  mergedSnapshot: ScheduleDataSnapshot;
  mergedPreferences: UserPreferences;
  remainingQueue: SyncQueueItem[];
  lastSyncedAt: string | null;
}

export interface ScheduleRealtimeCallbacks {
  onEventUpsert?: (event: ScheduleEvent) => void;
  onEventDelete?: (eventId: string) => void;
  onCommentUpsert?: (comment: EventComment) => void;
  onCommentDelete?: (commentId: string) => void;
}

export interface JoinSharedRemoteResult {
  mode: 'cloud' | 'local-fallback';
  calendar: Calendar | null;
  events: ScheduleEvent[];
  error: string | null;
}

export function generateUuidV4(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

export function isTableNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; status?: number; message?: string; details?: string };
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42883' || e.status === 404) {
    return true;
  }
  const msg = `${e.message || ''} ${e.details || ''}`;
  return /relation .*mei_schedule_.* does not exist|could not find the table .*mei_schedule_|could not find the function .*mei_schedule_/i.test(
    msg
  );
}

export function isNetworkOrOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String((error as { message?: string }).message || error);
  return /failed to fetch|network|timeout|offline|abort/i.test(msg);
}

// ============================================================================
// Local-to-Cloud UUID Re-Keying
// ============================================================================

export function rekeyLocalDataForUser(
  snapshot: ScheduleDataSnapshot,
  preferences: UserPreferences,
  authUserId: string
): {
  snapshot: ScheduleDataSnapshot;
  preferences: UserPreferences;
  idMap: Map<string, string>;
} {
  const idMap = new Map<string, string>();
  const ensureUuid = (rawId: string): string => {
    if (isValidUuid(rawId)) return rawId;
    const existing = idMap.get(rawId);
    if (existing) return existing;
    const fresh = generateUuidV4();
    idMap.set(rawId, fresh);
    return fresh;
  };
  const mapUserId = (rawUserId: string): string => {
    if (!rawUserId || rawUserId === 'local-guest' || !isValidUuid(rawUserId)) {
      return authUserId;
    }
    return rawUserId;
  };

  for (const cal of snapshot.calendars) ensureUuid(cal.id);
  for (const evt of snapshot.events) ensureUuid(evt.id);
  for (const task of snapshot.tasks) ensureUuid(task.id);
  for (const cmt of snapshot.comments) ensureUuid(cmt.id);
  for (const sess of snapshot.focusSessions) ensureUuid(sess.id);

  const calendars: Calendar[] = snapshot.calendars.map((cal) => {
    const newId = ensureUuid(cal.id);
    const members: CalendarMember[] | undefined = cal.members?.map((m) => ({
      ...m,
      calendarId: newId,
      userId: mapUserId(m.userId)
    }));
    // Deduplicate members if demo IDs collapsed to authUserId
    const dedupedMembers = members
      ? Array.from(new Map(members.map((m) => [m.userId, m])).values())
      : undefined;
    return {
      ...cal,
      id: newId,
      ownerId: mapUserId(cal.ownerId),
      members: dedupedMembers
    };
  });

  const events: ScheduleEvent[] = snapshot.events.map((evt) => ({
    ...evt,
    id: ensureUuid(evt.id),
    calendarId: ensureUuid(evt.calendarId),
    creatorId: mapUserId(evt.creatorId)
  }));

  const tasks: ScheduleTask[] = snapshot.tasks.map((task) => ({
    ...task,
    id: ensureUuid(task.id),
    userId: mapUserId(task.userId),
    calendarId: task.calendarId ? ensureUuid(task.calendarId) : null,
    scheduledEventId: task.scheduledEventId ? ensureUuid(task.scheduledEventId) : null
  }));

  const comments: EventComment[] = snapshot.comments.map((cmt) => ({
    ...cmt,
    id: ensureUuid(cmt.id),
    eventId: ensureUuid(cmt.eventId),
    authorId: mapUserId(cmt.authorId)
  }));

  const focusSessions: FocusSession[] = snapshot.focusSessions.map((sess) => ({
    ...sess,
    id: ensureUuid(sess.id),
    userId: mapUserId(sess.userId),
    eventId: sess.eventId ? ensureUuid(sess.eventId) : null,
    taskId: sess.taskId ? ensureUuid(sess.taskId) : null
  }));

  return {
    snapshot: { calendars, events, tasks, comments, focusSessions },
    preferences: { ...preferences, userId: authUserId },
    idMap
  };
}

// ============================================================================
// Exact 7-Table Snake_Case <-> CamelCase Row Mappers
// ============================================================================

export function calendarToRow(cal: Calendar): Record<string, unknown> {
  return {
    id: cal.id,
    owner_id: cal.ownerId,
    name: cal.name.slice(0, 80),
    description: cal.description || '',
    color_token: cal.colorToken || 'sky',
    icon: cal.icon || 'calendar',
    calendar_set: cal.calendarSet || 'personal',
    is_shared: Boolean(cal.isShared),
    invite_code: cal.isShared && cal.inviteCode ? cal.inviteCode : null,
    created_at: cal.createdAt,
    updated_at: cal.updatedAt
  };
}

export function rowToCalendar(row: Record<string, unknown>, members?: CalendarMember[]): Calendar {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name || '行事曆'),
    description: String(row.description || ''),
    colorToken: (row.color_token as ColorToken) || 'sky',
    icon: String(row.icon || 'calendar'),
    calendarSet: (row.calendar_set as Exclude<CalendarSetId, 'all'>) || 'personal',
    isShared: Boolean(row.is_shared),
    inviteCode: row.invite_code ? String(row.invite_code) : null,
    visible: true,
    members: members || [],
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString())
  };
}

export function calendarMemberToRow(m: CalendarMember): Record<string, unknown> {
  return {
    calendar_id: m.calendarId,
    user_id: m.userId,
    display_name: m.displayName.slice(0, 100),
    role: m.role,
    joined_at: m.joinedAt
  };
}

export function rowToCalendarMember(row: Record<string, unknown>): CalendarMember {
  return {
    calendarId: String(row.calendar_id),
    userId: String(row.user_id),
    displayName: String(row.display_name || '成員'),
    role: (row.role as CalendarRole) || 'editor',
    joinedAt: String(row.joined_at || new Date().toISOString())
  };
}

function computeReleasedMinutes(
  status: EventStatus,
  startAt: string,
  endAt: string,
  completedAt?: string | null
): number | undefined {
  if (status !== 'completed' || !completedAt) return undefined;
  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);
  const completedMs = Date.parse(completedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(completedMs)) return undefined;
  if (completedMs > startMs && completedMs < endMs) {
    return Math.max(1, Math.round((endMs - completedMs) / 60000));
  }
  return 0;
}

/**
 * Strictly omits non-SQL computed field `releasedMinutes` from DB payload
 */
export function eventToRow(evt: ScheduleEvent): Record<string, unknown> {
  return {
    id: evt.id,
    calendar_id: evt.calendarId,
    creator_id: evt.creatorId,
    title: evt.title.slice(0, 200),
    notes: evt.notes || '',
    location: evt.location || '',
    start_at: evt.startAt,
    end_at: evt.endAt,
    all_day: Boolean(evt.allDay),
    color_token: evt.colorToken || 'sky',
    category_tag: (evt.categoryTag || '一般').slice(0, 48),
    priority: evt.priority || 2,
    buffer_before_min: Math.max(0, Math.round(evt.bufferBeforeMin || 0)),
    buffer_after_min: Math.max(0, Math.round(evt.bufferAfterMin || 0)),
    is_flexible: Boolean(evt.isFlexible),
    status: evt.status || 'scheduled',
    completed_at: evt.completedAt || null,
    recurrence_rule: evt.recurrenceRule || null,
    subtasks: Array.isArray(evt.subtasks) ? evt.subtasks : [],
    reminder_minutes: Array.isArray(evt.reminderMinutes) ? evt.reminderMinutes : [15],
    external_uid: evt.externalUid || null,
    created_at: evt.createdAt,
    updated_at: evt.updatedAt
  };
}

export function rowToEvent(row: Record<string, unknown>): ScheduleEvent {
  const startAt = String(row.start_at);
  const endAt = String(row.end_at);
  const status = (row.status as EventStatus) || 'scheduled';
  const completedAt = row.completed_at ? String(row.completed_at) : null;
  const releasedMinutes = computeReleasedMinutes(status, startAt, endAt, completedAt);

  return {
    id: String(row.id),
    calendarId: String(row.calendar_id),
    creatorId: String(row.creator_id),
    title: String(row.title || '未命名行程'),
    notes: String(row.notes || ''),
    location: String(row.location || ''),
    startAt,
    endAt,
    allDay: Boolean(row.all_day),
    colorToken: (row.color_token as ColorToken) || 'sky',
    categoryTag: String(row.category_tag || '一般'),
    priority: (Number(row.priority) as PriorityLevel) || 2,
    bufferBeforeMin: Number(row.buffer_before_min) || 0,
    bufferAfterMin: Number(row.buffer_after_min) || 0,
    isFlexible: Boolean(row.is_flexible),
    status,
    completedAt,
    ...(releasedMinutes !== undefined ? { releasedMinutes } : {}),
    recurrenceRule: (row.recurrence_rule as RecurrenceRule | null) || null,
    subtasks: Array.isArray(row.subtasks) ? (row.subtasks as Subtask[]) : [],
    reminderMinutes: Array.isArray(row.reminder_minutes)
      ? (row.reminder_minutes as number[])
      : [15],
    externalUid: row.external_uid ? String(row.external_uid) : null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString())
  };
}

export function taskToRow(task: ScheduleTask): Record<string, unknown> {
  return {
    id: task.id,
    user_id: task.userId,
    calendar_id: task.calendarId || null,
    scheduled_event_id: task.scheduledEventId || null,
    title: task.title.slice(0, 200),
    notes: task.notes || '',
    estimated_minutes: Math.max(5, Math.round(task.estimatedMinutes || 30)),
    priority: task.priority || 2,
    due_date: task.dueDate || null,
    category_tag: (task.categoryTag || '待辦').slice(0, 48),
    completed: Boolean(task.completed),
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    sort_order: Number(task.sortOrder) || 0,
    created_at: task.createdAt,
    updated_at: task.updatedAt
  };
}

export function rowToTask(row: Record<string, unknown>): ScheduleTask {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    calendarId: row.calendar_id ? String(row.calendar_id) : null,
    scheduledEventId: row.scheduled_event_id ? String(row.scheduled_event_id) : null,
    title: String(row.title || '未命名待辦'),
    notes: String(row.notes || ''),
    estimatedMinutes: Number(row.estimated_minutes) || 30,
    priority: (Number(row.priority) as PriorityLevel) || 2,
    dueDate: row.due_date ? String(row.due_date) : null,
    categoryTag: String(row.category_tag || '待辦'),
    completed: Boolean(row.completed),
    subtasks: Array.isArray(row.subtasks) ? (row.subtasks as Subtask[]) : [],
    sortOrder: Number(row.sort_order) || 0,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString())
  };
}

export function commentToRow(c: EventComment): Record<string, unknown> {
  return {
    id: c.id,
    event_id: c.eventId,
    author_id: c.authorId,
    author_name: c.authorName.slice(0, 100),
    body: c.body,
    created_at: c.createdAt
  };
}

export function rowToComment(row: Record<string, unknown>): EventComment {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    authorId: String(row.author_id),
    authorName: String(row.author_name || '成員'),
    body: String(row.body || ''),
    createdAt: String(row.created_at || new Date().toISOString())
  };
}

export function focusSessionToRow(s: FocusSession): Record<string, unknown> {
  return {
    id: s.id,
    user_id: s.userId,
    event_id: s.eventId || null,
    task_id: s.taskId || null,
    category_tag: (s.categoryTag || '專注').slice(0, 48),
    planned_minutes: Math.max(1, Math.round(s.plannedMinutes || 25)),
    actual_minutes: Math.max(0, Math.round(s.actualMinutes || 0)),
    completed: Boolean(s.completed),
    started_at: s.startedAt,
    ended_at: s.endedAt
  };
}

export function rowToFocusSession(row: Record<string, unknown>): FocusSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    eventId: row.event_id ? String(row.event_id) : null,
    taskId: row.task_id ? String(row.task_id) : null,
    categoryTag: String(row.category_tag || '專注'),
    plannedMinutes: Number(row.planned_minutes) || 25,
    actualMinutes: Number(row.actual_minutes) || 0,
    completed: Boolean(row.completed),
    startedAt: String(row.started_at || new Date().toISOString()),
    endedAt: String(row.ended_at || new Date().toISOString())
  };
}

export function preferencesToRow(p: UserPreferences): Record<string, unknown> {
  return {
    user_id: p.userId,
    design_theme: p.designTheme,
    color_mode: p.colorMode,
    work_start_hour: p.workStartHour,
    work_end_hour: p.workEndHour,
    default_event_minutes: p.defaultEventMinutes,
    week_starts_on: p.weekStartsOn,
    active_calendar_set: p.activeCalendarSet,
    updated_at: p.updatedAt
  };
}

export function rowToPreferences(row: Record<string, unknown>): UserPreferences {
  return {
    userId: String(row.user_id),
    designTheme: (row.design_theme as DesignTheme) || 'sky-glass',
    colorMode: (row.color_mode as ColorMode) || 'system',
    workStartHour: Number(row.work_start_hour ?? 9),
    workEndHour: Number(row.work_end_hour ?? 18),
    defaultEventMinutes: Number(row.default_event_minutes ?? 45),
    weekStartsOn: Number(row.week_starts_on ?? 1) === 0 ? 0 : 1,
    activeCalendarSet: (row.active_calendar_set as CalendarSetId) || 'all',
    updatedAt: String(row.updated_at || new Date().toISOString())
  };
}

// ============================================================================
// Bidirectional LWW Merge & FK-Ordered Offline Sync Queue Flush
// ============================================================================

function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): {
  merged: T[];
  toPush: T[];
} {
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const mergedMap = new Map<string, T>(remoteMap);
  const toPush: T[] = [];

  for (const item of local) {
    const r = remoteMap.get(item.id);
    if (!r || item.updatedAt > r.updatedAt) {
      mergedMap.set(item.id, item);
      toPush.push(item);
    }
  }
  return { merged: Array.from(mergedMap.values()), toPush };
}

const ENTITY_TABLE_MAP: Record<SyncQueueItem['entity'], string> = {
  calendars: 'mei_schedule_calendars',
  calendar_members: 'mei_schedule_calendar_members',
  events: 'mei_schedule_events',
  tasks: 'mei_schedule_tasks',
  event_comments: 'mei_schedule_event_comments',
  focus_sessions: 'mei_schedule_focus_sessions',
  preferences: 'mei_schedule_user_preferences'
};

const UPSERT_ORDER: SyncQueueItem['entity'][] = [
  'calendars',
  'calendar_members',
  'events',
  'tasks',
  'event_comments',
  'focus_sessions',
  'preferences'
];

const DELETE_ORDER: SyncQueueItem['entity'][] = [...UPSERT_ORDER].reverse();

export async function flushSyncQueue(
  userId: string,
  queue: SyncQueueItem[],
  customClient: SupabaseClient | null = supabase
): Promise<{
  status: CloudSyncStatus;
  remainingQueue: SyncQueueItem[];
  tablesMigrated: boolean;
}> {
  if (!queue.length) {
    return { status: 'synced', remainingQueue: [], tablesMigrated: true };
  }
  if (!isValidUuid(userId) || !customClient || typeof customClient.from !== 'function') {
    return { status: 'local-only', remainingQueue: queue, tablesMigrated: true };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'offline-queued', remainingQueue: queue, tablesMigrated: true };
  }

  // Compact queue: keep latest operation per (entity, recordId)
  const compactedMap = new Map<string, SyncQueueItem>();
  for (const item of queue) {
    compactedMap.set(`${item.entity}::${item.recordId}`, item);
  }
  const compacted = Array.from(compactedMap.values());

  const upserts = compacted
    .filter((i) => i.operation === 'upsert')
    .sort((a, b) => UPSERT_ORDER.indexOf(a.entity) - UPSERT_ORDER.indexOf(b.entity));
  const deletes = compacted
    .filter((i) => i.operation === 'delete')
    .sort((a, b) => DELETE_ORDER.indexOf(a.entity) - DELETE_ORDER.indexOf(b.entity));

  const failed: SyncQueueItem[] = [];

  for (const item of [...upserts, ...deletes]) {
    const tableName = ENTITY_TABLE_MAP[item.entity];
    try {
      if (item.operation === 'upsert' && item.payload) {
        const conflictCol =
          item.entity === 'preferences'
            ? 'user_id'
            : item.entity === 'calendar_members'
            ? 'calendar_id,user_id'
            : 'id';
        const { error } = await customClient
          .from(tableName)
          .upsert(item.payload, { onConflict: conflictCol });
        if (error) {
          if (isTableNotFoundError(error)) {
            return { status: 'local-only', remainingQueue: compacted, tablesMigrated: false };
          }
          if (item.retryCount < 10) {
            failed.push({ ...item, retryCount: item.retryCount + 1 });
          }
        }
      } else if (item.operation === 'delete') {
        const idCol = item.entity === 'preferences' ? 'user_id' : 'id';
        const { error } = await customClient.from(tableName).delete().eq(idCol, item.recordId);
        if (error) {
          if (isTableNotFoundError(error)) {
            return { status: 'local-only', remainingQueue: compacted, tablesMigrated: false };
          }
          if (item.retryCount < 10) {
            failed.push({ ...item, retryCount: item.retryCount + 1 });
          }
        }
      }
    } catch (err) {
      if (isTableNotFoundError(err)) {
        return { status: 'local-only', remainingQueue: compacted, tablesMigrated: false };
      }
      if (item.retryCount < 10) {
        failed.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }
  }

  return {
    status: failed.length > 0 ? 'offline-queued' : 'synced',
    remainingQueue: failed,
    tablesMigrated: true
  };
}

export async function mergeLocalAndCloudOnSignIn(
  userId: string,
  localSnapshot: ScheduleDataSnapshot,
  localPrefs: UserPreferences,
  pendingQueue: SyncQueueItem[] = [],
  customClient: SupabaseClient | null = supabase
): Promise<CloudMergeResult> {
  if (!isValidUuid(userId) || !customClient || typeof customClient.from !== 'function') {
    return {
      status: 'local-only',
      statusMessage: '本機離線優先模式',
      tablesMigrated: false,
      mergedSnapshot: localSnapshot,
      mergedPreferences: localPrefs,
      remainingQueue: pendingQueue,
      lastSyncedAt: null
    };
  }

  const rekeyed = rekeyLocalDataForUser(localSnapshot, localPrefs, userId);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      status: 'offline-queued',
      statusMessage: '目前離線，變更將於恢復連線後自動同步',
      tablesMigrated: true,
      mergedSnapshot: rekeyed.snapshot,
      mergedPreferences: rekeyed.preferences,
      remainingQueue: pendingQueue,
      lastSyncedAt: null
    };
  }

  try {
    const [calRes, memRes, evtRes, taskRes, cmtRes, focusRes, prefRes] = await Promise.all([
      customClient.from('mei_schedule_calendars').select('*'),
      customClient.from('mei_schedule_calendar_members').select('*'),
      customClient.from('mei_schedule_events').select('*'),
      customClient.from('mei_schedule_tasks').select('*'),
      customClient.from('mei_schedule_event_comments').select('*'),
      customClient.from('mei_schedule_focus_sessions').select('*'),
      customClient.from('mei_schedule_user_preferences').select('*').eq('user_id', userId).maybeSingle()
    ]);

    const firstError =
      calRes.error ||
      memRes.error ||
      evtRes.error ||
      taskRes.error ||
      cmtRes.error ||
      focusRes.error ||
      prefRes.error;

    if (firstError) {
      if (isTableNotFoundError(firstError)) {
        return {
          status: 'local-only',
          statusMessage: '本機離線模式（雲端表待啟用）',
          tablesMigrated: false,
          mergedSnapshot: rekeyed.snapshot,
          mergedPreferences: rekeyed.preferences,
          remainingQueue: pendingQueue,
          lastSyncedAt: null
        };
      }
      if (isNetworkOrOfflineError(firstError)) {
        return {
          status: 'offline-queued',
          statusMessage: '網路暫時無法連線，已保留本機排程資料',
          tablesMigrated: true,
          mergedSnapshot: rekeyed.snapshot,
          mergedPreferences: rekeyed.preferences,
          remainingQueue: pendingQueue,
          lastSyncedAt: null
        };
      }
      return {
        status: 'error',
        statusMessage: '雲端同步暫時異常，已安全保留本機資料',
        tablesMigrated: true,
        mergedSnapshot: rekeyed.snapshot,
        mergedPreferences: rekeyed.preferences,
        remainingQueue: pendingQueue,
        lastSyncedAt: null
      };
    }

    const remoteMembers = ((memRes.data || []) as Record<string, unknown>[]).map(rowToCalendarMember);
    const membersByCal = new Map<string, CalendarMember[]>();
    for (const m of remoteMembers) {
      const list = membersByCal.get(m.calendarId) || [];
      list.push(m);
      membersByCal.set(m.calendarId, list);
    }

    const remoteCalendars = ((calRes.data || []) as Record<string, unknown>[]).map((r) =>
      rowToCalendar(r, membersByCal.get(String(r.id)) || [])
    );
    const remoteEvents = ((evtRes.data || []) as Record<string, unknown>[]).map(rowToEvent);
    const remoteTasks = ((taskRes.data || []) as Record<string, unknown>[]).map(rowToTask);
    const remoteComments = ((cmtRes.data || []) as Record<string, unknown>[]).map(rowToComment);
    const remoteFocus = ((focusRes.data || []) as Record<string, unknown>[]).map(rowToFocusSession);
    const remotePref = prefRes.data ? rowToPreferences(prefRes.data as Record<string, unknown>) : null;

    // 1. Merge Calendars
    const calMerge = mergeByUpdatedAt(rekeyed.snapshot.calendars, remoteCalendars);

    // 2. Merge Events (dedup by id OR matching externalUid)
    const remoteByExtUid = new Map<string, ScheduleEvent>();
    for (const r of remoteEvents) {
      if (r.externalUid) remoteByExtUid.set(r.externalUid, r);
    }
    const localEventsNormalized = rekeyed.snapshot.events.map((evt) => {
      if (evt.externalUid && remoteByExtUid.has(evt.externalUid)) {
        const match = remoteByExtUid.get(evt.externalUid)!;
        return { ...evt, id: match.id };
      }
      return evt;
    });
    const evtMerge = mergeByUpdatedAt(localEventsNormalized, remoteEvents);

    // 3. Merge Tasks
    const taskMerge = mergeByUpdatedAt(rekeyed.snapshot.tasks, remoteTasks);

    // 4. Union Comments
    const commentMap = new Map<string, EventComment>();
    for (const c of remoteComments) commentMap.set(c.id, c);
    const commentsToPush: EventComment[] = [];
    for (const c of rekeyed.snapshot.comments) {
      if (!commentMap.has(c.id)) {
        commentMap.set(c.id, c);
        commentsToPush.push(c);
      }
    }
    const mergedComments = Array.from(commentMap.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );

    // 5. Union Focus Sessions
    const focusMap = new Map<string, FocusSession>();
    for (const f of remoteFocus) focusMap.set(f.id, f);
    const focusToPush: FocusSession[] = [];
    for (const f of rekeyed.snapshot.focusSessions) {
      if (!focusMap.has(f.id)) {
        focusMap.set(f.id, f);
        focusToPush.push(f);
      }
    }
    const mergedFocus = Array.from(focusMap.values());

    // 6. Merge Preferences
    const mergedPreferences =
      remotePref && remotePref.updatedAt >= rekeyed.preferences.updatedAt
        ? remotePref
        : rekeyed.preferences;

    // 7. Push local-only / newer records in FK-safe order
    if (calMerge.toPush.length > 0) {
      await customClient
        .from('mei_schedule_calendars')
        .upsert(calMerge.toPush.map(calendarToRow), { onConflict: 'id' });
    }
    if (evtMerge.toPush.length > 0) {
      await customClient
        .from('mei_schedule_events')
        .upsert(evtMerge.toPush.map(eventToRow), { onConflict: 'id' });
    }
    if (taskMerge.toPush.length > 0) {
      await customClient
        .from('mei_schedule_tasks')
        .upsert(taskMerge.toPush.map(taskToRow), { onConflict: 'id' });
    }
    if (commentsToPush.length > 0) {
      await customClient
        .from('mei_schedule_event_comments')
        .upsert(commentsToPush.map(commentToRow), { onConflict: 'id' });
    }
    if (focusToPush.length > 0) {
      await customClient
        .from('mei_schedule_focus_sessions')
        .upsert(focusToPush.map(focusSessionToRow), { onConflict: 'id' });
    }
    await customClient
      .from('mei_schedule_user_preferences')
      .upsert(preferencesToRow(mergedPreferences), { onConflict: 'user_id' });

    const flushRes = await flushSyncQueue(userId, pendingQueue, customClient);
    const lastSyncedAt = new Date().toISOString();

    return {
      status: flushRes.status,
      statusMessage: flushRes.remainingQueue.length > 0 ? '部分離線變更待重試同步' : '雲端即時同步已連線',
      tablesMigrated: flushRes.tablesMigrated,
      mergedSnapshot: {
        calendars: calMerge.merged,
        events: evtMerge.merged,
        tasks: taskMerge.merged.sort((a, b) => a.sortOrder - b.sortOrder),
        comments: mergedComments,
        focusSessions: mergedFocus
      },
      mergedPreferences,
      remainingQueue: flushRes.remainingQueue,
      lastSyncedAt
    };
  } catch (err) {
    if (isTableNotFoundError(err)) {
      return {
        status: 'local-only',
        statusMessage: '本機離線模式（雲端表待啟用）',
        tablesMigrated: false,
        mergedSnapshot: rekeyed.snapshot,
        mergedPreferences: rekeyed.preferences,
        remainingQueue: pendingQueue,
        lastSyncedAt: null
      };
    }
    return {
      status: isNetworkOrOfflineError(err) ? 'offline-queued' : 'error',
      statusMessage: '雲端同步暫時中斷，已安全保留本機排程',
      tablesMigrated: true,
      mergedSnapshot: rekeyed.snapshot,
      mergedPreferences: rekeyed.preferences,
      remainingQueue: pendingQueue,
      lastSyncedAt: null
    };
  }
}

export async function joinSharedCalendarRemote(
  inviteCode: string,
  displayName: string,
  customClient: SupabaseClient | null = supabase
): Promise<JoinSharedRemoteResult> {
  const cleanCode = inviteCode.trim().toUpperCase();
  if (!cleanCode) {
    return { mode: 'local-fallback', calendar: null, events: [], error: '請輸入有效的邀請碼' };
  }
  if (!customClient || typeof customClient.rpc !== 'function') {
    return { mode: 'local-fallback', calendar: null, events: [], error: null };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { mode: 'local-fallback', calendar: null, events: [], error: null };
  }

  try {
    const { data: calendarId, error } = await customClient.rpc('mei_schedule_join_by_invite_code', {
      p_invite_code: cleanCode,
      p_display_name: displayName || '成員'
    });

    if (error) {
      if (isTableNotFoundError(error) || isNetworkOrOfflineError(error)) {
        return { mode: 'local-fallback', calendar: null, events: [], error: null };
      }
      return {
        mode: 'cloud',
        calendar: null,
        events: [],
        error: error.message || '無效或已過期的共享日曆邀請碼'
      };
    }

    if (!calendarId) {
      return { mode: 'cloud', calendar: null, events: [], error: '找不到對應的共享日曆' };
    }

    const [calRes, memRes, evtRes] = await Promise.all([
      customClient.from('mei_schedule_calendars').select('*').eq('id', calendarId).maybeSingle(),
      customClient.from('mei_schedule_calendar_members').select('*').eq('calendar_id', calendarId),
      customClient.from('mei_schedule_events').select('*').eq('calendar_id', calendarId)
    ]);

    if (!calRes.data) {
      return { mode: 'cloud', calendar: null, events: [], error: '無法讀取已加入的共享日曆' };
    }

    const members = ((memRes.data || []) as Record<string, unknown>[]).map(rowToCalendarMember);
    const calendar = rowToCalendar(calRes.data as Record<string, unknown>, members);
    const events = ((evtRes.data || []) as Record<string, unknown>[]).map(rowToEvent);
    return { mode: 'cloud', calendar, events, error: null };
  } catch (err) {
    if (isTableNotFoundError(err) || isNetworkOrOfflineError(err)) {
      return { mode: 'local-fallback', calendar: null, events: [], error: null };
    }
    return {
      mode: 'cloud',
      calendar: null,
      events: [],
      error: err instanceof Error ? err.message : '加入共享日曆失敗'
    };
  }
}

// ============================================================================
// Supabase Realtime Subscriptions (mei_schedule_events & mei_schedule_event_comments)
// ============================================================================

export function subscribeScheduleRealtime(
  userId: string,
  callbacks: ScheduleRealtimeCallbacks,
  customClient: SupabaseClient | null = supabase
): () => void {
  if (!isValidUuid(userId) || !customClient || typeof customClient.channel !== 'function') {
    return () => {};
  }

  const isJsdomTestEnv =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
  if (isJsdomTestEnv && customClient === supabase) {
    return () => {};
  }

  try {
    const channel = customClient
      .channel(`mei_schedule_realtime_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mei_schedule_events' },
        (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            callbacks.onEventDelete?.(String(payload.old.id));
          } else if (payload.new && payload.new.id) {
            callbacks.onEventUpsert?.(rowToEvent(payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mei_schedule_event_comments' },
        (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            callbacks.onCommentDelete?.(String(payload.old.id));
          } else if (payload.new && payload.new.id) {
            callbacks.onCommentUpsert?.(rowToComment(payload.new));
          }
        }
      );

    channel.subscribe();

    return () => {
      try {
        void channel.unsubscribe();
        if (typeof customClient.removeChannel === 'function') {
          void customClient.removeChannel(channel);
        }
      } catch {
        // Ignore teardown errors
      }
    };
  } catch {
    return () => {};
  }
}
