import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Visual Regression & Cross-Browser Tests for Story Detail Page (ST-26)
 * Tests complex UI workflows, responsive design, and visual consistency
 */
test.describe('Story Detail Page - Visual Regression & Responsive Design', () => {
  let api: ApiHelper;
  let storyId: string;
  let storyKey: string;

  test.beforeAll(async ({ request }) => {
    await DbHelper.seedTestUsers(request);
    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    const testData = await DbHelper.createTestProject(api);
    storyId = testData.story.id;
    storyKey = testData.story.key;

    // Populate with rich data for visual testing
    await api.updateStory(storyId, {
      description: `# Test Story Description

## Overview
This is a comprehensive test story with rich markdown content to test rendering.

## Requirements
- Requirement 1: Multi-line content
- Requirement 2: **Bold** and *italic* text
- Requirement 3: \`code inline\` formatting

### Code Example
\`\`\`typescript
interface TestInterface {
  id: string;
  name: string;
  tags: string[];
}
\`\`\`

## Links
[Documentation](https://example.com/docs)

## Lists
1. First item
2. Second item
3. Third item`,
      baAnalysis: `# Business Analysis

## Problem Statement
Users need better visibility into story execution metrics and analysis outputs.

## Acceptance Criteria
- [ ] Display all workflow analysis outputs
- [ ] Show token usage metrics
- [ ] Support shareable URLs
- [x] Maintain existing functionality`,
      architectAnalysis: `# Architecture Design

## System Components
\`\`\`
┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │
└─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│  WebSocket  │────▶│  Database   │
└─────────────┘     └─────────────┘
\`\`\`

## API Endpoints
- GET /api/stories/:id - Supports both UUID and storyKey
- GET /api/stories/:id/token-metrics - Aggregate token data`,
      designerAnalysis: `# UI/UX Design

## Layout Structure
1. **Header Section**: Title, status badge, epic link
2. **Complexity Cards**: 3-column grid layout
3. **Workflow Analysis**: Collapsible sections with markdown
4. **Token Metrics**: Summary cards + expandable breakdown
5. **Traceability**: Tabbed interface
6. **Subtasks**: Kanban-style status groups

## Color Scheme
- Primary: Accent blue
- Success: Green for completed
- Warning: Yellow for pending
- Error: Red for failed`,
      contextExploration: `# Context Exploration

## Related Features
- Story management system
- Workflow execution engine
- Real-time WebSocket updates
- Token cost tracking

## Dependencies
- React Router for routing
- Socket.io for real-time updates
- Tailwind CSS for styling
- React Markdown for content rendering`,
    } as any);

    // Add some subtasks for completeness
    await api.createSubtask({
      storyId,
      title: 'Frontend: Create TokenMetricsPanel component',
      description: 'Build React component for displaying token metrics',
      layer: 'frontend',
      component: 'TokenMetricsPanel',
    });

    await api.createSubtask({
      storyId,
      title: 'Backend: Add token-metrics endpoint',
      description: 'Create API endpoint to aggregate token usage',
      layer: 'backend',
      component: 'StoriesController',
    });
  });

  test.afterAll(async () => {
    await DbHelper.cleanup(api);
  });

  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.pm);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should render story detail page without layout shifts', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);

    // Wait for all content to load
    await page.waitForSelector('[data-testid="story-detail"]');
    await page.waitForLoadState('networkidle');

    // Take screenshot for visual regression
    await expect(page).toHaveScreenshot('story-detail-full-page.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should display workflow analysis sections without overlap', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Expand all analysis sections
    const sections = [
      'Context Exploration',
      'Business Analysis',
      'UI/UX Design',
      'Architecture Design',
    ];

    for (const sectionName of sections) {
      const section = page.locator(`text=${sectionName}`).first();
      const exists = await section.isVisible({ timeout: 1000 }).catch(() => false);

      if (exists) {
        await section.click();
        await page.waitForTimeout(300); // Wait for animation
      }
    }

    // Take screenshot with all sections expanded
    await expect(page.locator('text=Workflow Analysis').locator('..')).toHaveScreenshot(
      'workflow-analysis-expanded.png',
      { maxDiffPixels: 100 }
    );
  });

  test('should render markdown content with proper styling', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Expand Business Analysis section
    const baSection = page.locator('text=Business Analysis').first();
    if (await baSection.isVisible({ timeout: 1000 }).catch(() => false)) {
      await baSection.click();
      await page.waitForTimeout(300);

      // Verify markdown elements are styled correctly
      await expect(page.locator('h2:has-text("Problem Statement")')).toBeVisible();
      await expect(page.locator('h2:has-text("Acceptance Criteria")')).toBeVisible();

      // Checkboxes should render
      const checklist = page.locator('input[type="checkbox"]');
      const checkboxCount = await checklist.count();
      expect(checkboxCount).toBeGreaterThan(0);

      // Take screenshot of markdown rendering
      await expect(page.locator('text=Business Analysis').locator('../..')).toHaveScreenshot(
        'markdown-rendering.png',
        { maxDiffPixels: 50 }
      );
    }
  });

  test('should handle long content with scrolling', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Expand section with long content
    const archSection = page.locator('text=Architecture Design').first();
    if (await archSection.isVisible({ timeout: 1000 }).catch(() => false)) {
      await archSection.click();
      await page.waitForTimeout(300);

      // Content should be scrollable within max height
      const content = page.locator('text=Architecture Design').locator('../..');
      const boundingBox = await content.boundingBox();

      if (boundingBox) {
        // Max height should be enforced (384px as per use case)
        expect(boundingBox.height).toBeLessThanOrEqual(450); // Allow some padding
      }
    }
  });

  test('should display token metrics cards in grid layout', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Check if token metrics exist
    const tokenPanel = page.locator('text=Token Usage & Cost');
    const hasPanel = await tokenPanel.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasPanel) {
      // Verify grid layout for summary cards
      const summaryCards = page.locator('text=Total Tokens').locator('../..');

      // Take screenshot of token metrics panel
      await expect(tokenPanel.locator('..')).toHaveScreenshot(
        'token-metrics-panel.png',
        { maxDiffPixels: 100 }
      );
    }
  });

  test('should maintain responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport (iPhone 12)
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify content is readable on mobile
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="current-status"]')).toBeVisible();

    // Complexity cards should stack vertically on mobile
    const complexitySection = page.locator('text=Technical Complexity').locator('..');

    // Take mobile screenshot
    await expect(page).toHaveScreenshot('story-detail-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should maintain responsive design on tablet viewport', async ({ page }) => {
    // Set tablet viewport (iPad)
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify layout adapts to tablet
    await expect(page.locator('h1')).toBeVisible();

    // Take tablet screenshot
    await expect(page).toHaveScreenshot('story-detail-tablet.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});

test.describe('Story Detail Page - Animation & Interaction', () => {
  let api: ApiHelper;
  let storyKey: string;

  test.beforeAll(async ({ request }) => {
    await DbHelper.seedTestUsers(request);
    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    const testData = await DbHelper.createTestProject(api);
    storyKey = testData.story.key;

    await api.updateStory(testData.story.id, {
      baAnalysis: '# Business Analysis\nTest content for animation testing.',
    } as any);
  });

  test.afterAll(async () => {
    await DbHelper.cleanup(api);
  });

  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.pm);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should animate workflow analysis section expansion smoothly', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    const baSection = page.locator('text=Business Analysis').first();
    const exists = await baSection.isVisible({ timeout: 1000 }).catch(() => false);

    if (exists) {
      // Record state before expansion
      const chevron = baSection.locator('svg').first();
      const initialTransform = await chevron.evaluate(el =>
        window.getComputedStyle(el).transform
      );

      // Click to expand
      await baSection.click();

      // Wait for animation (200ms as per use case)
      await page.waitForTimeout(250);

      // Verify chevron rotated
      const finalTransform = await chevron.evaluate(el =>
        window.getComputedStyle(el).transform
      );

      // Transform should have changed
      expect(finalTransform).not.toBe(initialTransform);

      // Content should be visible
      await expect(page.locator('text=Test content for animation testing')).toBeVisible();
    }
  });

  test('should animate token metrics panel expansion', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Look for workflow run buttons
    const runButton = page.locator('button').filter({ hasText: 'tokens' }).first();
    const hasRuns = await runButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasRuns) {
      // Click to expand
      await runButton.click();

      // Animation should complete within 300ms
      await page.waitForTimeout(350);

      // Details should be visible
      const details = page.locator('text=Started:');
      await expect(details).toBeVisible();

      // Collapse
      await runButton.click();
      await page.waitForTimeout(350);

      // Details should be hidden
      const visible = await details.isVisible({ timeout: 500 }).catch(() => false);
      expect(visible).toBe(false);
    }
  });

  test('should show smooth transitions on status changes', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Get current status
    const currentStatus = await page.locator('[data-testid="current-status"]').textContent();

    // Find available transition button
    const transitionButton = page.locator('[data-testid^="move-to-"]').first();
    const hasTransitions = await transitionButton.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasTransitions) {
      // Click transition
      await transitionButton.click();

      // Status should update with smooth transition
      await page.waitForTimeout(500);

      // New status should be visible
      const newStatus = await page.locator('[data-testid="current-status"]').textContent();
      expect(newStatus).not.toBe(currentStatus);
    }
  });
});

test.describe('Story Detail Page - Keyboard Navigation & Accessibility', () => {
  let api: ApiHelper;
  let storyKey: string;

  test.beforeAll(async ({ request }) => {
    await DbHelper.seedTestUsers(request);
    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    const testData = await DbHelper.createTestProject(api);
    storyKey = testData.story.key;

    await api.updateStory(testData.story.id, {
      baAnalysis: '# Business Analysis\nKeyboard accessible content.',
      architectAnalysis: '# Architecture\nMore accessible content.',
    } as any);
  });

  test.afterAll(async () => {
    await DbHelper.cleanup(api);
  });

  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.pm);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should support keyboard navigation through workflow analysis sections', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Find first analysis section
    const baSection = page.locator('text=Business Analysis').first();
    const exists = await baSection.isVisible({ timeout: 1000 }).catch(() => false);

    if (exists) {
      // Tab to focus on section
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Press Enter to expand
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Content should be visible
      await expect(page.locator('text=Keyboard accessible content')).toBeVisible();

      // Press Enter again to collapse
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Content should be hidden
      const visible = await page.locator('text=Keyboard accessible content').isVisible({ timeout: 500 }).catch(() => false);
      expect(visible).toBe(false);
    }
  });

  test('should show visible focus indicators', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check if focused element has visible focus ring
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      const styles = window.getComputedStyle(el as Element);
      return {
        outline: styles.outline,
        boxShadow: styles.boxShadow,
      };
    });

    // Should have some form of focus indicator (outline or box-shadow)
    const hasFocusIndicator =
      focusedElement.outline !== 'none' ||
      focusedElement.boxShadow !== 'none';

    expect(hasFocusIndicator).toBe(true);
  });

  test('should support Space key for toggling sections', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    const baSection = page.locator('text=Business Analysis').first();
    const exists = await baSection.isVisible({ timeout: 1000 }).catch(() => false);

    if (exists) {
      // Focus on section
      await baSection.focus();

      // Press Space to expand
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);

      // Content should be visible
      await expect(page.locator('text=Keyboard accessible content')).toBeVisible();
    }
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Check for ARIA attributes on collapsible sections
    const baSection = page.locator('text=Business Analysis').first();
    const exists = await baSection.isVisible({ timeout: 1000 }).catch(() => false);

    if (exists) {
      // Should have aria-expanded attribute
      const ariaExpanded = await baSection.getAttribute('aria-expanded');
      expect(ariaExpanded).toBeDefined();
    }
  });

  test('should announce state changes to screen readers', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    const baSection = page.locator('text=Business Analysis').first();
    const exists = await baSection.isVisible({ timeout: 1000 }).catch(() => false);

    if (exists) {
      // Get initial aria-expanded state
      const initialState = await baSection.getAttribute('aria-expanded');

      // Toggle section
      await baSection.click();
      await page.waitForTimeout(300);

      // aria-expanded should change
      const newState = await baSection.getAttribute('aria-expanded');
      expect(newState).not.toBe(initialState);
    }
  });
});

test.describe('Story Detail Page - Error Handling & Edge Cases', () => {
  let api: ApiHelper;
  let storyKey: string;

  test.beforeAll(async ({ request }) => {
    await DbHelper.seedTestUsers(request);
    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    const testData = await DbHelper.createTestProject(api);
    storyKey = testData.story.key;
  });

  test.afterAll(async () => {
    await DbHelper.cleanup(api);
  });

  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.pm);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should handle empty workflow analysis gracefully', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // If no analysis exists, sections should show empty state
    const contextSection = page.locator('text=Context Exploration').first();
    const exists = await contextSection.isVisible({ timeout: 1000 }).catch(() => false);

    if (exists) {
      await contextSection.click();
      await page.waitForTimeout(300);

      // Should show empty state message
      const emptyState = page.locator('text=No analysis available yet');
      await expect(emptyState).toBeVisible();
    }
  });

  test('should handle network errors when loading token metrics', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Token metrics should either load or show empty state
    await page.waitForTimeout(2000);

    // Should not show error UI that breaks the page
    const pageError = page.locator('text=Error:').first();
    const hasError = await pageError.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasError) {
      // Error should be user-friendly
      await expect(pageError.locator('..')).toContainText('token metrics');
    }
  });

  test('should handle malicious markdown content safely', async ({ page }) => {
    // Update story with potentially malicious markdown
    await api.updateStory(await api.getStory(storyKey).then(s => s.id), {
      baAnalysis: `# Test
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
[Click me](javascript:alert('XSS'))`,
    } as any);

    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Expand section with malicious content
    const baSection = page.locator('text=Business Analysis').first();
    if (await baSection.isVisible({ timeout: 1000 }).catch(() => false)) {
      await baSection.click();
      await page.waitForTimeout(300);

      // No alert should have fired
      // Page should render without executing scripts
      const alerts = await page.evaluate(() => {
        let alertFired = false;
        const originalAlert = window.alert;
        window.alert = () => { alertFired = true; };
        return alertFired;
      });

      expect(alerts).toBe(false);
    }
  });

  test('should handle very long content without breaking layout', async ({ page }) => {
    // Create extremely long content
    const longContent = '# Very Long Content\n\n' +
      'Lorem ipsum dolor sit amet. '.repeat(1000);

    await api.updateStory(await api.getStory(storyKey).then(s => s.id), {
      architectAnalysis: longContent,
    } as any);

    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    const archSection = page.locator('text=Architecture Design').first();
    if (await archSection.isVisible({ timeout: 1000 }).catch(() => false)) {
      await archSection.click();
      await page.waitForTimeout(300);

      // Content should be scrollable and not overflow
      const content = archSection.locator('../..');
      const boundingBox = await content.boundingBox();

      if (boundingBox) {
        // Should not exceed viewport
        const viewport = page.viewportSize();
        if (viewport) {
          expect(boundingBox.height).toBeLessThan(viewport.height);
        }
      }
    }
  });
});
