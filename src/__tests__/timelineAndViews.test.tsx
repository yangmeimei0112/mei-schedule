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
    const threeDayTitles = screen.getAllByTestId('week-event-title');
    expect(threeDayTitles.length).toBeGreaterThan(0);
    for (const titleNode of threeDayTitles) {
      expect(titleNode.className).toContain('schedule-title-wrap');
      expect(titleNode.className).not.toContain('truncate');
    }

    fireEvent.click(screen.getByTestId('view-tab-week'));
    expect(screen.getByTestId('week-grid-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('view-tab-month'));
    expect(screen.getByTestId('month-view')).toBeInTheDocument();
    // Verify MonthView displays titled event pills with automatic line wrap (NEVER gray-dot-only or ellipsis truncation)
    const monthPills = screen.getAllByTestId(`month-event-pill-${SEED_EVT_DEEP_WORK}`);
    expect(monthPills.length).toBeGreaterThan(0);
    expect(monthPills[0].textContent).toContain('介面原型設計與時間軸打磨');
    expect(monthPills[0].querySelector('.schedule-title-wrap')).not.toBeNull();
    expect(monthPills[0].className).not.toContain('truncate');

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

  it('v1.5.0 unified AppSidebar toggles to 64px Mini Rail and opens/closes the Right TaskInboxDrawer with task creation', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    // Unified left sidebar starts expanded on desktop with labeled tool navigation
    const sidebar = screen.getByTestId('app-sidebar');
    expect(sidebar).toHaveAttribute('data-sidebar-mode', 'expanded');
    expect(within(sidebar).getByText('智慧排程助手')).toBeInTheDocument();
    expect(within(sidebar).getByText('專注番茄鐘')).toBeInTheDocument();
    expect(within(sidebar).getByText('時間統計')).toBeInTheDocument();
    expect(within(sidebar).getByText('多人共享日曆')).toBeInTheDocument();

    // Collapse desktop sidebar -> switches smoothly into 64px Mini Rail
    fireEvent.click(screen.getByTestId('sidebar-collapse-btn'));
    expect(screen.getByTestId('app-sidebar')).toHaveAttribute('data-sidebar-mode', 'rail');

    // Expand back from Mini Rail
    fireEvent.click(screen.getByTestId('sidebar-expand-rail-btn'));
    expect(screen.getByTestId('app-sidebar')).toHaveAttribute('data-sidebar-mode', 'expanded');

    // Right Task Inbox starts collapsed for a wide breathing calendar canvas
    expect(screen.queryByTestId('task-inbox-drawer')).toBeNull();
    expect(screen.getByTestId('toggle-inbox-drawer-btn')).toBeInTheDocument();

    // Toggle Right Task Inbox Wing open via header pill
    fireEvent.click(screen.getByTestId('toggle-inbox-drawer-btn'));
    const inboxDrawer = await screen.findByTestId('task-inbox-drawer');
    expect(inboxDrawer).toBeInTheDocument();

    // Add a new task inside the Right Task Inbox Drawer
    fireEvent.change(screen.getByTestId('inbox-add-task-input'), {
      target: { value: '檢視新版側欄與右側收件匣動線' }
    });
    fireEvent.click(screen.getByTestId('inbox-add-task-btn'));
    await waitFor(() => {
      expect(within(inboxDrawer).getByText('檢視新版側欄與右側收件匣動線')).toBeInTheDocument();
    });

    // Close Right Task Inbox via Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('task-inbox-drawer')).toBeNull();
    });

    // Re-open with keyboard shortcut I
    fireEvent.keyDown(window, { key: 'i' });
    expect(await screen.findByTestId('task-inbox-drawer')).toBeInTheDocument();
  });

  it('mobile bottom-right + FAB opens a completely blank EventDetailDrawer (not QuickCaptureBar), validates input, and creates events cleanly', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('timeline-view')).toBeInTheDocument());

    const quickCaptureInput = screen.getByTestId('quick-capture-input');
    const fab = screen.getByTestId('mobile-quick-add-fab');

    // Tap bottom-right + button -> opens blank EventDetailDrawer in create mode (NEVER focuses QuickCaptureBar)
    fireEvent.click(fab);
    const drawer = await screen.findByTestId('event-detail-drawer');
    expect(drawer).toHaveAttribute('data-drawer-mode', 'create');
    expect(document.activeElement).not.toBe(quickCaptureInput);
    expect(within(drawer).getByRole('heading', { name: '新增行程' })).toBeInTheDocument();

    // Verify all inputs start completely blank / unfilled
    const titleInput = within(drawer).getByTestId('event-detail-title-input') as HTMLInputElement;
    const startInput = within(drawer).getByTestId('event-detail-start-input') as HTMLInputElement;
    const endInput = within(drawer).getByTestId('event-detail-end-input') as HTMLInputElement;
    const allDayCheckbox = within(drawer).getByTestId('event-detail-allday-checkbox') as HTMLInputElement;
    const categoryInput = within(drawer).getByTestId('event-detail-category-input') as HTMLInputElement;

    expect(titleInput.value).toBe('');
    expect(startInput.value).toBe('');
    expect(endInput.value).toBe('');
    expect(allDayCheckbox.checked).toBe(false);
    expect(categoryInput.value).toBe('');

    // Edit-only elements (Google Calendar link, delete button, comments section) must NOT appear in create mode
    expect(within(drawer).queryByText('Google 日曆')).toBeNull();
    expect(within(drawer).queryByTestId('event-detail-delete-btn')).toBeNull();
    expect(within(drawer).queryByTestId('event-comments-section')).toBeNull();
    expect(within(drawer).getByTestId('event-detail-cancel-btn')).toBeInTheDocument();

    // Cancel closes cleanly without creating any event
    fireEvent.click(within(drawer).getByTestId('event-detail-cancel-btn'));
    await waitFor(() => expect(screen.queryByTestId('event-detail-drawer')).toBeNull());

    // Re-open via + FAB and verify validation when submitting empty form
    fireEvent.click(fab);
    const drawer2 = await screen.findByTestId('event-detail-drawer');
    fireEvent.click(within(drawer2).getByTestId('event-detail-save-btn'));
    expect(within(drawer2).getByTestId('event-detail-validation-error')).toHaveTextContent('請輸入行程標題');

    // Fill title only -> requires start time (or all-day)
    fireEvent.change(within(drawer2).getByTestId('event-detail-title-input'), {
      target: { value: '設計師下午茶同步' }
    });
    fireEvent.click(within(drawer2).getByTestId('event-detail-save-btn'));
    expect(within(drawer2).getByTestId('event-detail-validation-error')).toHaveTextContent('請選擇開始時間');

    // Pick start time -> automatically suggests end time (+default duration) and saves cleanly
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    fireEvent.change(within(drawer2).getByTestId('event-detail-start-input'), {
      target: { value: `${yyyy}-${mm}-${dd}T15:00` }
    });
    const endInput2 = within(drawer2).getByTestId('event-detail-end-input') as HTMLInputElement;
    expect(endInput2.value).not.toBe('');

    fireEvent.click(within(drawer2).getByTestId('event-detail-save-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('event-detail-drawer')).toBeNull();
      expect(screen.getAllByText('設計師下午茶同步').length).toBeGreaterThan(0);
    });

    // Re-open via + FAB and create an All-Day event cleanly
    fireEvent.click(fab);
    const drawer3 = await screen.findByTestId('event-detail-drawer');
    fireEvent.change(within(drawer3).getByTestId('event-detail-title-input'), {
      target: { value: '全天團隊靈感日' }
    });
    fireEvent.click(within(drawer3).getByTestId('event-detail-allday-checkbox'));
    expect(within(drawer3).getByTestId('event-detail-start-date-input')).toBeInTheDocument();
    fireEvent.click(within(drawer3).getByTestId('event-detail-save-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('event-detail-drawer')).toBeNull();
      expect(screen.getAllByText('全天團隊靈感日').length).toBeGreaterThan(0);
    });
  });
});
