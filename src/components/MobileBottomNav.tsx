import React, { useMemo } from 'react';
import { LucideIcon } from './BrandMark';
import { useScheduleStore } from '../store/useScheduleStore';

export interface MobileBottomNavProps {
  onFocusQuickCapture: () => void;
}

export default function MobileBottomNav({ onFocusQuickCapture }: MobileBottomNavProps) {
  const {
    tasks,
    viewMode,
    sidebarOpen,
    inboxDrawerOpen,
    setViewMode,
    setSidebarOpen,
    setInboxDrawerOpen,
    openModal
  } = useScheduleStore();

  const unscheduledCount = useMemo(
    () => tasks.filter((t) => !t.completed && !t.scheduledEventId).length,
    [tasks]
  );

  return (
    <>
      {/* Floating Quick-Add Action Button (Mobile Only) */}
      <button
        type="button"
        data-testid="mobile-quick-add-fab"
        onClick={onFocusQuickCapture}
        aria-label="快速新增排程"
        className="sm:hidden fixed right-4 bottom-20 z-30 w-12 h-12 rounded-2xl btn-sky-primary flex items-center justify-center shadow-lg"
      >
        <LucideIcon name="plus" size={22} />
      </button>

      {/* One-Handed Bottom Navigation Bar (Mobile) */}
      <nav
        data-testid="mobile-bottom-nav"
        aria-label="行動端底部導覽列"
        className="mobile-bottom-nav sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--surface-glass-strong)] backdrop-blur-[10px] pb-safe-bottom"
      >
        <div className="grid grid-cols-5 h-14 max-w-md mx-auto px-1">
          <button
            type="button"
            data-testid="bottom-nav-timeline"
            onClick={() => {
              setSidebarOpen(false);
              setInboxDrawerOpen(false);
              setViewMode('day');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              viewMode === 'day' && !sidebarOpen && !inboxDrawerOpen
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <LucideIcon name="clock" size={18} />
            <span>時間軸</span>
          </button>

          <button
            type="button"
            data-testid="bottom-nav-month"
            onClick={() => {
              setSidebarOpen(false);
              setInboxDrawerOpen(false);
              setViewMode(viewMode === 'month' ? 'week' : 'month');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              (viewMode === 'month' || viewMode === 'week') && !sidebarOpen && !inboxDrawerOpen
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <LucideIcon name="calendar-days" size={18} />
            <span>{viewMode === 'month' ? '週視圖' : '月總覽'}</span>
          </button>

          <button
            type="button"
            data-testid="bottom-nav-inbox"
            onClick={() => {
              setSidebarOpen(false);
              setInboxDrawerOpen(!inboxDrawerOpen);
            }}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              inboxDrawerOpen ? 'text-sky-600 dark:text-sky-400' : 'text-[var(--text-muted)]'
            }`}
          >
            <span className="relative inline-flex">
              <LucideIcon name="inbox" size={18} />
              {unscheduledCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-3.5 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unscheduledCount}
                </span>
              )}
            </span>
            <span>收件匣</span>
          </button>

          <button
            type="button"
            data-testid="bottom-nav-focus"
            onClick={() => {
              setSidebarOpen(false);
              setInboxDrawerOpen(false);
              openModal('focus');
            }}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-[var(--text-muted)] hover:text-sky-500"
          >
            <LucideIcon name="timer" size={18} />
            <span>專注</span>
          </button>

          <button
            type="button"
            data-testid="bottom-nav-tools"
            onClick={() => {
              setInboxDrawerOpen(false);
              setSidebarOpen(!sidebarOpen);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              sidebarOpen ? 'text-sky-600 dark:text-sky-400' : 'text-[var(--text-muted)]'
            }`}
          >
            <LucideIcon name="layout-grid" size={18} />
            <span>選單</span>
          </button>
        </div>
      </nav>
    </>
  );
}
