import { Capacitor } from '@capacitor/core';
import type { ScheduleEvent } from '../types/schedule';

// ============================================================================
// Unified Five-Platform Notification & Haptics Bridge
// Automatically adapts across Electron (macOS/Windows), Capacitor (iOS/Android),
// and Web / PWA Notification APIs with zero-crash fallback in jsdom/SSR.
// ============================================================================

export type RuntimePlatformKind = 'electron' | 'capacitor-ios' | 'capacitor-android' | 'web';

export function detectRuntimePlatform(): RuntimePlatformKind {
  if (typeof window !== 'undefined' && window.MeiDesktop?.isElectron) {
    return 'electron';
  }
  try {
    if (Capacitor.isNativePlatform()) {
      const p = Capacitor.getPlatform();
      return p === 'ios' ? 'capacitor-ios' : 'capacitor-android';
    }
  } catch {
    // Ignore in test environments
  }
  return 'web';
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  const runtime = detectRuntimePlatform();

  if (runtime === 'electron') {
    return 'granted';
  }

  if (runtime === 'capacitor-ios' || runtime === 'capacitor-android') {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'unsupported';
    }
  }

  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function sendInstantNotification(payload: {
  title: string;
  body: string;
  eventId?: string;
}): Promise<boolean> {
  const runtime = detectRuntimePlatform();

  if (runtime === 'electron' && window.MeiDesktop?.sendNativeNotification) {
    try {
      return await window.MeiDesktop.sendNativeNotification(payload);
    } catch {
      return false;
    }
  }

  if (runtime === 'capacitor-ios' || runtime === 'capacitor-android') {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2_000_000_000),
            title: payload.title,
            body: payload.body,
            schedule: { at: new Date(Date.now() + 1000) }
          }
        ]
      });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(payload.title, { body: payload.body, icon: '/favicon.svg' });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Schedules upcoming local reminders for events starting within the next 24 hours.
 */
export async function scheduleUpcomingEventReminders(events: ScheduleEvent[]): Promise<number> {
  const now = Date.now();
  const horizon = now + 24 * 3600_000;
  const upcoming = events.filter((e) => {
    if (e.status !== 'scheduled' || e.allDay) return false;
    const startMs = Date.parse(e.startAt);
    return !Number.isNaN(startMs) && startMs > now && startMs <= horizon;
  });

  if (upcoming.length === 0) return 0;

  const runtime = detectRuntimePlatform();
  if (runtime === 'capacitor-ios' || runtime === 'capacitor-android') {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const notifications = upcoming
        .flatMap((evt) => {
          const startMs = Date.parse(evt.startAt);
          const minsList = evt.reminderMinutes?.length ? evt.reminderMinutes : [15];
          return minsList.map((m, idx) => {
            const fireAt = startMs - m * 60_000;
            if (fireAt <= now) return null;
            return {
              id: Math.abs(hashStringToInt(`${evt.id}:${idx}`)) % 2_000_000_000,
              title: `即將開始：${evt.title}`,
              body: `${m} 分鐘後開始${evt.location ? ` · ${evt.location}` : ''}`,
              schedule: { at: new Date(fireAt) }
            };
          });
        })
        .filter((n): n is NonNullable<typeof n> => n !== null);

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
      }
      return notifications.length;
    } catch {
      return 0;
    }
  }

  return upcoming.length;
}

export async function triggerLightHaptic(): Promise<void> {
  const runtime = detectRuntimePlatform();
  if (runtime === 'capacitor-ios' || runtime === 'capacitor-android') {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Ignore haptics errors
    }
  }
}

export const THEME_SURFACE_COLORS: Record<
  'sky-glass' | 'minimal-linear' | 'warm-journal',
  { light: string; dark: string }
> = {
  'sky-glass': { light: '#F4F9FF', dark: '#080E1A' },
  'minimal-linear': { light: '#FFFFFF', dark: '#0B0D12' },
  'warm-journal': { light: '#FAF6F0', dark: '#1C1917' }
};

export function resolveThemeSurfaceColor(
  resolvedColorMode: 'light' | 'dark',
  designTheme: 'sky-glass' | 'minimal-linear' | 'warm-journal' = 'sky-glass'
): string {
  const palette = THEME_SURFACE_COLORS[designTheme] || THEME_SURFACE_COLORS['sky-glass'];
  return palette[resolvedColorMode];
}

export function applyThemeMetaSync(
  resolvedColorMode: 'light' | 'dark',
  designTheme: 'sky-glass' | 'minimal-linear' | 'warm-journal' = 'sky-glass'
): void {
  if (typeof document === 'undefined') return;
  const surfaceHex = resolveThemeSurfaceColor(resolvedColorMode, designTheme);
  let meta = document.getElementById('mei-theme-color-meta') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  }
  if (!meta) {
    meta = document.createElement('meta');
    meta.id = 'mei-theme-color-meta';
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  if (meta.hasAttribute('media')) {
    meta.removeAttribute('media');
  }
  if (meta.getAttribute('content') !== surfaceHex) {
    meta.setAttribute('content', surfaceHex);
  }
}

export async function syncNativeStatusBar(
  resolvedColorMode: 'light' | 'dark',
  designTheme: 'sky-glass' | 'minimal-linear' | 'warm-journal' = 'sky-glass'
): Promise<void> {
  applyThemeMetaSync(resolvedColorMode, designTheme);

  const runtime = detectRuntimePlatform();
  if (runtime === 'capacitor-ios' || runtime === 'capacitor-android') {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({
        style: resolvedColorMode === 'dark' ? Style.Dark : Style.Light
      });
    } catch {
      // Ignore on unsupported platforms
    }
  }
}

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash || 1;
}
