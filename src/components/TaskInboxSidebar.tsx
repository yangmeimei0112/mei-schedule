import React, { useMemo, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { CALENDAR_SET_META, COLOR_TOKEN_PALETTE, formatLocalDate } from '../data/seedData';
import { parseLocalDateKey, toLocalDateKey } from '../services/recurrenceEngine';
import { useScheduleStore } from '../store/useScheduleStore';
import type { CalendarSetId, PriorityLevel, ScheduleTask } from '../types/schedule';

export interface TaskInboxSidebarProps {
  className?: string;
}

export default function TaskInboxSidebar({ className = '' }: TaskInboxSidebarProps) {
  const {
    calendars,
    tasks,
    events,
    selectedDate,
    preferences,
    setSelectedDate,
    toggleCalendarVisibility,
    setActiveCalendarSet,
    createTask,
    toggleTaskComplete,
    deleteTask,
    scheduleTaskToTimeBlock,
    openModal,
    setSidebarOpen
  } = useScheduleStore();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskMinutes, setNewTaskMinutes] = useState(30);
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>(2);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const selectedDateObj = useMemo(() => parseLocalDateKey(selectedDate), [selectedDate]);
  const [miniMonthOffset, setMiniMonthOffset] = useState(0);

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

  const todayKey = formatLocalDate(new Date(), 0);
  const weekdayLabels =
    preferences.weekStartsOn === 1
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['日', '一', '二', '三', '四', '五', '六'];

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

  const unscheduledCount = tasks.filter((t) => !t.completed && !t.scheduledEventId).length;

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

  const handleSelectSet = (setId: CalendarSetId) => {
    setActiveCalendarSet(setId);
  };

  return (
    <aside
      data-testid="task-inbox-sidebar"
      className={`w-full lg:w-[292px] xl:w-[310px] shrink-0 flex flex-col gap-3.5 ${className}`}
    >
      {/* 1. Mini Month Calendar */}
      <section className="bento-glass-card p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-[var(--text-main)]">
            {displayMonthDate.getFullYear()} 年 {displayMonthDate.getMonth() + 1} 月
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMiniMonthOffset((o) => o - 1)}
              aria-label="上個月"
              className="p-1 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
            >
              <LucideIcon name="chevron-left" size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setMiniMonthOffset(0);
                setSelectedDate(todayKey);
              }}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
            >
              今
            </button>
            <button
              type="button"
              onClick={() => setMiniMonthOffset((o) => o + 1)}
              aria-label="下個月"
              className="p-1 rounded-lg hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
            >
              <LucideIcon name="chevron-right" size={14} />
            </button>
          </div>
        </div>

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
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setSidebarOpen(false);
                  }
                }}
                className={`relative h-7 rounded-lg text-[11px] font-semibold flex flex-col items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-sky-500 text-white'
                    : isToday
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-400/50'
                      : cell.inMonth
                        ? 'text-[var(--text-main)] hover:bg-[var(--surface-subtle)]'
                        : 'text-[var(--text-muted)] opacity-45 hover:opacity-75'
                }`}
              >
                <span>{cell.day}</span>
                {hasEvents && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-sky-500 absolute bottom-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Calendar Sets & Individual Calendars */}
      <section className="bento-glass-card p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
            <LucideIcon name="layers" size={14} className="text-sky-500" />
            <span>情境日曆組</span>
          </h2>
          <button
            type="button"
            data-testid="sidebar-manage-shared-btn"
            onClick={() => openModal('shared')}
            className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
          >
            <LucideIcon name="users" size={12} />
            <span>共享管理</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="情境日曆組切換">
          {CALENDAR_SET_META.map((setMeta) => {
            const active = preferences.activeCalendarSet === setMeta.id;
            return (
              <button
                key={setMeta.id}
                type="button"
                data-testid={`calendar-set-${setMeta.id}`}
                aria-pressed={active}
                onClick={() => handleSelectSet(setMeta.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                  active
                    ? 'bg-sky-500 text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <LucideIcon name={setMeta.icon} size={11} />
                <span>{setMeta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
          {calendars.map((cal) => {
            const palette = COLOR_TOKEN_PALETTE[cal.colorToken] || COLOR_TOKEN_PALETTE.sky;
            const visible = cal.visible !== false;
            return (
              <label
                key={cal.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--surface-subtle)] cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => toggleCalendarVisibility(cal.id)}
                    className="rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                  />
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dotClass}`} />
                  <span className="font-semibold text-[var(--text-main)] truncate">{cal.name}</span>
                </div>
                {cal.isShared && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-violet-500/15 text-violet-700 dark:text-violet-300 shrink-0">
                    共享
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      {/* 3. Draggable Task Inbox */}
      <section className="bento-glass-card p-3.5 space-y-3 flex-1 flex flex-col min-h-[260px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <LucideIcon name="inbox" size={15} className="text-amber-500" />
            <h2 className="text-xs font-extrabold text-[var(--text-main)]">待辦收件匣</h2>
            <span
              data-testid="inbox-unscheduled-count"
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300"
            >
              {unscheduledCount}
            </span>
          </div>
          <button
            type="button"
            data-testid="inbox-auto-schedule-btn"
            onClick={() => openModal('smart')}
            title="使用智慧助手將未排程待辦填入空檔"
            className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
          >
            <LucideIcon name="wand-sparkles" size={12} />
            <span>智慧排塊</span>
          </button>
        </div>

        {/* Quick Add Task Form */}
        <form onSubmit={handleAddTask} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              data-testid="inbox-add-task-input"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="新增待辦，拖入右側時間軸..."
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl text-xs bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              data-testid="inbox-add-task-btn"
              disabled={!newTaskTitle.trim()}
              aria-label="新增待辦"
              className="btn-sky-primary p-1.5 rounded-xl disabled:opacity-40"
            >
              <LucideIcon name="plus" size={14} />
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1">
              {[15, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNewTaskMinutes(m)}
                  className={`px-1.5 py-0.5 rounded-md font-mono font-semibold ${
                    newTaskMinutes === m
                      ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
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
                  className={`px-1.5 py-0.5 rounded-md font-bold ${
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

        {/* Task List */}
        <div className="space-y-1.5 overflow-y-auto max-h-[340px] pr-0.5">
          {visibleTasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)] space-y-1">
              <LucideIcon name="circle-check" size={20} className="mx-auto text-emerald-500 opacity-70" />
              <p>收件匣目前全數清空</p>
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
                  className={`group p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-sky-400/50 transition-colors cursor-grab active:cursor-grabbing ${
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
                          task.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'
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
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
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
                          className="p-1 rounded-lg hover:bg-sky-500/15 text-sky-600 dark:text-sky-400"
                        >
                          <LucideIcon name="calendar-plus" size={13} />
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

        <button
          type="button"
          onClick={() => setShowCompletedTasks((v) => !v)}
          className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] text-left"
        >
          {showCompletedTasks ? '隱藏已完成待辦' : '顯示已完成待辦'}
        </button>
      </section>
    </aside>
  );
}
