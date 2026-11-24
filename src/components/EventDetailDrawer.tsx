import React, { useEffect, useMemo, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { COLOR_TOKEN_LIST, COLOR_TOKEN_PALETTE } from '../data/seedData';
import { buildGoogleCalendarUrl } from '../services/icsService';
import {
  applyRecurringDelete,
  applyRecurringEdit,
  describeRecurrenceRule
} from '../services/recurrenceEngine';
import { generateUuidV4 } from '../services/scheduleSyncService';
import { useScheduleStore } from '../store/useScheduleStore';
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
    selectedEventId,
    selectedInstanceDate,
    selectEvent,
    updateEvent,
    deleteEvent,
    replaceEventsAtomic,
    addEventComment,
    deleteEventComment,
    completeEventEarly,
    getCurrentUserRoleForCalendar,
    openModal
  } = useScheduleStore();

  const event = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [colorToken, setColorToken] = useState<ColorToken>('sky');
  const [categoryTag, setCategoryTag] = useState('工作');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>(2);
  const [bufferBeforeMin, setBufferBeforeMin] = useState(0);
  const [bufferAfterMin, setBufferAfterMin] = useState(0);
  const [isFlexible, setIsFlexible] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  // Recurrence state
  const [recEnabled, setRecEnabled] = useState(false);
  const [recFreq, setRecFreq] = useState<RecurrenceFreq>('weekly');
  const [recInterval, setRecInterval] = useState(1);
  const [recWeekdays, setRecWeekdays] = useState<number[]>([1, 3, 5]);
  const [recUntil, setRecUntil] = useState('');
  const [editScope, setEditScope] = useState<RecurrenceEditScope>('all');

  // Comments state (Shared live thread)
  const [commentInput, setCommentInput] = useState('');

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setCalendarId(event.calendarId);
    setStartLocal(toLocalDateTimeInput(event.startAt));
    setEndLocal(toLocalDateTimeInput(event.endAt));
    setAllDay(event.allDay);
    setColorToken(event.colorToken);
    setCategoryTag(event.categoryTag);
    setLocation(event.location);
    setNotes(event.notes);
    setPriority(event.priority);
    setBufferBeforeMin(event.bufferBeforeMin);
    setBufferAfterMin(event.bufferAfterMin);
    setIsFlexible(event.isFlexible);
    setSubtasks(event.subtasks || []);
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
  }, [event]);

  if (!event) return null;

  const userRole = getCurrentUserRoleForCalendar(event.calendarId);
  const isViewerOnly = userRole === 'viewer';
  const eventComments = comments.filter((c) => c.eventId === event.id);
  const occurrenceDate = selectedInstanceDate || event.startAt.slice(0, 10);

  const buildRulePayload = (): RecurrenceRule | null => {
    if (!recEnabled) return null;
    const rule: RecurrenceRule = {
      freq: recFreq,
      interval: Math.max(1, recInterval),
      until: recUntil.trim() ? recUntil.trim() : null
    };
    if (recFreq === 'weekly') {
      rule.byWeekday = recWeekdays.length > 0 ? recWeekdays : [new Date(event.startAt).getDay()];
    }
    if (recFreq === 'monthly') {
      rule.byMonthDay = new Date(startLocal || event.startAt).getDate();
    }
    return rule;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewerOnly) return;

    const startIso = startLocal ? new Date(startLocal).toISOString() : event.startAt;
    let endIso = endLocal ? new Date(endLocal).toISOString() : event.endAt;
    if (Date.parse(endIso) <= Date.parse(startIso)) {
      endIso = new Date(Date.parse(startIso) + 30 * 60_000).toISOString();
    }

    const updates = {
      title: title.trim() || event.title,
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
    if (isViewerOnly) return;
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
    const s = new Date(startLocal || event.startAt).getTime();
    const curE = new Date(endLocal || event.endAt).getTime();
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
    if (!commentInput.trim()) return;
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
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/45 backdrop-blur-sm"
      onClick={() => selectEvent(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="行程詳情與即時留言"
        onClick={(e) => e.stopPropagation()}
        className="landscape-compact-modal max-h-dvh-92 sm:max-h-none sm:h-full w-full sm:max-w-lg bg-[var(--surface-glass-strong)] border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col overflow-hidden"
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
              {isViewerOnly ? '檢視共享行程（唯讀）' : '編輯行程與討論'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
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
            <button
              type="button"
              data-testid="close-event-drawer-btn"
              onClick={() => selectEvent(null)}
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
                type="text"
                data-testid="event-detail-title-input"
                value={title}
                disabled={isViewerOnly}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-sky-400 disabled:opacity-65"
              />
            </div>

            {/* Time Inputs + Mobile -15m/+15m */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">開始時間</label>
                <input
                  type="datetime-local"
                  value={startLocal}
                  disabled={isViewerOnly || allDay}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">結束時間</label>
                <input
                  type="datetime-local"
                  value={endLocal}
                  disabled={isViewerOnly || allDay}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={allDay}
                    disabled={isViewerOnly}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="rounded text-sky-500"
                  />
                  <span>全天行程</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={isFlexible}
                    disabled={isViewerOnly}
                    onChange={(e) => setIsFlexible(e.target.checked)}
                    className="rounded text-sky-500"
                  />
                  <span>彈性可順延</span>
                </label>
              </div>

              {!isViewerOnly && !allDay && (
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
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">分類標籤</label>
                <input
                  type="text"
                  value={categoryTag}
                  disabled={isViewerOnly}
                  onChange={(e) => setCategoryTag(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)]"
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
                      colorToken === item.token ? 'ring-2 ring-offset-2 ring-sky-500 scale-110' : 'opacity-75 hover:opacity-100'
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

            {/* Free Recurrence Rule Configuration */}
            <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/70 space-y-3">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-extrabold text-[var(--text-main)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recEnabled}
                    disabled={isViewerOnly}
                    onChange={(e) => setRecEnabled(e.target.checked)}
                    className="rounded text-sky-500"
                  />
                  <LucideIcon name="repeat" size={14} className="text-sky-500" />
                  <span>啟用彈性重複規則</span>
                </label>
                {recEnabled && (
                  <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
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
                                ? 'bg-sky-500 text-white'
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

              {event.recurrenceRule && !isViewerOnly && (
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
                          ? 'bg-sky-500 text-white'
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
                <LucideIcon name="list-todo" size={14} className="text-sky-500" />
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
                        className="rounded text-sky-500"
                      />
                      <span className={`truncate ${sub.done ? 'line-through opacity-60' : ''}`}>
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

          {/* Shared Live Event Comments Thread */}
          <section
            data-testid="event-comments-section"
            className="pt-4 border-t border-[var(--border-subtle)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
                <LucideIcon name="message-square" size={14} className="text-violet-500" />
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
                      <span className="font-extrabold text-sky-700 dark:text-sky-300">
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
              <button
                type="submit"
                data-testid="event-comment-submit-btn"
                disabled={!commentInput.trim()}
                className="btn-sky-primary px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 disabled:opacity-45"
              >
                <LucideIcon name="send" size={13} />
                <span>送出</span>
              </button>
            </form>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="landscape-compact-drawer-bar px-4 sm:px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-safe-bottom">
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
              {event.status !== 'completed' && !isViewerOnly && (
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
        </div>
      </div>
    </div>
  );
}
