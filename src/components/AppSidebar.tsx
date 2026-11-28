import React, { useMemo, useState } from 'react';
import { LucideIcon, MeiScheduleLogo } from './BrandMark';
import {
  CALENDAR_SET_META,
  COLOR_TOKEN_PALETTE,
  DESIGN_THEME_OPTIONS,
  formatLocalDate
} from '../data/seedData';
import { parseLocalDateKey, toLocalDateKey } from '../services/recurrenceEngine';
import { useFocusSession } from '../store/FocusSessionContext';
import { useScheduleStore, useVisualTheme } from '../store/useScheduleStore';
import type { CalendarSetId, DesignTheme } from '../types/schedule';
import { useCardSpotlight, useElasticTabMarker } from '../utils/uiMomentsMotion';

export interface AppSidebarProps {
  conflictCount: number;
  onFocusQuickCapture: () => void;
}

/** Isolated 1s timer subscriber — 1s focus ticks NEVER re-render AppSidebar or Mini Month Calendar */
const SidebarFocusBadge = React.memo(function SidebarFocusBadge() {
  const { isRunning, remainingSeconds } = useFocusSession();
  if (!isRunning) return null;
  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');
  return (
    <span className="px-1.5 py-0.5 rounded-full theme-accent-soft font-mono text-[10px] font-bold inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full theme-accent-dot animate-pulse" />
      {mins}:{secs}
    </span>
  );
});

const SidebarFocusRailDot = React.memo(function SidebarFocusRailDot() {
  const { isRunning } = useFocusSession();
  if (!isRunning) return null;
  return (
    <span className="hidden lg:block absolute top-1.5 right-1.5 w-2 h-2 rounded-full theme-accent-dot animate-pulse" />
  );
});

/**
 * Isolated Visual Theme & Dark/Light Controls subscriber:
 * Toggling Dark/Light mode or switching between the 3 design themes re-renders ONLY these 4 buttons (~0.3ms),
 * NEVER re-rendering AppSidebar's 42-day mini calendar or the main calendar workspace.
 */
const SidebarVisualControls = React.memo(function SidebarVisualControls({
  isRailDesktop,
  hideOnRail,
  onOpenAppearance
}: {
  isRailDesktop: boolean;
  hideOnRail: string;
  onOpenAppearance: () => void;
}) {
  const { designTheme, resolvedColorMode } = useVisualTheme();
  const { updatePreferences, showToast } = useScheduleStore();
  const themeMarker = useElasticTabMarker(designTheme, [isRailDesktop]);

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

  return (
    <>
      {/* 3-Design-Theme Quick Switcher (Expanded & Mobile Drawer) */}
      <div
        ref={themeMarker.containerRef}
        role="group"
        aria-label="外觀主題快速切換"
        className={`relative grid grid-cols-3 gap-1 p-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] ${hideOnRail}`}
      >
        <span
          ref={themeMarker.indicatorRef}
          aria-hidden="true"
          data-testid="sidebar-theme-indicator"
          className="um-elastic-indicator theme-accent-solid rounded-lg shadow-sm"
        />
        {DESIGN_THEME_OPTIONS.map((opt) => {
          const active = designTheme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              data-um-tab-active={active ? 'true' : 'false'}
              data-testid={`theme-switch-${opt.id}`}
              aria-pressed={active}
              onClick={() => handleSelectTheme(opt.id)}
              className={`relative z-10 py-1 px-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors inline-flex items-center justify-center gap-1 ${
                active
                  ? 'theme-accent-solid shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <LucideIcon name={opt.icon} size={11} />
              <span>{opt.name}</span>
            </button>
          );
        })}
      </div>

      {/* Dark/Light Mode + Appearance Preferences Row */}
      <div
        className={`flex items-center gap-1.5 ${
          isRailDesktop ? 'flex-row lg:flex-col' : 'flex-row'
        }`}
      >
        <button
          type="button"
          data-testid="color-mode-toggle-btn"
          onClick={handleToggleColorMode}
          aria-label={resolvedColorMode === 'dark' ? '切換至亮色模式' : '切換至深色模式'}
          title={resolvedColorMode === 'dark' ? '切換至亮色模式' : '切換至深色模式'}
          className={`sidebar-nav-item rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-[var(--border-hover)] text-xs font-semibold text-[var(--text-main)] inline-flex items-center justify-center gap-1.5 ${
            isRailDesktop ? 'flex-1 py-1.5 px-2 lg:w-10 lg:h-9 lg:p-0 lg:flex-none' : 'flex-1 py-1.5 px-2'
          }`}
        >
          <LucideIcon name={resolvedColorMode === 'dark' ? 'sun' : 'moon'} size={14} />
          <span className={hideOnRail}>
            {resolvedColorMode === 'dark' ? '亮色' : '深色'}
          </span>
        </button>

        <button
          type="button"
          data-testid="open-appearance-modal-btn"
          onClick={onOpenAppearance}
          aria-label="外觀風格與偏好設定"
          title="偏好設定、工作時段與大廳膠囊管理"
          className={`sidebar-nav-item rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-[var(--border-hover)] text-xs font-semibold text-[var(--text-main)] inline-flex items-center justify-center gap-1.5 ${
            isRailDesktop ? 'flex-1 py-1.5 px-2 lg:w-10 lg:h-9 lg:p-0 lg:flex-none' : 'flex-1 py-1.5 px-2'
          }`}
        >
          <LucideIcon name="sliders-horizontal" size={14} />
          <span className={hideOnRail}>偏好設定</span>
        </button>
      </div>
    </>
  );
});

function AppSidebar({ conflictCount, onFocusQuickCapture }: AppSidebarProps) {
  const {
    calendars,
    events,
    selectedDate,
    preferences,
    currentMember,
    syncStatus,
    syncStatusMessage,
    sidebarOpen,
    activeModal,
    setSelectedDate,
    toggleCalendarVisibility,
    setActiveCalendarSet,
    setSidebarOpen,
    openModal
  } = useScheduleStore();

  const [miniMonthOffset, setMiniMonthOffset] = useState(0);
  const [miniMonthExpanded, setMiniMonthExpanded] = useState(true);
  const [calendarsExpanded, setCalendarsExpanded] = useState(true);
  const memberCardRef = useCardSpotlight<HTMLButtonElement>();

  // On desktop (>=1024px), sidebarOpen=false collapses into an iconic 64px Mini Rail.
  // On mobile (<1024px), sidebarOpen=false slides the full 280px drawer cleanly offscreen.
  const isRailDesktop = !sidebarOpen;

  const selectedDateObj = useMemo(() => parseLocalDateKey(selectedDate), [selectedDate]);
  const displayMonthDate = useMemo(
    () => new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + miniMonthOffset, 1),
    [selectedDateObj, miniMonthOffset]
  );

  const miniDays = useMemo(() => {
    const year = displayMonthDate.getFullYear();
    const month = displayMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset =
      preferences.weekStartsOn === 1 ? (firstDay.getDay() + 6) % 7 : firstDay.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    const cells: Array<{ dateKey: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const cur = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      cells.push({
        dateKey: toLocalDateKey(cur),
        day: cur.getDate(),
        inMonth: cur.getMonth() === month
      });
    }
    return cells;
  }, [displayMonthDate, preferences.weekStartsOn]);

  const eventDatesSet = useMemo(() => {
    const s = new Set<string>();
    for (const evt of events) {
      if (evt.status !== 'canceled') {
        s.add(toLocalDateKey(new Date(evt.startAt)));
      }
    }
    return s;
  }, [events]);

  const sharedCalendarCount = useMemo(
    () => calendars.filter((c) => c.isShared).length,
    [calendars]
  );

  const todayKey = formatLocalDate(new Date(), 0);
  const weekdayLabels =
    preferences.weekStartsOn === 1
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['日', '一', '二', '三', '四', '五', '六'];

  const syncDotClass =
    syncStatus === 'synced'
      ? 'bg-emerald-500'
      : syncStatus === 'syncing'
        ? 'theme-accent-dot animate-pulse'
        : syncStatus === 'offline-queued'
          ? 'bg-amber-500'
          : syncStatus === 'error'
            ? 'bg-rose-500'
            : 'theme-accent-dot';

  const closeIfMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleOpenTool = (
    modal: 'smart' | 'focus' | 'analytics' | 'shared' | 'sync' | 'command' | 'appearance' | 'member'
  ) => {
    closeIfMobile();
    openModal(modal);
  };

  const handleQuickAdd = () => {
    closeIfMobile();
    onFocusQuickCapture();
  };

  const handleSelectSet = (setId: CalendarSetId) => {
    setActiveCalendarSet(setId);
  };

  const toolItems: Array<{
    id: 'smart' | 'focus' | 'analytics' | 'shared' | 'sync';
    testId: string;
    label: string;
    hint: string;
    icon: string;
    badge?: React.ReactNode;
    railDot?: boolean;
    railDotClass?: string;
  }> = [
    {
      id: 'smart',
      testId: 'open-smart-scheduler-btn',
      label: '智慧排程助手',
      hint: '自動填補空檔與衝突預覽',
      icon: 'wand-sparkles',
      badge:
        conflictCount > 0 ? (
          <span
            data-testid="header-conflict-badge"
            className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold inline-flex items-center justify-center"
          >
            {conflictCount}
          </span>
        ) : null,
      railDot: conflictCount > 0,
      railDotClass: 'bg-rose-500'
    },
    {
      id: 'focus',
      testId: 'open-focus-modal-btn',
      label: '專注番茄鐘',
      hint: '專注計時與無版權輕音樂 (F)',
      icon: 'timer',
      badge: <SidebarFocusBadge />,
      railDot: false
    },
    {
      id: 'analytics',
      testId: 'open-analytics-modal-btn',
      label: '時間統計',
      hint: '每週時間分配與專注洞察',
      icon: 'bar-chart-3'
    },
    {
      id: 'shared',
      testId: 'open-shared-modal-btn',
      label: '多人共享日曆',
      hint: '邀請碼加入與成員權限管理',
      icon: 'users',
      badge:
        sharedCalendarCount > 0 ? (
          <span className="px-1.5 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)] text-[10px] font-bold">
            {sharedCalendarCount}
          </span>
        ) : null
    },
    {
      id: 'sync',
      testId: 'open-sync-modal-btn',
      label: '日曆匯入同步',
      hint: '.ics 檔案互通與 Google 日曆',
      icon: 'refresh-cw'
    }
  ];

  // Utility classes that collapse text/wide blocks gracefully on desktop Mini Rail while staying full-width in mobile drawer
  const hideOnRail = isRailDesktop ? 'lg:hidden' : '';

  return (
    <>
      {/* Mobile Slide-Over Backdrop (Crisp scrim without heavy full-screen mobile backdrop-filter GPU pass) */}
      {sidebarOpen && (
        <div
          data-testid="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/50 sm:backdrop-blur-[2px]"
          aria-hidden="true"
        />
      )}

      {/* Unified Full-Height Left Sidebar (Desktop: 264px Expanded <-> 64px Mini Rail | Mobile: 280px Slide-Over Drawer) */}
      <aside
        data-testid="app-sidebar"
        data-sidebar-mode={sidebarOpen ? 'expanded' : 'rail'}
        aria-label="主導覽側欄"
        className={`app-sidebar-surface fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 lg:z-30 h-[100dvh] flex flex-col border-r border-[var(--border-subtle)] shadow-2xl lg:shadow-none shrink-0 transition-[transform,width] duration-200 ease-out will-change-transform pt-safe ${
          sidebarOpen
            ? 'translate-x-0 w-[280px] max-w-[86vw] lg:w-[264px]'
            : '-translate-x-full pointer-events-none lg:translate-x-0 lg:pointer-events-auto lg:w-[64px] w-[280px]'
        }`}
      >
        {/* 1. Brand Identity + Collapse Control + Primary CTA + Search */}
        <div
          className={`shrink-0 border-b border-[var(--border-subtle)] ${
            isRailDesktop ? 'p-3 lg:px-2 lg:py-2.5' : 'p-3'
          } space-y-2`}
        >
          {/* Brand Row */}
          <div
            className={`flex items-center ${
              isRailDesktop ? 'justify-between lg:justify-center' : 'justify-between'
            } gap-2`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="um-brand-tilt shrink-0" data-testid="sidebar-brand-mark">
                <MeiScheduleLogo size="sm" />
              </span>
              <div className={`leading-tight min-w-0 ${hideOnRail}`}>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading-lg text-[15px] font-extrabold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                    咩時光
                  </span>
                  <span className="font-en text-[10px] font-bold uppercase tracking-wider theme-accent-deep whitespace-nowrap">
                    MeiSchedule
                  </span>
                </div>
                {syncStatusMessage.trim().length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncDotClass}`} />
                    <span className="truncate">{syncStatusMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Close button on Mobile Drawer */}
            <button
              type="button"
              data-testid="close-mobile-sidebar-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="關閉側邊欄"
              className="lg:hidden p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-subtle)] shrink-0"
            >
              <LucideIcon name="x" size={16} />
            </button>

            {/* Desktop Collapse Toggle inside Expanded Sidebar */}
            {sidebarOpen && (
              <button
                type="button"
                data-testid="sidebar-collapse-btn"
                onClick={() => setSidebarOpen(false)}
                aria-label="收合為精簡圖示軌"
                title="收合為 64px 精簡圖示軌"
                className="hidden lg:inline-flex p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-subtle)] shrink-0 transition-colors"
              >
                <LucideIcon name="panel-left-close" size={16} />
              </button>
            )}
          </div>

          {/* Desktop Mini Rail Expand Button */}
          {isRailDesktop && (
            <button
              type="button"
              data-testid="sidebar-expand-rail-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="展開完整側欄"
              title="展開完整側欄"
              className="hidden lg:flex w-10 h-9 mx-auto rounded-xl items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-subtle)] transition-colors"
            >
              <LucideIcon name="panel-left-open" size={16} />
            </button>
          )}

          {/* Primary Action Button: + 新增行程 / 待辦 */}
          <button
            type="button"
            data-testid="header-quick-add-btn"
            onClick={handleQuickAdd}
            title="快速新增行程或待辦 (C)"
            aria-label="快速新增行程或待辦"
            className={`btn-sky-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
              isRailDesktop
                ? 'w-full py-2 px-3 lg:w-10 lg:h-10 lg:p-0 lg:mx-auto'
                : 'w-full py-2 px-3'
            }`}
          >
            <LucideIcon name="plus" size={15} />
            <span className={`whitespace-nowrap ${hideOnRail}`}>新增行程 / 待辦</span>
            <kbd
              className={`ml-auto px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/20 text-white/95 ${hideOnRail}`}
            >
              C
            </kbd>
          </button>

          {/* Search / Command Palette Trigger */}
          <button
            type="button"
            data-testid="open-command-palette-btn"
            onClick={() => handleOpenTool('command')}
            aria-label="開啟全域搜尋與指令列"
            title="全域搜尋與快捷指令 (Cmd/Ctrl + K)"
            className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-medium flex items-center transition-colors ${
              isRailDesktop
                ? 'w-full px-2.5 py-1.5 justify-between lg:w-10 lg:h-9 lg:p-0 lg:mx-auto lg:justify-center'
                : 'w-full px-2.5 py-1.5 justify-between'
            }`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <LucideIcon name="search" size={14} />
              <span className={`truncate ${hideOnRail}`}>搜尋行程或指令...</span>
            </span>
            <kbd
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0 ${hideOnRail}`}
            >
              K
            </kbd>
          </button>
        </div>

        {/* 2. Scrollable Body: Labeled Tools + Mini Month + Calendars */}
        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden ${
            isRailDesktop ? 'p-2.5 lg:px-2 lg:py-2' : 'p-2.5'
          } space-y-2.5`}
        >
          {/* 2A. Functional Navigation Tools */}
          <nav aria-label="核心功能選單" className="space-y-0.5">
            <div
              className={`px-2 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] ${hideOnRail}`}
            >
              功能工具
            </div>
            {toolItems.map((item) => {
              const isActive = activeModal === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={item.testId}
                  onClick={() => handleOpenTool(item.id)}
                  title={`${item.label} — ${item.hint}`}
                  aria-label={item.label}
                  className={`sidebar-nav-item relative rounded-xl text-xs font-semibold flex items-center ${
                    isRailDesktop
                      ? 'w-full px-2.5 py-1.5 justify-between lg:w-10 lg:h-10 lg:p-0 lg:mx-auto lg:justify-center'
                      : 'w-full px-2.5 py-1.5 justify-between'
                  } ${
                    isActive
                      ? 'theme-accent-soft'
                      : 'text-[var(--text-main)] hover:bg-[var(--surface-subtle)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <LucideIcon
                      name={item.icon}
                      size={15}
                      className={
                        isActive ? 'theme-accent-text' : 'text-[var(--text-muted)]'
                      }
                    />
                    <span className={`truncate ${hideOnRail}`}>{item.label}</span>
                  </span>

                  {/* Expanded Badge */}
                  {item.badge && <span className={`shrink-0 ${hideOnRail}`}>{item.badge}</span>}

                  {/* Compact Rail Status Indicator Dot */}
                  {isRailDesktop && item.id === 'focus' && <SidebarFocusRailDot />}
                  {isRailDesktop && item.railDot && (
                    <span
                      className={`hidden lg:block absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                        item.railDotClass || 'theme-accent-dot'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* 2B. Mini Month Calendar (Frameless, compact hairline section — hidden in desktop Mini Rail) */}
          <section
            aria-label="迷你月曆"
            className={`pt-2 border-t border-[var(--border-subtle)] space-y-1.5 ${hideOnRail}`}
          >
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setMiniMonthExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[var(--text-main)] hover:text-[var(--accent-deep)] transition-colors"
              >
                <LucideIcon
                  name={miniMonthExpanded ? 'chevron-down' : 'chevron-right'}
                  size={13}
                  className="text-[var(--text-muted)]"
                />
                <span>
                  {displayMonthDate.getFullYear()} 年 {displayMonthDate.getMonth() + 1} 月
                </span>
              </button>

              {miniMonthExpanded && (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setMiniMonthOffset((o) => o - 1)}
                    aria-label="上個月"
                    className="p-0.5 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                  >
                    <LucideIcon name="chevron-left" size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMiniMonthOffset(0);
                      setSelectedDate(todayKey);
                    }}
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold theme-accent-deep hover:bg-[var(--accent-soft-bg)]"
                  >
                    今
                  </button>
                  <button
                    type="button"
                    onClick={() => setMiniMonthOffset((o) => o + 1)}
                    aria-label="下個月"
                    className="p-0.5 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                  >
                    <LucideIcon name="chevron-right" size={13} />
                  </button>
                </div>
              )}
            </div>

            {miniMonthExpanded && (
              <div className="space-y-0.5">
                <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-[var(--text-muted)]">
                  {weekdayLabels.map((w) => (
                    <div key={w} className="py-0.5">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {miniDays.map((cell) => {
                    const isSelected = cell.dateKey === selectedDate;
                    const isToday = cell.dateKey === todayKey;
                    const hasEvents = eventDatesSet.has(cell.dateKey);
                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => {
                          setSelectedDate(cell.dateKey);
                          setMiniMonthOffset(0);
                          closeIfMobile();
                        }}
                        className={`relative h-6 rounded-md text-[11px] font-semibold flex flex-col items-center justify-center transition-colors ${
                          isSelected
                            ? 'theme-accent-solid'
                            : isToday
                              ? 'theme-accent-soft border'
                              : cell.inMonth
                                ? 'text-[var(--text-main)] hover:bg-[var(--surface-subtle)]'
                                : 'text-[var(--text-muted)] opacity-40 hover:opacity-75'
                        }`}
                      >
                        <span>{cell.day}</span>
                        {hasEvents && !isSelected && (
                          <span className="w-1 h-1 rounded-full theme-accent-dot absolute bottom-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 2C. Calendar Sets & Individual Calendars (Hidden in desktop Mini Rail) */}
          <section
            aria-label="我的日曆與情境組"
            className={`pt-2 border-t border-[var(--border-subtle)] space-y-2 ${hideOnRail}`}
          >
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setCalendarsExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[var(--text-main)] hover:text-[var(--accent-deep)] transition-colors"
              >
                <LucideIcon
                  name={calendarsExpanded ? 'chevron-down' : 'chevron-right'}
                  size={13}
                  className="text-[var(--text-muted)]"
                />
                <span>我的日曆</span>
              </button>
              <button
                type="button"
                data-testid="sidebar-manage-shared-btn"
                onClick={() => handleOpenTool('shared')}
                title="管理共享日曆與成員"
                className="text-[10px] font-bold theme-accent-deep hover:underline inline-flex items-center gap-0.5"
              >
                <LucideIcon name="plus" size={11} />
                <span>共享管理</span>
              </button>
            </div>

            {calendarsExpanded && (
              <>
                {/* Compact Context Filter Pills */}
                <div className="flex flex-wrap gap-1" role="group" aria-label="情境日曆組切換">
                  {CALENDAR_SET_META.map((setMeta) => {
                    const active = preferences.activeCalendarSet === setMeta.id;
                    return (
                      <button
                        key={setMeta.id}
                        type="button"
                        data-testid={`calendar-set-${setMeta.id}`}
                        aria-pressed={active}
                        onClick={() => handleSelectSet(setMeta.id)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors ${
                          active
                            ? 'theme-accent-solid'
                            : 'bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <LucideIcon name={setMeta.icon} size={10} />
                        <span>{setMeta.label.replace('行事曆', '').replace('生活', '').replace('專案', '').replace('成長', '').replace('多人', '')}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Individual Calendar Checkboxes */}
                <div className="space-y-0.5">
                  {calendars.map((cal) => {
                    const palette = COLOR_TOKEN_PALETTE[cal.colorToken] || COLOR_TOKEN_PALETTE.sky;
                    const visible = cal.visible !== false;
                    return (
                      <label
                        key={cal.id}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--surface-subtle)] cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() => toggleCalendarVisibility(cal.id)}
                            className="mt-0.5 rounded border-[var(--border-subtle)] theme-checkbox"
                          />
                          <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${palette.dotClass}`} />
                          <span className="font-medium text-[var(--text-main)] schedule-title-wrap">
                            {cal.name}
                          </span>
                        </div>
                        {cal.isShared && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold theme-accent-soft shrink-0">
                            共享
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>

        {/* 3. Pinned Utility Footer: Isolated 3-Theme + Dark/Light Controls + Member Account */}
        <div
          className={`shrink-0 border-t border-[var(--border-subtle)] pb-safe ${
            isRailDesktop ? 'p-3 lg:px-2 lg:py-2.5' : 'p-3'
          } space-y-2`}
        >
          <SidebarVisualControls
            isRailDesktop={isRailDesktop}
            hideOnRail={hideOnRail}
            onOpenAppearance={() => handleOpenTool('appearance')}
          />

          {/* Member Account Card */}
          <button
            ref={memberCardRef}
            type="button"
            data-testid="header-member-portal-btn"
            onClick={() => handleOpenTool('member')}
            title={currentMember ? `會員帳號：${currentMember.displayName}` : '登入或註冊咩創意雲端會員'}
            className={`um-card-spotlight sidebar-nav-item rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-glass)] hover:border-[var(--border-hover)] flex items-center gap-2.5 text-left ${
              isRailDesktop
                ? 'w-full p-2 lg:w-10 lg:h-10 lg:p-0 lg:mx-auto lg:justify-center'
                : 'w-full p-2'
            }`}
          >
            <div className="w-7 h-7 rounded-lg squircle-icon-badge flex items-center justify-center shrink-0">
              <LucideIcon name={currentMember ? 'user-check' : 'orbit'} size={14} />
            </div>
            <div className={`min-w-0 flex-1 leading-tight ${hideOnRail}`}>
              <div className="text-xs font-bold text-[var(--text-main)] truncate">
                {currentMember ? currentMember.displayName : '會員專區'}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">
                {currentMember ? currentMember.email : '登入啟用跨裝置同步'}
              </div>
            </div>
            <LucideIcon
              name="chevron-right"
              size={13}
              className={`text-[var(--text-muted)] shrink-0 ${hideOnRail}`}
            />
          </button>
        </div>
      </aside>
    </>
  );
}

export default React.memo(AppSidebar);
