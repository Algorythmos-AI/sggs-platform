import { defineConfig } from '@playwright/test';

// The visual baseline (e2e-visual/). Screenshots are only comparable when the fonts are, so this
// suite is made and compared in one place: the pinned Playwright container, in CI
// (.github/workflows/deploy-docs.yml). Never commit a baseline made on a Mac.
// How to refresh one: docs/process/runbooks/docs-site.md, "Visual baselines".
export default defineConfig({
  testDir: './e2e-visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  use: { baseURL: 'http://127.0.0.1:4324' },
  webServer: { command: 'node scripts/serve-dist.mjs 4324', url: 'http://127.0.0.1:4324/', reuseExistingServer: false, timeout: 60_000 },
});
