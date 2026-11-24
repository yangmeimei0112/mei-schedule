import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetLocalStoreCacheForTests } from '../services/localStore';

function evaluateMediaQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  const width = typeof window !== 'undefined' ? window.innerWidth || 1024 : 1024;
  const height = typeof window !== 'undefined' ? window.innerHeight || 768 : 768;

  if (q.includes('prefers-color-scheme: dark')) {
    return Boolean(typeof window !== 'undefined' && window.__TEST_PREFERS_DARK__);
  }
  if (q.includes('prefers-color-scheme: light')) {
    return !(typeof window !== 'undefined' && window.__TEST_PREFERS_DARK__);
  }

  let matched = true;

  const minWidthMatch = q.match(/min-width:\s*(\d+(?:\.\d+)?)px/);
  if (minWidthMatch) matched = matched && width >= parseFloat(minWidthMatch[1]);

  const maxWidthMatch = q.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
  if (maxWidthMatch) matched = matched && width <= parseFloat(maxWidthMatch[1]);

  const minHeightMatch = q.match(/min-height:\s*(\d+(?:\.\d+)?)px/);
  if (minHeightMatch) matched = matched && height >= parseFloat(minHeightMatch[1]);

  const maxHeightMatch = q.match(/max-height:\s*(\d+(?:\.\d+)?)px/);
  if (maxHeightMatch) matched = matched && height <= parseFloat(maxHeightMatch[1]);

  if (q.includes('orientation: landscape')) {
    matched = matched && width > height;
  }
  if (q.includes('orientation: portrait')) {
    matched = matched && height >= width;
  }

  const minAspectMatch = q.match(/min-aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
  if (minAspectMatch) {
    matched = matched && width / height >= parseFloat(minAspectMatch[1]) / parseFloat(minAspectMatch[2]);
  }
  const maxAspectMatch = q.match(/max-aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
  if (maxAspectMatch) {
    matched = matched && width / height <= parseFloat(maxAspectMatch[1]) / parseFloat(maxAspectMatch[2]);
  }

  return matched;
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: evaluateMediaQuery(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false)
    }))
  });

  window.scrollTo = vi.fn();
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver
  });
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds: number[] = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver
  });
}

if (typeof Element !== 'undefined') {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}

beforeEach(() => {
  const freshIdb = new IDBFactory();
  Object.defineProperty(globalThis, 'indexedDB', {
    value: freshIdb,
    writable: true,
    configurable: true
  });
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    value: IDBKeyRange,
    writable: true,
    configurable: true
  });
  resetLocalStoreCacheForTests();

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'indexedDB', {
      value: freshIdb,
      writable: true,
      configurable: true
    });
    Object.defineProperty(window, 'IDBKeyRange', {
      value: IDBKeyRange,
      writable: true,
      configurable: true
    });
    window.__TEST_PREFERS_DARK__ = false;
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // Ignore if test intentionally mocked storage to throw SecurityError
    }
    document.documentElement.className = '';
    document.documentElement.setAttribute('data-design-theme', 'sky-glass');
  }
});

afterEach(() => {
  cleanup();
});
