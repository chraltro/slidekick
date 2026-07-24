import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests only. The Playwright end-to-end specs under tests/e2e drive a real
// browser via `npm run test:e2e`; keep them out of the (jsdom) unit runner so
// `npm test` runs the fast, pure-logic suite.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
