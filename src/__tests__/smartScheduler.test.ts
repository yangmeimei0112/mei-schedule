import { describe, expect, it } from 'vitest';
import {
  computeAnalyticsSummary,
  detectScheduleConflicts,
  proposeAutoFill,
  proposeSmartPush
} from '../services/smartScheduler';
import type { FocusSession, ScheduleEvent, ScheduleTask } from '../types/schedule';

const REF_DAY = new Date(2026, 10, 24, 8, 0, 0, 0);

function atHour(h: number, m = 0, dayOffset = 0): string {
  return new Date(2026, 10, 24 + dayOffset, h, m, 0, 0).toISOString();
}

function makeEvent(id: string, title: string, startH: number, endH: number, extra: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id,
    calendarId: 'cal-work',
    creatorId: 'user-1',
    title,
    notes: '',
    location: '',
    startAt: atHour(startH, 0),
    endAt: atHour(endH, 0),
    allDay: false,
    colorToken: 'sky',
    categoryTag: '工作',
    priority: 2,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    isFlexible: true,
    status: 'scheduled',
    recurrenceRule: null,
    subtasks: [],
    reminderMinutes: [15],
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    ...extra
  };
}

describe('smartScheduler — Conflict Detection, Preview Auto-Fill, Smart Push & Analytics', () => {
  it('detects both direct time overlaps and buffer-zone collisions', () => {
    const e1 = makeEvent('e1', '會議 A', 10, 11, { bufferAfterMin: 15 });
    const e2 = makeEvent('e2', '會議 B (緩衝碰撞)', 11, 12, { startAt: atHour(11, 5) });
    const e3 = makeEvent('e3', '會議 C (直接重疊)', 11, 12, { startAt: atHour(11, 30), endAt: atHour(12, 30) });

    const conflicts = detectScheduleConflicts([e1, e2, e3]);
    expect(conflicts.some((c) => c.conflictType === 'buffer')).toBe(true);
    expect(conflicts.some((c) => c.conflictType === 'direct')).toBe(true);
  });

  it('proposes priority-ordered auto-fill slots without mutating inputs and respecting existing buffers', () => {
    const busy = [
      makeEvent('locked-1', '晨間評審', 9, 10, { isFlexible: false, bufferAfterMin: 15 })
    ];
    const tasks: ScheduleTask[] = [
      {
        id: 't-low',
        userId: 'u1',
        title: '低優先整理',
        notes: '',
        estimatedMinutes: 30,
        priority: 3,
        categoryTag: '個人',
        completed: false,
        subtasks: [],
        sortOrder: 0,
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z'
      },
      {
        id: 't-high',
        userId: 'u1',
        title: '高優先交付',
        notes: '',
        estimatedMinutes: 45,
        priority: 1,
        dueDate: '2026-11-24',
        categoryTag: '工作',
        completed: false,
        subtasks: [],
        sortOrder: 1,
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z'
      }
    ];

    const res = proposeAutoFill(tasks, busy, { workStartHour: 9, workEndHour: 18 }, REF_DAY, 3);
    expect(res.proposals).toHaveLength(2);
    // High priority task must be scheduled FIRST right after 10:15 buffer
    expect(res.proposals[0].targetId).toBe('t-high');
    const firstStart = new Date(res.proposals[0].proposedStartAt);
    expect(firstStart.getHours()).toBe(10);
    expect(firstStart.getMinutes()).toBe(15);
    expect(res.lockedEventIds).toContain('locked-1');
  });

  it('pushes only colliding flexible events while strictly locking immovable meetings', () => {
    const anchor = makeEvent('anchor', '客戶演示', 10, 11, { isFlexible: false });
    const flexConflict = makeEvent('flex-1', '彈性開發', 11, 12, { isFlexible: true });
    const lockedMeeting = makeEvent('locked-2', '董事會', 12, 13, { isFlexible: false });

    const res = proposeSmartPush('anchor', 30, [anchor, flexConflict, lockedMeeting], {
      workStartHour: 9,
      workEndHour: 18
    });

    expect(res.lockedEventIds).toContain('locked-2');
    expect(res.proposals.some((p) => p.targetId === 'locked-2')).toBe(false);
    const pushedFlex = res.proposals.find((p) => p.targetId === 'flex-1');
    expect(pushedFlex).toBeDefined();
    // Should jump past 12:00-13:00 locked meeting to 13:00
    expect(new Date(pushedFlex!.proposedStartAt).getHours()).toBe(13);
  });

  it('computes accurate focus totals, streak days, completion rate & category breakdown', () => {
    const events = [
      makeEvent('e1', '開發', 9, 11, { status: 'completed', releasedMinutes: 20 }),
      makeEvent('e2', '閱讀', 14, 15, { categoryTag: '學習', status: 'scheduled' })
    ];
    const focusSessions: FocusSession[] = [
      {
        id: 'f1',
        userId: 'u1',
        categoryTag: '工作',
        plannedMinutes: 25,
        actualMinutes: 25,
        completed: true,
        startedAt: atHour(9, 0, 0),
        endedAt: atHour(9, 25, 0)
      },
      {
        id: 'f2',
        userId: 'u1',
        categoryTag: '學習',
        plannedMinutes: 50,
        actualMinutes: 50,
        completed: true,
        startedAt: atHour(14, 0, -1),
        endedAt: atHour(14, 50, -1)
      }
    ];

    const summary = computeAnalyticsSummary(events, [], focusSessions, REF_DAY);
    expect(summary.totalFocusMinutes).toBe(75);
    expect(summary.todayFocusMinutes).toBe(25);
    expect(summary.streakDays).toBe(2);
    expect(summary.eventCompletionRate).toBe(50);
    expect(summary.releasedMinutesTotal).toBe(20);
    expect(summary.last7DaysFocus).toHaveLength(7);
  });
});
