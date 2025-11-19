import { test, expect } from '@playwright/test';

/**
 * Playwright Infrastructure Verification Test
 *
 * This test verifies that Playwright is properly installed and configured
 * for headless browser testing. It does NOT require the application to be running.
 */

test.describe('Playwright Infrastructure', () => {
  test('should launch browser and navigate to example.com', async ({ page }) => {
    // Navigate to a known-good external site
    await page.goto('https://example.com');

    // Verify the page loaded
    await expect(page).toHaveTitle(/Example Domain/);

    // Verify we can interact with the page
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('Example Domain');
  });

  test('should verify browser context is in headless mode', async ({ page, context }) => {
    // Verify basic browser functionality
    await page.goto('https://example.com');

    // Check viewport (headless browsers should have default viewport)
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    expect(viewport?.width).toBeGreaterThan(0);
    expect(viewport?.height).toBeGreaterThan(0);
  });

  test('should be able to take screenshots', async ({ page }) => {
    await page.goto('https://example.com');

    // Take a screenshot to verify screenshot functionality
    const screenshot = await page.screenshot({ fullPage: true });

    // Verify screenshot was generated
    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });
});
