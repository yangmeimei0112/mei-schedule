import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { SEED_EVT_DEEP_WORK } from '../data/seedData';

describe('Five Core Schedule Views, Quick Capture NLP, Month Title Bars & Command Palette', () => {
  it('creates an event via bilingual natural language QuickCaptureBar and supports Undo from Toast', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    const input = screen.getByTestId('quick-capture-input');
    fireEvent.change(input, {
      target: { value: '今天下午4點品牌簡報預演 45分鐘 #工作 !高' }
    });

    expect(screen.getByTestId('quick-capture-preview')).toHaveTextContent('品牌簡報預演');
    expect(screen.getByTestId('nlp-token-tag')).toHaveTextContent('#工作');

    fireEvent.click(screen.getByTestId('quick-capture-submit-btn'));

    await waitFor(() => {
      expect(screen.getAllByText('品牌簡報預演').length).toBeGreaterThan(0);
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('品牌簡報預演');
    });

    // Click Undo inside Sky-Blue Toast
    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    await waitFor(() => {
      expect(screen.queryByText('品牌簡報預演')).toBeNull();
    });
  });

  it('switches across all 5 views (day / 3day / week / month / agenda) and renders titled color pills in MonthView', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('view-tab-3day'));
    expect(screen.getByTestId('three-day-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('view-tab-week'));
    expect(screen.getByTestId('week-grid-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('view-tab-month'));
    expect(screen.getByTestId('month-view')).toBeInTheDocument();
    // Verify MonthView displays titled event pills (NEVER meaningless gray-dot-only cells)
    const monthPills = screen.getAllByTestId(`month-event-pill-${SEED_EVT_DEEP_WORK}`);
    expect(monthPills.length).toBeGreaterThan(0);
    expect(monthPills[0].textContent).toContain('介面原型設計與時間軸打磨');

    fireEvent.click(screen.getByTestId('view-tab-agenda'));
    expect(screen.getByTestId('agenda-list-view')).toBeInTheDocument();
  });

  it('supports -15m/+15m mobile-safe duration adjustment and Cmd+K global command palette search', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    // Resize seeded event by +15m
    fireEvent.click(screen.getByTestId(`resize-plus-15-${SEED_EVT_DEEP_WORK}`));
    await waitFor(() => {
      expect(screen.getByTestId('studio-toast')).toHaveTextContent('已調整行程時間塊');
    });

    // Open Command Palette with Cmd+K and search
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const paletteModal = await screen.findByTestId('command-palette-modal');

    fireEvent.change(screen.getByTestId('command-palette-input'), {
      target: { value: '評審會' }
    });
    expect(within(paletteModal).getByText('咩創跨平台設計評審會')).toBeInTheDocument();
  });

  it('renders Electron compact DesktopTrayWidget when hash route is #/tray', async () => {
    window.history.replaceState(null, '', '/#/tray');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('desktop-tray-widget')).toBeInTheDocument();
    });
    expect(screen.getByText('咩時光今日快覽')).toBeInTheDocument();
    window.history.replaceState(null, '', '/');
  });
});
