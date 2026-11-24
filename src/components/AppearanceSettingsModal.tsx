import React from 'react';
import { LucideIcon, MeiScheduleLogo } from './BrandMark';
import { DESIGN_THEME_OPTIONS } from '../data/seedData';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ColorMode, DesignTheme } from '../types/schedule';

export default function AppearanceSettingsModal() {
  const { activeModal, closeModal, preferences, updatePreferences, showToast } = useScheduleStore();

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
            <LucideIcon name="palette" size={20} className="text-sky-500" />
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
                      ? 'border-sky-500 ring-2 ring-sky-400/40 bg-sky-500/8'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] hover:border-sky-400/50'
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
                      {active && <LucideIcon name="circle-check" size={15} className="text-sky-500" />}
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
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-[var(--surface-subtle)] border-[var(--border-subtle)] text-[var(--text-main)]'
                  }`}
                >
                  <LucideIcon name={icon} size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Work Window & Default Event Duration */}
        <section className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-3">
          <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
            <LucideIcon name="sliders-horizontal" size={14} className="text-sky-500" />
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
        </section>

        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <div className="inline-flex items-center gap-2">
            <MeiScheduleLogo size="xs" />
            <span className="font-semibold text-[var(--text-main)]">咩時光 MeiSchedule</span>
          </div>
          <span
            data-testid="app-version-badge"
            className="font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/25"
          >
            v1.2.0
          </span>
        </div>
      </div>
    </div>
  );
}
