import React, { useEffect, useState } from 'react';
import { LucideIcon, MeiScheduleLogo } from './BrandMark';
import { DESIGN_THEME_OPTIONS } from '../data/seedData';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ColorMode, DesignTheme, StudioDockVisibilityMode } from '../types/schedule';

const DOCK_VISIBILITY_KEY = 'mei_studio_dock_visibility_v1';

function readCurrentDockMode(): StudioDockVisibilityMode {
  if (typeof window === 'undefined') return 'visible';
  if (window.MeiStudioDock?.getMode) {
    return window.MeiStudioDock.getMode();
  }
  try {
    const saved = window.localStorage?.getItem(DOCK_VISIBILITY_KEY);
    if (saved === 'visible' || saved === 'edge-hidden' || saved === 'completely-hidden') {
      return saved;
    }
  } catch {
    // Ignore restricted storage
  }
  return 'visible';
}

export default function AppearanceSettingsModal() {
  const { activeModal, closeModal, preferences, updatePreferences, showToast } = useScheduleStore();
  const [dockMode, setDockMode] = useState<StudioDockVisibilityMode>(readCurrentDockMode);

  useEffect(() => {
    if (activeModal !== 'appearance') return;
    setDockMode(readCurrentDockMode());

    const unsub = window.MeiStudioDock?.onModeChange?.((next) => {
      setDockMode(next);
    });
    const onCustomEvent = (evt: Event) => {
      const detail = (evt as CustomEvent<{ mode?: StudioDockVisibilityMode }>).detail;
      if (detail?.mode) setDockMode(detail.mode);
    };
    window.addEventListener('mei-dock-mode-change', onCustomEvent);
    return () => {
      unsub?.();
      window.removeEventListener('mei-dock-mode-change', onCustomEvent);
    };
  }, [activeModal]);

  if (activeModal !== 'appearance') return null;

  const handleSelectDesign = (theme: DesignTheme) => {
    updatePreferences({ designTheme: theme });
    const name = DESIGN_THEME_OPTIONS.find((t) => t.id === theme)?.name || theme;
    showToast(`已切換外觀風格：${name}`, { icon: 'palette' });
  };

  const handleSelectColorMode = (mode: ColorMode) => {
    updatePreferences({ colorMode: mode });
    const label = mode === 'dark' ? '深色模式' : mode === 'light' ? '亮色模式' : '跟隨系統';
    showToast(`色彩模式已切換為：${label}`, { icon: mode === 'dark' ? 'moon' : 'sun' });
  };

  const handleSelectDockMode = (mode: StudioDockVisibilityMode) => {
    if (window.MeiStudioDock?.setMode) {
      window.MeiStudioDock.setMode(mode);
    } else {
      try {
        window.localStorage?.setItem(DOCK_VISIBILITY_KEY, mode);
      } catch {
        // Ignore restricted storage
      }
    }
    setDockMode(mode);
    const toastMeta: Record<StudioDockVisibilityMode, { text: string; icon: string }> = {
      visible: { text: '已顯示「返回咩創意大廳」懸浮按鈕', icon: 'eye' },
      'edge-hidden': {
        text: '已收至螢幕邊緣微露拉條，點擊邊緣即可再展開',
        icon: 'panel-left-close'
      },
      'completely-hidden': {
        text: '已完全隱藏返回大廳按鈕，可於外觀設定或 Cmd/Ctrl+K 重新開啟',
        icon: 'eye-off'
      }
    };
    showToast(toastMeta[mode].text, { icon: toastMeta[mode].icon });
  };

  return (
    <div
      data-testid="appearance-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-md"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="外觀風格與排程偏好設定"
        onClick={(e) => e.stopPropagation()}
        className="landscape-compact-modal max-h-dvh-92 overflow-y-auto w-full max-w-2xl bento-glass-card p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LucideIcon name="palette" size={20} className="theme-accent-text" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-main)]">
                外觀風格切換器與個人偏好
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                三套設計語言 × 亮／深雙模式即時套用，同步記錄於跨裝置偏好設定
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="關閉外觀設定"
            className="p-2 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>

        {/* 1. Three Design Themes */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
            視覺設計風格（共 3 套）
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DESIGN_THEME_OPTIONS.map((opt) => {
              const active = preferences.designTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`modal-theme-card-${opt.id}`}
                  onClick={() => handleSelectDesign(opt.id)}
                  className={`p-3.5 rounded-2xl border text-left space-y-2.5 transition-all ${
                    active
                      ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-ring)] bg-[var(--accent-soft-bg)]/55'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  {/* Mini Visual Swatch */}
                  <div
                    className="h-14 rounded-xl p-2 border border-black/10 flex flex-col justify-between"
                    style={{ background: opt.previewBg }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: opt.previewAccent }}
                      />
                      <span className="h-1.5 w-12 rounded-full bg-slate-400/40" />
                    </div>
                    <div
                      className="h-5 rounded-md border border-black/5"
                      style={{ background: opt.previewCard }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-extrabold text-[var(--text-main)]">
                        {opt.name}
                      </span>
                      {active && <LucideIcon name="circle-check" size={15} className="theme-accent-text" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Light / Dark / System Mode */}
        <section className="space-y-2">
          <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
            色彩明暗模式
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['light', '亮色模式', 'sun'],
                ['dark', '深色模式', 'moon'],
                ['system', '跟隨系統', 'monitor']
              ] as Array<[ColorMode, string, string]>
            ).map(([modeId, label, icon]) => {
              const active = preferences.colorMode === modeId;
              return (
                <button
                  key={modeId}
                  type="button"
                  data-testid={`modal-colormode-${modeId}`}
                  onClick={() => handleSelectColorMode(modeId)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-colors ${
                    active
                      ? 'theme-accent-solid'
                      : 'bg-[var(--surface-subtle)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <LucideIcon name={icon} size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Studio Hub Return Dock Visibility (顯示 / 貼邊微露 / 完全隱藏) */}
        <section data-testid="dock-visibility-control" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
              返回咩創意大廳懸浮按鈕
            </h3>
            <span className="text-[11px] font-semibold theme-accent-deep">
              {dockMode === 'visible'
                ? '目前：顯示中'
                : dockMode === 'edge-hidden'
                  ? '目前：貼邊微露'
                  : '目前：完全隱藏'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['visible', '顯示膠囊', 'eye'],
                ['edge-hidden', '貼邊微露', 'panel-left-close'],
                ['completely-hidden', '完全隱藏', 'eye-off']
              ] as Array<[StudioDockVisibilityMode, string, string]>
            ).map(([modeId, label, icon]) => {
              const active = dockMode === modeId;
              return (
                <button
                  key={modeId}
                  type="button"
                  data-testid={`dock-mode-${modeId}`}
                  onClick={() => handleSelectDockMode(modeId)}
                  className={`py-2.5 px-2.5 sm:px-3 rounded-xl text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-colors ${
                    active
                      ? 'theme-accent-solid'
                      : 'bg-[var(--surface-subtle)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <LucideIcon name={icon} size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            選擇「貼邊微露」將退至螢幕邊緣僅留極細半透明拉條，點一下即可再展開；若選擇「完全隱藏」，可隨時回到此設定頁或按 Cmd/Ctrl + K 重新開啟。
          </p>
        </section>

        {/* 4. Work Window & Default Event Duration */}
        <section className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-3">
          <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
            <LucideIcon name="sliders-horizontal" size={14} className="theme-accent-text" />
            <span>智慧排程工作時段與預設偏好</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                工作開始小時
              </label>
              <input
                type="number"
                min={5}
                max={14}
                value={preferences.workStartHour}
                onChange={(e) =>
                  updatePreferences({
                    workStartHour: Math.max(5, Math.min(preferences.workEndHour - 1, Number(e.target.value) || 9))
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[var(--surface-glass)] border border-[var(--border-subtle)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                工作結束小時
              </label>
              <input
                type="number"
                min={12}
                max={23}
                value={preferences.workEndHour}
                onChange={(e) =>
                  updatePreferences({
                    workEndHour: Math.min(23, Math.max(preferences.workStartHour + 1, Number(e.target.value) || 18))
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[var(--surface-glass)] border border-[var(--border-subtle)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                預設時長 (分)
              </label>
              <select
                value={preferences.defaultEventMinutes}
                onChange={(e) => updatePreferences({ defaultEventMinutes: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[var(--surface-glass)] border border-[var(--border-subtle)]"
              >
                <option value={15}>15 分鐘</option>
                <option value={30}>30 分鐘</option>
                <option value={45}>45 分鐘</option>
                <option value={60}>60 分鐘</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                每週起始日
              </label>
              <select
                value={preferences.weekStartsOn}
                onChange={(e) => updatePreferences({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
                className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-[var(--surface-glass)] border border-[var(--border-subtle)]"
              >
                <option value={1}>週一開始</option>
                <option value={0}>週日開始</option>
              </select>
            </div>
          </div>

          {/* Site-Wide Auto-Wrap Titles Preference (Default ON) */}
          <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-[var(--text-main)]">
                行程與待辦標題自動換行（不截斷省略號）
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                開啟後於三日／週視圖、月總覽、時間軸與所有清單自動換行顯示完整標題，提升手機閱讀體驗。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.autoWrapTitles !== false}
              data-testid="toggle-auto-wrap-titles"
              onClick={() =>
                updatePreferences({ autoWrapTitles: preferences.autoWrapTitles === false })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                preferences.autoWrapTitles !== false
                  ? 'theme-accent-solid'
                  : 'bg-slate-300/80 dark:bg-slate-700 border-[var(--border-subtle)]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  preferences.autoWrapTitles !== false ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>

        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <div className="inline-flex items-center gap-2">
            <MeiScheduleLogo size="xs" />
            <span className="font-semibold text-[var(--text-main)]">咩時光 MeiSchedule</span>
          </div>
          <span
            data-testid="app-version-badge"
            className="font-mono font-bold px-2 py-0.5 rounded-full theme-accent-soft border"
          >
            v1.5.2
          </span>
        </div>
      </div>
    </div>
  );
}
