import React, { useMemo } from 'react';
import { LucideIcon, MeiScheduleLogo } from './BrandMark';
import QuickCaptureBar from './QuickCaptureBar';
import { COLOR_TOKEN_PALETTE, formatLocalDate } from '../data/seedData';
import { expandRecurringEvents } from '../services/recurrenceEngine';
import { useScheduleStore } from '../store/useScheduleStore';

function formatHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Electron System Tray / Menu Bar Compact Today Popover (#/tray)
 * Ultra-fast mini view of today's upcoming schedule + natural language quick capture.
 */
export default function DesktopTrayWidget() {
  const { events, toggleEventComplete } = useScheduleStore();
  const todayKey = formatLocalDate(new Date(), 0);

  const todayEvents = useMemo(
    () => expandRecurringEvents(events, todayKey, todayKey),
    [events, todayKey]
  );

  const handleOpenMainWindow = () => {
    if (window.MeiDesktop?.toggleTrayWindow) {
      void window.MeiDesktop.toggleTrayWindow();
    } else {
      window.location.hash = '';
    }
  };

  return (
    <div
      data-testid="desktop-tray-widget"
      className="min-h-dvh-screen sky-ambient-bg p-3 flex flex-col gap-3 max-w-[400px] mx-auto"
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <MeiScheduleLogo size="xs" />
          <div>
            <h1 className="text-sm font-extrabold text-[var(--text-main)] leading-tight">
              咩時光今日快覽
            </h1>
            <p className="text-[10px] font-mono text-[var(--text-muted)]">{todayKey}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenMainWindow}
          className="btn-sky-secondary px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1"
        >
          <LucideIcon name="maximize-2" size={12} />
          <span>主視窗</span>
        </button>
      </header>

      <QuickCaptureBar compact={true} />

      <div className="flex-1 overflow-y-auto space-y-2">
        {todayEvents.length === 0 ? (
          <div className="bento-glass-card p-6 text-center text-xs text-[var(--text-muted)]">
            今日目前無排程行程
          </div>
        ) : (
          todayEvents.map((evt) => {
            const palette = COLOR_TOKEN_PALETTE[evt.colorToken] || COLOR_TOKEN_PALETTE.sky;
            const isDone = evt.status === 'completed';
            return (
              <div
                key={evt.instanceId}
                className={`p-2.5 rounded-2xl border flex items-center gap-2.5 ${palette.surfaceClass} ${palette.borderClass} ${
                  isDone ? 'opacity-60' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleEventComplete(evt.masterEventId)}
                  aria-label="切換完成狀態"
                  className="shrink-0"
                >
                  <LucideIcon
                    name={isDone ? 'circle-check' : 'circle'}
                    size={16}
                    className={isDone ? 'text-emerald-500' : 'opacity-65'}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-extrabold schedule-title-wrap ${isDone ? 'line-through' : ''}`}>
                    {evt.title}
                  </div>
                  <div className="text-[10px] font-mono opacity-80">
                    {evt.allDay ? '全天' : `${formatHM(evt.startAt)} – ${formatHM(evt.endAt)}`}
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${palette.badgeClass}`}>
                  {evt.categoryTag}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
