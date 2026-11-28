import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type React from 'react';

export interface ThemeMotionConfig {
  ease: string;
  spring: string;
  durationFast: number;
  durationBase: number;
  durationSlow: number;
  burstScale: number;
  overshoot: number;
}

const THEME_MOTION_PRESETS: Record<string, ThemeMotionConfig> = {
  'sky-glass': {
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    spring: 'cubic-bezier(0.26, 1.24, 0.44, 1)',
    durationFast: 180,
    durationBase: 260,
    durationSlow: 340,
    burstScale: 1,
    overshoot: 1.045
  },
  'minimal-linear': {
    ease: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
    spring: 'cubic-bezier(0.22, 1.04, 0.36, 1)',
    durationFast: 140,
    durationBase: 200,
    durationSlow: 260,
    burstScale: 0.78,
    overshoot: 1.01
  },
  'warm-journal': {
    ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
    spring: 'cubic-bezier(0.28, 1.16, 0.42, 1)',
    durationFast: 200,
    durationBase: 290,
    durationSlow: 380,
    burstScale: 0.92,
    overshoot: 1.032
  }
};

/** Safe check for Vitest / jsdom environment so unit tests remain deterministic and instant. */
export function isTestRuntime(): boolean {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return true;
  }
  try {
    const meta = import.meta as unknown as { env?: { MODE?: string } };
    if (meta?.env?.MODE === 'test') return true;
  } catch {
    // Ignore non-Vite environments
  }
  return false;
}

/** Safe check for user prefers-reduced-motion: reduce (SSR & jsdom safe). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** True ONLY on desktop/fine-pointer hover devices with motion enabled (zero cost on mobile touch). */
export function canUseDesktopSpotlight(): boolean {
  if (isTestRuntime() || prefersReducedMotion()) return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

/** Reads active data-design-theme from <html> without subscribing React components to VisualThemeContext. */
export function getThemeMotionConfig(): ThemeMotionConfig {
  if (typeof document === 'undefined') {
    return THEME_MOTION_PRESETS['sky-glass'];
  }
  const activeTheme = document.documentElement.dataset.designTheme || 'sky-glass';
  return THEME_MOTION_PRESETS[activeTheme] || THEME_MOTION_PRESETS['sky-glass'];
}

/** Safe wrapper around Web Animations API (jsdom does not implement element.animate). */
export function safeAnimate(
  el: HTMLElement | SVGElement | null,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions
): Animation | null {
  if (!el || isTestRuntime() || prefersReducedMotion()) return null;
  if (typeof el.animate !== 'function') return null;
  try {
    return el.animate(keyframes, options);
  } catch {
    return null;
  }
}

/**
 * Closed-form framerate-independent damped spring (ported from ui-moments interaction.mjs).
 * Deterministically settles at t >= 0.48s; snaps immediately under reduced-motion or test runtime.
 */
export function springValue(
  from: number,
  to: number,
  velocity = 0,
  onUpdate?: (value: number) => void,
  onDone?: () => void
): () => void {
  if (isTestRuntime() || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
    onUpdate?.(to);
    onDone?.();
    return () => {};
  }

  const clampedVel = Math.max(-1100, Math.min(1100, velocity));
  const distance = from - to;
  if (Math.abs(distance) < 0.001 && Math.abs(clampedVel) < 0.001) {
    onUpdate?.(to);
    onDone?.();
    return () => {};
  }

  let rafId = 0;
  let cancelled = false;
  const startTime = performance.now();

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.max(0, (now - startTime) / 1000);
    if (t >= 0.48) {
      onUpdate?.(to);
      onDone?.();
      return;
    }
    const val =
      to +
      Math.exp(-15 * t) *
        (distance * Math.cos(13 * t) + ((clampedVel + 15 * distance) / 13) * Math.sin(13 * t));
    onUpdate?.(val);
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
}

/**
 * Backdrop Dismiss Guard (ui-moments #60):
 * - Prevents accidental modal dismissal when user starts dragging inside the dialog or drags >= 8px on backdrop.
 * - Preserves 100% compatibility with synchronous fireEvent.click(backdrop) in Vitest!
 */
export function useBackdropDismissGuard(onClose: () => void): {
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onPointerUp: React.PointerEventHandler<HTMLElement>;
  onClick: React.MouseEventHandler<HTMLElement>;
} {
  const gestureRef = useRef<{
    startedOnBackdrop: boolean;
    startX: number;
    startY: number;
    blockedNextClick: boolean;
  }>({
    startedOnBackdrop: false,
    startX: 0,
    startY: 0,
    blockedNextClick: false
  });

  const onPointerDown: React.PointerEventHandler<HTMLElement> = useCallback((e) => {
    const isBackdrop = e.target === e.currentTarget;
    gestureRef.current = {
      startedOnBackdrop: isBackdrop,
      startX: e.clientX,
      startY: e.clientY,
      blockedNextClick: !isBackdrop
    };
  }, []);

  const onPointerUp: React.PointerEventHandler<HTMLElement> = useCallback((e) => {
    const g = gestureRef.current;
    if (!g.startedOnBackdrop) {
      g.blockedNextClick = true;
      return;
    }
    const dist = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
    if (dist >= 8 || e.target !== e.currentTarget) {
      g.blockedNextClick = true;
    }
  }, []);

  const onClick: React.MouseEventHandler<HTMLElement> = useCallback(
    (e) => {
      const blocked = gestureRef.current.blockedNextClick;
      gestureRef.current.blockedNextClick = false;
      gestureRef.current.startedOnBackdrop = false;
      if (blocked) return;
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return { onPointerDown, onPointerUp, onClick };
}

/**
 * Desktop-only Specular Card Spotlight (ui-moments #55 `ui-card-light`):
 * - Strictly attaches ZERO listeners on mobile touch devices, reduced-motion, or test runtime.
 * - Uses single rAF coalescing and caches bounding rect (invalidated on scroll/resize).
 */
export function useCardSpotlight<T extends HTMLElement = HTMLDivElement>(): React.RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canUseDesktopSpotlight()) return;

    let rect: DOMRect | null = null;
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;

    const invalidateRect = () => {
      rect = null;
    };

    const flush = () => {
      rafId = 0;
      if (!rect) rect = el.getBoundingClientRect();
      el.style.setProperty('--um-spot-x', `${pendingX - rect.left}px`);
      el.style.setProperty('--um-spot-y', `${pendingY - rect.top}px`);
      el.setAttribute('data-spotlight-active', 'true');
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };

    const onPointerLeave = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      el.removeAttribute('data-spotlight-active');
    };

    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('resize', invalidateRect, { passive: true });
    window.addEventListener('scroll', invalidateRect, { passive: true, capture: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', invalidateRect);
      window.removeEventListener('scroll', invalidateRect, true);
    };
  }, []);

  return ref;
}

/**
 * Measures target's untransformed layout box relative to container.
 * Immune to ancestor CSS `transform: scale(...)` animations (e.g. `.um-modal-enter` 0.95 -> 1).
 */
function measureRelativeBox(
  container: HTMLElement,
  target: HTMLElement
): { x: number; y: number; w: number; h: number } | null {
  if (target.offsetParent === container && target.offsetWidth > 0 && target.offsetHeight > 0) {
    return {
      x: target.offsetLeft,
      y: target.offsetTop,
      w: target.offsetWidth,
      h: target.offsetHeight
    };
  }
  const cRect = container.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  if (tRect.width === 0 || tRect.height === 0) return null;
  const scaleX = container.offsetWidth > 0 && cRect.width > 0 ? cRect.width / container.offsetWidth : 1;
  const scaleY = container.offsetHeight > 0 && cRect.height > 0 ? cRect.height / container.offsetHeight : 1;
  return {
    x: (tRect.left - cRect.left) / scaleX + container.scrollLeft,
    y: (tRect.top - cRect.top) / scaleY + container.scrollTop,
    w: tRect.width / scaleX,
    h: tRect.height / scaleY
  };
}

/**
 * Elastic Category Tab Marker (ui-moments #56):
 * - Positions an active indicator pill inside a relative container using GPU `translate3d`.
 * - Runs a WAAPI FLIP glide with theme-adaptive elastic curve when activeKey changes.
 */
export function useElasticTabMarker(
  activeKey: string,
  deps: readonly unknown[] = []
): {
  containerRef: React.RefObject<HTMLDivElement>;
  indicatorRef: React.RefObject<HTMLSpanElement>;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const prevBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const activeAnimRef = useRef<Animation | null>(null);

  const measureAndPosition = useCallback((animate: boolean) => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    const target = container.querySelector<HTMLElement>('[data-um-tab-active="true"]');
    if (!target) {
      indicator.style.opacity = '0';
      container.removeAttribute('data-um-indicator-ready');
      return;
    }

    const next = measureRelativeBox(container, target);
    if (!next) {
      indicator.style.opacity = '0';
      container.removeAttribute('data-um-indicator-ready');
      return;
    }

    const prev = prevBoxRef.current;
    prevBoxRef.current = next;

    indicator.style.width = `${next.w}px`;
    indicator.style.height = `${next.h}px`;
    indicator.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    indicator.style.opacity = '1';
    container.setAttribute('data-um-indicator-ready', 'true');

    if (!animate || !prev || isTestRuntime() || prefersReducedMotion()) return;

    const dx = prev.x - next.x;
    const dy = prev.y - next.y;
    const sx = prev.w / Math.max(1, next.w);
    const sy = prev.h / Math.max(1, next.h);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01) return;

    activeAnimRef.current?.cancel();
    const cfg = getThemeMotionConfig();
    const midScaleX = Math.min(1.12, 1 + Math.abs(dx) / 900);
    activeAnimRef.current = safeAnimate(
      indicator,
      [
        { transform: `translate3d(${prev.x}px, ${prev.y}px, 0) scale(${sx}, ${sy})` },
        {
          offset: 0.48,
          transform: `translate3d(${next.x - dx * 0.08}px, ${next.y}px, 0) scale(${midScaleX}, 0.96)`
        },
        { transform: `translate3d(${next.x}px, ${next.y}px, 0) scale(1, 1)` }
      ],
      {
        duration: cfg.durationBase,
        easing: cfg.spring,
        fill: 'none'
      }
    );
  }, []);

  useLayoutEffect(() => {
    measureAndPosition(prevBoxRef.current !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, measureAndPosition, ...deps]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureAndPosition(false));
    ro.observe(container);
    return () => ro.disconnect();
  }, [measureAndPosition]);

  return { containerRef, indicatorRef };
}

/**
 * Plan Picker Gliding Selection Ring (ui-moments #30):
 * - Glides an accent outline ring across cards (e.g. 3 theme preview cards) with subtle arrival squash.
 * - Zero forced reflow (uses WAAPI), zero initial mount slide.
 */
export function usePlanPickerRing(activeKey: string): {
  containerRef: React.RefObject<HTMLDivElement>;
  ringRef: React.RefObject<HTMLDivElement>;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const prevBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const animRef = useRef<Animation | null>(null);

  const syncRing = useCallback((animate: boolean) => {
    const container = containerRef.current;
    const ring = ringRef.current;
    if (!container || !ring) return;

    const activeEl = container.querySelector<HTMLElement>('[data-um-plan-active="true"]');
    if (!activeEl) {
      ring.style.opacity = '0';
      return;
    }

    const next = measureRelativeBox(container, activeEl);
    if (!next) {
      ring.style.opacity = '0';
      return;
    }

    const prev = prevBoxRef.current;
    prevBoxRef.current = next;

    ring.style.width = `${next.w}px`;
    ring.style.height = `${next.h}px`;
    ring.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    ring.style.opacity = '1';

    if (!animate || !prev || isTestRuntime() || prefersReducedMotion()) return;
    const dx = prev.x - next.x;
    const dy = prev.y - next.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    animRef.current?.cancel();
    const cfg = getThemeMotionConfig();
    animRef.current = safeAnimate(
      ring,
      [
        {
          transform: `translate3d(${prev.x}px, ${prev.y}px, 0) scale(${prev.w / Math.max(1, next.w)}, ${prev.h / Math.max(1, next.h)})`
        },
        {
          offset: 0.55,
          transform: `translate3d(${next.x}px, ${next.y}px, 0) scale(${cfg.overshoot}, ${2 - cfg.overshoot})`
        },
        { transform: `translate3d(${next.x}px, ${next.y}px, 0) scale(1, 1)` }
      ],
      {
        duration: cfg.durationSlow,
        easing: cfg.spring,
        fill: 'none'
      }
    );
  }, []);

  useLayoutEffect(() => {
    syncRing(prevBoxRef.current !== null);
  }, [activeKey, syncRing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => syncRing(false));
    ro.observe(container);
    return () => ro.disconnect();
  }, [syncRing]);

  return { containerRef, ringRef };
}

/**
 * CommandPalette Active Row Gliding Pill (F14):
 * - Smooth GPU translate3d active row backdrop following ArrowUp/ArrowDown/hover focus.
 */
export function useActiveRowPill(
  activeIndex: number,
  itemCount: number
): {
  listRef: React.RefObject<HTMLDivElement>;
  pillRef: React.RefObject<HTMLDivElement>;
} {
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;

    if (itemCount <= 0 || activeIndex < 0) {
      pill.style.opacity = '0';
      return;
    }

    const row = list.querySelector<HTMLElement>(`[data-um-row-index="${activeIndex}"]`);
    if (!row) {
      pill.style.opacity = '0';
      return;
    }

    const y = row.offsetTop;
    const h = row.offsetHeight;
    if (h === 0) {
      pill.style.opacity = '0';
      return;
    }

    pill.style.height = `${h}px`;
    pill.style.transform = `translate3d(0, ${y}px, 0)`;
    pill.style.opacity = '1';
  }, [activeIndex, itemCount]);

  return { listRef, pillRef };
}
