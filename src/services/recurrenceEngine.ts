import type {
  ExpandedEventInstance,
  RecurrenceEditScope,
  RecurrenceRule,
  ScheduleEvent
} from '../types/schedule';
import { generateUuidV4 } from './scheduleSyncService';

// ============================================================================
// Free Flexible Recurrence Expansion & Series Edit Engine
// Supports: daily, weekly (byWeekday), monthly (with month-end clamping),
// every_n_days, interval, until, count, exceptions, and single / following / all edits.
// ============================================================================

const MS_PER_DAY = 86_400_000;
const MAX_EXPANSION_ITERATIONS = 1096; // 3 years safety cap per event

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseLocalDateKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildOccurrenceTimestamps(
  master: ScheduleEvent,
  occDate: Date
): { startAt: string; endAt: string } {
  const origStart = new Date(master.startAt);
  const origEnd = new Date(master.endAt);
  const durationMs = Math.max(15 * 60000, origEnd.getTime() - origStart.getTime());

  if (master.allDay) {
    const start = new Date(occDate.getFullYear(), occDate.getMonth(), occDate.getDate(), 0, 0, 0, 0);
    const end = new Date(occDate.getFullYear(), occDate.getMonth(), occDate.getDate(), 23, 59, 0, 0);
    return { startAt: start.toISOString(), endAt: end.toISOString() };
  }

  const start = new Date(
    occDate.getFullYear(),
    occDate.getMonth(),
    occDate.getDate(),
    origStart.getHours(),
    origStart.getMinutes(),
    origStart.getSeconds(),
    0
  );
  const end = new Date(start.getTime() + durationMs);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function parseUntilDateKey(until?: string | null): string | null {
  if (!until) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(until)) return until;
  const parsed = new Date(until);
  if (Number.isNaN(parsed.getTime())) return null;
  return toLocalDateKey(parsed);
}

/**
 * Expands a single event (recurring or non-recurring) into concrete instances
 * overlapping [rangeStartKey, rangeEndKey] inclusive.
 */
export function expandSingleEvent(
  event: ScheduleEvent,
  rangeStartKey: string,
  rangeEndKey: string
): ExpandedEventInstance[] {
  if (event.status === 'canceled') return [];

  const startDate = new Date(event.startAt);
  const endDate = new Date(event.endAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];

  const eventStartKey = toLocalDateKey(startDate);
  const eventEndKey = toLocalDateKey(endDate);

  // Non-recurring event
  if (!event.recurrenceRule) {
    if (eventEndKey < rangeStartKey || eventStartKey > rangeEndKey) {
      return [];
    }
    return [
      {
        ...event,
        instanceId: event.id,
        masterEventId: event.id,
        occurrenceDate: eventStartKey,
        isRecurringInstance: false
      }
    ];
  }

  const rule = event.recurrenceRule;
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const untilKey = parseUntilDateKey(rule.until);
  const maxCount = typeof rule.count === 'number' && rule.count > 0 ? Math.floor(rule.count) : null;
  const exceptionSet = new Set(rule.exceptions || []);

  const effectiveEndKey = untilKey && untilKey < rangeEndKey ? untilKey : rangeEndKey;
  if (eventStartKey > effectiveEndKey) return [];

  const results: ExpandedEventInstance[] = [];
  const originLocal = parseLocalDateKey(eventStartKey);
  const effectiveEndLocal = parseLocalDateKey(effectiveEndKey);

  let emittedTotalCount = 0;

  const tryPushOccurrence = (candidateDate: Date): boolean => {
    const occKey = toLocalDateKey(candidateDate);
    if (occKey < eventStartKey) return true;
    if (untilKey && occKey > untilKey) return false;

    // Count increments for every rule-generated occurrence (even if before rangeStartKey)
    emittedTotalCount += 1;
    if (maxCount !== null && emittedTotalCount > maxCount) {
      return false;
    }

    if (occKey > effectiveEndKey) {
      return false;
    }

    if (occKey >= rangeStartKey && !exceptionSet.has(occKey)) {
      const { startAt, endAt } = buildOccurrenceTimestamps(event, candidateDate);
      results.push({
        ...event,
        startAt,
        endAt,
        instanceId: `${event.id}::${occKey}`,
        masterEventId: event.id,
        occurrenceDate: occKey,
        isRecurringInstance: true
      });
    }
    return true;
  };

  if (rule.freq === 'daily' || rule.freq === 'every_n_days') {
    const stepDays = interval;
    let cursor = new Date(originLocal);
    let safety = 0;
    while (cursor.getTime() <= effectiveEndLocal.getTime() && safety < MAX_EXPANSION_ITERATIONS) {
      safety += 1;
      if (!tryPushOccurrence(cursor)) break;
      cursor = addLocalDays(cursor, stepDays);
    }
  } else if (rule.freq === 'weekly') {
    const weekdays =
      Array.isArray(rule.byWeekday) && rule.byWeekday.length > 0
        ? [...new Set(rule.byWeekday.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
        : [originLocal.getDay()];

    // Start from the Sunday of originLocal's week
    const weekZeroSunday = addLocalDays(originLocal, -originLocal.getDay());
    let weekIndex = 0;
    let safety = 0;
    while (safety < MAX_EXPANSION_ITERATIONS) {
      safety += 1;
      const weekStart = addLocalDays(weekZeroSunday, weekIndex * interval * 7);
      if (weekStart.getTime() > effectiveEndLocal.getTime()) break;

      let stopped = false;
      for (const dow of weekdays) {
        const candidate = addLocalDays(weekStart, dow);
        if (toLocalDateKey(candidate) < eventStartKey) continue;
        if (!tryPushOccurrence(candidate)) {
          stopped = true;
          break;
        }
      }
      if (stopped) break;
      weekIndex += 1;
    }
  } else if (rule.freq === 'monthly') {
    const desiredDay = Math.min(31, Math.max(1, rule.byMonthDay || originLocal.getDate()));
    let monthOffset = 0;
    let safety = 0;
    while (safety < MAX_EXPANSION_ITERATIONS) {
      safety += 1;
      const totalMonths = originLocal.getFullYear() * 12 + originLocal.getMonth() + monthOffset * interval;
      const y = Math.floor(totalMonths / 12);
      const m = totalMonths % 12;
      const clampedDay = Math.min(desiredDay, daysInMonth(y, m));
      const candidate = new Date(y, m, clampedDay, 0, 0, 0, 0);
      if (candidate.getTime() > effectiveEndLocal.getTime()) break;
      if (!tryPushOccurrence(candidate)) break;
      monthOffset += 1;
    }
  }

  return results;
}

/**
 * Expands all events across a date range and sorts chronologically by startAt.
 */
export function expandRecurringEvents(
  events: ScheduleEvent[],
  rangeStartKey: string,
  rangeEndKey: string
): ExpandedEventInstance[] {
  const expanded: ExpandedEventInstance[] = [];
  for (const evt of events) {
    expanded.push(...expandSingleEvent(evt, rangeStartKey, rangeEndKey));
  }
  expanded.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return Date.parse(a.startAt) - Date.parse(b.startAt);
  });
  return expanded;
}

/**
 * Applies a recurrence-aware edit ('single' | 'this_and_following' | 'all')
 * and returns a brand-new immutable ScheduleEvent[] array for atomic commit.
 */
export function applyRecurringEdit(
  events: ScheduleEvent[],
  masterEventId: string,
  occurrenceDate: string,
  scope: RecurrenceEditScope,
  updates: Partial<ScheduleEvent>
): ScheduleEvent[] {
  const master = events.find((e) => e.id === masterEventId);
  if (!master) return events;

  const nowIso = new Date().toISOString();

  // If non-recurring or scope === 'all', update master directly
  if (!master.recurrenceRule || scope === 'all') {
    return events.map((e) =>
      e.id === masterEventId ? { ...e, ...updates, updatedAt: nowIso } : e
    );
  }

  if (scope === 'single') {
    const existingExceptions = master.recurrenceRule.exceptions || [];
    const updatedMaster: ScheduleEvent = {
      ...master,
      recurrenceRule: {
        ...master.recurrenceRule,
        exceptions: existingExceptions.includes(occurrenceDate)
          ? existingExceptions
          : [...existingExceptions, occurrenceDate]
      },
      updatedAt: nowIso
    };

    const occTimestamps = buildOccurrenceTimestamps(master, parseLocalDateKey(occurrenceDate));
    const detachedEvent: ScheduleEvent = {
      ...master,
      ...occTimestamps,
      ...updates,
      id: generateUuidV4(),
      recurrenceRule: null,
      externalUid: `mei-${generateUuidV4()}@meischedule.app`,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    return events
      .map((e) => (e.id === masterEventId ? updatedMaster : e))
      .concat(detachedEvent);
  }

  // scope === 'this_and_following'
  const masterStartKey = toLocalDateKey(new Date(master.startAt));
  if (occurrenceDate <= masterStartKey) {
    return events.map((e) =>
      e.id === masterEventId ? { ...e, ...updates, updatedAt: nowIso } : e
    );
  }

  const prevDayKey = toLocalDateKey(addLocalDays(parseLocalDateKey(occurrenceDate), -1));
  const truncatedMaster: ScheduleEvent = {
    ...master,
    recurrenceRule: {
      ...master.recurrenceRule,
      until: prevDayKey
    },
    updatedAt: nowIso
  };

  const occTimestamps = buildOccurrenceTimestamps(master, parseLocalDateKey(occurrenceDate));
  const forkedSeries: ScheduleEvent = {
    ...master,
    ...occTimestamps,
    ...updates,
    id: generateUuidV4(),
    recurrenceRule:
      updates.recurrenceRule !== undefined
        ? updates.recurrenceRule
        : {
            ...master.recurrenceRule,
            exceptions: (master.recurrenceRule.exceptions || []).filter((d) => d >= occurrenceDate)
          },
    externalUid: `mei-${generateUuidV4()}@meischedule.app`,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  return events
    .map((e) => (e.id === masterEventId ? truncatedMaster : e))
    .concat(forkedSeries);
}

/**
 * Applies a recurrence-aware delete ('single' | 'this_and_following' | 'all').
 */
export function applyRecurringDelete(
  events: ScheduleEvent[],
  masterEventId: string,
  occurrenceDate: string,
  scope: RecurrenceEditScope
): ScheduleEvent[] {
  const master = events.find((e) => e.id === masterEventId);
  if (!master) return events;

  const nowIso = new Date().toISOString();

  if (!master.recurrenceRule || scope === 'all') {
    return events.filter((e) => e.id !== masterEventId);
  }

  if (scope === 'single') {
    const existingExceptions = master.recurrenceRule.exceptions || [];
    return events.map((e) =>
      e.id === masterEventId
        ? {
            ...e,
            recurrenceRule: {
              ...e.recurrenceRule!,
              exceptions: existingExceptions.includes(occurrenceDate)
                ? existingExceptions
                : [...existingExceptions, occurrenceDate]
            },
            updatedAt: nowIso
          }
        : e
    );
  }

  // this_and_following
  const masterStartKey = toLocalDateKey(new Date(master.startAt));
  if (occurrenceDate <= masterStartKey) {
    return events.filter((e) => e.id !== masterEventId);
  }

  const prevDayKey = toLocalDateKey(addLocalDays(parseLocalDateKey(occurrenceDate), -1));
  return events.map((e) =>
    e.id === masterEventId
      ? {
          ...e,
          recurrenceRule: {
            ...e.recurrenceRule!,
            until: prevDayKey
          },
          updatedAt: nowIso
        }
      : e
  );
}

/**
 * Human-readable Traditional Chinese label for a recurrence rule.
 */
export function describeRecurrenceRule(rule?: RecurrenceRule | null): string {
  if (!rule) return '不重複';
  const interval = Math.max(1, rule.interval || 1);
  let base = '';

  if (rule.freq === 'daily') {
    base = interval === 1 ? '每天重複' : `每 ${interval} 天重複`;
  } else if (rule.freq === 'every_n_days') {
    base = `每 ${interval} 天重複`;
  } else if (rule.freq === 'weekly') {
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    const days = (rule.byWeekday || []).slice().sort((a, b) => a - b);
    const dayStr = days.length > 0 ? days.map((d) => names[d]).join('、') : '';
    const prefix = interval === 1 ? '每週' : `每 ${interval} 週`;
    if (days.length === 5 && days.join(',') === '1,2,3,4,5') {
      base = interval === 1 ? '每週工作日 (一至五)' : `${prefix}工作日`;
    } else {
      base = dayStr ? `${prefix}${dayStr}` : `${prefix}重複`;
    }
  } else if (rule.freq === 'monthly') {
    const prefix = interval === 1 ? '每月' : `每 ${interval} 個月`;
    base = rule.byMonthDay ? `${prefix} ${rule.byMonthDay} 日` : `${prefix}重複`;
  }

  if (rule.until) {
    base += `（至 ${rule.until.slice(0, 10)}）`;
  } else if (rule.count) {
    base += `（共 ${rule.count} 次）`;
  }
  return base;
}

export { MS_PER_DAY };
