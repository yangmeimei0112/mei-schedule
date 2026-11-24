import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { sendInstantNotification, triggerLightHaptic } from '../services/notificationBridge';
import { useScheduleStore } from '../store/useScheduleStore';

const PRESET_DURATIONS = [
  { label: '經典番茄 25m', minutes: 25 },
  { label: '深度心流 50m', minutes: 50 },
  { label: '短暫衝刺 15m', minutes: 15 },
  { label: '短休息 5m', minutes: 5 }
];

export default function FocusTimerModal() {
  const {
    activeModal,
    closeModal,
    events,
    focusTargetEventId,
    focusTargetTaskId,
    recordFocusSession
  } = useScheduleStore();

  const targetEvent = useMemo(
    () => events.find((e) => e.id === focusTargetEventId) || null,
    [events, focusTargetEventId]
  );

  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [categoryTag, setCategoryTag] = useState('工作');
  const startedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeModal !== 'focus') return;
    if (targetEvent) {
      const eventMins = Math.max(
        15,
        Math.min(120, Math.round((Date.parse(targetEvent.endAt) - Date.parse(targetEvent.startAt)) / 60_000))
      );
      setPlannedMinutes(eventMins);
      setRemainingSeconds(eventMins * 60);
      setCategoryTag(targetEvent.categoryTag || '工作');
    } else {
      setPlannedMinutes(25);
      setRemainingSeconds(25 * 60);
    }
    setIsRunning(false);
    startedAtRef.current = null;
  }, [activeModal, targetEvent]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          const nowIso = new Date().toISOString();
          recordFocusSession({
            eventId: focusTargetEventId,
            taskId: focusTargetTaskId,
            categoryTag,
            plannedMinutes,
            actualMinutes: plannedMinutes,
            completed: true,
            startedAt: startedAtRef.current || new Date(Date.now() - plannedMinutes * 60_000).toISOString(),
            endedAt: nowIso
          });
          void sendInstantNotification({
            title: '專注計時完成',
            body: `已完成 ${plannedMinutes} 分鐘專注（${targetEvent?.title || categoryTag}）`
          });
          void triggerLightHaptic();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, categoryTag, focusTargetEventId, focusTargetTaskId, plannedMinutes, recordFocusSession, targetEvent]);

  if (activeModal !== 'focus') return null;

  const totalSeconds = plannedMinutes * 60;
  const progressRatio = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progressRatio);

  const minsDisplay = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secsDisplay = String(remainingSeconds % 60).padStart(2, '0');

  const handleTogglePlay = () => {
    if (!isRunning && !startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
    }
    setIsRunning((r) => !r);
  };

  const handleSelectPreset = (minutes: number) => {
    setIsRunning(false);
    setPlannedMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    startedAtRef.current = null;
  };

  const handleCompleteNow = () => {
    setIsRunning(false);
    const elapsedMin = Math.max(
      1,
      Math.round((totalSeconds - remainingSeconds) / 60) || plannedMinutes
    );
    const nowIso = new Date().toISOString();
    recordFocusSession({
      eventId: focusTargetEventId,
      taskId: focusTargetTaskId,
      categoryTag,
      plannedMinutes,
      actualMinutes: elapsedMin,
      completed: true,
      startedAt: startedAtRef.current || new Date(Date.now() - elapsedMin * 60_000).toISOString(),
      endedAt: nowIso
    });
    void triggerLightHaptic();
    closeModal();
  };

  return (
    <div
      data-testid="focus-timer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-md"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="專注番茄鐘計時器"
        onClick={(e) => e.stopPropagation()}
        className="landscape-compact-modal max-h-dvh-90 overflow-y-auto w-full max-w-md bento-glass-card p-6 space-y-5 text-center"
      >
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--text-main)]">
            <LucideIcon name="timer" size={18} className="text-sky-500" />
            <span>咩時光專注番茄鐘</span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="關閉番茄鐘"
            className="p-1.5 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">目前專注目標</p>
          <p className="text-base font-extrabold text-[var(--text-main)] truncate">
            {targetEvent ? targetEvent.title : `自由專注（#${categoryTag}）`}
          </p>
        </div>

        {/* Circular SVG Progress Ring */}
        <div className="relative inline-flex items-center justify-center">
          <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-sky-500/15"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="url(#focusGradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              data-testid="focus-timer-display"
              className="font-mono text-4xl font-extrabold tracking-tight text-[var(--text-main)]"
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
              onClick={() => handleSelectPreset(preset.minutes)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                plannedMinutes === preset.minutes
                  ? 'bg-sky-500 text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              setIsRunning(false);
              setRemainingSeconds(plannedMinutes * 60);
              startedAtRef.current = null;
            }}
            className="btn-sky-secondary px-3.5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <LucideIcon name="rotate-ccw" size={15} />
            <span>重設</span>
          </button>

          <button
            type="button"
            data-testid="focus-timer-toggle-btn"
            onClick={handleTogglePlay}
            className="btn-sky-primary px-6 py-2.5 rounded-xl text-sm font-extrabold inline-flex items-center gap-1.5"
          >
            <LucideIcon name={isRunning ? 'pause' : 'play'} size={16} />
            <span>{isRunning ? '暫停' : '開始專注'}</span>
          </button>

          <button
            type="button"
            data-testid="focus-complete-record-btn"
            onClick={handleCompleteNow}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25 inline-flex items-center gap-1"
          >
            <LucideIcon name="circle-check" size={15} />
            <span>完成並紀錄</span>
          </button>
        </div>
      </div>
    </div>
  );
}
