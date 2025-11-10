import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Tests for WebSocket Real-time Updates
 * Tests real-time collaboration features
 */
test.describe('WebSocket Real-time Updates', () => {
  let api: ApiHelper;
  let projectId: string;
  let storyId: string;

  test.beforeAll(async ({ request }) => {
    await DbHelper.seedTestUsers(request);

    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    const testData = await DbHelper.createTestProject(api);
    projectId = testData.project.id;
    storyId = testData.story.id;
  });

  test.afterAll(async () => {
    await DbHelper.cleanup(api);
  });

  test('should receive real-time story creation notification', async ({ page, context }) => {
    // Open first browser window (User 1)
    await login(page, TEST_USERS.pm);
    await page.goto(`/projects/${projectId}/stories`);
    await page.waitForSelector('[data-testid="story-list"]');

    const initialCount = await page.locator('[data-testid^="story-"]').count();

    // Open second browser window (User 2)
    const page2 = await context.newPage();
    await login(page2, TEST_USERS.pm);
    await page2.goto(`/projects/${projectId}/stories`);
    await page2.waitForSelector('[data-testid="story-list"]');

    // User 2 creates a new story
    await page2.click('[data-testid="create-story"]');
    await page2.fill('[data-testid="story-title"]', 'Real-time Test Story');
    await page2.fill('[data-testid="story-description"]', 'This story should appear in real-time');
    await page2.click('[data-testid="save-story"]');

    // Wait for story to be created
    await page2.waitForSelector('[data-testid^="story-"]:has-text("Real-time Test Story")');

    // User 1 should see the new story appear automatically (via WebSocket)
    await page.waitForSelector('[data-testid^="story-"]:has-text("Real-time Test Story")', {
      timeout: 5000,
    });

    const newCount = await page.locator('[data-testid^="story-"]').count();
    expect(newCount).toBe(initialCount + 1);

    // Verify story is visible in User 1's view
    await expect(page.locator('[data-testid^="story-"]:has-text("Real-time Test Story")')).toBeVisible();

    // Cleanup
    await page2.close();
    await logout(page);
  });

  test('should receive real-time story status update', async ({ page, context }) => {
    // Open first browser window (User 1) - viewing story detail
    await login(page, TEST_USERS.pm);
    await page.goto(`/projects/${projectId}/stories/${storyId}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify initial status
    await expect(page.locator('[data-testid="current-status"]')).toHaveText('planning');

    // Open second browser window (User 2)
    const page2 = await context.newPage();
    await login(page2, TEST_USERS.pm);
    await page2.goto(`/projects/${projectId}/stories/${storyId}`);
    await page2.waitForSelector('[data-testid="story-detail"]');

    // User 2 updates story status
    await page2.click('[data-testid="move-to-analysis"]');
    await page2.waitForSelector('[data-testid="current-status"]:has-text("analysis")');

    // User 1 should see the status update automatically
    await page.waitForSelector('[data-testid="current-status"]:has-text("analysis")', {
      timeout: 5000,
    });

    await expect(page.locator('[data-testid="current-status"]')).toHaveText('analysis');

    // User 1 should see a notification
    await expect(page.locator('[data-testid="notification"]')).toContainText(
      'Story status updated to analysis'
    );

    // Cleanup
    await page2.close();
    await logout(page);
  });

  test('should receive real-time subtask creation', async ({ page, context }) => {
    // Open first browser window (User 1) - viewing story detail
    await login(page, TEST_USERS.pm);
    await page.goto(`/projects/${projectId}/stories/${storyId}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    const initialSubtaskCount = await page.locator('[data-testid^="subtask-"]').count();

    // Open second browser window (User 2)
    const page2 = await context.newPage();
    await login(page2, TEST_USERS.pm);
    await page2.goto(`/projects/${projectId}/stories/${storyId}`);
    await page2.waitForSelector('[data-testid="story-detail"]');

    // User 2 creates a subtask
    await page2.click('[data-testid="add-subtask"]');
    await page2.fill('[data-testid="subtask-title"]', 'Real-time Subtask');
    await page2.click('[data-testid="save-subtask"]');
    await page2.waitForSelector('[data-testid^="subtask-"]:has-text("Real-time Subtask")');

    // User 1 should see the subtask appear automatically
    await page.waitForSelector('[data-testid^="subtask-"]:has-text("Real-time Subtask")', {
      timeout: 5000,
    });

    const newSubtaskCount = await page.locator('[data-testid^="subtask-"]').count();
    expect(newSubtaskCount).toBe(initialSubtaskCount + 1);

    // Cleanup
    await page2.close();
    await logout(page);
  });

  test('should receive real-time subtask status update', async ({ page, context }) => {
    // Create a test subtask
    const subtask = await api.createSubtask({
      storyId,
      title: 'Subtask for Status Test',
    });

    // Open first browser window (User 1)
    await login(page, TEST_USERS.pm);
    await page.goto(`/projects/${projectId}/stories/${storyId}`);
    await page.waitForSelector(`[data-testid="subtask-${subtask.id}"]`);

    // Verify initial status
    await expect(page.locator(`[data-testid="subtask-${subtask.id}"] [data-testid="subtask-status"]`)).toHaveText('todo');

    // Open second browser window (User 2)
    const page2 = await context.newPage();
    await login(page2, TEST_USERS.pm);
    await page2.goto(`/projects/${projectId}/stories/${storyId}`);
    await page2.waitForSelector(`[data-testid="subtask-${subtask.id}"]`);

    // User 2 updates subtask status
    await page2.click(`[data-testid="subtask-${subtask.id}"] [data-testid="status-dropdown"]`);
    await page2.click('[data-testid="status-in_progress"]');
    await page2.waitForSelector(`[data-testid="subtask-${subtask.id}"] [data-testid="subtask-status"]:has-text("in_progress")`);

    // User 1 should see the status update automatically
    await page.waitForSelector(`[data-testid="subtask-${subtask.id}"] [data-testid="subtask-status"]:has-text("in_progress")`, {
      timeout: 5000,
    });

    await expect(page.locator(`[data-testid="subtask-${subtask.id}"] [data-testid="subtask-status"]`)).toHaveText('in_progress');

    // Cleanup
    await api.deleteSubtask(subtask.id);
    await page2.close();
    await logout(page);
  });

  test('should show active users indicator', async ({ page, context }) => {
    // Open first browser window (User 1)
    await login(page, TEST_USERS.pm);
    await page.goto(`/projects/${projectId}/stories/${storyId}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Should show 1 active user (self)
    await expect(page.locator('[data-testid="active-users-count"]')).toHaveText('1');

    // Open second browser window (User 2)
    const page2 = await context.newPage();
    await login(page2, TEST_USERS.admin);
    await page2.goto(`/projects/${projectId}/stories/${storyId}`);
    await page2.waitForSelector('[data-testid="story-detail"]');

    // User 1 should see 2 active users
    await page.waitForSelector('[data-testid="active-users-count"]:has-text("2")', {
      timeout: 5000,
    });

    await expect(page.locator('[data-testid="active-users-count"]')).toHaveText('2');

    // Should show user avatars/names
    await expect(page.locator('[data-testid="active-users-list"]')).toContainText('PM User');
    await expect(page.locator('[data-testid="active-users-list"]')).toContainText('Admin User');

    // Close second window
    await page2.close();

    // Wait a moment for disconnection
    await page.waitForTimeout(1000);

    // User 1 should see count decrease
    await expect(page.locator('[data-testid="active-users-count"]')).toHaveText('1');

    // Cleanup
    await logout(page);
  });

  test('should show typing indicator', async ({ page, context }) => {
    // Open first browser window (User 1)
    await login(page, TEST_USERS.pm);
    await page.goto(`/projects/${projectId}/stories/${storyId}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Start editing story
    await page.click('[data-testid="edit-story"]');

    // Open second browser window (User 2)
    const page2 = await context.newPage();
    await login(page2, TEST_USERS.admin);
    await page2.goto(`/projects/${projectId}/stories/${storyId}`);
    await page2.waitForSelector('[data-testid="story-detail"]');

    // User 2 should see typing indicator
    await page2.waitForSelector('[data-testid="typing-indicator"]:has-text("PM User is editing")', {
      timeout: 5000,
    });

    await expect(page2.locator('[data-testid="typing-indicator"]')).toContainText('PM User is editing');

    // User 1 cancels editing
    await page.click('[data-testid="cancel-edit"]');

    // Typing indicator should disappear
    await page2.waitForSelector('[data-testid="typing-indicator"]', { state: 'hidden', timeout: 5000 });

    // Cleanup
    await page2.close();
    await logout(page);
  });

  test('should handle connection loss gracefully', async ({ page }) => {
    await login(page, TEST_USERS.pm);
    await page.goto(`/projects/${projectId}/stories`);
    await page.waitForSelector('[data-testid="story-list"]');

    // Should show connected status
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected');

    // Simulate connection loss by disabling network
    await page.context().setOffline(true);

    // Wait for disconnection to be detected
    await page.waitForSelector('[data-testid="connection-status"]:has-text("Disconnected")', {
      timeout: 10000,
    });

    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Disconnected');
    await expect(page.locator('[data-testid="connection-warning"]')).toBeVisible();

    // Re-enable network
    await page.context().setOffline(false);

    // Should automatically reconnect
    await page.waitForSelector('[data-testid="connection-status"]:has-text("Connected")', {
      timeout: 10000,
    });

    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected');
    await expect(page.locator('[data-testid="connection-warning"]')).not.toBeVisible();

    // Cleanup
    await logout(page);
  });

  test('should sync missed updates after reconnection', async ({ page }) => {
    await login(page, TEST_USERS.pm);
    await page.goto(`/projects/${projectId}/stories`);
    await page.waitForSelector('[data-testid="story-list"]');

    const initialCount = await page.locator('[data-testid^="story-"]').count();

    // Disconnect
    await page.context().setOffline(true);
    await page.waitForSelector('[data-testid="connection-status"]:has-text("Disconnected")');

    // Create a new story via API (simulating another user's action)
    const newStory = await api.createStory({
      projectId,
      title: 'Story Created While Offline',
      description: 'This story was created while the user was offline',
    });

    // Reconnect
    await page.context().setOffline(false);
    await page.waitForSelector('[data-testid="connection-status"]:has-text("Connected")');

    // New story should appear after sync
    await page.waitForSelector('[data-testid^="story-"]:has-text("Story Created While Offline")', {
      timeout: 10000,
    });

    const newCount = await page.locator('[data-testid^="story-"]').count();
    expect(newCount).toBe(initialCount + 1);

    // Cleanup
    await api.deleteStory(newStory.id);
    await logout(page);
  });
});
