import React, { useRef } from 'react';
import { LucideIcon } from './BrandMark';
import {
  FOCUS_AMBIENT_OPTIONS,
  FOCUS_TRACK_OPTIONS
} from '../services/focusAudioEngine';
import { useFocusSession } from '../store/FocusSessionContext';
import { useScheduleStore } from '../store/useScheduleStore';

const PRESET_DURATIONS = [
  { label: '經典番茄 25m', minutes: 25 },
  { label: '深度心流 50m', minutes: 50 },
  { label: '短暫衝刺 15m', minutes: 15 },
  { label: '短休息 5m', minutes: 5 }
];

export default function FocusTimerModal() {
  const { activeModal, closeModal } = useScheduleStore();
  const {
    plannedMinutes,
    remainingSeconds,
    isRunning,
    categoryTag,
    targetTitle,
    audio,
    selectPreset,
    toggleRun,
    resetTimer,
    completeNow,
    selectTrack,
    selectAmbient,
    setMusicVolume,
    setAmbientVolume,
    toggleMute,
    toggleAudioPlay,
    setAutoSync,
    setChimeEnabled,
    loadLocalAudioFile,
    clearLocalAudioFile,
    previewChime
  } = useFocusSession();

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (activeModal !== 'focus') return null;

  const totalSeconds = plannedMinutes * 60;
  const progressRatio = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progressRatio);

  const minsDisplay = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secsDisplay = String(remainingSeconds % 60).padStart(2, '0');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadLocalAudioFile(file);
    }
    e.target.value = '';
  };

  return (
    <div
      data-testid="focus-timer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/55 backdrop-blur-md"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="專注番茄鐘計時器"
        onClick={(e) => e.stopPropagation()}
        className="landscape-compact-modal max-h-dvh-90 overflow-y-auto w-full max-w-lg bento-glass-card p-5 sm:p-6 space-y-4 text-center"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--text-main)]">
            <LucideIcon name="timer" size={18} className="theme-accent-text" />
            <span>咩時光專注番茄鐘</span>
          </div>
          <div className="flex items-center gap-1.5">
            {(isRunning || audio.isPlaying) && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold theme-accent-soft border">
                關閉後持續背景運作
              </span>
            )}
            <button
              type="button"
              onClick={closeModal}
              aria-label="關閉番茄鐘"
              className="p-1.5 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
            >
              <LucideIcon name="x" size={18} />
            </button>
          </div>
        </div>

        {/* Target Event Label */}
        <div className="space-y-0.5">
          <p className="text-[11px] text-[var(--text-muted)]">目前專注目標</p>
          <p className="text-sm sm:text-base font-extrabold text-[var(--text-main)] schedule-title-wrap">
            {targetTitle ? targetTitle : `自由專注（#${categoryTag}）`}
          </p>
        </div>

        {/* Circular SVG Progress Ring */}
        <div className="relative inline-flex items-center justify-center">
          <svg width="184" height="184" viewBox="0 0 184 184" className="-rotate-90">
            <circle
              cx="92"
              cy="92"
              r={radius}
              fill="none"
              stroke="var(--accent-soft-bg)"
              strokeWidth="9"
            />
            <circle
              cx="92"
              cy="92"
              r={radius}
              fill="none"
              stroke="url(#focusGradient)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent-primary)" />
                <stop offset="100%" stopColor="var(--accent-hover)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              data-testid="focus-timer-display"
              className="font-mono text-4xl font-extrabold tracking-tight text-[var(--text-main)] tabular-nums"
            >
              {minsDisplay}:{secsDisplay}
            </span>
            <span className="text-[11px] font-semibold text-[var(--text-muted)] mt-1">
              {isRunning ? '專注進行中' : '準備就緒'}
            </span>
          </div>
        </div>

        {/* Presets */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {PRESET_DURATIONS.map((preset) => (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => selectPreset(preset.minutes)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                plannedMinutes === preset.minutes
                  ? 'theme-accent-solid'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Primary Timer Controls */}
        <div className="flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={resetTimer}
            className="btn-sky-secondary px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <LucideIcon name="rotate-ccw" size={14} />
            <span>重設</span>
          </button>

          <button
            type="button"
            data-testid="focus-timer-toggle-btn"
            onClick={toggleRun}
            className="btn-sky-primary px-5 sm:px-6 py-2.5 rounded-xl text-sm font-extrabold inline-flex items-center gap-1.5"
          >
            <LucideIcon name={isRunning ? 'pause' : 'play'} size={16} />
            <span>{isRunning ? '暫停' : '開始專注'}</span>
          </button>

          <button
            type="button"
            data-testid="focus-complete-record-btn"
            onClick={() => completeNow(true)}
            className="px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25 inline-flex items-center gap-1"
          >
            <LucideIcon name="circle-check" size={14} />
            <span>完成並紀錄</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* Royalty-Free Offline Light Music & Natural Ambient Dual-Track Bar */}
        {/* ================================================================= */}
        <section
          data-testid="focus-music-panel"
          className="text-left p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-subtle)]/90 border border-[var(--border-subtle)] space-y-3"
        >
          {/* Music Panel Header & Playback Controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg squircle-icon-badge inline-flex items-center justify-center shrink-0">
                <LucideIcon name="headphones" size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-[var(--text-main)] flex items-center gap-1.5">
                  <span>無版權輕音樂與環境音</span>
                  {audio.isPlaying && !audio.isMuted && (
                    <span
                      data-testid="focus-audio-live-badge"
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full theme-accent-soft"
                    >
                      播放中
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  100% 原創離線合成零版權疑慮，或匯入本機音檔循環播放
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="focus-audio-play-toggle-btn"
                onClick={toggleAudioPlay}
                aria-label={audio.isPlaying ? '暫停輕音樂' : '試聽輕音樂'}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 border transition-colors ${
                  audio.isPlaying
                    ? 'theme-accent-solid'
                    : 'bg-[var(--surface-glass)] text-[var(--text-main)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]'
                }`}
              >
                <LucideIcon name={audio.isPlaying ? 'pause' : 'play'} size={12} />
                <span>{audio.isPlaying ? '暫停' : '播放'}</span>
              </button>

              <button
                type="button"
                data-testid="focus-audio-mute-btn"
                onClick={toggleMute}
                aria-label={audio.isMuted ? '取消靜音' : '靜音'}
                title={audio.isMuted ? '取消靜音' : '靜音'}
                className="p-1.5 rounded-xl bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--accent-deep)] transition-colors"
              >
                <LucideIcon name={audio.isMuted ? 'volume-x' : 'volume-2'} size={14} />
              </button>
            </div>
          </div>

          {/* 4 Original Royalty-Free Light Music Tracks */}
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-1.5">
            {FOCUS_TRACK_OPTIONS.map((track) => {
              const active = audio.trackId === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  data-testid={`focus-track-${track.id}`}
                  aria-pressed={active}
                  onClick={() => selectTrack(track.id)}
                  className={`px-2.5 py-2 rounded-xl border text-left transition-colors flex items-center gap-2 min-w-0 ${
                    active
                      ? 'bg-[var(--accent-soft-bg)]/70 border-[var(--accent-primary)] text-[var(--text-main)]'
                      : 'bg-[var(--surface-glass)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <LucideIcon
                    name={track.icon}
                    size={14}
                    className={active ? 'theme-accent-text shrink-0' : 'shrink-0'}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold text-[var(--text-main)] schedule-title-wrap">
                      {track.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] whitespace-normal break-words leading-snug">
                      {track.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Local Audio File Import Slot (.mp3 / .wav / .m4a / .ogg) */}
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[var(--surface-glass)] border border-dashed border-[var(--border-subtle)]">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              data-testid="focus-local-audio-input"
              onChange={handleFileChange}
              className="hidden"
            />
            {audio.hasLocalFile && audio.localFileName ? (
              <>
                <button
                  type="button"
                  data-testid="focus-track-local-file"
                  onClick={() => selectTrack('local-file')}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                >
                  <LucideIcon
                    name="music"
                    size={13}
                    className={
                      audio.trackId === 'local-file'
                        ? 'theme-accent-text shrink-0'
                        : 'text-[var(--text-muted)] shrink-0'
                    }
                  />
                  <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
                    本機音檔：{audio.localFileName}
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[var(--surface-subtle)] text-[var(--text-main)] hover:text-[var(--accent-deep)]"
                  >
                    更換
                  </button>
                  <button
                    type="button"
                    data-testid="focus-clear-local-audio-btn"
                    onClick={clearLocalAudioFile}
                    aria-label="清除本機音檔"
                    className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-500"
                  >
                    <LucideIcon name="x" size={12} />
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                data-testid="focus-import-local-audio-btn"
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--accent-deep)] transition-colors"
              >
                <LucideIcon name="upload" size={13} />
                <span>匯入本機音檔 (.mp3 / .wav / .m4a，僅本機離線播放)</span>
              </button>
            )}
          </div>

          {/* Single-Layer Natural Ambient Soundscape Chips */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              自然環境音疊加（選配）
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {FOCUS_AMBIENT_OPTIONS.map((amb) => {
                const active = audio.ambientId === amb.id;
                return (
                  <button
                    key={amb.id}
                    type="button"
                    data-testid={`focus-ambient-${amb.id}`}
                    aria-pressed={active}
                    onClick={() => selectAmbient(amb.id)}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border inline-flex items-center justify-center gap-1 transition-colors ${
                      active
                        ? 'theme-accent-solid'
                        : 'bg-[var(--surface-glass)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <LucideIcon name={amb.icon} size={12} className="shrink-0" />
                    <span className="truncate">{amb.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual Independent Volume Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
            <label className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)]">
                <span>輕音樂音量</span>
                <span className="font-mono">{Math.round(audio.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                data-testid="focus-music-volume-slider"
                min={0}
                max={100}
                value={Math.round(audio.musicVolume * 100)}
                onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                aria-label="輕音樂音量"
                className="w-full theme-checkbox h-1.5 rounded-full cursor-pointer"
              />
            </label>

            <label className={`space-y-1 ${audio.ambientId === 'none' ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)]">
                <span>環境音音量</span>
                <span className="font-mono">{Math.round(audio.ambientVolume * 100)}%</span>
              </div>
              <input
                type="range"
                data-testid="focus-ambient-volume-slider"
                min={0}
                max={100}
                disabled={audio.ambientId === 'none'}
                value={Math.round(audio.ambientVolume * 100)}
                onChange={(e) => setAmbientVolume(Number(e.target.value) / 100)}
                aria-label="環境音音量"
                className="w-full theme-checkbox h-1.5 rounded-full cursor-pointer disabled:cursor-not-allowed"
              />
            </label>
          </div>

          {/* Auto-Sync & Completion Chime Toggles */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-[var(--border-subtle)] text-[11px]">
            <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-main)] cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="focus-autosync-toggle"
                checked={audio.autoSyncWithTimer}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="rounded border-[var(--border-subtle)] theme-checkbox"
              />
              <span>跟隨專注自動播放／暫停</span>
            </label>

            <div className="inline-flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-main)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="focus-chime-toggle"
                  checked={audio.chimeEnabled}
                  onChange={(e) => setChimeEnabled(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] theme-checkbox"
                />
                <span>完成提示音</span>
              </label>
              <button
                type="button"
                data-testid="focus-chime-preview-btn"
                onClick={previewChime}
                aria-label="試聽完成提示音"
                title="試聽療癒完成風鈴聲"
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[var(--surface-glass)] border border-[var(--border-subtle)] theme-accent-deep hover:border-[var(--border-hover)]"
              >
                試聽
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
