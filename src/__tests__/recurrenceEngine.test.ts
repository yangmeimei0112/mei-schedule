import { describe, expect, it } from 'vitest';
import {
  applyRecurringDelete,
  applyRecurringEdit,
  describeRecurrenceRule,
  expandRecurringEvents
} from '../services/recurrenceEngine';
import type { ScheduleEvent } from '../types/schedule';

function makeEvent(overrides: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: 'evt-master-1',
    calendarId: 'cal-1',
    creatorId: 'user-1',
    title: '每週同步會',
    notes: '',
    location: '',
    startAt: new Date(2026, 0, 31, 10, 0, 0, 0).toISOString(), // Jan 31, 2026
    endAt: new Date(2026, 0, 31, 11, 0, 0, 0).toISOString(),
    allDay: false,
    colorToken: 'sky',
    categoryTag: '工作',
    priority: 2,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    isFlexible: false,
    status: 'scheduled',
    recurrenceRule: null,
    subtasks: [],
    reminderMinutes: [15],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('recurrenceEngine — Expansion, Month-End Clamping & Series Edits', () => {
  it('expands monthly 31st safely with month-end clamping across Feb (28 days) & Apr (30 days)', () => {
    const monthly31 = makeEvent({
      recurrenceRule: { freq: 'monthly', interval: 1, byMonthDay: 31 }
    });

    const expanded = expandRecurringEvents([monthly31], '2026-01-01', '2026-05-01');
    expect(expanded.map((e) => e.occurrenceDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30'
    ]);
  });

  it('expands weekly byWeekday respecting count, until, and exceptions', () => {
    const weekly = makeEvent({
      startAt: new Date(2026, 10, 2, 9, 0, 0, 0).toISOString(), // Mon Nov 2, 2026
      endAt: new Date(2026, 10, 2, 9, 30, 0, 0).toISOString(),
      recurrenceRule: {
        freq: 'weekly',
        interval: 1,
        byWeekday: [1, 3, 5],
        count: 5,
        exceptions: ['2026-11-04']
      }
    });

    const expanded = expandRecurringEvents([weekly], '2026-11-01', '2026-11-30');
    // 5 total occurrences: Nov 2, 4 (excluded), 6, 9, 11 -> 4 visible instances
    expect(expanded.map((e) => e.occurrenceDate)).toEqual([
      '2026-11-02',
      '2026-11-06',
      '2026-11-09',
      '2026-11-11'
    ]);
  });

  it('supports single, this_and_following, and all edits & deletes cleanly', () => {
    const daily = makeEvent({
      startAt: new Date(2026, 10, 10, 9, 0, 0, 0).toISOString(),
      endAt: new Date(2026, 10, 10, 9, 30, 0, 0).toISOString(),
      recurrenceRule: { freq: 'daily', interval: 1, until: '2026-11-14' }
    });

    // 1. Single edit detaches Nov 12 and adds exception to master
    const afterSingle = applyRecurringEdit([daily], daily.id, '2026-11-12', 'single', {
      title: '臨時調整會議'
    });
    expect(afterSingle).toHaveLength(2);
    const expandedAfterSingle = expandRecurringEvents(afterSingle, '2026-11-10', '2026-11-14');
    expect(expandedAfterSingle).toHaveLength(5);
    expect(expandedAfterSingle.find((e) => e.occurrenceDate === '2026-11-12')?.title).toBe(
      '臨時調整會議'
    );

    // 2. this_and_following splits series cleanly from Nov 12 onward
    const afterFollowing = applyRecurringEdit([daily], daily.id, '2026-11-12', 'this_and_following', {
      title: '新版例會'
    });
    expect(afterFollowing).toHaveLength(2);
    const expandedFollowing = expandRecurringEvents(afterFollowing, '2026-11-10', '2026-11-14');
    expect(expandedFollowing.filter((e) => e.title === '每週同步會')).toHaveLength(2);
    expect(expandedFollowing.filter((e) => e.title === '新版例會')).toHaveLength(3);

    // 3. Single delete excludes only one day
    const afterSingleDel = applyRecurringDelete([daily], daily.id, '2026-11-11', 'single');
    expect(expandRecurringEvents(afterSingleDel, '2026-11-10', '2026-11-14')).toHaveLength(4);

    // 4. Human-readable Traditional Chinese labels
    expect(describeRecurrenceRule({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] })).toBe(
      '每週工作日 (一至五)'
    );
    expect(describeRecurrenceRule({ freq: 'every_n_days', interval: 2 })).toBe('每 2 天重複');
  });
});
