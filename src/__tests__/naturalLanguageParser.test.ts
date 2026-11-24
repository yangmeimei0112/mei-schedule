import { describe, expect, it } from 'vitest';
import { parseQuickCapture } from '../services/naturalLanguageParser';

const FIXED_REF = new Date(2026, 10, 24, 9, 10, 0, 0); // Tue Nov 24, 2026 09:10 local

describe('naturalLanguageParser — Bilingual ZH-TW & EN Quick Capture', () => {
  it('parses full Traditional Chinese natural language with date, time, duration, tag, priority & recurrence', () => {
    const res = parseQuickCapture(
      '明天下午3點半跟產品團隊開會 90分鐘 #工作 每週三 !高',
      { referenceDate: FIXED_REF }
    );

    expect(res.title).toBe('跟產品團隊開會');
    expect(res.hasExplicitDate).toBe(true);
    expect(res.hasExplicitTime).toBe(true);
    expect(res.durationMinutes).toBe(90);
    expect(res.categoryTag).toBe('工作');
    expect(res.colorToken).toBe('sky');
    expect(res.priority).toBe(1);
    expect(res.recurrenceRule).toEqual({
      freq: 'weekly',
      interval: 1,
      byWeekday: [3],
      until: null
    });

    const start = new Date(res.startAt);
    const end = new Date(res.endAt);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(10);
    expect(start.getDate()).toBe(25);
    expect(start.getHours()).toBe(15);
    expect(start.getMinutes()).toBe(30);
    expect(end.getHours()).toBe(17);
    expect(end.getMinutes()).toBe(0);
  });

  it('parses English natural language with next weekday, time, duration, flexible flag & tag', () => {
    const res = parseQuickCapture(
      'Lunch with Alex next Fri 12:30pm for 1h #personal flexible p3',
      { referenceDate: FIXED_REF }
    );

    expect(res.title).toBe('Lunch with Alex');
    expect(res.hasExplicitDate).toBe(true);
    expect(res.hasExplicitTime).toBe(true);
    expect(res.durationMinutes).toBe(60);
    expect(res.categoryTag).toBe('個人');
    expect(res.colorToken).toBe('emerald');
    expect(res.isFlexible).toBe(true);
    expect(res.priority).toBe(3);

    const start = new Date(res.startAt);
    expect(start.getDay()).toBe(5); // Friday
    expect(start.getHours()).toBe(12);
    expect(start.getMinutes()).toBe(30);
  });

  it('parses explicit time ranges (24h and Chinese) and all-day markers', () => {
    const rangeRes = parseQuickCapture('2026-12-01 14:00-15:30 季度評審 #會議', {
      referenceDate: FIXED_REF
    });
    expect(rangeRes.title).toBe('季度評審');
    expect(rangeRes.durationMinutes).toBe(90);
    expect(rangeRes.colorToken).toBe('violet');
    expect(new Date(rangeRes.startAt).getDate()).toBe(1);

    const allDayRes = parseQuickCapture('後天 全天 品牌設計工作坊 #創意', {
      referenceDate: FIXED_REF
    });
    expect(allDayRes.allDay).toBe(true);
    expect(allDayRes.title).toBe('品牌設計工作坊');
    expect(new Date(allDayRes.startAt).getDate()).toBe(26);
  });

  it('parses multi-weekday weekly rules, every N days, and until dates', () => {
    const multiDay = parseQuickCapture('晨跑 30分鐘 每週一三五 直到 2026-12-31 #運動', {
      referenceDate: FIXED_REF
    });
    expect(multiDay.recurrenceRule).toEqual({
      freq: 'weekly',
      interval: 1,
      byWeekday: [1, 3, 5],
      until: '2026-12-31'
    });
    expect(multiDay.colorToken).toBe('teal');

    const every3 = parseQuickCapture('澆花 每3天 早上8點', { referenceDate: FIXED_REF });
    expect(every3.recurrenceRule).toEqual({
      freq: 'every_n_days',
      interval: 3,
      until: null
    });
    expect(new Date(every3.startAt).getHours()).toBe(8);
  });
});
