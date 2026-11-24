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
  StudioLogo
} from '../components/BrandMark';
import StudioToast from '../components/StudioToast';
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

    // Public SVG & mei-dock.js brand geometry verification
    for (const relPath of ['public/favicon.svg', 'public/pwa-maskable.svg', 'public/sdk/mei-dock.js']) {
      const text = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
      expect(text).toContain('stroke-width="1.75"');
      expect(text).toContain('M17.5 19H9');
      expect(text).toContain('M12 14.5c');
      expect(text).not.toContain('m12 3-1.912');
      expect(EMOJI_REGEX.test(text)).toBe(false);
    }
  });
});
