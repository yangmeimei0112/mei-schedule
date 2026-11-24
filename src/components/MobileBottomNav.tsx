import React from 'react';
import { LucideIcon } from './BrandMark';
import { useScheduleStore } from '../store/useScheduleStore';

export interface MobileBottomNavProps {
  onFocusQuickCapture: () => void;
}

export default function MobileBottomNav({ onFocusQuickCapture }: MobileBottomNavProps) {
  const { viewMode, sidebarOpen, setViewMode, setSidebarOpen, openModal } = useScheduleStore();

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
              setViewMode('day');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              viewMode === 'day' && !sidebarOpen ? 'text-sky-600 dark:text-sky-400' : 'text-[var(--text-muted)]'
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
              setViewMode(viewMode === 'month' ? 'week' : 'month');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              (viewMode === 'month' || viewMode === 'week') && !sidebarOpen
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
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              sidebarOpen ? 'text-sky-600 dark:text-sky-400' : 'text-[var(--text-muted)]'
            }`}
          >
            <LucideIcon name="inbox" size={18} />
            <span>收件匣</span>
          </button>

          <button
            type="button"
            data-testid="bottom-nav-focus"
            onClick={() => openModal('focus')}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-[var(--text-muted)] hover:text-sky-500"
          >
            <LucideIcon name="timer" size={18} />
            <span>專注</span>
          </button>

          <button
            type="button"
            data-testid="bottom-nav-tools"
            onClick={() => openModal('analytics')}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-[var(--text-muted)] hover:text-sky-500"
          >
            <LucideIcon name="bar-chart-3" size={18} />
            <span>統計</span>
          </button>
        </div>
      </nav>
    </>
  );
}
