import type {
  ColorToken,
  ParsedQuickCapture,
  PriorityLevel,
  RecurrenceRule
} from '../types/schedule';

// ============================================================================
// Bilingual Natural Language Schedule Parser (繁體中文 + English)
// Zero-latency client-side engine supporting dates, times, ranges, durations,
// tags, priorities, flexibility, all-day flags, and recurrence rules.
// ============================================================================

const TAG_COLOR_MAP: Record<string, { tag: string; color: ColorToken }> = {
  工作: { tag: '工作', color: 'sky' },
  work: { tag: '工作', color: 'sky' },
  專案: { tag: '工作', color: 'sky' },
  個人: { tag: '個人', color: 'emerald' },
  personal: { tag: '個人', color: 'emerald' },
  生活: { tag: '個人', color: 'emerald' },
  學習: { tag: '學習', color: 'amber' },
  study: { tag: '學習', color: 'amber' },
  閱讀: { tag: '學習', color: 'amber' },
  會議: { tag: '會議', color: 'violet' },
  meeting: { tag: '會議', color: 'violet' },
  共享: { tag: '共享', color: 'violet' },
  team: { tag: '共享', color: 'violet' },
  shared: { tag: '共享', color: 'violet' },
  緊急: { tag: '緊急', color: 'rose' },
  重要: { tag: '重要', color: 'rose' },
  urgent: { tag: '緊急', color: 'rose' },
  健康: { tag: '健康', color: 'teal' },
  運動: { tag: '運動', color: 'teal' },
  health: { tag: '健康', color: 'teal' },
  fitness: { tag: '運動', color: 'teal' },
  靈感: { tag: '靈感', color: 'orange' },
  創意: { tag: '創意', color: 'orange' }
};

const ZH_WEEKDAY_MAP: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6
};

const EN_WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6
};

const ZH_DIGIT_MAP: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
};

function parseZhNumber(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === '十') return 10;
  if (raw.length === 2 && raw[0] === '十' && raw[1] in ZH_DIGIT_MAP) {
    return 10 + ZH_DIGIT_MAP[raw[1]];
  }
  if (raw.length === 2 && raw[1] === '十' && raw[0] in ZH_DIGIT_MAP) {
    return ZH_DIGIT_MAP[raw[0]] * 10;
  }
  if (raw.length === 3 && raw[1] === '十' && raw[0] in ZH_DIGIT_MAP && raw[2] in ZH_DIGIT_MAP) {
    return ZH_DIGIT_MAP[raw[0]] * 10 + ZH_DIGIT_MAP[raw[2]];
  }
  if (raw.length === 1 && raw in ZH_DIGIT_MAP) {
    return ZH_DIGIT_MAP[raw];
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateLabel(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function adjustHourByPeriod(hour: number, period?: string): number {
  let h = hour;
  if (!period) return Math.min(23, Math.max(0, h));
  const p = period.toLowerCase();
  if (['下午', '晚上', '傍晚', '晚間', 'pm'].includes(p)) {
    if (h >= 1 && h <= 11) h += 12;
  } else if (['中午'].includes(p)) {
    if (h >= 1 && h <= 5) h += 12;
  } else if (['上午', '早上', '清晨', '凌晨', 'am'].includes(p)) {
    if (h === 12) h = 0;
  }
  return Math.min(23, Math.max(0, h));
}

function computeNextWeekday(base: Date, targetDow: number, forceNextWeek: boolean): Date {
  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const currentDow = result.getDay();
  let diff = targetDow - currentDow;
  if (forceNextWeek) {
    // Move to target day in next calendar week (Mon-based or Sun-based natural meaning)
    const daysUntilNextMonday = ((8 - currentDow) % 7) || 7;
    const offsetFromMon = targetDow === 0 ? 6 : targetDow - 1;
    diff = daysUntilNextMonday + offsetFromMon;
  } else if (diff <= 0) {
    diff += 7;
  }
  result.setDate(result.getDate() + diff);
  return result;
}

function roundToNext15Min(date: Date): { hour: number; minute: number } {
  const totalMins = date.getHours() * 60 + date.getMinutes();
  const nextSlot = Math.ceil((totalMins + 1) / 15) * 15;
  const clamped = Math.min(nextSlot, 23 * 60 + 30);
  return { hour: Math.floor(clamped / 60), minute: clamped % 60 };
}

export interface ParseQuickCaptureOptions {
  referenceDate?: Date;
  defaultDurationMinutes?: number;
}

export function parseQuickCapture(
  rawInput: string,
  options: ParseQuickCaptureOptions = {}
): ParsedQuickCapture {
  const ref = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const defaultDuration = options.defaultDurationMinutes ?? 45;
  let working = (rawInput || '').trim();

  const tokensDetected: ParsedQuickCapture['tokensDetected'] = [];

  let targetDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let hasExplicitDate = false;
  let hasExplicitTime = false;
  let startHour: number | null = null;
  let startMinute = 0;
  let endHour: number | null = null;
  let endMinute = 0;
  let durationMinutes: number | null = null;
  let allDay = false;
  let categoryTag = '一般';
  let colorToken: ColorToken = 'sky';
  let priority: PriorityLevel = 2;
  let isFlexible = false;
  let recurrenceRule: RecurrenceRule | null = null;

  // -------------------------------------------------------------------------
  // 1. Tags (#工作 / #personal / #自訂)
  // -------------------------------------------------------------------------
  const tagRegex = /#([\u4e00-\u9fffA-Za-z0-9_-]{1,24})/g;
  const tagMatches = [...working.matchAll(tagRegex)];
  if (tagMatches.length > 0) {
    const rawTag = tagMatches[0][1];
    const mapped = TAG_COLOR_MAP[rawTag.toLowerCase()] || TAG_COLOR_MAP[rawTag];
    if (mapped) {
      categoryTag = mapped.tag;
      colorToken = mapped.color;
    } else {
      categoryTag = rawTag;
    }
    tokensDetected.push({ kind: 'tag', label: `#${categoryTag}` });
    working = working.replace(tagRegex, ' ');
  }

  // -------------------------------------------------------------------------
  // 2. Priority (!高 / !中 / !低 / !1 / p1 / p2 / p3)
  // -------------------------------------------------------------------------
  const prioMatch = working.match(/(?:^|\s)(!高|!中|!低|![123]|[pP][123])(?=\s|$)/);
  if (prioMatch) {
    const tok = prioMatch[1].toLowerCase();
    if (tok === '!高' || tok === '!1' || tok === 'p1') {
      priority = 1;
      tokensDetected.push({ kind: 'priority', label: '高優先' });
    } else if (tok === '!低' || tok === '!3' || tok === 'p3') {
      priority = 3;
      tokensDetected.push({ kind: 'priority', label: '低優先' });
    } else {
      priority = 2;
      tokensDetected.push({ kind: 'priority', label: '中優先' });
    }
    working = working.replace(prioMatch[0], ' ');
  }

  // -------------------------------------------------------------------------
  // 3. All-day & Flexible markers
  // -------------------------------------------------------------------------
  const allDayMatch = working.match(/(?:^|\s)(全天|整天|all[-\s]?day)(?=\s|$)/i);
  if (allDayMatch) {
    allDay = true;
    tokensDetected.push({ kind: 'allDay', label: '全天' });
    working = working.replace(allDayMatch[0], ' ');
  }

  const flexMatch = working.match(/(?:^|\s)(彈性|可順延|可調整|flexible)(?=\s|$)/i);
  if (flexMatch) {
    isFlexible = true;
    tokensDetected.push({ kind: 'flexible', label: '彈性可調' });
    working = working.replace(flexMatch[0], ' ');
  }

  // -------------------------------------------------------------------------
  // 4. Recurrence rules (before dates so 每週三 doesn't collide with 週三)
  // -------------------------------------------------------------------------
  // Until clause: 直到 2026-12-31 or until 2026-12-31
  let recurrenceUntil: string | null = null;
  const untilMatch = working.match(/(?:直到|until)\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i);
  if (untilMatch) {
    const parts = untilMatch[1].split(/[-/]/).map(Number);
    recurrenceUntil = `${parts[0]}-${pad2(parts[1])}-${pad2(parts[2])}`;
    working = working.replace(untilMatch[0], ' ');
  }

  // Every N days: 每 3 天 / every 3 days
  const everyNDaysMatch = working.match(/每\s*(\d+)\s*天|every\s+(\d+)\s+days?/i);
  if (everyNDaysMatch) {
    const n = Math.max(1, Number(everyNDaysMatch[1] || everyNDaysMatch[2]));
    recurrenceRule = { freq: 'every_n_days', interval: n, until: recurrenceUntil };
    tokensDetected.push({ kind: 'recurrence', label: `每 ${n} 天` });
    working = working.replace(everyNDaysMatch[0], ' ');
  }

  // Weekly specific days: 每週一三五 / 每週三 / 每星期二、四 / every mon, wed
  if (!recurrenceRule) {
    const zhWeeklyMatch = working.match(/每(?:週|星期|周)([一二三四五六日天、,，\s]+)/);
    if (zhWeeklyMatch) {
      const days: number[] = [];
      for (const ch of zhWeeklyMatch[1]) {
        if (ch in ZH_WEEKDAY_MAP && !days.includes(ZH_WEEKDAY_MAP[ch])) {
          days.push(ZH_WEEKDAY_MAP[ch]);
        }
      }
      if (days.length > 0) {
        days.sort((a, b) => a - b);
        recurrenceRule = { freq: 'weekly', interval: 1, byWeekday: days, until: recurrenceUntil };
        const names = ['日', '一', '二', '三', '四', '五', '六'];
        tokensDetected.push({
          kind: 'recurrence',
          label: `每週${days.map((d) => names[d]).join('、')}`
        });
        working = working.replace(zhWeeklyMatch[0], ' ');
      }
    }
  }

  if (!recurrenceRule) {
    const enWeeklyDayMatch = working.match(
      /\bevery\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i
    );
    if (enWeeklyDayMatch) {
      const dow = EN_WEEKDAY_MAP[enWeeklyDayMatch[1].toLowerCase()];
      recurrenceRule = { freq: 'weekly', interval: 1, byWeekday: [dow], until: recurrenceUntil };
      tokensDetected.push({ kind: 'recurrence', label: `每週重複` });
      working = working.replace(enWeeklyDayMatch[0], ' ');
    }
  }

  if (!recurrenceRule) {
    const zhMonthlyDayMatch = working.match(/每月\s*(\d{1,2})\s*[日號]/);
    if (zhMonthlyDayMatch) {
      const dayNum = Math.min(31, Math.max(1, Number(zhMonthlyDayMatch[1])));
      recurrenceRule = { freq: 'monthly', interval: 1, byMonthDay: dayNum, until: recurrenceUntil };
      tokensDetected.push({ kind: 'recurrence', label: `每月 ${dayNum} 日` });
      working = working.replace(zhMonthlyDayMatch[0], ' ');
    }
  }

  if (!recurrenceRule) {
    const simpleRecMatch = working.match(
      /(每天|每日|每週|每周|每月|工作日|平日|\bdaily\b|\bweekly\b|\bmonthly\b|\bweekdays\b)/i
    );
    if (simpleRecMatch) {
      const token = simpleRecMatch[1].toLowerCase();
      if (token === '每天' || token === '每日' || token === 'daily') {
        recurrenceRule = { freq: 'daily', interval: 1, until: recurrenceUntil };
        tokensDetected.push({ kind: 'recurrence', label: '每天' });
      } else if (token === '工作日' || token === '平日' || token === 'weekdays') {
        recurrenceRule = { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5], until: recurrenceUntil };
        tokensDetected.push({ kind: 'recurrence', label: '每週一至五' });
      } else if (token === '每週' || token === '每周' || token === 'weekly') {
        recurrenceRule = { freq: 'weekly', interval: 1, byWeekday: [targetDate.getDay()], until: recurrenceUntil };
        tokensDetected.push({ kind: 'recurrence', label: '每週' });
      } else if (token === '每月' || token === 'monthly') {
        recurrenceRule = { freq: 'monthly', interval: 1, byMonthDay: targetDate.getDate(), until: recurrenceUntil };
        tokensDetected.push({ kind: 'recurrence', label: '每月' });
      }
      working = working.replace(simpleRecMatch[0], ' ');
    }
  }

  // -------------------------------------------------------------------------
  // 5. Explicit & Relative Dates
  // -------------------------------------------------------------------------
  // YYYY-MM-DD or YYYY/MM/DD
  const isoDateMatch = working.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoDateMatch) {
    const y = Number(isoDateMatch[1]);
    const m = Number(isoDateMatch[2]);
    const d = Number(isoDateMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      targetDate = new Date(y, m - 1, d);
      hasExplicitDate = true;
      tokensDetected.push({ kind: 'date', label: formatDateLabel(targetDate) });
      working = working.replace(isoDateMatch[0], ' ');
    }
  }

  // M月D日 / M月D號
  if (!hasExplicitDate) {
    const zhMonthDayMatch = working.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日號]/);
    if (zhMonthDayMatch) {
      const m = Number(zhMonthDayMatch[1]);
      const d = Number(zhMonthDayMatch[2]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        targetDate = new Date(ref.getFullYear(), m - 1, d);
        hasExplicitDate = true;
        tokensDetected.push({ kind: 'date', label: formatDateLabel(targetDate) });
        working = working.replace(zhMonthDayMatch[0], ' ');
      }
    }
  }

  // Relative Chinese dates: 大後天 / 後天 / 明天 / 明日 / 今天 / 今日
  if (!hasExplicitDate) {
    const relZhMatch = working.match(/(大後天|後天|明天|明日|今天|今日)/);
    if (relZhMatch) {
      const tok = relZhMatch[1];
      const offset =
        tok === '大後天' ? 3 : tok === '後天' ? 2 : tok === '明天' || tok === '明日' ? 1 : 0;
      targetDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + offset);
      hasExplicitDate = true;
      tokensDetected.push({ kind: 'date', label: `${tok} (${formatDateLabel(targetDate)})` });
      working = working.replace(relZhMatch[0], ' ');
    }
  }

  // Relative English dates: today / tomorrow
  if (!hasExplicitDate) {
    const relEnMatch = working.match(/\b(today|tomorrow)\b/i);
    if (relEnMatch) {
      const offset = relEnMatch[1].toLowerCase() === 'tomorrow' ? 1 : 0;
      targetDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + offset);
      hasExplicitDate = true;
      tokensDetected.push({ kind: 'date', label: formatDateLabel(targetDate) });
      working = working.replace(relEnMatch[0], ' ');
    }
  }

  // Chinese weekday: 下週三 / 下星期五 / 這週四 / 週二 / 禮拜六
  if (!hasExplicitDate) {
    const zhDowMatch = working.match(/(下|這|本)?(?:週|周|星期|禮拜)([一二三四五六日天])/);
    if (zhDowMatch) {
      const forceNext = zhDowMatch[1] === '下';
      const dow = ZH_WEEKDAY_MAP[zhDowMatch[2]];
      targetDate = computeNextWeekday(ref, dow, forceNext);
      hasExplicitDate = true;
      tokensDetected.push({ kind: 'date', label: `${zhDowMatch[0]} (${formatDateLabel(targetDate)})` });
      working = working.replace(zhDowMatch[0], ' ');
    }
  }

  // English weekday: next Fri / next Friday / on Monday
  if (!hasExplicitDate) {
    const enDowMatch = working.match(
      /\b(next\s+|this\s+|on\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i
    );
    if (enDowMatch) {
      const forceNext = Boolean(enDowMatch[1] && /next/i.test(enDowMatch[1]));
      const dow = EN_WEEKDAY_MAP[enDowMatch[2].toLowerCase()];
      targetDate = computeNextWeekday(ref, dow, forceNext);
      hasExplicitDate = true;
      tokensDetected.push({ kind: 'date', label: formatDateLabel(targetDate) });
      working = working.replace(enDowMatch[0], ' ');
    }
  }

  // -------------------------------------------------------------------------
  // 6. Duration (90分鐘 / 1.5小時 / 兩小時 / for 90m / for 1.5h / 45 min)
  // -------------------------------------------------------------------------
  const zhDurMatch = working.match(
    /(\d+(?:\.\d+)?)\s*(小時|個小時|鐘頭|分鐘|分)(?!鐘頭)|\b(半小時|一小時|兩小時|兩個小時)\b|(?<![0-9])(半小時|一小時|兩小時|兩個小時)/
  );
  if (zhDurMatch) {
    if (zhDurMatch[1] && zhDurMatch[2]) {
      const val = parseFloat(zhDurMatch[1]);
      const isHours =
        zhDurMatch[2] === '小時' || zhDurMatch[2] === '個小時' || zhDurMatch[2] === '鐘頭';
      durationMinutes = isHours ? Math.round(val * 60) : Math.round(val);
    } else {
      const phrase = zhDurMatch[3] || zhDurMatch[4] || '';
      if (phrase === '半小時') durationMinutes = 30;
      else if (phrase === '一小時') durationMinutes = 60;
      else if (phrase.startsWith('兩')) durationMinutes = 120;
    }
    if (durationMinutes && durationMinutes > 0) {
      durationMinutes = Math.max(15, Math.min(720, durationMinutes));
      tokensDetected.push({ kind: 'duration', label: `${durationMinutes} 分鐘` });
      working = working.replace(zhDurMatch[0], ' ');
    }
  }

  if (durationMinutes === null) {
    const enDurMatch = working.match(
      /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i
    );
    if (enDurMatch) {
      const val = parseFloat(enDurMatch[1]);
      const unit = enDurMatch[2].toLowerCase();
      durationMinutes = unit.startsWith('h') ? Math.round(val * 60) : Math.round(val);
      durationMinutes = Math.max(15, Math.min(720, durationMinutes));
      tokensDetected.push({ kind: 'duration', label: `${durationMinutes} 分鐘` });
      working = working.replace(enDurMatch[0], ' ');
    }
  }

  // -------------------------------------------------------------------------
  // 7. Time & Time Ranges
  // -------------------------------------------------------------------------
  // 7a. Explicit 24h / am-pm range: 14:00-15:30 or 2pm-3:30pm
  const range24Match = working.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|~|–|to|到|至)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
  );
  if (range24Match && (range24Match[2] || range24Match[3] || range24Match[5] || range24Match[6])) {
    const rawH1 = Number(range24Match[1]);
    const rawM1 = Number(range24Match[2] || 0);
    const p1 = range24Match[3] || range24Match[6];
    const rawH2 = Number(range24Match[4]);
    const rawM2 = Number(range24Match[5] || 0);
    const p2 = range24Match[6] || range24Match[3];
    startHour = adjustHourByPeriod(rawH1, p1);
    startMinute = Math.min(59, rawM1);
    endHour = adjustHourByPeriod(rawH2, p2);
    endMinute = Math.min(59, rawM2);
    hasExplicitTime = true;
    tokensDetected.push({
      kind: 'time',
      label: `${pad2(startHour)}:${pad2(startMinute)}-${pad2(endHour)}:${pad2(endMinute)}`
    });
    working = working.replace(range24Match[0], ' ');
  }

  // 7b. Chinese time range: 下午2點到4點半
  if (!hasExplicitTime) {
    const zhRangeMatch = working.match(
      /(上午|早上|清晨|凌晨|中午|下午|晚上|傍晚|晚間)?\s*([0-9一二兩三四五六七八九十]{1,2})\s*[點時](半|(\d{1,2})\s*分?)?\s*(?:到|至|-|~)\s*(上午|早上|中午|下午|晚上|傍晚)?\s*([0-9一二兩三四五六七八九十]{1,2})\s*[點時](半|(\d{1,2})\s*分?)?/
    );
    if (zhRangeMatch) {
      const h1 = parseZhNumber(zhRangeMatch[2]);
      const h2 = parseZhNumber(zhRangeMatch[6]);
      if (h1 !== null && h2 !== null) {
        startHour = adjustHourByPeriod(h1, zhRangeMatch[1]);
        startMinute = zhRangeMatch[3] === '半' ? 30 : Number(zhRangeMatch[4] || 0);
        endHour = adjustHourByPeriod(h2, zhRangeMatch[5] || zhRangeMatch[1]);
        endMinute = zhRangeMatch[7] === '半' ? 30 : Number(zhRangeMatch[8] || 0);
        hasExplicitTime = true;
        tokensDetected.push({
          kind: 'time',
          label: `${pad2(startHour)}:${pad2(startMinute)}-${pad2(endHour)}:${pad2(endMinute)}`
        });
        working = working.replace(zhRangeMatch[0], ' ');
      }
    }
  }

  // 7c. Single Chinese time: 下午3點半 / 早上9點15分 / 晚上8點
  if (!hasExplicitTime) {
    const zhTimeMatch = working.match(
      /(上午|早上|清晨|凌晨|中午|下午|晚上|傍晚|晚間)?\s*([0-9一二兩三四五六七八九十]{1,2})\s*[點時](?:(半)|(\d{1,2})\s*分?)?/
    );
    if (zhTimeMatch) {
      const h = parseZhNumber(zhTimeMatch[2]);
      if (h !== null && h >= 0 && h <= 24) {
        startHour = adjustHourByPeriod(h === 24 ? 0 : h, zhTimeMatch[1]);
        startMinute = zhTimeMatch[3] === '半' ? 30 : Math.min(59, Number(zhTimeMatch[4] || 0));
        hasExplicitTime = true;
        tokensDetected.push({
          kind: 'time',
          label: `${pad2(startHour)}:${pad2(startMinute)}`
        });
        working = working.replace(zhTimeMatch[0], ' ');
      }
    }
  }

  // 7d. Single English/24h time: at 14:30 / 12:30pm / 3pm
  if (!hasExplicitTime) {
    const enTimeMatch = working.match(
      /(?:\bat\s+)?(上午|早上|中午|下午|晚上|傍晚)?\s*(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b|(?:\bat\s+)?(\d{1,2})\s*(am|pm)\b/i
    );
    if (enTimeMatch) {
      if (enTimeMatch[2]) {
        const rawH = Number(enTimeMatch[2]);
        const rawM = Number(enTimeMatch[3] || 0);
        if (rawH <= 23 && rawM <= 59) {
          startHour = adjustHourByPeriod(rawH, enTimeMatch[4] || enTimeMatch[1]);
          startMinute = rawM;
          hasExplicitTime = true;
        }
      } else if (enTimeMatch[5] && enTimeMatch[6]) {
        const rawH = Number(enTimeMatch[5]);
        if (rawH >= 1 && rawH <= 12) {
          startHour = adjustHourByPeriod(rawH, enTimeMatch[6]);
          startMinute = 0;
          hasExplicitTime = true;
        }
      }
      if (hasExplicitTime && startHour !== null) {
        tokensDetected.push({
          kind: 'time',
          label: `${pad2(startHour)}:${pad2(startMinute)}`
        });
        working = working.replace(enTimeMatch[0], ' ');
      }
    }
  }

  // -------------------------------------------------------------------------
  // 8. Finalize Start/End Timestamps & Clean Title
  // -------------------------------------------------------------------------
  let startDateObj: Date;
  let endDateObj: Date;
  let finalDuration = durationMinutes ?? defaultDuration;

  if (allDay) {
    startDateObj = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    endDateObj = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 0, 0);
    finalDuration = 24 * 60;
  } else {
    if (startHour === null) {
      if (hasExplicitDate) {
        startHour = 10;
        startMinute = 0;
      } else {
        const nextSlot = roundToNext15Min(ref);
        startHour = nextSlot.hour;
        startMinute = nextSlot.minute;
      }
    }
    startDateObj = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      startHour,
      startMinute,
      0,
      0
    );

    if (endHour !== null) {
      endDateObj = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        endHour,
        endMinute,
        0,
        0
      );
      if (endDateObj.getTime() <= startDateObj.getTime()) {
        endDateObj = new Date(startDateObj.getTime() + finalDuration * 60000);
      } else {
        finalDuration = Math.round((endDateObj.getTime() - startDateObj.getTime()) / 60000);
      }
    } else {
      endDateObj = new Date(startDateObj.getTime() + finalDuration * 60000);
    }
  }

  // Keep recurrence byWeekday aligned with resolved date if weekly without explicit days
  if (recurrenceRule && recurrenceRule.freq === 'weekly' && (!recurrenceRule.byWeekday || recurrenceRule.byWeekday.length === 0)) {
    recurrenceRule = { ...recurrenceRule, byWeekday: [startDateObj.getDay()] };
  }

  // Clean leftover connectors and extra whitespace
  const cleanTitle = working
    .replace(/^\s*(?:在|於|at|on|for)\s+/i, '')
    .replace(/\s+(?:在|於|at|on|for)\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    rawInput,
    title: cleanTitle || rawInput.trim() || '未命名行程',
    startAt: startDateObj.toISOString(),
    endAt: endDateObj.toISOString(),
    durationMinutes: finalDuration,
    allDay,
    categoryTag,
    colorToken,
    priority,
    isFlexible,
    recurrenceRule,
    hasExplicitDate,
    hasExplicitTime,
    tokensDetected
  };
}
