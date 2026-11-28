import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { BellToggleButton, PaperPlaneSendButton } from './UiMomentsPrimitives';
import { COLOR_TOKEN_LIST, COLOR_TOKEN_PALETTE } from '../data/seedData';
import { buildGoogleCalendarUrl } from '../services/icsService';
import {
  applyRecurringDelete,
  applyRecurringEdit,
  describeRecurrenceRule,
  parseLocalDateKey,
  toLocalDateKey
} from '../services/recurrenceEngine';
import { generateUuidV4 } from '../services/scheduleSyncService';
import { useScheduleStore } from '../store/useScheduleStore';
import { useBackdropDismissGuard } from '../utils/uiMomentsMotion';
import type {
  ColorToken,
  PriorityLevel,
  RecurrenceEditScope,
  RecurrenceFreq,
  RecurrenceRule,
  Subtask
} from '../types/schedule';

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

const WEEKDAY_BUTTONS = [
  { val: 1, label: '一' },
  { val: 2, label: '二' },
  { val: 3, label: '三' },
  { val: 4, label: '四' },
  { val: 5, label: '五' },
  { val: 6, label: '六' },
  { val: 0, label: '日' }
];

export default function EventDetailDrawer() {
  const {
    events,
    calendars,
    comments,
    selectedDate,
    selectedEventId,
    selectedInstanceDate,
    activeModal,
    preferences,
    selectEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    replaceEventsAtomic,
    addEventComment,
    deleteEventComment,
    completeEventEarly,
    setSelectedDate,
    getCurrentUserRoleForCalendar,
    openModal,
    closeModal
  } = useScheduleStore();

  const event = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const isCreateMode = activeModal === 'event-create' && !event;

  const defaultCreateCalendar = useMemo(() => {
    const writable = calendars.filter((c) => getCurrentUserRoleForCalendar(c.id) !== 'viewer');
    const activeSet = preferences.activeCalendarSet;
    if (activeSet !== 'all') {
      const setMatch = writable.find((c) => c.calendarSet === activeSet && c.visible !== false);
      if (setMatch) return setMatch;
    }
    return writable.find((c) => c.visible !== false) || writable[0] || calendars[0] || null;
  }, [calendars, getCurrentUserRoleForCalendar, preferences.activeCalendarSet]);

  const defaultCreateCalendarRef = useRef(defaultCreateCalendar);
  defaultCreateCalendarRef.current = defaultCreateCalendar;

  const titleInputRef = useRef<HTMLInputElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [allDayStartDate, setAllDayStartDate] = useState('');
  const [allDayEndDate, setAllDayEndDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [colorToken, setColorToken] = useState<ColorToken>('sky');
  const [categoryTag, setCategoryTag] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>(2);
  const [bufferBeforeMin, setBufferBeforeMin] = useState(0);
  const [bufferAfterMin, setBufferAfterMin] = useState(0);
  const [isFlexible, setIsFlexible] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [validationError, setValidationError] = useState<{
    field: 'title' | 'start';
    message: string;
  } | null>(null);

  // Recurrence state
  const [recEnabled, setRecEnabled] = useState(false);
  const [recFreq, setRecFreq] = useState<RecurrenceFreq>('weekly');
  const [recInterval, setRecInterval] = useState(1);
  const [recWeekdays, setRecWeekdays] = useState<number[]>([1, 3, 5]);
  const [recUntil, setRecUntil] = useState('');
  const [editScope, setEditScope] = useState<RecurrenceEditScope>('all');

  // Comments state (Shared live thread)
  const [commentInput, setCommentInput] = useState('');

  const handleClose = useCallback(() => {
    if (isCreateMode) {
      closeModal();
    } else {
      selectEvent(null);
    }
  }, [isCreateMode, closeModal, selectEvent]);

  const backdropGuard = useBackdropDismissGuard(handleClose);

  useEffect(() => {
    setValidationError(null);
    if (isCreateMode) {
      const defCal = defaultCreateCalendarRef.current;
      setTitle('');
      setCalendarId(defCal?.id || '');
      setStartLocal('');
      setEndLocal('');
      setAllDayStartDate('');
      setAllDayEndDate('');
      setAllDay(false);
      setColorToken(defCal?.colorToken || 'sky');
      setCategoryTag('');
      setLocation('');
      setNotes('');
      setPriority(2);
      setBufferBeforeMin(0);
      setBufferAfterMin(0);
      setIsFlexible(false);
      setReminderEnabled(true);
      setSubtasks([]);
      setNewSubtaskText('');
      setRecEnabled(false);
      setRecFreq('weekly');
      setRecInterval(1);
      setRecWeekdays([new Date().getDay()]);
      setRecUntil('');
      setEditScope('all');
      return;
    }

    if (!event) return;
    setTitle(event.title);
    setCalendarId(event.calendarId);
    setStartLocal(toLocalDateTimeInput(event.startAt));
    setEndLocal(toLocalDateTimeInput(event.endAt));
    setAllDayStartDate(toLocalDateKey(new Date(event.startAt)));
    setAllDayEndDate(toLocalDateKey(new Date(event.endAt)));
    setAllDay(event.allDay);
    setColorToken(event.colorToken);
    setCategoryTag(event.categoryTag);
    setLocation(event.location);
    setNotes(event.notes);
    setPriority(event.priority);
    setBufferBeforeMin(event.bufferBeforeMin);
    setBufferAfterMin(event.bufferAfterMin);
    setIsFlexible(event.isFlexible);
    setReminderEnabled((event.reminderMinutes?.length ?? 0) > 0);
    setSubtasks(event.subtasks || []);
    setNewSubtaskText('');
    if (event.recurrenceRule) {
      setRecEnabled(true);
      setRecFreq(event.recurrenceRule.freq);
      setRecInterval(event.recurrenceRule.interval || 1);
      setRecWeekdays(event.recurrenceRule.byWeekday || [new Date(event.startAt).getDay()]);
      setRecUntil(event.recurrenceRule.until ? event.recurrenceRule.until.slice(0, 10) : '');
    } else {
      setRecEnabled(false);
      setRecFreq('weekly');
      setRecInterval(1);
      setRecWeekdays([new Date(event.startAt).getDay()]);
      setRecUntil('');
    }
    setEditScope('all');
  }, [event, isCreateMode]);

  if (!event && !isCreateMode) return null;

  const userRole = event ? getCurrentUserRoleForCalendar(event.calendarId) : 'owner';
  const isViewerOnly = !isCreateMode && userRole === 'viewer';
  const eventComments = event ? comments.filter((c) => c.eventId === event.id) : [];
  const occurrenceDate = selectedInstanceDate || (event ? event.startAt.slice(0, 10) : selectedDate);

  const getReferenceDateForRule = (): Date => {
    if (allDay && allDayStartDate) return parseLocalDateKey(allDayStartDate);
    if (startLocal) {
      const parsed = new Date(startLocal);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (event) return new Date(event.startAt);
    return parseLocalDateKey(selectedDate);
  };

  const buildRulePayload = (): RecurrenceRule | null => {
    if (!recEnabled) return null;
    const refDate = getReferenceDateForRule();
    const rule: RecurrenceRule = {
      freq: recFreq,
      interval: Math.max(1, recInterval),
      until: recUntil.trim() ? recUntil.trim() : null
    };
    if (recFreq === 'weekly') {
      rule.byWeekday = recWeekdays.length > 0 ? recWeekdays : [refDate.getDay()];
    }
    if (recFreq === 'monthly') {
      rule.byMonthDay = refDate.getDate();
    }
    return rule;
  };

  const handleStartLocalChange = (nextStart: string) => {
    setStartLocal(nextStart);
    if (validationError?.field === 'start') setValidationError(null);
    if (nextStart) {
      const startMs = Date.parse(nextStart);
      if (!Number.isNaN(startMs)) {
        const endMs = endLocal ? Date.parse(endLocal) : Number.NaN;
        if (Number.isNaN(endMs) || endMs <= startMs) {
          const durationMin = Math.max(15, preferences.defaultEventMinutes || 60);
          setEndLocal(toLocalDateTimeInput(new Date(startMs + durationMin * 60_000).toISOString()));
        }
      }
    }
  };

  const handleAllDayToggle = (checked: boolean) => {
    setAllDay(checked);
    if (validationError?.field === 'start') setValidationError(null);
    if (checked && !allDayStartDate) {
      const derivedStart = startLocal ? startLocal.slice(0, 10) : selectedDate;
      const derivedEnd =
        endLocal && endLocal.slice(0, 10) >= derivedStart ? endLocal.slice(0, 10) : derivedStart;
      setAllDayStartDate(derivedStart);
      setAllDayEndDate(derivedEnd);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewerOnly) return;

    const trimmedTitle = title.trim();
    if (isCreateMode && !trimmedTitle) {
      setValidationError({ field: 'title', message: '請輸入行程標題' });
      titleInputRef.current?.focus();
      return;
    }

    let startIso = '';
    let endIso = '';

    if (allDay) {
      if (isCreateMode && !allDayStartDate) {
        setValidationError({ field: 'start', message: '請選擇行程日期' });
        startInputRef.current?.focus();
        return;
      }
      const startDateKey = allDayStartDate || (event ? toLocalDateKey(new Date(event.startAt)) : selectedDate);
      const endDateKey =
        allDayEndDate && allDayEndDate >= startDateKey ? allDayEndDate : startDateKey;
      const startObj = parseLocalDateKey(startDateKey);
      startObj.setHours(0, 0, 0, 0);
      const endObj = parseLocalDateKey(endDateKey);
      endObj.setHours(23, 59, 59, 0);
      startIso = startObj.toISOString();
      endIso = endObj.toISOString();
    } else {
      if (isCreateMode && !startLocal) {
        setValidationError({ field: 'start', message: '請選擇開始時間，或勾選「全天行程」' });
        startInputRef.current?.focus();
        return;
      }
      startIso = startLocal ? new Date(startLocal).toISOString() : event!.startAt;
      const defaultDurationMs = Math.max(15, preferences.defaultEventMinutes || 60) * 60_000;
      endIso = endLocal
        ? new Date(endLocal).toISOString()
        : event
          ? event.endAt
          : new Date(Date.parse(startIso) + defaultDurationMs).toISOString();
      if (Date.parse(endIso) <= Date.parse(startIso)) {
        endIso = new Date(Date.parse(startIso) + 30 * 60_000).toISOString();
      }
    }

    setValidationError(null);

    if (isCreateMode) {
      createEvent({
        title: trimmedTitle,
        calendarId: calendarId || defaultCreateCalendar?.id,
        startAt: startIso,
        endAt: endIso,
        allDay,
        colorToken,
        categoryTag: categoryTag.trim() || '一般',
        location: location.trim(),
        notes: notes.trim(),
        priority,
        bufferBeforeMin: Math.max(0, bufferBeforeMin),
        bufferAfterMin: Math.max(0, bufferAfterMin),
        isFlexible,
        reminderMinutes: reminderEnabled ? [15] : [],
        subtasks,
        recurrenceRule: buildRulePayload()
      });
      setSelectedDate(toLocalDateKey(new Date(startIso)));
      closeModal();
      return;
    }

    if (!event) return;

    const updates = {
      title: trimmedTitle || event.title,
      calendarId,
      startAt: startIso,
      endAt: endIso,
      allDay,
      colorToken,
      categoryTag: categoryTag.trim() || '一般',
      location: location.trim(),
      notes: notes.trim(),
      priority,
      bufferBeforeMin: Math.max(0, bufferBeforeMin),
      bufferAfterMin: Math.max(0, bufferAfterMin),
      isFlexible,
      reminderMinutes: reminderEnabled
        ? event.reminderMinutes?.length
          ? event.reminderMinutes
          : [15]
        : [],
      subtasks,
      recurrenceRule: buildRulePayload()
    };

    if (event.recurrenceRule && editScope !== 'all') {
      const nextEvents = applyRecurringEdit(events, event.id, occurrenceDate, editScope, updates);
      replaceEventsAtomic(
        nextEvents,
        editScope === 'single' ? `已更新單次行程「${updates.title}」` : `已更新後續系列「${updates.title}」`
      );
    } else {
      updateEvent(event.id, updates);
    }
    selectEvent(null);
  };

  const handleDelete = () => {
    if (isViewerOnly || !event) return;
    if (event.recurrenceRule && editScope !== 'all') {
      const nextEvents = applyRecurringDelete(events, event.id, occurrenceDate, editScope);
      replaceEventsAtomic(
        nextEvents,
        editScope === 'single' ? `已移除單次行程「${event.title}」` : `已移除後續系列「${event.title}」`
      );
      selectEvent(null);
      return;
    }
    deleteEvent(event.id);
    selectEvent(null);
  };

  const handleQuickShiftDuration = (deltaMinutes: number) => {
    if (isViewerOnly) return;
    const baseStart = startLocal || event?.startAt;
    if (!baseStart) return;
    const s = new Date(baseStart).getTime();
    const curE = endLocal
      ? new Date(endLocal).getTime()
      : event
        ? new Date(event.endAt).getTime()
        : s + Math.max(15, preferences.defaultEventMinutes || 60) * 60_000;
    const nextE = Math.max(s + 15 * 60_000, curE + deltaMinutes * 60_000);
    setEndLocal(toLocalDateTimeInput(new Date(nextE).toISOString()));
  };

  const handleAddSubtask = () => {
    const clean = newSubtaskText.trim();
    if (!clean) return;
    setSubtasks((prev) => [...prev, { id: generateUuidV4(), title: clean, done: false }]);
    setNewSubtaskText('');
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !commentInput.trim()) return;
    addEventComment(event.id, commentInput.trim());
    setCommentInput('');
  };

  const toggleWeekday = (dow: number) => {
    setRecWeekdays((prev) =>
      prev.includes(dow) ? (prev.length > 1 ? prev.filter((d) => d !== dow) : prev) : [...prev, dow].sort((a, b) => a - b)
    );
  };

  return (
    <div
      data-testid="event-detail-drawer"
      data-drawer-mode={isCreateMode ? 'create' : 'edit'}
      className="um-backdrop-enter fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/45 backdrop-blur-sm"
      {...backdropGuard}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isCreateMode ? '新增行程' : '行程詳情與即時留言'}
        onClick={(e) => e.stopPropagation()}
        className="um-drawer-right-enter landscape-compact-modal max-h-dvh-92 sm:max-h-none sm:h-full w-full sm:max-w-lg bg-[var(--surface-glass-strong)] border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="landscape-compact-drawer-bar px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                (COLOR_TOKEN_PALETTE[colorToken] || COLOR_TOKEN_PALETTE.sky).dotClass
              }`}
            />
            <h2 className="text-base font-extrabold text-[var(--text-main)] truncate">
              {isCreateMode ? '新增行程' : isViewerOnly ? '檢視共享行程（唯讀）' : '編輯行程與討論'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isCreateMode && event && (
              <a
                href={buildGoogleCalendarUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                title="一鍵加入 Google 日曆"
                className="btn-sky-secondary px-2.5 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1"
              >
                <LucideIcon name="external-link" size={12} />
                <span>Google 日曆</span>
              </a>
            )}
            <button
              type="button"
              data-testid="close-event-drawer-btn"
              onClick={handleClose}
              aria-label="關閉抽屜"
              className="p-1.5 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
            >
              <LucideIcon name="x" size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <form id="event-detail-form" onSubmit={handleSave} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                行程標題
              </label>
              <input
                ref={titleInputRef}
                type="text"
                data-testid="event-detail-title-input"
                value={title}
                disabled={isViewerOnly}
                placeholder="請輸入行程標題..."
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError?.field === 'title') setValidationError(null);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold bg-[var(--surface-subtle)] border text-[var(--text-main)] placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-65 ${
                  validationError?.field === 'title' ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                }`}
              />
              {validationError?.field === 'title' && (
                <p
                  role="alert"
                  data-testid="event-detail-validation-error"
                  className="mt-1 text-xs font-semibold text-rose-500"
                >
                  {validationError.message}
                </p>
              )}
            </div>

            {/* Time / Date Inputs + Mobile -15m/+15m */}
            {allDay ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">開始日期</label>
                  <input
                    ref={startInputRef}
                    type="date"
                    data-testid="event-detail-start-date-input"
                    value={allDayStartDate}
                    disabled={isViewerOnly}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setAllDayStartDate(nextDate);
                      if (!allDayEndDate || allDayEndDate < nextDate) {
                        setAllDayEndDate(nextDate);
                      }
                      if (validationError?.field === 'start') setValidationError(null);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--surface-subtle)] border text-[var(--text-main)] ${
                      validationError?.field === 'start' ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">結束日期</label>
                  <input
                    type="date"
                    data-testid="event-detail-end-date-input"
                    value={allDayEndDate}
                    min={allDayStartDate || undefined}
                    disabled={isViewerOnly}
                    onChange={(e) => setAllDayEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">開始時間</label>
                  <input
                    ref={startInputRef}
                    type="datetime-local"
                    data-testid="event-detail-start-input"
                    value={startLocal}
                    disabled={isViewerOnly}
                    onChange={(e) => handleStartLocalChange(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--surface-subtle)] border text-[var(--text-main)] ${
                      validationError?.field === 'start' ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">結束時間</label>
                  <input
                    type="datetime-local"
                    data-testid="event-detail-end-input"
                    value={endLocal}
                    disabled={isViewerOnly}
                    onChange={(e) => setEndLocal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                  />
                </div>
              </div>
            )}

            {validationError?.field === 'start' && (
              <p
                role="alert"
                data-testid="event-detail-validation-error"
                className="-mt-2 text-xs font-semibold text-rose-500"
              >
                {validationError.message}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    data-testid="event-detail-allday-checkbox"
                    checked={allDay}
                    disabled={isViewerOnly}
                    onChange={(e) => handleAllDayToggle(e.target.checked)}
                    className="rounded theme-checkbox"
                  />
                  <span>全天行程</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={isFlexible}
                    disabled={isViewerOnly}
                    onChange={(e) => setIsFlexible(e.target.checked)}
                    className="rounded theme-checkbox"
                  />
                  <span>彈性可順延</span>
                </label>
                <BellToggleButton
                  active={reminderEnabled}
                  badge={reminderEnabled ? '15m' : undefined}
                  label={reminderEnabled ? '會前 15 分提醒' : '不提醒'}
                  data-testid="event-detail-reminder-bell"
                  onToggle={() => {
                    if (!isViewerOnly) setReminderEnabled((prev) => !prev);
                  }}
                />
              </div>

              {!isViewerOnly && !allDay && Boolean(startLocal || event) && (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickShiftDuration(-15)}
                    className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-[var(--surface-subtle)] border border-[var(--border-subtle)]"
                  >
                    -15m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickShiftDuration(15)}
                    className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-[var(--surface-subtle)] border border-[var(--border-subtle)]"
                  >
                    +15m
                  </button>
                </div>
              )}
            </div>

            {/* Calendar + Tag + Priority */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">所屬日曆</label>
                <select
                  value={calendarId}
                  disabled={isViewerOnly}
                  onChange={(e) => setCalendarId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                >
                  {calendars.map((c) => {
                    const readOnly = isCreateMode && getCurrentUserRoleForCalendar(c.id) === 'viewer';
                    return (
                      <option key={c.id} value={c.id} disabled={readOnly}>
                        {readOnly ? `${c.name}（唯讀）` : c.name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">分類標籤</label>
                <input
                  type="text"
                  data-testid="event-detail-category-input"
                  value={categoryTag}
                  disabled={isViewerOnly}
                  placeholder="選填（如：工作）"
                  onChange={(e) => setCategoryTag(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/70"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">優先級</label>
                <select
                  value={priority}
                  disabled={isViewerOnly}
                  onChange={(e) => setPriority(Number(e.target.value) as PriorityLevel)}
                  className="w-full px-2.5 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                >
                  <option value={1}>P1 高優先</option>
                  <option value={2}>P2 中優先</option>
                  <option value={3}>P3 低優先</option>
                </select>
              </div>
            </div>

            {/* Color Token Picker */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">語意色標</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_TOKEN_LIST.map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    disabled={isViewerOnly}
                    onClick={() => setColorToken(item.token)}
                    title={item.label}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${item.dotClass} ${
                      colorToken === item.token
                        ? 'ring-2 ring-offset-2 ring-offset-[var(--surface-glass-strong)] ring-[var(--accent-primary)] scale-110'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    {colorToken === item.token && <LucideIcon name="check" size={13} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Buffers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  會前緩衝 (分鐘)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={bufferBeforeMin}
                  disabled={isViewerOnly}
                  onChange={(e) => setBufferBeforeMin(Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  會後緩衝 (分鐘)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={bufferAfterMin}
                  disabled={isViewerOnly}
                  onChange={(e) => setBufferAfterMin(Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                />
              </div>
            </div>

            {/* Recurrence Rule Configuration */}
            <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/70 space-y-3">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-extrabold text-[var(--text-main)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recEnabled}
                    disabled={isViewerOnly}
                    onChange={(e) => setRecEnabled(e.target.checked)}
                    className="rounded theme-checkbox"
                  />
                  <LucideIcon name="repeat" size={14} className="theme-accent-text" />
                  <span>啟用彈性重複規則</span>
                </label>
                {recEnabled && (
                  <span className="text-[11px] font-semibold theme-accent-deep">
                    {describeRecurrenceRule(buildRulePayload())}
                  </span>
                )}
              </div>

              {recEnabled && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={recFreq}
                      disabled={isViewerOnly}
                      onChange={(e) => setRecFreq(e.target.value as RecurrenceFreq)}
                      className="px-2.5 py-1.5 rounded-xl text-xs bg-[var(--surface-glass)] border border-[var(--border-subtle)]"
                    >
                      <option value="daily">每天</option>
                      <option value="weekly">每週自選星期</option>
                      <option value="monthly">每月指定日</option>
                      <option value="every_n_days">每 N 天</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={recInterval}
                      disabled={isViewerOnly}
                      onChange={(e) => setRecInterval(Math.max(1, Number(e.target.value) || 1))}
                      placeholder="間隔"
                      className="px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[var(--surface-glass)] border border-[var(--border-subtle)]"
                    />
                  </div>

                  {recFreq === 'weekly' && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {WEEKDAY_BUTTONS.map((w) => {
                        const active = recWeekdays.includes(w.val);
                        return (
                          <button
                            key={w.val}
                            type="button"
                            disabled={isViewerOnly}
                            onClick={() => toggleWeekday(w.val)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold ${
                              active
                                ? 'theme-accent-solid'
                                : 'bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-muted)]'
                            }`}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-muted)] shrink-0">結束日期（選填）：</span>
                    <input
                      type="date"
                      value={recUntil}
                      disabled={isViewerOnly}
                      onChange={(e) => setRecUntil(e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-xl text-xs font-mono bg-[var(--surface-glass)] border border-[var(--border-subtle)]"
                    />
                  </div>
                </div>
              )}

              {!isCreateMode && event?.recurrenceRule && !isViewerOnly && (
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="font-bold text-[var(--text-muted)]">修改／刪除範圍：</span>
                  {(
                    [
                      ['single', '僅此筆'],
                      ['this_and_following', '此筆與之後'],
                      ['all', '整個系列']
                    ] as Array<[RecurrenceEditScope, string]>
                  ).map(([scopeId, label]) => (
                    <button
                      key={scopeId}
                      type="button"
                      data-testid={`recurrence-scope-${scopeId}`}
                      onClick={() => setEditScope(scopeId)}
                      className={`px-2 py-0.5 rounded-lg font-bold ${
                        editScope === scopeId
                          ? 'theme-accent-solid'
                          : 'bg-[var(--surface-glass)] text-[var(--text-muted)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location & Notes */}
            <div className="space-y-2.5">
              <input
                type="text"
                value={location}
                disabled={isViewerOnly}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="地點或會議連結"
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
              />
              <textarea
                rows={2}
                value={notes}
                disabled={isViewerOnly}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="行程備註與議程說明..."
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
              />
            </div>

            {/* Subtasks Editor */}
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
                <LucideIcon name="list-todo" size={14} className="theme-accent-text" />
                <span>子任務清單 ({subtasks.filter((s) => s.done).length}/{subtasks.length})</span>
              </div>
              <div className="space-y-1.5">
                {subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface-subtle)] text-xs"
                  >
                    <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sub.done}
                        disabled={isViewerOnly}
                        onChange={() =>
                          setSubtasks((prev) =>
                            prev.map((s) => (s.id === sub.id ? { ...s, done: !s.done } : s))
                          )
                        }
                        className="rounded theme-checkbox"
                      />
                      <span className={`schedule-title-wrap ${sub.done ? 'line-through opacity-60' : ''}`}>
                        {sub.title}
                      </span>
                    </label>
                    {!isViewerOnly && (
                      <button
                        type="button"
                        onClick={() => setSubtasks((prev) => prev.filter((s) => s.id !== sub.id))}
                        className="text-rose-500 p-0.5 hover:bg-rose-500/15 rounded"
                      >
                        <LucideIcon name="x" size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!isViewerOnly && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    placeholder="新增子任務..."
                    className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtask}
                    className="btn-sky-secondary px-3 py-1.5 rounded-xl text-xs font-bold"
                  >
                    新增
                  </button>
                </div>
              )}
            </div>
          </form>

          {/* Shared Live Event Comments Thread (Edit Mode Only) */}
          {!isCreateMode && event && (
            <section
              data-testid="event-comments-section"
              className="pt-4 border-t border-[var(--border-subtle)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
                  <LucideIcon name="message-square" size={14} className="theme-accent-text" />
                  <span>單一行程即時留言串 ({eventComments.length})</span>
                </h3>
                <span className="text-[10px] text-[var(--text-muted)]">支援共享日曆即時討論</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {eventComments.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">尚無留言，發起這筆行程的討論吧。</p>
                ) : (
                  eventComments.map((c) => (
                    <div
                      key={c.id}
                      data-testid={`event-comment-${c.id}`}
                      className="p-2.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-extrabold theme-accent-deep">
                          {c.authorName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">
                            {new Date(c.createdAt).toLocaleTimeString('zh-TW', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteEventComment(c.id)}
                            aria-label="刪除留言"
                            className="text-[var(--text-muted)] hover:text-rose-500"
                          >
                            <LucideIcon name="trash-2" size={11} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-main)] leading-relaxed break-words">
                        {c.body}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handlePostComment} className="flex items-center gap-1.5">
                <input
                  type="text"
                  data-testid="event-comment-input"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="輸入留言與共享成員同步討論..."
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                />
                <PaperPlaneSendButton
                  type="submit"
                  data-testid="event-comment-submit-btn"
                  disabled={!commentInput.trim()}
                  label="送出"
                  className="btn-sky-primary px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-45"
                />
              </form>
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`landscape-compact-drawer-bar px-4 sm:px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]/70 pb-safe-bottom ${
            isCreateMode
              ? 'flex flex-row items-center justify-between gap-2.5'
              : 'flex flex-col sm:flex-row sm:items-center justify-between gap-2'
          }`}
        >
          {isCreateMode ? (
            <>
              <button
                type="button"
                data-testid="event-detail-cancel-btn"
                onClick={handleClose}
                className="btn-sky-secondary px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LucideIcon name="x" size={14} className="shrink-0" />
                <span>取消</span>
              </button>
              <button
                type="submit"
                form="event-detail-form"
                data-testid="event-detail-save-btn"
                className="btn-sky-primary flex-1 sm:flex-none justify-center px-5 py-2.5 sm:py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LucideIcon name="check" size={14} className="shrink-0" />
                <span>新增行程</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between sm:justify-start gap-1.5 w-full sm:w-auto">
                {!isViewerOnly && (
                  <button
                    type="button"
                    data-testid="event-detail-delete-btn"
                    onClick={handleDelete}
                    className="px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <LucideIcon name="trash-2" size={14} className="shrink-0" />
                    <span>刪除</span>
                  </button>
                )}
                <div className="flex items-center gap-1.5">
                  {event && (
                    <button
                      type="button"
                      onClick={() => {
                        openModal('focus', { focusTargetEventId: event.id });
                        selectEvent(null);
                      }}
                      className="btn-sky-secondary px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <LucideIcon name="timer" size={14} className="shrink-0" />
                      <span>專注</span>
                    </button>
                  )}
                  {event && event.status !== 'completed' && !isViewerOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        completeEventEarly(event.id);
                        selectEvent(null);
                      }}
                      className="btn-sky-secondary px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <LucideIcon name="zap" size={14} className="shrink-0" />
                      <span>提早完成</span>
                    </button>
                  )}
                </div>
              </div>

              {!isViewerOnly && (
                <button
                  type="submit"
                  form="event-detail-form"
                  data-testid="event-detail-save-btn"
                  className="btn-sky-primary w-full sm:w-auto justify-center px-5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LucideIcon name="check" size={14} className="shrink-0" />
                  <span>儲存變更</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
