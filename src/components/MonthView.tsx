import React, { useMemo } from 'react';
import { LucideIcon } from './BrandMark';
import { COLOR_TOKEN_PALETTE, formatLocalDate } from '../data/seedData';
import { parseLocalDateKey, toLocalDateKey } from '../services/recurrenceEngine';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ExpandedEventInstance } from '../types/schedule';

function formatHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface MonthViewProps {
  instances: ExpandedEventInstance[];
}

/**
 * Rich Responsive Month Overview:
 * Explicitly avoids mobile "gray-dot-only" anti-pattern by rendering
 * semantic color event bars WITH readable titles on all screen sizes,
 * paired with a detailed selected-day agenda panel directly underneath.
 */
export default function MonthView({ instances }: MonthViewProps) {
  const {
    selectedDate,
    preferences,
    setSelectedDate,
    selectEvent,
    setViewMode,
    createEvent
  } = useScheduleStore();

  const todayKey = formatLocalDate(new Date(), 0);
  const selectedObj = useMemo(() => parseLocalDateKey(selectedDate), [selectedDate]);

  const monthCells = useMemo(() => {
    const y = selectedObj.getFullYear();
    const m = selectedObj.getMonth();
    const first = new Date(y, m, 1);
    const startOffset =
      preferences.weekStartsOn === 1 ? (first.getDay() + 6) % 7 : first.getDay();
    const gridStart = new Date(y, m, 1 - startOffset);

    return Array.from({ length: 42 }, (_, idx) => {
      const cur = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + idx);
      return {
        dateKey: toLocalDateKey(cur),
        dayNumber: cur.getDate(),
        inCurrentMonth: cur.getMonth() === m
      };
    });
  }, [selectedObj, preferences.weekStartsOn]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ExpandedEventInstance[]>();
    for (const inst of instances) {
      const list = map.get(inst.occurrenceDate) || [];
      list.push(inst);
      map.set(inst.occurrenceDate, list);
    }
    return map;
  }, [instances]);

  const selectedDayEvents = eventsByDate.get(selectedDate) || [];
  const weekdayHeaders =
    preferences.weekStartsOn === 1
      ? ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
      : ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

  return (
    <div data-testid="month-view" className="space-y-4">
      <section className="bento-glass-card overflow-hidden">
        {/* Weekday Header Row */}
        <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)]/80">
          {weekdayHeaders.map((label) => (
            <div
              key={label}
              className="py-1.5 sm:py-2 px-0.5 sm:px-1 text-center text-[10px] sm:text-[11px] font-bold text-[var(--text-muted)] whitespace-nowrap"
            >
              {label}
            </div>
          ))}
        </div>

        {/* 6x7 Month Cells with Colored Title Pills (NEVER gray-dots-only!) */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-subtle)]">
          {monthCells.map((cell) => {
            const cellEvents = eventsByDate.get(cell.dateKey) || [];
            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === selectedDate;
            const visiblePills = cellEvents.slice(0, 3);
            const overflowCount = cellEvents.length - visiblePills.length;

            return (
              <div
                key={cell.dateKey}
                data-testid={`month-cell-${cell.dateKey}`}
                onClick={() => setSelectedDate(cell.dateKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDate(cell.dateKey);
                  }
                }}
                className={`min-h-[76px] sm:min-h-[108px] p-0.5 sm:p-1.5 flex flex-col gap-0.5 sm:gap-1 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-sky-500/12 ring-2 ring-inset ring-sky-400/70'
                    : cell.inCurrentMonth
                      ? 'hover:bg-[var(--surface-subtle)]/70'
                      : 'bg-[var(--surface-subtle)]/35 opacity-55'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-[11px] font-extrabold font-mono flex items-center justify-center ${
                      isToday
                        ? 'bg-sky-500 text-white'
                        : isSelected
                          ? 'text-sky-700 dark:text-sky-300'
                          : 'text-[var(--text-main)]'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                  {cellEvents.length > 0 && (
                    <span className="hidden sm:inline text-[10px] font-mono text-[var(--text-muted)]">
                      {cellEvents.length}
                    </span>
                  )}
                </div>

                {/* Colored Title Event Bars — readable even on mobile */}
                <div className="space-y-0.5 flex-1 min-w-0">
                  {visiblePills.map((evt) => {
                    const palette = COLOR_TOKEN_PALETTE[evt.colorToken] || COLOR_TOKEN_PALETTE.sky;
                    return (
                      <button
                        key={evt.instanceId}
                        type="button"
                        data-testid={`month-event-pill-${evt.masterEventId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateKey);
                          selectEvent(evt.masterEventId, evt.occurrenceDate);
                        }}
                        className={`w-full text-left px-0.5 sm:px-1.5 py-0.5 rounded-[5px] sm:rounded-md text-[9px] sm:text-[10px] leading-tight font-bold truncate flex items-center gap-0.5 border-l-2 ${palette.surfaceClass}`}
                        style={{ borderLeftColor: palette.hex }}
                      >
                        <span className="truncate">{evt.title}</span>
                      </button>
                    );
                  })}
                  {overflowCount > 0 && (
                    <div className="text-[9px] sm:text-[10px] font-bold text-sky-600 dark:text-sky-400 px-0.5 sm:px-1 whitespace-nowrap">
                      +{overflowCount} 筆
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Selected Day Detailed Drawer Strip */}
      <section data-testid="month-selected-day-panel" className="bento-glass-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <LucideIcon name="calendar-check" size={16} className="text-sky-500" />
            <h3 className="text-sm font-extrabold text-[var(--text-main)]">
              {selectedDate} 當日行程明細（{selectedDayEvents.length} 筆）
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className="btn-sky-secondary px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1"
            >
              <LucideIcon name="clock" size={13} />
              <span>開啟單日時間軸</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const start = new Date(
                  selectedObj.getFullYear(),
                  selectedObj.getMonth(),
                  selectedObj.getDate(),
                  preferences.workStartHour,
                  0
                );
                const created = createEvent({
                  title: '新排程項目',
                  startAt: start.toISOString(),
                  endAt: new Date(
                    start.getTime() + preferences.defaultEventMinutes * 60_000
                  ).toISOString(),
                  isFlexible: true
                });
                selectEvent(created.id, selectedDate);
              }}
              className="btn-sky-primary px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1"
            >
              <LucideIcon name="plus" size={13} />
              <span>新增該日行程</span>
            </button>
          </div>
        </div>

        {selectedDayEvents.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-3">這一天尚無排程行程。</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {selectedDayEvents.map((evt) => {
              const palette = COLOR_TOKEN_PALETTE[evt.colorToken] || COLOR_TOKEN_PALETTE.sky;
              return (
                <button
                  key={evt.instanceId}
                  type="button"
                  onClick={() => selectEvent(evt.masterEventId, evt.occurrenceDate)}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-transform hover:-translate-y-0.5 ${palette.surfaceClass} ${palette.borderClass}`}
                >
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${palette.accentBarClass}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold truncate">{evt.title}</div>
                    <div className="text-[11px] font-mono opacity-80 mt-0.5">
                      {evt.allDay ? '全天行程' : `${formatHM(evt.startAt)} – ${formatHM(evt.endAt)}`}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${palette.badgeClass}`}>
                    {evt.categoryTag}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
