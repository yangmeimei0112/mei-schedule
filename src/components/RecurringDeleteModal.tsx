import React, { useEffect } from 'react';
import { LucideIcon } from './BrandMark';
import { COLOR_TOKEN_PALETTE } from '../data/seedData';
import { describeRecurrenceRule } from '../services/recurrenceEngine';
import type { ExpandedEventInstance, RecurrenceEditScope } from '../types/schedule';

export interface RecurringDeleteModalProps {
  event: ExpandedEventInstance | null;
  onCancel: () => void;
  onConfirmScope: (scope: RecurrenceEditScope) => void;
}

/**
 * Compact mobile-first Bottom Sheet (centered dialog on desktop) triggered when
 * removing a recurring event via swipe-left or desktop hover delete button.
 */
function RecurringDeleteModal({
  event,
  onCancel,
  onConfirmScope
}: RecurringDeleteModalProps) {
  useEffect(() => {
    if (!event || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [event, onCancel]);

  if (!event) return null;

  const palette = COLOR_TOKEN_PALETTE[event.colorToken] || COLOR_TOKEN_PALETTE.sky;
  const ruleLabel = describeRecurrenceRule(event.recurrenceRule);

  return (
    <div
      data-testid="recurring-delete-modal"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-[4px] sm:backdrop-blur-md"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="選擇重複行程移除範圍"
        onClick={(e) => e.stopPropagation()}
        className="landscape-compact-modal max-h-dvh-85 w-full sm:max-w-md bg-[var(--surface-glass-strong)] border-t sm:border border-[var(--border-subtle)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col pb-safe-bottom sm:pb-0"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0">
              <LucideIcon name="trash-2" size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-[var(--text-main)] truncate">
                選擇移除範圍
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                此為重複排程，移除後皆可由底部通知一鍵復原
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="取消移除"
            className="p-1.5 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] shrink-0"
          >
            <LucideIcon name="x" size={17} />
          </button>
        </div>

        {/* Event Summary Pill */}
        <div className="px-5 pt-4">
          <div className="p-3 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] flex items-start gap-2.5">
            <span className={`w-2.5 h-2.5 mt-1 rounded-full shrink-0 ${palette.dotClass}`} />
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-extrabold text-[var(--text-main)] schedule-title-wrap">
                {event.title}
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-[var(--text-muted)]">
                <span className="font-mono font-semibold">{event.occurrenceDate}</span>
                {ruleLabel && (
                  <span className="inline-flex items-center gap-1">
                    <LucideIcon name="repeat" size={11} className="theme-accent-text" />
                    <span>{ruleLabel}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Three Scope Choices */}
        <div className="p-5 space-y-2">
          <button
            type="button"
            data-testid="recurring-delete-scope-single"
            onClick={() => onConfirmScope('single')}
            className="w-full px-3.5 py-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--accent-soft-bg)]/50 text-left flex items-start gap-3 transition-colors"
          >
            <LucideIcon name="calendar-days" size={16} className="theme-accent-text mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-extrabold text-[var(--text-main)]">
                僅移除這一天（{event.occurrenceDate}）
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                只移除當日此筆行程，其餘日期的重複排程維持不變
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="recurring-delete-scope-this_and_following"
            onClick={() => onConfirmScope('this_and_following')}
            className="w-full px-3.5 py-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--accent-soft-bg)]/50 text-left flex items-start gap-3 transition-colors"
          >
            <LucideIcon name="calendar-range" size={16} className="theme-accent-text mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-extrabold text-[var(--text-main)]">
                移除此筆與之後的所有排程
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                保留 {event.occurrenceDate} 之前的紀錄，並停止後續重複
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="recurring-delete-scope-all"
            onClick={() => onConfirmScope('all')}
            className="w-full px-3.5 py-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/18 text-left flex items-start gap-3 transition-colors"
          >
            <LucideIcon name="trash-2" size={16} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-extrabold text-rose-700 dark:text-rose-300">
                移除整個重複系列
              </div>
              <div className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                刪除這組重複排程的全部日期
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="recurring-delete-cancel-btn"
            onClick={onCancel}
            className="mt-1 w-full py-2.5 rounded-2xl btn-sky-secondary text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            <LucideIcon name="x" size={14} />
            <span>取消</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(RecurringDeleteModal);
