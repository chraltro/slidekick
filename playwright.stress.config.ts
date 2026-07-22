import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Local config for the stress harness: reuse the already-running dev server and,
// if the pinned Playwright version's default browser revision isn't installed,
// fall back to any Chromium build present in this environment. Set PW_CHROME to
// override the executable path explicitly.
function findChrome(): string | undefined {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const dir of fs.readdirSync(base)) {
      if (!/^chromium-/.test(dir)) continue;
      const p = `${base}/${dir}/chrome-linux/chrome`;
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* fall through to Playwright default */
  }
  return undefined;
}

const executablePath = findChrome();

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 60 * 1000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    viewport: { width: 1440, height: 900 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
