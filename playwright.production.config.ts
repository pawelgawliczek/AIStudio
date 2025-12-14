import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration - PRODUCTION
 *
 * Tests against the production environment:
 * - https://vibestudio.example.com
 *
 * Use for:
 * - Critical functionality verification
 * - Transcript streaming E2E tests
 * - Real workflow validation
 *
 * Run with: npx playwright test --config playwright.production.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  // Only run specific production tests
  testMatch: [
    '**/15-transcript-streaming-e2e.spec.ts',
    '**/17-earlier-agent-tracking-st216.spec.ts',
    '**/live-streaming.e2e.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for production tests - we want to know if it fails
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report-production' }],
    ['list'],
  ],
  use: {
    baseURL: 'https://vibestudio.example.com',
    trace: 'on', // Always capture traces for production debugging
    screenshot: 'on', // Always capture screenshots
    video: 'on', // Always capture video for production tests
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer needed - we test against production directly
});
