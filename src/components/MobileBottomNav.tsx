import React, { useMemo } from 'react';
import { LucideIcon } from './BrandMark';
import { useScheduleStore } from '../store/useScheduleStore';

export interface MobileBottomNavProps {
  onOpenCreateEvent: () => void;
}

function MobileBottomNav({ onOpenCreateEvent }: MobileBottomNavProps) {
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
      {/* Floating Create-Event Action Button (Mobile Only -> opens blank EventDetailDrawer) */}
      <button
        type="button"
        data-testid="mobile-quick-add-fab"
        onClick={onOpenCreateEvent}
        title="新增行程"
        aria-label="新增行程"
        className="mobile-fab-float sm:hidden fixed right-4 z-30 w-12 h-12 rounded-2xl btn-sky-primary flex items-center justify-center shadow-lg"
      >
        <LucideIcon name="plus" size={22} />
      </button>

      {/* Edge-to-Edge Translucent Floating Frosted-Glass Bottom Navigation (Mobile) */}
      <nav
        data-testid="mobile-bottom-nav"
        aria-label="行動端底部導覽列"
        className="mobile-bottom-nav mobile-bottom-nav-float theme-nav-bottom sm:hidden fixed inset-x-2.5 sm:inset-x-3 z-30 max-w-md mx-auto rounded-2xl backdrop-blur-[12px]"
      >
        <div className="mobile-bottom-nav-grid grid grid-cols-5 h-14 px-1 py-1 gap-0.5">
          <button
            type="button"
            data-testid="bottom-nav-timeline"
            onClick={() => {
              setSidebarOpen(false);
              setInboxDrawerOpen(false);
              setViewMode('day');
            }}
            className={`rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${
              viewMode === 'day' && !sidebarOpen && !inboxDrawerOpen
                ? 'theme-accent-soft'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
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
            className={`rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${
              (viewMode === 'month' || viewMode === 'week') && !sidebarOpen && !inboxDrawerOpen
                ? 'theme-accent-soft'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
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
            className={`relative rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${
              inboxDrawerOpen
                ? 'theme-accent-soft'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="relative inline-flex">
              <LucideIcon name="inbox" size={18} />
              {unscheduledCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-3.5 px-1 rounded-full theme-accent-solid text-[9px] font-bold flex items-center justify-center shadow-sm">
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
            className="rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--accent-deep)] transition-colors"
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
            className={`rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${
              sidebarOpen
                ? 'theme-accent-soft'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
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

export default React.memo(MobileBottomNav);
