import React from 'react';
import { LucideIcon, MeiScheduleLogo } from './BrandMark';
import { DESIGN_THEME_OPTIONS } from '../data/seedData';
import { useScheduleStore } from '../store/useScheduleStore';
import type { DesignTheme, ScheduleViewMode } from '../types/schedule';

const VIEW_TABS: Array<{ id: ScheduleViewMode; label: string; shortLabel: string; icon: string; shortcut: string }> = [
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

export interface TopNavBarProps {
  conflictCount: number;
  onFocusQuickCapture: () => void;
}

function TopNavBar({ conflictCount, onFocusQuickCapture }: TopNavBarProps) {
  const {
    viewMode,
    selectedDate,
    preferences,
    resolvedColorMode,
    currentMember,
    syncStatus,
    syncStatusMessage,
    sidebarOpen,
    canUndo,
    canRedo,
    setViewMode,
    goToToday,
    navigateDate,
    setSidebarOpen,
    updatePreferences,
    openModal,
    showToast,
    undo,
    redo
  } = useScheduleStore();

  const stepDays =
    viewMode === 'month' ? 30 : viewMode === 'week' ? 7 : viewMode === '3day' ? 3 : 1;

  const handleSelectTheme = (theme: DesignTheme) => {
    updatePreferences({ designTheme: theme });
    const label = DESIGN_THEME_OPTIONS.find((t) => t.id === theme)?.name || theme;
    showToast(`已切換外觀風格：${label}`, { icon: 'palette' });
  };

  const handleToggleColorMode = () => {
    const nextMode = resolvedColorMode === 'dark' ? 'light' : 'dark';
    updatePreferences({ colorMode: nextMode });
    showToast(nextMode === 'dark' ? '已切換至深色模式' : '已切換至亮色模式', {
      icon: nextMode === 'dark' ? 'moon' : 'sun'
    });
  };

  const syncDotClass =
    syncStatus === 'synced'
      ? 'bg-emerald-500'
      : syncStatus === 'syncing'
        ? 'bg-sky-500 animate-pulse'
        : syncStatus === 'offline-queued'
          ? 'bg-amber-500'
          : syncStatus === 'error'
            ? 'bg-rose-500'
            : 'bg-sky-400';

  return (
    <header
      data-testid="top-nav-bar"
      className="sticky top-0 z-30 pt-safe border-b border-[var(--border-subtle)] bg-[var(--surface-glass-strong)] backdrop-blur-[14px]"
    >
      {/* Tier 1: Brand Identity + Desktop View Switcher + Quick Tools */}
      <div className="mobile-header-bar narrow-compact-px max-w-[1600px] mx-auto h-14 px-2.5 sm:px-5 flex items-center justify-between gap-2">
        {/* Left: Sidebar Toggle + Brand Identity (shrink-0 prevents overlap on every viewport) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            data-testid="toggle-sidebar-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? '收合側邊欄' : '展開側邊欄'}
            title={sidebarOpen ? '收合側邊欄' : '展開側邊欄'}
            className="btn-sky-secondary p-1.5 sm:p-2 rounded-xl inline-flex items-center justify-center shrink-0"
          >
            <LucideIcon name={sidebarOpen ? 'panel-left-close' : 'panel-left-open'} size={16} />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="sm:hidden inline-flex shrink-0">
              <MeiScheduleLogo size="xs" />
            </span>
            <span className="hidden sm:inline-flex shrink-0">
              <MeiScheduleLogo size="sm" />
            </span>
            <div className="leading-tight hidden min-[375px]:block">
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading-lg text-sm sm:text-base font-extrabold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                  咩時光
                </span>
                <span className="hidden md:inline font-en text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 whitespace-nowrap">
                  MeiSchedule
                </span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncDotClass}`} />
                <span className="whitespace-nowrap">{syncStatusMessage}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Five View Mode Switcher (Desktop >= lg) */}
        <nav
          role="tablist"
          aria-label="排程檢視模式"
          className="hidden lg:inline-flex items-center gap-1 p-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] shrink-0"
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
                    ? 'bg-sky-500 text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <LucideIcon name={tab.icon} size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Quick Tools, Appearance, Color Mode, Undo/Redo, Quick Add, Member */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Command Palette / Search */}
          <button
            type="button"
            data-testid="open-command-palette-btn"
            onClick={() => openModal('command')}
            aria-label="開啟全域搜尋與指令列"
            title="全域搜尋與快捷指令 (Cmd/Ctrl + K)"
            className="btn-sky-secondary p-1.5 sm:px-2.5 sm:py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
          >
            <LucideIcon name="search" size={15} />
            <span className="hidden xl:inline whitespace-nowrap">搜尋</span>
            <kbd className="hidden xl:inline px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
              K
            </kbd>
          </button>

          {/* Smart Reschedule */}
          <button
            type="button"
            data-testid="open-smart-scheduler-btn"
            onClick={() => openModal('smart')}
            aria-label="智慧排程與預覽重排"
            title="智慧排程助手（預覽重排）"
            className="relative btn-sky-secondary p-1.5 sm:p-2 rounded-xl inline-flex items-center justify-center shrink-0"
          >
            <LucideIcon name="wand-sparkles" size={15} />
            {conflictCount > 0 && (
              <span
                data-testid="header-conflict-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center"
              >
                {conflictCount}
              </span>
            )}
          </button>

          {/* Focus Timer */}
          <button
            type="button"
            data-testid="open-focus-modal-btn"
            onClick={() => openModal('focus')}
            aria-label="專注番茄鐘"
            title="專注計時器 (F)"
            className="hidden sm:inline-flex btn-sky-secondary p-2 rounded-xl items-center justify-center shrink-0"
          >
            <LucideIcon name="timer" size={15} />
          </button>

          {/* Analytics Dashboard */}
          <button
            type="button"
            data-testid="open-analytics-modal-btn"
            onClick={() => openModal('analytics')}
            aria-label="時間統計儀表板"
            title="專注與時間統計儀表板"
            className="hidden md:inline-flex btn-sky-secondary p-2 rounded-xl items-center justify-center shrink-0"
          >
            <LucideIcon name="bar-chart-3" size={15} />
          </button>

          {/* Shared Calendars */}
          <button
            type="button"
            data-testid="open-shared-modal-btn"
            onClick={() => openModal('shared')}
            aria-label="多人共享日曆"
            title="多人共享日曆與邀請碼"
            className="hidden md:inline-flex btn-sky-secondary p-2 rounded-xl items-center justify-center shrink-0"
          >
            <LucideIcon name="users" size={15} />
          </button>

          {/* ICS / Google Calendar Sync */}
          <button
            type="button"
            data-testid="open-sync-modal-btn"
            onClick={() => openModal('sync')}
            aria-label="日曆匯入匯出與同步"
            title=".ics 匯入匯出與 Google 日曆連動"
            className="hidden xl:inline-flex btn-sky-secondary p-2 rounded-xl items-center justify-center shrink-0"
          >
            <LucideIcon name="refresh-cw" size={15} />
          </button>

          {/* Appearance Settings Modal */}
          <button
            type="button"
            data-testid="open-appearance-modal-btn"
            onClick={() => openModal('appearance')}
            aria-label="外觀風格與偏好設定"
            title="切換三套視覺風格與工作時段設定"
            className="btn-sky-secondary p-1.5 sm:p-2 rounded-xl inline-flex items-center justify-center shrink-0"
          >
            <LucideIcon name="palette" size={15} />
          </button>

          {/* Color Mode Toggle */}
          <button
            type="button"
            data-testid="color-mode-toggle-btn"
            onClick={handleToggleColorMode}
            aria-label={resolvedColorMode === 'dark' ? '切換至亮色模式' : '切換至深色模式'}
            title={resolvedColorMode === 'dark' ? '切換至亮色模式' : '切換至深色模式'}
            className="btn-sky-secondary p-1.5 sm:p-2 rounded-xl inline-flex items-center justify-center shrink-0"
          >
            <LucideIcon name={resolvedColorMode === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>

          {/* Undo / Redo */}
          <div className="hidden md:inline-flex items-center gap-1 shrink-0">
            <button
              type="button"
              data-testid="header-undo-btn"
              disabled={!canUndo}
              onClick={() => undo()}
              aria-label="復原上一步"
              title="復原上一步 (Cmd/Ctrl + Z)"
              className="btn-sky-secondary p-2 rounded-xl inline-flex items-center justify-center disabled:opacity-35"
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
              className="btn-sky-secondary p-2 rounded-xl inline-flex items-center justify-center disabled:opacity-35"
            >
              <LucideIcon name="redo-2" size={15} />
            </button>
          </div>

          {/* Quick Add Event Button */}
          <button
            type="button"
            data-testid="header-quick-add-btn"
            onClick={onFocusQuickCapture}
            title="新增行程 (C)"
            className="hidden sm:inline-flex btn-sky-primary px-2.5 xl:px-3 py-2 rounded-xl text-xs font-bold items-center gap-1 whitespace-nowrap shrink-0"
          >
            <LucideIcon name="plus" size={15} />
            <span className="hidden xl:inline">新增</span>
          </button>

          {/* Member Portal */}
          <button
            type="button"
            data-testid="header-member-portal-btn"
            onClick={() => openModal('member')}
            className="btn-sky-primary px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 max-w-[78px] min-[375px]:max-w-[96px] sm:max-w-[160px] shrink-0"
          >
            <LucideIcon name={currentMember ? 'user-check' : 'orbit'} size={14} className="shrink-0" />
            <span className="truncate">
              {currentMember ? currentMember.displayName : '會員專區'}
            </span>
          </button>
        </div>
      </div>

      {/* Tier 2: Dedicated Calendar Date Bar + Responsive View Tabs / Desktop 3-Theme Switcher */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]/45">
        <div className="narrow-compact-px max-w-[1600px] mx-auto px-2.5 sm:px-5 py-1.5 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
          {/* Date Controls (Zero overlap with BrandMark across 320px-1440px+) */}
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <button
              type="button"
              data-testid="nav-today-btn"
              onClick={goToToday}
              title="回到今天 (T)"
              className="btn-sky-secondary px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap shrink-0"
            >
              今天
            </button>
            <button
              type="button"
              data-testid="nav-prev-btn"
              onClick={() => navigateDate(-stepDays)}
              aria-label="上一區間"
              className="p-1 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0"
            >
              <LucideIcon name="chevron-left" size={16} />
            </button>
            <button
              type="button"
              data-testid="nav-next-btn"
              onClick={() => navigateDate(stepDays)}
              aria-label="下一區間"
              className="p-1 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0"
            >
              <LucideIcon name="chevron-right" size={16} />
            </button>
            <h1
              data-testid="current-date-heading"
              className="ml-0.5 text-xs sm:text-sm font-extrabold text-[var(--text-main)] whitespace-nowrap truncate"
            >
              {formatHeaderDateRange(selectedDate, viewMode)}
            </h1>
          </div>

          {/* Mobile & Tablet (< lg): Full-Width 5-Mode View Switcher without cut-off pills */}
          <div
            role="tablist"
            aria-label="行動端檢視切換"
            className="lg:hidden grid grid-cols-5 md:inline-flex items-center gap-1 shrink-0"
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
                  className={`px-1.5 md:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
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

          {/* Desktop (>= lg): 1-Click 3-Design-Theme Switcher directly visible at 1024px-1440px+ */}
          <div
            role="group"
            aria-label="外觀主題快速切換"
            className="hidden lg:inline-flex items-center gap-1 p-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-glass)] shrink-0"
          >
            {DESIGN_THEME_OPTIONS.map((opt) => {
              const active = preferences.designTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`theme-switch-${opt.id}`}
                  aria-pressed={active}
                  onClick={() => handleSelectTheme(opt.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                    active
                      ? 'bg-sky-500 text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <LucideIcon name={opt.icon} size={12} />
                  <span>{opt.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}

export default React.memo(TopNavBar);
