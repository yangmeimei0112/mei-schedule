import React, { forwardRef, useMemo, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { COLOR_TOKEN_PALETTE } from '../data/seedData';
import { parseQuickCapture } from '../services/naturalLanguageParser';
import { parseLocalDateKey } from '../services/recurrenceEngine';
import { useScheduleStore } from '../store/useScheduleStore';

export interface QuickCaptureBarProps {
  compact?: boolean;
}

const QuickCaptureBar = forwardRef<HTMLInputElement, QuickCaptureBarProps>(function QuickCaptureBar(
  { compact = false },
  ref
) {
  const [inputValue, setInputValue] = useState('');
  const [captureAsTask, setCaptureAsTask] = useState(false);

  const {
    calendars,
    selectedDate,
    preferences,
    createEvent,
    createTask,
    setSelectedDate
  } = useScheduleStore();

  const refDate = useMemo(() => {
    const base = parseLocalDateKey(selectedDate);
    const now = new Date();
    base.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return base;
  }, [selectedDate]);

  const parsed = useMemo(() => {
    if (!inputValue.trim()) return null;
    return parseQuickCapture(inputValue, {
      referenceDate: refDate,
      defaultDurationMinutes: preferences.defaultEventMinutes
    });
  }, [inputValue, refDate, preferences.defaultEventMinutes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputValue.trim();
    if (!raw || !parsed) return;

    // Pick calendar matching tag/set if possible
    const matchedCal =
      calendars.find(
        (c) =>
          (parsed.categoryTag === '工作' && c.calendarSet === 'work') ||
          (parsed.categoryTag === '個人' && c.calendarSet === 'personal') ||
          (parsed.categoryTag === '學習' && c.calendarSet === 'study') ||
          (parsed.categoryTag === '共享' && c.calendarSet === 'shared')
      ) || calendars[0];

    if (captureAsTask) {
      const dueDate = parsed.hasExplicitDate ? parsed.startAt.slice(0, 10) : null;
      createTask({
        title: parsed.title,
        calendarId: matchedCal?.id ?? null,
        estimatedMinutes: Math.max(15, Math.min(240, parsed.durationMinutes || 30)),
        priority: parsed.priority,
        dueDate,
        categoryTag: parsed.categoryTag === '一般' ? '待辦' : parsed.categoryTag
      });
    } else {
      createEvent({
        title: parsed.title,
        calendarId: matchedCal?.id,
        startAt: parsed.startAt,
        endAt: parsed.endAt,
        allDay: parsed.allDay,
        colorToken: parsed.colorToken,
        categoryTag: parsed.categoryTag,
        priority: parsed.priority,
        isFlexible: parsed.isFlexible,
        recurrenceRule: parsed.recurrenceRule
      });
      if (parsed.hasExplicitDate) {
        const d = new Date(parsed.startAt);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        setSelectedDate(dateKey);
      }
    }

    setInputValue('');
  };

  return (
    <div
      data-testid="quick-capture-bar"
      className={`bento-glass-card ${compact ? 'p-2.5' : 'p-3 sm:p-3.5'} transition-all`}
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl squircle-icon-badge flex items-center justify-center shrink-0">
          <LucideIcon name={captureAsTask ? 'inbox' : 'sparkles'} size={16} />
        </div>

        <input
          ref={ref}
          type="text"
          data-testid="quick-capture-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            captureAsTask
              ? '輸入待辦事項，例如：完成週報 45分鐘 #工作 !高'
              : '自然語言快輸：明天下午3點半跟團隊開會 90分鐘 #工作 每週三 !高'
          }
          aria-label="自然語言快速新增排程或待辦"
          className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />

        <button
          type="button"
          data-testid="quick-capture-mode-toggle"
          onClick={() => setCaptureAsTask((prev) => !prev)}
          title={captureAsTask ? '目前模式：加入待辦收件匣' : '目前模式：直接排入時間軸'}
          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0"
        >
          <LucideIcon name={captureAsTask ? 'inbox' : 'calendar-plus'} size={13} />
          <span>{captureAsTask ? '收件匣' : '時間塊'}</span>
        </button>

        <button
          type="submit"
          data-testid="quick-capture-submit-btn"
          disabled={!inputValue.trim()}
          className="btn-sky-primary px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 shrink-0 disabled:opacity-45"
        >
          <LucideIcon name="corner-down-left" size={14} />
          <span>{captureAsTask ? '記待辦' : '排入'}</span>
        </button>
      </form>

      {/* Instant Live NLP Token Preview Pills */}
      {parsed && (
        <div
          data-testid="quick-capture-preview"
          className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center gap-1.5 flex-wrap text-[11px]"
        >
          <span className="font-bold text-[var(--text-main)] inline-flex items-center gap-1">
            <LucideIcon name="wand-sparkles" size={12} className="text-sky-500" />
            <span>{parsed.title}</span>
          </span>
          {parsed.tokensDetected.map((tok, idx) => (
            <span
              key={`${tok.kind}-${idx}`}
              data-testid={`nlp-token-${tok.kind}`}
              className={`px-2 py-0.5 rounded-full font-semibold ${
                tok.kind === 'tag'
                  ? COLOR_TOKEN_PALETTE[parsed.colorToken].badgeClass
                  : 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border border-sky-400/25'
              }`}
            >
              {tok.label}
            </span>
          ))}
          {parsed.tokensDetected.length === 0 && (
            <span className="text-[var(--text-muted)]">
              預設安排於 {new Date(parsed.startAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}（{parsed.durationMinutes} 分鐘）
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default QuickCaptureBar;
