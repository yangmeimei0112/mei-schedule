import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';

/**
 * 咩時光 (MeiSchedule) — 直連咩創意工作室獨立 Supabase 雲端資料庫
 * Project Ref: xtyuyuralrnwzsjvyslp (Region: ap-northeast-1)
 */
export const DEFAULT_SUPABASE_URL = 'https://xtyuyuralrnwzsjvyslp.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0eXV5dXJhbHJud3pzanZ5c2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MTUxOTgsImV4cCI6MjExMDI5MTE5OH0.a_jvAqs6xH8wUf6-x9pn6uAtbfH6qTjdF3QK3vDQ6FY';

const CUSTOM_URL_STORAGE_KEY = 'mei_custom_supabase_url';
const CUSTOM_KEY_STORAGE_KEY = 'mei_custom_supabase_anon_key';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isCustom: boolean;
}

type MeiSupabaseClientOptions = SupabaseClientOptions<'public'> & {
  auth?: NonNullable<SupabaseClientOptions<'public'>['auth']> & {
    experimental?: {
      passkey?: boolean;
    };
  };
};

export function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getEffectiveSupabaseConfig(): SupabaseConfig {
  let customUrl = '';
  let customKey = '';

  if (typeof window !== 'undefined') {
    try {
      customUrl = window.localStorage.getItem(CUSTOM_URL_STORAGE_KEY)?.trim() || '';
      customKey = window.localStorage.getItem(CUSTOM_KEY_STORAGE_KEY)?.trim() || '';
    } catch {
      // Ignore storage SecurityError in restricted environments
    }
  }

  if (isValidHttpUrl(customUrl) && customKey) {
    return {
      supabaseUrl: customUrl,
      supabaseAnonKey: customKey,
      isCustom: true
    };
  }

  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
      ? String(import.meta.env.VITE_SUPABASE_URL).trim()
      : '';
  const envKey =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY
      ? String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim()
      : '';

  if (isValidHttpUrl(envUrl) && envKey && envKey !== 'your-supabase-anon-key-here') {
    return {
      supabaseUrl: envUrl,
      supabaseAnonKey: envKey,
      isCustom: false
    };
  }

  return {
    supabaseUrl: DEFAULT_SUPABASE_URL,
    supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
    isCustom: false
  };
}

export function saveCustomSupabaseConfig(url: string, anonKey: string): boolean {
  if (!isValidHttpUrl(url) || !anonKey?.trim()) return false;
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(CUSTOM_URL_STORAGE_KEY, url.trim());
    window.localStorage.setItem(CUSTOM_KEY_STORAGE_KEY, anonKey.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearCustomSupabaseConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CUSTOM_URL_STORAGE_KEY);
    window.localStorage.removeItem(CUSTOM_KEY_STORAGE_KEY);
  } catch {
    // Ignore storage SecurityError
  }
}

const clientOptions: MeiSupabaseClientOptions = {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'mei_studio_supabase_auth_token_v1',
    experimental: {
      passkey: true
    }
  }
};

function createSafeSupabaseClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = getEffectiveSupabaseConfig();
  try {
    return createClient(
      supabaseUrl,
      supabaseAnonKey,
      clientOptions as Parameters<typeof createClient>[2]
    );
  } catch {
    try {
      return createClient(
        DEFAULT_SUPABASE_URL,
        DEFAULT_SUPABASE_ANON_KEY,
        clientOptions as Parameters<typeof createClient>[2]
      );
    } catch {
      return null;
    }
  }
}

export const supabase: SupabaseClient | null = createSafeSupabaseClient();
