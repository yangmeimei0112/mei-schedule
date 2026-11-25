import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { COLOR_TOKEN_PALETTE } from '../data/seedData';
import { toLocalDateKey } from '../services/recurrenceEngine';
import { useScheduleStore } from '../store/useScheduleStore';

export default function CommandPalette() {
  const {
    activeModal,
    closeModal,
    events,
    tasks,
    resolvedColorMode,
    sidebarOpen,
    inboxDrawerOpen,
    setViewMode,
    setSelectedDate,
    setSidebarOpen,
    setInboxDrawerOpen,
    goToToday,
    selectEvent,
    toggleTaskComplete,
    openModal,
    updatePreferences,
    showToast,
    undo,
    redo
  } = useScheduleStore();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeModal === 'command') {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [activeModal]);

  const quickCommands = useMemo(
    () => [
      { id: 'cmd-today', label: '跳轉回到今天', icon: 'calendar-check', run: () => goToToday() },
      {
        id: 'cmd-toggle-inbox',
        label: inboxDrawerOpen ? '收合右側待辦收件匣 (I)' : '展開右側待辦收件匣 (I)',
        icon: 'inbox',
        run: () => setInboxDrawerOpen(!inboxDrawerOpen)
      },
      {
        id: 'cmd-toggle-sidebar',
        label: sidebarOpen ? '將左側側欄縮為精簡圖示軌' : '展開完整左側導覽側欄',
        icon: sidebarOpen ? 'panel-left-close' : 'panel-left-open',
        run: () => setSidebarOpen(!sidebarOpen)
      },
      { id: 'cmd-view-day', label: '切換至單日時間軸視角', icon: 'clock', run: () => setViewMode('day') },
      { id: 'cmd-view-week', label: '切換至週視圖時間網格', icon: 'calendar-range', run: () => setViewMode('week') },
      { id: 'cmd-view-month', label: '切換至月總覽', icon: 'calendar-days', run: () => setViewMode('month') },
      { id: 'cmd-view-agenda', label: '切換至清單視角', icon: 'list-todo', run: () => setViewMode('agenda') },
      { id: 'cmd-smart', label: '開啟智慧排程助手（預覽重排）', icon: 'wand-sparkles', run: () => openModal('smart') },
      { id: 'cmd-focus', label: '啟動專注番茄鐘計時器', icon: 'timer', run: () => openModal('focus') },
      { id: 'cmd-analytics', label: '開啟時間統計與專注儀表板', icon: 'bar-chart-3', run: () => openModal('analytics') },
      { id: 'cmd-shared', label: '管理多人共享日曆與邀請碼', icon: 'users', run: () => openModal('shared') },
      { id: 'cmd-sync', label: '匯入／匯出 .ics 與跨端提醒設定', icon: 'refresh-cw', run: () => openModal('sync') },
      { id: 'cmd-appearance', label: '切換外觀風格（晴空／極簡／溫暖）', icon: 'palette', run: () => openModal('appearance') },
      {
        id: 'cmd-dock-visible',
        label: '顯示「返回咩創意大廳」懸浮按鈕',
        icon: 'eye',
        run: () => {
          window.MeiStudioDock?.show();
          showToast('已顯示「返回咩創意大廳」懸浮按鈕', { icon: 'eye' });
        }
      },
      {
        id: 'cmd-dock-edge',
        label: '隱藏「返回咩創意大廳」按鈕（貼邊微露）',
        icon: 'panel-left-close',
        run: () => {
          window.MeiStudioDock?.hideToEdge();
          showToast('已收至螢幕邊緣微露拉條', { icon: 'panel-left-close' });
        }
      },
      {
        id: 'cmd-dock-completely-hidden',
        label: '完全隱藏「返回咩創意大廳」懸浮按鈕',
        icon: 'eye-off',
        run: () => {
          window.MeiStudioDock?.hideCompletely();
          showToast('已完全隱藏返回大廳按鈕，可隨時按 Cmd/Ctrl+K 重新開啟', { icon: 'eye-off' });
        }
      },
      {
        id: 'cmd-dark',
        label: resolvedColorMode === 'dark' ? '切換至亮色模式' : '切換至深色模式',
        icon: resolvedColorMode === 'dark' ? 'sun' : 'moon',
        run: () => updatePreferences({ colorMode: resolvedColorMode === 'dark' ? 'light' : 'dark' })
      },
      { id: 'cmd-undo', label: '復原上一步操作 (Undo)', icon: 'undo-2', run: () => undo() },
      { id: 'cmd-redo', label: '重做操作 (Redo)', icon: 'redo-2', run: () => redo() }
    ],
    [
      goToToday,
      inboxDrawerOpen,
      setInboxDrawerOpen,
      sidebarOpen,
      setSidebarOpen,
      setViewMode,
      openModal,
      resolvedColorMode,
      updatePreferences,
      showToast,
      undo,
      redo
    ]
  );

  const q = query.trim().toLowerCase();

  const matchedEvents = useMemo(() => {
    if (!q) return events.slice(0, 5);
    return events
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.categoryTag.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [events, q]);

  const matchedTasks = useMemo(() => {
    if (!q) return tasks.filter((t) => !t.completed).slice(0, 4);
    return tasks
      .filter((t) => t.title.toLowerCase().includes(q) || t.categoryTag.toLowerCase().includes(q))
      .slice(0, 6);
  }, [tasks, q]);

  const matchedCommands = useMemo(() => {
    if (!q) return quickCommands.slice(0, 6);
    return quickCommands.filter((c) => c.label.toLowerCase().includes(q));
  }, [quickCommands, q]);

  if (activeModal !== 'command') return null;

  return (
    <div
      data-testid="command-palette-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-24 px-3 bg-slate-950/50 backdrop-blur-sm"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="全域快捷指令與全文搜尋"
        onClick={(e) => e.stopPropagation()}
        className="max-h-dvh-85 w-full max-w-xl bento-glass-card overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2.5">
          <LucideIcon name="search" size={18} className="theme-accent-text shrink-0" />
          <input
            ref={inputRef}
            type="text"
            data-testid="command-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋任意行程、待辦事項或執行快捷指令..."
            className="flex-1 bg-transparent text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={closeModal}
            className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-[var(--surface-subtle)] text-[var(--text-muted)]"
          >
            ESC
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Matched Events */}
          {matchedEvents.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                排程行程 ({matchedEvents.length})
              </div>
              {matchedEvents.map((evt) => {
                const palette = COLOR_TOKEN_PALETTE[evt.colorToken] || COLOR_TOKEN_PALETTE.sky;
                const dKey = toLocalDateKey(new Date(evt.startAt));
                return (
                  <button
                    key={evt.id}
                    type="button"
                    data-testid={`cmd-event-${evt.id}`}
                    onClick={() => {
                      setSelectedDate(dKey);
                      selectEvent(evt.id, dKey);
                      closeModal();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[var(--accent-soft-bg)] flex items-center justify-between gap-2 text-left text-xs transition-colors"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${palette.dotClass}`} />
                      <span className="font-bold text-[var(--text-main)] schedule-title-wrap">{evt.title}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[var(--text-muted)] shrink-0">
                      {dKey}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Matched Tasks */}
          {matchedTasks.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                待辦收件匣 ({matchedTasks.length})
              </div>
              {matchedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    toggleTaskComplete(task.id);
                    closeModal();
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-[var(--accent-soft-bg)] flex items-start justify-between gap-2 text-left text-xs transition-colors"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <LucideIcon
                      name={task.completed ? 'check-square' : 'square'}
                      size={14}
                      className="theme-accent-text mt-0.5 shrink-0"
                    />
                    <span className="font-semibold text-[var(--text-main)] schedule-title-wrap">{task.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                    {task.estimatedMinutes}m
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Commands */}
          {matchedCommands.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                快捷操作
              </div>
              {matchedCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  type="button"
                  data-testid={cmd.id}
                  onClick={() => {
                    closeModal();
                    cmd.run();
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-[var(--accent-soft-bg)] flex items-center gap-2.5 text-left text-xs font-bold text-[var(--text-main)] transition-colors"
                >
                  <LucideIcon name={cmd.icon} size={14} className="theme-accent-text" />
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          {matchedEvents.length === 0 && matchedTasks.length === 0 && matchedCommands.length === 0 && (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              查無相符的排程或指令
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
