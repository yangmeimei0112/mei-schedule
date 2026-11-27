import { useCallback, useState } from 'react';
import { applyRecurringDelete } from '../services/recurrenceEngine';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ExpandedEventInstance, RecurrenceEditScope } from '../types/schedule';

/**
 * Shared quick-delete workflow for AgendaListView, TimelineView, and MonthView:
 * - Blocks viewer-only shared calendar events cleanly.
 * - Single events delete immediately via deleteEvent() with Undo Toast.
 * - Recurring events open RecurringDeleteModal for single / this_and_following / all choice.
 */
export function useEventQuickDelete() {
  const {
    events,
    deleteEvent,
    replaceEventsAtomic,
    getCurrentUserRoleForCalendar,
    showToast
  } = useScheduleStore();

  const [pendingRecurringEvent, setPendingRecurringEvent] =
    useState<ExpandedEventInstance | null>(null);

  const canDeleteEvent = useCallback(
    (evt: ExpandedEventInstance): boolean => {
      return getCurrentUserRoleForCalendar(evt.calendarId) !== 'viewer';
    },
    [getCurrentUserRoleForCalendar]
  );

  const requestDeleteEvent = useCallback(
    (evt: ExpandedEventInstance) => {
      if (!canDeleteEvent(evt)) {
        showToast('您在此共享日曆為檢視者權限，無法移除行程', { icon: 'lock' });
        return;
      }
      if (evt.recurrenceRule) {
        setPendingRecurringEvent(evt);
        return;
      }
      deleteEvent(evt.masterEventId);
    },
    [canDeleteEvent, deleteEvent, showToast]
  );

  const confirmRecurringDelete = useCallback(
    (scope: RecurrenceEditScope) => {
      if (!pendingRecurringEvent) return;
      const target = pendingRecurringEvent;
      setPendingRecurringEvent(null);

      if (scope === 'all') {
        deleteEvent(target.masterEventId);
        return;
      }

      const nextEvents = applyRecurringDelete(
        events,
        target.masterEventId,
        target.occurrenceDate,
        scope
      );
      replaceEventsAtomic(
        nextEvents,
        scope === 'single'
          ? `已移除單次行程「${target.title}」`
          : `已移除後續系列「${target.title}」`
      );
    },
    [deleteEvent, events, pendingRecurringEvent, replaceEventsAtomic]
  );

  const cancelRecurringDelete = useCallback(() => {
    setPendingRecurringEvent(null);
  }, []);

  return {
    pendingRecurringEvent,
    canDeleteEvent,
    requestDeleteEvent,
    confirmRecurringDelete,
    cancelRecurringDelete
  };
}
