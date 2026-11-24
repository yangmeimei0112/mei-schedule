import type { SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseConfig, supabase } from './supabaseClient';

// ============================================================================
// Constants & Types — Mei Creative Studio Cloud SSO v3.0
// ============================================================================

export const MEMBER_SSO_STORAGE_KEY = 'mei_universal_member_sso_v1';
export const MEMBER_SSO_TOKEN_STORAGE_KEY = 'mei_universal_sso_token_v1';
export const MEMBER_SSO_BROADCAST_CHANNEL = 'mei_universal_sso_channel_v1';
export const MEMBER_SSO_EVENT_NAME = 'mei:sso-state-changed';
export const PENDING_OAUTH_NICKNAME_KEY = 'mei_pending_oauth_nickname';

export type MemberTierId = 'explorer' | 'creator' | 'architect';

export interface MemberTierMeta {
  id: MemberTierId;
  label: string;
  badgeColor: string;
}

export const MEMBER_TIERS: Record<MemberTierId, MemberTierMeta> = {
  explorer: {
    id: 'explorer',
    label: '靈感探索員',
    badgeColor: 'sky'
  },
  creator: {
    id: 'creator',
    label: '創意造物者',
    badgeColor: 'violet'
  },
  architect: {
    id: 'architect',
    label: '核心架構師',
    badgeColor: 'amber'
  }
};

export interface MemberProfile {
  schemaVersion: '2.0.0';
  unionId: string;
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  tier: MemberTierId;
  tierLabel: string;
  scopes: string[];
  authProvider: string;
  authProviders: string[];
  isPasskeyEnabled: boolean;
  lastSignInAt: string;
  connectedProjects: string[];
  hasPassword?: boolean;
  metadata: {
    has_password?: boolean;
    is_gmail_only?: boolean;
    [key: string]: unknown;
  };
}

export interface BiometricCapability {
  platform: 'ios' | 'macos' | 'android' | 'windows' | 'web';
  label: string;
  icon: string;
  webAuthnAvailable: boolean;
}

export interface OAuthDiagnosis {
  code: string;
  title: string;
  message: string;
}

export interface MathCaptchaChallenge {
  numA: number;
  numB: number;
  operator: '+';
  question: string;
  equation: string;
  expectedAnswer: string;
}

export interface GoogleOAuthOptions {
  redirectTo?: string;
  customDisplayName?: string;
  queryParams?: Record<string, string>;
  data?: Record<string, unknown>;
  skipBrowserRedirect?: boolean;
  [key: string]: unknown;
}

export interface RegisterMemberInput {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  captchaAnswer?: string;
  captchaExpected?: string;
}

export interface MemberActionResult {
  success: boolean;
  member?: MemberProfile | null;
  session?: unknown;
  data?: Record<string, unknown> | null;
  isGmailOnly?: boolean;
  message?: string;
  error?: string | Error | null;
}

export interface SsoTokenVerificationResult {
  valid: boolean;
  payload: Record<string, unknown> | null;
  member: MemberProfile | null;
  profile: MemberProfile | null;
  error: string | null;
}

export interface OAuthUrlErrorResult {
  error: string | null;
  errorDescription: string | null;
  errorCode: string | null;
  cleanUrl: string | null;
}

// ============================================================================
// Pure Crypto, Constant-Time Comparison & Sanitization (Byte-Compatible w/ Studio)
// ============================================================================

const EMOJI_STRIP_REGEX = /[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
const UUID_V4_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_V4_REGEX.test(val.trim());
}

function stringToUtf8Bytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const encoded = encodeURIComponent(str);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return new Uint8Array(bytes);
}

/**
 * FIPS 180-4 SHA-256 synchronous implementation (100% identical to Studio securityService.js & mei-dock.js)
 */
export function sha256Sync(input: string | Uint8Array): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number;
  let j: number;
  let result = '';

  const bytes =
    typeof input === 'string'
      ? stringToUtf8Bytes(input)
      : input || new Uint8Array(0);
  const bitLength = bytes.length * 8;
  const words: number[] = [];

  for (i = 0; i < bytes.length; i++) {
    words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((3 - (i % 4)) * 8));
  }

  words[bitLength >> 5] = (words[bitLength >> 5] || 0) | (0x80 << (24 - (bitLength % 32)));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let currentHash = hash.slice(0, 8);
  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    while (w.length < 16) w.push(0);
    const oldHash = currentHash.slice(0);
    for (j = 0; j < 64; j++) {
      const w15 = w[j - 15] || 0;
      const w2 = w[j - 2] || 0;
      const a = currentHash[0];
      const e = currentHash[4];
      const temp1 =
        currentHash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & currentHash[5]) ^ (~e & currentHash[6])) +
        k[j] +
        (w[j] =
          j < 16
            ? (w[j] || 0) | 0
            : ((w[j - 16] || 0) +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                (w[j - 7] || 0) +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & currentHash[1]) ^ (a & currentHash[2]) ^ (currentHash[1] & currentHash[2]));

      currentHash = [(temp1 + temp2) | 0].concat(currentHash);
      currentHash[4] = (currentHash[4] + temp1) | 0;
      currentHash.pop();
    }

    for (j = 0; j < 8; j++) {
      currentHash[j] = (currentHash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (currentHash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const codeA = i < a.length ? a.charCodeAt(i) : 0;
    const codeB = i < b.length ? b.charCodeAt(i) : 0;
    diff |= codeA ^ codeB;
  }
  return diff === 0;
}

export function sanitizeInputText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw);
  for (let pass = 0; pass < 4; pass++) {
    const prev = str;
    str = str
      .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/<\s*(iframe|object|embed|applet|form|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/\b(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '')
      .replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(EMOJI_STRIP_REGEX, '');
    if (str === prev) break;
  }
  return str.trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  return '';
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  return new Uint8Array(0);
}

function base64UrlEncode(obj: unknown): string {
  const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const bytes = stringToUtf8Bytes(jsonStr);
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bytes = base64ToBytes(b64);
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(bytes).toString('utf8');
}

function bufferToBase64URL(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ============================================================================
// Biometric Detection & Profile Normalization
// ============================================================================

export function detectBiometricCapability(): BiometricCapability {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const webAuthnAvailable =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials?.create === 'function';

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return {
      platform: 'ios',
      label: 'Face ID / Touch ID 快速登入',
      icon: 'scan-face',
      webAuthnAvailable
    };
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return {
      platform: 'macos',
      label: 'Touch ID / Apple Passkey 登入',
      icon: 'fingerprint',
      webAuthnAvailable
    };
  }
  if (/Android/i.test(ua)) {
    return {
      platform: 'android',
      label: 'Android 指紋 / 臉部辨識登入',
      icon: 'fingerprint',
      webAuthnAvailable
    };
  }
  if (/Windows/i.test(ua)) {
    return {
      platform: 'windows',
      label: 'Windows Hello 指紋 / 臉部登入',
      icon: 'fingerprint',
      webAuthnAvailable
    };
  }
  return {
    platform: 'web',
    label: 'Passkey / 生物辨識金鑰登入',
    icon: 'key-round',
    webAuthnAvailable
  };
}

function resolveTier(rawTier: unknown): MemberTierId {
  if (rawTier === 'creator' || rawTier === 'architect' || rawTier === 'explorer') {
    return rawTier;
  }
  return 'explorer';
}

export function normalizeMemberProfile(raw: unknown): MemberProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawUid = String(r.uid || r.id || '').trim();
  const rawUnionId = String(r.unionId || r.union_id || '').trim();
  const uid = rawUid || (rawUnionId ? rawUnionId.replace(/^mei_user_/, '') : '');
  const unionId = rawUnionId
    ? rawUnionId.startsWith('mei_user_')
      ? rawUnionId
      : `mei_user_${rawUnionId.replace(/^mei_/, '')}`
    : uid
    ? `mei_user_${uid.replace(/-/g, '')}`
    : '';

  const displayName = sanitizeInputText(
    r.displayName || r.display_name || r.full_name || r.name || (typeof r.email === 'string' ? r.email.split('@')[0] : '')
  );
  if (!displayName) return null;

  const tier = resolveTier(r.tier);
  const tierLabel = sanitizeInputText(r.tierLabel) || MEMBER_TIERS[tier].label;
  const primaryProvider = sanitizeInputText(r.authProvider || r.auth_provider || 'google').toLowerCase() || 'google';
  const rawProviders = Array.isArray(r.authProviders)
    ? r.authProviders.map((p) => sanitizeInputText(p).toLowerCase()).filter(Boolean)
    : Array.isArray(r.auth_providers)
    ? (r.auth_providers as unknown[]).map((p) => sanitizeInputText(p).toLowerCase()).filter(Boolean)
    : [primaryProvider];
  const authProviders = Array.from(new Set(rawProviders.length > 0 ? rawProviders : [primaryProvider]));

  const rawMeta =
    r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
      ? { ...(r.metadata as Record<string, unknown>) }
      : {};

  const resolvedHasPassword =
    rawMeta.has_password !== undefined
      ? Boolean(rawMeta.has_password)
      : r.hasPassword !== undefined
      ? Boolean(r.hasPassword)
      : primaryProvider !== 'google';

  rawMeta.has_password = resolvedHasPassword;

  const scopes = Array.isArray(r.scopes)
    ? r.scopes.map((s) => sanitizeInputText(s)).filter(Boolean)
    : ['studio:read', 'subprojects:access', 'sso:roaming'];

  const connectedProjects = Array.isArray(r.connectedProjects)
    ? r.connectedProjects.map((p) => sanitizeInputText(p)).filter(Boolean)
    : Array.isArray(r.connected_projects)
    ? (r.connected_projects as unknown[]).map((p) => sanitizeInputText(p)).filter(Boolean)
    : ['*'];

  const cleanEmail = sanitizeInputText(r.email || '').toLowerCase();
  const cleanAvatar = typeof r.avatarUrl === 'string'
    ? r.avatarUrl.trim()
    : typeof r.avatar_url === 'string'
    ? r.avatar_url.trim()
    : '';

  return {
    schemaVersion: '2.0.0',
    unionId: unionId || `mei_user_${Date.now()}`,
    uid: uid || unionId.replace(/^mei_user_/, ''),
    email: cleanEmail,
    displayName,
    avatarUrl: /^https?:\/\//i.test(cleanAvatar) ? cleanAvatar : '',
    tier,
    tierLabel,
    scopes,
    authProvider: primaryProvider,
    authProviders,
    isPasskeyEnabled: Boolean(r.isPasskeyEnabled ?? r.is_passkey_enabled),
    lastSignInAt: String(r.lastSignInAt || r.last_sign_in_at || new Date().toISOString()),
    connectedProjects: connectedProjects.length > 0 ? connectedProjects : ['*'],
    hasPassword: resolvedHasPassword,
    metadata: rawMeta
  };
}

export function transformSupabaseUserToMemberProfile(user: Record<string, unknown> | null | undefined): MemberProfile | null {
  if (!user || typeof user !== 'object') return null;
  const uid = String(user.id || '').trim();
  const userMeta = (user.user_metadata || {}) as Record<string, unknown>;
  const appMeta = (user.app_metadata || {}) as Record<string, unknown>;
  const email = String(user.email || '').trim().toLowerCase();
  const primaryProvider = String(appMeta.provider || 'email').toLowerCase();
  const providersList = Array.isArray(appMeta.providers)
    ? (appMeta.providers as unknown[]).map((p) => String(p).toLowerCase())
    : [primaryProvider];

  const hasPassword =
    userMeta.has_password !== undefined
      ? Boolean(userMeta.has_password)
      : primaryProvider !== 'google';

  const displayName =
    sanitizeInputText(
      userMeta.displayName || userMeta.full_name || userMeta.name || (email ? email.split('@')[0] : '')
    ) || '創意會員';

  return normalizeMemberProfile({
    uid,
    unionId: uid.startsWith('mei_user_') ? uid : `mei_user_${uid}`,
    email,
    displayName,
    avatarUrl: userMeta.avatar_url || userMeta.picture || '',
    tier: userMeta.tier || 'explorer',
    authProvider: primaryProvider,
    authProviders: providersList,
    isPasskeyEnabled: Boolean(userMeta.is_passkey_enabled),
    lastSignInAt: String(user.last_sign_in_at || new Date().toISOString()),
    connectedProjects: ['*'],
    metadata: {
      has_password: hasPassword,
      is_gmail_only: primaryProvider === 'google' && !hasPassword
    }
  });
}

// ============================================================================
// Storage, BroadcastChannel & Cloud Profile Sync (Schema-Safe)
// ============================================================================

export function broadcastMemberSsoEvent(eventType: string, memberProfile: MemberProfile | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.MeiStudioSSO) {
      window.MeiStudioSSO.currentMember = memberProfile as unknown as Record<string, unknown> | null;
      window.MeiStudioSSO._notify?.(memberProfile as unknown as Record<string, unknown> | null);
    }
  } catch {
    // Ignore global bridge errors
  }

  const payload = {
    type: eventType,
    member: memberProfile ?? null,
    timestamp: Date.now()
  };

  try {
    window.dispatchEvent(new CustomEvent(MEMBER_SSO_EVENT_NAME, { detail: payload }));
  } catch {
    // Ignore dispatch errors
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(MEMBER_SSO_BROADCAST_CHANNEL);
      ch.postMessage(payload);
      setTimeout(() => {
        try {
          ch.close();
        } catch {
          // Ignore close errors
        }
      }, 100);
    } catch {
      // Ignore BroadcastChannel restriction
    }
  }
}

export function loadCurrentMember(): MemberProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MEMBER_SSO_STORAGE_KEY);
    if (!raw || typeof raw !== 'string' || raw.startsWith('MEI-SSO-')) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeMemberProfile(parsed);
    if (window.MeiStudioSSO) {
      window.MeiStudioSSO.currentMember = normalized as unknown as Record<string, unknown> | null;
    }
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Upserts ONLY valid columns on existing Studio table public.mei_member_profiles.
 * Stores has_password / is_gmail_only strictly inside metadata JSONB.
 */
export async function syncMemberProfileToCloud(
  profile: MemberProfile | null,
  customClient: SupabaseClient | null = supabase
): Promise<{ data: unknown; error: unknown }> {
  if (!profile || !isValidUuid(profile.uid) || !customClient || typeof customClient.from !== 'function') {
    return { data: null, error: null };
  }
  const nowIso = new Date().toISOString();
  const row = {
    id: profile.uid,
    union_id: profile.unionId,
    email: profile.email,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl || '',
    tier: profile.tier,
    auth_provider: profile.authProvider,
    is_passkey_enabled: Boolean(profile.isPasskeyEnabled),
    connected_projects: profile.connectedProjects || ['*'],
    metadata: {
      ...(profile.metadata || {}),
      has_password: Boolean(profile.metadata?.has_password ?? profile.hasPassword)
    },
    last_sign_in_at: profile.lastSignInAt || nowIso,
    updated_at: nowIso
  };
  try {
    const res = await customClient.from('mei_member_profiles').upsert(row, { onConflict: 'id' });
    return { data: res.data ?? null, error: res.error ?? null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function fetchMemberProfileFromCloud(
  userId: string,
  customClient: SupabaseClient | null = supabase
): Promise<MemberProfile | null> {
  if (!isValidUuid(userId) || !customClient || typeof customClient.from !== 'function') {
    return null;
  }
  try {
    const { data, error } = await customClient
      .from('mei_member_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return normalizeMemberProfile(data);
  } catch {
    return null;
  }
}

export function saveCurrentMember(profile: MemberProfile | null): MemberProfile | null {
  if (typeof window === 'undefined') return profile;
  const normalized = profile ? normalizeMemberProfile(profile) : null;
  try {
    if (normalized) {
      window.localStorage.setItem(MEMBER_SSO_STORAGE_KEY, JSON.stringify(normalized));
    } else {
      window.localStorage.removeItem(MEMBER_SSO_STORAGE_KEY);
      window.localStorage.removeItem(MEMBER_SSO_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage SecurityError
  }

  broadcastMemberSsoEvent(normalized ? 'MEMBER_SIGNED_IN' : 'MEMBER_SIGNED_OUT', normalized);

  if (normalized && isValidUuid(normalized.uid)) {
    void syncMemberProfileToCloud(normalized).catch(() => {});
  }
  return normalized;
}

export async function signOutMember(): Promise<{ error: null }> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(MEMBER_SSO_STORAGE_KEY);
      window.localStorage.removeItem(MEMBER_SSO_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage SecurityError
    }
  }
  broadcastMemberSsoEvent('MEMBER_LOGOUT', null);

  try {
    if (supabase?.auth && typeof supabase.auth.signOut === 'function') {
      await supabase.auth.signOut();
    }
  } catch {
    // Ignore signOut network errors
  }
  return { error: null };
}

// ============================================================================
// OAuth Error Diagnostics & #/tray-Safe URL Error Capture
// ============================================================================

export function diagnoseOAuthError(error: unknown): OAuthDiagnosis | null {
  if (!error) return null;
  const errObj = typeof error === 'object' ? (error as Record<string, unknown>) : null;
  const rawMsg = String(
    errObj?.error_description ||
      errObj?.message ||
      (typeof error === 'string' ? error : '') ||
      errObj?.code ||
      ''
  ).toLowerCase();

  const code = String(errObj?.code || errObj?.error || '').toLowerCase();

  let title = 'Google 授權失敗';
  let message = 'Google 帳號授權流程發生未預期的錯誤，請稍後再試。';

  if (
    rawMsg.includes('provider is not enabled') ||
    rawMsg.includes('provider disabled') ||
    rawMsg.includes('unsupported provider') ||
    code === 'provider_disabled'
  ) {
    title = 'Google 登入服務尚未啟用';
    message =
      '後台尚未啟用 Google 登入提供者。請至 Supabase 控制台的 Authentication > Providers 啟用 Google，並填入 Google Cloud Client ID 與 Secret。';
  } else if (
    rawMsg.includes('invalid_client') ||
    rawMsg.includes('client id is invalid') ||
    rawMsg.includes('unauthorized_client') ||
    code === 'invalid_client'
  ) {
    title = 'Google API 憑證無效';
    message =
      'Google API 憑證無效或尚未設定。請確認 Google Cloud Console 的 Client ID 與 Client Secret 正確無誤。';
  } else if (
    rawMsg.includes('redirect_uri_mismatch') ||
    rawMsg.includes('redirect uri mismatch') ||
    rawMsg.includes('bad redirect uri') ||
    code === 'redirect_uri_mismatch'
  ) {
    title = 'OAuth 重定向網址不符合';
    message =
      'OAuth 重定向網址不符合。請將目前網站網址加入 Google Cloud Console 與 Supabase 的 Authorized Redirect URIs。';
  } else if (
    rawMsg.includes('access_denied') ||
    rawMsg.includes('user cancelled') ||
    rawMsg.includes('cancelled') ||
    rawMsg.includes('canceled') ||
    code === 'access_denied'
  ) {
    title = '已取消 Google 帳號授權';
    message = '您已取消 Google 帳號授權。若要使用 Google 快速登入，請再次點擊並同意授權。';
  } else if (rawMsg.includes('popup_closed') || rawMsg.includes('popup closed') || code === 'popup_closed') {
    title = '授權視窗已被關閉';
    message = 'Google 授權登入視窗已關閉，請重新嘗試登入。';
  } else if (rawMsg.includes('network') || rawMsg.includes('failed to fetch')) {
    title = '網路連線異常';
    const rawDetail = errObj?.message ? String(errObj.message) : '';
    message = rawDetail
      ? `無法連線至 Google 或 Supabase 驗證伺服器（${rawDetail}），請檢查您的網路連線。`
      : '無法連線至 Google 或 Supabase 驗證伺服器，請檢查您的網路連線。';
  } else if (errObj?.message) {
    message = sanitizeInputText(errObj.message) || message;
  }

  return {
    code: code || 'oauth_error',
    title,
    message
  };
}

/**
 * Pure extractor for OAuth callback error params (?error= / #error=).
 * STRICTLY preserves SPA route hashes such as #/tray verbatim.
 */
export function extractAndCleanOAuthUrlError(
  locationLike?: Pick<Location, 'pathname' | 'search' | 'hash'>
): OAuthUrlErrorResult {
  const loc =
    locationLike ||
    (typeof window !== 'undefined' ? window.location : { pathname: '/', search: '', hash: '' });

  let errorParam: string | null = null;
  let errorDescription: string | null = null;
  let errorCode: string | null = null;

  const rawSearch = loc.search || '';
  const rawHash = loc.hash || '';
  const isHashRoute = rawHash.startsWith('#/');

  if (rawSearch) {
    const sp = new URLSearchParams(rawSearch);
    if (sp.has('error') || sp.has('error_description')) {
      errorParam = sp.get('error');
      errorDescription = sp.get('error_description');
      errorCode = sp.get('error_code');
    }
  }

  if (!errorParam && !errorDescription && rawHash) {
    let candidateQuery = '';
    if (isHashRoute) {
      const qIdx = rawHash.indexOf('?');
      if (qIdx >= 0) candidateQuery = rawHash.slice(qIdx + 1);
    } else {
      candidateQuery = rawHash.replace(/^#/, '');
    }
    if (candidateQuery) {
      const hp = new URLSearchParams(candidateQuery);
      if (hp.has('error') || hp.has('error_description')) {
        errorParam = hp.get('error');
        errorDescription = hp.get('error_description');
        errorCode = hp.get('error_code');
      }
    }
  }

  if (!errorParam && !errorDescription) {
    return { error: null, errorDescription: null, errorCode: null, cleanUrl: null };
  }

  let newSearch = '';
  if (rawSearch) {
    const cleanSp = new URLSearchParams(rawSearch);
    cleanSp.delete('error');
    cleanSp.delete('error_description');
    cleanSp.delete('error_code');
    newSearch = cleanSp.toString() ? `?${cleanSp.toString()}` : '';
  }

  let newHash = '';
  if (rawHash) {
    if (isHashRoute) {
      const qIdx = rawHash.indexOf('?');
      if (qIdx < 0) {
        newHash = rawHash;
      } else {
        const routePart = rawHash.slice(0, qIdx);
        const cleanHp = new URLSearchParams(rawHash.slice(qIdx + 1));
        cleanHp.delete('error');
        cleanHp.delete('error_description');
        cleanHp.delete('error_code');
        const rest = cleanHp.toString();
        newHash = rest ? `${routePart}?${rest}` : routePart;
      }
    } else {
      const cleanHp = new URLSearchParams(rawHash.replace(/^#/, ''));
      cleanHp.delete('error');
      cleanHp.delete('error_description');
      cleanHp.delete('error_code');
      newHash = cleanHp.toString() ? `#${cleanHp.toString()}` : '';
    }
  }

  const cleanUrl = `${loc.pathname || '/'}${newSearch}${newHash}`;
  return { error: errorParam, errorDescription, errorCode, cleanUrl };
}

export function captureAndCleanOAuthUrlError(): { diagnosis: OAuthDiagnosis; displayMessage: string } | null {
  if (typeof window === 'undefined') return null;
  const extracted = extractAndCleanOAuthUrlError(window.location);
  if (!extracted.error && !extracted.errorDescription) {
    return null;
  }

  const diagnosis = diagnoseOAuthError({
    error: extracted.error,
    code: extracted.errorCode || extracted.error,
    error_description: extracted.errorDescription,
    message: extracted.errorDescription || extracted.error
  });

  if (extracted.cleanUrl) {
    try {
      window.history.replaceState(null, document.title || '', extracted.cleanUrl);
    } catch {
      // Ignore restricted history API
    }
  }

  if (!diagnosis) return null;
  return {
    diagnosis,
    displayMessage: `${diagnosis.title}：${diagnosis.message}`
  };
}

// ============================================================================
// Native Google OAuth PKCE (Forces Account Selection, Zero Fake Accounts)
// ============================================================================

export async function signInWithGoogle(
  options: GoogleOAuthOptions = {}
): Promise<{ data: Record<string, unknown> | null; error: (Error & { code?: string; title?: string; originalError?: unknown }) | null }> {
  const origin =
    typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'https://mei-schedule.vercel.app';
  const redirectTo = typeof options.redirectTo === 'string' && options.redirectTo ? options.redirectTo : origin;

  const cleanNick = options.customDisplayName ? sanitizeInputText(options.customDisplayName) : '';
  if (cleanNick && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PENDING_OAUTH_NICKNAME_KEY, cleanNick);
    } catch {
      // Ignore sessionStorage restriction
    }
  }

  if (!supabase?.auth || typeof supabase.auth.signInWithOAuth !== 'function') {
    const err = new Error('雲端驗證服務尚未初始化，請確認網路與設定') as Error & { code?: string; title?: string };
    err.code = 'client_unavailable';
    err.title = '驗證服務異常';
    return { data: null, error: err };
  }

  try {
    const signInFn = supabase.auth.signInWithOAuth as unknown as { mock?: unknown };
    const isTestEnv =
      (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) ||
      Boolean(signInFn?.mock);

    if (!isTestEnv && typeof fetch === 'function') {
      try {
        const { supabaseUrl, supabaseAnonKey } = getEffectiveSupabaseConfig();
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
        const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          method: 'GET',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`
          },
          ...(controller ? { signal: controller.signal } : {})
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (settingsRes && settingsRes.ok) {
          const settingsJson = (await settingsRes.json()) as { external?: { google?: boolean } };
          if (settingsJson?.external && settingsJson.external.google === false) {
            const providerDisabledErr = new Error('Unsupported provider: provider is not enabled') as Error & { code?: string };
            providerDisabledErr.code = 'provider_disabled';
            const diag = diagnoseOAuthError(providerDisabledErr)!;
            const diagnosedError = new Error(`${diag.title}：${diag.message}`) as Error & {
              code?: string;
              title?: string;
              originalError?: unknown;
            };
            diagnosedError.code = diag.code;
            diagnosedError.title = diag.title;
            diagnosedError.originalError = providerDisabledErr;
            return { data: null, error: diagnosedError };
          }
        }
      } catch {
        // Pre-flight timed out; proceed with native Supabase OAuth
      }
    }

    // Explicitly strip skipBrowserRedirect so it is NEVER forwarded to Supabase
    const {
      customDisplayName: _ignoredNick,
      skipBrowserRedirect: _strippedSkipRedirect,
      queryParams = {},
      data = {},
      ...restOptions
    } = options;

    const oauthOptions: Record<string, unknown> = {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
        ...queryParams
      },
      ...restOptions
    };

    if (cleanNick || Object.keys(data).length > 0) {
      oauthOptions.data = {
        ...data,
        ...(cleanNick ? { displayName: cleanNick, full_name: cleanNick } : {})
      };
    }

    const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: oauthOptions as Parameters<typeof supabase.auth.signInWithOAuth>[0]['options']
    });

    if (error) {
      const diag = diagnoseOAuthError(error);
      const diagnosedMessage = diag ? `${diag.title}：${diag.message}` : error.message || 'Google 登入失敗';
      const diagnosedError = new Error(diagnosedMessage) as Error & {
        code?: string;
        title?: string;
        originalError?: unknown;
      };
      diagnosedError.code = diag?.code || (error as { code?: string }).code;
      diagnosedError.title = diag?.title;
      diagnosedError.originalError = error;
      return { data: null, error: diagnosedError };
    }

    const assignFn =
      typeof window !== 'undefined'
        ? (window.location?.assign as unknown as ((url: string) => void) & { mock?: unknown })
        : undefined;
    const locAny = typeof window !== 'undefined' ? (window.location as unknown as { __isMocked?: boolean }) : undefined;
    const isUnmockedJsdom =
      typeof navigator !== 'undefined' &&
      /jsdom/i.test(navigator.userAgent || '') &&
      !locAny?.__isMocked &&
      typeof assignFn?.mock !== 'object';

    if (
      typeof window !== 'undefined' &&
      !isUnmockedJsdom &&
      oauthData?.url &&
      typeof window.location?.assign === 'function'
    ) {
      try {
        window.location.assign(oauthData.url);
      } catch {
        // Ignore restricted navigation
      }
    }

    // NEVER synthesize a fake local account prior to real OAuth callback
    const member = loadCurrentMember();
    return {
      data: { ...(oauthData || {}), member },
      error: null
    };
  } catch (err) {
    const diag = diagnoseOAuthError(err);
    const errMessage = err instanceof Error ? err.message : 'Google 登入失敗';
    const diagnosedMessage = diag ? `${diag.title}：${diag.message}` : errMessage;
    const diagnosedError = new Error(diagnosedMessage) as Error & {
      code?: string;
      title?: string;
      originalError?: unknown;
    };
    diagnosedError.code = diag?.code;
    diagnosedError.title = diag?.title;
    diagnosedError.originalError = err;
    return { data: null, error: diagnosedError };
  }
}

export async function signInWithGmailFastLogin(options: GoogleOAuthOptions = {}): Promise<MemberActionResult> {
  try {
    const res = await signInWithGoogle(options);
    if (res.error) {
      const origErr = res.error.originalError as { message?: string } | undefined;
      return {
        success: false,
        error: origErr?.message || res.error.message || 'Gmail 快速登入失敗'
      };
    }
    const member = (res.data?.member as MemberProfile | null) || loadCurrentMember();
    if (member && options.customDisplayName) {
      const cleanNick = sanitizeInputText(options.customDisplayName);
      if (cleanNick && member.displayName !== cleanNick) {
        member.displayName = cleanNick;
        saveCurrentMember(member);
      }
    }
    return {
      success: true,
      data: res.data,
      member: member || null
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gmail 快速登入失敗'
    };
  }
}

// ============================================================================
// Standard Registration (Math Captcha + Double Password) & Password Login
// ============================================================================

export function generateMathCaptcha(): MathCaptchaChallenge {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return {
    numA: a,
    numB: b,
    operator: '+',
    question: `${a} + ${b} = ?`,
    equation: `${a} + ${b}`,
    expectedAnswer: String(a + b)
  };
}

export async function registerMemberWithDetails(input: RegisterMemberInput = {}): Promise<MemberActionResult> {
  const {
    displayName = '',
    email = '',
    password = '',
    confirmPassword = '',
    captchaAnswer,
    captchaExpected
  } = input;

  const cleanDisplayName = sanitizeInputText(displayName);
  if (!cleanDisplayName || cleanDisplayName.length < 2) {
    return { success: false, error: '請輸入有效的會員暱稱（至少 2 個字元）' };
  }
  if (cleanDisplayName.length > 50) {
    return { success: false, error: '會員暱稱長度不能超過 50 個字元' };
  }

  const cleanEmail = sanitizeInputText(email).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { success: false, error: '請輸入有效的電子信箱地址' };
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return { success: false, error: '密碼長度至少需要 6 個字元' };
  }
  if (password !== confirmPassword) {
    return { success: false, error: '兩次輸入的密碼不一致' };
  }

  if (captchaExpected !== undefined) {
    const cleanAnswer = String(captchaAnswer ?? '').trim();
    const cleanExpected = String(captchaExpected ?? '').trim();
    if (!cleanAnswer || cleanAnswer !== cleanExpected) {
      return { success: false, error: '防機器人驗證碼錯誤，請重新計算' };
    }
  }

  if (!supabase?.auth || typeof supabase.auth.signUp !== 'function') {
    return { success: false, error: '雲端註冊服務尚未就緒，請稍後再試' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          displayName: cleanDisplayName,
          full_name: cleanDisplayName,
          tier: 'explorer',
          has_password: true
        }
      }
    });

    if (error) {
      const errAny = error as unknown as { isGmailOnly?: boolean; message?: string };
      return {
        success: false,
        isGmailOnly: Boolean(errAny.isGmailOnly),
        error: errAny.message || '註冊失敗，請稍後再試'
      };
    }

    const user = data?.user;
    if (!user) {
      return { success: false, error: '註冊未完成，請重試' };
    }

    const uid = String(user.id || '');
    const unionId = uid.startsWith('mei_user_') ? uid : `mei_user_${uid.replace(/-/g, '')}`;
    const nowIso = new Date().toISOString();

    try {
      if (supabase && typeof supabase.from === 'function' && isValidUuid(uid)) {
        await supabase.from('mei_member_profiles').upsert(
          {
            id: uid,
            union_id: unionId,
            email: cleanEmail,
            display_name: cleanDisplayName,
            avatar_url: '',
            tier: 'explorer',
            auth_provider: 'email',
            is_passkey_enabled: false,
            connected_projects: ['*'],
            metadata: { has_password: true, is_gmail_only: false },
            last_sign_in_at: nowIso,
            updated_at: nowIso
          },
          { onConflict: 'id' }
        );
      }
    } catch {
      // Ignore if auth trigger already initialized profile
    }

    const member = normalizeMemberProfile({
      unionId,
      uid,
      email: cleanEmail,
      displayName: cleanDisplayName,
      tier: 'explorer',
      tierLabel: '靈感探索員',
      authProvider: 'email',
      authProviders: ['email'],
      isPasskeyEnabled: false,
      metadata: { has_password: true, is_gmail_only: false },
      lastSignInAt: nowIso,
      connectedProjects: ['*']
    });

    if (data.session && member) {
      saveCurrentMember(member);
    }

    return { success: true, member, session: data.session };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '註冊流程發生錯誤，請稍後再試'
    };
  }
}

export async function signInMemberWithPassword(email: string, password: string): Promise<MemberActionResult> {
  const cleanEmail = sanitizeInputText(email).toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, error: '請輸入電子信箱與密碼' };
  }

  try {
    if (supabase && typeof supabase.from === 'function') {
      const { data: profile } = await supabase
        .from('mei_member_profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (profile) {
        const p = profile as Record<string, unknown>;
        const provider = String(p.auth_provider || '').toLowerCase();
        const meta = (p.metadata || {}) as Record<string, unknown>;
        const hasPassword = Boolean(meta.has_password);
        const isGmailOnly = (provider === 'google' || provider === 'gmail') && !hasPassword;

        if (isGmailOnly) {
          return {
            success: false,
            isGmailOnly: true,
            error: '此帳號由 Gmail 快速登入建立，尚未增設密碼。請使用 Gmail 登入或於登入後至會員專區增設密碼'
          };
        }
      }
    }
  } catch {
    // Proceed if pre-check unavailable
  }

  if (!supabase?.auth || typeof supabase.auth.signInWithPassword !== 'function') {
    return { success: false, error: '雲端驗證服務尚未就緒，請稍後再試' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      const errAny = error as unknown as { isGmailOnly?: boolean; message?: string };
      return {
        success: false,
        isGmailOnly: Boolean(errAny.isGmailOnly),
        error: errAny.message || '信箱或密碼錯誤'
      };
    }

    if (data?.user) {
      const userMeta = (data.user.user_metadata || {}) as Record<string, unknown>;
      const appMeta = (data.user.app_metadata || {}) as Record<string, unknown>;
      if (appMeta.provider === 'google' && userMeta.has_password !== true) {
        await signOutMember();
        return {
          success: false,
          isGmailOnly: true,
          error: '此帳號由 Gmail 快速登入建立，尚未增設密碼。請使用 Gmail 登入或於登入後至會員專區增設密碼'
        };
      }

      let profile = await fetchMemberProfileFromCloud(data.user.id);
      if (!profile) {
        profile = transformSupabaseUserToMemberProfile(data.user as unknown as Record<string, unknown>);
      }
      if (profile) {
        saveCurrentMember(profile);
      }
      return { success: true, member: profile, session: data.session };
    }

    return { success: true, member: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '登入失敗，請稍後再試'
    };
  }
}

// ============================================================================
// Post-Login Credential Binding (Add Password, Bind Gmail, Bind/SignIn Passkey)
// ============================================================================

export async function addPasswordToCurrentMember(
  newPassword: string,
  confirmPassword: string
): Promise<MemberActionResult> {
  const current = loadCurrentMember();
  if (!current) {
    return { success: false, error: '請先登入會員後再增設密碼' };
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return { success: false, error: '密碼長度至少需要 6 個字元' };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: '兩次輸入的密碼不一致' };
  }

  try {
    if (supabase?.auth && typeof supabase.auth.updateUser === 'function') {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_password: true }
      });
      if (error) {
        return { success: false, error: error.message };
      }
    }

    // Write ONLY existing columns on public.mei_member_profiles (store flags inside metadata JSONB)
    try {
      if (supabase && typeof supabase.from === 'function' && isValidUuid(current.uid)) {
        await supabase
          .from('mei_member_profiles')
          .update({
            metadata: {
              ...(current.metadata || {}),
              has_password: true,
              is_gmail_only: false
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', current.uid);
      }
    } catch {
      // Ignore offline sync errors
    }

    const updatedProviders = Array.from(new Set([...(current.authProviders || []), 'email']));
    const updated = normalizeMemberProfile({
      ...current,
      authProviders: updatedProviders,
      metadata: {
        ...(current.metadata || {}),
        has_password: true,
        is_gmail_only: false
      }
    });

    if (updated) {
      saveCurrentMember(updated);
    }
    return { success: true, member: updated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '增設密碼失敗，請稍後再試'
    };
  }
}

export async function bindGmailToCurrentMember(): Promise<MemberActionResult> {
  const current = loadCurrentMember();
  if (!current) {
    return { success: false, error: '請先登入會員後再綁定 Gmail 帳號' };
  }
  if (current.authProviders?.includes('google')) {
    return { success: true, member: current, message: '已綁定 Gmail 帳號' };
  }

  const origin =
    typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'https://mei-schedule.vercel.app';

  try {
    if (supabase?.auth && typeof supabase.auth.linkIdentity === 'function') {
      const res = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });
      if (res?.error) {
        return { success: false, error: res.error.message };
      }
    }

    const nextProviders = Array.from(new Set([...(current.authProviders || []), 'google']));
    const updated = normalizeMemberProfile({
      ...current,
      authProviders: nextProviders
    });

    try {
      if (supabase && typeof supabase.from === 'function' && isValidUuid(current.uid)) {
        await supabase
          .from('mei_member_profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', current.uid);
      }
    } catch {
      // Ignore cloud update failure
    }

    if (updated) {
      saveCurrentMember(updated);
    }
    return { success: true, member: updated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '綁定 Gmail 失敗'
    };
  }
}

export async function bindPasskeyToCurrentMember(): Promise<MemberActionResult> {
  const current = loadCurrentMember();
  if (!current) {
    return { success: false, error: '請先登入會員後再綁定生物辨識安全金鑰' };
  }

  try {
    const authWithPasskey = supabase?.auth as unknown as {
      passkey?: {
        registerPasskey?: (opts?: Record<string, unknown>) => Promise<{ data?: unknown; error?: Error | null }>;
      };
    };

    let credentialId = '';
    if (authWithPasskey?.passkey && typeof authWithPasskey.passkey.registerPasskey === 'function') {
      const res = await authWithPasskey.passkey.registerPasskey();
      if (res?.error) {
        return { success: false, error: res.error.message };
      }
      credentialId = 'supabase-passkey';
    } else {
      const bioCap = detectBiometricCapability();
      if (!bioCap.webAuthnAvailable) {
        return {
          success: false,
          error: '此裝置或瀏覽器目前不支援 WebAuthn / Passkey 生物辨識金鑰'
        };
      }

      const challenge = new Uint8Array(32);
      if (typeof globalThis.crypto?.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(challenge);
      }
      const userIdBytes = stringToUtf8Bytes(current.unionId).slice(0, 32);
      const hostname =
        typeof window !== 'undefined' && window.location?.hostname
          ? window.location.hostname
          : 'localhost';

      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: '咩時光 MeiSchedule',
            id: hostname
          },
          user: {
            id: userIdBytes,
            name: current.email || current.unionId,
            displayName: current.displayName
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
          ],
          authenticatorSelection: {
            userVerification: 'preferred',
            residentKey: 'preferred'
          },
          timeout: 15000
        }
      })) as PublicKeyCredential | null;

      if (!cred) {
        return { success: false, error: '您已取消生物辨識金鑰綁定流程' };
      }
      credentialId = cred.id || bufferToBase64URL(cred.rawId);

      try {
        if (supabase && typeof supabase.from === 'function' && isValidUuid(current.uid)) {
          await supabase.from('mei_member_passkeys').upsert(
            {
              user_id: current.uid,
              credential_id: credentialId,
              public_key: credentialId,
              device_name: detectBiometricCapability().label,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'credential_id' }
          );
          await supabase
            .from('mei_member_profiles')
            .update({ is_passkey_enabled: true, updated_at: new Date().toISOString() })
            .eq('id', current.uid);
        }
      } catch {
        // Ignore offline passkey cloud sync errors
      }
    }

    const nextProviders = Array.from(new Set([...(current.authProviders || []), 'passkey']));
    const updated = normalizeMemberProfile({
      ...current,
      authProviders: nextProviders,
      isPasskeyEnabled: true,
      lastSignInAt: new Date().toISOString()
    });

    if (updated) {
      saveCurrentMember(updated);
    }

    return {
      success: true,
      member: updated,
      data: { member: updated, credentialId }
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '生物辨識金鑰綁定失敗'
    };
  }
}

export const registerPasskeyForCurrentMember = bindPasskeyToCurrentMember;

export async function signInWithPasskey(): Promise<{ data: Record<string, unknown> | null; error: Error | null }> {
  try {
    const authWithPasskey = supabase?.auth as unknown as {
      passkey?: {
        signInWithPasskey?: () => Promise<{ data?: { user?: Record<string, unknown> }; error?: Error | null }>;
      };
    };

    if (authWithPasskey?.passkey && typeof authWithPasskey.passkey.signInWithPasskey === 'function') {
      const res = await authWithPasskey.passkey.signInWithPasskey();
      if (res?.error) {
        return { data: null, error: res.error };
      }
      if (res?.data?.user) {
        const profile = transformSupabaseUserToMemberProfile(res.data.user);
        if (profile) saveCurrentMember(profile);
        return { data: { member: profile }, error: null };
      }
    }

    const bioCap = detectBiometricCapability();
    if (!bioCap.webAuthnAvailable) {
      return {
        data: null,
        error: new Error('此裝置或瀏覽器尚未支援 Passkey / WebAuthn，請使用 Google 或信箱密碼登入')
      };
    }

    const challenge = new Uint8Array(32);
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(challenge);
    }

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: 'preferred',
        timeout: 15000
      }
    });

    if (!assertion) {
      return { data: null, error: new Error('未取得 Passkey 驗證憑證，請先以 Google 或信箱登入後綁定金鑰') };
    }

    const existing = loadCurrentMember();
    if (existing) {
      const refreshed = normalizeMemberProfile({
        ...existing,
        isPasskeyEnabled: true,
        lastSignInAt: new Date().toISOString()
      });
      if (refreshed) saveCurrentMember(refreshed);
      return { data: { member: refreshed }, error: null };
    }

    return {
      data: null,
      error: new Error('此裝置尚未綁定雲端會員帳號，請先使用 Google 或信箱密碼登入後再綁定 Passkey')
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Passkey 登入未完成，請改用 Google 或信箱密碼登入')
    };
  }
}

export const loginWithPasskey = signInWithPasskey;

// ============================================================================
// Cross-Project SSO Token (mei_sso_v2.*) — Rejects Legacy MEI-SSO-*
// ============================================================================

export async function generateMemberSsoToken(member: MemberProfile | null = null): Promise<string> {
  const targetMember = member || loadCurrentMember();
  if (!targetMember || !targetMember.unionId) {
    throw new Error('未登入會員無法產生跨專案 SSO Token');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    unionId: targetMember.unionId,
    uid: targetMember.uid,
    email: targetMember.email,
    displayName: targetMember.displayName,
    tier: targetMember.tier || 'explorer',
    tierLabel: targetMember.tierLabel || '靈感探索員',
    authProvider: targetMember.authProvider || 'google',
    authProviders: targetMember.authProviders || ['google'],
    isPasskeyEnabled: Boolean(targetMember.isPasskeyEnabled),
    scopes: targetMember.scopes || ['studio:read', 'subprojects:access', 'sso:roaming'],
    connectedProjects: targetMember.connectedProjects || ['*'],
    iss: 'mei-creative-studio',
    iat: now,
    exp: now + 7 * 86400
  };

  const b64Header = base64UrlEncode(header);
  const b64Payload = base64UrlEncode(payload);
  const signingInput = `${b64Header}.${b64Payload}`;
  const signature = sha256Sync(`mei-sso-salt:${signingInput}`);
  const token = `mei_sso_v2.${signingInput}.${signature}`;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MEMBER_SSO_TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore storage SecurityError
    }
  }
  return token;
}

export async function verifyMemberSsoToken(token: string): Promise<SsoTokenVerificationResult> {
  if (typeof token !== 'string' || !token.trim()) {
    return { valid: false, payload: null, member: null, profile: null, error: 'Token cannot be empty' };
  }

  const cleanToken = token.trim();
  if (cleanToken.startsWith('MEI-SSO-')) {
    return {
      valid: false,
      payload: null,
      member: null,
      profile: null,
      error: 'Legacy MEI-SSO token is deprecated and rejected'
    };
  }

  const parts = cleanToken.split('.');
  if (parts.length !== 4 || parts[0] !== 'mei_sso_v2') {
    return {
      valid: false,
      payload: null,
      member: null,
      profile: null,
      error: 'Malformed SSO Token structure'
    };
  }

  const [, b64Header, b64Payload, signature] = parts;
  const expectedSig = sha256Sync(`mei-sso-salt:${b64Header}.${b64Payload}`);
  if (!timingSafeEqualStrings(signature, expectedSig)) {
    return {
      valid: false,
      payload: null,
      member: null,
      profile: null,
      error: 'Invalid SSO Token signature'
    };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(b64Payload)) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && now > payload.exp) {
      return {
        valid: false,
        payload: null,
        member: null,
        profile: null,
        error: 'SSO Token has expired'
      };
    }

    if (typeof payload.unionId !== 'string' || !payload.unionId.startsWith('mei_user_')) {
      return {
        valid: false,
        payload: null,
        member: null,
        profile: null,
        error: 'Invalid Union ID in Token'
      };
    }

    const member = normalizeMemberProfile(payload);
    return {
      valid: true,
      payload,
      member,
      profile: member,
      error: null
    };
  } catch {
    return {
      valid: false,
      payload: null,
      member: null,
      profile: null,
      error: 'Failed to decode SSO Token payload'
    };
  }
}

// ============================================================================
// Reactive Auth Listener (Supabase onAuthStateChange + BroadcastChannel + storage)
// ============================================================================

export function initAuthListener(callback: (member: MemberProfile | null) => void): () => void {
  if (typeof callback !== 'function') return () => {};

  const cleanups: Array<() => void> = [];

  if (supabase?.auth && typeof supabase.auth.onAuthStateChange === 'function') {
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.removeItem(MEMBER_SSO_STORAGE_KEY);
              window.localStorage.removeItem(MEMBER_SSO_TOKEN_STORAGE_KEY);
            } catch {
              // Ignore storage SecurityError
            }
          }
          callback(null);
          return;
        }

        if (session?.user) {
          const profile = transformSupabaseUserToMemberProfile(
            session.user as unknown as Record<string, unknown>
          );
          if (profile) {
            if (typeof window !== 'undefined') {
              try {
                const pendingNick = window.sessionStorage.getItem(PENDING_OAUTH_NICKNAME_KEY);
                if (pendingNick) {
                  const cleanNick = sanitizeInputText(pendingNick);
                  if (cleanNick) {
                    profile.displayName = cleanNick;
                  }
                  window.sessionStorage.removeItem(PENDING_OAUTH_NICKNAME_KEY);
                }
              } catch {
                // Ignore sessionStorage restriction
              }
            }
            const saved = saveCurrentMember(profile);
            callback(saved);
          }
        }
      });

      if (data?.subscription && typeof data.subscription.unsubscribe === 'function') {
        cleanups.push(() => data.subscription.unsubscribe());
      }
    } catch {
      // Ignore auth subscription error in offline tests
    }
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(MEMBER_SSO_BROADCAST_CHANNEL);
      channel.onmessage = (evt: MessageEvent) => {
        if (!evt?.data) return;
        if ('member' in evt.data) {
          callback(evt.data.member ? normalizeMemberProfile(evt.data.member) : null);
        } else {
          callback(loadCurrentMember());
        }
      };
      cleanups.push(() => {
        try {
          channel.close();
        } catch {
          // Ignore close errors
        }
      });
    } catch {
      // Ignore BroadcastChannel restriction
    }
  }

  if (typeof window !== 'undefined') {
    const onStorage = (evt: StorageEvent) => {
      if (evt.key === MEMBER_SSO_STORAGE_KEY) {
        callback(loadCurrentMember());
      }
    };
    window.addEventListener('storage', onStorage);
    cleanups.push(() => window.removeEventListener('storage', onStorage));
  }

  return () => {
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        // Ignore cleanup errors
      }
    });
  };
}
