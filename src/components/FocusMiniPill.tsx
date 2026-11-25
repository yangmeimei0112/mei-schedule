import React from 'react';
import { LucideIcon } from './BrandMark';
import { useFocusSession } from '../store/FocusSessionContext';
import { useScheduleStore } from '../store/useScheduleStore';

/**
 * Compact header/bar background Focus & Light Music indicator pill:
 * Visible ONLY when FocusTimerModal is closed while timer or music is running.
 * Displays live countdown, 1-tap mute/unmute, and 1-tap restore modal.
 */
export const FocusMiniPill = React.memo(function FocusMiniPill() {
  const { activeModal, openModal } = useScheduleStore();
  const { isRunning, remainingSeconds, audio, toggleMute } = useFocusSession();

  if (activeModal === 'focus') return null;
  if (!isRunning && !audio.isPlaying) return null;

  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <div
      data-testid="focus-mini-pill"
      className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full theme-accent-soft border shadow-sm shrink-0"
    >
      <button
        type="button"
        data-testid="focus-mini-reopen-btn"
        onClick={() => openModal('focus')}
        aria-label="展開專注番茄鐘"
        title="背景專注中，點擊回到專注番茄鐘"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold hover:opacity-85 transition-opacity"
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isRunning ? 'theme-accent-dot animate-pulse' : 'bg-emerald-500'
          }`}
        />
        {isRunning ? (
          <span data-testid="focus-mini-time" className="font-mono font-extrabold tabular-nums">
            {mins}:{secs}
          </span>
        ) : (
          <LucideIcon name="music" size={12} className="theme-accent-text" />
        )}
        <span className="hidden md:inline text-[10px] font-semibold opacity-90">
          {isRunning ? '專注中' : '輕音樂'}
        </span>
      </button>

      <button
        type="button"
        data-testid="focus-mini-mute-btn"
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        aria-label={audio.isMuted ? '取消靜音' : '靜音輕音樂'}
        title={audio.isMuted ? '取消靜音' : '快速靜音'}
        className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-[var(--surface-glass)] hover:bg-[var(--accent-soft-hover)] theme-accent-deep transition-colors"
      >
        <LucideIcon name={audio.isMuted ? 'volume-x' : 'volume-2'} size={12} />
      </button>
    </div>
  );
});

export default FocusMiniPill;
