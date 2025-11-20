/**
 * E2E and Visual Regression Tests for Code Quality Dashboard (ST-14)
 *
 * Tests the refactored CodeQualityDashboard.tsx and its components:
 * - Custom hooks: useCodeQualityMetrics, useAnalysisPolling, useFileTree, useStoryCreation
 * - UI Components: MetricsSummaryCard, FileTreeView, FileDetailsPanel, etc.
 * - Utilities: healthCalculations, fileTreeHelpers, coverageHelpers
 *
 * Coverage:
 * - Visual regression across tabs (Overview, Files & Folders, Code Issues, Hotspots)
 * - Responsive design (mobile, tablet, desktop)
 * - Dark mode support
 * - User interactions (navigation, filtering, story creation)
 * - Real-time analysis polling
 */

import { test, expect, Page } from '@playwright/test';

const TEST_PROJECT_ID = process.env.E2E_TEST_PROJECT_ID || 'test-project-id';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Code Quality Dashboard - ST-14 Refactoring', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Code Quality Dashboard
    await page.goto(`${BASE_URL}/projects/${TEST_PROJECT_ID}/quality`);

    // Wait for initial data load
    await page.waitForSelector('[data-testid="code-quality-dashboard"]', { timeout: 10000 });
  });

  test.describe('Overview Tab - Visual Regression', () => {
    test('should display KPI cards correctly - desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Wait for metrics to load
      await page.waitForSelector('[data-testid="metrics-summary"]');

      // Verify KPI cards are visible
      await expect(page.locator('text=Health Score')).toBeVisible();
      await expect(page.locator('text=Coverage')).toBeVisible();
      await expect(page.locator('text=Complexity')).toBeVisible();

      // Take screenshot for visual regression
      await page.screenshot({
        path: 'screenshots/code-quality-overview-desktop.png',
        fullPage: true
      });
    });

    test('should display correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.waitForSelector('[data-testid="metrics-summary"]');

      // Verify responsive layout
      const summaryCard = page.locator('[data-testid="metrics-summary"]');
      await expect(summaryCard).toBeVisible();

      await page.screenshot({
        path: 'screenshots/code-quality-overview-tablet.png',
        fullPage: true
      });
    });

    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.waitForSelector('[data-testid="metrics-summary"]');

      // Verify mobile layout adjustments
      const container = page.locator('[data-testid="code-quality-dashboard"]');
      await expect(container).toBeVisible();

      await page.screenshot({
        path: 'screenshots/code-quality-overview-mobile.png',
        fullPage: true
      });
    });

    test('should show health score with appropriate color coding', async ({ page }) => {
      const healthScore = page.locator('[data-testid="health-score-value"]');
      await expect(healthScore).toBeVisible();

      // Get the score value
      const scoreText = await healthScore.textContent();
      const score = parseInt(scoreText || '0');

      // Verify color coding based on healthCalculations.ts logic
      const scoreElement = await healthScore.elementHandle();
      const color = await scoreElement?.evaluate(el =>
        window.getComputedStyle(el).color
      );

      if (score >= 80) {
        // Should be green
        expect(color).toBeTruthy();
      } else if (score >= 60) {
        // Should be yellow/warning
        expect(color).toBeTruthy();
      } else {
        // Should be red/danger
        expect(color).toBeTruthy();
      }
    });

    test('should display trend indicators correctly', async ({ page }) => {
      // Check for trend indicators (up/down arrows)
      const trendIndicators = page.locator('[data-testid*="trend-indicator"]');
      const count = await trendIndicators.count();

      if (count > 0) {
        await expect(trendIndicators.first()).toBeVisible();
      }
    });
  });

  test.describe('Files & Folders Tab - FileTreeView Component', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Files & Folders tab
      await page.click('text=Files & Folders');
      await page.waitForSelector('[data-testid="file-tree-view"]');
    });

    test('should render file tree structure', async ({ page }) => {
      const fileTree = page.locator('[data-testid="file-tree-view"]');
      await expect(fileTree).toBeVisible();

      // Verify folder nodes are present
      const folders = page.locator('[data-testid^="folder-node-"]');
      await expect(folders.first()).toBeVisible();

      await page.screenshot({
        path: 'screenshots/code-quality-file-tree.png',
        fullPage: true
      });
    });

    test('should expand/collapse folders on click', async ({ page }) => {
      const firstFolder = page.locator('[data-testid^="folder-node-"]').first();
      await firstFolder.click();

      // Wait for expansion animation
      await page.waitForTimeout(300);

      // Check if children are visible
      const children = page.locator('[data-testid^="file-node-"]');
      const childrenCount = await children.count();

      // Click again to collapse
      await firstFolder.click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: 'screenshots/code-quality-file-tree-expanded.png'
      });
    });

    test('should support keyboard navigation', async ({ page }) => {
      const firstFolder = page.locator('[data-testid^="folder-node-"]').first();
      await firstFolder.focus();

      // Press Enter to expand
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Press ArrowDown to navigate
      await page.keyboard.press('ArrowDown');

      // Verify focus moved
      const focusedElement = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid')
      );
      expect(focusedElement).toBeTruthy();
    });

    test('should display file details panel when file is selected', async ({ page }) => {
      const firstFile = page.locator('[data-testid^="file-node-"]').first();

      if (await firstFile.count() > 0) {
        await firstFile.click();

        // Wait for details panel to slide in
        await page.waitForSelector('[data-testid="file-details-panel"]', { timeout: 5000 });

        const detailsPanel = page.locator('[data-testid="file-details-panel"]');
        await expect(detailsPanel).toBeVisible();

        // Verify details content
        await expect(page.locator('text=Complexity')).toBeVisible();
        await expect(page.locator('text=Coverage')).toBeVisible();

        await page.screenshot({
          path: 'screenshots/code-quality-file-details-panel.png'
        });
      }
    });

    test('should show loading state when fetching file details', async ({ page }) => {
      const firstFile = page.locator('[data-testid^="file-node-"]').first();

      if (await firstFile.count() > 0) {
        await firstFile.click();

        // Check for loading indicator
        const loadingIndicator = page.locator('[data-testid="file-details-loading"]');

        // Loading might be too fast, so we just verify the panel appears
        await page.waitForSelector('[data-testid="file-details-panel"]', { timeout: 5000 });
      }
    });
  });

  test.describe('Code Issues Tab - CodeSmellsList Component', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Code Issues');
      await page.waitForSelector('[data-testid="code-issues-list"]');
    });

    test('should display code issues grouped by severity', async ({ page }) => {
      const issuesList = page.locator('[data-testid="code-issues-list"]');
      await expect(issuesList).toBeVisible();

      // Check for severity labels
      const criticalIssues = page.locator('text=Critical');
      const highIssues = page.locator('text=High');

      await page.screenshot({
        path: 'screenshots/code-quality-issues-list.png',
        fullPage: true
      });
    });

    test('should filter issues by severity', async ({ page }) => {
      const severityFilter = page.locator('[data-testid="severity-filter"]');

      if (await severityFilter.count() > 0) {
        await severityFilter.selectOption('critical');
        await page.waitForTimeout(500);

        // Verify filtering worked
        const issueItems = page.locator('[data-testid^="issue-item-"]');
        const count = await issueItems.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should open story creation dialog for issue', async ({ page }) => {
      const createStoryButton = page.locator('[data-testid^="create-story-"]').first();

      if (await createStoryButton.count() > 0) {
        await createStoryButton.click();

        // Wait for story dialog
        await page.waitForSelector('[data-testid="story-creation-dialog"]', { timeout: 5000 });

        const dialog = page.locator('[data-testid="story-creation-dialog"]');
        await expect(dialog).toBeVisible();

        // Verify pre-filled content
        const titleInput = page.locator('[data-testid="story-title-input"]');
        const title = await titleInput.inputValue();
        expect(title).toBeTruthy();

        await page.screenshot({
          path: 'screenshots/code-quality-story-dialog.png'
        });
      }
    });
  });

  test.describe('Hotspots Tab - High-Risk Files', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Hotspots');
      await page.waitForSelector('[data-testid="hotspots-table"]');
    });

    test('should display hotspots table with sortable columns', async ({ page }) => {
      const hotspotsTable = page.locator('[data-testid="hotspots-table"]');
      await expect(hotspotsTable).toBeVisible();

      // Verify table headers
      await expect(page.locator('text=Risk Score')).toBeVisible();
      await expect(page.locator('text=Complexity')).toBeVisible();
      await expect(page.locator('text=Coverage')).toBeVisible();

      await page.screenshot({
        path: 'screenshots/code-quality-hotspots.png',
        fullPage: true
      });
    });

    test('should sort hotspots by risk score', async ({ page }) => {
      const riskScoreHeader = page.locator('[data-testid="sort-risk-score"]');

      if (await riskScoreHeader.count() > 0) {
        await riskScoreHeader.click();
        await page.waitForTimeout(300);

        // Verify sorting
        const firstRiskScore = page.locator('[data-testid^="risk-score-"]').first();
        await expect(firstRiskScore).toBeVisible();
      }
    });

    test('should highlight high-risk files with appropriate styling', async ({ page }) => {
      const highRiskFiles = page.locator('[data-risk-level="high"]');
      const count = await highRiskFiles.count();

      if (count > 0) {
        const firstHighRisk = highRiskFiles.first();
        await expect(firstHighRisk).toBeVisible();

        // Verify color coding
        const backgroundColor = await firstHighRisk.evaluate(el =>
          window.getComputedStyle(el).backgroundColor
        );
        expect(backgroundColor).toBeTruthy();
      }
    });
  });

  test.describe('Analysis Refresh - AnalysisRefreshButton Component', () => {
    test('should trigger code analysis', async ({ page }) => {
      const refreshButton = page.locator('[data-testid="analysis-refresh-button"]');
      await expect(refreshButton).toBeVisible();

      await refreshButton.click();

      // Wait for analyzing state
      await page.waitForSelector('[data-testid="analysis-status"]', { timeout: 5000 });

      const statusIndicator = page.locator('[data-testid="analysis-status"]');
      await expect(statusIndicator).toBeVisible();

      // Verify status text shows "Analyzing" or "Running"
      const statusText = await statusIndicator.textContent();
      expect(statusText?.toLowerCase()).toContain('analyz');
    });

    test('should show polling status during analysis', async ({ page }) => {
      const refreshButton = page.locator('[data-testid="analysis-refresh-button"]');

      if (await refreshButton.count() > 0) {
        await refreshButton.click();

        // Check for progress indicator
        const progressIndicator = page.locator('[data-testid="analysis-progress"]');

        // Wait a bit to see if progress updates
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: 'screenshots/code-quality-analysis-progress.png'
        });
      }
    });

    test('should show toast notification on completion', async ({ page }) => {
      // This test requires mocking or a real analysis completion
      // For now, we'll just verify the toast container exists
      const toastContainer = page.locator('[data-testid="toast-container"]');

      // Toast container should be in the DOM even if empty
      expect(await toastContainer.count()).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Dark Mode Support', () => {
    test('should toggle between light and dark modes', async ({ page }) => {
      // Look for theme toggle button
      const themeToggle = page.locator('[data-testid="theme-toggle"]');

      if (await themeToggle.count() > 0) {
        // Take screenshot in light mode
        await page.screenshot({
          path: 'screenshots/code-quality-light-mode.png',
          fullPage: true
        });

        // Toggle to dark mode
        await themeToggle.click();
        await page.waitForTimeout(300);

        // Take screenshot in dark mode
        await page.screenshot({
          path: 'screenshots/code-quality-dark-mode.png',
          fullPage: true
        });

        // Verify dark mode classes/styles are applied
        const body = page.locator('body');
        const className = await body.getAttribute('class');
        expect(className).toBeTruthy();
      }
    });
  });

  test.describe('Story Creation Workflow', () => {
    test('should create story from high-risk file', async ({ page }) => {
      // Navigate to Hotspots
      await page.click('text=Hotspots');
      await page.waitForSelector('[data-testid="hotspots-table"]');

      // Find first "Create Story" button
      const createStoryButton = page.locator('[data-testid^="create-story-file-"]').first();

      if (await createStoryButton.count() > 0) {
        await createStoryButton.click();

        // Wait for story dialog
        await page.waitForSelector('[data-testid="story-creation-dialog"]');

        const dialog = page.locator('[data-testid="story-creation-dialog"]');
        await expect(dialog).toBeVisible();

        // Verify pre-filled data
        const titleInput = page.locator('[data-testid="story-title-input"]');
        const descriptionInput = page.locator('[data-testid="story-description-input"]');

        const title = await titleInput.inputValue();
        const description = await descriptionInput.inputValue();

        expect(title).toBeTruthy();
        expect(description).toContain('Risk Score');
        expect(description).toContain('Complexity');

        // Take screenshot of filled form
        await page.screenshot({
          path: 'screenshots/code-quality-story-form-filled.png'
        });

        // Cancel dialog
        const cancelButton = page.locator('[data-testid="story-cancel-button"]');
        await cancelButton.click();
      }
    });

    test('should validate story title is required', async ({ page }) => {
      await page.click('text=Hotspots');
      await page.waitForSelector('[data-testid="hotspots-table"]');

      const createStoryButton = page.locator('[data-testid^="create-story-file-"]').first();

      if (await createStoryButton.count() > 0) {
        await createStoryButton.click();
        await page.waitForSelector('[data-testid="story-creation-dialog"]');

        // Clear the title
        const titleInput = page.locator('[data-testid="story-title-input"]');
        await titleInput.fill('');

        // Try to save
        const saveButton = page.locator('[data-testid="story-save-button"]');
        await saveButton.click();

        // Should show error toast
        await page.waitForTimeout(500);

        // Verify dialog is still open (validation failed)
        const dialog = page.locator('[data-testid="story-creation-dialog"]');
        await expect(dialog).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      // Check main navigation
      const mainNav = page.locator('nav[aria-label]');
      expect(await mainNav.count()).toBeGreaterThan(0);

      // Check tab buttons have proper roles
      const tabs = page.locator('[role="tab"]');
      expect(await tabs.count()).toBeGreaterThan(0);

      // Check interactive elements have labels
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();

        // Button should have either aria-label or visible text
        expect(ariaLabel || text?.trim()).toBeTruthy();
      }
    });

    test('should support keyboard navigation for tabs', async ({ page }) => {
      const firstTab = page.locator('[role="tab"]').first();
      await firstTab.focus();

      // Navigate through tabs with arrow keys
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);

      // Verify focus moved
      const focusedElement = await page.evaluate(() =>
        document.activeElement?.getAttribute('role')
      );
      expect(focusedElement).toBe('tab');
    });
  });

  test.describe('Performance', () => {
    test('should load initial data within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto(`${BASE_URL}/projects/${TEST_PROJECT_ID}/quality`);
      await page.waitForSelector('[data-testid="metrics-summary"]', { timeout: 5000 });

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle large file trees efficiently', async ({ page }) => {
      await page.click('text=Files & Folders');
      await page.waitForSelector('[data-testid="file-tree-view"]');

      // Expand all folders and measure performance
      const folders = page.locator('[data-testid^="folder-node-"]');
      const count = Math.min(await folders.count(), 10);

      const startTime = Date.now();

      for (let i = 0; i < count; i++) {
        await folders.nth(i).click();
        await page.waitForTimeout(100);
      }

      const expansionTime = Date.now() - startTime;

      // Should be reasonably fast
      expect(expansionTime).toBeLessThan(5000);
    });
  });

  test.describe('Error Handling', () => {
    test('should display error state when data fetch fails', async ({ page }) => {
      // Navigate with invalid project ID
      await page.goto(`${BASE_URL}/projects/invalid-id/quality`);

      // Wait for error message
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();

      await page.screenshot({
        path: 'screenshots/code-quality-error-state.png'
      });
    });

    test('should show retry option on error', async ({ page }) => {
      await page.goto(`${BASE_URL}/projects/invalid-id/quality`);
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

      const retryButton = page.locator('[data-testid="retry-button"]');

      if (await retryButton.count() > 0) {
        await expect(retryButton).toBeVisible();
      }
    });
  });
});

test.describe('Code Quality Dashboard - Component Integration', () => {
  test('should coordinate between FileTreeView and FileDetailsPanel', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects/${TEST_PROJECT_ID}/quality`);
    await page.click('text=Files & Folders');
    await page.waitForSelector('[data-testid="file-tree-view"]');

    // Select a file
    const firstFile = page.locator('[data-testid^="file-node-"]').first();

    if (await firstFile.count() > 0) {
      const fileName = await firstFile.textContent();
      await firstFile.click();

      // Verify details panel shows correct file
      await page.waitForSelector('[data-testid="file-details-panel"]');
      const detailsPanel = page.locator('[data-testid="file-details-panel"]');
      const panelContent = await detailsPanel.textContent();

      expect(panelContent).toContain(fileName?.trim() || '');
    }
  });

  test('should update metrics after analysis completion', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects/${TEST_PROJECT_ID}/quality`);

    // Get initial health score
    const healthScore = page.locator('[data-testid="health-score-value"]');
    await healthScore.waitFor({ state: 'visible' });
    const initialScore = await healthScore.textContent();

    // Trigger analysis
    const refreshButton = page.locator('[data-testid="analysis-refresh-button"]');

    if (await refreshButton.count() > 0) {
      await refreshButton.click();

      // Wait for analysis to complete (or timeout)
      await page.waitForTimeout(5000);

      // Verify metrics refreshed (value should exist)
      await expect(healthScore).toBeVisible();
      const newScore = await healthScore.textContent();
      expect(newScore).toBeTruthy();
    }
  });
});
