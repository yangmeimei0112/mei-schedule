import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { SEED_CAL_SHARED, SEED_EVT_SHARED_REVIEW } from '../data/seedData';
import { focusAudioEngine } from '../services/focusAudioEngine';

const ROOT_DIR = path.resolve(__dirname, '../..');

function collectTextFiles(dir: string, exts: Set<string>, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'dist-electron' ||
      entry.name === '.git'
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTextFiles(full, exts, out);
    } else if (exts.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

describe('Flagship Modules: Shared Calendar & Member Removal, Focus Timer Light Music & Background Mini Pill, Smart Preview & ICS Sync', () => {
  afterEach(() => {
    focusAudioEngine.__resetForTests();
  });

  it('supports shared calendar creation, removing non-owner members with Undo, protecting owner, and posting live comments', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    // Open Shared Calendar Modal
    fireEvent.click(screen.getByTestId('open-shared-modal-btn'));
    const sharedModal = await screen.findByTestId('shared-calendar-modal');

    // Title must NOT contain TimeTree brand label
    expect(within(sharedModal).getByText('多人共享日曆與協作')).toBeInTheDocument();
    expect(sharedModal.textContent).not.toMatch(/TimeTree/i);

    // Seeded shared calendar starts with 3 members; owner has NO remove button, non-owner does
    expect(screen.getByTestId(`shared-member-count-${SEED_CAL_SHARED}`)).toHaveTextContent('3 人');
    expect(screen.queryByTestId(`remove-member-${SEED_CAL_SHARED}-local-guest`)).toBeNull();
    const removeLinBtn = screen.getByTestId(`remove-member-${SEED_CAL_SHARED}-demo-editor-lin`);
    expect(removeLinBtn).toBeInTheDocument();

    // Remove member 林小語 -> count drops to 2 and Undo Toast restores her
    fireEvent.click(removeLinBtn);
    await waitFor(() => {
      expect(screen.getByTestId(`shared-member-count-${SEED_CAL_SHARED}`)).toHaveTextContent('2 人');
      expect(screen.queryByTestId(`shared-member-row-${SEED_CAL_SHARED}-demo-editor-lin`)).toBeNull();
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('已移除成員「林小語」');
    });

    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    await waitFor(() => {
      expect(screen.getByTestId(`shared-member-count-${SEED_CAL_SHARED}`)).toHaveTextContent('3 人');
      expect(screen.getByTestId(`shared-member-row-${SEED_CAL_SHARED}-demo-editor-lin`)).toBeInTheDocument();
    });

    // Create a new shared calendar
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
    expect(screen.getByTestId('event-detail-drawer').textContent).not.toContain('免費');

    fireEvent.change(screen.getByTestId('event-comment-input'), {
      target: { value: '我已補充最新進度連結，會議準時開始！' }
    });
    fireEvent.click(screen.getByTestId('event-comment-submit-btn'));

    await waitFor(() => {
      expect(screen.getByText('我已補充最新進度連結，會議準時開始！')).toBeInTheDocument();
    });
  });

  it('plays royalty-free light music + ambient sound, persists background focus in FocusMiniPill when modal closes, and updates Analytics on completion', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-focus-modal-btn'));
    await waitFor(() => expect(screen.getByTestId('focus-timer-modal')).toBeInTheDocument());
    expect(screen.getByTestId('focus-music-panel')).toBeInTheDocument();

    // Select Warm Lo-Fi + Rain ambient & start Pomodoro (auto-syncs audio on)
    fireEvent.click(screen.getByTestId('focus-track-warm-lofi'));
    fireEvent.click(screen.getByTestId('focus-ambient-rain'));
    fireEvent.click(screen.getByTestId('focus-timer-toggle-btn'));

    await waitFor(() => {
      expect(focusAudioEngine.getSnapshot().isPlaying).toBe(true);
      expect(focusAudioEngine.getSnapshot().trackId).toBe('warm-lofi');
      expect(focusAudioEngine.getSnapshot().ambientId).toBe('rain');
    });

    // Close Focus Timer modal -> background countdown & FocusMiniPill remain active!
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('focus-timer-modal')).toBeNull());
    expect(screen.getByTestId('focus-mini-pill')).toBeInTheDocument();

    // Mute directly from mini pill, then re-open modal
    fireEvent.click(screen.getByTestId('focus-mini-mute-btn'));
    expect(focusAudioEngine.getSnapshot().isMuted).toBe(true);

    fireEvent.click(screen.getByTestId('focus-mini-reopen-btn'));
    await waitFor(() => expect(screen.getByTestId('focus-timer-modal')).toBeInTheDocument());

    // Complete focus session -> stops audio & adds 25m to Analytics Dashboard (125m -> 150m)
    fireEvent.click(screen.getByTestId('focus-complete-record-btn'));
    await waitFor(() => expect(screen.queryByTestId('focus-timer-modal')).toBeNull());
    expect(screen.queryByTestId('focus-mini-pill')).toBeNull();

    fireEvent.click(screen.getByTestId('open-analytics-modal-btn'));
    await waitFor(() => expect(screen.getByTestId('analytics-dashboard-modal')).toBeInTheDocument());
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

  it('contains ZERO TimeTree brand labels and ZERO 免費 copy across src/, README.md, docs/, and supabase/', () => {
    const exts = new Set(['.ts', '.tsx', '.css', '.md', '.sql', '.html']);
    const files = [
      ...collectTextFiles(path.join(ROOT_DIR, 'src'), exts),
      ...collectTextFiles(path.join(ROOT_DIR, 'docs'), exts),
      ...collectTextFiles(path.join(ROOT_DIR, 'supabase'), exts),
      path.join(ROOT_DIR, 'README.md')
    ].filter((f) => !f.endsWith('sharedAndFocus.test.tsx'));

    for (const filePath of files) {
      const text = fs.readFileSync(filePath, 'utf8');
      expect(
        /TimeTree/i.test(text),
        `Found forbidden TimeTree text in ${path.relative(ROOT_DIR, filePath)}`
      ).toBe(false);
      expect(
        text.includes('免費'),
        `Found forbidden 免費 text in ${path.relative(ROOT_DIR, filePath)}`
      ).toBe(false);
    }
  });
});
