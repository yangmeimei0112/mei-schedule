import type {
  ColorToken,
  RecurrenceRule,
  ScheduleEvent
} from '../types/schedule';
import { generateUuidV4 } from './scheduleSyncService';

// ============================================================================
// RFC 5545 .ics Bidirectional Parser / Exporter & Google Calendar Deep-Link
// ============================================================================

const ICAL_WEEKDAY_TO_NUM: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6
};

const NUM_TO_ICAL_WEEKDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function escapeIcsText(raw: string): string {
  return (raw || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function unescapeIcsText(raw: string): string {
  return (raw || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Unfolds RFC 5545 folded lines (CRLF/LF followed by single space or tab).
 */
function unfoldIcsLines(icsText: string): string[] {
  const normalized = (icsText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const unfolded = normalized.replace(/\n[ \t]/g, '');
  return unfolded.split('\n');
}

/**
 * Folds an RFC 5545 content line at 75 characters safely.
 */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let cursor = 0;
  chunks.push(line.slice(0, 75));
  cursor = 75;
  while (cursor < line.length) {
    chunks.push(` ${line.slice(cursor, cursor + 74)}`);
    cursor += 74;
  }
  return chunks.join('\r\n');
}

function formatIcsUtcDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function formatIcsDateOnly(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function parseIcsDateValue(rawVal: string, params: string): { iso: string; isDateOnly: boolean } | null {
  const val = rawVal.trim();
  const isDateOnly = /VALUE=DATE\b/i.test(params) || /^\d{8}$/.test(val);

  if (isDateOnly && /^\d{8}$/.test(val)) {
    const y = Number(val.slice(0, 4));
    const m = Number(val.slice(4, 6)) - 1;
    const d = Number(val.slice(6, 8));
    return { iso: new Date(y, m, d, 0, 0, 0, 0).toISOString(), isDateOnly: true };
  }

  const dtMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!dtMatch) return null;

  const y = Number(dtMatch[1]);
  const m = Number(dtMatch[2]) - 1;
  const d = Number(dtMatch[3]);
  const hh = Number(dtMatch[4]);
  const mm = Number(dtMatch[5]);
  const ss = Number(dtMatch[6]);
  const isUtc = Boolean(dtMatch[7]);

  const dateObj = isUtc
    ? new Date(Date.UTC(y, m, d, hh, mm, ss))
    : new Date(y, m, d, hh, mm, ss);
  return { iso: dateObj.toISOString(), isDateOnly: false };
}

export function serializeRRule(rule: RecurrenceRule): string {
  const parts: string[] = [];
  if (rule.freq === 'daily' || rule.freq === 'every_n_days') {
    parts.push('FREQ=DAILY');
  } else if (rule.freq === 'weekly') {
    parts.push('FREQ=WEEKLY');
  } else if (rule.freq === 'monthly') {
    parts.push('FREQ=MONTHLY');
  }

  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${Math.floor(rule.interval)}`);
  }

  if (rule.freq === 'weekly' && Array.isArray(rule.byWeekday) && rule.byWeekday.length > 0) {
    const byDay = rule.byWeekday
      .filter((d) => d >= 0 && d <= 6)
      .map((d) => NUM_TO_ICAL_WEEKDAY[d])
      .join(',');
    if (byDay) parts.push(`BYDAY=${byDay}`);
  }

  if (rule.freq === 'monthly' && rule.byMonthDay) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
  }

  if (rule.until) {
    const d = new Date(rule.until.length === 10 ? `${rule.until}T23:59:59Z` : rule.until);
    if (!Number.isNaN(d.getTime())) {
      parts.push(`UNTIL=${formatIcsUtcDateTime(d.toISOString())}`);
    }
  } else if (rule.count && rule.count > 0) {
    parts.push(`COUNT=${Math.floor(rule.count)}`);
  }

  return parts.join(';');
}

export function parseRRule(rruleText: string): RecurrenceRule | null {
  if (!rruleText) return null;
  const kv: Record<string, string> = {};
  for (const part of rruleText.trim().split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    kv[part.slice(0, eqIdx).toUpperCase()] = part.slice(eqIdx + 1).toUpperCase();
  }

  const freqRaw = kv.FREQ;
  const interval = Math.max(1, Number(kv.INTERVAL || 1));
  let freq: RecurrenceRule['freq'];
  if (freqRaw === 'DAILY') {
    freq = interval > 1 ? 'every_n_days' : 'daily';
  } else if (freqRaw === 'WEEKLY') {
    freq = 'weekly';
  } else if (freqRaw === 'MONTHLY') {
    freq = 'monthly';
  } else {
    return null;
  }

  const rule: RecurrenceRule = { freq, interval };

  if (kv.BYDAY) {
    const days = kv.BYDAY.split(',')
      .map((tok) => tok.replace(/^[-+\d]+/, ''))
      .map((tok) => ICAL_WEEKDAY_TO_NUM[tok])
      .filter((n) => typeof n === 'number');
    if (days.length > 0) rule.byWeekday = [...new Set(days)].sort((a, b) => a - b);
  }

  if (kv.BYMONTHDAY && /^\d{1,2}$/.test(kv.BYMONTHDAY)) {
    rule.byMonthDay = Math.min(31, Math.max(1, Number(kv.BYMONTHDAY)));
  }

  if (kv.UNTIL) {
    const m = kv.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) rule.until = `${m[1]}-${m[2]}-${m[3]}`;
  }

  if (kv.COUNT && /^\d+$/.test(kv.COUNT)) {
    rule.count = Number(kv.COUNT);
  }

  return rule;
}

export interface IcsParseResult {
  events: ScheduleEvent[];
  skippedCount: number;
  errors: string[];
}

export function parseIcsContent(
  icsText: string,
  options: {
    calendarId: string;
    creatorId: string;
    existingExternalUids?: Set<string>;
    defaultColorToken?: ColorToken;
  }
): IcsParseResult {
  const lines = unfoldIcsLines(icsText);
  const events: ScheduleEvent[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  let inEvent = false;
  let current: Record<string, { value: string; params: string }> = {};
  const seenUids = new Set(options.existingExternalUids || []);

  const flushEvent = () => {
    const summaryRaw = current.SUMMARY?.value;
    const dtStartEntry = current.DTSTART;
    if (!summaryRaw || !dtStartEntry) {
      skippedCount += 1;
      return;
    }

    const uid = current.UID?.value?.trim() || `ics-${generateUuidV4()}@meischedule.app`;
    if (seenUids.has(uid)) {
      skippedCount += 1;
      return;
    }

    const startParsed = parseIcsDateValue(dtStartEntry.value, dtStartEntry.params);
    if (!startParsed) {
      errors.push(`無法解析行程「${unescapeIcsText(summaryRaw)}」的開始時間`);
      skippedCount += 1;
      return;
    }

    let endIso: string;
    const dtEndEntry = current.DTEND;
    if (dtEndEntry) {
      const endParsed = parseIcsDateValue(dtEndEntry.value, dtEndEntry.params);
      if (endParsed) {
        if (startParsed.isDateOnly && endParsed.isDateOnly) {
          // RFC 5545 exclusive DTEND for all-day -> adjust back 1 minute to stay same day
          const endDate = new Date(Date.parse(endParsed.iso) - 60_000);
          endIso =
            endDate.getTime() > Date.parse(startParsed.iso)
              ? endDate.toISOString()
              : new Date(Date.parse(startParsed.iso) + 23 * 3600_000 + 59 * 60_000).toISOString();
        } else {
          endIso = endParsed.iso;
        }
      } else {
        endIso = new Date(Date.parse(startParsed.iso) + 60 * 60_000).toISOString();
      }
    } else {
      endIso = startParsed.isDateOnly
        ? new Date(Date.parse(startParsed.iso) + 23 * 3600_000 + 59 * 60_000).toISOString()
        : new Date(Date.parse(startParsed.iso) + 60 * 60_000).toISOString();
    }

    if (Date.parse(endIso) <= Date.parse(startParsed.iso)) {
      endIso = new Date(Date.parse(startParsed.iso) + 30 * 60_000).toISOString();
    }

    const nowIso = new Date().toISOString();
    const category = current.CATEGORIES?.value
      ? unescapeIcsText(current.CATEGORIES.value.split(',')[0].trim()).slice(0, 48)
      : '匯入';

    const rule = current.RRULE ? parseRRule(current.RRULE.value) : null;

    seenUids.add(uid);
    events.push({
      id: generateUuidV4(),
      calendarId: options.calendarId,
      creatorId: options.creatorId,
      title: unescapeIcsText(summaryRaw).slice(0, 200),
      notes: unescapeIcsText(current.DESCRIPTION?.value || ''),
      location: unescapeIcsText(current.LOCATION?.value || ''),
      startAt: startParsed.iso,
      endAt: endIso,
      allDay: startParsed.isDateOnly,
      colorToken: options.defaultColorToken || 'sky',
      categoryTag: category || '匯入',
      priority: 2,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      isFlexible: false,
      status: 'scheduled',
      completedAt: null,
      recurrenceRule: rule,
      subtasks: [],
      reminderMinutes: [15],
      externalUid: uid,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inEvent) flushEvent();
      inEvent = false;
      current = {};
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const keyPart = line.slice(0, colonIdx);
    const valPart = line.slice(colonIdx + 1);
    const semiIdx = keyPart.indexOf(';');
    const propName = (semiIdx === -1 ? keyPart : keyPart.slice(0, semiIdx)).toUpperCase();
    const propParams = semiIdx === -1 ? '' : keyPart.slice(semiIdx + 1);
    current[propName] = { value: valPart, params: propParams };
  }

  return { events, skippedCount, errors };
}

/**
 * Generates an RFC 5545 compliant .ics calendar string for Apple/Google/Outlook import.
 */
export function exportEventsToIcs(
  events: ScheduleEvent[],
  calendarName = '咩時光 MeiSchedule'
): string {
  const nowStamp = formatIcsUtcDateTime(new Date().toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mei Creative Studio//MeiSchedule v1.1//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine(`X-WR-CALNAME:${escapeIcsText(calendarName)}`)
  ];

  for (const evt of events) {
    if (evt.status === 'canceled') continue;
    lines.push('BEGIN:VEVENT');
    lines.push(foldIcsLine(`UID:${evt.externalUid || `mei-${evt.id}@meischedule.app`}`));
    lines.push(`DTSTAMP:${nowStamp}`);

    if (evt.allDay) {
      const startDateKey = formatIcsDateOnly(evt.startAt);
      const nextDay = new Date(Date.parse(evt.startAt) + 86_400_000);
      lines.push(`DTSTART;VALUE=DATE:${startDateKey}`);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDateOnly(nextDay.toISOString())}`);
    } else {
      lines.push(`DTSTART:${formatIcsUtcDateTime(evt.startAt)}`);
      lines.push(`DTEND:${formatIcsUtcDateTime(evt.endAt)}`);
    }

    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(evt.title)}`));
    if (evt.notes) {
      lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(evt.notes)}`));
    }
    if (evt.location) {
      lines.push(foldIcsLine(`LOCATION:${escapeIcsText(evt.location)}`));
    }
    if (evt.categoryTag) {
      lines.push(foldIcsLine(`CATEGORIES:${escapeIcsText(evt.categoryTag)}`));
    }
    if (evt.recurrenceRule) {
      const rrule = serializeRRule(evt.recurrenceRule);
      if (rrule) lines.push(foldIcsLine(`RRULE:${rrule}`));
    }
    lines.push(`STATUS:${evt.status === 'completed' ? 'CONFIRMED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Generates a one-click Google Calendar deep link for adding any schedule event.
 */
export function buildGoogleCalendarUrl(event: ScheduleEvent): string {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', event.title);

  if (event.allDay) {
    const startDate = formatIcsDateOnly(event.startAt);
    const nextDay = formatIcsDateOnly(new Date(Date.parse(event.startAt) + 86_400_000).toISOString());
    params.set('dates', `${startDate}/${nextDay}`);
  } else {
    params.set('dates', `${formatIcsUtcDateTime(event.startAt)}/${formatIcsUtcDateTime(event.endAt)}`);
  }

  if (event.notes) params.set('details', event.notes);
  if (event.location) params.set('location', event.location);
  if (event.recurrenceRule) {
    const rrule = serializeRRule(event.recurrenceRule);
    if (rrule) params.set('recur', `RRULE:${rrule}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function triggerIcsFileDownload(icsContent: string, filename = 'meischedule.ics'): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
