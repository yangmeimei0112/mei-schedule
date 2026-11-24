import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.ELECTRON_BUILD === '1' ? './' : '/',
  plugins: [react()],
  server: {
    port: 5174,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false
  }
});
