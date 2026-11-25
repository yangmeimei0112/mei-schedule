import React, { useCallback, useEffect, useId, useState } from 'react';
import { LucideIcon } from './BrandMark';
import {
  generateMathCaptcha,
  type MathCaptchaChallenge
} from '../services/memberAuthService';

export { generateMathCaptcha, type MathCaptchaChallenge };

export interface AntiBotCaptchaProps {
  captcha?: MathCaptchaChallenge;
  onRefresh?: () => void;
  value?: string;
  onChange?: (val: string) => void;
  answerValue?: string;
  onAnswerChange?: (val: string) => void;
  onCaptchaChange?: (expected: string, obj: MathCaptchaChallenge) => void;
  disabled?: boolean;
  error?: boolean;
}

/**
 * Pure SVG Arithmetic Anti-Bot Captcha
 * Zero Unicode Emoji, unique useId() pattern ID, Lucide strokeWidth=1.75
 */
export default function AntiBotCaptcha({
  captcha: propCaptcha,
  onRefresh: propOnRefresh,
  value: propValue,
  onChange: propOnChange,
  answerValue,
  onAnswerChange,
  onCaptchaChange,
  disabled = false,
  error = false
}: AntiBotCaptchaProps) {
  const uid = useId();
  const patternId = `captcha-grid-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [internalCaptcha, setInternalCaptcha] = useState<MathCaptchaChallenge>(() =>
    generateMathCaptcha()
  );

  const activeCaptcha = propCaptcha || internalCaptcha;

  const handleRefresh = useCallback(() => {
    if (propOnRefresh) {
      propOnRefresh();
    } else {
      const next = generateMathCaptcha();
      setInternalCaptcha(next);
      onCaptchaChange?.(next.expectedAnswer, next);
    }
  }, [propOnRefresh, onCaptchaChange]);

  useEffect(() => {
    if (!propCaptcha && onCaptchaChange) {
      onCaptchaChange(internalCaptcha.expectedAnswer, internalCaptcha);
    }
  }, [internalCaptcha, propCaptcha, onCaptchaChange]);

  const inputValue = propValue !== undefined ? propValue : answerValue || '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/\D/g, '');
    if (propOnChange) {
      propOnChange(sanitized);
    } else if (onAnswerChange) {
      onAnswerChange(sanitized);
    }
  };

  return (
    <div className="space-y-1.5 select-none">
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-main)]">
        <label htmlFor="register-captcha-input" className="flex items-center gap-1.5">
          <LucideIcon name="shield-check" size={14} className="theme-accent-text" />
          <span>防機器人安全驗證</span>
        </label>
        <span className="text-[11px] text-[var(--text-muted)]">請計算算式結果</span>
      </div>

      <div className="flex items-center gap-2">
        <div
          data-testid="register-captcha-code"
          className="relative flex-1 h-11 rounded-xl bg-[var(--accent-soft-bg)]/65 border border-[var(--accent-soft-border)] overflow-hidden flex items-center justify-center select-none"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 160 40"
            className="w-full h-full"
            role="img"
            aria-label={`防機器人驗證題目：${activeCaptcha.question}`}
          >
            <defs>
              <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
                <path
                  d="M 8 0 L 0 0 0 8"
                  fill="none"
                  stroke="var(--accent-soft-border)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="160" height="40" fill={`url(#${patternId})`} />

            <path
              d="M 5 20 Q 40 5 80 25 T 155 18"
              fill="none"
              stroke="var(--accent-primary)"
              strokeOpacity="0.32"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <path
              d="M 10 30 Q 50 35 90 12 T 150 25"
              fill="none"
              stroke="var(--accent-hover)"
              strokeOpacity="0.28"
              strokeWidth="1.2"
            />

            <text
              x="50%"
              y="58%"
              dominantBaseline="middle"
              textAnchor="middle"
              fill="var(--text-main)"
              className="font-mono font-black text-base tracking-widest"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontWeight: 900,
                letterSpacing: '0.18em'
              }}
            >
              {activeCaptcha.question}
            </text>
          </svg>
        </div>

        <button
          type="button"
          data-testid="captcha-refresh-btn"
          disabled={disabled}
          onClick={handleRefresh}
          title="重新整理驗證碼"
          aria-label="更換防機器人題目"
          className="p-2.5 rounded-xl bg-[var(--surface-glass)] hover:bg-[var(--accent-soft-bg)] theme-accent-deep border border-[var(--border-subtle)] transition-colors disabled:opacity-50 shrink-0"
        >
          <LucideIcon name="refresh-cw" size={16} />
        </button>

        <div className="w-24 sm:w-28 shrink-0">
          <input
            id="register-captcha-input"
            data-testid="register-captcha-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            disabled={disabled}
            value={inputValue}
            onChange={handleInputChange}
            placeholder="計算結果"
            aria-label="輸入防機器人計算結果"
            className={`w-full px-3 py-2.5 rounded-xl text-center text-sm font-mono font-bold bg-[var(--surface-glass)] border ${
              error
                ? 'border-rose-500 focus:ring-rose-500/50'
                : 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)]'
            } text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:opacity-50 transition-colors`}
          />
        </div>
      </div>
    </div>
  );
}
