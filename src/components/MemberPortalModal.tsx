import React, { useCallback, useEffect, useState } from 'react';
import { LucideIcon, StudioLogo } from './BrandMark';
import AntiBotCaptcha, { generateMathCaptcha, type MathCaptchaChallenge } from './AntiBotCaptcha';
import {
  addPasswordToCurrentMember,
  bindGmailToCurrentMember,
  bindPasskeyToCurrentMember,
  detectBiometricCapability,
  generateMemberSsoToken,
  registerMemberWithDetails,
  signInMemberWithPassword,
  signInWithGmailFastLogin,
  signInWithGoogle,
  signInWithPasskey,
  signOutMember,
  type MemberProfile
} from '../services/memberAuthService';
import type { SyncStatus } from '../types/schedule';

export interface MemberPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMember: MemberProfile | null;
  onMemberChange: (member: MemberProfile | null) => void;
  onNotify?: (message: string, icon?: string) => void;
  syncStatus?: SyncStatus;
}

type AuthTab = 'quick' | 'login' | 'register';

function formatSyncBadge(syncStatus?: SyncStatus): { label: string; icon: string } {
  switch (syncStatus) {
    case 'synced':
      return { label: '雲端即時同步中', icon: 'cloud' };
    case 'syncing':
      return { label: '正在合併同步...', icon: 'refresh-cw' };
    case 'offline-queued':
      return { label: '離線待續傳', icon: 'wifi-off' };
    case 'error':
      return { label: '本機安全保護中', icon: 'shield-check' };
    default:
      return { label: '本機離線優先', icon: 'hard-drive' };
  }
}

export default function MemberPortalModal({
  isOpen,
  onClose,
  currentMember,
  onMemberChange,
  onNotify,
  syncStatus = 'local-only'
}: MemberPortalModalProps) {
  const [authTab, setAuthTab] = useState<AuthTab>('quick');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Google tab state
  const [gmailNickname, setGmailNickname] = useState('');
  const [quickError, setQuickError] = useState('');

  // Login tab state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginIsGmailOnly, setLoginIsGmailOnly] = useState(false);

  // Register tab state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCaptchaAnswer, setRegCaptchaAnswer] = useState('');
  const [captchaObj, setCaptchaObj] = useState<MathCaptchaChallenge>(() => generateMathCaptcha());
  const [regError, setRegError] = useState('');

  // Authenticated post-login bindings state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [ssoToken, setSsoToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  const bioCap = detectBiometricCapability();

  // Reset form state whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setAuthTab('quick');
    setQuickError('');
    setLoginError('');
    setLoginIsGmailOnly(false);
    setRegError('');
    setPasswordError('');
    setRegCaptchaAnswer('');
    setCaptchaObj(generateMathCaptcha());
    setCopiedToken(false);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Generate cross-project SSO token for signed-in member
  useEffect(() => {
    let active = true;
    if (!isOpen || !currentMember?.unionId) {
      setSsoToken('');
      return;
    }
    void generateMemberSsoToken(currentMember)
      .then((token) => {
        if (active) setSsoToken(token);
      })
      .catch(() => {
        if (active) setSsoToken('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, currentMember]);

  const handleRefreshCaptcha = useCallback(() => {
    setCaptchaObj(generateMathCaptcha());
    setRegCaptchaAnswer('');
  }, []);

  if (!isOpen) return null;

  const handleGoogleOAuth = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setQuickError('');
    setLoginError('');
    try {
      const trimmedNickname = gmailNickname.trim();
      if (trimmedNickname) {
        const res = await signInWithGmailFastLogin({ customDisplayName: trimmedNickname });
        if (!res.success) {
          const errMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Google 授權失敗';
          setQuickError(errMsg);
          onNotify?.(errMsg, 'circle-alert');
          return;
        }
        if (res.member) {
          onMemberChange(res.member);
          onNotify?.(`歡迎回來，${res.member.displayName}`, 'user-check');
          onClose();
        } else {
          onNotify?.('正在為您導向 Google 官方帳號授權頁面...', 'globe');
        }
      } else {
        const res = await signInWithGoogle();
        if (res.error) {
          const errMsg = res.error.message || 'Google 授權失敗';
          setQuickError(errMsg);
          onNotify?.(errMsg, 'circle-alert');
          return;
        }
        const maybeMember = (res.data?.member as MemberProfile | null) || null;
        if (maybeMember) {
          onMemberChange(maybeMember);
          onNotify?.(`歡迎回來，${maybeMember.displayName}`, 'user-check');
          onClose();
        } else {
          onNotify?.('正在為您導向 Google 官方帳號授權頁面...', 'globe');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setQuickError('');
    try {
      const res = await signInWithPasskey();
      if (res.error) {
        setQuickError(res.error.message);
        return;
      }
      const member = (res.data?.member as MemberProfile | null) || null;
      if (member) {
        onMemberChange(member);
        onNotify?.(`已透過生物辨識登入，歡迎 ${member.displayName}`, 'fingerprint');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailPasswordLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLoginError('');
    setLoginIsGmailOnly(false);
    try {
      const res = await signInMemberWithPassword(loginEmail, loginPassword);
      if (!res.success) {
        setLoginIsGmailOnly(Boolean(res.isGmailOnly));
        setLoginError(typeof res.error === 'string' ? res.error : res.error?.message || '登入失敗');
        return;
      }
      if (res.member) {
        onMemberChange(res.member);
        onNotify?.(`登入成功，歡迎回來 ${res.member.displayName}`, 'user-check');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setRegError('');
    try {
      const res = await registerMemberWithDetails({
        displayName: regName,
        email: regEmail,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        captchaAnswer: regCaptchaAnswer,
        captchaExpected: captchaObj.expectedAnswer
      });

      if (!res.success) {
        setRegError(typeof res.error === 'string' ? res.error : res.error?.message || '註冊失敗');
        setCaptchaObj(generateMathCaptcha());
        setRegCaptchaAnswer('');
        return;
      }

      if (res.member && res.session) {
        onMemberChange(res.member);
        onNotify?.(`歡迎加入咩創意生態系，${res.member.displayName}`, 'sparkles');
        onClose();
      } else {
        onNotify?.('註冊成功，請至信箱查收驗證信後登入', 'mail');
        setAuthTab('login');
        setLoginEmail(regEmail);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPasswordError('');
    try {
      const res = await addPasswordToCurrentMember(newPassword, confirmNewPassword);
      if (!res.success) {
        setPasswordError(typeof res.error === 'string' ? res.error : res.error?.message || '增設密碼失敗');
        return;
      }
      if (res.member) {
        onMemberChange(res.member);
      }
      setNewPassword('');
      setConfirmNewPassword('');
      onNotify?.('已成功增設登入密碼，往後可使用信箱密碼登入', 'shield-check');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBindGmail = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await bindGmailToCurrentMember();
      if (!res.success) {
        onNotify?.(typeof res.error === 'string' ? res.error : res.error?.message || '綁定 Gmail 失敗', 'circle-alert');
        return;
      }
      if (res.member) onMemberChange(res.member);
      onNotify?.(res.message || '已啟動 Gmail 帳號綁定流程', 'globe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBindPasskey = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await bindPasskeyToCurrentMember();
      if (!res.success) {
        onNotify?.(typeof res.error === 'string' ? res.error : res.error?.message || 'Passkey 綁定失敗', 'circle-alert');
        return;
      }
      if (res.member) onMemberChange(res.member);
      onNotify?.('已成功綁定生物辨識安全金鑰 (Passkey)', 'fingerprint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!ssoToken) return;
    try {
      await navigator.clipboard?.writeText(ssoToken);
      setCopiedToken(true);
      onNotify?.('已複製跨專案 SSO 認證權杖', 'copy');
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      onNotify?.('無法存取剪貼簿，請手動選取複製', 'circle-alert');
    }
  };

  const handleSignOut = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await signOutMember();
      onMemberChange(null);
      onNotify?.('已登出咩創意全站帳號，本機排程資料已安全保留', 'log-out');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPassword = Boolean(
    currentMember?.metadata?.has_password !== undefined
      ? currentMember.metadata.has_password
      : currentMember?.hasPassword !== undefined
      ? currentMember.hasPassword
      : currentMember?.authProvider !== 'google'
  );
  const isGmailBound = Boolean(
    currentMember?.authProviders?.includes('google') || currentMember?.authProvider === 'google'
  );
  const isPasskeyBound = Boolean(
    currentMember?.isPasskeyEnabled || currentMember?.authProviders?.includes('passkey')
  );
  const syncBadge = formatSyncBadge(syncStatus);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="全站聯通會員專區"
      data-testid="member-portal-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-md"
    >
      <div className="bento-glass-card w-full max-w-xl max-h-[90vh] max-h-dvh-90 landscape-compact-modal overflow-y-auto p-4 sm:p-7 border border-[var(--border-subtle)] shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <StudioLogo size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight text-[var(--text-main)] truncate">
                  全站聯通會員專區
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold theme-accent-soft border">
                  <LucideIcon name="orbit" size={12} />
                  <span>Cloud SSO v3.0</span>
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                登入後自動無縫合併本機排程，跨五端即時同步並啟用多人共享日曆
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="關閉會員專區視窗"
            className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-subtle)] transition-colors shrink-0"
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>

        {/* Authenticated Member Portal */}
        {currentMember ? (
          <div data-testid="member-profile-card" className="space-y-5">
            {/* Digital Pass */}
            <div className="rounded-2xl p-4 sm:p-5 bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-[var(--text-main)] truncate">
                      {currentMember.displayName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold theme-accent-solid">
                      {currentMember.tierLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {currentMember.email || '未提供信箱'}
                  </p>
                  <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                    Union ID: {currentMember.unionId}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="member-signout-btn"
                  disabled={isSubmitting}
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                >
                  <LucideIcon name="log-out" size={14} />
                  <span>全站登出</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-500/30">
                  <LucideIcon name="circle-check" size={12} />
                  <span>全站子專案已聯通</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold theme-accent-soft border">
                  <LucideIcon name={syncBadge.icon} size={12} />
                  <span>{syncBadge.label}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[var(--border-subtle)] text-xs">
                <div className="rounded-xl p-2.5 bg-[var(--surface-glass)] border border-[var(--border-subtle)]">
                  <div className="text-[11px] text-[var(--text-muted)]">主要登入來源</div>
                  <div className="font-semibold text-[var(--text-main)] mt-0.5 uppercase">
                    {currentMember.authProvider}
                  </div>
                </div>
                <div className="rounded-xl p-2.5 bg-[var(--surface-glass)] border border-[var(--border-subtle)]">
                  <div className="text-[11px] text-[var(--text-muted)]">生物辨識金鑰</div>
                  <div className="font-semibold text-[var(--text-main)] mt-0.5">
                    {isPasskeyBound ? '已綁定安全金鑰' : '未綁定金鑰'}
                  </div>
                </div>
                <div className="rounded-xl p-2.5 bg-[var(--surface-glass)] border border-[var(--border-subtle)]">
                  <div className="text-[11px] text-[var(--text-muted)]">漫遊授權範圍</div>
                  <div className="font-semibold text-[var(--text-main)] mt-0.5">
                    旗下所有網站與子專案 (*)
                  </div>
                </div>
              </div>
            </div>

            {/* Add Password Section (for Gmail-only users) */}
            {!hasPassword ? (
              <form
                data-testid="member-add-password-section"
                onSubmit={handleSetPassword}
                className="rounded-2xl p-4 bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
                  <LucideIcon name="key-round" size={16} className="theme-accent-text" />
                  <span>為 Gmail 帳號增設登入密碼</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  設定密碼後，除了 Google 一鍵登入外，亦可使用信箱與密碼登入咩創意旗下所有專案。
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="password"
                    data-testid="member-new-password-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="輸入新密碼（至少 6 碼）"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <input
                    type="password"
                    data-testid="member-confirm-password-input"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="再次確認新密碼"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                {passwordError && (
                  <p
                    role="alert"
                    data-testid="member-password-error-msg"
                    className="text-xs font-medium text-rose-600 dark:text-rose-400"
                  >
                    {passwordError}
                  </p>
                )}
                <button
                  type="submit"
                  data-testid="member-set-password-btn"
                  disabled={isSubmitting}
                  className="btn-sky-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <LucideIcon name="shield-check" size={14} />
                  <span>確認增設密碼</span>
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <LucideIcon name="circle-check" size={15} />
                <span>已啟用密碼登入</span>
              </div>
            )}

            {/* Dual Credential Bindings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="member-bind-google-btn"
                disabled={isSubmitting || isGmailBound}
                onClick={handleBindGmail}
                className="btn-sky-secondary px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LucideIcon name="globe" size={16} />
                <span>{isGmailBound ? '已綁定 Gmail 帳號' : '綁定 Gmail 快速登入'}</span>
              </button>

              <button
                type="button"
                data-testid="member-bind-passkey-btn"
                disabled={isSubmitting}
                onClick={handleBindPasskey}
                className="btn-sky-secondary px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LucideIcon name={bioCap.icon} size={16} />
                <span>{isPasskeyBound ? '更新生物辨識 Passkey' : '綁定生物辨識 Passkey'}</span>
              </button>
            </div>

            {/* Cross-Project SSO Token */}
            <div className="rounded-2xl p-3.5 bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-main)] inline-flex items-center gap-1.5">
                  <LucideIcon name="link-2" size={14} className="theme-accent-text" />
                  <span>跨專案 SSO 漫遊權杖 (mei_sso_v2)</span>
                </span>
                <button
                  type="button"
                  data-testid="member-copy-sso-token-btn"
                  onClick={handleCopyToken}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold theme-accent-soft border transition-colors"
                >
                  <LucideIcon name={copiedToken ? 'check' : 'copy'} size={12} />
                  <span>{copiedToken ? '已複製' : '複製權杖'}</span>
                </button>
              </div>
              <div
                data-testid="member-sso-token-display"
                className="font-mono text-[11px] break-all p-2 rounded-lg bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-muted)] max-h-20 overflow-y-auto"
              >
                {ssoToken || '產生中...'}
              </div>
            </div>
          </div>
        ) : (
          /* Unauthenticated 3-Tab Portal */
          <div className="space-y-5">
            <div
              role="tablist"
              aria-label="會員登入與註冊方式"
              className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]"
            >
              {(
                [
                  { id: 'quick', label: '快速登入', icon: 'zap', testId: 'auth-tab-quick' },
                  { id: 'login', label: '密碼登入', icon: 'lock', testId: 'auth-tab-login' },
                  { id: 'register', label: '標準註冊', icon: 'user-plus', testId: 'auth-tab-register' }
                ] as const
              ).map((tab) => {
                const active = authTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={tab.testId}
                    onClick={() => {
                      setAuthTab(tab.id);
                      setQuickError('');
                      setLoginError('');
                      setRegError('');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-colors ${
                      active
                        ? 'theme-accent-solid shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <LucideIcon name={tab.icon} size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Quick Login (Google OAuth + Passkey) */}
            {authTab === 'quick' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="gmail-nickname-input"
                    className="block text-xs font-semibold text-[var(--text-main)]"
                  >
                    自訂顯示暱稱（選填，授權完成後自動套用）
                  </label>
                  <input
                    id="gmail-nickname-input"
                    data-testid="gmail-nickname-input"
                    type="text"
                    value={gmailNickname}
                    onChange={(e) => setGmailNickname(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="例如：排程達人小咩"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                {quickError && (
                  <div
                    role="alert"
                    data-testid="member-error-msg"
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300/70 dark:border-rose-500/40 text-xs font-medium text-rose-700 dark:text-rose-200 flex items-start gap-2"
                  >
                    <LucideIcon name="circle-alert" size={16} className="shrink-0 mt-0.5" />
                    <span>{quickError}</span>
                  </div>
                )}

                <button
                  type="button"
                  data-testid="member-google-login-btn"
                  disabled={isSubmitting}
                  onClick={handleGoogleOAuth}
                  className="btn-sky-primary w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <LucideIcon
                    name={isSubmitting ? 'loader-2' : 'globe'}
                    size={16}
                    className={isSubmitting ? 'animate-spin' : ''}
                  />
                  <span>
                    {isSubmitting ? '正在導向 Google 授權頁面...' : '使用 Google 帳號繼續'}
                  </span>
                </button>

                <div className="rounded-2xl p-4 bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-main)] inline-flex items-center gap-1.5">
                      <LucideIcon name={bioCap.icon} size={15} className="theme-accent-text" />
                      <span>W3C Passkey 生物辨識金鑰</span>
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {bioCap.webAuthnAvailable ? '支援此裝置' : '需支援瀏覽器'}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="member-passkey-login-btn"
                    disabled={isSubmitting}
                    onClick={handlePasskeyLogin}
                    className="btn-sky-secondary w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <LucideIcon name={bioCap.icon} size={15} />
                    <span>{bioCap.label}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Email + Password Login */}
            {authTab === 'login' && (
              <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="member-email-input"
                    className="block text-xs font-semibold text-[var(--text-main)]"
                  >
                    電子信箱
                  </label>
                  <input
                    id="member-email-input"
                    data-testid="member-email-input"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="member-password-input"
                    className="block text-xs font-semibold text-[var(--text-main)]"
                  >
                    登入密碼
                  </label>
                  <input
                    id="member-password-input"
                    data-testid="member-password-input"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="請輸入密碼"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                {loginError && (
                  <div
                    role="alert"
                    data-testid="member-error-msg"
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300/70 dark:border-rose-500/40 text-xs font-medium text-rose-700 dark:text-rose-200 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <LucideIcon name="circle-alert" size={16} className="shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                    {loginIsGmailOnly && (
                      <button
                        type="button"
                        data-testid="switch-to-gmail-login-btn"
                        onClick={() => {
                          setAuthTab('quick');
                          setLoginError('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg theme-accent-solid text-xs font-bold transition-colors"
                      >
                        <LucideIcon name="globe" size={13} />
                        <span>前往 Gmail 快速登入</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  data-testid="member-email-submit-btn"
                  disabled={isSubmitting}
                  className="btn-sky-primary w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <LucideIcon name="lock-open" size={16} />
                  <span>以帳號密碼登入</span>
                </button>

                <div className="relative py-1 flex items-center">
                  <div className="flex-grow border-t border-[var(--border-subtle)]" />
                  <span className="px-3 text-[11px] text-[var(--text-muted)]">或</span>
                  <div className="flex-grow border-t border-[var(--border-subtle)]" />
                </div>

                <button
                  type="button"
                  data-testid="login-tab-google-btn"
                  disabled={isSubmitting}
                  onClick={handleGoogleOAuth}
                  className="btn-sky-secondary w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <LucideIcon name="globe" size={15} />
                  <span>或使用 Gmail 帳號快速登入</span>
                </button>
              </form>
            )}

            {/* Tab 3: Standard Registration with Math Captcha */}
            {authTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="register-name-input"
                      className="block text-xs font-semibold text-[var(--text-main)]"
                    >
                      會員暱稱
                    </label>
                    <input
                      id="register-name-input"
                      data-testid="register-name-input"
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="至少 2 個字元"
                      className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="register-email-input"
                      className="block text-xs font-semibold text-[var(--text-main)]"
                    >
                      電子信箱
                    </label>
                    <input
                      id="register-email-input"
                      data-testid="register-email-input"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="name@example.com"
                      className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="register-password-input"
                      className="block text-xs font-semibold text-[var(--text-main)]"
                    >
                      設定密碼
                    </label>
                    <input
                      id="register-password-input"
                      data-testid="register-password-input"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="至少 6 個字元"
                      className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="register-confirm-password-input"
                      className="block text-xs font-semibold text-[var(--text-main)]"
                    >
                      再次確認密碼
                    </label>
                    <input
                      id="register-confirm-password-input"
                      data-testid="register-confirm-password-input"
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="再輸入一次密碼"
                      className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                <AntiBotCaptcha
                  captcha={captchaObj}
                  onRefresh={handleRefreshCaptcha}
                  value={regCaptchaAnswer}
                  onChange={setRegCaptchaAnswer}
                  disabled={isSubmitting}
                  error={Boolean(regError && regError.includes('驗證碼'))}
                />

                {regError && (
                  <div
                    role="alert"
                    data-testid="register-error-msg"
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300/70 dark:border-rose-500/40 text-xs font-medium text-rose-700 dark:text-rose-200 flex items-start gap-2"
                  >
                    <LucideIcon name="circle-alert" size={16} className="shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  data-testid="register-submit-btn"
                  disabled={isSubmitting}
                  className="btn-sky-primary w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <LucideIcon name="user-plus" size={16} />
                  <span>立即註冊全站會員</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
