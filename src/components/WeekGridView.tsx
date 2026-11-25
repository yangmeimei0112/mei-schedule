import React, { useMemo, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { COLOR_TOKEN_PALETTE, formatLocalDate } from '../data/seedData';
import { parseLocalDateKey, toLocalDateKey } from '../services/recurrenceEngine';
import { detectScheduleConflicts } from '../services/smartScheduler';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ExpandedEventInstance } from '../types/schedule';

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 22;
const HOUR_HEIGHT_PX = 64;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface PositionedEvent {
  event: ExpandedEventInstance;
  topPx: number;
  heightPx: number;
  maxExpandHeightPx: number;
  lane: number;
  totalLanes: number;
}

function layoutDayOverlapLanes(events: ExpandedEventInstance[]): PositionedEvent[] {
  const sorted = events
    .slice()
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

  const laneEnds: number[] = [];
  const temp: Array<{
    event: ExpandedEventInstance;
    startMin: number;
    endMin: number;
    lane: number;
  }> = [];

  for (const evt of sorted) {
    const s = new Date(evt.startAt);
    const e = new Date(evt.endAt);
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = Math.max(startMin + 20, e.getHours() * 60 + e.getMinutes());

    let assignedLane = laneEnds.findIndex((end) => end <= startMin);
    if (assignedLane === -1) {
      assignedLane = laneEnds.length;
      laneEnds.push(endMin);
    } else {
      laneEnds[assignedLane] = endMin;
    }

    temp.push({ event: evt, startMin, endMin, lane: assignedLane });
  }

  return temp.map((item) => {
    const overlappingLanes = temp.filter(
      (other) => other.startMin < item.endMin && other.endMin > item.startMin
    );
    const maxLane = Math.max(...overlappingLanes.map((o) => o.lane), 0) + 1;
    const clampedStart = Math.max(GRID_START_HOUR * 60, item.startMin);
    const clampedEnd = Math.min((GRID_END_HOUR + 1) * 60, Math.max(clampedStart + 25, item.endMin));
    const topPx = ((clampedStart - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX;
    const heightPx = Math.max(32, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT_PX);

    // Compute how far a short event card can safely grow downward to show wrapped title lines without colliding with the next event
    const nextEventStartMin = temp
      .filter((other) => other !== item && other.startMin >= item.endMin)
      .reduce((minStart, other) => Math.min(minStart, other.startMin), (GRID_END_HOUR + 1) * 60);
    const gapAwareHeightPx = ((nextEventStartMin - clampedStart) / 60) * HOUR_HEIGHT_PX - 2;
    const maxExpandHeightPx = Math.max(heightPx, Math.min(gapAwareHeightPx, Math.max(heightPx, 86)));

    return {
      event: item.event,
      topPx,
      heightPx,
      maxExpandHeightPx,
      lane: item.lane,
      totalLanes: maxLane
    };
  });
}

export interface WeekGridViewProps {
  mode: '3day' | 'week';
  instances: ExpandedEventInstance[];
}

function WeekGridView({ mode, instances }: WeekGridViewProps) {
  const {
    selectedDate,
    preferences,
    selectEvent,
    setSelectedDate,
    moveOrResizeEvent,
    scheduleTaskToTimeBlock,
    createEvent
  } = useScheduleStore();

  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const dayColumns = useMemo(() => {
    const base = parseLocalDateKey(selectedDate);
    const count = mode === '3day' ? 3 : 7;
    let startDate = base;
    if (mode === 'week') {
      const dow = base.getDay();
      const offset = preferences.weekStartsOn === 1 ? (dow + 6) % 7 : dow;
      startDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);
    }
    return Array.from({ length: count }, (_, idx) => {
      const d = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + idx
      );
      return {
        dateKey: toLocalDateKey(d),
        monthDay: `${d.getMonth() + 1}/${d.getDate()}`,
        weekday: `週${WEEKDAYS[d.getDay()]}`
      };
    });
  }, [selectedDate, mode, preferences.weekStartsOn]);

  const todayKey = formatLocalDate(new Date(), 0);
  const hours = useMemo(
    () => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => i + GRID_START_HOUR),
    []
  );

  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of detectScheduleConflicts(instances)) {
      set.add(c.eventIdA);
      set.add(c.eventIdB);
    }
    return set;
  }, [instances]);

  const handleDropOnCell = (e: React.DragEvent, dateKey: string, hour: number) => {
    e.preventDefault();
    setDropTargetKey(null);
    const base = parseLocalDateKey(dateKey);
    const targetStart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, 0, 0, 0);

    const taskRaw = e.dataTransfer.getData('application/x-mei-task');
    if (taskRaw) {
      try {
        const payload = JSON.parse(taskRaw) as { taskId: string; estimatedMinutes?: number };
        const dur = Math.max(15, payload.estimatedMinutes || 30);
        scheduleTaskToTimeBlock(
          payload.taskId,
          targetStart.toISOString(),
          new Date(targetStart.getTime() + dur * 60_000).toISOString()
        );
      } catch {
        // Ignore
      }
      return;
    }

    const evtRaw = e.dataTransfer.getData('application/x-mei-event');
    if (evtRaw) {
      try {
        const payload = JSON.parse(evtRaw) as { eventId: string; durationMs: number };
        moveOrResizeEvent(
          payload.eventId,
          targetStart.toISOString(),
          new Date(targetStart.getTime() + Math.max(15 * 60_000, payload.durationMs)).toISOString()
        );
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div
      data-testid={mode === '3day' ? 'three-day-view' : 'week-grid-view'}
      className="bento-glass-card overflow-hidden flex flex-col"
    >
      <div className="overflow-x-auto">
        <div className={mode === 'week' ? 'min-w-[740px]' : 'min-w-[300px]'}>
          {/* Column Headers */}
          <div
            className="grid border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)]/75"
            style={{
              gridTemplateColumns: `56px repeat(${dayColumns.length}, minmax(0, 1fr))`
            }}
          >
            <div className="p-2 text-[10px] font-bold text-[var(--text-muted)] flex items-center justify-center whitespace-nowrap">
              時段
            </div>
            {dayColumns.map((col) => {
              const isToday = col.dateKey === todayKey;
              const isSelected = col.dateKey === selectedDate;
              const dayAllDay = instances.filter((i) => i.occurrenceDate === col.dateKey && i.allDay);
              return (
                <div
                  key={col.dateKey}
                  className={`p-1.5 sm:p-2 border-l border-[var(--border-subtle)] space-y-1 ${
                    isToday ? 'bg-sky-500/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDate(col.dateKey)}
                    className="w-full flex items-center justify-between gap-1 text-left flex-nowrap"
                  >
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] whitespace-nowrap shrink-0">
                      {col.weekday}
                    </span>
                    <span
                      className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-extrabold font-mono whitespace-nowrap shrink-0 ${
                        isToday
                          ? 'bg-sky-500 text-white'
                          : isSelected
                            ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                            : 'text-[var(--text-main)]'
                      }`}
                    >
                      {col.monthDay}
                    </span>
                  </button>
                  {dayAllDay.map((ad) => {
                    const palette = COLOR_TOKEN_PALETTE[ad.colorToken] || COLOR_TOKEN_PALETTE.sky;
                    return (
                      <button
                        key={ad.instanceId}
                        type="button"
                        onClick={() => selectEvent(ad.masterEventId, ad.occurrenceDate)}
                        className={`w-full text-left px-1.5 py-0.5 rounded-md text-[10px] font-bold schedule-title-wrap border ${palette.surfaceClass} ${palette.borderClass}`}
                      >
                        {ad.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Time Grid Body */}
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: `56px repeat(${dayColumns.length}, minmax(0, 1fr))`
            }}
          >
            {/* Hour Axis */}
            <div className="divide-y divide-[var(--border-subtle)]">
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: `${HOUR_HEIGHT_PX}px` }}
                  className="px-1.5 pt-1 text-right text-[10px] font-mono text-[var(--text-muted)]"
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {dayColumns.map((col) => {
              const colTimed = instances.filter((i) => i.occurrenceDate === col.dateKey && !i.allDay);
              const positioned = layoutDayOverlapLanes(colTimed);
              const autoWrapEnabled = preferences.autoWrapTitles !== false;

              return (
                <div
                  key={col.dateKey}
                  className="relative border-l border-[var(--border-subtle)]"
                  style={{ height: `${hours.length * HOUR_HEIGHT_PX}px` }}
                >
                  {/* Background Hour Drop Slots */}
                  {hours.map((h) => {
                    const cellKey = `${col.dateKey}:${h}`;
                    const isOver = dropTargetKey === cellKey;
                    return (
                      <div
                        key={cellKey}
                        style={{ height: `${HOUR_HEIGHT_PX}px` }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDropTargetKey(cellKey);
                        }}
                        onDragLeave={() => setDropTargetKey((prev) => (prev === cellKey ? null : prev))}
                        onDrop={(e) => handleDropOnCell(e, col.dateKey, h)}
                        onDoubleClick={() => {
                          const base = parseLocalDateKey(col.dateKey);
                          const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 0);
                          const created = createEvent({
                            title: '新排程時間塊',
                            startAt: start.toISOString(),
                            endAt: new Date(start.getTime() + preferences.defaultEventMinutes * 60_000).toISOString(),
                            isFlexible: true
                          });
                          selectEvent(created.id, col.dateKey);
                        }}
                        className={`border-b border-[var(--border-subtle)]/70 transition-colors ${
                          isOver ? 'bg-sky-500/20' : 'hover:bg-sky-500/5'
                        }`}
                      />
                    );
                  })}

                  {/* Positioned Event Blocks */}
                  {positioned.map(({ event, topPx, heightPx, maxExpandHeightPx, lane, totalLanes }) => {
                    const palette = COLOR_TOKEN_PALETTE[event.colorToken] || COLOR_TOKEN_PALETTE.sky;
                    const widthPct = 100 / totalLanes;
                    const leftPct = lane * widthPct;
                    const hasConflict = conflictIds.has(event.instanceId);

                    return (
                      <button
                        key={event.instanceId}
                        type="button"
                        data-testid={`week-event-block-${event.masterEventId}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/x-mei-event',
                            JSON.stringify({
                              eventId: event.masterEventId,
                              durationMs: Date.parse(event.endAt) - Date.parse(event.startAt)
                            })
                          );
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => selectEvent(event.masterEventId, event.occurrenceDate)}
                        style={
                          autoWrapEnabled
                            ? {
                                top: `${topPx + 1}px`,
                                minHeight: `${heightPx - 2}px`,
                                maxHeight: `${maxExpandHeightPx}px`,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`
                              }
                            : {
                                top: `${topPx + 1}px`,
                                height: `${heightPx - 2}px`,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`
                              }
                        }
                        className={`absolute z-10 rounded-xl border px-1.5 py-1 text-left overflow-hidden shadow-sm transition-transform hover:z-30 hover:max-h-none hover:scale-[1.01] flex flex-col justify-start gap-0.5 ${palette.surfaceClass} ${palette.borderClass} ${
                          hasConflict ? 'ring-1 ring-rose-500' : ''
                        } ${event.status === 'completed' ? 'opacity-65' : ''}`}
                      >
                        <div className="flex items-start gap-1 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 mt-[4px] rounded-full shrink-0 ${palette.dotClass}`}
                          />
                          <span
                            data-testid="week-event-title"
                            className={`text-[11px] font-extrabold schedule-title-wrap min-w-0 flex-1 ${
                              event.status === 'completed' ? 'line-through' : ''
                            }`}
                          >
                            {event.title}
                          </span>
                        </div>
                        {(maxExpandHeightPx >= 42 || heightPx >= 40) && (
                          <div className="pl-2.5 text-[10px] font-mono opacity-80 flex items-center gap-1 flex-wrap">
                            <span>{formatHM(event.startAt)}</span>
                            {event.recurrenceRule && <LucideIcon name="repeat" size={9} />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(WeekGridView);
