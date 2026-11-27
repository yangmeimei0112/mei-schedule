import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { triggerLightHaptic } from '../services/notificationBridge';

// ============================================================================
// Swipe-to-Delete Gesture Constants (60/120fps GPU translate3d)
// ============================================================================

/** Horizontal lock threshold in px before claiming gesture over vertical scroll */
export const SWIPE_LOCK_PX = 10;

/** Width (px) of the revealed rose-red delete pill when snapped open */
export const SWIPE_REVEAL_WIDTH = 88;

/** Minimum leftward drag (px) required on release to snap open instead of closing */
export const SWIPE_SNAP_OPEN_PX = 36;

/** Leftward drag fraction of card width required to arm full-swipe auto-delete */
export const SWIPE_DEEP_DELETE_RATIO = 0.65;

/** Gap (px) between the sliding card's right edge and the floating rose-red delete pill */
const REVEAL_PILL_GAP = 8;

interface SwipeRevealGroupContextValue {
  openSwipeId: string | null;
  setOpenSwipeId: React.Dispatch<React.SetStateAction<string | null>>;
}

const SwipeRevealGroupContext = createContext<SwipeRevealGroupContextValue | null>(null);

/**
 * Coordinates single-card exclusivity across a list of SwipeableEventCards:
 * - Only ONE card can remain revealed at a time.
 * - Tapping outside, pressing Escape, or starting vertical scroll snaps any revealed card closed.
 */
export const SwipeRevealGroup = React.memo(function SwipeRevealGroup({
  children
}: {
  children: React.ReactNode;
}) {
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

  useEffect(() => {
    if (!openSwipeId || typeof window === 'undefined') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenSwipeId(null);
      }
    };
    const onPointerDown = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const activeShell = target?.closest?.('[data-swipe-card-id]');
      if (activeShell?.getAttribute('data-swipe-card-id') === openSwipeId) {
        return;
      }
      setOpenSwipeId(null);
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, [openSwipeId]);

  const ctxValue = useMemo<SwipeRevealGroupContextValue>(
    () => ({ openSwipeId, setOpenSwipeId }),
    [openSwipeId]
  );

  return (
    <SwipeRevealGroupContext.Provider value={ctxValue}>
      {children}
    </SwipeRevealGroupContext.Provider>
  );
});

export interface SwipeableEventCardProps {
  /** Unique identifier per rendered occurrence (e.g. evt.instanceId) */
  swipeId: string;
  /** Stable key used for data-testid attributes (e.g. evt.masterEventId) */
  testIdKey?: string;
  /** Disable swipe gesture & delete button (e.g. shared calendar viewer-only permission) */
  disabled?: boolean;
  /** Border radius class matching the inner card so the floating rose pill harmonizes cleanly */
  radiusClass?: string;
  /** Invoked when user taps the revealed delete pill or releases past the 65% deep-swipe threshold */
  onDeleteRequest: () => void;
  deleteLabel?: string;
  armedLabel?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * High-performance two-stage swipe-to-delete card wrapper:
 * 1. Light swipe (>= 36px): snaps open at -88px revealing a floating rose-red "移除" button (0 red bleed-through behind translucent cards!).
 * 2. Deep swipe (>= 65% width): expands the rose pill seamlessly with haptic feedback and "放開移除" cue; releasing triggers immediate delete.
 * 3. Zero React re-renders while dragging: directly mutates GPU translate3d & pill width via DOM refs.
 */
function SwipeableEventCard({
  swipeId,
  testIdKey,
  disabled = false,
  radiusClass = 'rounded-2xl',
  onDeleteRequest,
  deleteLabel = '移除',
  armedLabel = '放開移除',
  className = '',
  children
}: SwipeableEventCardProps) {
  const groupCtx = useContext(SwipeRevealGroupContext);
  const [localOpen, setLocalOpen] = useState(false);
  const [isArmed, setIsArmed] = useState(false);

  const isRevealed = groupCtx ? groupCtx.openSwipeId === swipeId : localOpen;
  const setRevealed = useCallback(
    (next: boolean) => {
      if (groupCtx) {
        groupCtx.setOpenSwipeId((prev) => (next ? swipeId : prev === swipeId ? null : prev));
      } else {
        setLocalOpen(next);
      }
    },
    [groupCtx, swipeId]
  );

  const shellRef = useRef<HTMLDivElement>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const suppressClickUntilRef = useRef(0);

  const dragRef = useRef<{
    active: boolean;
    direction: 'none' | 'horizontal' | 'vertical';
    startX: number;
    startY: number;
    baseOffset: number;
    offset: number;
    cardWidth: number;
    hapticFired: boolean;
  }>({
    active: false,
    direction: 'none',
    startX: 0,
    startY: 0,
    baseOffset: 0,
    offset: 0,
    cardWidth: 320,
    hapticFired: false
  });

  const applyVisualOffset = useCallback((offsetPx: number, swiping: boolean) => {
    const fg = foregroundRef.current;
    const action = actionRef.current;
    const clamped = Math.max(0, offsetPx);

    if (fg) {
      fg.classList.toggle('is-swiping', swiping);
      fg.style.transform = clamped > 0.5 ? `translate3d(${-clamped}px, 0, 0)` : 'translate3d(0px, 0, 0)';
    }

    if (action) {
      action.classList.toggle('is-swiping', swiping);
      if (clamped <= 2) {
        action.style.width = '0px';
        action.style.opacity = '0';
        action.style.pointerEvents = 'none';
      } else {
        const pillWidth = Math.max(0, clamped - REVEAL_PILL_GAP);
        action.style.width = `${pillWidth}px`;
        action.style.opacity = String(Math.min(1, clamped / 26));
        action.style.pointerEvents = clamped >= SWIPE_SNAP_OPEN_PX ? 'auto' : 'none';
      }
    }
  }, []);

  // Sync resting visual position when revealed state changes externally (e.g. another card opens or outside click)
  useEffect(() => {
    if (dragRef.current.active && dragRef.current.direction === 'horizontal') return;
    if (disabled) {
      applyVisualOffset(0, false);
      setIsArmed(false);
      return;
    }
    const targetOffset = isRevealed ? SWIPE_REVEAL_WIDTH : 0;
    dragRef.current.offset = targetOffset;
    applyVisualOffset(targetOffset, false);
    if (!isRevealed) {
      setIsArmed(false);
    }
  }, [isRevealed, disabled, applyVisualOffset]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const measuredWidth = shellRef.current?.offsetWidth || 320;
    dragRef.current = {
      active: true,
      direction: 'none',
      startX: touch.clientX,
      startY: touch.clientY,
      baseOffset: isRevealed ? SWIPE_REVEAL_WIDTH : 0,
      offset: isRevealed ? SWIPE_REVEAL_WIDTH : 0,
      cardWidth: Math.max(200, measuredWidth),
      hapticFired: false
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || disabled || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - d.startX;
    const dy = touch.clientY - d.startY;

    if (d.direction === 'none') {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absY > SWIPE_LOCK_PX && absY > absX * 1.15) {
        d.direction = 'vertical';
        if (isRevealed) setRevealed(false);
        return;
      }
      if (absX >= SWIPE_LOCK_PX && absX >= absY) {
        // Only claim horizontal gesture if swiping left OR closing an already-revealed card
        if (dx < 0 || d.baseOffset > 0) {
          d.direction = 'horizontal';
          if (groupCtx && groupCtx.openSwipeId && groupCtx.openSwipeId !== swipeId) {
            groupCtx.setOpenSwipeId(null);
          }
        } else {
          d.direction = 'vertical';
          return;
        }
      } else {
        return;
      }
    }

    if (d.direction !== 'horizontal') return;

    const nextOffset = Math.max(0, Math.min(d.cardWidth, d.baseOffset - dx));
    d.offset = nextOffset;
    applyVisualOffset(nextOffset, true);

    const deepThreshold = d.cardWidth * SWIPE_DEEP_DELETE_RATIO;
    const nowArmed = nextOffset >= deepThreshold;
    if (nowArmed && !d.hapticFired) {
      d.hapticFired = true;
      setIsArmed(true);
      void triggerLightHaptic();
    } else if (!nowArmed && d.hapticFired) {
      d.hapticFired = false;
      setIsArmed(false);
    }
  };

  const finishTouch = () => {
    const d = dragRef.current;
    if (!d.active) return;
    const wasHorizontal = d.direction === 'horizontal';
    const finalOffset = d.offset;
    const deepThreshold = d.cardWidth * SWIPE_DEEP_DELETE_RATIO;

    d.active = false;
    d.direction = 'none';
    d.hapticFired = false;

    if (!wasHorizontal) return;

    suppressClickUntilRef.current = Date.now() + 280;

    if (finalOffset >= deepThreshold) {
      // Deep-swipe auto-delete triggered!
      d.offset = 0;
      setIsArmed(false);
      setRevealed(false);
      applyVisualOffset(0, false);
      onDeleteRequest();
      return;
    }

    setIsArmed(false);

    if (finalOffset >= SWIPE_SNAP_OPEN_PX) {
      d.offset = SWIPE_REVEAL_WIDTH;
      applyVisualOffset(SWIPE_REVEAL_WIDTH, false);
      setRevealed(true);
    } else {
      d.offset = 0;
      applyVisualOffset(0, false);
      setRevealed(false);
    }
  };

  const handleForegroundClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isRevealed) {
      e.preventDefault();
      e.stopPropagation();
      setRevealed(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setRevealed(false);
    applyVisualOffset(0, false);
    onDeleteRequest();
  };

  const swipeState = isArmed ? 'armed' : isRevealed ? 'revealed' : 'closed';
  const keySlug = testIdKey || swipeId;

  return (
    <div
      ref={shellRef}
      data-testid={`swipe-card-${keySlug}`}
      data-swipe-card-id={swipeId}
      data-swipe-state={swipeState}
      className={`swipe-card-shell relative overflow-hidden ${radiusClass} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishTouch}
      onTouchCancel={finishTouch}
    >
      {/* Floating Rose-Red Reveal Pill (occupies ONLY exposed right slice -> 0% bleed-through behind translucent cards) */}
      {!disabled && (
        <div
          ref={actionRef}
          className={`swipe-delete-pill absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden ${radiusClass} ${
            isArmed ? 'swipe-delete-pill-armed' : ''
          }`}
          style={{ width: 0, opacity: 0, pointerEvents: 'none' }}
          aria-hidden={!isRevealed && !isArmed}
        >
          <button
            type="button"
            data-testid={`swipe-delete-btn-${keySlug}`}
            tabIndex={isRevealed ? 0 : -1}
            aria-label={`移除此行程`}
            onClick={handleDeleteClick}
            className="w-full h-full px-2 flex flex-col items-center justify-center gap-1 text-white font-bold select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <LucideIcon
              name="trash-2"
              size={isArmed ? 18 : 16}
              className={`shrink-0 transition-transform duration-150 ${isArmed ? 'scale-110' : ''}`}
            />
            <span className="text-[11px] leading-none whitespace-nowrap">
              {isArmed ? armedLabel : deleteLabel}
            </span>
          </button>
        </div>
      )}

      {/* Foreground Sliding Card (100% GPU translate3d) */}
      <div
        ref={foregroundRef}
        onClickCapture={handleForegroundClickCapture}
        className="swipe-card-foreground relative z-10"
      >
        {children}
      </div>
    </div>
  );
}

export default React.memo(SwipeableEventCard);
