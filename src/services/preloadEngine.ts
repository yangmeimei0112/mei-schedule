import type { ComponentType } from 'react';

// ============================================================================
// MeiSchedule v1.3.0 — Entry Preload Engine & Transition Timing Constants
// ============================================================================

export const PRELOAD_SESSION_KEY = 'mei_schedule_preloaded_v1';
export const THEME_BOOT_STORAGE_KEY = 'mei_schedule_theme_boot_v1';

/** General 3-theme cross-dissolve transition duration (ms) */
export const THEME_TRANSITION_MS = 450;

/** Deliberately slower, serene sunrise/sunset cross-dissolve for Light <-> Dark swaps (ms) */
export const COLOR_MODE_TRANSITION_MS = 680;

/** Mobile fallback CSS transition durations (snappy, zero-jank on mid-tier mobile GPUs) */
export const MOBILE_THEME_TRANSITION_MS = 240;
export const MOBILE_COLOR_MODE_TRANSITION_MS = 300;

/** Hardware-composited View Transitions API durations (ms) */
export const VIEW_TRANSITION_THEME_MS = 260;
export const VIEW_TRANSITION_COLOR_MODE_MS = 320;

export interface PreloadProgressState {
  percent: number;
  label: string;
  done: boolean;
}

type ModuleLoader<T extends ComponentType<any>> = () => Promise<{ default: T }>;

function createCachedLoader<T extends ComponentType<any>>(
  factory: ModuleLoader<T>
): ModuleLoader<T> {
  let promise: Promise<{ default: T }> | null = null;
  return () => {
    if (!promise) {
      promise = factory();
    }
    return promise;
  };
}

// Singleton lazy module loaders shared by React.lazy AND eager startup preloader
export const lazyModalLoaders = {
  EventDetailDrawer: createCachedLoader(() => import('../components/EventDetailDrawer')),
  FocusTimerModal: createCachedLoader(() => import('../components/FocusTimerModal')),
  AnalyticsDashboard: createCachedLoader(() => import('../components/AnalyticsDashboard')),
  SmartRescheduleDrawer: createCachedLoader(() => import('../components/SmartRescheduleDrawer')),
  SharedCalendarModal: createCachedLoader(() => import('../components/SharedCalendarModal')),
  CalendarSyncModal: createCachedLoader(() => import('../components/CalendarSyncModal')),
  AppearanceSettingsModal: createCachedLoader(() => import('../components/AppearanceSettingsModal')),
  CommandPalette: createCachedLoader(() => import('../components/CommandPalette')),
  MemberPortalModal: createCachedLoader(() => import('../components/MemberPortalModal')),
  DesktopTrayWidget: createCachedLoader(() => import('../components/DesktopTrayWidget'))
};

export function isTestRuntime(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') {
      return true;
    }
  } catch {
    // Ignore
  }
  if (typeof process !== 'undefined' && process.env?.VITEST) {
    return true;
  }
  return false;
}

export function hasSessionPreloaded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage?.getItem(PRELOAD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSessionPreloaded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(PRELOAD_SESSION_KEY, '1');
  } catch {
    // Ignore restricted storage environments (SecurityError)
  }
}

function warmUpStaticAsset(url: string): Promise<void> {
  if (typeof window === 'undefined' || typeof Image === 'undefined' || isTestRuntime()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(), 250);
    img.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    img.src = url;
  });
}

function waitFontsWithCap(maxWaitMs = 360): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document) || isTestRuntime()) {
    return Promise.resolve();
  }
  return Promise.race([
    document.fonts.ready.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs))
  ]);
}

let activePreloadPromise: Promise<void> | null = null;

/**
 * Eagerly preloads ALL modal/drawer chunks, tray widget chunk, brand SVG assets,
 * and fonts right after app entry so subsequent interactions have 0ms chunk latency.
 */
export function runFullAppPreload(
  onProgress?: (state: PreloadProgressState) => void
): Promise<void> {
  if (activePreloadPromise) {
    return activePreloadPromise.then(() => {
      onProgress?.({ percent: 100, label: '全部資源已預載完成', done: true });
    });
  }

  activePreloadPromise = (async () => {
    onProgress?.({ percent: 24, label: '1/3 正在預載專注、統計與智慧排程模組...', done: false });

    await Promise.allSettled([
      lazyModalLoaders.EventDetailDrawer(),
      lazyModalLoaders.FocusTimerModal(),
      lazyModalLoaders.AnalyticsDashboard(),
      lazyModalLoaders.SmartRescheduleDrawer(),
      lazyModalLoaders.CommandPalette()
    ]);

    onProgress?.({ percent: 64, label: '2/3 正在預載共享日曆、同步與會員模組...', done: false });

    await Promise.allSettled([
      lazyModalLoaders.SharedCalendarModal(),
      lazyModalLoaders.CalendarSyncModal(),
      lazyModalLoaders.AppearanceSettingsModal(),
      lazyModalLoaders.MemberPortalModal(),
      lazyModalLoaders.DesktopTrayWidget(),
      warmUpStaticAsset('/favicon.svg'),
      warmUpStaticAsset('/pwa-maskable.svg')
    ]);

    onProgress?.({ percent: 88, label: '3/3 正在完成字體與 60 天排程快取預熱...', done: false });

    await waitFontsWithCap(360);

    markSessionPreloaded();
    onProgress?.({ percent: 100, label: '全部就緒，絲滑進入咩時光', done: true });
  })();

  return activePreloadPromise;
}

/** Reset singleton preload cache (strictly for deterministic unit tests) */
export function __resetPreloadEngineForTests(): void {
  activePreloadPromise = null;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.removeItem(PRELOAD_SESSION_KEY);
    } catch {
      // Ignore
    }
  }
}
