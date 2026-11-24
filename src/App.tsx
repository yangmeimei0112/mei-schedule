import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgendaListView from './components/AgendaListView';
import AppPreloaderOverlay, { ThemeCrossfadeVeil } from './components/AppPreloaderOverlay';
import MobileBottomNav from './components/MobileBottomNav';
import MonthView from './components/MonthView';
import QuickCaptureBar from './components/QuickCaptureBar';
import StudioToast from './components/StudioToast';
import TaskInboxSidebar from './components/TaskInboxSidebar';
import TimelineView from './components/TimelineView';
import TopNavBar from './components/TopNavBar';
import WeekGridView from './components/WeekGridView';
import {
  captureAndCleanOAuthUrlError,
  extractAndCleanOAuthUrlError,
  type OAuthUrlErrorResult
} from './services/memberAuthService';
import { syncNativeStatusBar } from './services/notificationBridge';
import { lazyModalLoaders } from './services/preloadEngine';
import {
  expandRecurringEvents,
  parseLocalDateKey,
  toLocalDateKey
} from './services/recurrenceEngine';
import { detectScheduleConflicts } from './services/smartScheduler';
import {
  ScheduleProvider,
  useScheduleStore,
  useThemeTransition,
  useToastState
} from './store/useScheduleStore';

export { extractAndCleanOAuthUrlError, type OAuthUrlErrorResult };

// Lazy-loaded heavy modals, drawers & Electron tray widget (eagerly preloaded at startup)
const DesktopTrayWidget = lazy(lazyModalLoaders.DesktopTrayWidget);
const EventDetailDrawer = lazy(lazyModalLoaders.EventDetailDrawer);
const FocusTimerModal = lazy(lazyModalLoaders.FocusTimerModal);
const AnalyticsDashboard = lazy(lazyModalLoaders.AnalyticsDashboard);
const SmartRescheduleDrawer = lazy(lazyModalLoaders.SmartRescheduleDrawer);
const SharedCalendarModal = lazy(lazyModalLoaders.SharedCalendarModal);
const CalendarSyncModal = lazy(lazyModalLoaders.CalendarSyncModal);
const AppearanceSettingsModal = lazy(lazyModalLoaders.AppearanceSettingsModal);
const CommandPalette = lazy(lazyModalLoaders.CommandPalette);
const MemberPortalModal = lazy(lazyModalLoaders.MemberPortalModal);

function isTrayHashRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.location.hash || '').startsWith('#/tray');
}

/** Isolated Toast subscriber — Toast updates NEVER re-render the main calendar workspace */
const StudioToastContainer = React.memo(function StudioToastContainer({
  elevated
}: {
  elevated: boolean;
}) {
  const { toast, dismissToast } = useToastState();
  return <StudioToast toast={toast} onDismiss={dismissToast} elevated={elevated} />;
});

/** Isolated Cross-Dissolve Veil subscriber — Veil lifecycle NEVER re-renders views */
const ThemeCrossfadeVeilContainer = React.memo(function ThemeCrossfadeVeilContainer() {
  const transitionState = useThemeTransition();
  return <ThemeCrossfadeVeil transitionState={transitionState} />;
});

function MeiScheduleShell() {
  const {
    hydrated,
    calendars,
    events,
    preferences,
    resolvedColorMode,
    currentMember,
    syncStatus,
    viewMode,
    selectedDate,
    selectedEventId,
    sidebarOpen,
    activeModal,
    setCurrentMember,
    setViewMode,
    goToToday,
    selectEvent,
    setSidebarOpen,
    openModal,
    closeModal,
    showToast,
    undo,
    redo
  } = useScheduleStore();

  const [isTrayRoute, setIsTrayRoute] = useState<boolean>(isTrayHashRoute);
  const quickCaptureInputRef = useRef<HTMLInputElement>(null);

  // Listen for hash route changes (#/tray)
  useEffect(() => {
    const onHashChange = () => setIsTrayRoute(isTrayHashRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Capture & clean OAuth URL error params on mount while STRICTLY preserving #/tray
  useEffect(() => {
    const captured = captureAndCleanOAuthUrlError();
    if (captured) {
      showToast(captured.displayMessage, { icon: 'circle-alert', durationMs: 5200 });
    }
  }, [showToast]);

  // Sync native mobile status bar theme on Capacitor iOS/Android
  useEffect(() => {
    void syncNativeStatusBar(resolvedColorMode);
  }, [resolvedColorMode]);

  const handleFocusQuickCapture = useCallback(() => {
    quickCaptureInputRef.current?.focus();
    quickCaptureInputRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, []);

  // Subscribe to Electron global shortcut Quick-Capture trigger (Cmd/Ctrl+Shift+Space)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.MeiDesktop?.onQuickCaptureTriggered) return;
    return window.MeiDesktop.onQuickCaptureTriggered(() => {
      handleFocusQuickCapture();
    });
  }, [handleFocusQuickCapture]);

  // Global keyboard shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+Z, C, T, 1-5, F, /, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (activeModal === 'command') closeModal();
        else openModal('command');
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isEditable) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !isEditable) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Escape') {
        if (activeModal) closeModal();
        else if (selectedEventId) selectEvent(null);
        return;
      }

      if (isEditable || e.metaKey || e.ctrlKey || e.altKey || activeModal) return;

      const lower = e.key.toLowerCase();
      if (lower === 'c') {
        e.preventDefault();
        handleFocusQuickCapture();
      } else if (lower === 't') {
        e.preventDefault();
        goToToday();
      } else if (lower === 'f') {
        e.preventDefault();
        openModal('focus');
      } else if (e.key === '/') {
        e.preventDefault();
        openModal('command');
      } else if (e.key === '1') {
        setViewMode('day');
      } else if (e.key === '2') {
        setViewMode('3day');
      } else if (e.key === '3') {
        setViewMode('week');
      } else if (e.key === '4') {
        setViewMode('month');
      } else if (e.key === '5') {
        setViewMode('agenda');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeModal,
    selectedEventId,
    closeModal,
    openModal,
    selectEvent,
    undo,
    redo,
    goToToday,
    setViewMode,
    handleFocusQuickCapture
  ]);

  // Filter events by visible calendars & active Calendar Set
  const visibleCalendarIds = useMemo(() => {
    const activeSet = preferences.activeCalendarSet;
    return new Set(
      calendars
        .filter((cal) => {
          if (cal.visible === false) return false;
          if (activeSet !== 'all' && cal.calendarSet !== activeSet) return false;
          return true;
        })
        .map((cal) => cal.id)
    );
  }, [calendars, preferences.activeCalendarSet]);

  const filteredMasterEvents = useMemo(
    () => events.filter((e) => visibleCalendarIds.has(e.calendarId)),
    [events, visibleCalendarIds]
  );

  // Anchored 65-day recurrence expansion cache:
  // Switching between Day / 3-Day / Week / Month / Agenda or stepping nearby dates
  // reuses the exact cached expanded array with ZERO recurrence recomputation!
  const [cacheAnchorDate, setCacheAnchorDate] = useState<string>(selectedDate);

  useEffect(() => {
    const anchorMs = parseLocalDateKey(cacheAnchorDate).getTime();
    const selMs = parseLocalDateKey(selectedDate).getTime();
    const diffDays = Math.abs(selMs - anchorMs) / 86_400_000;
    if (diffDays > 14) {
      setCacheAnchorDate(selectedDate);
    }
  }, [selectedDate, cacheAnchorDate]);

  const { cacheStartKey, cacheEndKey } = useMemo(() => {
    const base = parseLocalDateKey(cacheAnchorDate);
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 32);
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 38);
    return {
      cacheStartKey: toLocalDateKey(start),
      cacheEndKey: toLocalDateKey(end)
    };
  }, [cacheAnchorDate]);

  const cachedExpandedInstances = useMemo(
    () => expandRecurringEvents(filteredMasterEvents, cacheStartKey, cacheEndKey),
    [filteredMasterEvents, cacheStartKey, cacheEndKey]
  );

  // Slice cached instances for current viewMode (O(N) fast array filter, no RRULE expansion)
  const viewInstances = useMemo(() => {
    if (viewMode === 'month') {
      const base = parseLocalDateKey(selectedDate);
      const startKey = toLocalDateKey(new Date(base.getFullYear(), base.getMonth(), -7));
      const endKey = toLocalDateKey(new Date(base.getFullYear(), base.getMonth() + 1, 14));
      if (startKey >= cacheStartKey && endKey <= cacheEndKey) {
        return cachedExpandedInstances.filter(
          (i) => i.occurrenceDate >= startKey && i.occurrenceDate <= endKey
        );
      }
      return expandRecurringEvents(filteredMasterEvents, startKey, endKey);
    }
    if (viewMode === 'agenda') {
      const base = parseLocalDateKey(selectedDate);
      const startKey = toLocalDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 3));
      const endKey = toLocalDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 21));
      if (startKey >= cacheStartKey && endKey <= cacheEndKey) {
        return cachedExpandedInstances.filter(
          (i) => i.occurrenceDate >= startKey && i.occurrenceDate <= endKey
        );
      }
      return expandRecurringEvents(filteredMasterEvents, startKey, endKey);
    }
    return cachedExpandedInstances;
  }, [viewMode, selectedDate, cacheStartKey, cacheEndKey, cachedExpandedInstances, filteredMasterEvents]);

  const selectedDayConflicts = useMemo(() => {
    const dayOnly = cachedExpandedInstances.filter((i) => i.occurrenceDate === selectedDate);
    return detectScheduleConflicts(dayOnly);
  }, [cachedExpandedInstances, selectedDate]);

  const handleMemberNotify = useCallback(
    (msg: string, icon?: string) => {
      showToast(msg, { icon });
    },
    [showToast]
  );

  // Electron System Tray Popover Route (#/tray)
  if (isTrayRoute) {
    return (
      <div data-testid="mei-schedule-app" className="min-h-dvh-screen">
        <Suspense fallback={null}>
          <DesktopTrayWidget />
        </Suspense>
        <ThemeCrossfadeVeilContainer />
        <StudioToastContainer elevated={false} />
      </div>
    );
  }

  return (
    <div
      data-testid="mei-schedule-app"
      className="min-h-dvh-screen sky-ambient-bg flex flex-col"
    >
      {/* Hybrid Mode 2 Preloader (First-visit brand splash / Revisit 0ms instant + silent warm-up) */}
      <AppPreloaderOverlay hydrated={hydrated} disabled={isTrayRoute} />

      <TopNavBar
        conflictCount={selectedDayConflicts.length}
        onFocusQuickCapture={handleFocusQuickCapture}
      />

      {/* Main Responsive Workspace Container */}
      <main className="narrow-compact-px flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-5 py-4 sm:py-5 pb-28 sm:pb-10 flex flex-col lg:flex-row gap-4 items-start">
        {/* Left Sidebar (Desktop collapsible + Mobile Drawer Overlay) */}
        {sidebarOpen && (
          <>
            <div className="hidden lg:block sticky top-28 pb-20">
              <TaskInboxSidebar />
            </div>
            {/* Mobile Slide-Over Sidebar */}
            <div
              data-testid="mobile-sidebar-overlay"
              className="lg:hidden fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm flex"
              onClick={() => setSidebarOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-[88vw] max-w-[330px] h-full overflow-y-auto bg-[var(--bg-primary)] p-3.5 shadow-2xl pb-24 space-y-3"
              >
                <div className="flex items-center justify-between px-1 pb-2 border-b border-[var(--border-subtle)]">
                  <span className="text-xs font-extrabold text-[var(--text-main)]">
                    行事曆與待辦收件匣
                  </span>
                  <button
                    type="button"
                    data-testid="close-mobile-sidebar-btn"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="關閉側邊欄"
                    className="btn-sky-secondary px-2.5 py-1 rounded-xl text-[11px] font-bold"
                  >
                    收合
                  </button>
                </div>
                <TaskInboxSidebar />
              </div>
            </div>
          </>
        )}

        {/* Primary Schedule Workspace */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          <QuickCaptureBar ref={quickCaptureInputRef} />

          {viewMode === 'day' && <TimelineView instances={viewInstances} />}
          {viewMode === '3day' && <WeekGridView mode="3day" instances={viewInstances} />}
          {viewMode === 'week' && <WeekGridView mode="week" instances={viewInstances} />}
          {viewMode === 'month' && <MonthView instances={viewInstances} />}
          {viewMode === 'agenda' && <AgendaListView instances={viewInstances} />}
        </div>
      </main>

      {/* Mobile Bottom One-Handed Navigation */}
      <MobileBottomNav onFocusQuickCapture={handleFocusQuickCapture} />

      {/* Conditionally-Mounted Lazy Modals & Drawers (Preloaded at startup -> 0ms open, 0 idle overhead) */}
      <Suspense fallback={null}>
        {selectedEventId && <EventDetailDrawer />}
        {activeModal === 'focus' && <FocusTimerModal />}
        {activeModal === 'analytics' && <AnalyticsDashboard />}
        {activeModal === 'smart' && <SmartRescheduleDrawer />}
        {activeModal === 'shared' && <SharedCalendarModal />}
        {activeModal === 'sync' && <CalendarSyncModal />}
        {activeModal === 'appearance' && <AppearanceSettingsModal />}
        {activeModal === 'command' && <CommandPalette />}
        {activeModal === 'member' && (
          <MemberPortalModal
            isOpen={true}
            onClose={closeModal}
            currentMember={currentMember}
            onMemberChange={setCurrentMember}
            onNotify={handleMemberNotify}
            syncStatus={syncStatus}
          />
        )}
      </Suspense>

      {/* Style B Cinematic Cross-Dissolve Veil (680ms slow Dark/Light, 450ms theme swap) */}
      <ThemeCrossfadeVeilContainer />

      {/* Global High-Contrast Sky-Blue Toast (isolated context — never re-renders workspace) */}
      <StudioToastContainer elevated={true} />
    </div>
  );
}

export default function App() {
  return (
    <ScheduleProvider>
      <MeiScheduleShell />
    </ScheduleProvider>
  );
}
