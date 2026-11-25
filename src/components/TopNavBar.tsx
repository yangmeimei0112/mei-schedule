import React, { useMemo } from 'react';
import { LucideIcon, MeiScheduleLogo } from './BrandMark';
import FocusMiniPill from './FocusMiniPill';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ScheduleViewMode } from '../types/schedule';

const VIEW_TABS: Array<{
  id: ScheduleViewMode;
  label: string;
  shortLabel: string;
  icon: string;
  shortcut: string;
}> = [
  { id: 'day', label: '時間軸', shortLabel: '日', icon: 'clock', shortcut: '1' },
  { id: '3day', label: '三日', shortLabel: '3日', icon: 'columns-3', shortcut: '2' },
  { id: 'week', label: '週視圖', shortLabel: '週', icon: 'calendar-range', shortcut: '3' },
  { id: 'month', label: '月總覽', shortLabel: '月', icon: 'calendar-days', shortcut: '4' },
  { id: 'agenda', label: '清單', shortLabel: '清單', icon: 'list-todo', shortcut: '5' }
];

function formatHeaderDateRange(selectedDate: string, viewMode: ScheduleViewMode): string {
  const [y, m, d] = selectedDate.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  if (viewMode === 'month') {
    return `${base.getFullYear()} 年 ${base.getMonth() + 1} 月`;
  }
  if (viewMode === 'week') {
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 6);
    return `${base.getFullYear()} / ${base.getMonth() + 1}/${base.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
  }
  if (viewMode === '3day') {
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 2);
    return `${base.getMonth() + 1}/${base.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
  }
  return `${base.getFullYear()} 年 ${base.getMonth() + 1} 月 ${base.getDate()} 日 (週${weekdays[base.getDay()]})`;
}

function formatCompactMobileDate(selectedDate: string, viewMode: ScheduleViewMode): string {
  const [y, m, d] = selectedDate.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  if (viewMode === 'month') {
    return `${base.getFullYear()}年${base.getMonth() + 1}月`;
  }
  if (viewMode === 'week') {
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 6);
    return `${base.getMonth() + 1}/${base.getDate()}–${end.getMonth() + 1}/${end.getDate()}`;
  }
  if (viewMode === '3day') {
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 2);
    return `${base.getMonth() + 1}/${base.getDate()}–${end.getMonth() + 1}/${end.getDate()}`;
  }
  return `${base.getMonth() + 1}月${base.getDate()}日 (週${weekdays[base.getDay()]})`;
}

/**
 * Slim Single-Row Header (v1.5.0)
 * - Desktop (>= lg): ONE 56px clean row with Date Nav + Background Focus Pill | 5 View Tabs | Undo/Redo + Right Task Inbox Toggle.
 * - Mobile (< lg): Compact top bar with Drawer Menu, Brand Mark, Date Nav, Focus Pill & Inbox Toggle + clean 5-mode segmented bar.
 * All workspace tools, search, themes, and member account live cleanly inside the unified Left AppSidebar!
 */
function TopNavBar() {
  const {
    tasks,
    viewMode,
    selectedDate,
    sidebarOpen,
    inboxDrawerOpen,
    canUndo,
    canRedo,
    setViewMode,
    goToToday,
    navigateDate,
    setSidebarOpen,
    setInboxDrawerOpen,
    undo,
    redo
  } = useScheduleStore();

  const stepDays =
    viewMode === 'month' ? 30 : viewMode === 'week' ? 7 : viewMode === '3day' ? 3 : 1;

  const unscheduledTaskCount = useMemo(
    () => tasks.filter((t) => !t.completed && !t.scheduledEventId).length,
    [tasks]
  );

  return (
    <header
      data-testid="top-nav-bar"
      className="sticky top-0 z-20 pt-safe border-b border-[var(--border-subtle)] bg-[var(--surface-glass-strong)] backdrop-blur-[14px]"
    >
      {/* Primary Single-Row Header (56px on Desktop) */}
      <div className="mobile-header-bar narrow-compact-px h-14 px-2.5 sm:px-5 flex items-center justify-between gap-2">
        {/* Left: Sidebar Toggle (Mobile Drawer / Desktop Rail) + Date Navigation + Background Focus Pill */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 lg:flex-initial">
          {/* Mobile Menu Trigger (opens slide-over AppSidebar) + Desktop Fallback Toggle */}
          <button
            type="button"
            data-testid="toggle-sidebar-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? '收合左側導覽欄' : '展開左側導覽欄'}
            title={sidebarOpen ? '收合左側導覽欄' : '展開左側導覽欄'}
            className="lg:hidden btn-sky-secondary p-1.5 rounded-xl inline-flex items-center justify-center shrink-0"
          >
            <LucideIcon name="menu" size={16} />
          </button>

          {/* Compact Mobile Brand Mark (hidden below 360px to keep full date legible, and on desktop where AppSidebar shows brand) */}
          <span className="hidden min-[360px]:inline-flex lg:hidden shrink-0">
            <MeiScheduleLogo size="xs" />
          </span>

          {/* Date Controls */}
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
            <button
              type="button"
              data-testid="nav-today-btn"
              onClick={goToToday}
              title="回到今天 (T)"
              className="btn-sky-secondary px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0"
            >
              今天
            </button>
            <button
              type="button"
              data-testid="nav-prev-btn"
              onClick={() => navigateDate(-stepDays)}
              aria-label="上一區間"
              className="p-1 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0 transition-colors"
            >
              <LucideIcon name="chevron-left" size={16} />
            </button>
            <button
              type="button"
              data-testid="nav-next-btn"
              onClick={() => navigateDate(stepDays)}
              aria-label="下一區間"
              className="p-1 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0 transition-colors"
            >
              <LucideIcon name="chevron-right" size={16} />
            </button>

            <h1
              data-testid="current-date-heading"
              className="ml-0.5 sm:ml-1 text-xs sm:text-[15px] font-extrabold text-[var(--text-main)] whitespace-nowrap truncate"
            >
              <span className="sm:hidden">{formatCompactMobileDate(selectedDate, viewMode)}</span>
              <span className="hidden sm:inline">{formatHeaderDateRange(selectedDate, viewMode)}</span>
            </h1>
          </div>

          <FocusMiniPill />
        </div>

        {/* Center: Clean 5-View Segmented Switcher (Desktop >= lg) */}
        <nav
          role="tablist"
          aria-label="排程檢視模式"
          className="hidden lg:inline-flex items-center gap-0.5 p-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] shrink-0"
        >
          {VIEW_TABS.map((tab) => {
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`view-tab-${tab.id}`}
                onClick={() => setViewMode(tab.id)}
                title={`${tab.label} (快捷鍵 ${tab.shortcut})`}
                className={`px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <LucideIcon name={tab.icon} size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Minimal Utility Cluster (Undo/Redo + Right Task Inbox Wing Toggle) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="hidden md:inline-flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              data-testid="header-undo-btn"
              disabled={!canUndo}
              onClick={() => undo()}
              aria-label="復原上一步"
              title="復原上一步 (Cmd/Ctrl + Z)"
              className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-subtle)] inline-flex items-center justify-center disabled:opacity-30 transition-colors"
            >
              <LucideIcon name="undo-2" size={15} />
            </button>
            <button
              type="button"
              data-testid="header-redo-btn"
              disabled={!canRedo}
              onClick={() => redo()}
              aria-label="重做"
              title="重做 (Cmd/Ctrl + Shift + Z)"
              className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-subtle)] inline-flex items-center justify-center disabled:opacity-30 transition-colors"
            >
              <LucideIcon name="redo-2" size={15} />
            </button>
          </div>

          {/* Dedicated Right Task Inbox Panel Toggle */}
          <button
            type="button"
            data-testid="toggle-inbox-drawer-btn"
            aria-pressed={inboxDrawerOpen}
            onClick={() => setInboxDrawerOpen(!inboxDrawerOpen)}
            title={inboxDrawerOpen ? '收合右側待辦收件匣 (I)' : '展開右側待辦收件匣 (I)'}
            className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-colors ${
              inboxDrawerOpen
                ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                : 'bg-[var(--surface-subtle)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-sky-400/60'
            }`}
          >
            <LucideIcon name={inboxDrawerOpen ? 'panel-right-close' : 'inbox'} size={14} />
            <span className="hidden min-[375px]:inline">待辦</span>
            {unscheduledTaskCount > 0 && (
              <span
                data-testid="inbox-toggle-badge"
                className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
                  inboxDrawerOpen
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-500/18 text-amber-700 dark:text-amber-300'
                }`}
              >
                {unscheduledTaskCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet (< lg) Compact 5-Mode View Switcher */}
      <div className="lg:hidden border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]/40 px-2.5 sm:px-5 py-1.5">
        <div
          role="tablist"
          aria-label="行動端檢視切換"
          className="grid grid-cols-5 items-center gap-1"
        >
          {VIEW_TABS.map((tab) => {
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`mobile-view-tab-${tab.id}`}
                onClick={() => setViewMode(tab.id)}
                className={`px-1.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-sky-500 text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--surface-glass)] border border-[var(--border-subtle)]'
                }`}
              >
                <LucideIcon name={tab.icon} size={12} className="shrink-0" />
                <span>{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export default React.memo(TopNavBar);
