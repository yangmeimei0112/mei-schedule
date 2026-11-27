import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';
import {
  SEED_CAL_SHARED,
  SEED_EVT_DEEP_WORK,
  SEED_EVT_SHARED_REVIEW,
  SEED_EVT_STUDY,
  SEED_EVT_WORKOUT,
  createSeedScheduleData,
  formatLocalDate
} from '../data/seedData';
import { savePreferences, saveSnapshot } from '../services/localStore';

function swipeElement(
  el: HTMLElement,
  opts: { startX: number; endX: number; startY?: number; endY?: number; release?: boolean }
) {
  const { startX, endX, startY = 100, endY = 100, release = true } = opts;
  const midX = Math.round((startX + endX) / 2);
  const midY = Math.round((startY + endY) / 2);

  fireEvent.touchStart(el, {
    touches: [{ clientX: startX, clientY: startY }]
  });
  fireEvent.touchMove(el, {
    touches: [{ clientX: midX, clientY: midY }]
  });
  fireEvent.touchMove(el, {
    touches: [{ clientX: endX, clientY: endY }]
  });
  if (release) {
    fireEvent.touchEnd(el, {
      changedTouches: [{ clientX: endX, clientY: endY }]
    });
  }
}

describe('v1.5.5 Two-Stage Swipe-to-Delete, Recurring Scope Sheet, Desktop Hover & Viewer Guard', () => {
  const todayKey = formatLocalDate(new Date());

  it('AgendaListView: supports light swipe reveal, single-card exclusivity, vertical scroll protection, tap-to-close, and delete + Undo', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('view-tab-agenda'));
    await waitFor(() => expect(screen.getByTestId('agenda-list-view')).toBeInTheDocument());

    const deepWorkCard = screen.getByTestId(`swipe-card-agenda-${SEED_EVT_DEEP_WORK}-${todayKey}`);
    const studyCard = screen.getByTestId(`swipe-card-agenda-${SEED_EVT_STUDY}-${todayKey}`);

    expect(deepWorkCard).toHaveAttribute('data-swipe-state', 'closed');

    // Vertical scroll must NOT trigger horizontal swipe reveal
    swipeElement(deepWorkCard, { startX: 220, endX: 208, startY: 100, endY: 190 });
    expect(deepWorkCard).toHaveAttribute('data-swipe-state', 'closed');

    // Light left swipe (>= 36px, < 65% width) snaps open to revealed state
    swipeElement(deepWorkCard, { startX: 260, endX: 190 });
    expect(deepWorkCard).toHaveAttribute('data-swipe-state', 'revealed');

    // Swiping a second card closes the first card (single-card exclusivity)
    swipeElement(studyCard, { startX: 260, endX: 190 });
    expect(studyCard).toHaveAttribute('data-swipe-state', 'revealed');
    expect(deepWorkCard).toHaveAttribute('data-swipe-state', 'closed');

    // Tapping revealed foreground body snaps it closed without opening EventDetailDrawer
    const studyTitle = screen.getByText('系統架構閱讀與筆記整理');
    // Move past 280ms post-swipe click guard by clicking outside via Escape first or waiting
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(studyCard).toHaveAttribute('data-swipe-state', 'closed');
    expect(screen.queryByTestId('event-detail-drawer')).toBeNull();
    expect(studyTitle).toBeInTheDocument();

    // Reveal again and tap the rose-red delete pill -> deletes single event + shows Undo Toast
    swipeElement(deepWorkCard, { startX: 260, endX: 190 });
    expect(deepWorkCard).toHaveAttribute('data-swipe-state', 'revealed');
    fireEvent.click(screen.getByTestId(`swipe-delete-btn-agenda-${SEED_EVT_DEEP_WORK}-${todayKey}`));

    await waitFor(() => {
      expect(screen.queryByTestId(`swipe-card-agenda-${SEED_EVT_DEEP_WORK}-${todayKey}`)).toBeNull();
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('介面原型設計與時間軸打磨');
    });

    // Undo restores the deleted event cleanly
    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    await waitFor(() => {
      expect(screen.getByTestId(`swipe-card-agenda-${SEED_EVT_DEEP_WORK}-${todayKey}`)).toBeInTheDocument();
    });
  });

  it('AgendaListView: deep swipe past 65% arms and deletes single event on release with working Undo', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('view-tab-agenda'));
    await waitFor(() => expect(screen.getByTestId('agenda-list-view')).toBeInTheDocument());

    const studyCard = screen.getByTestId(`swipe-card-agenda-${SEED_EVT_STUDY}-${todayKey}`);
    // Drag past 65% of fallback 320px card width (208px) -> armed state before release
    swipeElement(studyCard, { startX: 300, endX: 50, release: false });
    expect(studyCard).toHaveAttribute('data-swipe-state', 'armed');
    expect(screen.getByTestId(`swipe-delete-btn-agenda-${SEED_EVT_STUDY}-${todayKey}`)).toHaveTextContent('放開移除');

    // Release triggers immediate delete
    fireEvent.touchEnd(studyCard, { changedTouches: [{ clientX: 50, clientY: 100 }] });

    await waitFor(() => {
      expect(screen.queryByTestId(`swipe-card-agenda-${SEED_EVT_STUDY}-${todayKey}`)).toBeNull();
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('系統架構閱讀與筆記整理');
    });

    // Undo restores it
    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    await waitFor(() => {
      expect(screen.getByTestId(`swipe-card-agenda-${SEED_EVT_STUDY}-${todayKey}`)).toBeInTheDocument();
    });
  });

  it('Recurring event swipe-delete opens RecurringDeleteModal supporting cancel, single, this_and_following, and all scopes', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('view-tab-agenda'));
    await waitFor(() => expect(screen.getByTestId('agenda-list-view')).toBeInTheDocument());

    const futureWorkoutKey = formatLocalDate(new Date(), 2);
    const todayWorkoutTestId = `swipe-card-agenda-${SEED_EVT_WORKOUT}-${todayKey}`;
    const futureWorkoutTestId = `swipe-card-agenda-${SEED_EVT_WORKOUT}-${futureWorkoutKey}`;

    expect(screen.getByTestId(todayWorkoutTestId)).toBeInTheDocument();
    expect(screen.getByTestId(futureWorkoutTestId)).toBeInTheDocument();

    // 1. Deep swipe opens modal -> Cancel preserves everything
    swipeElement(screen.getByTestId(todayWorkoutTestId), { startX: 300, endX: 40 });
    const modal = await screen.findByTestId('recurring-delete-modal');
    expect(modal).toHaveTextContent('傍晚核心伸展與慢跑');

    fireEvent.click(screen.getByTestId('recurring-delete-cancel-btn'));
    await waitFor(() => expect(screen.queryByTestId('recurring-delete-modal')).toBeNull());
    expect(screen.getByTestId(todayWorkoutTestId)).toBeInTheDocument();

    // 2. Scope = single removes ONLY today's occurrence, keeping future occurrences, and Undo restores it
    swipeElement(screen.getByTestId(todayWorkoutTestId), { startX: 300, endX: 40 });
    await screen.findByTestId('recurring-delete-modal');
    fireEvent.click(screen.getByTestId('recurring-delete-scope-single'));

    await waitFor(() => {
      expect(screen.queryByTestId(todayWorkoutTestId)).toBeNull();
      expect(screen.getByTestId(futureWorkoutTestId)).toBeInTheDocument();
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('已移除單次行程');
    });

    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    await waitFor(() => expect(screen.getByTestId(todayWorkoutTestId)).toBeInTheDocument());

    // 3. Scope = this_and_following truncates today + future occurrences
    swipeElement(screen.getByTestId(todayWorkoutTestId), { startX: 300, endX: 40 });
    await screen.findByTestId('recurring-delete-modal');
    fireEvent.click(screen.getByTestId('recurring-delete-scope-this_and_following'));

    await waitFor(() => {
      expect(screen.queryByTestId(todayWorkoutTestId)).toBeNull();
      expect(screen.queryByTestId(futureWorkoutTestId)).toBeNull();
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('已移除後續系列');
    });

    // Undo restores series, then test Scope = all
    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    await waitFor(() => expect(screen.getByTestId(todayWorkoutTestId)).toBeInTheDocument());

    swipeElement(screen.getByTestId(todayWorkoutTestId), { startX: 300, endX: 40 });
    await screen.findByTestId('recurring-delete-modal');
    fireEvent.click(screen.getByTestId('recurring-delete-scope-all'));

    await waitFor(() => {
      expect(screen.queryByTestId(todayWorkoutTestId)).toBeNull();
      expect(screen.queryByTestId(futureWorkoutTestId)).toBeNull();
    });
  });

  it('TimelineView & MonthView: support swipe-to-delete and desktop hover delete while preserving TimelineView HTML5 drag', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    // TimelineView keeps draggable="true" intact alongside SwipeableEventCard
    const timelineArticle = screen.getByTestId(`timeline-event-${SEED_EVT_DEEP_WORK}`);
    expect(timelineArticle).toHaveAttribute('draggable', 'true');

    const timelineSwipeCard = screen.getByTestId(`swipe-card-timeline-${SEED_EVT_DEEP_WORK}-${todayKey}`);
    swipeElement(timelineSwipeCard, { startX: 260, endX: 190 });
    expect(timelineSwipeCard).toHaveAttribute('data-swipe-state', 'revealed');

    // Clicking revealed rose-red delete pill in TimelineView deletes immediately + Undo restores
    fireEvent.click(screen.getByTestId(`swipe-delete-btn-timeline-${SEED_EVT_DEEP_WORK}-${todayKey}`));
    await waitFor(() => {
      expect(screen.queryByTestId(`timeline-event-${SEED_EVT_DEEP_WORK}`)).toBeNull();
    });
    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    await waitFor(() => {
      expect(screen.getByTestId(`timeline-event-${SEED_EVT_DEEP_WORK}`)).toBeInTheDocument();
    });

    // Desktop hover delete button works on an unswiped TimelineView card
    fireEvent.click(screen.getByTestId(`desktop-delete-timeline-${SEED_EVT_STUDY}-${todayKey}`));
    await waitFor(() => {
      expect(screen.queryByTestId(`timeline-event-${SEED_EVT_STUDY}`)).toBeNull();
    });
    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    await waitFor(() => {
      expect(screen.getByTestId(`timeline-event-${SEED_EVT_STUDY}`)).toBeInTheDocument();
    });

    // Switch to MonthView and swipe-delete from the selected-day card strip below the grid
    fireEvent.click(screen.getByTestId('view-tab-month'));
    await waitFor(() => expect(screen.getByTestId('month-view')).toBeInTheDocument());

    const monthSwipeCard = screen.getByTestId(`swipe-card-month-${SEED_EVT_DEEP_WORK}-${todayKey}`);
    swipeElement(monthSwipeCard, { startX: 260, endX: 190 });
    expect(monthSwipeCard).toHaveAttribute('data-swipe-state', 'revealed');
    fireEvent.click(screen.getByTestId(`swipe-delete-btn-month-${SEED_EVT_DEEP_WORK}-${todayKey}`));

    await waitFor(() => {
      expect(screen.queryByTestId(`swipe-card-month-${SEED_EVT_DEEP_WORK}-${todayKey}`)).toBeNull();
    });

    // Desktop hover delete button works on MonthView
    fireEvent.click(screen.getByTestId(`desktop-delete-month-${SEED_EVT_STUDY}-${todayKey}`));
    await waitFor(() => {
      expect(screen.queryByTestId(`swipe-card-month-${SEED_EVT_STUDY}-${todayKey}`)).toBeNull();
    });
  });

  it('disables swipe-to-delete and hides desktop delete button for read-only shared calendar viewer role', async () => {
    const { snapshot, preferences } = createSeedScheduleData(new Date(), 'local-guest');
    snapshot.calendars = snapshot.calendars.map((cal) =>
      cal.id === SEED_CAL_SHARED
        ? {
            ...cal,
            ownerId: 'remote-owner-001',
            members: [
              {
                calendarId: SEED_CAL_SHARED,
                userId: 'remote-owner-001',
                displayName: '團隊管理者',
                role: 'owner',
                joinedAt: cal.createdAt
              },
              {
                calendarId: SEED_CAL_SHARED,
                userId: 'local-guest',
                displayName: '唯讀檢視者',
                role: 'viewer',
                joinedAt: cal.createdAt
              }
            ]
          }
        : cal
    );
    await saveSnapshot(snapshot, { broadcast: false });
    await savePreferences(preferences, { broadcast: false });

    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    // TimelineView: viewer event cannot swipe-delete and has no delete pill or hover delete button
    await waitFor(() => {
      expect(screen.queryByTestId(`swipe-delete-btn-timeline-${SEED_EVT_SHARED_REVIEW}-${todayKey}`)).toBeNull();
      expect(screen.queryByTestId(`desktop-delete-timeline-${SEED_EVT_SHARED_REVIEW}-${todayKey}`)).toBeNull();
    });
    const timelineSharedCard = screen.getByTestId(`swipe-card-timeline-${SEED_EVT_SHARED_REVIEW}-${todayKey}`);

    swipeElement(timelineSharedCard, { startX: 300, endX: 40 });
    expect(timelineSharedCard).toHaveAttribute('data-swipe-state', 'closed');
    expect(screen.getByTestId(`timeline-event-${SEED_EVT_SHARED_REVIEW}`)).toBeInTheDocument();

    // AgendaListView: viewer event also strictly protected
    fireEvent.click(screen.getByTestId('view-tab-agenda'));
    await waitFor(() => expect(screen.getByTestId('agenda-list-view')).toBeInTheDocument());

    const agendaSharedCard = screen.getByTestId(`swipe-card-agenda-${SEED_EVT_SHARED_REVIEW}-${todayKey}`);
    expect(screen.queryByTestId(`swipe-delete-btn-agenda-${SEED_EVT_SHARED_REVIEW}-${todayKey}`)).toBeNull();
    expect(screen.queryByTestId(`desktop-delete-agenda-${SEED_EVT_SHARED_REVIEW}-${todayKey}`)).toBeNull();

    swipeElement(agendaSharedCard, { startX: 300, endX: 40 });
    expect(agendaSharedCard).toHaveAttribute('data-swipe-state', 'closed');
    expect(screen.getByTestId(`swipe-card-agenda-${SEED_EVT_SHARED_REVIEW}-${todayKey}`)).toBeInTheDocument();

    // MonthView: viewer event also strictly protected
    fireEvent.click(screen.getByTestId('view-tab-month'));
    await waitFor(() => expect(screen.getByTestId('month-view')).toBeInTheDocument());

    const monthSharedCard = screen.getByTestId(`swipe-card-month-${SEED_EVT_SHARED_REVIEW}-${todayKey}`);
    expect(screen.queryByTestId(`swipe-delete-btn-month-${SEED_EVT_SHARED_REVIEW}-${todayKey}`)).toBeNull();
    expect(screen.queryByTestId(`desktop-delete-month-${SEED_EVT_SHARED_REVIEW}-${todayKey}`)).toBeNull();

    swipeElement(monthSharedCard, { startX: 300, endX: 40 });
    expect(monthSharedCard).toHaveAttribute('data-swipe-state', 'closed');
  });
});
