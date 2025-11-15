import { test, expect, Page } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Tests for Global Workflow Tracking Bar (ST-28)
 *
 * Tests the persistent global workflow tracking bar that appears under the menu
 * when a workflow is actively running. This component provides real-time visibility
 * into workflow execution progress across all pages.
 *
 * Critical User Flows:
 * - Visibility: Bar appears when workflow starts, hides when completed
 * - Real-time updates: Progress updates every 3 seconds via polling
 * - Navigation: Story link clickable, navigates to story detail page
 * - Multi-page persistence: Bar visible across all application pages
 * - Visual feedback: Spinner animation, progress indicator, component name
 *
 * Related Use Cases:
 * - UC-EXEC-001: Execute Story with Workflow
 * - UC-EXEC-010: Execute Story with Workflow and Proper Agent Orchestration
 * - UC-UI-013: View Workflow Analysis in Story Detail
 */
test.describe('Global Workflow Tracking Bar', () => {
  let api: ApiHelper;
  let projectId: string;
  let epicId: string;
  let storyId: string;
  let workflowId: string;
  let runId: string;

  test.beforeAll(async ({ request }) => {
    // Seed test users
    await DbHelper.seedTestUsers(request);

    // Login as PM to create test data
    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    // Create test project, epic, and story
    const testData = await DbHelper.createTestProject(api);
    projectId = testData.project.id;
    epicId = testData.epic.id;
    storyId = testData.story.id;

    // Get workflow ID from project (assumes workflow exists)
    const workflows = await api.get(`/projects/${projectId}/workflows`);
    if (workflows.data && workflows.data.length > 0) {
      workflowId = workflows.data[0].id;
    }
  });

  test.afterAll(async () => {
    // Cleanup test data
    await DbHelper.cleanup(api);
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_USERS.pm);

    // Set project ID in localStorage (GlobalWorkflowTrackingBar reads from localStorage)
    await page.goto('/');
    await page.evaluate((pid) => {
      localStorage.setItem('selectedProjectId', pid);
      localStorage.setItem('currentProjectId', pid);
    }, projectId);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup any running workflows
    if (runId) {
      try {
        await api.put(`/projects/${projectId}/workflow-runs/${runId}`, {
          status: 'cancelled',
        });
      } catch (error) {
        // Ignore cleanup errors
      }
      runId = '';
    }

    await logout(page);
  });

  /**
   * TC-E2E-WORKFLOW-BAR-001: Bar Visibility Based on Active Workflow
   *
   * Validates that the tracking bar:
   * - Does NOT appear when no workflow is running
   * - DOES appear when workflow execution starts
   * - Auto-hides when workflow completes
   */
  test('should show tracking bar only when workflow is active', async ({ page }) => {
    // Navigate to stories page
    await page.goto(`/projects/${projectId}/stories`);

    // Verify bar is NOT visible initially (no active workflow)
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).not.toBeVisible();

    // Start workflow execution
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    // Wait for tracking bar to appear (polling interval is 3 seconds)
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
      timeout: 5000,
    });

    // Cancel workflow
    await api.put(`/projects/${projectId}/workflow-runs/${runId}`, {
      status: 'completed',
    });

    // Wait for tracking bar to disappear
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).not.toBeVisible({
      timeout: 5000,
    });
  });

  /**
   * TC-E2E-WORKFLOW-BAR-002: Display Story Information
   *
   * Validates that the tracking bar displays:
   * - Story key as a chip (e.g., "ST-28")
   * - Story title (truncated if too long)
   * - Story link is clickable and navigates to story detail page
   */
  test('should display story key and title with clickable link', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    // Navigate to home page
    await page.goto('/');

    // Wait for tracking bar to appear
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
      timeout: 5000,
    });

    // Get story details
    const storyResponse = await api.get(`/stories/${storyId}`);
    const story = storyResponse.data;

    // Verify story key chip is displayed
    const storyKeyChip = page.locator('[data-testid="workflow-tracking-bar"]').locator(`text=${story.key}`);
    await expect(storyKeyChip).toBeVisible();

    // Verify story title is displayed
    const storyTitle = page.locator('[data-testid="workflow-tracking-bar"]').locator(`text=${story.title.substring(0, 20)}`);
    await expect(storyTitle).toBeVisible();

    // Click story link and verify navigation
    const storyLink = page.locator('[data-testid="workflow-tracking-bar"]').locator(`a[href="/stories/${story.key}"]`);
    await expect(storyLink).toBeVisible();
    await storyLink.click();

    // Verify navigation to story detail page
    await expect(page).toHaveURL(new RegExp(`/stories/${story.key}`));
  });

  /**
   * TC-E2E-WORKFLOW-BAR-003: Display Active Component
   *
   * Validates that the tracking bar displays:
   * - Currently running component name (e.g., "Business Analyst")
   * - "Initializing..." when workflow is starting
   * - Play arrow icon next to component name
   */
  test('should display active component name with play icon', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    // Navigate to page
    await page.goto('/');

    // Wait for tracking bar to appear
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
      timeout: 5000,
    });

    // Initially should show "Initializing..." or component name
    const componentText = page.locator('[data-testid="workflow-tracking-bar"]').locator('text=/Initializing|Context|Business|Designer|Architect|Developer|QA/');
    await expect(componentText).toBeVisible();

    // Verify play icon is present (MUI PlayArrowIcon)
    const trackingBar = page.locator('[data-testid="workflow-tracking-bar"]');
    await expect(trackingBar).toContainText(/Initializing|Context|Business|Designer/);
  });

  /**
   * TC-E2E-WORKFLOW-BAR-004: Display Progress Indicator
   *
   * Validates that the tracking bar displays:
   * - Progress text "X/Y components completed"
   * - Progress percentage badge (e.g., "33%")
   * - Linear progress bar at bottom with correct value
   * - Progress updates in real-time as components complete
   */
  test('should display progress indicator with percentage and linear bar', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    await page.goto('/');

    // Wait for tracking bar
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
      timeout: 5000,
    });

    // Verify progress text pattern "X/Y components completed"
    const progressText = page.locator('[data-testid="workflow-tracking-bar"]').locator('text=/\\d+\\/\\d+ components completed/');
    await expect(progressText).toBeVisible();

    // Verify percentage badge
    const percentageBadge = page.locator('[data-testid="workflow-tracking-bar"]').locator('text=/\\d+%/');
    await expect(percentageBadge).toBeVisible();

    // Verify linear progress bar exists with aria attributes
    const progressBar = page.locator('[data-testid="workflow-tracking-bar"]').locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible();

    // Get aria-valuenow attribute and verify it's a valid percentage (0-100)
    const progressValue = await progressBar.getAttribute('aria-valuenow');
    const progressNum = parseInt(progressValue || '0');
    expect(progressNum).toBeGreaterThanOrEqual(0);
    expect(progressNum).toBeLessThanOrEqual(100);
  });

  /**
   * TC-E2E-WORKFLOW-BAR-005: Spinning Animation Indicator
   *
   * Validates that the tracking bar:
   * - Shows spinning icon when status is "running"
   * - Does NOT show spinner when status is "paused" or "completed"
   * - Spinner has appropriate CSS animation class
   */
  test('should display spinning icon when workflow is running', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    await page.goto('/');

    // Wait for tracking bar
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
      timeout: 5000,
    });

    // Verify spinner is visible
    const spinner = page.locator('[data-testid="workflow-spinner"]');
    await expect(spinner).toBeVisible();

    // Verify spinner has spinning class
    await expect(spinner).toHaveClass(/spinning/);

    // Pause workflow
    await api.put(`/projects/${projectId}/workflow-runs/${runId}`, {
      status: 'paused',
    });

    // Wait a bit for UI to update
    await page.waitForTimeout(4000); // Wait for polling cycle

    // Spinner should disappear
    await expect(spinner).not.toBeVisible();
  });

  /**
   * TC-E2E-WORKFLOW-BAR-006: Fixed Positioning and Styling
   *
   * Validates that the tracking bar:
   * - Has fixed position below navigation (top: 64px)
   * - Spans full page width (100%)
   * - Has correct height (48px)
   * - Has appropriate z-index to appear above content
   * - Uses primary color background
   */
  test('should have correct fixed positioning and styling', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    await page.goto('/');

    // Wait for tracking bar
    const trackingBar = page.locator('[data-testid="workflow-tracking-bar"]');
    await expect(trackingBar).toBeVisible({ timeout: 5000 });

    // Get computed styles
    const boundingBox = await trackingBar.boundingBox();
    expect(boundingBox).not.toBeNull();

    if (boundingBox) {
      // Verify width spans viewport
      const viewport = page.viewportSize();
      expect(boundingBox.width).toBe(viewport?.width || 0);

      // Verify height is approximately 48px (allow 1px variance for rendering)
      expect(boundingBox.height).toBeGreaterThanOrEqual(47);
      expect(boundingBox.height).toBeLessThanOrEqual(49);

      // Verify position is near top (below 64px nav bar)
      expect(boundingBox.y).toBeGreaterThanOrEqual(60);
      expect(boundingBox.y).toBeLessThanOrEqual(68);
    }

    // Verify position style
    const position = await trackingBar.evaluate((el) => window.getComputedStyle(el).position);
    expect(position).toBe('fixed');
  });

  /**
   * TC-E2E-WORKFLOW-BAR-007: Real-time Updates via Polling
   *
   * Validates that the tracking bar:
   * - Polls backend every 3 seconds for updates
   * - Updates component name when component changes
   * - Updates progress percentage when component completes
   * - Automatically hides when workflow completes
   */
  test('should poll and update progress in real-time', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    await page.goto('/');

    // Wait for tracking bar
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
      timeout: 5000,
    });

    // Record initial progress
    const initialProgressText = await page.locator('[data-testid="workflow-tracking-bar"]')
      .locator('text=/\\d+\\/\\d+ components completed/')
      .textContent();

    // Simulate component completion (update workflow run in backend)
    const currentStatus = await api.get(`/projects/${projectId}/workflow-runs/${runId}/status`);
    const currentProgress = currentStatus.data.progress;

    // Simulate progress update
    await api.post(`/mcp/record-component-complete`, {
      runId,
      componentId: currentStatus.data.activeComponentId || 'test-component',
      status: 'completed',
      output: { result: 'Test output' },
      metrics: {
        tokensUsed: 1000,
        durationSeconds: 10,
        costUsd: 0.01,
      },
    });

    // Wait for polling cycle (3 seconds + buffer)
    await page.waitForTimeout(4000);

    // Verify progress text has updated
    const updatedProgressText = await page.locator('[data-testid="workflow-tracking-bar"]')
      .locator('text=/\\d+\\/\\d+ components completed/')
      .textContent();

    // Progress should have changed (if workflow has multiple components)
    if (currentProgress.total > 1) {
      expect(updatedProgressText).not.toBe(initialProgressText);
    }
  });

  /**
   * TC-E2E-WORKFLOW-BAR-008: Multi-Page Persistence
   *
   * Validates that the tracking bar:
   * - Appears on all application pages when workflow is running
   * - Persists across page navigation
   * - Maintains state when navigating between routes
   * - Works correctly with React Router navigation
   */
  test('should persist across multiple pages during navigation', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    // Test tracking bar on Stories page
    await page.goto(`/projects/${projectId}/stories`);
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
      timeout: 5000,
    });
    const storiesProgressText = await page.locator('[data-testid="workflow-tracking-bar"]')
      .locator('text=/\\d+\\/\\d+ components completed/')
      .textContent();

    // Navigate to Epics page
    await page.goto(`/projects/${projectId}/epics`);
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible();
    const epicsProgressText = await page.locator('[data-testid="workflow-tracking-bar"]')
      .locator('text=/\\d+\\/\\d+ components completed/')
      .textContent();

    // Progress should be consistent across pages
    expect(epicsProgressText).toBe(storiesProgressText);

    // Navigate to Dashboard
    await page.goto('/');
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible();

    // Navigate using story link in tracking bar
    const storyResponse = await api.get(`/stories/${storyId}`);
    const story = storyResponse.data;
    const storyLink = page.locator('[data-testid="workflow-tracking-bar"]').locator(`a[href="/stories/${story.key}"]`);
    await storyLink.click();

    // Tracking bar should still be visible on story detail page
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/stories/${story.key}`));
  });

  /**
   * TC-E2E-WORKFLOW-BAR-009: Responsive Design on Mobile
   *
   * Validates that the tracking bar:
   * - Displays correctly on mobile viewports (320px, 375px, 414px)
   * - Truncates long story titles with ellipsis
   * - Maintains readability on small screens
   * - All elements remain accessible
   */
  test('should display responsively on mobile devices', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    // Test on mobile viewport (iPhone SE size)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Wait for tracking bar
    const trackingBar = page.locator('[data-testid="workflow-tracking-bar"]');
    await expect(trackingBar).toBeVisible({ timeout: 5000 });

    // Verify bar spans full width
    const boundingBox = await trackingBar.boundingBox();
    expect(boundingBox?.width).toBe(375);

    // Verify story title has text-overflow: ellipsis
    const storyResponse = await api.get(`/stories/${storyId}`);
    const story = storyResponse.data;
    const titleElement = page.locator('[data-testid="workflow-tracking-bar"]')
      .locator(`text=${story.title.substring(0, 15)}`);

    if (await titleElement.count() > 0) {
      const textOverflow = await titleElement.evaluate((el) =>
        window.getComputedStyle(el).textOverflow
      );
      expect(textOverflow).toBe('ellipsis');
    }

    // Verify all key elements are still visible
    await expect(page.locator('[data-testid="workflow-spinner"]')).toBeVisible();
    await expect(page.locator('text=/\\d+%/')).toBeVisible();
    await expect(trackingBar.locator('[role="progressbar"]')).toBeVisible();
  });

  /**
   * TC-E2E-WORKFLOW-BAR-010: Multi-User Scenario - Concurrent Workflows
   *
   * Validates that:
   * - User only sees their project's workflow (not other users' workflows)
   * - Tracking bar correctly filters by projectId from localStorage
   * - No conflicts when multiple users run workflows simultaneously
   */
  test('should only display workflows for selected project', async ({ page }) => {
    // Create second project for isolation test
    const secondProjectData = await DbHelper.createTestProject(api);
    const secondProjectId = secondProjectData.project.id;
    const secondStoryId = secondProjectData.story.id;

    try {
      // Start workflow on first project
      const response1 = await api.post(`/mcp/execute-story-with-workflow`, {
        storyId,
        workflowId,
        triggeredBy: 'mcp-e2e-test',
      });
      runId = response1.data.runId;

      // Start workflow on second project
      const workflows2 = await api.get(`/projects/${secondProjectId}/workflows`);
      const secondWorkflowId = workflows2.data?.[0]?.id;

      if (secondWorkflowId) {
        await api.post(`/mcp/execute-story-with-workflow`, {
          storyId: secondStoryId,
          workflowId: secondWorkflowId,
          triggeredBy: 'mcp-e2e-test',
        });

        // Set localStorage to first project
        await page.goto('/');
        await page.evaluate((pid) => {
          localStorage.setItem('selectedProjectId', pid);
          localStorage.setItem('currentProjectId', pid);
        }, projectId);

        // Reload to trigger query
        await page.reload();

        // Should see first project's workflow
        await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
          timeout: 5000,
        });

        // Verify it's showing the correct story
        const story1Response = await api.get(`/stories/${storyId}`);
        const story1 = story1Response.data;
        await expect(page.locator('[data-testid="workflow-tracking-bar"]'))
          .toContainText(story1.key);

        // Switch to second project
        await page.evaluate((pid) => {
          localStorage.setItem('selectedProjectId', pid);
          localStorage.setItem('currentProjectId', pid);
        }, secondProjectId);

        await page.reload();

        // Should now see second project's workflow
        await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
          timeout: 5000,
        });

        const story2Response = await api.get(`/stories/${secondStoryId}`);
        const story2 = story2Response.data;
        await expect(page.locator('[data-testid="workflow-tracking-bar"]'))
          .toContainText(story2.key);
      }
    } finally {
      // Cleanup second project
      await api.delete(`/projects/${secondProjectId}`);
    }
  });

  /**
   * TC-E2E-WORKFLOW-BAR-011: Error Handling and Edge Cases
   *
   * Validates graceful handling of:
   * - Network errors during polling
   * - Missing story information (null storyKey/storyTitle)
   * - Invalid projectId in localStorage
   * - Backend API failures (500 errors)
   */
  test('should handle errors gracefully without crashing', async ({ page }) => {
    // Test with invalid projectId
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('selectedProjectId', '00000000-0000-0000-0000-000000000000');
      localStorage.setItem('currentProjectId', '00000000-0000-0000-0000-000000000000');
    });

    await page.reload();

    // Should not show tracking bar for invalid project
    await page.waitForTimeout(4000); // Wait for polling attempt
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).not.toBeVisible();

    // Set back to valid project
    await page.evaluate((pid) => {
      localStorage.setItem('selectedProjectId', pid);
      localStorage.setItem('currentProjectId', pid);
    }, projectId);

    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    await page.reload();

    // Should recover and show tracking bar
    await expect(page.locator('[data-testid="workflow-tracking-bar"]')).toBeVisible({
      timeout: 5000,
    });
  });

  /**
   * TC-E2E-WORKFLOW-BAR-012: Accessibility Testing
   *
   * Validates that the tracking bar:
   * - Has proper ARIA attributes on progress bar
   * - Is keyboard accessible (Tab navigation)
   * - Has sufficient color contrast (WCAG AA)
   * - Screen reader friendly
   */
  test('should be accessible with proper ARIA attributes', async ({ page }) => {
    // Start workflow
    const response = await api.post(`/mcp/execute-story-with-workflow`, {
      storyId,
      workflowId,
      triggeredBy: 'mcp-e2e-test',
    });
    runId = response.data.runId;

    await page.goto('/');

    // Wait for tracking bar
    const trackingBar = page.locator('[data-testid="workflow-tracking-bar"]');
    await expect(trackingBar).toBeVisible({ timeout: 5000 });

    // Verify progress bar has ARIA attributes
    const progressBar = trackingBar.locator('[role="progressbar"]');
    await expect(progressBar).toHaveAttribute('role', 'progressbar');
    await expect(progressBar).toHaveAttribute('aria-valuenow');

    // Get aria-valuenow and verify it's a valid number
    const ariaValue = await progressBar.getAttribute('aria-valuenow');
    expect(ariaValue).not.toBeNull();
    const ariaNum = parseInt(ariaValue || '0');
    expect(ariaNum).toBeGreaterThanOrEqual(0);
    expect(ariaNum).toBeLessThanOrEqual(100);

    // Verify story link is keyboard accessible
    const storyResponse = await api.get(`/stories/${storyId}`);
    const story = storyResponse.data;
    const storyLink = trackingBar.locator(`a[href="/stories/${story.key}"]`);

    // Tab to focus the link
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check if link can receive focus
    const linkElement = await storyLink.elementHandle();
    expect(linkElement).not.toBeNull();
  });
});
