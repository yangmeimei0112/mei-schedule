import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  BrandMark,
  CANDIDATE_F_CLOUD_PATH,
  CANDIDATE_F_INFINITY_PATH,
  LOGO_SIZES,
  LucideIcon,
  MEI_SCHEDULE_LOGO_PINS_PATH,
  MeiScheduleLogo,
  StudioLogo
} from '../components/BrandMark';
import AppPreloaderOverlay from '../components/AppPreloaderOverlay';
import StudioToast from '../components/StudioToast';
import {
  COLOR_MODE_TRANSITION_MS,
  PRELOAD_SESSION_KEY,
  THEME_TRANSITION_MS,
  __resetPreloadEngineForTests
} from '../services/preloadEngine';
import type { DesignTheme } from '../types/schedule';

const ROOT_DIR = path.resolve(__dirname, '../..');
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

function walkFiles(dir: string, exts: Set<string>, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

describe('M1 Visual System: 3 Themes x 2 Modes, Sky-Blue Toast, dvh & 4 Aspect Ratios, Zero Emoji & Candidate F', () => {
  it('switches across all 6 theme combinations (3 design themes x light/dark) and reflects on <html>', async () => {
    render(<App />);

    expect(screen.getByTestId('theme-switch-sky-glass')).toHaveTextContent('晴空');
    expect(screen.getByTestId('theme-switch-minimal-linear')).toHaveTextContent('極簡');
    expect(screen.getByTestId('theme-switch-warm-journal')).toHaveTextContent('溫暖');

    const themes: DesignTheme[] = ['sky-glass', 'minimal-linear', 'warm-journal'];
    for (const theme of themes) {
      fireEvent.click(screen.getByTestId(`theme-switch-${theme}`));
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-design-theme')).toBe(theme);
      });

      // Toggle dark mode on
      const toggleBtn = screen.getByTestId('color-mode-toggle-btn');
      if (!document.documentElement.classList.contains('dark')) {
        fireEvent.click(toggleBtn);
      }
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.getAttribute('data-design-theme')).toBe(theme);
      });

      // Toggle light mode back on
      fireEvent.click(toggleBtn);
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(document.documentElement.getAttribute('data-design-theme')).toBe(theme);
      });
    }

    const css = fs.readFileSync(path.join(ROOT_DIR, 'src/styles/index.css'), 'utf8');
    expect(css).toContain(':root[data-design-theme="sky-glass"]');
    expect(css).toContain(':root.dark[data-design-theme="sky-glass"]');
    expect(css).toContain(':root[data-design-theme="minimal-linear"]');
    expect(css).toContain(':root.dark[data-design-theme="minimal-linear"]');
    expect(css).toContain(':root[data-design-theme="warm-journal"]');
    expect(css).toContain(':root.dark[data-design-theme="warm-journal"]');
  });

  it('renders high-contrast sky-blue [data-testid="studio-toast"] with mobile anti-overlap and working Undo/Close actions', () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    render(
      <StudioToast
        toast={{
          message: '已套用 2 筆排程建議',
          icon: 'sparkles',
          actionLabel: '復原',
          onAction,
          timestamp: 12345
        }}
        onDismiss={onDismiss}
        elevated={true}
      />
    );

    const toastEl = screen.getByTestId('studio-toast');
    expect(toastEl).toHaveAttribute('role', 'status');
    expect(toastEl).toHaveAttribute('aria-live', 'polite');

    const cls = toastEl.className;
    expect(cls).toContain('bg-sky-100/95');
    expect(cls).toContain('dark:bg-sky-950/95');
    expect(cls).toContain('text-slate-900');
    expect(cls).toContain('dark:text-white');
    expect(cls).toContain('border-sky-300/80');
    expect(cls).toContain('dark:border-sky-400/40');
    expect(cls).toContain('bottom-36');
    expect(cls).toContain('sm:bottom-24');
    expect(cls).toContain('max-w-[calc(100vw-2rem)]');

    fireEvent.click(screen.getByTestId('studio-toast-action-btn'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('studio-toast-close-btn'));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('enforces Studio fonts, all 6 dvh utility classes with vh fallbacks, 4 aspect-ratio queries, and no transition: all on primary/secondary buttons', () => {
    const css = fs.readFileSync(path.join(ROOT_DIR, 'src/styles/index.css'), 'utf8');

    // Studio typography stack
    expect(css).toContain('Zen Maru Gothic');
    expect(css).toContain('Alibaba PuHuiTi 3.0');
    expect(css).toContain('AlibabaPuHuiTi-3-85-Bold.woff2');
    expect(css).toContain('AlibabaPuHuiTi-3-55-Regular.woff2');
    expect(css).toContain('Noto Sans TC');
    expect(css).toContain('JetBrains Mono');

    // All 6 dvh utility classes with vh fallback preceding dvh
    const dvhPairs: Array<[string, string, string]> = [
      ['.min-h-dvh-screen', 'min-height: 100vh;', 'min-height: 100dvh;'],
      ['.h-dvh-90', 'height: 90vh;', 'height: 90dvh;'],
      ['.max-h-dvh-92', 'max-height: 92vh;', 'max-height: 92dvh;'],
      ['.max-h-dvh-90', 'max-height: 90vh;', 'max-height: 90dvh;'],
      ['.max-h-dvh-85', 'max-height: 85vh;', 'max-height: 85dvh;'],
      ['.max-h-dvh-60', 'max-height: 60vh;', 'max-height: 60dvh;']
    ];

    for (const [selector, vhRule, dvhRule] of dvhPairs) {
      const selIdx = css.indexOf(selector);
      expect(selIdx, `Missing ${selector}`).toBeGreaterThan(-1);
      const block = css.slice(selIdx, selIdx + 160);
      const vhPos = block.indexOf(vhRule);
      const dvhPos = block.indexOf(dvhRule);
      expect(vhPos, `Missing vh fallback in ${selector}`).toBeGreaterThan(-1);
      expect(dvhPos, `Missing dvh rule in ${selector}`).toBeGreaterThan(vhPos);
    }

    // 4 aspect-ratio adaptation rules & responsive utilities
    expect(css).toContain('@media (max-width: 360px)');
    expect(css).toContain('@media (max-width: 374px)');
    expect(css).toContain('@media (min-width: 375px) and (max-width: 430px)');
    expect(css).toContain('min-aspect-ratio: 3/4');
    expect(css).toContain('max-aspect-ratio: 4/3');
    expect(css).toContain('@media (orientation: landscape) and (max-height: 500px)');
    expect(css).toContain('.studio-hero-title-zh');
    expect(css).toContain('.studio-hero-title-en');
    expect(css).toContain('clamp(');
    expect(css).toContain('.studio-tagline-justify');
    expect(css).toContain('.narrow-compact-px');
    expect(css).toContain('.foldable-inner-grid');
    expect(css).toContain('.mobile-header-bar');
    expect(css).toContain('.mobile-bottom-nav');
    expect(css).toContain('.landscape-compact-modal');
    expect(css).toContain('.pb-safe-bottom');
    expect(css).toContain('env(safe-area-inset-bottom');

    // No transition: all on .btn-sky-primary or .btn-sky-secondary
    const primaryMatch = css.match(/\.btn-sky-primary\s*\{[^}]*\}/);
    const secondaryMatch = css.match(/\.btn-sky-secondary\s*\{[^}]*\}/);
    expect(primaryMatch).not.toBeNull();
    expect(secondaryMatch).not.toBeNull();
    expect(primaryMatch![0]).not.toMatch(/transition\s*:\s*all/i);
    expect(secondaryMatch![0]).not.toMatch(/transition\s*:\s*all/i);

    // App shell carries responsive classes
    render(<App />);
    const root = screen.getByTestId('mei-schedule-app');
    expect(root.className).toContain('min-h-dvh-screen');
    const memberBtn = screen.getByTestId('header-member-portal-btn');
    expect(memberBtn.querySelector('.truncate')).not.toBeNull();
  });

  it('contains ZERO Unicode Emoji across src/, public/, supabase/, index.html, and AGENTS.md', () => {
    const allowedExts = new Set([
      '.ts',
      '.tsx',
      '.js',
      '.mjs',
      '.css',
      '.html',
      '.svg',
      '.sql',
      '.json',
      '.webmanifest',
      '.txt',
      '.md'
    ]);

    const targets = [
      ...walkFiles(path.join(ROOT_DIR, 'src'), allowedExts),
      ...walkFiles(path.join(ROOT_DIR, 'public'), allowedExts),
      ...walkFiles(path.join(ROOT_DIR, 'supabase'), allowedExts),
      path.join(ROOT_DIR, 'index.html'),
      path.join(ROOT_DIR, 'AGENTS.md')
    ];

    expect(targets.length).toBeGreaterThan(10);

    for (const filePath of targets) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      // Strip the EMOJI_REGEX literal definition itself if present in regex test or sanitizer
      const match = content.match(EMOJI_REGEX);
      expect(
        match,
        `Found forbidden Unicode Emoji (${match?.[0]}) in ${path.relative(ROOT_DIR, filePath)}`
      ).toBeNull();
    }
  });

  it('renders unified LucideIcon (strokeWidth=1.75) and 7-tier Candidate F BrandMark + clean public SVG assets', () => {
    const { container: iconContainer, rerender } = render(<LucideIcon name="WandSparkles" />);
    const svgIcon = iconContainer.querySelector('svg');
    expect(svgIcon).not.toBeNull();
    expect(svgIcon?.getAttribute('data-lucide-name')).toBe('wand-sparkles');
    // At default size=20 with absoluteStrokeWidth=true, Lucide computes (1.75 * 24) / 20 = 2.1
    expect(svgIcon?.getAttribute('stroke-width')).toBe('2.1');

    rerender(<LucideIcon name="WandSparkles" size={24} />);
    expect(iconContainer.querySelector('svg')?.getAttribute('stroke-width')).toBe('1.75');

    rerender(<LucideIcon name="" />);
    expect(iconContainer.querySelector('svg')?.getAttribute('data-lucide-name')).toBe('cloud');

    const expectedSizes: Record<(typeof LOGO_SIZES)[number], { widthClass: string; iconPx: string }> = {
      '2xs': { widthClass: 'w-5', iconPx: '11' },
      xs: { widthClass: 'w-6', iconPx: '13' },
      sm: { widthClass: 'w-9', iconPx: '18' },
      md: { widthClass: 'w-[44px]', iconPx: '22' },
      lg: { widthClass: 'w-[56px]', iconPx: '28' },
      xl: { widthClass: 'w-20', iconPx: '46' },
      '2xl': { widthClass: 'w-28', iconPx: '58' }
    };

    for (const sz of LOGO_SIZES) {
      const { container, unmount } = render(<StudioLogo size={sz} />);
      const wrapper = container.querySelector('[data-testid="studio-brand-logo"]');
      expect(wrapper?.getAttribute('data-logo-size')).toBe(sz);

      const badge = wrapper?.querySelector('.squircle-icon-badge');
      expect(badge?.className).toContain(expectedSizes[sz].widthClass);

      const logoSvg = wrapper?.querySelector('svg');
      expect(logoSvg?.getAttribute('width')).toBe(expectedSizes[sz].iconPx);
      expect(logoSvg?.getAttribute('height')).toBe(expectedSizes[sz].iconPx);
      expect(logoSvg?.getAttribute('stroke-width')).toBe('1.75');
      expect(logoSvg?.getAttribute('viewBox')).toBe('0 0 24 24');

      const paths = Array.from(logoSvg?.querySelectorAll('path') || []).map((p) =>
        p.getAttribute('d')
      );
      expect(paths).toContain(CANDIDATE_F_CLOUD_PATH);
      expect(paths).toContain(CANDIDATE_F_INFINITY_PATH);
      expect(wrapper?.querySelector('.studio-logo-sparkle')).toBeNull();
      expect(paths.join(' ')).not.toContain('m12 3-1.912');
      unmount();
    }

    // Invalid size gracefully falls back to md
    const { container: fallbackContainer } = render(<BrandMark size="unknown-size" />);
    expect(
      fallbackContainer.querySelector('[data-testid="studio-brand-logo"]')?.getAttribute('data-logo-size')
    ).toBe('md');

    // Dedicated MeiSchedule Product Logo (Time Blocks) 7-tier verification
    for (const sz of LOGO_SIZES) {
      const { container, unmount } = render(<MeiScheduleLogo size={sz} />);
      const wrapper = container.querySelector('[data-testid="meischedule-brand-logo"]');
      expect(wrapper?.getAttribute('data-logo-size')).toBe(sz);
      expect(wrapper?.getAttribute('data-logo-design')).toBe('time-blocks');

      const badge = wrapper?.querySelector('.squircle-icon-badge');
      expect(badge?.className).toContain(expectedSizes[sz].widthClass);

      const logoSvg = wrapper?.querySelector('svg');
      expect(logoSvg?.getAttribute('width')).toBe(expectedSizes[sz].iconPx);
      expect(logoSvg?.getAttribute('height')).toBe(expectedSizes[sz].iconPx);
      expect(logoSvg?.getAttribute('stroke-width')).toBe('1.75');
      expect(logoSvg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(logoSvg?.querySelectorAll('rect')).toHaveLength(3);
      expect(logoSvg?.querySelector('path')?.getAttribute('d')).toBe(MEI_SCHEDULE_LOGO_PINS_PATH);
      unmount();
    }

    // Public MeiSchedule product SVG assets (Time Blocks geometry, stroke-width=1.75, zero emoji)
    for (const relPath of ['public/favicon.svg', 'public/pwa-maskable.svg']) {
      const text = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
      expect(text).toContain('stroke-width="1.75"');
      expect(text).toContain(MEI_SCHEDULE_LOGO_PINS_PATH);
      expect(text).toContain('width="7.6" height="2.7" rx="1.35"');
      expect(EMOJI_REGEX.test(text)).toBe(false);
    }

    // Parent Studio return dock preserves Studio geometric integrity & zero emoji
    const dockSvgText = fs.readFileSync(path.join(ROOT_DIR, 'public/sdk/mei-dock.js'), 'utf8');
    expect(dockSvgText).toContain('stroke-width="1.75"');
    expect(dockSvgText).toContain('M17.5 19H9');
    expect(dockSvgText).toContain('M12 14.5c');
    expect(dockSvgText).not.toContain('m12 3-1.912');
    expect(EMOJI_REGEX.test(dockSvgText)).toBe(false);
  });

  it('v1.3.0 regressions: mobile sidebar default closed, mei-dock layer/collapse, dual-speed 450ms/680ms cross-dissolve, Hybrid Mode 2 preloader & v1.3.0 badge', async () => {
    const origWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });

    try {
      const { unmount } = render(<App />);
      // Mobile (<1024px) must NOT show full-screen blocking sidebar overlay on initial load
      expect(screen.queryByTestId('mobile-sidebar-overlay')).toBeNull();

      // Appearance settings modal exposes v1.5.1 release badge, Studio Dock visibility control & Auto-Wrap Titles switch
      expect(document.documentElement.getAttribute('data-title-wrap')).toBe('wrap');
      fireEvent.click(screen.getByTestId('open-appearance-modal-btn'));
      expect(await screen.findByTestId('app-version-badge')).toHaveTextContent('v1.5.1');
      expect(screen.getByTestId('dock-visibility-control')).toBeInTheDocument();
      const autoWrapSwitch = screen.getByTestId('toggle-auto-wrap-titles');
      expect(autoWrapSwitch).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(autoWrapSwitch);
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-title-wrap')).toBe('nowrap');
      });
      fireEvent.click(autoWrapSwitch);
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-title-wrap')).toBe('wrap');
      });
      fireEvent.keyDown(window, { key: 'Escape' });

      // Theme swap triggers 450ms theme-transitioning + theme crossfade veil
      const currentTheme = document.documentElement.getAttribute('data-design-theme');
      const nextTheme = currentTheme === 'warm-journal' ? 'minimal-linear' : 'warm-journal';
      fireEvent.click(screen.getByTestId(`theme-switch-${nextTheme}`));
      await waitFor(() => {
        expect(document.documentElement.classList.contains('theme-transitioning')).toBe(true);
        expect(screen.getByTestId('theme-crossfade-veil')).toHaveAttribute('data-transition-kind', 'theme');
      });

      // Dark/Light swap triggers slower 680ms color-mode-transitioning + color-mode crossfade veil
      fireEvent.click(screen.getByTestId('color-mode-toggle-btn'));
      await waitFor(() => {
        expect(document.documentElement.classList.contains('color-mode-transitioning')).toBe(true);
        expect(screen.getByTestId('theme-crossfade-veil')).toHaveAttribute('data-transition-kind', 'color-mode');
      });
      // Reset color mode cleanly
      fireEvent.click(screen.getByTestId('color-mode-toggle-btn'));
      unmount();

      // Verify CSS defines 450ms theme transition, slower 680ms color-mode transition, and GPU containment
      const css = fs.readFileSync(path.join(ROOT_DIR, 'src/styles/index.css'), 'utf8');
      expect(css).toContain('html.theme-transitioning');
      expect(css).toContain('transition-duration: 450ms !important;');
      expect(css).toContain('html.color-mode-transitioning');
      expect(css).toContain('transition-duration: 680ms !important;');
      expect(css).toContain('contain: layout style;');
      expect(COLOR_MODE_TRANSITION_MS).toBeGreaterThan(THEME_TRANSITION_MS);

      // Verify Hybrid Mode 2 Preloader: first visit shows brand splash, marks sessionStorage, then unmounts cleanly
      __resetPreloadEngineForTests();
      const firstVisit = render(<AppPreloaderOverlay hydrated={true} forceActiveInTest={true} />);
      expect(screen.getByTestId('app-preloader-overlay')).toBeInTheDocument();
      await waitFor(
        () => {
          expect(window.sessionStorage.getItem(PRELOAD_SESSION_KEY)).toBe('1');
          expect(screen.queryByTestId('app-preloader-overlay')).toBeNull();
        },
        { timeout: 2500 }
      );
      firstVisit.unmount();

      // Same-tab reload / revisit: 0ms instant (no full-screen overlay), silent warm-up indicator instead
      const revisit = render(<AppPreloaderOverlay hydrated={true} forceActiveInTest={true} />);
      expect(screen.queryByTestId('app-preloader-overlay')).toBeNull();
      expect(await screen.findByTestId('silent-preload-indicator')).toBeInTheDocument();
      revisit.unmount();

      // Verify mei-dock.js auto-collapses on mobile, stays below z-50 modals (z-index: 35), adapts to dark mode,
      // and supports dual-mode hiding (edge peek handle + complete hide) synced with AppearanceSettingsModal
      const dockCode = fs.readFileSync(path.join(ROOT_DIR, 'public/sdk/mei-dock.js'), 'utf8');
      expect(dockCode).toContain('z-index: 35;');
      expect(dockCode).toContain('html.dark .mei-dock-capsule');
      expect(dockCode).toContain('mei-dock-edge-tab');

      window.localStorage.removeItem('mei_studio_dock_visibility_v1');
      window.location.hash = '';
      delete window.__MEI_STUDIO_DOCK_MOUNTED__;
      delete window.MeiStudioDock;
      document.getElementById('mei-studio-dock-root')?.remove();
      document.getElementById('mei-dock-edge-tab')?.remove();
      new Function(dockCode)();
      const getDockApi = () => (window as Window).MeiStudioDock;
      const dockEl = document.getElementById('mei-studio-dock-root');
      const edgeTab = document.getElementById('mei-dock-edge-tab');
      expect(dockEl).not.toBeNull();
      expect(edgeTab).not.toBeNull();
      expect(dockEl?.classList.contains('mei-dock-collapsed')).toBe(true);
      expect(getDockApi()?.getMode()).toBe('visible');

      // 1-click Hide button tucks dock into edge peek tab
      const hideBtn = dockEl?.querySelector('#mei-dock-hide-btn') as HTMLButtonElement;
      expect(hideBtn).not.toBeNull();
      fireEvent.click(hideBtn);
      expect(dockEl?.classList.contains('mei-dock-edge-hidden')).toBe(true);
      expect(edgeTab?.classList.contains('mei-dock-edge-tab-visible')).toBe(true);
      expect(window.localStorage.getItem('mei_studio_dock_visibility_v1')).toBe('edge-hidden');

      // Clicking edge peek tab smoothly restores capsule
      fireEvent.click(edgeTab!);
      expect(dockEl?.classList.contains('mei-dock-edge-hidden')).toBe(false);
      expect(edgeTab?.classList.contains('mei-dock-edge-tab-visible')).toBe(false);
      expect(getDockApi()?.getMode()).toBe('visible');

      // AppearanceSettingsModal completely hides and restores dock via window.MeiStudioDock
      const modalRun = render(<App />);
      fireEvent.click(screen.getByTestId('open-appearance-modal-btn'));
      fireEvent.click(await screen.findByTestId('dock-mode-completely-hidden'));
      expect(dockEl?.classList.contains('mei-dock-completely-hidden')).toBe(true);
      expect(edgeTab?.classList.contains('mei-dock-edge-tab-visible')).toBe(false);
      expect(window.localStorage.getItem('mei_studio_dock_visibility_v1')).toBe('completely-hidden');

      fireEvent.click(screen.getByTestId('dock-mode-visible'));
      expect(dockEl?.classList.contains('mei-dock-completely-hidden')).toBe(false);
      expect(getDockApi()?.getMode()).toBe('visible');
      modalRun.unmount();

      dockEl?.remove();
      edgeTab?.remove();
      window.localStorage.removeItem('mei_studio_dock_visibility_v1');
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        value: origWidth,
        configurable: true,
        writable: true
      });
    }
  });
});
