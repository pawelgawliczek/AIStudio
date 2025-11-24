import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Tests the full application stack (backend + frontend)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially to avoid DB conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5174', // Test environment URL
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true, // Ensure headless mode is enabled
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Use existing test servers (already running on ports 3001 and 5174)
  webServer: [
    {
      command: 'echo "Using existing backend on port 3001"',
      port: 3001,
      timeout: 120 * 1000,
      reuseExistingServer: true, // Always reuse existing server for test environment
    },
    {
      command: 'echo "Using existing frontend on port 5174"',
      port: 5174,
      timeout: 120 * 1000,
      reuseExistingServer: true, // Always reuse existing server for test environment
    },
  ],
});
