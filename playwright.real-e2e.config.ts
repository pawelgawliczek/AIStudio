import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration - REAL MCP E2E
 *
 * Tests against production with REAL MCP command execution:
 * - Creates real test data (project, story, workflow run)
 * - Executes real workflow via MCP commands
 * - Verifies transcript registration and UI display
 * - Cleans up all test data after completion
 *
 * Run with: npx playwright test --config playwright.real-e2e.config.ts
 *
 * WARNING: This test creates/modifies data on PRODUCTION database!
 * Test data is prefixed with _E2E_TRANSCRIPT_ for identification.
 */
export default defineConfig({
  testDir: './e2e',
  // Only run the real MCP E2E test
  testMatch: '**/16-real-transcript-e2e.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries - we want to know if it fails
  workers: 1,
  // Longer timeout for real workflow execution
  timeout: 180000, // 3 minutes per test
  reporter: [
    ['html', { outputFolder: 'playwright-report-real-e2e' }],
    ['list'],
  ],
  use: {
    baseURL: 'https://vibestudio.example.com',
    trace: 'on', // Always capture traces
    screenshot: 'on', // Always capture screenshots
    video: 'on', // Always capture video
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
