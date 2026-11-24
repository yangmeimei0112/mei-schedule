import React, { useMemo } from 'react';
import { LucideIcon } from './BrandMark';
import { computeAnalyticsSummary } from '../services/smartScheduler';
import { useScheduleStore } from '../store/useScheduleStore';

export default function AnalyticsDashboard() {
  const { activeModal, closeModal, events, tasks, focusSessions, openModal } = useScheduleStore();

  const summary = useMemo(
    () => computeAnalyticsSummary(events, tasks, focusSessions),
    [events, tasks, focusSessions]
  );

  if (activeModal !== 'analytics') return null;

  const maxDayMinutes = Math.max(...summary.last7DaysFocus.map((d) => d.minutes), 30);

  return (
    <div
      data-testid="analytics-dashboard-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-md"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="時間統計與習慣儀表板"
        onClick={(e) => e.stopPropagation()}
        className="landscape-compact-modal max-h-dvh-92 overflow-y-auto w-full max-w-3xl bento-glass-card p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LucideIcon name="bar-chart-3" size={20} className="text-sky-500" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-main)]">
                時間統計與專注習慣儀表板
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                即時掌握專注節奏、連續達成天數與分類時間投入佔比
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="關閉統計儀表板"
            className="p-2 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="foldable-inner-grid grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>累計專注時長</span>
              <LucideIcon name="timer" size={15} className="text-sky-500" />
            </div>
            <div data-testid="analytics-total-focus" className="text-2xl font-extrabold font-mono text-[var(--text-main)]">
              {summary.totalFocusMinutes}m
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              今日 {summary.todayFocusMinutes}m · 共 {summary.totalSessions} 次
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>連續專注天數</span>
              <LucideIcon name="flame" size={15} className="text-amber-500" />
            </div>
            <div data-testid="analytics-streak-days" className="text-2xl font-extrabold font-mono text-[var(--text-main)]">
              {summary.streakDays} 天
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">持續累積心流節奏</div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>行程／待辦達成</span>
              <LucideIcon name="target" size={15} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-[var(--text-main)]">
              {summary.eventCompletionRate}%
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              待辦完成率 {summary.taskCompletionRate}% ({summary.completedTasksCount}/{summary.totalTasksCount})
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>提早釋放空檔</span>
              <LucideIcon name="zap" size={15} className="text-violet-500" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-[var(--text-main)]">
              {summary.releasedMinutesTotal}m
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">提前完成行程所賺回時間</div>
          </div>
        </div>

        {/* 7-Day Focus Trend Bar Chart */}
        <section className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
              <LucideIcon name="trending-up" size={15} className="text-sky-500" />
              <span>近 7 日每日專注趨勢（分鐘）</span>
            </h3>
            <button
              type="button"
              onClick={() => openModal('focus')}
              className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <LucideIcon name="play" size={12} />
              <span>立刻開始一輪番茄鐘</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-36 pt-4">
            {summary.last7DaysFocus.map((day) => {
              const heightPct = Math.max(8, Math.round((day.minutes / maxDayMinutes) * 100));
              return (
                <div key={day.dateKey} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-mono font-bold text-[var(--text-muted)]">
                    {day.minutes > 0 ? `${day.minutes}m` : ''}
                  </span>
                  <div className="w-full max-w-[36px] flex-1 flex items-end">
                    <div
                      style={{ height: `${day.minutes > 0 ? heightPct : 6}%` }}
                      className={`w-full rounded-t-xl transition-all ${
                        day.minutes > 0
                          ? 'bg-gradient-to-t from-sky-600 to-sky-400'
                          : 'bg-slate-300/40 dark:bg-slate-700/50'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{day.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Category Breakdown */}
        <section className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-3">
          <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
            <LucideIcon name="pie-chart" size={15} className="text-emerald-500" />
            <span>分類時間投入佔比</span>
          </h3>

          {summary.categoryBreakdown.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">尚無分類排程或專注紀錄。</p>
          ) : (
            <div className="space-y-2.5">
              {summary.categoryBreakdown.map((cat) => (
                <div key={cat.categoryTag} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-main)]">#{cat.categoryTag}</span>
                    <span className="font-mono text-[var(--text-muted)]">
                      排程 {cat.scheduledMinutes}m · 專注 {cat.focusMinutes}m ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, cat.percentage)}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
