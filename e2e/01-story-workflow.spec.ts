import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Tests for Story Workflow State Machine
 * Tests all 8 story states and valid transitions
 */
test.describe('Story Workflow', () => {
  let api: ApiHelper;
  let projectId: string;
  let epicId: string;
  let storyId: string;

  test.beforeAll(async ({ request }) => {
    // Seed test users
    await DbHelper.seedTestUsers(request);

    // Login as PM to create test data
    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    // Create test project and epic
    const testData = await DbHelper.createTestProject(api);
    projectId = testData.project.id;
    epicId = testData.epic.id;
    storyId = testData.story.id;
  });

  test.afterAll(async () => {
    // Cleanup test data
    await DbHelper.cleanup(api);
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_USERS.pm);
  });

  test.afterEach(async ({ page }) => {
    // Logout after each test
    await logout(page);
  });

  test('should display story in planning state by default', async ({ page }) => {
    // Navigate to stories page
    await page.goto(`/projects/${projectId}/stories`);

    // Wait for story list to load
    await page.waitForSelector('[data-testid="story-list"]');

    // Check story exists and is in planning state
    const storyCard = page.locator(`[data-testid="story-${storyId}"]`);
    await expect(storyCard).toBeVisible();
    await expect(storyCard.locator('[data-testid="story-status"]')).toHaveText('planning');
  });

  test('should transition story from planning to analysis', async ({ page }) => {
    // Navigate to story detail
    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Check current status
    await expect(page.locator('[data-testid="current-status"]')).toHaveText('planning');

    // Click "Move to Analysis" button
    await page.click('[data-testid="move-to-analysis"]');

    // Wait for status update
    await page.waitForSelector('[data-testid="current-status"]:has-text("analysis")');

    // Verify status changed
    await expect(page.locator('[data-testid="current-status"]')).toHaveText('analysis');

    // Verify via API
    const story = await api.getStory(storyId);
    expect(story.status).toBe('analysis');
  });

  test('should transition through all workflow states', async ({ page }) => {
    const states = [
      'planning',
      'analysis',
      'architecture',
      'design',
      'implementation',
      'review',
      'qa',
      'done',
    ];

    // Start from planning
    await api.updateStoryStatus(storyId, 'planning');

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Transition through each state
    for (let i = 0; i < states.length - 1; i++) {
      const currentState = states[i];
      const nextState = states[i + 1];

      // Verify current state
      await expect(page.locator('[data-testid="current-status"]')).toHaveText(currentState);

      // Click next state button
      await page.click(`[data-testid="move-to-${nextState}"]`);

      // Wait for status update
      await page.waitForSelector(`[data-testid="current-status"]:has-text("${nextState}")`);

      // Verify state changed
      await expect(page.locator('[data-testid="current-status"]')).toHaveText(nextState);
    }

    // Verify final state via API
    const story = await api.getStory(storyId);
    expect(story.status).toBe('done');
  });

  test('should prevent invalid state transitions', async ({ page }) => {
    // Reset story to planning
    await api.updateStoryStatus(storyId, 'planning');

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Verify only valid next states are available
    await expect(page.locator('[data-testid="move-to-analysis"]')).toBeVisible();
    await expect(page.locator('[data-testid="move-to-implementation"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="move-to-done"]')).not.toBeVisible();

    // Move to analysis
    await page.click('[data-testid="move-to-analysis"]');
    await page.waitForSelector('[data-testid="current-status"]:has-text("analysis")');

    // Verify only valid next states are available
    await expect(page.locator('[data-testid="move-to-architecture"]')).toBeVisible();
    await expect(page.locator('[data-testid="move-to-planning"]')).toBeVisible(); // Can go back
    await expect(page.locator('[data-testid="move-to-done"]')).not.toBeVisible(); // Can't skip
  });

  test('should allow admin to override workflow', async ({ page }) => {
    // Logout as PM
    await logout(page);

    // Login as admin
    await login(page, TEST_USERS.admin);

    // Reset story to planning
    await api.updateStoryStatus(storyId, 'planning');

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Admin should see "Override Status" option
    await expect(page.locator('[data-testid="override-status"]')).toBeVisible();

    // Click override
    await page.click('[data-testid="override-status"]');

    // Select 'done' directly
    await page.selectOption('[data-testid="status-select"]', 'done');
    await page.click('[data-testid="confirm-override"]');

    // Wait for status update
    await page.waitForSelector('[data-testid="current-status"]:has-text("done")');

    // Verify status changed
    const story = await api.getStory(storyId);
    expect(story.status).toBe('done');
  });

  test('should display workflow history', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Click on "History" tab
    await page.click('[data-testid="history-tab"]');

    // Wait for history to load
    await page.waitForSelector('[data-testid="workflow-history"]');

    // Verify history entries exist
    const historyItems = page.locator('[data-testid="history-item"]');
    await expect(historyItems).toHaveCount(expect.any(Number));

    // Verify history shows transitions with timestamps
    const firstItem = historyItems.first();
    await expect(firstItem.locator('[data-testid="from-status"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="to-status"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="timestamp"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="user"]')).toBeVisible();
  });

  test('should require complexity fields before moving to implementation', async ({ page }) => {
    // Create new story without complexity fields
    const newStory = await api.createStory({
      projectId,
      epicId,
      title: 'Story Without Complexity',
      description: 'Test story',
    });

    await page.goto(`/projects/${projectId}/stories/${newStory.id}`);

    // Try to move to implementation
    await api.updateStoryStatus(newStory.id, 'analysis');
    await api.updateStoryStatus(newStory.id, 'architecture');
    await api.updateStoryStatus(newStory.id, 'design');

    await page.reload();

    // Should show warning about missing complexity
    await page.click('[data-testid="move-to-implementation"]');
    await expect(page.locator('[data-testid="complexity-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="complexity-warning"]')).toContainText(
      'business complexity'
    );

    // Status should not change
    const story = await api.getStory(newStory.id);
    expect(story.status).toBe('design');

    // Cleanup
    await api.deleteStory(newStory.id);
  });
});
