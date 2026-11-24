import { describe, expect, it } from 'vitest';
import {
  buildGoogleCalendarUrl,
  exportEventsToIcs,
  parseIcsContent
} from '../services/icsService';
import type { ScheduleEvent } from '../types/schedule';

describe('icsService — RFC 5545 Roundtrip Import/Export & Google Calendar URL', () => {
  it('exports events to valid RFC 5545 .ics and re-imports losslessly with deduplication', () => {
    const sampleEvents: ScheduleEvent[] = [
      {
        id: 'evt-1',
        calendarId: 'cal-work',
        creatorId: 'user-1',
        title: '咩時光架構評審, 含逗號與換行',
        notes: '第一行重點\n第二行行動清單',
        location: '咩創會議室 A',
        startAt: '2026-11-24T02:00:00.000Z',
        endAt: '2026-11-24T03:30:00.000Z',
        allDay: false,
        colorToken: 'sky',
        categoryTag: '工作',
        priority: 1,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        isFlexible: false,
        status: 'scheduled',
        recurrenceRule: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] },
        subtasks: [],
        reminderMinutes: [15],
        externalUid: 'mei-roundtrip-1@meischedule.app',
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z'
      },
      {
        id: 'evt-2',
        calendarId: 'cal-work',
        creatorId: 'user-1',
        title: '全天團隊發布日',
        notes: '',
        location: '',
        startAt: new Date(2026, 10, 25, 0, 0, 0, 0).toISOString(),
        endAt: new Date(2026, 10, 25, 23, 59, 0, 0).toISOString(),
        allDay: true,
        colorToken: 'teal',
        categoryTag: '工作',
        priority: 2,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        isFlexible: false,
        status: 'scheduled',
        recurrenceRule: null,
        subtasks: [],
        reminderMinutes: [],
        externalUid: 'mei-roundtrip-2@meischedule.app',
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z'
      }
    ];

    const ics = exportEventsToIcs(sampleEvents, '咩時光測試日曆');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('PRODID:-//Mei Creative Studio//MeiSchedule v1.4//ZH');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(ics).toContain('DTSTART;VALUE=DATE:');

    const imported = parseIcsContent(ics, {
      calendarId: 'cal-target',
      creatorId: 'user-2'
    });
    expect(imported.events).toHaveLength(2);
    expect(imported.events[0].title).toBe('咩時光架構評審, 含逗號與換行');
    expect(imported.events[0].notes).toBe('第一行重點\n第二行行動清單');
    expect(imported.events[0].recurrenceRule?.byWeekday).toEqual([1, 3, 5]);
    expect(imported.events[1].allDay).toBe(true);

    // Deduplication check when externalUid already exists
    const dedup = parseIcsContent(ics, {
      calendarId: 'cal-target',
      creatorId: 'user-2',
      existingExternalUids: new Set(['mei-roundtrip-1@meischedule.app'])
    });
    expect(dedup.events).toHaveLength(1);
    expect(dedup.skippedCount).toBe(1);

    // Google Calendar URL builder check
    const gcalUrl = buildGoogleCalendarUrl(sampleEvents[0]);
    expect(gcalUrl).toContain('https://calendar.google.com/calendar/render');
    expect(gcalUrl).toContain('action=TEMPLATE');
    expect(gcalUrl).toContain('RRULE%3AFREQ%3DWEEKLY');
  });
});
