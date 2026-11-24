import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgendaListView from './components/AgendaListView';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AppearanceSettingsModal from './components/AppearanceSettingsModal';
import CalendarSyncModal from './components/CalendarSyncModal';
import CommandPalette from './components/CommandPalette';
import DesktopTrayWidget from './components/DesktopTrayWidget';
import EventDetailDrawer from './components/EventDetailDrawer';
import FocusTimerModal from './components/FocusTimerModal';
import MemberPortalModal from './components/MemberPortalModal';
import MobileBottomNav from './components/MobileBottomNav';
import MonthView from './components/MonthView';
import QuickCaptureBar from './components/QuickCaptureBar';
import SharedCalendarModal from './components/SharedCalendarModal';
import SmartRescheduleDrawer from './components/SmartRescheduleDrawer';
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
import {
  expandRecurringEvents,
  parseLocalDateKey,
  toLocalDateKey
} from './services/recurrenceEngine';
import { detectScheduleConflicts } from './services/smartScheduler';
import { ScheduleProvider, useScheduleStore } from './store/useScheduleStore';

export { extractAndCleanOAuthUrlError, type OAuthUrlErrorResult };

function isTrayHashRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.location.hash || '').startsWith('#/tray');
}

function MeiScheduleShell() {
  const {
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
    toast,
    setCurrentMember,
    setViewMode,
    goToToday,
    selectEvent,
    setSidebarOpen,
    openModal,
    closeModal,
    showToast,
    dismissToast,
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
  }, [activeModal, selectedEventId, closeModal, openModal, selectEvent, undo, redo, goToToday, setViewMode, handleFocusQuickCapture]);

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

  // Compute expansion range matching current viewMode
  const { rangeStartKey, rangeEndKey } = useMemo(() => {
    const base = parseLocalDateKey(selectedDate);
    if (viewMode === 'month') {
      const start = new Date(base.getFullYear(), base.getMonth(), -7);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 14);
      return { rangeStartKey: toLocalDateKey(start), rangeEndKey: toLocalDateKey(end) };
    }
    if (viewMode === 'agenda') {
      const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 3);
      const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 21);
      return { rangeStartKey: toLocalDateKey(start), rangeEndKey: toLocalDateKey(end) };
    }
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7);
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 10);
    return { rangeStartKey: toLocalDateKey(start), rangeEndKey: toLocalDateKey(end) };
  }, [selectedDate, viewMode]);

  const expandedInstances = useMemo(
    () => expandRecurringEvents(filteredMasterEvents, rangeStartKey, rangeEndKey),
    [filteredMasterEvents, rangeStartKey, rangeEndKey]
  );

  const selectedDayConflicts = useMemo(() => {
    const dayOnly = expandedInstances.filter((i) => i.occurrenceDate === selectedDate);
    return detectScheduleConflicts(dayOnly);
  }, [expandedInstances, selectedDate]);

  // Electron System Tray Popover Route (#/tray)
  if (isTrayRoute) {
    return (
      <div data-testid="mei-schedule-app" className="min-h-dvh-screen">
        <DesktopTrayWidget />
        <StudioToast toast={toast} onDismiss={dismissToast} elevated={false} />
      </div>
    );
  }

  return (
    <div
      data-testid="mei-schedule-app"
      className="min-h-dvh-screen sky-ambient-bg flex flex-col transition-colors"
    >
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

          {viewMode === 'day' && <TimelineView instances={expandedInstances} />}
          {viewMode === '3day' && <WeekGridView mode="3day" instances={expandedInstances} />}
          {viewMode === 'week' && <WeekGridView mode="week" instances={expandedInstances} />}
          {viewMode === 'month' && <MonthView instances={expandedInstances} />}
          {viewMode === 'agenda' && <AgendaListView instances={expandedInstances} />}
        </div>
      </main>

      {/* Mobile Bottom One-Handed Navigation */}
      <MobileBottomNav onFocusQuickCapture={handleFocusQuickCapture} />

      {/* Event Detail & Live Comments Drawer */}
      <EventDetailDrawer />

      {/* Flagship Modals & Drawers */}
      <FocusTimerModal />
      <AnalyticsDashboard />
      <SmartRescheduleDrawer />
      <SharedCalendarModal />
      <CalendarSyncModal />
      <AppearanceSettingsModal />
      <CommandPalette />

      {/* Global High-Contrast Sky-Blue Toast (elevated on mobile above bottom nav & FAB) */}
      <StudioToast toast={toast} onDismiss={dismissToast} elevated={true} />

      {/* Global Studio Cloud SSO Member Portal Modal */}
      <MemberPortalModal
        isOpen={activeModal === 'member'}
        onClose={closeModal}
        currentMember={currentMember}
        onMemberChange={setCurrentMember}
        onNotify={(msg, icon) => showToast(msg, { icon })}
        syncStatus={syncStatus}
      />
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
