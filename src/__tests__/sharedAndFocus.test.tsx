import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { SEED_EVT_SHARED_REVIEW } from '../data/seedData';

describe('Flagship Modules: Shared Calendar & Live Comments, Focus Timer & Analytics, Smart Preview & ICS Sync', () => {
  it('supports TimeTree-grade shared calendar creation and posting live comments inside an event drawer', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    // Open Shared Calendar Modal & create a new shared calendar
    fireEvent.click(screen.getByTestId('open-shared-modal-btn'));
    const sharedModal = await screen.findByTestId('shared-calendar-modal');

    fireEvent.change(screen.getByTestId('shared-create-name-input'), {
      target: { value: '家庭週末旅遊' }
    });
    fireEvent.click(screen.getByTestId('shared-create-submit-btn'));
    await waitFor(() => {
      expect(within(sharedModal).getByText('家庭週末旅遊')).toBeInTheDocument();
    });

    // Close modal and open seeded shared event detail drawer to post a comment
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('shared-calendar-modal')).toBeNull());

    const sharedEventCard = screen.getByTestId(`timeline-event-${SEED_EVT_SHARED_REVIEW}`);
    fireEvent.click(sharedEventCard.querySelector('button.text-left')!);
    await waitFor(() => expect(screen.getByTestId('event-detail-drawer')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('event-comment-input'), {
      target: { value: '我已補充最新進度連結，會議準時開始！' }
    });
    fireEvent.click(screen.getByTestId('event-comment-submit-btn'));

    await waitFor(() => {
      expect(screen.getByText('我已補充最新進度連結，會議準時開始！')).toBeInTheDocument();
    });
  });

  it('completes a Focus Timer session and updates Analytics Dashboard totals', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-focus-modal-btn'));
    await waitFor(() => expect(screen.getByTestId('focus-timer-modal')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('focus-complete-record-btn'));
    await waitFor(() => expect(screen.queryByTestId('focus-timer-modal')).toBeNull());

    fireEvent.click(screen.getByTestId('open-analytics-modal-btn'));
    await waitFor(() => expect(screen.getByTestId('analytics-dashboard-modal')).toBeInTheDocument());
    // Initial seed has 125m; adding 25m -> 150m
    expect(screen.getByTestId('analytics-total-focus')).toHaveTextContent('150m');
  });

  it('previews Smart Auto-Fill proposals and applies them atomically with Undo support', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-smart-scheduler-btn'));
    await waitFor(() => expect(screen.getByTestId('smart-reschedule-drawer')).toBeInTheDocument());

    const applyBtn = screen.getByTestId('smart-apply-proposals-btn');
    expect(applyBtn).not.toBeDisabled();
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('smart-reschedule-drawer')).toBeNull();
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('已套用');
    });
  });

  it('imports external .ics text inside CalendarSyncModal and reports imported count', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-sync-modal-btn'));
    await waitFor(() => expect(screen.getByTestId('calendar-sync-modal')).toBeInTheDocument());

    const sampleIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:ext-demo-999@example.com',
      'DTSTART:20261124T080000Z',
      'DTEND:20261124T090000Z',
      'SUMMARY:外部匯入跨國同步會議',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    fireEvent.change(screen.getByTestId('sync-import-paste-textarea'), {
      target: { value: sampleIcs }
    });
    fireEvent.click(screen.getByTestId('sync-import-paste-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('sync-import-report')).toHaveTextContent('成功匯入 1 筆行程');
    });
  });
});
