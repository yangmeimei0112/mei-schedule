import React, { useEffect, useRef } from 'react';
import { LucideIcon } from './BrandMark';
import {
  getThemeMotionConfig,
  isTestRuntime,
  prefersReducedMotion,
  safeAnimate
} from '../utils/uiMomentsMotion';

// ============================================================================
// 1. OdometerNumber (ui-moments #4 — Directional GPU Vertical Digit Roll)
// ============================================================================

export interface OdometerNumberProps {
  value: number | string;
  className?: string;
  'data-testid'?: string;
  ariaLabel?: string;
}

export const OdometerNumber = React.memo(function OdometerNumber({
  value,
  className = '',
  'data-testid': testId,
  ariaLabel
}: OdometerNumberProps) {
  const strVal = String(value);
  const prevRef = useRef<string>(strVal);
  const digitRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = strVal;
    if (prev === strVal || isTestRuntime() || prefersReducedMotion()) return;

    const prevNum = Number(prev.replace(/[^\d.-]/g, ''));
    const nextNum = Number(strVal.replace(/[^\d.-]/g, ''));
    const direction = Number.isFinite(prevNum) && Number.isFinite(nextNum) && nextNum < prevNum ? -1 : 1;
    const cfg = getThemeMotionConfig();

    const maxLen = Math.max(prev.length, strVal.length);
    for (let i = 0; i < maxLen; i++) {
      const nextChar = strVal[i];
      const prevChar = prev[i];
      if (nextChar === prevChar) continue;
      const node = digitRefs.current[i];
      if (!node) continue;
      safeAnimate(
        node,
        [
          { transform: `translate3d(0, ${direction * 55}%, 0)`, opacity: 0.25 },
          { transform: 'translate3d(0, 0%, 0)', opacity: 1 }
        ],
        {
          duration: cfg.durationFast,
          easing: cfg.spring,
          fill: 'none'
        }
      );
    }
  }, [strVal]);

  return (
    <span
      data-testid={testId}
      aria-label={ariaLabel}
      className={`um-odometer inline-flex items-baseline overflow-hidden tabular-nums leading-none ${className}`}
    >
      {strVal.split('').map((ch, idx) => (
        <span
          key={idx}
          ref={(el) => {
            digitRefs.current[idx] = el;
          }}
          className="inline-block will-change-transform"
        >
          {ch}
        </span>
      ))}
    </span>
  );
});

// ============================================================================
// 2. CopyMorphButton (ui-moments #31 — Clipboard -> Checkmark Morph + Roll)
// ============================================================================

export interface CopyMorphButtonProps {
  copied: boolean;
  idleLabel: string;
  copiedLabel?: string;
  onClick: () => void;
  className?: string;
  'data-testid'?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const CopyMorphButton = React.memo(function CopyMorphButton({
  copied,
  idleLabel,
  copiedLabel = '已複製',
  onClick,
  className = '',
  'data-testid': testId,
  ariaLabel,
  size = 'sm',
  disabled = false
}: CopyMorphButtonProps) {
  const iconSize = size === 'sm' ? 12 : 14;
  return (
    <button
      type="button"
      disabled={disabled}
      data-testid={testId}
      data-copied={copied ? 'true' : 'false'}
      aria-label={ariaLabel || (copied ? copiedLabel : idleLabel)}
      onClick={onClick}
      className={`um-copy-morph relative inline-flex items-center justify-center gap-1.5 overflow-hidden select-none ${className}`}
    >
      <span className="um-copy-icon-stack relative inline-grid place-items-center shrink-0">
        <span className={`um-copy-icon-idle ${copied ? 'is-copied' : ''}`}>
          <LucideIcon name="copy" size={iconSize} />
        </span>
        <span className={`um-copy-icon-done ${copied ? 'is-copied' : ''}`}>
          <LucideIcon name="check" size={iconSize} />
        </span>
      </span>
      <span className="um-copy-label-stack relative inline-grid overflow-hidden">
        <span className={`um-copy-label-idle whitespace-nowrap ${copied ? 'is-copied' : ''}`}>
          {idleLabel}
        </span>
        <span
          aria-hidden={!copied}
          className={`um-copy-label-done whitespace-nowrap ${copied ? 'is-copied' : ''}`}
        >
          {copiedLabel}
        </span>
      </span>
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ''}
      </span>
    </button>
  );
});

// ============================================================================
// 3. PaperPlaneSendButton (ui-moments #33 — Pullback + Takeoff Micro-Flight)
// ============================================================================

export interface PaperPlaneSendButtonProps {
  type?: 'submit' | 'button';
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
  title?: string;
  ariaLabel?: string;
}

export const PaperPlaneSendButton = React.memo(function PaperPlaneSendButton({
  type = 'submit',
  disabled = false,
  label = '排入',
  onClick,
  className = '',
  'data-testid': testId,
  title,
  ariaLabel
}: PaperPlaneSendButtonProps) {
  const planeRef = useRef<HTMLSpanElement | null>(null);
  const animRef = useRef<Animation | null>(null);

  const triggerTakeoff = () => {
    const plane = planeRef.current;
    if (!plane || disabled) return;
    animRef.current?.cancel();
    const cfg = getThemeMotionConfig();
    animRef.current = safeAnimate(
      plane,
      [
        { transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1)', opacity: 1 },
        { offset: 0.22, transform: 'translate3d(-3px, 2px, 0) rotate(8deg) scale(0.95)', opacity: 1 },
        { offset: 0.56, transform: 'translate3d(18px, -14px, 0) rotate(-14deg) scale(0.6)', opacity: 0 },
        { offset: 0.58, transform: 'translate3d(-14px, 8px, 0) rotate(6deg) scale(0.75)', opacity: 0 },
        { transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1)', opacity: 1 }
      ],
      {
        duration: Math.max(320, cfg.durationSlow + 60),
        easing: cfg.ease,
        fill: 'none'
      }
    );
  };

  return (
    <button
      type={type}
      disabled={disabled}
      data-testid={testId}
      title={title}
      aria-label={ariaLabel || label}
      onClick={() => {
        triggerTakeoff();
        onClick?.();
      }}
      className={`um-paper-plane-btn inline-flex items-center justify-center gap-1.5 overflow-hidden ${className}`}
    >
      <span ref={planeRef} className="inline-flex items-center justify-center shrink-0 will-change-transform">
        <LucideIcon name="send" size={13} />
      </span>
      <span>{label}</span>
    </button>
  );
});

// ============================================================================
// 4. BellToggleButton (ui-moments #36 — Damped Pendulum Bell + Mute Slash)
// ============================================================================

export interface BellToggleButtonProps {
  active: boolean;
  badge?: string | number;
  label: string;
  onToggle: () => void;
  className?: string;
  'data-testid'?: string;
}

export const BellToggleButton = React.memo(function BellToggleButton({
  active,
  badge,
  label,
  onToggle,
  className = '',
  'data-testid': testId
}: BellToggleButtonProps) {
  const bellGroupRef = useRef<SVGGElement | null>(null);
  const clapperRef = useRef<SVGPathElement | null>(null);
  const prevActiveRef = useRef<boolean>(active);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;
    if (!active || wasActive || isTestRuntime() || prefersReducedMotion()) return;

    const cfg = getThemeMotionConfig();
    safeAnimate(
      bellGroupRef.current,
      [
        { transform: 'rotate(0deg)' },
        { offset: 0.16, transform: 'rotate(16deg)' },
        { offset: 0.34, transform: 'rotate(-13deg)' },
        { offset: 0.52, transform: 'rotate(9deg)' },
        { offset: 0.72, transform: 'rotate(-5deg)' },
        { offset: 0.88, transform: 'rotate(2deg)' },
        { transform: 'rotate(0deg)' }
      ],
      { duration: Math.min(620, cfg.durationSlow + 240), easing: 'ease-out' }
    );
    safeAnimate(
      clapperRef.current,
      [
        { transform: 'translateX(0px)' },
        { offset: 0.2, transform: 'translateX(-1.4px)' },
        { offset: 0.4, transform: 'translateX(1.2px)' },
        { offset: 0.62, transform: 'translateX(-0.8px)' },
        { transform: 'translateX(0px)' }
      ],
      { duration: Math.min(620, cfg.durationSlow + 240), delay: 35, easing: 'ease-out' }
    );
  }, [active]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      data-testid={testId}
      data-bell-active={active ? 'true' : 'false'}
      onClick={onToggle}
      className={`um-bell-toggle relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
        active
          ? 'theme-accent-soft border-[var(--accent-primary)]/45'
          : 'bg-[var(--surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]'
      } ${className}`}
    >
      <span className="relative inline-flex items-center justify-center w-4 h-4 shrink-0">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="overflow-visible"
        >
          <g ref={bellGroupRef} style={{ transformBox: 'view-box', transformOrigin: '12px 3px' }}>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path ref={clapperRef} d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </g>
          <line
            x1="3"
            y1="3"
            x2="21"
            y2="21"
            className={`um-bell-slash ${active ? 'is-active' : 'is-muted'}`}
          />
        </svg>
        {badge !== undefined && (
          <span
            className={`um-bell-badge absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-mono font-extrabold flex items-center justify-center theme-accent-solid ${
              active ? 'is-visible' : 'is-hidden'
            }`}
          >
            {badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </button>
  );
});

// ============================================================================
// 5. ClockHandsLoader (ui-moments #46 — Pure CSS Analog Clock Hands Loader)
// ============================================================================

export interface ClockHandsLoaderProps {
  size?: number;
  label?: string;
  className?: string;
  'data-testid'?: string;
}

export const ClockHandsLoader = React.memo(function ClockHandsLoader({
  size = 18,
  label = '同步處理中',
  className = '',
  'data-testid': testId
}: ClockHandsLoaderProps) {
  return (
    <span
      role="status"
      aria-label={label}
      data-testid={testId}
      className={`um-clock-hands inline-flex items-center justify-center relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="um-clock-face" />
      <span className="um-clock-tick um-clock-tick-1" />
      <span className="um-clock-tick um-clock-tick-2" />
      <span className="um-clock-tick um-clock-tick-3" />
      <span className="um-clock-tick um-clock-tick-4" />
      <span className="um-clock-hand-hour" />
      <span className="um-clock-hand-minute" />
      <span className="um-clock-pivot" />
    </span>
  );
});

// ============================================================================
// 6. BreathAura (ui-moments #24 — 3-Ring GPU Concentric Breathing Orb)
// ============================================================================

export interface BreathAuraProps {
  active: boolean;
  className?: string;
  'data-testid'?: string;
}

export const BreathAura = React.memo(function BreathAura({
  active,
  className = '',
  'data-testid': testId
}: BreathAuraProps) {
  return (
    <div
      data-testid={testId}
      data-breath-active={active ? 'true' : 'false'}
      aria-hidden="true"
      className={`um-breath-orb pointer-events-none absolute inset-0 flex items-center justify-center ${
        active ? 'is-active' : 'is-paused'
      } ${className}`}
    >
      <span className="um-breath-ring um-breath-ring-1" />
      <span className="um-breath-ring um-breath-ring-2" />
      <span className="um-breath-ring um-breath-ring-3" />
    </div>
  );
});

// ============================================================================
// 7. AudioLevelBars (ui-moments #48 — 3 GPU scaleY Mini Audio Equalizer Bars)
// ============================================================================

export interface AudioLevelBarsProps {
  active: boolean;
  compact?: boolean;
  className?: string;
  'data-testid'?: string;
}

export const AudioLevelBars = React.memo(function AudioLevelBars({
  active,
  compact = false,
  className = '',
  'data-testid': testId
}: AudioLevelBarsProps) {
  return (
    <span
      data-testid={testId}
      data-audio-active={active ? 'true' : 'false'}
      aria-hidden="true"
      className={`um-level-bars inline-flex items-end gap-[2px] shrink-0 ${
        compact ? 'h-3' : 'h-3.5'
      } ${active ? 'is-active' : 'is-paused'} ${className}`}
    >
      <i className="um-level-bar um-level-bar-1" />
      <i className="um-level-bar um-level-bar-2" />
      <i className="um-level-bar um-level-bar-3" />
    </span>
  );
});

// ============================================================================
// 8. LikeBurstLayer (ui-moments #32 — Discrete Restrained Celebration Sparks)
// ============================================================================

export interface LikeBurstLayerProps {
  triggerKey: number;
  className?: string;
  'data-testid'?: string;
}

const SPARK_ANGLES = [0, 60, 120, 180, 240, 300];

export const LikeBurstLayer = React.memo(function LikeBurstLayer({
  triggerKey,
  className = '',
  'data-testid': testId
}: LikeBurstLayerProps) {
  const ringRef = useRef<HTMLSpanElement | null>(null);
  const sparkRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const prevKeyRef = useRef<number>(triggerKey);

  useEffect(() => {
    if (triggerKey <= 0 || triggerKey === prevKeyRef.current) {
      prevKeyRef.current = triggerKey;
      return;
    }
    prevKeyRef.current = triggerKey;
    if (isTestRuntime() || prefersReducedMotion()) return;

    const cfg = getThemeMotionConfig();
    const scale = cfg.burstScale;
    const duration = Math.min(380, cfg.durationSlow + 30);

    safeAnimate(
      ringRef.current,
      [
        { transform: 'scale(0.35)', opacity: 0.85 },
        { transform: `scale(${(1.55 * scale).toFixed(2)})`, opacity: 0 }
      ],
      { duration, easing: cfg.ease, fill: 'none' }
    );

    SPARK_ANGLES.forEach((deg, idx) => {
      const el = sparkRefs.current[idx];
      if (!el) return;
      const rad = (deg * Math.PI) / 180;
      const dist = (idx % 2 === 0 ? 15 : 12) * scale;
      const tx = Math.cos(rad) * dist;
      const ty = Math.sin(rad) * dist;
      safeAnimate(
        el,
        [
          { transform: 'translate3d(0, 0, 0) scale(0.4)', opacity: 0.95 },
          { offset: 0.65, transform: `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(1)`, opacity: 0.9 },
          { transform: `translate3d(${(tx * 1.18).toFixed(1)}px, ${(ty * 1.18).toFixed(1)}px, 0) scale(0)`, opacity: 0 }
        ],
        { duration, delay: 25, easing: cfg.ease, fill: 'none' }
      );
    });
  }, [triggerKey]);

  return (
    <span
      data-testid={testId}
      data-burst-count={triggerKey}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible ${className}`}
    >
      <span
        ref={ringRef}
        className="absolute w-6 h-6 rounded-full border-2 border-[var(--accent-primary)] opacity-0 will-change-transform"
      />
      {SPARK_ANGLES.map((deg, idx) => (
        <span
          key={deg}
          ref={(el) => {
            sparkRefs.current[idx] = el;
          }}
          className="absolute w-1 h-1 rounded-full bg-[var(--accent-primary)] opacity-0 will-change-transform"
        />
      ))}
    </span>
  );
});

// ============================================================================
// 9. StrokeCheckIndicator (ui-moments #25 — Pop + SVG Checkmark Stroke Draw)
// ============================================================================

export interface StrokeCheckIndicatorProps {
  checked: boolean;
  size?: number;
  className?: string;
}

export const StrokeCheckIndicator = React.memo(function StrokeCheckIndicator({
  checked,
  size = 18,
  className = ''
}: StrokeCheckIndicatorProps) {
  return (
    <span
      data-checked={checked ? 'true' : 'false'}
      className={`um-check-indicator relative inline-flex items-center justify-center shrink-0 ${
        checked ? 'is-checked text-emerald-500' : 'opacity-65'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" className="um-check-circle" />
        <path d="M8.5 12.4 10.9 14.8 15.8 9.6" className="um-check-stroke" />
      </svg>
    </span>
  );
});
