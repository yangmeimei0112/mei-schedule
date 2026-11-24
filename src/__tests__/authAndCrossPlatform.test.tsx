import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import App, { extractAndCleanOAuthUrlError } from '../App';
import MemberPortalModal from '../components/MemberPortalModal';
import { createSeedScheduleData } from '../data/seedData';
import * as localStore from '../services/localStore';
import {
  addPasswordToCurrentMember,
  diagnoseOAuthError,
  generateMemberSsoToken,
  loadCurrentMember,
  saveCurrentMember,
  signInWithGoogle,
  verifyMemberSsoToken,
  type MemberProfile
} from '../services/memberAuthService';
import {
  eventToRow,
  mergeLocalAndCloudOnSignIn,
  rekeyLocalDataForUser,
  rowToEvent
} from '../services/scheduleSyncService';
import { supabase } from '../services/supabaseClient';
import {
  MAX_HISTORY_DEPTH,
  ScheduleProvider,
  useScheduleStore,
  type ScheduleStoreContextValue
} from '../store/useScheduleStore';

const ROOT_DIR = path.resolve(__dirname, '../..');
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

describe('M1 Auth SSO v3.0, Local-First Persistence, Undo/Redo & Isolated SQL Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('enforces native Google OAuth with prompt=select_account, access_type=offline, strips skipBrowserRedirect, and never synthesizes fake accounts', async () => {
    expect(supabase).not.toBeNull();
    const oauthSpy = vi.spyOn(supabase!.auth, 'signInWithOAuth').mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/v2/auth?prompt=select_account' },
      error: null
    } as Awaited<ReturnType<SupabaseClient['auth']['signInWithOAuth']>>);

    const res = await signInWithGoogle({ skipBrowserRedirect: true });
    expect(res.error).toBeNull();
    expect(oauthSpy).toHaveBeenCalledTimes(1);

    const callArg = oauthSpy.mock.calls[0][0];
    expect(callArg.provider).toBe('google');
    expect(callArg.options?.queryParams?.access_type).toBe('offline');
    expect(callArg.options?.queryParams?.prompt).toBe('select_account');
    expect((callArg.options as Record<string, unknown>)?.skipBrowserRedirect).toBeUndefined();
    expect(loadCurrentMember()).toBeNull();

    // Static compliance checks on supabaseClient.ts & memberAuthService.ts
    const supaSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/services/supabaseClient.ts'), 'utf8');
    const authSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/services/memberAuthService.ts'), 'utf8');
    expect(supaSrc).toContain('xtyuyuralrnwzsjvyslp');
    expect(supaSrc).toContain("flowType: 'pkce'");
    expect(authSrc).toContain("prompt: 'select_account'");
    expect(authSrc).toContain("access_type: 'offline'");
    expect(authSrc).not.toContain('skipBrowserRedirect: true');
    expect(authSrc).not.toContain('signInWithApple');
    expect(authSrc).not.toContain('creator@' + 'meistudio.live');

    // Diagnose OAuth Error Chinese diagnostics (6 branches, Zero Emoji)
    const cases: Array<[unknown, string]> = [
      [{ message: 'Unsupported provider: provider is not enabled' }, 'Google 登入服務尚未啟用'],
      [{ code: 'invalid_client', message: 'client id is invalid' }, 'Google API 憑證無效'],
      [{ message: 'redirect_uri_mismatch' }, 'OAuth 重定向網址不符合'],
      [{ error: 'access_denied', error_description: 'User cancelled' }, '已取消 Google 帳號授權'],
      [{ message: 'popup_closed_by_user' }, '授權視窗已被關閉'],
      [{ message: 'Failed to fetch network error' }, '網路連線異常']
    ];
    for (const [input, expectedTitle] of cases) {
      const diag = diagnoseOAuthError(input);
      expect(diag?.title).toBe(expectedTitle);
      expect(EMOJI_REGEX.test(`${diag?.title}${diag?.message}`)).toBe(false);
    }
  });

  it('captures and cleans OAuth URL errors while strictly preserving #/tray route hash', async () => {
    const qErr = extractAndCleanOAuthUrlError({
      pathname: '/',
      search: '?error=access_denied&error_description=User+cancelled',
      hash: ''
    });
    expect(qErr.error).toBe('access_denied');
    expect(qErr.cleanUrl).toBe('/');

    const hErr = extractAndCleanOAuthUrlError({
      pathname: '/',
      search: '',
      hash: '#error=provider_disabled&error_description=provider+is+not+enabled'
    });
    expect(hErr.error).toBe('provider_disabled');
    expect(hErr.cleanUrl).toBe('/');

    // Critical Edge Case E02: ?error=...#/tray MUST preserve #/tray verbatim
    const trayWithSearchErr = extractAndCleanOAuthUrlError({
      pathname: '/',
      search: '?error=access_denied&keep=1',
      hash: '#/tray'
    });
    expect(trayWithSearchErr.error).toBe('access_denied');
    expect(trayWithSearchErr.cleanUrl).toBe('/?keep=1#/tray');

    const trayWithHashQueryErr = extractAndCleanOAuthUrlError({
      pathname: '/',
      search: '',
      hash: '#/tray?error=access_denied'
    });
    expect(trayWithHashQueryErr.error).toBe('access_denied');
    expect(trayWithHashQueryErr.cleanUrl).toBe('#/tray'.replace(/^/, '/'));

    // Clean #/tray must NOT be touched at all
    const cleanTray = extractAndCleanOAuthUrlError({
      pathname: '/',
      search: '',
      hash: '#/tray'
    });
    expect(cleanTray.error).toBeNull();
    expect(cleanTray.cleanUrl).toBeNull();

    // App mount integration check: ?error=access_denied#/tray displays toast and preserves #/tray
    window.history.replaceState(null, '', '/?error=access_denied&error_description=User+cancelled#/tray');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('已取消 Google 帳號授權');
    });
    expect(window.location.hash).toBe('#/tray');
    expect(window.location.search).toBe('');
  });

  it('supports math captcha registration, blocks Gmail-only password login, and stores has_password strictly inside metadata JSONB', async () => {
    const signUpSpy = vi.spyOn(supabase!.auth, 'signUp').mockResolvedValue({
      data: {
        user: {
          id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          email: 'test.schedule@example.com',
          user_metadata: { displayName: '測試排程員', has_password: true },
          app_metadata: { provider: 'email' }
        },
        session: { access_token: 'tok-123' }
      },
      error: null
    } as unknown as Awaited<ReturnType<SupabaseClient['auth']['signUp']>>);

    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: updateEqMock }));
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: '11111111-2222-4333-8444-555555555555',
        email: 'gmail.only@gmail.com',
        auth_provider: 'google',
        metadata: { has_password: false }
      },
      error: null
    });
    vi.spyOn(supabase!, 'from').mockImplementation(() => ({
      upsert: upsertMock,
      update: updateMock,
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) }))
    }) as unknown as ReturnType<SupabaseClient['from']>);

    const onMemberChange = vi.fn();
    const { rerender } = render(
      <MemberPortalModal
        isOpen={true}
        onClose={vi.fn()}
        currentMember={null}
        onMemberChange={onMemberChange}
        onNotify={vi.fn()}
      />
    );

    // Default tab is quick -> Google login button immediately visible
    expect(screen.getByTestId('member-google-login-btn')).toBeInTheDocument();

    // Switch to register tab and test wrong captcha first
    fireEvent.click(screen.getByTestId('auth-tab-register'));
    const captchaText = screen.getByTestId('register-captcha-code').textContent || '';
    const m = captchaText.match(/(\d+)\s*\+\s*(\d+)/);
    expect(m).not.toBeNull();
    const wrongSum = String(Number(m![1]) + Number(m![2]) + 7);

    fireEvent.change(screen.getByTestId('register-name-input'), { target: { value: '測試排程員' } });
    fireEvent.change(screen.getByTestId('register-email-input'), { target: { value: 'test.schedule@example.com' } });
    fireEvent.change(screen.getByTestId('register-password-input'), { target: { value: 'Secret123!' } });
    fireEvent.change(screen.getByTestId('register-confirm-password-input'), { target: { value: 'Secret123!' } });
    fireEvent.change(screen.getByTestId('register-captcha-input'), { target: { value: wrongSum } });
    fireEvent.click(screen.getByTestId('register-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('register-error-msg')).toHaveTextContent('防機器人驗證碼錯誤');
    });
    expect(signUpSpy).not.toHaveBeenCalled();

    // Re-read refreshed captcha and submit correct answer
    const refreshedText = screen.getByTestId('register-captcha-code').textContent || '';
    const m2 = refreshedText.match(/(\d+)\s*\+\s*(\d+)/);
    expect(m2).not.toBeNull();
    const correctSum = String(Number(m2![1]) + Number(m2![2]));

    fireEvent.change(screen.getByTestId('register-captcha-input'), { target: { value: correctSum } });
    fireEvent.click(screen.getByTestId('register-submit-btn'));

    await waitFor(() => {
      expect(signUpSpy).toHaveBeenCalledTimes(1);
    });
    const signUpArg = signUpSpy.mock.calls[0][0];
    expect('email' in signUpArg && signUpArg.email).toBe('test.schedule@example.com');
    expect((signUpArg.options?.data as Record<string, unknown>)?.has_password).toBe(true);

    // Switch to password login and verify Gmail-only blocker
    fireEvent.click(screen.getByTestId('auth-tab-login'));
    fireEvent.change(screen.getByTestId('member-email-input'), { target: { value: 'gmail.only@gmail.com' } });
    fireEvent.change(screen.getByTestId('member-password-input'), { target: { value: 'AnyPass123' } });
    fireEvent.click(screen.getByTestId('member-email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('switch-to-gmail-login-btn')).toBeInTheDocument();
    });

    // Render authenticated Gmail-only user and verify addPassword writes ONLY metadata JSONB
    const gmailUser: MemberProfile = {
      schemaVersion: '2.0.0',
      unionId: 'mei_user_11111111222243338444555555555555',
      uid: '11111111-2222-4333-8444-555555555555',
      email: 'gmail.only@gmail.com',
      displayName: '晴空會員',
      avatarUrl: '',
      tier: 'explorer',
      tierLabel: '靈感探索員',
      scopes: ['studio:read', 'subprojects:access', 'sso:roaming'],
      authProvider: 'google',
      authProviders: ['google'],
      isPasskeyEnabled: false,
      lastSignInAt: new Date().toISOString(),
      connectedProjects: ['*'],
      metadata: { has_password: false }
    };
    saveCurrentMember(gmailUser);

    rerender(
      <MemberPortalModal
        isOpen={true}
        onClose={vi.fn()}
        currentMember={gmailUser}
        onMemberChange={onMemberChange}
        onNotify={vi.fn()}
      />
    );

    expect(screen.getByTestId('member-profile-card')).toBeInTheDocument();
    expect(screen.getByTestId('member-add-password-section')).toBeInTheDocument();
    expect(screen.getByTestId('member-bind-google-btn')).toBeDisabled();
    expect(screen.getByTestId('member-bind-passkey-btn')).toBeInTheDocument();
    expect(screen.getByTestId('member-signout-btn')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('member-sso-token-display')).toHaveTextContent('mei_sso_v2.');
    });

    vi.spyOn(supabase!.auth, 'updateUser').mockResolvedValue({
      data: { user: null },
      error: null
    } as unknown as Awaited<ReturnType<SupabaseClient['auth']['updateUser']>>);

    const addPwdRes = await addPasswordToCurrentMember('NewSecret123!', 'NewSecret123!');
    expect(addPwdRes.success).toBe(true);
    expect(updateMock).toHaveBeenCalled();
    const updatePayload = updateMock.mock.calls[0][0];
    expect((updatePayload.metadata as Record<string, unknown>)?.has_password).toBe(true);
    expect('has_password' in updatePayload).toBe(false);
    expect('is_gmail_only' in updatePayload).toBe(false);
  });

  it('validates mei_sso_v2.* tokens, rejects legacy MEI-SSO-*, and verifies mei-dock.js suppresses DOM in #/tray while preserving window.MeiStudioSSO', async () => {
    const member: MemberProfile = {
      schemaVersion: '2.0.0',
      unionId: 'mei_user_abcdef123456',
      uid: 'abcdef123456',
      email: 'member@example.com',
      displayName: '咩時光夥伴',
      avatarUrl: '',
      tier: 'creator',
      tierLabel: '創意造物者',
      scopes: ['studio:read', 'subprojects:access', 'sso:roaming'],
      authProvider: 'google',
      authProviders: ['google'],
      isPasskeyEnabled: false,
      lastSignInAt: new Date().toISOString(),
      connectedProjects: ['*'],
      metadata: { has_password: false }
    };

    const token = await generateMemberSsoToken(member);
    expect(token.startsWith('mei_sso_v2.')).toBe(true);
    expect(token.split('.')).toHaveLength(4);

    const ok = await verifyMemberSsoToken(token);
    expect(ok.valid).toBe(true);
    expect(ok.member?.unionId).toBe(member.unionId);

    // Reject legacy MEI-SSO-*
    const legacy = await verifyMemberSsoToken('MEI-SSO-eyJ1bmlvbklkIjoibWVpX3VzZXJfMTIzIn0=');
    expect(legacy.valid).toBe(false);

    // Reject tampered signature
    const tampered = `${token.slice(0, -4)}0000`;
    expect((await verifyMemberSsoToken(tampered)).valid).toBe(false);

    // Reject expired token (+8 days)
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 86400 * 1000);
    expect((await verifyMemberSsoToken(token)).valid).toBe(false);
    nowSpy.mockRestore();

    // Evaluate public/sdk/mei-dock.js on normal route -> dock mounts & SSO works
    const dockCode = fs.readFileSync(path.join(ROOT_DIR, 'public/sdk/mei-dock.js'), 'utf8');
    window.location.hash = '';
    delete window.__MEI_STUDIO_DOCK_MOUNTED__;
    document.getElementById('mei-studio-dock-root')?.remove();
    new Function(dockCode)();
    expect(document.getElementById('mei-studio-dock-root')).not.toBeNull();
    expect(window.MeiStudioSSO).toBeDefined();
    const dockVerify = await window.MeiStudioSSO!.verifyToken!(token);
    expect(dockVerify.valid).toBe(true);

    // Evaluate public/sdk/mei-dock.js on #/tray -> dock suppressed, SSO still active
    document.getElementById('mei-studio-dock-root')?.remove();
    delete window.__MEI_STUDIO_DOCK_MOUNTED__;
    window.location.hash = '#/tray';
    new Function(dockCode)();
    expect(document.getElementById('mei-studio-dock-root')).toBeNull();
    expect(window.MeiStudioSSO).toBeDefined();
    const trayVerify = await window.MeiStudioSSO!.verifyToken!(token);
    expect(trayVerify.valid).toBe(true);
    window.location.hash = '';
  });

  it('persists Local-First data across IndexedDB -> localStorage -> in-memory fallback without throwing', async () => {
    const seed = createSeedScheduleData(new Date(), 'local-guest');

    // Tier 1: IndexedDB (fake-indexeddb)
    await localStore.saveSnapshot(seed.snapshot, { broadcast: false });
    const reloadedIdb = await localStore.loadFullLocalState();
    expect(reloadedIdb?.backend).toBe('indexeddb');
    expect(reloadedIdb?.snapshot.events.length).toBe(seed.snapshot.events.length);

    // Tier 2: indexedDB unavailable -> falls back transparently to localStorage
    const origIdb = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
    localStore.resetLocalStoreCacheForTests();
    await localStore.saveSnapshot(seed.snapshot, { broadcast: false });
    const reloadedLs = await localStore.loadFullLocalState();
    expect(reloadedLs?.backend).toBe('localstorage');
    expect(reloadedLs?.snapshot.calendars.length).toBe(seed.snapshot.calendars.length);

    // Tier 3: BOTH indexedDB unavailable AND localStorage throws SecurityError -> falls back to memory Map
    const lsDesc = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Blocked by sandbox', 'SecurityError');
      }
    });
    localStore.resetLocalStoreCacheForTests();
    await localStore.saveSnapshot(seed.snapshot, { broadcast: false });
    const reloadedMem = await localStore.loadFullLocalState();
    expect(reloadedMem?.backend).toBe('memory');
    expect(reloadedMem?.snapshot.tasks.length).toBe(seed.snapshot.tasks.length);

    // Restore globals
    if (lsDesc) Object.defineProperty(window, 'localStorage', lsDesc);
    Object.defineProperty(globalThis, 'indexedDB', { value: origIdb, configurable: true, writable: true });
  });

  it('re-keys local data to UUIDs, omits releasedMinutes from DB payload, and degrades gracefully on 42P01/PGRST205', async () => {
    const seed = createSeedScheduleData(new Date(), 'local-guest');
    seed.snapshot.calendars[0].id = 'non-uuid-cal-1';
    seed.snapshot.events[0].calendarId = 'non-uuid-cal-1';
    seed.snapshot.events[0].id = 'non-uuid-evt-1';

    const authUid = '12345678-1234-4123-8123-1234567890ab';
    const rekeyed = rekeyLocalDataForUser(seed.snapshot, seed.preferences, authUid);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(rekeyed.snapshot.calendars[0].id)).toBe(true);
    expect(rekeyed.snapshot.events[0].calendarId).toBe(rekeyed.snapshot.calendars[0].id);
    expect(rekeyed.snapshot.events[0].creatorId).toBe(authUid);

    // eventToRow omits releasedMinutes; rowToEvent recomputes it when completed early
    const start = new Date('2026-11-24T09:00:00.000Z');
    const completedAt = new Date('2026-11-24T09:35:00.000Z');
    const end = new Date('2026-11-24T10:00:00.000Z');
    const evt = {
      ...rekeyed.snapshot.events[0],
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: 'completed' as const,
      completedAt: completedAt.toISOString(),
      releasedMinutes: 25
    };
    const dbRow = eventToRow(evt);
    expect('releasedMinutes' in dbRow).toBe(false);
    expect('released_minutes' in dbRow).toBe(false);
    const hydrated = rowToEvent(dbRow);
    expect(hydrated.releasedMinutes).toBe(25);

    // Pre-migration 42P01 / PGRST205 graceful degradation
    const mockPreMigrationClient = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: 'PGRST205', message: 'Could not find the table public.mei_schedule_user_preferences' } }) }),
          then: (resolve: (val: unknown) => void) =>
            resolve({ data: null, error: { code: '42P01', message: 'relation "public.mei_schedule_calendars" does not exist' } })
        })
      })
    } as unknown as SupabaseClient;

    const mergeRes = await mergeLocalAndCloudOnSignIn(
      authUid,
      seed.snapshot,
      seed.preferences,
      [],
      mockPreMigrationClient
    );
    expect(mergeRes.status).toBe('local-only');
    expect(mergeRes.tablesMigrated).toBe(false);
    expect(mergeRes.mergedSnapshot.events.length).toBe(seed.snapshot.events.length);
  });

  it('enforces 50-depth Undo/Redo history stack, stale-entry guard, early completion releasedMinutes, and atomic smart proposals', async () => {
    let storeRef!: ScheduleStoreContextValue;
    function Harness() {
      storeRef = useScheduleStore();
      return null;
    }

    render(
      <ScheduleProvider>
        <Harness />
      </ScheduleProvider>
    );

    await waitFor(() => expect(storeRef.hydrated).toBe(true));

    const initialCount = storeRef.events.length;

    // 55 undoable creations -> capped strictly at MAX_HISTORY_DEPTH (50)
    act(() => {
      for (let i = 1; i <= 55; i++) {
        storeRef.createEvent({
          title: `排程測試事件 ${i}`,
          startAt: '2026-11-24T09:00:00.000Z',
          endAt: '2026-11-24T09:30:00.000Z'
        });
      }
    });

    expect(storeRef.events.length).toBe(initialCount + 55);
    expect(storeRef.historyDepth).toBe(MAX_HISTORY_DEPTH);
    expect(storeRef.canUndo).toBe(true);

    // Stale entry ID rejected cleanly (no state change)
    let staleOk = true;
    act(() => {
      staleOk = storeRef.undo('stale-entry-id-not-top');
    });
    expect(staleOk).toBe(false);
    expect(storeRef.events.length).toBe(initialCount + 55);

    // Undo reverts #55 -> #54 and enables Redo
    act(() => {
      expect(storeRef.undo()).toBe(true);
    });
    expect(storeRef.events.length).toBe(initialCount + 54);
    expect(storeRef.canRedo).toBe(true);

    // Redo restores #55
    act(() => {
      expect(storeRef.redo()).toBe(true);
    });
    expect(storeRef.events.length).toBe(initialCount + 55);
    expect(storeRef.canRedo).toBe(false);

    // Undo then new mutation clears future stack
    act(() => {
      storeRef.undo();
    });
    expect(storeRef.canRedo).toBe(true);
    act(() => {
      storeRef.createEvent({
        title: '分支新事件',
        startAt: '2026-11-24T11:00:00.000Z',
        endAt: '2026-11-24T12:00:00.000Z',
        isFlexible: true
      });
    });
    expect(storeRef.canRedo).toBe(false);

    // Early completion releases remaining minutes
    const latestEvt = storeRef.events[storeRef.events.length - 1];
    let earlyRes!: { releasedMinutes: number; entryId: string | null };
    act(() => {
      earlyRes = storeRef.completeEventEarly(latestEvt.id, new Date('2026-11-24T11:20:00.000Z'));
    });
    expect(earlyRes.releasedMinutes).toBe(40);
    expect(storeRef.events.find((e) => e.id === latestEvt.id)?.releasedMinutes).toBe(40);

    // Atomic applySmartProposals: schedules task, shifts flexible event, locks immovable event, and reverts atomically via single undo(entryId)
    const unscheduledTask = storeRef.tasks.find((t) => !t.scheduledEventId)!;
    const lockedEvt = storeRef.events.find((e) => !e.isFlexible)!;
    const flexEvt = storeRef.events.find((e) => e.isFlexible && e.status === 'scheduled')!;
    const beforeEventsCount = storeRef.events.length;
    const origLockedStart = lockedEvt.startAt;
    const origFlexStart = flexEvt.startAt;

    let applyRes!: { appliedCount: number; entryId: string | null };
    act(() => {
      applyRes = storeRef.applySmartProposals([
        {
          id: 'p1',
          action: 'schedule_task',
          targetId: unscheduledTask.id,
          title: unscheduledTask.title,
          priority: unscheduledTask.priority,
          categoryTag: unscheduledTask.categoryTag,
          isFlexible: true,
          originalStartAt: null,
          originalEndAt: null,
          proposedStartAt: '2026-11-25T09:00:00.000Z',
          proposedEndAt: '2026-11-25T09:45:00.000Z',
          reason: '自動填入上午空檔',
          selected: true
        },
        {
          id: 'p2',
          action: 'reschedule_event',
          targetId: flexEvt.id,
          title: flexEvt.title,
          priority: flexEvt.priority,
          categoryTag: flexEvt.categoryTag,
          isFlexible: true,
          originalStartAt: flexEvt.startAt,
          originalEndAt: flexEvt.endAt,
          proposedStartAt: '2026-11-25T14:00:00.000Z',
          proposedEndAt: '2026-11-25T15:00:00.000Z',
          reason: '順延彈性區塊',
          selected: true
        },
        {
          id: 'p3',
          action: 'reschedule_event',
          targetId: lockedEvt.id,
          title: lockedEvt.title,
          priority: lockedEvt.priority,
          categoryTag: lockedEvt.categoryTag,
          isFlexible: false,
          originalStartAt: lockedEvt.startAt,
          originalEndAt: lockedEvt.endAt,
          proposedStartAt: '2026-11-25T16:00:00.000Z',
          proposedEndAt: '2026-11-25T17:00:00.000Z',
          reason: '嘗試移動鎖定行程應被阻擋',
          selected: true
        }
      ]);
    });

    expect(applyRes.appliedCount).toBe(2);
    expect(storeRef.events.length).toBe(beforeEventsCount + 1);
    expect(storeRef.events.find((e) => e.id === lockedEvt.id)?.startAt).toBe(origLockedStart);
    expect(storeRef.events.find((e) => e.id === flexEvt.id)?.startAt).toBe('2026-11-25T14:00:00.000Z');
    expect(storeRef.tasks.find((t) => t.id === unscheduledTask.id)?.scheduledEventId).toBeTruthy();

    // Single Undo atomically restores both task and shifted event
    act(() => {
      expect(storeRef.undo(applyRes.entryId || undefined)).toBe(true);
    });
    expect(storeRef.events.length).toBe(beforeEventsCount);
    expect(storeRef.events.find((e) => e.id === flexEvt.id)?.startAt).toBe(origFlexStart);
    expect(storeRef.tasks.find((t) => t.id === unscheduledTask.id)?.scheduledEventId).toBeNull();
  });

  it('verifies supabase/mei_schedule_migrations.sql isolation, 7 tables, FORCE RLS, anon revoke, SECURITY DEFINER helpers, Realtime & Zero Emoji', () => {
    const sql = fs.readFileSync(path.join(ROOT_DIR, 'supabase/mei_schedule_migrations.sql'), 'utf8');

    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    expect(sql).toContain('mei_schedule_handle_updated_at');
    expect(sql).toContain('clock_timestamp()');
    expect(sql).not.toMatch(/\bnow\(\)/i);
    expect(EMOJI_REGEX.test(sql)).toBe(false);

    // Zero DDL touching mei_member_*
    expect(sql).not.toMatch(/(?:CREATE|ALTER|DROP)\s+TABLE[^;]*mei_member_/i);

    const tables = [
      'mei_schedule_calendars',
      'mei_schedule_calendar_members',
      'mei_schedule_events',
      'mei_schedule_tasks',
      'mei_schedule_event_comments',
      'mei_schedule_focus_sessions',
      'mei_schedule_user_preferences'
    ];

    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, 'i'));
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`, 'i'));
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON (?:public\\.)?${table} FROM anon`, 'i'));
    }

    // 3 SECURITY DEFINER helpers with search_path hardening
    for (const fn of [
      'mei_schedule_is_calendar_member',
      'mei_schedule_can_access_event',
      'mei_schedule_join_by_invite_code'
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
    }
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public, auth, pg_temp');

    // Guarded Realtime publication registration
    expect(sql).toContain('pg_publication_tables');
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public.mei_schedule_events');
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public.mei_schedule_event_comments');

    // Verification & Rollback commented SQL blocks
    expect(sql).toContain('Verification SQL');
    expect(sql).toContain('Rollback SQL');
  });
});
