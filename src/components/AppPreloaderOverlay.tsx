import React, { useEffect, useState } from 'react';
import { LucideIcon, MeiScheduleLogo } from './BrandMark';
import {
  hasSessionPreloaded,
  isTestRuntime,
  runFullAppPreload,
  type PreloadProgressState
} from '../services/preloadEngine';

export interface AppPreloaderOverlayProps {
  hydrated: boolean;
  /** Skip full-screen splash on Electron #/tray route */
  disabled?: boolean;
  /** Force render splash even during Vitest tests when explicitly testing preloader UX */
  forceActiveInTest?: boolean;
}

/**
 * 方案 2（智慧混合啟動預載引擎）視覺元件：
 * - 首次開啟分頁：呈現極速品牌啟動預載畫面（Time Blocks 實心圖示 + 分段預載進度條），完成後柔緩淡出。
 * - 同分頁重整／已預載回訪：0 秒直達主畫面，僅於背景靜默補齊並在角落短暫顯示精巧完成膠囊。
 */
export const AppPreloaderOverlay = React.memo(function AppPreloaderOverlay({
  hydrated,
  disabled = false,
  forceActiveInTest = false
}: AppPreloaderOverlayProps) {
  const skipForTest = isTestRuntime() && !forceActiveInTest;
  const [isRevisit] = useState<boolean>(() => (skipForTest ? true : hasSessionPreloaded()));
  const [progress, setProgress] = useState<PreloadProgressState>({
    percent: 14,
    label: '正在準備本機排程與主題偏好...',
    done: false
  });
  const [splashPhase, setSplashPhase] = useState<'visible' | 'exiting' | 'gone'>(() =>
    disabled || skipForTest || isRevisit ? 'gone' : 'visible'
  );
  const [silentStatus, setSilentStatus] = useState<'hidden' | 'loading' | 'ready'>(() =>
    disabled || skipForTest ? 'hidden' : isRevisit ? 'loading' : 'hidden'
  );

  // Trigger eager preload immediately on entry (both first visit and revisit)
  useEffect(() => {
    if (disabled || skipForTest) return;
    let active = true;
    void runFullAppPreload((next) => {
      if (!active) return;
      setProgress(next);
    });
    return () => {
      active = false;
    };
  }, [disabled, skipForTest]);

  // First-visit smooth exit step 1: transition visible -> exiting once hydrated & preloaded
  useEffect(() => {
    if (splashPhase !== 'visible') return;
    if (!hydrated || !progress.done) return;

    const fadeTimer = setTimeout(() => {
      setSplashPhase('exiting');
    }, 180);

    return () => {
      clearTimeout(fadeTimer);
    };
  }, [splashPhase, hydrated, progress.done]);

  // First-visit smooth exit step 2: fully unmount overlay after 360ms fade-out
  useEffect(() => {
    if (splashPhase !== 'exiting') return;

    const removeTimer = setTimeout(() => {
      setSplashPhase('gone');
    }, 360);

    return () => {
      clearTimeout(removeTimer);
    };
  }, [splashPhase]);

  // Revisit silent pill lifecycle
  useEffect(() => {
    if (!isRevisit || disabled || skipForTest) return;
    if (!hydrated || !progress.done) return;

    setSilentStatus('ready');
    const hideTimer = setTimeout(() => {
      setSilentStatus('hidden');
    }, 1500);
    return () => clearTimeout(hideTimer);
  }, [isRevisit, disabled, skipForTest, hydrated, progress.done]);

  if (disabled || skipForTest) return null;

  return (
    <>
      {splashPhase !== 'gone' && (
        <div
          data-testid="app-preloader-overlay"
          data-preload-phase={splashPhase}
          role="status"
          aria-live="polite"
          className={`fixed inset-0 z-[60] sky-ambient-bg flex flex-col items-center justify-center px-6 transition-all duration-[350ms] ease-out ${
            splashPhase === 'exiting'
              ? 'opacity-0 scale-[1.02] pointer-events-none'
              : 'opacity-100 scale-100'
          }`}
        >
          <div className="flex flex-col items-center gap-4 max-w-xs w-full text-center">
            <div className="preloader-logo-breath">
              <MeiScheduleLogo size="xl" variant="solid" />
            </div>

            <div className="space-y-1">
              <div className="font-heading-lg text-xl font-extrabold tracking-tight text-[var(--text-main)]">
                咩時光 MeiSchedule
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                正在預先加載全功能視角與排程快取...
              </p>
            </div>

            <div className="w-full h-1.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-subtle)] overflow-hidden">
              <div
                data-testid="app-preloader-progress-bar"
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(12, Math.min(100, progress.percent))}%` }}
              />
            </div>

            <div
              data-testid="app-preloader-status"
              className="text-[11px] font-semibold text-[var(--text-muted)] min-h-[16px]"
            >
              {progress.label}
            </div>
          </div>
        </div>
      )}

      {isRevisit && silentStatus !== 'hidden' && (
        <div
          data-testid="silent-preload-indicator"
          role="status"
          aria-live="polite"
          className="fixed right-4 bottom-20 sm:bottom-6 z-40 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-100/95 dark:bg-sky-950/95 text-slate-900 dark:text-white border border-sky-300/80 dark:border-sky-400/40 shadow-md text-[11px] font-semibold pointer-events-none toast-spring-enter"
        >
          <LucideIcon
            name={silentStatus === 'ready' ? 'circle-check' : 'loader-2'}
            size={13}
            className={
              silentStatus === 'ready'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-sky-600 dark:text-sky-400 animate-spin'
            }
          />
          <span>
            {silentStatus === 'ready' ? '全站視角與彈窗預載就緒' : '背景靜默預熱資源中...'}
          </span>
        </div>
      )}
    </>
  );
});

export interface ThemeCrossfadeVeilProps {
  transitionState: {
    key: number;
    kind: 'theme' | 'color-mode';
    targetMode: 'light' | 'dark';
  } | null;
}

/**
 * 風格 B 電影交叉淡融環境柔霧層：
 * 於深淺模式慢速切換 (680ms) 時以純 GPU opacity 柔和過渡，消除視覺突兀閃白／閃黑。
 */
export const ThemeCrossfadeVeil = React.memo(function ThemeCrossfadeVeil({
  transitionState
}: ThemeCrossfadeVeilProps) {
  if (!transitionState) return null;

  const isColorMode = transitionState.kind === 'color-mode';
  const bgStyle =
    transitionState.targetMode === 'dark'
      ? 'radial-gradient(circle at 50% 35%, rgba(15, 23, 42, 0.36), rgba(8, 14, 26, 0.56))'
      : 'radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.42), rgba(240, 249, 255, 0.30))';

  return (
    <div
      key={transitionState.key}
      data-testid="theme-crossfade-veil"
      data-transition-kind={transitionState.kind}
      aria-hidden="true"
      className={
        isColorMode
          ? 'theme-crossfade-veil theme-crossfade-veil-slow'
          : 'theme-crossfade-veil theme-crossfade-veil-fast'
      }
      style={{ background: bgStyle }}
    />
  );
});

export default AppPreloaderOverlay;
