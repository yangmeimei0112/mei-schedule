import type {
  ConflictInfo,
  ExpandedEventInstance,
  FocusSession,
  ScheduleEvent,
  ScheduleProposal,
  ScheduleTask,
  SmartProposalResult,
  UserPreferences
} from '../types/schedule';
import { expandRecurringEvents, parseLocalDateKey, toLocalDateKey } from './recurrenceEngine';
import { generateUuidV4 } from './scheduleSyncService';

// ============================================================================
// Smart Scheduler, Conflict Detector & Preview-Mode Diff Engine
// Pure deterministic functions — NEVER mutate input arrays.
// ============================================================================

const SNAP_MINUTES = 15;
const MS_PER_MIN = 60_000;

interface OccupiedInterval {
  eventId: string;
  startMs: number;
  endMs: number;
  effectiveStartMs: number;
  effectiveEndMs: number;
}

function snapUp15(ms: number): number {
  const step = SNAP_MINUTES * MS_PER_MIN;
  return Math.ceil(ms / step) * step;
}

function buildOccupiedIntervals(instances: ExpandedEventInstance[]): OccupiedInterval[] {
  return instances
    .filter((e) => !e.allDay && e.status !== 'canceled')
    .map((e) => {
      const startMs = Date.parse(e.startAt);
      const endMs = Date.parse(e.endAt);
      return {
        eventId: e.masterEventId || e.id,
        startMs,
        endMs,
        effectiveStartMs: startMs - (e.bufferBeforeMin || 0) * MS_PER_MIN,
        effectiveEndMs: endMs + (e.bufferAfterMin || 0) * MS_PER_MIN
      };
    })
    .filter((i) => !Number.isNaN(i.startMs) && !Number.isNaN(i.endMs) && i.endMs > i.startMs)
    .sort((a, b) => a.effectiveStartMs - b.effectiveStartMs);
}

/**
 * Detects both direct time overlaps and buffer-zone collisions among scheduled events.
 */
export function detectScheduleConflicts(
  instances: Array<ScheduleEvent | ExpandedEventInstance>
): ConflictInfo[] {
  const timed = instances
    .filter((e) => !e.allDay && e.status !== 'canceled')
    .map((e) => ({
      id: 'instanceId' in e ? e.instanceId : e.id,
      startMs: Date.parse(e.startAt),
      endMs: Date.parse(e.endAt),
      bufStartMs: Date.parse(e.startAt) - (e.bufferBeforeMin || 0) * MS_PER_MIN,
      bufEndMs: Date.parse(e.endAt) + (e.bufferAfterMin || 0) * MS_PER_MIN
    }))
    .filter((i) => !Number.isNaN(i.startMs) && !Number.isNaN(i.endMs))
    .sort((a, b) => a.bufStartMs - b.bufStartMs);

  const conflicts: ConflictInfo[] = [];

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (b.bufStartMs >= a.bufEndMs) break;

      const directStart = Math.max(a.startMs, b.startMs);
      const directEnd = Math.min(a.endMs, b.endMs);
      if (directEnd > directStart) {
        conflicts.push({
          eventIdA: a.id,
          eventIdB: b.id,
          overlapStart: new Date(directStart).toISOString(),
          overlapEnd: new Date(directEnd).toISOString(),
          overlapMinutes: Math.round((directEnd - directStart) / MS_PER_MIN),
          conflictType: 'direct'
        });
        continue;
      }

      const bufOverlapStart = Math.max(a.bufStartMs, b.bufStartMs);
      const bufOverlapEnd = Math.min(a.bufEndMs, b.bufEndMs);
      if (bufOverlapEnd > bufOverlapStart) {
        conflicts.push({
          eventIdA: a.id,
          eventIdB: b.id,
          overlapStart: new Date(bufOverlapStart).toISOString(),
          overlapEnd: new Date(bufOverlapEnd).toISOString(),
          overlapMinutes: Math.round((bufOverlapEnd - bufOverlapStart) / MS_PER_MIN),
          conflictType: 'buffer'
        });
      }
    }
  }

  return conflicts;
}

function findNextFreeSlot(
  durationMinutes: number,
  occupied: OccupiedInterval[],
  workStartHour: number,
  workEndHour: number,
  startDayKey: string,
  daysAhead: number,
  earliestMs: number
): { startMs: number; endMs: number } | null {
  const durationMs = Math.max(15, durationMinutes) * MS_PER_MIN;
  const startDay = parseLocalDateKey(startDayKey);

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const day = new Date(
      startDay.getFullYear(),
      startDay.getMonth(),
      startDay.getDate() + dayOffset
    );
    const windowStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      workStartHour,
      0,
      0,
      0
    ).getTime();
    const windowEnd = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      workEndHour,
      0,
      0,
      0
    ).getTime();

    if (windowEnd - windowStart < durationMs) continue;

    let cursor = Math.max(windowStart, snapUp15(earliestMs));
    if (cursor + durationMs > windowEnd) continue;

    // Filter occupied intervals touching this day's window
    const dayBusy = occupied
      .filter((o) => o.effectiveEndMs > windowStart && o.effectiveStartMs < windowEnd)
      .sort((a, b) => a.effectiveStartMs - b.effectiveStartMs);

    for (const busy of dayBusy) {
      if (cursor + durationMs <= busy.effectiveStartMs) {
        return { startMs: cursor, endMs: cursor + durationMs };
      }
      if (busy.effectiveEndMs > cursor) {
        cursor = snapUp15(busy.effectiveEndMs);
      }
      if (cursor + durationMs > windowEnd) break;
    }

    if (cursor + durationMs <= windowEnd) {
      return { startMs: cursor, endMs: cursor + durationMs };
    }
  }

  return null;
}

/**
 * Preview-mode Auto-Fill: proposes time blocks for unscheduled incomplete tasks
 * ordered by priority -> dueDate -> sortOrder, respecting work window & buffers.
 */
export function proposeAutoFill(
  tasks: ScheduleTask[],
  existingEvents: ScheduleEvent[],
  prefs: Pick<UserPreferences, 'workStartHour' | 'workEndHour'>,
  referenceDate: Date = new Date(),
  daysAhead = 5
): SmartProposalResult {
  const unscheduled = tasks
    .filter((t) => !t.completed && !t.scheduledEventId)
    .slice()
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return a.sortOrder - b.sortOrder;
    });

  const startKey = toLocalDateKey(referenceDate);
  const endDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + Math.max(1, daysAhead)
  );
  const endKey = toLocalDateKey(endDate);

  const expanded = expandRecurringEvents(existingEvents, startKey, endKey);
  const occupied = buildOccupiedIntervals(expanded);
  const lockedEventIds = existingEvents.filter((e) => !e.isFlexible).map((e) => e.id);

  const proposals: ScheduleProposal[] = [];
  const unscheduledItems: SmartProposalResult['unscheduledItems'] = [];

  const earliestMs = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    prefs.workStartHour,
    0,
    0,
    0
  ).getTime();

  for (const task of unscheduled) {
    const dur = Math.max(15, task.estimatedMinutes || 30);
    const slot = findNextFreeSlot(
      dur,
      occupied,
      prefs.workStartHour,
      prefs.workEndHour,
      startKey,
      daysAhead,
      earliestMs
    );

    if (!slot) {
      unscheduledItems.push({
        id: task.id,
        title: task.title,
        reason: `未來 ${daysAhead} 天的工作時段 (${prefs.workStartHour}:00–${prefs.workEndHour}:00) 已滿，建議延長排程範圍或縮短估時`
      });
      continue;
    }

    const prop: ScheduleProposal = {
      id: generateUuidV4(),
      action: 'schedule_task',
      targetId: task.id,
      title: task.title,
      priority: task.priority,
      categoryTag: task.categoryTag || '待辦',
      isFlexible: true,
      originalStartAt: null,
      originalEndAt: null,
      proposedStartAt: new Date(slot.startMs).toISOString(),
      proposedEndAt: new Date(slot.endMs).toISOString(),
      reason: `依優先級 P${task.priority}${task.dueDate ? ` 與截止日 ${task.dueDate}` : ''} 自動安排至空檔並保留緩衝`,
      selected: true
    };
    proposals.push(prop);

    // Reserve this slot + 5m breathing buffer so subsequent tasks never overlap
    occupied.push({
      eventId: task.id,
      startMs: slot.startMs,
      endMs: slot.endMs,
      effectiveStartMs: slot.startMs,
      effectiveEndMs: slot.endMs + 5 * MS_PER_MIN
    });
  }

  return { proposals, lockedEventIds, unscheduledItems };
}

/**
 * Preview-mode Smart Push: delays a target event (or pushes flexible events colliding
 * with a delayed/extended anchor) while strictly preserving non-flexible locked events.
 */
export function proposeSmartPush(
  delayedEventId: string,
  delayMinutes: number,
  allEvents: ScheduleEvent[],
  prefs: Pick<UserPreferences, 'workStartHour' | 'workEndHour'>,
  daysAhead = 4
): SmartProposalResult {
  const anchor = allEvents.find((e) => e.id === delayedEventId);
  if (!anchor || delayMinutes <= 0) {
    return {
      proposals: [],
      lockedEventIds: allEvents.filter((e) => !e.isFlexible).map((e) => e.id),
      unscheduledItems: []
    };
  }

  const anchorOrigStart = Date.parse(anchor.startAt);
  const anchorOrigEnd = Date.parse(anchor.endAt);
  const anchorNewEnd = anchorOrigEnd + delayMinutes * MS_PER_MIN;
  const anchorDateKey = toLocalDateKey(new Date(anchorOrigStart));

  const lockedEvents = allEvents.filter(
    (e) => e.id !== anchor.id && !e.allDay && e.status !== 'canceled' && !e.isFlexible
  );
  const lockedEventIds = lockedEvents.map((e) => e.id);

  const proposals: ScheduleProposal[] = [];
  const unscheduledItems: SmartProposalResult['unscheduledItems'] = [];

  // Occupied map starts with delayed anchor + all locked events
  const occupied: OccupiedInterval[] = [
    {
      eventId: anchor.id,
      startMs: anchorOrigStart,
      endMs: anchorNewEnd,
      effectiveStartMs: anchorOrigStart - (anchor.bufferBeforeMin || 0) * MS_PER_MIN,
      effectiveEndMs: anchorNewEnd + (anchor.bufferAfterMin || 0) * MS_PER_MIN
    },
    ...lockedEvents.map((e) => {
      const s = Date.parse(e.startAt);
      const en = Date.parse(e.endAt);
      return {
        eventId: e.id,
        startMs: s,
        endMs: en,
        effectiveStartMs: s - (e.bufferBeforeMin || 0) * MS_PER_MIN,
        effectiveEndMs: en + (e.bufferAfterMin || 0) * MS_PER_MIN
      };
    })
  ];

  // If the anchor itself is flexible, propose extending its end time by delayMinutes
  if (anchor.isFlexible) {
    proposals.push({
      id: generateUuidV4(),
      action: 'reschedule_event',
      targetId: anchor.id,
      title: anchor.title,
      priority: anchor.priority,
      categoryTag: anchor.categoryTag,
      isFlexible: true,
      originalStartAt: anchor.startAt,
      originalEndAt: anchor.endAt,
      proposedStartAt: anchor.startAt,
      proposedEndAt: new Date(anchorNewEnd).toISOString(),
      reason: `依延誤設定順延結束時間 +${delayMinutes} 分鐘`,
      selected: true
    });
  }

  // Find subsequent flexible events on the same day that now collide with occupied intervals
  const flexibleCandidates = allEvents
    .filter(
      (e) =>
        e.id !== anchor.id &&
        e.isFlexible &&
        !e.allDay &&
        e.status === 'scheduled' &&
        Date.parse(e.endAt) > anchorOrigStart &&
        toLocalDateKey(new Date(e.startAt)) === anchorDateKey
    )
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

  for (const evt of flexibleCandidates) {
    const s = Date.parse(evt.startAt);
    const en = Date.parse(evt.endAt);
    const durMin = Math.max(15, Math.round((en - s) / MS_PER_MIN));
    const effStart = s - (evt.bufferBeforeMin || 0) * MS_PER_MIN;
    const effEnd = en + (evt.bufferAfterMin || 0) * MS_PER_MIN;

    const hasCollision = occupied.some(
      (o) => effStart < o.effectiveEndMs && effEnd > o.effectiveStartMs
    );

    if (!hasCollision) {
      occupied.push({
        eventId: evt.id,
        startMs: s,
        endMs: en,
        effectiveStartMs: effStart,
        effectiveEndMs: effEnd
      });
      continue;
    }

    const nextSlot = findNextFreeSlot(
      durMin,
      occupied,
      prefs.workStartHour,
      prefs.workEndHour,
      anchorDateKey,
      daysAhead,
      Math.max(anchorNewEnd, s)
    );

    if (!nextSlot) {
      unscheduledItems.push({
        id: evt.id,
        title: evt.title,
        reason: '無法於近期工作時段找到無衝突空檔，請手動調整'
      });
      continue;
    }

    proposals.push({
      id: generateUuidV4(),
      action: 'reschedule_event',
      targetId: evt.id,
      title: evt.title,
      priority: evt.priority,
      categoryTag: evt.categoryTag,
      isFlexible: true,
      originalStartAt: evt.startAt,
      originalEndAt: evt.endAt,
      proposedStartAt: new Date(nextSlot.startMs).toISOString(),
      proposedEndAt: new Date(nextSlot.endMs).toISOString(),
      reason: `避開「${anchor.title}」延誤衝突並繞過鎖定會議`,
      selected: true
    });

    occupied.push({
      eventId: evt.id,
      startMs: nextSlot.startMs,
      endMs: nextSlot.endMs,
      effectiveStartMs: nextSlot.startMs - (evt.bufferBeforeMin || 0) * MS_PER_MIN,
      effectiveEndMs: nextSlot.endMs + (evt.bufferAfterMin || 0) * MS_PER_MIN
    });
  }

  return { proposals, lockedEventIds, unscheduledItems };
}

// ============================================================================
// Analytics & Focus Habit Streak Calculator
// ============================================================================

export interface CategoryBreakdownItem {
  categoryTag: string;
  scheduledMinutes: number;
  focusMinutes: number;
  eventCount: number;
  percentage: number;
}

export interface AnalyticsSummary {
  totalFocusMinutes: number;
  todayFocusMinutes: number;
  totalSessions: number;
  streakDays: number;
  eventCompletionRate: number;
  completedEventsCount: number;
  totalEventsCount: number;
  taskCompletionRate: number;
  completedTasksCount: number;
  totalTasksCount: number;
  releasedMinutesTotal: number;
  categoryBreakdown: CategoryBreakdownItem[];
  last7DaysFocus: Array<{ dateKey: string; label: string; minutes: number }>;
}

export function computeAnalyticsSummary(
  events: ScheduleEvent[],
  tasks: ScheduleTask[],
  focusSessions: FocusSession[],
  referenceDate: Date = new Date()
): AnalyticsSummary {
  const todayKey = toLocalDateKey(referenceDate);
  const completedSessions = focusSessions.filter((s) => s.completed);

  const totalFocusMinutes = completedSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
  const todayFocusMinutes = completedSessions
    .filter((s) => toLocalDateKey(new Date(s.endedAt || s.startedAt)) === todayKey)
    .reduce((acc, s) => acc + (s.actualMinutes || 0), 0);

  // Streak calculation: consecutive days ending today (or yesterday if none today yet)
  const activeFocusDays = new Set(
    completedSessions.map((s) => toLocalDateKey(new Date(s.endedAt || s.startedAt)))
  );
  let streakDays = 0;
  let cursor = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  if (!activeFocusDays.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeFocusDays.has(toLocalDateKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const activeEvents = events.filter((e) => e.status !== 'canceled');
  const completedEventsCount = activeEvents.filter((e) => e.status === 'completed').length;
  const eventCompletionRate =
    activeEvents.length > 0 ? Math.round((completedEventsCount / activeEvents.length) * 100) : 0;

  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const taskCompletionRate =
    tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  const releasedMinutesTotal = activeEvents.reduce((sum, e) => sum + (e.releasedMinutes || 0), 0);

  // Category distribution
  const catMap = new Map<string, { scheduledMinutes: number; focusMinutes: number; eventCount: number }>();
  for (const evt of activeEvents) {
    if (evt.allDay) continue;
    const tag = evt.categoryTag || '一般';
    const dur = Math.max(0, Math.round((Date.parse(evt.endAt) - Date.parse(evt.startAt)) / MS_PER_MIN));
    const cur = catMap.get(tag) || { scheduledMinutes: 0, focusMinutes: 0, eventCount: 0 };
    cur.scheduledMinutes += dur;
    cur.eventCount += 1;
    catMap.set(tag, cur);
  }
  for (const ses of completedSessions) {
    const tag = ses.categoryTag || '專注';
    const cur = catMap.get(tag) || { scheduledMinutes: 0, focusMinutes: 0, eventCount: 0 };
    cur.focusMinutes += ses.actualMinutes || 0;
    catMap.set(tag, cur);
  }

  const totalCatWeight = Array.from(catMap.values()).reduce(
    (sum, v) => sum + v.scheduledMinutes + v.focusMinutes,
    0
  );
  const categoryBreakdown: CategoryBreakdownItem[] = Array.from(catMap.entries())
    .map(([categoryTag, stats]) => ({
      categoryTag,
      ...stats,
      percentage:
        totalCatWeight > 0
          ? Math.round(((stats.scheduledMinutes + stats.focusMinutes) / totalCatWeight) * 100)
          : 0
    }))
    .sort((a, b) => b.scheduledMinutes + b.focusMinutes - (a.scheduledMinutes + a.focusMinutes));

  // Last 7 days daily focus chart
  const last7DaysFocus: AnalyticsSummary['last7DaysFocus'] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + offset
    );
    const dk = toLocalDateKey(d);
    const mins = completedSessions
      .filter((s) => toLocalDateKey(new Date(s.endedAt || s.startedAt)) === dk)
      .reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
    last7DaysFocus.push({
      dateKey: dk,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      minutes: mins
    });
  }

  return {
    totalFocusMinutes,
    todayFocusMinutes,
    totalSessions: completedSessions.length,
    streakDays,
    eventCompletionRate,
    completedEventsCount,
    totalEventsCount: activeEvents.length,
    taskCompletionRate,
    completedTasksCount,
    totalTasksCount: tasks.length,
    releasedMinutesTotal,
    categoryBreakdown,
    last7DaysFocus
  };
}
