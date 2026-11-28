import React, { useMemo, useState } from 'react';
import { LucideIcon } from './BrandMark';
import RecurringDeleteModal from './RecurringDeleteModal';
import SwipeableEventCard, { SwipeRevealGroup } from './SwipeableEventCard';
import { LikeBurstLayer, OdometerNumber, StrokeCheckIndicator } from './UiMomentsPrimitives';
import { COLOR_TOKEN_PALETTE, formatLocalDate } from '../data/seedData';
import { useEventQuickDelete } from '../hooks/useEventQuickDelete';
import { parseLocalDateKey } from '../services/recurrenceEngine';
import { detectScheduleConflicts } from '../services/smartScheduler';
import { triggerLightHaptic } from '../services/notificationBridge';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ExpandedEventInstance } from '../types/schedule';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

function formatTimeHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export interface TimelineViewProps {
  instances: ExpandedEventInstance[];
}

function TimelineView({ instances }: TimelineViewProps) {
  const {
    selectedDate,
    comments,
    preferences,
    inboxDrawerOpen,
    selectEvent,
    moveOrResizeEvent,
    scheduleTaskToTimeBlock,
    toggleEventSubtask,
    toggleEventComplete,
    completeEventEarly,
    createEvent,
    setInboxDrawerOpen,
    openModal
  } = useScheduleStore();

  const {
    pendingRecurringEvent,
    canDeleteEvent,
    requestDeleteEvent,
    confirmRecurringDelete,
    cancelRecurringDelete
  } = useEventQuickDelete();

  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [burstByEvent, setBurstByEvent] = useState<Record<string, number>>({});

  const dayInstances = useMemo(
    () => instances.filter((inst) => inst.occurrenceDate === selectedDate),
    [instances, selectedDate]
  );

  const allDayEvents = useMemo(() => dayInstances.filter((e) => e.allDay), [dayInstances]);
  const timedEvents = useMemo(
    () =>
      dayInstances
        .filter((e) => !e.allDay)
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    [dayInstances]
  );

  const conflicts = useMemo(() => detectScheduleConflicts(timedEvents), [timedEvents]);
  const conflictEventIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) {
      s.add(c.eventIdA);
      s.add(c.eventIdB);
    }
    return s;
  }, [conflicts]);

  const commentCountByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of comments) {
      map.set(c.eventId, (map.get(c.eventId) || 0) + 1);
    }
    return map;
  }, [comments]);

  // Compute meaningful free gaps (>= 30m) within user's work window
  const freeGaps = useMemo(() => {
    const base = parseLocalDateKey(selectedDate);
    const workStart = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      preferences.workStartHour,
      0
    ).getTime();
    const workEnd = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      preferences.workEndHour,
      0
    ).getTime();

    const busy = timedEvents
      .map((e) => ({
        start: Math.max(workStart, Date.parse(e.startAt)),
        end: Math.min(workEnd, Date.parse(e.endAt))
      }))
      .filter((b) => b.end > b.start)
      .sort((a, b) => a.start - b.start);

    const gaps: Array<{ startMs: number; endMs: number; minutes: number }> = [];
    let cursor = workStart;
    for (const b of busy) {
      if (b.start - cursor >= 30 * 60_000) {
        gaps.push({
          startMs: cursor,
          endMs: b.start,
          minutes: Math.round((b.start - cursor) / 60_000)
        });
      }
      if (b.end > cursor) cursor = b.end;
    }
    if (workEnd - cursor >= 30 * 60_000) {
      gaps.push({
        startMs: cursor,
        endMs: workEnd,
        minutes: Math.round((workEnd - cursor) / 60_000)
      });
    }
    return gaps;
  }, [timedEvents, selectedDate, preferences.workStartHour, preferences.workEndHour]);

  const todayKey = formatLocalDate(new Date(), 0);
  const isToday = selectedDate === todayKey;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const handleDropOnHour = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    setDragOverHour(null);
    const base = parseLocalDateKey(selectedDate);
    const targetStart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, 0, 0, 0);

    const taskPayloadRaw = e.dataTransfer.getData('application/x-mei-task');
    if (taskPayloadRaw) {
      try {
        const payload = JSON.parse(taskPayloadRaw) as { taskId: string; estimatedMinutes?: number };
        const dur = Math.max(15, payload.estimatedMinutes || 30);
        const targetEnd = new Date(targetStart.getTime() + dur * 60_000);
        scheduleTaskToTimeBlock(payload.taskId, targetStart.toISOString(), targetEnd.toISOString());
        void triggerLightHaptic();
      } catch {
        // Ignore malformed payload
      }
      return;
    }

    const evtPayloadRaw = e.dataTransfer.getData('application/x-mei-event');
    if (evtPayloadRaw) {
      try {
        const payload = JSON.parse(evtPayloadRaw) as { eventId: string; durationMs: number };
        const targetEnd = new Date(targetStart.getTime() + Math.max(15 * 60_000, payload.durationMs));
        moveOrResizeEvent(payload.eventId, targetStart.toISOString(), targetEnd.toISOString());
        void triggerLightHaptic();
      } catch {
        // Ignore malformed payload
      }
    }
  };

  const handleAdjustDuration = (evt: ExpandedEventInstance, deltaMinutes: number) => {
    const startMs = Date.parse(evt.startAt);
    const endMs = Date.parse(evt.endAt);
    const nextEnd = Math.max(startMs + 15 * 60_000, endMs + deltaMinutes * 60_000);
    moveOrResizeEvent(evt.masterEventId, evt.startAt, new Date(nextEnd).toISOString());
    void triggerLightHaptic();
  };

  const handleCreateInSlot = (startMs: number, endMs?: number) => {
    const defaultEnd = endMs ?? startMs + preferences.defaultEventMinutes * 60_000;
    const created = createEvent({
      title: '新專注時間塊',
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(defaultEnd).toISOString(),
      colorToken: 'sky',
      categoryTag: '工作',
      isFlexible: true
    });
    selectEvent(created.id, selectedDate);
  };

  const totalReleasedMinutes = timedEvents.reduce((sum, e) => sum + (e.releasedMinutes || 0), 0);

  return (
    <div data-testid="timeline-view" className="space-y-4">
      {/* Clean Top Status Strip */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[var(--text-muted)] inline-flex items-center gap-1.5">
            <LucideIcon name="clock" size={14} className="theme-accent-text" />
            <span>今日 {dayInstances.length} 筆排程</span>
          </span>

          {conflicts.length > 0 && (
            <button
              type="button"
              data-testid="timeline-conflict-alert"
              onClick={() => openModal('smart')}
              className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-400/30 inline-flex items-center gap-1"
            >
              <LucideIcon name="triangle-alert" size={13} />
              <span>{conflicts.length} 處衝突，點此預覽重排</span>
            </button>
          )}

          {totalReleasedMinutes > 0 && (
            <span
              data-testid="timeline-released-badge"
              className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 inline-flex items-center gap-1"
            >
              <LucideIcon name="sparkles" size={13} />
              <span>已釋放 {totalReleasedMinutes}m 空檔</span>
            </span>
          )}
        </div>

        <button
          type="button"
          data-testid="timeline-smart-autofill-btn"
          onClick={() => openModal('smart')}
          className="btn-sky-secondary px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
        >
          <LucideIcon name="wand-sparkles" size={14} />
          <span>自動填入待辦空檔</span>
        </button>
      </div>

      {/* All-Day Banner Strip (Flat, sleek inline row) */}
      {allDayEvents.length > 0 && (
        <div
          className="bento-glass-card px-3.5 py-2.5 flex items-center gap-2.5 flex-wrap"
          data-testid="timeline-allday-strip"
        >
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0">
            全天
          </span>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((evt) => {
              const palette = COLOR_TOKEN_PALETTE[evt.colorToken] || COLOR_TOKEN_PALETTE.sky;
              return (
                <button
                  key={evt.instanceId}
                  type="button"
                  onClick={() => selectEvent(evt.masterEventId, evt.occurrenceDate)}
                  className={`px-2.5 py-1 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition-transform hover:-translate-y-0.5 ${palette.surfaceClass} ${palette.borderClass}`}
                >
                  <span className={`w-2 h-2 rounded-full ${palette.dotClass}`} />
                  <span>{evt.title}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${palette.badgeClass}`}>
                    {evt.categoryTag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Structured Visual Timeline Cards + Interactive Hourly Drop Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left/Main: Structured Visual Card Timeline */}
        <section className="xl:col-span-7 bento-glass-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <LucideIcon name="milestone" size={15} className="theme-accent-text shrink-0" />
              <span>今日行程時間軸</span>
            </h2>
            <span className="text-[11px] text-[var(--text-muted)] leading-snug">
              點擊標題檢視詳情或啟動專注
            </span>
          </div>

          {timedEvents.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <LucideIcon name="calendar-days" size={32} className="mx-auto theme-accent-text opacity-75" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--text-main)]">這一天目前完全空閒</p>
                <p className="text-xs text-[var(--text-muted)]">
                  在上方直接輸入行程，或打開右上角「待辦」拖入右側時段格
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const base = parseLocalDateKey(selectedDate);
                  const start = new Date(
                    base.getFullYear(),
                    base.getMonth(),
                    base.getDate(),
                    preferences.workStartHour,
                    0
                  ).getTime();
                  handleCreateInSlot(start);
                }}
                className="btn-sky-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
              >
                <LucideIcon name="plus" size={14} />
                <span>建立第一個時間塊</span>
              </button>
            </div>
          ) : (
            <SwipeRevealGroup>
              <div className="space-y-2.5">
                {timedEvents.map((evt) => {
                  const palette = COLOR_TOKEN_PALETTE[evt.colorToken] || COLOR_TOKEN_PALETTE.sky;
                  const durationMin = Math.max(
                    15,
                    Math.round((Date.parse(evt.endAt) - Date.parse(evt.startAt)) / 60_000)
                  );
                  const hasConflict = conflictEventIds.has(evt.instanceId);
                  const commentCount = commentCountByEvent.get(evt.masterEventId) || 0;
                  const doneSubtasks = evt.subtasks.filter((s) => s.done).length;
                  const isCompleted = evt.status === 'completed';
                  const deletable = canDeleteEvent(evt);

                  return (
                    <SwipeableEventCard
                      key={evt.instanceId}
                      swipeId={evt.instanceId}
                      testIdKey={`timeline-${evt.masterEventId}-${evt.occurrenceDate}`}
                      disabled={!deletable}
                      radiusClass="rounded-[var(--block-radius)]"
                      onDeleteRequest={() => requestDeleteEvent(evt)}
                    >
                      <article
                        data-testid={`timeline-event-${evt.masterEventId}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/x-mei-event',
                            JSON.stringify({
                              eventId: evt.masterEventId,
                              durationMs: Date.parse(evt.endAt) - Date.parse(evt.startAt)
                            })
                          );
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className={`group schedule-time-block relative border p-3.5 ${palette.surfaceClass} ${palette.borderClass} ${
                          isCompleted ? 'opacity-70' : ''
                        } ${hasConflict ? 'ring-2 ring-rose-500/70' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-1 self-stretch rounded-full shrink-0 ${palette.accentBarClass}`} />

                          <div className="min-w-0 flex-1 space-y-2">
                            {/* Tier 1: Time + Title + Completion Check */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono font-bold opacity-80">
                                  <span>
                                    {formatTimeHM(evt.startAt)} – {formatTimeHM(evt.endAt)}
                                  </span>
                                  <span className="inline-flex items-baseline">
                                    (<OdometerNumber value={durationMin} />m)
                                  </span>
                                  {evt.recurrenceRule && (
                                    <span className="inline-flex items-center gap-0.5 font-sans">
                                      <LucideIcon name="repeat" size={11} />
                                      重複
                                    </span>
                                  )}
                                  {evt.isFlexible && (
                                    <span className="px-1.5 py-0.2 rounded theme-accent-soft font-sans">
                                      彈性
                                    </span>
                                  )}
                                  {hasConflict && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white font-sans inline-flex items-center gap-0.5">
                                      <LucideIcon name="triangle-alert" size={10} />
                                      衝突
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => selectEvent(evt.masterEventId, evt.occurrenceDate)}
                                  className="mt-0.5 text-left text-sm sm:text-[15px] font-extrabold leading-snug hover:underline block w-full"
                                >
                                  <span className={`um-strike-sweep ${isCompleted ? 'is-done' : ''}`}>
                                    {evt.title}
                                  </span>
                                </button>
                              </div>

                              <button
                                type="button"
                                data-testid={`timeline-complete-btn-${evt.masterEventId}`}
                                onClick={() => {
                                  if (!isCompleted) {
                                    setBurstByEvent((prev) => ({
                                      ...prev,
                                      [evt.instanceId]: (prev[evt.instanceId] || 0) + 1
                                    }));
                                  }
                                  toggleEventComplete(evt.masterEventId);
                                }}
                                aria-label={isCompleted ? '標記為未完成' : '標記為已完成'}
                                className="relative p-1.5 rounded-xl bg-white/55 dark:bg-slate-900/45 hover:scale-105 transition-transform shrink-0"
                              >
                                <StrokeCheckIndicator checked={isCompleted} size={18} />
                                <LikeBurstLayer triggerKey={burstByEvent[evt.instanceId] || 0} />
                              </button>
                            </div>

                            {/* Tier 2: Calm Metadata Row */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className={`px-2 py-0.5 rounded-full font-bold ${palette.badgeClass}`}>
                                {evt.categoryTag}
                              </span>
                              {evt.location && (
                                <span className="inline-flex items-center gap-1 opacity-75">
                                  <LucideIcon name="map-pin" size={11} />
                                  {evt.location}
                                </span>
                              )}
                              {(evt.bufferBeforeMin > 0 || evt.bufferAfterMin > 0) && (
                                <span className="inline-flex items-center gap-1 opacity-70">
                                  <LucideIcon name="shield-check" size={11} />
                                  緩衝 {evt.bufferBeforeMin}/{evt.bufferAfterMin}m
                                </span>
                              )}
                              {commentCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => selectEvent(evt.masterEventId, evt.occurrenceDate)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full theme-accent-soft font-bold"
                                >
                                  <LucideIcon name="message-square" size={11} />
                                  <span>{commentCount} 則留言</span>
                                </button>
                              )}
                              {evt.releasedMinutes && evt.releasedMinutes > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 font-bold">
                                  已釋放 {evt.releasedMinutes}m
                                </span>
                              )}
                            </div>

                            {/* Inline Subtasks Checklist */}
                            {evt.subtasks.length > 0 && (
                              <div className="pt-1.5 border-t border-current/10 space-y-1">
                                <div className="text-[10px] font-bold opacity-70">
                                  子任務 ({doneSubtasks}/{evt.subtasks.length})
                                </div>
                                {evt.subtasks.map((sub) => (
                                  <label
                                    key={sub.id}
                                    className="flex items-center gap-2 text-xs cursor-pointer select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={sub.done}
                                      onChange={() => toggleEventSubtask(evt.masterEventId, sub.id)}
                                      className="rounded border-slate-400 theme-checkbox"
                                    />
                                    <span className={`um-strike-sweep ${sub.done ? 'is-done' : ''}`}>
                                      {sub.title}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* Tier 3: Tidy Action Footer (Segmented -15m/+15m + Clear Primary/Secondary Actions) */}
                            <div className="pt-2 border-t border-current/10 flex items-center justify-between gap-2 flex-wrap">
                              <div className="inline-flex items-center rounded-lg overflow-hidden border border-current/15 bg-white/55 dark:bg-slate-900/45 divide-x divide-current/15">
                                <button
                                  type="button"
                                  data-testid={`resize-minus-15-${evt.masterEventId}`}
                                  onClick={() => handleAdjustDuration(evt, -15)}
                                  title="縮短 15 分鐘"
                                  className="px-2 py-1 text-[11px] font-mono font-bold hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                >
                                  -15m
                                </button>
                                <button
                                  type="button"
                                  data-testid={`resize-plus-15-${evt.masterEventId}`}
                                  onClick={() => handleAdjustDuration(evt, 15)}
                                  title="延長 15 分鐘"
                                  className="px-2 py-1 text-[11px] font-mono font-bold hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                >
                                  +15m
                                </button>
                              </div>

                              <div className="inline-flex items-center gap-1.5">
                                {!isCompleted && (
                                  <button
                                    type="button"
                                    data-testid={`early-complete-btn-${evt.masterEventId}`}
                                    onClick={() => completeEventEarly(evt.masterEventId)}
                                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white/60 dark:bg-slate-900/45 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 inline-flex items-center gap-1 transition-colors"
                                  >
                                    <LucideIcon name="zap" size={11} />
                                    <span>提早完成</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  data-testid={`start-focus-btn-${evt.masterEventId}`}
                                  onClick={() => openModal('focus', { focusTargetEventId: evt.masterEventId })}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold theme-accent-solid inline-flex items-center gap-1 transition-colors"
                                >
                                  <LucideIcon name="play" size={11} />
                                  <span>專注</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectEvent(evt.masterEventId, evt.occurrenceDate)}
                                  className="px-2 py-1 rounded-lg text-[11px] font-semibold opacity-80 hover:opacity-100 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
                                >
                                  詳情
                                </button>
                                {deletable && (
                                  <button
                                    type="button"
                                    data-testid={`desktop-delete-timeline-${evt.masterEventId}-${evt.occurrenceDate}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      requestDeleteEvent(evt);
                                    }}
                                    title="移除行程"
                                    aria-label={`移除「${evt.title}」`}
                                    className="desktop-hover-delete-btn p-1.5 rounded-lg bg-white/60 dark:bg-slate-900/45 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                                  >
                                    <LucideIcon name="trash-2" size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    </SwipeableEventCard>
                  );
                })}

              {/* Available Free Gap Suggestions */}
              {freeGaps.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <div className="text-[11px] font-bold text-[var(--text-muted)]">
                    今日空檔（點擊快速建立時間塊）
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {freeGaps.map((gap) => (
                      <button
                        key={gap.startMs}
                        type="button"
                        onClick={() =>
                          handleCreateInSlot(
                            gap.startMs,
                            Math.min(gap.endMs, gap.startMs + 45 * 60_000)
                          )
                        }
                        className="px-2.5 py-1 rounded-xl border border-dashed theme-accent-soft text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <LucideIcon name="plus" size={12} />
                        <span className="font-mono">
                          {formatTimeHM(new Date(gap.startMs).toISOString())}–
                          {formatTimeHM(new Date(gap.endMs).toISOString())}
                        </span>
                        <span className="opacity-75">({gap.minutes}m)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </SwipeRevealGroup>
          )}
        </section>

        {/* Right: Hourly Interactive Drop Grid (06:00–23:00) */}
        <section className="xl:col-span-5 bento-glass-card p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <LucideIcon name="layout-dashboard" size={15} className="theme-accent-text shrink-0" />
              <span>時段格</span>
            </h2>
            {!inboxDrawerOpen ? (
              <button
                type="button"
                onClick={() => setInboxDrawerOpen(true)}
                className="text-[11px] font-bold theme-accent-deep hover:underline inline-flex items-center gap-1"
              >
                <LucideIcon name="inbox" size={12} />
                <span>展開待辦拖入</span>
              </button>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)]">可拖入右側待辦改期</span>
            )}
          </div>

          <div className="relative divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden bg-[var(--surface-subtle)]/50">
            {HOURS.map((hour) => {
              const slotEvents = timedEvents.filter((e) => {
                const startH = new Date(e.startAt).getHours();
                return startH === hour;
              });
              const isDragTarget = dragOverHour === hour;
              const isNowHour = isToday && Math.floor(nowMinutes / 60) === hour;

              return (
                <div
                  key={hour}
                  data-testid={`timeline-hour-slot-${hour}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverHour(hour);
                  }}
                  onDragLeave={() => setDragOverHour((prev) => (prev === hour ? null : prev))}
                  onDrop={(e) => handleDropOnHour(e, hour)}
                  className={`timeline-hour-slot relative min-h-[46px] px-2.5 py-1.5 flex items-start gap-2.5 transition-colors ${
                    isDragTarget ? 'bg-[var(--accent-soft-bg)] ring-2 ring-inset ring-[var(--accent-primary)]' : ''
                  }`}
                >
                  {isNowHour && (
                    <div
                      data-testid="current-time-indicator"
                      className="pointer-events-none absolute left-0 right-0 h-0.5 bg-rose-500 z-10 flex items-center"
                      style={{ top: `${Math.round(((nowMinutes % 60) / 60) * 100)}%` }}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 -ml-1" />
                    </div>
                  )}

                  <span className="w-11 text-[11px] font-mono font-semibold text-[var(--text-muted)] shrink-0 pt-0.5">
                    {String(hour).padStart(2, '0')}:00
                  </span>

                  <div className="flex-1 min-w-0 space-y-1">
                    {slotEvents.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const base = parseLocalDateKey(selectedDate);
                          const start = new Date(
                            base.getFullYear(),
                            base.getMonth(),
                            base.getDate(),
                            hour,
                            0
                          ).getTime();
                          handleCreateInSlot(start);
                        }}
                        className="w-full text-left text-[11px] text-transparent hover:text-[var(--accent-deep)] py-1 rounded-lg transition-colors"
                      >
                        + 於 {String(hour).padStart(2, '0')}:00 新增時間塊
                      </button>
                    ) : (
                      slotEvents.map((evt) => {
                        const palette = COLOR_TOKEN_PALETTE[evt.colorToken] || COLOR_TOKEN_PALETTE.sky;
                        const dur = Math.max(
                          15,
                          Math.round((Date.parse(evt.endAt) - Date.parse(evt.startAt)) / 60_000)
                        );
                        return (
                          <button
                            key={evt.instanceId}
                            type="button"
                            onClick={() => selectEvent(evt.masterEventId, evt.occurrenceDate)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-start justify-between gap-2 ${palette.surfaceClass} ${palette.borderClass}`}
                          >
                            <span className="schedule-title-wrap min-w-0 flex-1">{evt.title}</span>
                            <span className="text-[10px] font-mono opacity-75 shrink-0 pt-0.5">
                              {formatTimeHM(evt.startAt)} ({dur}m)
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <RecurringDeleteModal
        event={pendingRecurringEvent}
        onCancel={cancelRecurringDelete}
        onConfirmScope={confirmRecurringDelete}
      />
    </div>
  );
}

export default React.memo(TimelineView);
