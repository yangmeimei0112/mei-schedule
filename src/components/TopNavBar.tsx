import React from 'react';
import { BrandMark, LucideIcon } from './BrandMark';
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

export default function TopNavBar({ conflictCount, onFocusQuickCapture }: TopNavBarProps) {
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
      className="sticky top-0 z-30 pt-safe border-b border-[var(--border-subtle)] bg-[var(--surface-glass-strong)] backdrop-blur-xl"
    >
      <div className="mobile-header-bar narrow-compact-px max-w-[1600px] mx-auto h-16 px-3 sm:px-5 flex items-center justify-between gap-2">
        {/* Left: Sidebar Toggle + Brand + Date Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            data-testid="toggle-sidebar-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? '收合側邊欄' : '展開側邊欄'}
            title={sidebarOpen ? '收合側邊欄' : '展開側邊欄'}
            className="btn-sky-secondary p-2 rounded-xl inline-flex items-center justify-center shrink-0"
          >
            <LucideIcon name={sidebarOpen ? 'panel-left-close' : 'panel-left-open'} size={16} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <BrandMark size="sm" />
            <div className="min-w-0 leading-tight hidden sm:block">
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading-lg text-base font-extrabold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                  咩時光
                </span>
                <span className="font-en text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  MeiSchedule
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncDotClass}`} />
                <span className="truncate">{syncStatusMessage}</span>
              </div>
            </div>
          </div>

          {/* Date Controls */}
          <div className="flex items-center gap-1 ml-0.5 sm:ml-2">
            <button
              type="button"
              data-testid="nav-today-btn"
              onClick={goToToday}
              title="回到今天 (T)"
              className="btn-sky-secondary px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0"
            >
              今天
            </button>
            <button
              type="button"
              data-testid="nav-prev-btn"
              onClick={() => navigateDate(-stepDays)}
              aria-label="上一區間"
              className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <LucideIcon name="chevron-left" size={16} />
            </button>
            <button
              type="button"
              data-testid="nav-next-btn"
              onClick={() => navigateDate(stepDays)}
              aria-label="下一區間"
              className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <LucideIcon name="chevron-right" size={16} />
            </button>
            <h1
              data-testid="current-date-heading"
              className="studio-hero-title-zh text-sm sm:text-base font-bold text-[var(--text-main)] truncate max-w-[130px] sm:max-w-[240px]"
            >
              {formatHeaderDateRange(selectedDate, viewMode)}
            </h1>
          </div>
        </div>

        {/* Center: Five View Mode Switcher (Desktop/Tablet) */}
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
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

        {/* Right: Quick Tools, 3-Theme Switcher, Color Mode, Undo/Redo, Member */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Command Palette / Search */}
          <button
            type="button"
            data-testid="open-command-palette-btn"
            onClick={() => openModal('command')}
            aria-label="開啟全域搜尋與指令列"
            title="全域搜尋與快捷指令 (Cmd/Ctrl + K)"
            className="btn-sky-secondary px-2 sm:px-2.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <LucideIcon name="search" size={15} />
            <span className="hidden xl:inline">搜尋</span>
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
            className="relative btn-sky-secondary p-2 rounded-xl inline-flex items-center justify-center"
          >
            <LucideIcon name="wand-sparkles" size={16} />
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
            className="hidden sm:inline-flex btn-sky-secondary p-2 rounded-xl items-center justify-center"
          >
            <LucideIcon name="timer" size={16} />
          </button>

          {/* Analytics Dashboard */}
          <button
            type="button"
            data-testid="open-analytics-modal-btn"
            onClick={() => openModal('analytics')}
            aria-label="時間統計儀表板"
            title="專注與時間統計儀表板"
            className="hidden md:inline-flex btn-sky-secondary p-2 rounded-xl items-center justify-center"
          >
            <LucideIcon name="bar-chart-3" size={16} />
          </button>

          {/* Shared Calendars */}
          <button
            type="button"
            data-testid="open-shared-modal-btn"
            onClick={() => openModal('shared')}
            aria-label="多人共享日曆"
            title="多人共享日曆與邀請碼"
            className="hidden md:inline-flex btn-sky-secondary p-2 rounded-xl items-center justify-center"
          >
            <LucideIcon name="users" size={16} />
          </button>

          {/* ICS / Google Calendar Sync */}
          <button
            type="button"
            data-testid="open-sync-modal-btn"
            onClick={() => openModal('sync')}
            aria-label="日曆匯入匯出與同步"
            title=".ics 匯入匯出與 Google 日曆連動"
            className="hidden lg:inline-flex btn-sky-secondary p-2 rounded-xl items-center justify-center"
          >
            <LucideIcon name="refresh-cw" size={16} />
          </button>

          {/* 3-Theme Switcher (Inline on 2xl+, plus Appearance Settings button) */}
          <div
            role="group"
            aria-label="外觀主題快速切換"
            className="hidden 2xl:inline-flex items-center gap-0.5 p-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)]"
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
                  className={`px-2 py-1 rounded-full text-[11px] font-semibold transition-colors inline-flex items-center gap-1 ${
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

          <button
            type="button"
            data-testid="open-appearance-modal-btn"
            onClick={() => openModal('appearance')}
            aria-label="外觀風格與偏好設定"
            title="切換三套視覺風格與工作時段設定"
            className="btn-sky-secondary p-2 rounded-xl inline-flex items-center justify-center"
          >
            <LucideIcon name="palette" size={16} />
          </button>

          <button
            type="button"
            data-testid="color-mode-toggle-btn"
            onClick={handleToggleColorMode}
            aria-label={resolvedColorMode === 'dark' ? '切換至亮色模式' : '切換至深色模式'}
            title={resolvedColorMode === 'dark' ? '切換至亮色模式' : '切換至深色模式'}
            className="btn-sky-secondary p-2 rounded-xl inline-flex items-center justify-center"
          >
            <LucideIcon name={resolvedColorMode === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>

          {/* Undo / Redo */}
          <div className="hidden sm:inline-flex items-center gap-1">
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
            className="hidden sm:inline-flex btn-sky-primary px-3 py-2 rounded-xl text-xs font-bold items-center gap-1"
          >
            <LucideIcon name="plus" size={15} />
            <span className="hidden md:inline">新增</span>
          </button>

          {/* Member Portal */}
          <button
            type="button"
            data-testid="header-member-portal-btn"
            onClick={() => openModal('member')}
            className="btn-sky-primary px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 max-w-[116px] max-[429px]:max-w-[88px] sm:max-w-[170px]"
          >
            <LucideIcon name={currentMember ? 'user-check' : 'orbit'} size={15} />
            <span className="truncate">
              {currentMember ? currentMember.displayName : '會員專區'}
            </span>
          </button>
        </div>
      </div>

      {/* Compact Secondary View Bar for Mobile/Tablet (< lg) */}
      <div className="lg:hidden border-t border-[var(--border-subtle)] px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div role="tablist" aria-label="行動端檢視切換" className="inline-flex items-center gap-1">
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
                className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors ${
                  active
                    ? 'bg-sky-500 text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--surface-subtle)]'
                }`}
              >
                <LucideIcon name={tab.icon} size={13} />
                <span>{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Inline compact theme pills on mobile/tablet so all 3 theme buttons remain 1-tap accessible */}
        <div className="inline-flex items-center gap-1 shrink-0">
          {DESIGN_THEME_OPTIONS.map((opt) => {
            const active = preferences.designTheme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`mobile-theme-switch-${opt.id}`}
                onClick={() => handleSelectTheme(opt.id)}
                aria-label={`切換為${opt.name}`}
                title={opt.name}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  active
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
