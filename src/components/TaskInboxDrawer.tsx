import React, { useMemo, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { parseLocalDateKey } from '../services/recurrenceEngine';
import { useScheduleStore } from '../store/useScheduleStore';
import type { PriorityLevel, ScheduleTask } from '../types/schedule';

/**
 * Dedicated Right-Wing Collapsible Task Inbox Panel (Google Calendar Tasks x Sunsama workflow)
 * - Desktop (>= lg): Docked right wing beside the calendar for effortless drag-to-timeline blocking.
 * - Mobile / Tablet (< lg): Clean right-side slide-over drawer.
 */
function TaskInboxDrawer() {
  const {
    tasks,
    selectedDate,
    preferences,
    inboxDrawerOpen,
    setInboxDrawerOpen,
    createTask,
    toggleTaskComplete,
    deleteTask,
    scheduleTaskToTimeBlock,
    openModal
  } = useScheduleStore();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskMinutes, setNewTaskMinutes] = useState(30);
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>(2);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((t) => (showCompletedTasks ? true : !t.completed))
      .slice()
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (Boolean(a.scheduledEventId) !== Boolean(b.scheduledEventId)) {
          return a.scheduledEventId ? 1 : -1;
        }
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.sortOrder - b.sortOrder;
      });
  }, [tasks, showCompletedTasks]);

  const unscheduledCount = useMemo(
    () => tasks.filter((t) => !t.completed && !t.scheduledEventId).length,
    [tasks]
  );

  if (!inboxDrawerOpen) return null;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createTask({
      title: newTaskTitle.trim(),
      estimatedMinutes: newTaskMinutes,
      priority: newTaskPriority,
      dueDate: selectedDate
    });
    setNewTaskTitle('');
  };

  const handleQuickScheduleTask = (task: ScheduleTask) => {
    const base = parseLocalDateKey(selectedDate);
    const start = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      Math.max(preferences.workStartHour, 10),
      0,
      0,
      0
    );
    const end = new Date(start.getTime() + Math.max(15, task.estimatedMinutes || 30) * 60_000);
    scheduleTaskToTimeBlock(task.id, start.toISOString(), end.toISOString(), task.calendarId || undefined);
  };

  const handleDragStartTask = (e: React.DragEvent, task: ScheduleTask) => {
    e.dataTransfer.setData(
      'application/x-mei-task',
      JSON.stringify({
        taskId: task.id,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      {/* Mobile / Tablet Backdrop */}
      <div
        data-testid="right-inbox-drawer-overlay"
        onClick={() => setInboxDrawerOpen(false)}
        className="lg:hidden fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Right Wing Docked Panel (Desktop) / Right Slide-Over Drawer (Mobile/Tablet) */}
      <aside
        data-testid="task-inbox-drawer"
        aria-label="待辦收件匣面板"
        className="app-right-wing-surface fixed inset-y-0 right-0 z-50 lg:sticky lg:top-0 lg:z-20 h-[100dvh] w-[88vw] max-w-[340px] lg:w-[316px] xl:w-[330px] shrink-0 border-l border-[var(--border-subtle)] shadow-2xl lg:shadow-none flex flex-col pt-safe"
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg squircle-icon-badge flex items-center justify-center shrink-0">
              <LucideIcon name="inbox" size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold text-[var(--text-main)] truncate">
                  待辦收件匣
                </h2>
                <span
                  data-testid="inbox-unscheduled-count"
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold theme-accent-soft"
                >
                  {unscheduledCount}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              data-testid="inbox-auto-schedule-btn"
              onClick={() => openModal('smart')}
              title="使用智慧助手將未排程待辦自動填入空檔"
              className="px-2 py-1 rounded-lg text-[11px] font-bold theme-accent-deep hover:bg-[var(--accent-soft-bg)] inline-flex items-center gap-1 transition-colors"
            >
              <LucideIcon name="wand-sparkles" size={12} />
              <span>智慧排塊</span>
            </button>
            <button
              type="button"
              data-testid="close-inbox-drawer-btn"
              onClick={() => setInboxDrawerOpen(false)}
              aria-label="收合待辦收件匣"
              title="收合待辦收件匣 (I)"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-subtle)] transition-colors"
            >
              <LucideIcon name="panel-right-close" size={15} />
            </button>
          </div>
        </div>

        {/* Quick Add Form */}
        <div className="shrink-0 p-3.5 border-b border-[var(--border-subtle)] space-y-2.5">
          <form onSubmit={handleAddTask} className="space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                data-testid="inbox-add-task-input"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="新增待辦事項..."
                className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="submit"
                data-testid="inbox-add-task-btn"
                disabled={!newTaskTitle.trim()}
                aria-label="新增待辦"
                className="btn-sky-primary p-2 rounded-xl disabled:opacity-40 shrink-0"
              >
                <LucideIcon name="plus" size={15} />
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <div className="flex items-center gap-1">
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNewTaskMinutes(m)}
                    className={`px-1.5 py-0.5 rounded-md font-mono font-semibold transition-colors ${
                      newTaskMinutes === m
                        ? 'theme-accent-soft'
                        : 'hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {([1, 2, 3] as PriorityLevel[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewTaskPriority(p)}
                    className={`px-1.5 py-0.5 rounded-md font-bold transition-colors ${
                      newTaskPriority === p
                        ? p === 1
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                          : p === 2
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-500/20 text-slate-700 dark:text-slate-300'
                        : 'hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>
          </form>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--accent-soft-bg)]/60 text-[11px] text-[var(--text-muted)]">
            <LucideIcon name="grip-vertical" size={12} className="theme-accent-text shrink-0" />
            <span>拖曳卡片進中間時段格，或點日曆鍵一鍵排入</span>
          </div>
        </div>

        {/* Scrollable Task List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2 pb-20">
          {visibleTasks.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)] space-y-1.5">
              <LucideIcon
                name="circle-check"
                size={24}
                className="mx-auto text-emerald-500 opacity-75"
              />
              <p className="font-semibold text-[var(--text-main)]">收件匣已全數清空</p>
              <p className="text-[11px]">有靈感或待辦時隨時在上方記下</p>
            </div>
          ) : (
            visibleTasks.map((task) => {
              const prioColor =
                task.priority === 1
                  ? 'text-rose-500'
                  : task.priority === 2
                    ? 'text-amber-500'
                    : 'text-slate-400';
              return (
                <div
                  key={task.id}
                  data-testid={`inbox-task-${task.id}`}
                  draggable={!task.completed}
                  onDragStart={(e) => handleDragStartTask(e, task)}
                  className={`group p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-[var(--border-hover)] transition-colors cursor-grab active:cursor-grabbing ${
                    task.completed ? 'opacity-55' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTaskComplete(task.id)}
                      aria-label={task.completed ? '標記為未完成' : '標記為完成'}
                      className="mt-0.5 text-[var(--text-muted)] hover:text-emerald-500 shrink-0"
                    >
                      <LucideIcon
                        name={task.completed ? 'check-square' : 'square'}
                        size={15}
                        className={task.completed ? 'text-emerald-500' : ''}
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-bold leading-snug break-words ${
                          task.completed
                            ? 'line-through text-[var(--text-muted)]'
                            : 'text-[var(--text-main)]'
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] text-[var(--text-muted)]">
                        <span className={`font-bold inline-flex items-center gap-0.5 ${prioColor}`}>
                          <LucideIcon name="flag" size={10} />
                          P{task.priority}
                        </span>
                        <span className="font-mono">{task.estimatedMinutes}m</span>
                        {task.dueDate && <span>{task.dueDate.slice(5)}</span>}
                        {task.scheduledEventId && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                            已排塊
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {!task.completed && !task.scheduledEventId && (
                        <button
                          type="button"
                          data-testid={`schedule-task-btn-${task.id}`}
                          onClick={() => handleQuickScheduleTask(task)}
                          title="一鍵排入所選日期時間軸"
                          className="p-1 rounded-lg hover:bg-[var(--accent-soft-bg)] theme-accent-deep"
                        >
                          <LucideIcon name="calendar-plus" size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label="刪除待辦"
                        className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-rose-500/15 text-rose-500"
                      >
                        <LucideIcon name="trash-2" size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Toggle */}
        <div className="shrink-0 px-4 py-2.5 border-t border-[var(--border-subtle)] pb-safe">
          <button
            type="button"
            onClick={() => setShowCompletedTasks((v) => !v)}
            className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] inline-flex items-center gap-1.5"
          >
            <LucideIcon name={showCompletedTasks ? 'eye-off' : 'eye'} size={12} />
            <span>{showCompletedTasks ? '隱藏已完成待辦' : '顯示已完成待辦'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default React.memo(TaskInboxDrawer);
