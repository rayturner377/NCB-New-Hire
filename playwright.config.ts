import { defineConfig, devices } from '@playwright/test';

/**
 * `channel` picks which installed browser Playwright drives. Left unset, it
 * uses Playwright's own bundled Chromium (`npx playwright install chromium`)
 * — the normal path, and what CI should use. Set PLAYWRIGHT_BROWSER_CHANNEL
 * to 'msedge' or 'chrome' to drive an already-installed browser instead,
 * for any environment where Playwright's own browser download is blocked
 * (e.g. a network-restricted sandbox with no route to cdn.playwright.dev).
 */
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['junit', { outputFile: 'test-results/e2e-results.xml' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    // dotenv mirrors the root `dev` script: `next dev` runs with cwd=apps/web
    // and would otherwise miss the repo-root .env (DATABASE_URL, REDIS_URL,
    // BETTER_AUTH_SECRET, etc.).
    command: 'npx dotenv -- npm run dev --workspace=@ncb/web',
    // Probe the trivial health route, not `/`. Readiness must not depend on
    // Turbopack compiling the authenticated route tree, which can exceed the
    // timeout on a cold cache.
    url: 'http://localhost:3000/api/public/health',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 180000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: browserChannel }
    }
  ]
});
