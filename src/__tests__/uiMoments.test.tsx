import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  AudioLevelBars,
  BellToggleButton,
  BreathAura,
  ClockHandsLoader,
  CopyMorphButton,
  LikeBurstLayer,
  OdometerNumber,
  PaperPlaneSendButton,
  StrokeCheckIndicator
} from '../components/UiMomentsPrimitives';
import { getThemeMotionConfig, springValue, useBackdropDismissGuard } from '../utils/uiMomentsMotion';

const ROOT_DIR = path.resolve(__dirname, '../..');

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (/\.(ts|tsx|css)$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function BackdropGuardHarness({ onClose }: { onClose: () => void }) {
  const guard = useBackdropDismissGuard(onClose);
  return (
    <div data-testid="guard-backdrop" {...guard}>
      <div data-testid="guard-dialog" onClick={(e) => e.stopPropagation()}>
        dialog
      </div>
    </div>
  );
}

describe('v1.6.0 UI Moments Integration & Clean Offline Header', () => {
  it('enforces zero transition-all, zero hardcoded offline-first banner copy, and complete theme-adaptive & reduced-motion CSS tokens', () => {
    const srcFiles = walkSourceFiles(path.join(ROOT_DIR, 'src'));
    const transitionAllHits: string[] = [];
    const offlineLabelHits: string[] = [];

    for (const filePath of srcFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('transition-all')) {
        transitionAllHits.push(path.relative(ROOT_DIR, filePath));
      }
      if (content.includes('本機離線優先模式')) {
        offlineLabelHits.push(path.relative(ROOT_DIR, filePath));
      }
    }

    expect(transitionAllHits).toEqual([]);
    expect(offlineLabelHits).toEqual([]);

    const css = fs.readFileSync(path.join(ROOT_DIR, 'src/styles/index.css'), 'utf8');
    expect(css).toContain('--um-ease:');
    expect(css).toContain('--um-spring:');
    expect(css).toContain('--um-duration-fast:');
    expect(css).toContain('--um-duration-base:');
    expect(css).toContain('--um-duration-slow:');
    expect(css).toContain('--um-burst-scale:');
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
    expect(css).toContain('.um-card-spotlight');
    expect(css).toContain('.um-brand-tilt');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.um-view-enter');
    expect(css).toContain('.um-breath-ring');
    expect(css).toContain('.um-level-bar');
    expect(css).toContain('.um-bar-grow');
    expect(css).toContain('.um-clock-hand-minute');
    expect(css).toContain('.um-cmd-active-pill');
  });

  it('provides theme-adaptive motion presets and settles springValue immediately in test runtime', () => {
    document.documentElement.dataset.designTheme = 'sky-glass';
    const sky = getThemeMotionConfig();
    document.documentElement.dataset.designTheme = 'minimal-linear';
    const minimal = getThemeMotionConfig();
    document.documentElement.dataset.designTheme = 'warm-journal';
    const warm = getThemeMotionConfig();

    expect(minimal.durationFast).toBeLessThan(sky.durationFast);
    expect(warm.durationSlow).toBeGreaterThanOrEqual(sky.durationSlow);
    expect(minimal.burstScale).toBeLessThan(sky.burstScale);

    const onUpdate = vi.fn();
    const onDone = vi.fn();
    springValue(0, 100, 0, onUpdate, onDone);
    expect(onUpdate).toHaveBeenCalledWith(100);
    expect(onDone).toHaveBeenCalledTimes(1);

    document.documentElement.dataset.designTheme = 'sky-glass';
  });

  it('guards modal backdrops against accidental >=8px drag or inner-dialog pointerdown while allowing clean clicks', () => {
    const onClose = vi.fn();
    render(<BackdropGuardHarness onClose={onClose} />);
    const backdrop = screen.getByTestId('guard-backdrop');
    const dialog = screen.getByTestId('guard-dialog');

    // Clean click closes modal
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Drag >= 8px on backdrop does NOT close modal
    fireEvent(backdrop, new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 20 }));
    fireEvent(backdrop, new MouseEvent('pointerup', { bubbles: true, clientX: 50, clientY: 20 }));
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Pointerdown inside dialog then released on backdrop does NOT close modal
    fireEvent(dialog, new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
    fireEvent(backdrop, new MouseEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Next clean tap/click closes modal normally
    fireEvent(backdrop, new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent(backdrop, new MouseEvent('pointerup', { bubbles: true, clientX: 12, clientY: 11 }));
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders standalone UI Moments primitives (Odometer, CopyMorph, PaperPlane, BellToggle, ClockHands, BreathAura, AudioLevelBars, LikeBurst, StrokeCheck)', () => {
    const onCopy = vi.fn();
    const onSend = vi.fn();
    const onBellToggle = vi.fn();

    const { rerender } = render(
      <div>
        <OdometerNumber value={42} data-testid="prim-odo" />
        <CopyMorphButton copied={false} idleLabel="複製" copiedLabel="已複製" onClick={onCopy} data-testid="prim-copy" />
        <PaperPlaneSendButton type="button" label="排入" onClick={onSend} data-testid="prim-send" />
        <BellToggleButton active={false} label="提醒" onToggle={onBellToggle} data-testid="prim-bell" />
        <ClockHandsLoader size={18} label="同步中" data-testid="prim-clock" />
        <BreathAura active={false} data-testid="prim-breath" />
        <AudioLevelBars active={false} data-testid="prim-audio" />
        <LikeBurstLayer triggerKey={0} data-testid="prim-burst" />
        <StrokeCheckIndicator checked={false} />
      </div>
    );

    expect(screen.getByTestId('prim-odo')).toHaveTextContent('42');
    expect(screen.getByTestId('prim-copy')).toHaveAttribute('data-copied', 'false');
    fireEvent.click(screen.getByTestId('prim-copy'));
    expect(onCopy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('prim-send'));
    expect(onSend).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('prim-bell')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('prim-bell'));
    expect(onBellToggle).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('prim-clock')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('prim-breath')).toHaveAttribute('data-breath-active', 'false');
    expect(screen.getByTestId('prim-audio')).toHaveAttribute('data-audio-active', 'false');
    expect(screen.getByTestId('prim-burst')).toHaveAttribute('data-burst-count', '0');

    rerender(
      <div>
        <OdometerNumber value={43} data-testid="prim-odo" />
        <CopyMorphButton copied={true} idleLabel="複製" copiedLabel="已複製" onClick={onCopy} data-testid="prim-copy" />
        <BellToggleButton active={true} badge="15m" label="已開啟提醒" onToggle={onBellToggle} data-testid="prim-bell" />
        <BreathAura active={true} data-testid="prim-breath" />
        <AudioLevelBars active={true} data-testid="prim-audio" />
        <LikeBurstLayer triggerKey={1} data-testid="prim-burst" />
        <StrokeCheckIndicator checked={true} />
      </div>
    );

    expect(screen.getByTestId('prim-odo')).toHaveTextContent('43');
    expect(screen.getByTestId('prim-copy')).toHaveAttribute('data-copied', 'true');
    expect(screen.getByTestId('prim-bell')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('prim-breath')).toHaveAttribute('data-breath-active', 'true');
    expect(screen.getByTestId('prim-audio')).toHaveAttribute('data-audio-active', 'true');
    expect(screen.getByTestId('prim-burst')).toHaveAttribute('data-burst-count', '1');
  });

  it('integrates elastic tabs, clean sidebar without offline banner, QuickCapture NLP chips, CommandPalette keyboard pill, Appearance ring, Shared CopyMorph, Focus BreathAura & Event BellToggle inside App', async () => {
    render(<App />);

    // Request B: 「本機離線優先模式」 must NEVER appear in the UI
    expect(document.body.textContent).not.toContain('本機離線優先模式');

    // F1: Elastic tab indicators exist across desktop/mobile view tabs and sidebar themes
    expect(screen.getByTestId('desktop-view-tab-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-view-tab-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-theme-indicator')).toBeInTheDocument();

    // Desktop 5-view switcher stays pinned in a 3-column CSS Grid regardless of date string width
    const switcher = screen.getByTestId('desktop-view-switcher');
    expect(switcher.className).toContain('lg:justify-self-center');
    const headerRow = switcher.parentElement;
    expect(headerRow?.className).toContain('lg:grid');
    expect(headerRow?.className).toContain('minmax(0,1fr)_auto_minmax(0,1fr)');

    // F4: QuickCapture NLP token chips animate in on live input
    const quickInput = screen.getByTestId('quick-capture-input');
    fireEvent.change(quickInput, { target: { value: '明天下午3點開會 60分鐘 #工作' } });
    await waitFor(() => {
      expect(document.querySelectorAll('.um-chip-enter').length).toBeGreaterThan(0);
    });

    // F14: CommandPalette ArrowDown/ArrowUp + active pill
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByTestId('command-palette-modal')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-active-pill')).toBeInTheDocument();
    const cmdInput = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(cmdInput, { key: 'ArrowDown' });
    fireEvent.keyDown(cmdInput, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('command-palette-modal')).not.toBeInTheDocument();
    });

    // F7: Appearance Settings Plan Picker Ring
    fireEvent.click(screen.getByTestId('open-appearance-modal-btn'));
    expect(await screen.findByTestId('appearance-settings-modal')).toBeInTheDocument();
    expect(screen.getByTestId('appearance-plan-picker-ring')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-theme-card-warm-journal'));
    expect(screen.getByTestId('modal-theme-card-warm-journal')).toHaveAttribute('data-um-plan-active', 'true');
    fireEvent.click(screen.getByLabelText('關閉外觀設定'));

    // F10: Analytics GPU scaleY bars & spotlight KPI cards
    fireEvent.click(screen.getByTestId('open-analytics-modal-btn'));
    expect(await screen.findByTestId('analytics-dashboard-modal')).toBeInTheDocument();
    expect(document.querySelectorAll('.um-bar-grow').length).toBe(7);
    fireEvent.click(screen.getByLabelText('關閉統計儀表板'));

    // F5 + F6: Focus Timer BreathAura + AudioLevelBars
    fireEvent.click(screen.getByTestId('open-focus-modal-btn'));
    expect(await screen.findByTestId('focus-timer-modal')).toBeInTheDocument();
    expect(screen.getByTestId('focus-breath-aura')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('focus-track-warm-lofi'));
    fireEvent.click(screen.getByTestId('focus-timer-toggle-btn'));
    expect(screen.getByTestId('focus-breath-aura')).toHaveAttribute('data-breath-active', 'true');
    await waitFor(() => {
      expect(screen.getByTestId('focus-modal-level-bars')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('關閉番茄鐘'));

    // Background FocusMiniPill shows AudioLevelBars when modal closes while running
    expect(await screen.findByTestId('focus-mini-level-bars')).toBeInTheDocument();

    // F9: Shared Calendar CopyMorphButton
    fireEvent.click(screen.getByTestId('open-shared-modal-btn'));
    expect(await screen.findByTestId('shared-calendar-modal')).toBeInTheDocument();
    const copyBtn = document.querySelector<HTMLButtonElement>('[data-testid^="copy-invite-code-"]');
    expect(copyBtn).not.toBeNull();
    if (copyBtn) {
      fireEvent.click(copyBtn);
      await waitFor(() => {
        expect(copyBtn).toHaveAttribute('data-copied', 'true');
      });
    }
    fireEvent.click(screen.getByLabelText('關閉共享日曆管理'));

    // F11: EventDetailDrawer BellToggleButton
    fireEvent.click(screen.getByTestId('mobile-quick-add-fab'));
    const bellBtn = await screen.findByTestId('event-detail-reminder-bell');
    expect(bellBtn).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(bellBtn);
    expect(bellBtn).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('event-detail-cancel-btn'));
  });
});
