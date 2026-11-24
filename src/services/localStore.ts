import type {
  Calendar,
  EventComment,
  FocusSession,
  ScheduleDataSnapshot,
  ScheduleEvent,
  ScheduleTask,
  SyncQueueItem,
  UserPreferences
} from '../types/schedule';

// ============================================================================
// Local-First Persistence Engine — IndexedDB -> localStorage -> In-Memory Map
// ============================================================================

export const SCHEDULE_DB_NAME = 'mei_schedule_db_v1';
export const SCHEDULE_DB_VERSION = 1;
export const SCHEDULE_FALLBACK_STORAGE_KEY = 'mei_schedule_local_fallback_v1';
export const SCHEDULE_LOCAL_BROADCAST_CHANNEL = 'mei_schedule_local_sync_v1';

export type StorageBackendKind = 'indexeddb' | 'localstorage' | 'memory';

export interface LocalHydrationResult {
  snapshot: ScheduleDataSnapshot;
  preferences: UserPreferences | null;
  syncQueue: SyncQueueItem[];
  lastSyncedAt: string | null;
  seeded: boolean;
  backend: StorageBackendKind;
}

interface LocalFallbackEnvelope {
  seededV1: boolean;
  lastSyncedAt: string | null;
  calendars: Calendar[];
  events: ScheduleEvent[];
  tasks: ScheduleTask[];
  comments: EventComment[];
  focusSessions: FocusSession[];
  preferences: UserPreferences | null;
  syncQueue: SyncQueueItem[];
}

const SNAPSHOT_STORES = ['calendars', 'events', 'tasks', 'comments', 'focusSessions'] as const;
const TAB_SENDER_ID = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let activeIdbFactory: IDBFactory | null = null;
let cachedDbPromise: Promise<IDBDatabase> | null = null;
let activeBackend: StorageBackendKind = 'indexeddb';
const memoryStore = new Map<string, string>();

function createEmptyEnvelope(): LocalFallbackEnvelope {
  return {
    seededV1: false,
    lastSyncedAt: null,
    calendars: [],
    events: [],
    tasks: [],
    comments: [],
    focusSessions: [],
    preferences: null,
    syncQueue: []
  };
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const ls = window.localStorage;
    if (!ls || typeof ls.getItem !== 'function' || typeof ls.setItem !== 'function') {
      return null;
    }
    const probeKey = '__mei_schedule_ls_probe__';
    ls.setItem(probeKey, '1');
    ls.removeItem(probeKey);
    return ls;
  } catch {
    return null;
  }
}

function readFallbackEnvelope(): LocalFallbackEnvelope {
  const ls = getSafeLocalStorage();
  if (ls) {
    activeBackend = 'localstorage';
    try {
      const raw = ls.getItem(SCHEDULE_FALLBACK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LocalFallbackEnvelope>;
        return { ...createEmptyEnvelope(), ...parsed };
      }
      return createEmptyEnvelope();
    } catch {
      return createEmptyEnvelope();
    }
  }

  activeBackend = 'memory';
  try {
    const raw = memoryStore.get(SCHEDULE_FALLBACK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalFallbackEnvelope>;
      return { ...createEmptyEnvelope(), ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return createEmptyEnvelope();
}

function writeFallbackEnvelope(envelope: LocalFallbackEnvelope): void {
  const serialized = JSON.stringify(envelope);
  const ls = getSafeLocalStorage();
  if (ls) {
    try {
      ls.setItem(SCHEDULE_FALLBACK_STORAGE_KEY, serialized);
      activeBackend = 'localstorage';
      return;
    } catch {
      // QuotaExceededError or SecurityError -> degrade to memory
    }
  }
  memoryStore.set(SCHEDULE_FALLBACK_STORAGE_KEY, serialized);
  activeBackend = 'memory';
}

function getCurrentIdbFactory(): IDBFactory | null {
  try {
    const factory = typeof globalThis !== 'undefined' ? globalThis.indexedDB : undefined;
    return factory && typeof factory.open === 'function' ? factory : null;
  } catch {
    return null;
  }
}

async function openDatabase(): Promise<IDBDatabase | null> {
  const currentFactory = getCurrentIdbFactory();
  if (!currentFactory) {
    cachedDbPromise = null;
    activeIdbFactory = null;
    activeBackend = getSafeLocalStorage() ? 'localstorage' : 'memory';
    return null;
  }

  // Handle Vitest fake-indexeddb factory replacement cleanly across tests
  if (currentFactory !== activeIdbFactory) {
    cachedDbPromise = null;
    activeIdbFactory = currentFactory;
  }

  if (cachedDbPromise) {
    try {
      return await cachedDbPromise;
    } catch {
      cachedDbPromise = null;
    }
  }

  cachedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = currentFactory.open(SCHEDULE_DB_NAME, SCHEDULE_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('calendars')) {
          db.createObjectStore('calendars', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'id' });
          store.createIndex('by_calendar', 'calendarId', { unique: false });
          store.createIndex('by_start', 'startAt', { unique: false });
          store.createIndex('by_external_uid', 'externalUid', { unique: false });
        }
        if (!db.objectStoreNames.contains('tasks')) {
          const store = db.createObjectStore('tasks', { keyPath: 'id' });
          store.createIndex('by_completed', 'completed', { unique: false });
          store.createIndex('by_sort', 'sortOrder', { unique: false });
        }
        if (!db.objectStoreNames.contains('comments')) {
          const store = db.createObjectStore('comments', { keyPath: 'id' });
          store.createIndex('by_event', 'eventId', { unique: false });
        }
        if (!db.objectStoreNames.contains('focusSessions')) {
          const store = db.createObjectStore('focusSessions', { keyPath: 'id' });
          store.createIndex('by_started', 'startedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
          store.createIndex('by_queued', 'queuedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        activeBackend = 'indexeddb';
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('IndexedDB open failed'));
      };
    } catch (err) {
      reject(err);
    }
  });

  try {
    return await cachedDbPromise;
  } catch {
    cachedDbPromise = null;
    activeBackend = getSafeLocalStorage() ? 'localstorage' : 'memory';
    return null;
  }
}

function idbGetAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function awaitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function broadcastLocalStateChanged(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(SCHEDULE_LOCAL_BROADCAST_CHANNEL);
    channel.postMessage({
      type: 'LOCAL_STATE_UPDATED',
      senderId: TAB_SENDER_ID,
      timestamp: Date.now()
    });
    setTimeout(() => {
      try {
        channel.close();
      } catch {
        // Ignore close errors
      }
    }, 50);
  } catch {
    // Ignore BroadcastChannel restrictions
  }
}

export function getStorageBackend(): StorageBackendKind {
  return activeBackend;
}

export function resetLocalStoreCacheForTests(): void {
  cachedDbPromise = null;
  activeIdbFactory = null;
  memoryStore.clear();
}

export async function loadFullLocalState(): Promise<LocalHydrationResult | null> {
  const db = await openDatabase();
  if (!db) {
    const env = readFallbackEnvelope();
    return {
      snapshot: {
        calendars: env.calendars,
        events: env.events,
        tasks: env.tasks,
        comments: env.comments,
        focusSessions: env.focusSessions
      },
      preferences: env.preferences,
      syncQueue: env.syncQueue,
      lastSyncedAt: env.lastSyncedAt,
      seeded: env.seededV1,
      backend: activeBackend
    };
  }

  try {
    const tx = db.transaction(
      ['calendars', 'events', 'tasks', 'comments', 'focusSessions', 'preferences', 'syncQueue', 'meta'],
      'readonly'
    );
    const [calendars, events, tasks, comments, focusSessions, prefsList, syncQueue, seededMeta, lastSyncMeta] =
      await Promise.all([
        idbGetAll<Calendar>(tx.objectStore('calendars')),
        idbGetAll<ScheduleEvent>(tx.objectStore('events')),
        idbGetAll<ScheduleTask>(tx.objectStore('tasks')),
        idbGetAll<EventComment>(tx.objectStore('comments')),
        idbGetAll<FocusSession>(tx.objectStore('focusSessions')),
        idbGetAll<UserPreferences>(tx.objectStore('preferences')),
        idbGetAll<SyncQueueItem>(tx.objectStore('syncQueue')),
        idbGet<{ key: string; value: boolean }>(tx.objectStore('meta'), 'seeded_v1'),
        idbGet<{ key: string; value: string | null }>(tx.objectStore('meta'), 'last_synced_at')
      ]);

    const sortedPrefs = prefsList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    return {
      snapshot: {
        calendars,
        events,
        tasks: tasks.sort((a, b) => a.sortOrder - b.sortOrder),
        comments: comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        focusSessions
      },
      preferences: sortedPrefs[0] || null,
      syncQueue: syncQueue.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt)),
      lastSyncedAt: lastSyncMeta?.value ?? null,
      seeded: Boolean(seededMeta?.value),
      backend: 'indexeddb'
    };
  } catch {
    const env = readFallbackEnvelope();
    return {
      snapshot: {
        calendars: env.calendars,
        events: env.events,
        tasks: env.tasks,
        comments: env.comments,
        focusSessions: env.focusSessions
      },
      preferences: env.preferences,
      syncQueue: env.syncQueue,
      lastSyncedAt: env.lastSyncedAt,
      seeded: env.seededV1,
      backend: activeBackend
    };
  }
}

export async function loadInitialScheduleState(
  seedFactory: () => { snapshot: ScheduleDataSnapshot; preferences: UserPreferences }
): Promise<LocalHydrationResult> {
  const existing = await loadFullLocalState();
  const isEmpty =
    !existing ||
    (existing.snapshot.calendars.length === 0 &&
      existing.snapshot.events.length === 0 &&
      existing.snapshot.tasks.length === 0);

  if (!existing || (!existing.seeded && isEmpty)) {
    const seededData = seedFactory();
    await saveSnapshot(seededData.snapshot, { broadcast: false });
    await savePreferences(seededData.preferences, { broadcast: false });
    await setMetaFlag('seeded_v1', true);
    return {
      snapshot: seededData.snapshot,
      preferences: seededData.preferences,
      syncQueue: [],
      lastSyncedAt: null,
      seeded: true,
      backend: activeBackend
    };
  }

  return existing;
}

async function setMetaFlag(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    const env = readFallbackEnvelope();
    if (key === 'seeded_v1') env.seededV1 = Boolean(value);
    if (key === 'last_synced_at') env.lastSyncedAt = (value as string | null) ?? null;
    writeFallbackEnvelope(env);
    return;
  }

  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key, value });
    await awaitTx(tx);
  } catch {
    const env = readFallbackEnvelope();
    if (key === 'seeded_v1') env.seededV1 = Boolean(value);
    if (key === 'last_synced_at') env.lastSyncedAt = (value as string | null) ?? null;
    writeFallbackEnvelope(env);
  }
}

export async function saveSnapshot(
  snapshot: ScheduleDataSnapshot,
  options: { broadcast?: boolean } = { broadcast: true }
): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    const env = readFallbackEnvelope();
    env.calendars = snapshot.calendars;
    env.events = snapshot.events;
    env.tasks = snapshot.tasks;
    env.comments = snapshot.comments;
    env.focusSessions = snapshot.focusSessions;
    writeFallbackEnvelope(env);
    if (options.broadcast !== false) broadcastLocalStateChanged();
    return;
  }

  try {
    const tx = db.transaction([...SNAPSHOT_STORES], 'readwrite');
    for (const storeName of SNAPSHOT_STORES) {
      const store = tx.objectStore(storeName);
      store.clear();
      const items = snapshot[storeName];
      for (const item of items) {
        store.put(item);
      }
    }
    await awaitTx(tx);
  } catch {
    const env = readFallbackEnvelope();
    env.calendars = snapshot.calendars;
    env.events = snapshot.events;
    env.tasks = snapshot.tasks;
    env.comments = snapshot.comments;
    env.focusSessions = snapshot.focusSessions;
    writeFallbackEnvelope(env);
  }

  if (options.broadcast !== false) {
    broadcastLocalStateChanged();
  }
}

export async function savePreferences(
  preferences: UserPreferences,
  options: { broadcast?: boolean } = { broadcast: true }
): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    const env = readFallbackEnvelope();
    env.preferences = preferences;
    writeFallbackEnvelope(env);
    if (options.broadcast !== false) broadcastLocalStateChanged();
    return;
  }

  try {
    const tx = db.transaction('preferences', 'readwrite');
    const store = tx.objectStore('preferences');
    store.clear();
    store.put(preferences);
    await awaitTx(tx);
  } catch {
    const env = readFallbackEnvelope();
    env.preferences = preferences;
    writeFallbackEnvelope(env);
  }

  if (options.broadcast !== false) {
    broadcastLocalStateChanged();
  }
}

export async function loadSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDatabase();
  if (!db) {
    return readFallbackEnvelope().syncQueue;
  }

  try {
    const tx = db.transaction('syncQueue', 'readonly');
    const items = await idbGetAll<SyncQueueItem>(tx.objectStore('syncQueue'));
    return items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return readFallbackEnvelope().syncQueue;
  }
}

export async function saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    const env = readFallbackEnvelope();
    env.syncQueue = queue;
    writeFallbackEnvelope(env);
    return;
  }

  try {
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.clear();
    for (const item of queue) {
      store.put(item);
    }
    await awaitTx(tx);
  } catch {
    const env = readFallbackEnvelope();
    env.syncQueue = queue;
    writeFallbackEnvelope(env);
  }
}

export async function enqueueSyncItems(items: SyncQueueItem[]): Promise<SyncQueueItem[]> {
  const existing = await loadSyncQueue();
  const next = [...existing, ...items];
  await saveSyncQueue(next);
  return next;
}

export async function removeSyncItems(ids: string[]): Promise<SyncQueueItem[]> {
  const removeSet = new Set(ids);
  const existing = await loadSyncQueue();
  const next = existing.filter((item) => !removeSet.has(item.id));
  await saveSyncQueue(next);
  return next;
}

export async function setLastSyncedAt(iso: string | null): Promise<void> {
  await setMetaFlag('last_synced_at', iso);
}

export async function getLastSyncedAt(): Promise<string | null> {
  const state = await loadFullLocalState();
  return state?.lastSyncedAt ?? null;
}

export async function clearAllLocalData(): Promise<void> {
  const db = await openDatabase();
  if (db) {
    try {
      const tx = db.transaction(
        ['calendars', 'events', 'tasks', 'comments', 'focusSessions', 'preferences', 'syncQueue', 'meta'],
        'readwrite'
      );
      for (const name of [
        'calendars',
        'events',
        'tasks',
        'comments',
        'focusSessions',
        'preferences',
        'syncQueue',
        'meta'
      ]) {
        tx.objectStore(name).clear();
      }
      await awaitTx(tx);
    } catch {
      // Fallback clear below
    }
  }
  const ls = getSafeLocalStorage();
  if (ls) {
    try {
      ls.removeItem(SCHEDULE_FALLBACK_STORAGE_KEY);
    } catch {
      // Ignore storage SecurityError
    }
  }
  memoryStore.delete(SCHEDULE_FALLBACK_STORAGE_KEY);
}

export function subscribeLocalBroadcast(onRemoteTabUpdate: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  try {
    const channel = new BroadcastChannel(SCHEDULE_LOCAL_BROADCAST_CHANNEL);
    channel.onmessage = (evt: MessageEvent) => {
      if (evt?.data?.type === 'LOCAL_STATE_UPDATED' && evt.data.senderId !== TAB_SENDER_ID) {
        onRemoteTabUpdate();
      }
    };
    return () => {
      try {
        channel.close();
      } catch {
        // Ignore close errors
      }
    };
  } catch {
    return () => {};
  }
}
