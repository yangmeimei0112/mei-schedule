import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  focusAudioEngine,
  type FocusAmbientId,
  type FocusAudioSnapshot,
  type FocusMusicTrackId
} from '../services/focusAudioEngine';
import { sendInstantNotification, triggerLightHaptic } from '../services/notificationBridge';
import { useScheduleStore } from './useScheduleStore';

export interface FocusSessionContextValue {
  plannedMinutes: number;
  remainingSeconds: number;
  isRunning: boolean;
  categoryTag: string;
  targetTitle: string | null;
  targetEventId: string | null;
  targetTaskId: string | null;
  audio: FocusAudioSnapshot;
  selectPreset: (minutes: number) => void;
  toggleRun: () => void;
  resetTimer: () => void;
  completeNow: (closeAfter?: boolean) => void;
  selectTrack: (trackId: FocusMusicTrackId) => void;
  selectAmbient: (ambientId: FocusAmbientId) => void;
  setMusicVolume: (volume: number) => void;
  setAmbientVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleAudioPlay: () => void;
  setAutoSync: (enabled: boolean) => void;
  setChimeEnabled: (enabled: boolean) => void;
  loadLocalAudioFile: (file: File) => void;
  clearLocalAudioFile: () => void;
  previewChime: () => void;
}

const FocusSessionContext = createContext<FocusSessionContextValue | null>(null);

/**
 * Isolated Background Focus Timer & Audio State Provider:
 * - Decoupled from ScheduleStoreContext so 1-second timer ticks & audio updates
 *   NEVER re-render TimelineView / WeekGridView / MonthView / AgendaListView.
 * - Persists running countdown and royalty-free light music seamlessly when
 *   FocusTimerModal is closed so users can browse their calendar uninterrupted.
 */
export function FocusSessionProvider({ children }: { children: React.ReactNode }) {
  const {
    activeModal,
    closeModal,
    events,
    focusTargetEventId,
    focusTargetTaskId,
    recordFocusSession,
    showToast
  } = useScheduleStore();

  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [categoryTag, setCategoryTag] = useState('工作');
  const [targetTitle, setTargetTitle] = useState<string | null>(null);
  const [boundEventId, setBoundEventId] = useState<string | null>(null);
  const [boundTaskId, setBoundTaskId] = useState<string | null>(null);
  const [audio, setAudio] = useState<FocusAudioSnapshot>(() => focusAudioEngine.getSnapshot());

  const startedAtRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);
  isRunningRef.current = isRunning;

  // Subscribe to singleton FocusAudioEngine state updates
  useEffect(() => {
    setAudio(focusAudioEngine.getSnapshot());
    return focusAudioEngine.subscribe((next) => {
      setAudio(next);
    });
  }, []);

  // Stop audio cleanly on full provider unmount (e.g. test cleanup)
  useEffect(() => {
    return () => {
      focusAudioEngine.stop(true);
    };
  }, []);

  // When opening FocusTimerModal with a target event and timer is idle, load its duration/title
  useEffect(() => {
    if (activeModal !== 'focus') return;
    if (isRunningRef.current) return; // Never wipe an active background focus session!

    const targetEvent = focusTargetEventId
      ? events.find((e) => e.id === focusTargetEventId) || null
      : null;

    if (targetEvent) {
      const eventMins = Math.max(
        15,
        Math.min(
          120,
          Math.round((Date.parse(targetEvent.endAt) - Date.parse(targetEvent.startAt)) / 60_000)
        )
      );
      setPlannedMinutes(eventMins);
      setRemainingSeconds(eventMins * 60);
      setCategoryTag(targetEvent.categoryTag || '工作');
      setTargetTitle(targetEvent.title);
      setBoundEventId(targetEvent.id);
      setBoundTaskId(focusTargetTaskId);
      startedAtRef.current = null;
    } else if (boundEventId !== null) {
      setPlannedMinutes(25);
      setRemainingSeconds(25 * 60);
      setCategoryTag('工作');
      setTargetTitle(null);
      setBoundEventId(null);
      setBoundTaskId(focusTargetTaskId);
      startedAtRef.current = null;
    }
  }, [activeModal, focusTargetEventId, focusTargetTaskId, events, boundEventId]);

  // 1-second background countdown interval
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          const nowIso = new Date().toISOString();
          recordFocusSession({
            eventId: boundEventId,
            taskId: boundTaskId,
            categoryTag,
            plannedMinutes,
            actualMinutes: plannedMinutes,
            completed: true,
            startedAt:
              startedAtRef.current || new Date(Date.now() - plannedMinutes * 60_000).toISOString(),
            endedAt: nowIso
          });

          // Fade out music & play soothing completion chime
          if (focusAudioEngine.getSnapshot().autoSyncWithTimer) {
            focusAudioEngine.stop();
          }
          focusAudioEngine.playCompletionChime(false);

          void sendInstantNotification({
            title: '專注計時完成',
            body: `已完成 ${plannedMinutes} 分鐘專注（${targetTitle || categoryTag}）`
          });
          void triggerLightHaptic();
          startedAtRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [
    isRunning,
    boundEventId,
    boundTaskId,
    categoryTag,
    plannedMinutes,
    targetTitle,
    recordFocusSession
  ]);

  const selectPreset = useCallback((minutes: number) => {
    setIsRunning(false);
    setPlannedMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    startedAtRef.current = null;
    if (focusAudioEngine.getSnapshot().autoSyncWithTimer) {
      focusAudioEngine.stop();
    }
  }, []);

  const toggleRun = useCallback(() => {
    setIsRunning((prevRunning) => {
      const nextRunning = !prevRunning;
      const snap = focusAudioEngine.getSnapshot();
      if (nextRunning) {
        if (!startedAtRef.current) {
          startedAtRef.current = new Date().toISOString();
        }
        setRemainingSeconds((sec) => (sec <= 0 ? plannedMinutes * 60 : sec));
        if (snap.autoSyncWithTimer) {
          focusAudioEngine.start();
        }
      } else if (snap.autoSyncWithTimer) {
        focusAudioEngine.stop();
      }
      return nextRunning;
    });
  }, [plannedMinutes]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setRemainingSeconds(plannedMinutes * 60);
    startedAtRef.current = null;
    if (focusAudioEngine.getSnapshot().autoSyncWithTimer) {
      focusAudioEngine.stop();
    }
  }, [plannedMinutes]);

  const completeNow = useCallback(
    (closeAfter = true) => {
      setIsRunning(false);
      const totalSeconds = plannedMinutes * 60;
      const elapsedMin = Math.max(
        1,
        Math.round((totalSeconds - remainingSeconds) / 60) || plannedMinutes
      );
      const nowIso = new Date().toISOString();
      recordFocusSession({
        eventId: boundEventId,
        taskId: boundTaskId,
        categoryTag,
        plannedMinutes,
        actualMinutes: elapsedMin,
        completed: true,
        startedAt:
          startedAtRef.current || new Date(Date.now() - elapsedMin * 60_000).toISOString(),
        endedAt: nowIso
      });
      if (focusAudioEngine.getSnapshot().autoSyncWithTimer) {
        focusAudioEngine.stop();
      }
      focusAudioEngine.playCompletionChime(false);
      void triggerLightHaptic();
      setRemainingSeconds(plannedMinutes * 60);
      startedAtRef.current = null;
      if (closeAfter) {
        closeModal();
      }
    },
    [
      plannedMinutes,
      remainingSeconds,
      boundEventId,
      boundTaskId,
      categoryTag,
      recordFocusSession,
      closeModal
    ]
  );

  const selectTrack = useCallback((trackId: FocusMusicTrackId) => {
    focusAudioEngine.setTrack(trackId);
  }, []);

  const selectAmbient = useCallback((ambientId: FocusAmbientId) => {
    focusAudioEngine.setAmbient(ambientId);
  }, []);

  const setMusicVolume = useCallback((volume: number) => {
    focusAudioEngine.setMusicVolume(volume);
  }, []);

  const setAmbientVolume = useCallback((volume: number) => {
    focusAudioEngine.setAmbientVolume(volume);
  }, []);

  const toggleMute = useCallback(() => {
    focusAudioEngine.toggleMute();
  }, []);

  const toggleAudioPlay = useCallback(() => {
    focusAudioEngine.togglePlay();
  }, []);

  const setAutoSync = useCallback((enabled: boolean) => {
    focusAudioEngine.setAutoSyncWithTimer(enabled);
  }, []);

  const setChimeEnabled = useCallback((enabled: boolean) => {
    focusAudioEngine.setChimeEnabled(enabled);
  }, []);

  const loadLocalAudioFile = useCallback(
    (file: File) => {
      const res = focusAudioEngine.loadLocalFile(file);
      if (res.success && res.fileName) {
        showToast(`已載入本機音檔「${res.fileName}」`, { icon: 'music' });
      } else {
        showToast('無法載入該音檔，請選擇 .mp3 / .wav / .m4a 格式', { icon: 'circle-alert' });
      }
    },
    [showToast]
  );

  const clearLocalAudioFile = useCallback(() => {
    focusAudioEngine.clearLocalFile();
    showToast('已清除本機音檔並切換回晴空鋼琴', { icon: 'music' });
  }, [showToast]);

  const previewChime = useCallback(() => {
    focusAudioEngine.playCompletionChime(true);
  }, []);

  const value = useMemo<FocusSessionContextValue>(
    () => ({
      plannedMinutes,
      remainingSeconds,
      isRunning,
      categoryTag,
      targetTitle,
      targetEventId: boundEventId,
      targetTaskId: boundTaskId,
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
    }),
    [
      plannedMinutes,
      remainingSeconds,
      isRunning,
      categoryTag,
      targetTitle,
      boundEventId,
      boundTaskId,
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
    ]
  );

  return <FocusSessionContext.Provider value={value}>{children}</FocusSessionContext.Provider>;
}

export function useFocusSession(): FocusSessionContextValue {
  const ctx = useContext(FocusSessionContext);
  if (!ctx) {
    throw new Error('useFocusSession must be used inside <FocusSessionProvider>');
  }
  return ctx;
}
