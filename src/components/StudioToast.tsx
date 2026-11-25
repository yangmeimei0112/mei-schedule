import React from 'react';
import { LucideIcon } from './BrandMark';

export interface StudioToastPayload {
  id?: string;
  message: string;
  icon?: string;
  actionLabel?: string;
  undoEntryId?: string;
  onAction?: () => void;
  isExiting?: boolean;
  timestamp?: number;
}

export interface StudioToastProps {
  toast: StudioToastPayload | null;
  onDismiss: () => void;
  /** Default true so mobile FAB, bottom nav, and mei-dock never overlap the toast */
  elevated?: boolean;
}

/**
 * 咩創意工作室高對比淡藍狀態通知膠囊 (AGENTS.md Rule 2)
 * - Light: bg-sky-100/95 text-slate-900 border-sky-300/80
 * - Dark:  dark:bg-sky-950/95 dark:text-white dark:border-sky-400/40
 * - Mobile anti-overlap: bottom-36 sm:bottom-24 + max-w-[calc(100vw-2rem)]
 */
export function StudioToast({ toast, onDismiss, elevated = true }: StudioToastProps) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="studio-toast"
      onClick={onDismiss}
      title="點擊關閉通知"
      className={`fixed ${
        elevated
          ? 'bottom-36 sm:bottom-24 md:bottom-24 max-md:bottom-36'
          : 'bottom-20 md:bottom-6'
      } left-4 right-4 sm:left-auto sm:right-6 mx-auto w-fit max-w-[calc(100vw-2rem)] sm:max-w-md z-50 inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-sky-100/95 dark:bg-sky-950/95 text-slate-900 dark:text-white border border-sky-300/80 dark:border-sky-400/40 shadow-xl shadow-sky-950/10 dark:shadow-sky-950/50 backdrop-blur-md sm:backdrop-blur-xl text-xs font-semibold select-none cursor-pointer ${
        toast.isExiting ? 'toast-slide-exit' : 'toast-spring-enter'
      }`}
    >
      <span
        key={`toast-icon-${toast.icon || 'circle-check'}-${toast.timestamp || 0}`}
        className="toast-content-fade flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0"
      >
        <LucideIcon name={toast.icon || 'circle-check'} size={16} />
      </span>
      <span
        key={`toast-msg-${toast.message}-${toast.timestamp || 0}`}
        className="toast-content-fade tracking-wide break-words"
      >
        {toast.message}
      </span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          data-testid="studio-toast-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            toast.onAction?.();
            onDismiss();
          }}
          className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 text-[11px] font-bold shrink-0 transition-colors"
        >
          <LucideIcon name="undo-2" size={12} />
          <span>{toast.actionLabel}</span>
        </button>
      )}
      <button
        type="button"
        data-testid="studio-toast-close-btn"
        aria-label="關閉通知"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="ml-0.5 p-1 rounded-full hover:bg-sky-200/70 dark:hover:bg-sky-800/70 text-slate-700 dark:text-sky-200 shrink-0 transition-colors"
      >
        <LucideIcon name="x" size={14} />
      </button>
    </div>
  );
}

export default React.memo(StudioToast);
