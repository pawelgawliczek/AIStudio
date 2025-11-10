import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Tests for Subtask Management
 * Tests CRUD operations and subtask assignment
 */
test.describe('Subtask Management', () => {
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

  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.pm);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should create a new subtask', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Click "Add Subtask" button
    await page.click('[data-testid="add-subtask"]');

    // Fill in subtask form
    await page.fill('[data-testid="subtask-title"]', 'Implement API endpoint');
    await page.fill('[data-testid="subtask-description"]', 'Create POST /api/users endpoint');
    await page.selectOption('[data-testid="subtask-layer"]', 'backend');
    await page.fill('[data-testid="subtask-component"]', 'API');

    // Submit form
    await page.click('[data-testid="save-subtask"]');

    // Wait for subtask to appear in list
    await page.waitForSelector('[data-testid^="subtask-"]');

    // Verify subtask appears in UI
    const subtaskCard = page.locator('[data-testid^="subtask-"]:has-text("Implement API endpoint")');
    await expect(subtaskCard).toBeVisible();
    await expect(subtaskCard.locator('[data-testid="subtask-status"]')).toHaveText('todo');
    await expect(subtaskCard.locator('[data-testid="subtask-layer"]')).toHaveText('backend');

    // Verify via API
    const subtasks = await api.getSubtasks(storyId);
    expect(subtasks.length).toBeGreaterThan(0);
    const newSubtask = subtasks.find((s) => s.title === 'Implement API endpoint');
    expect(newSubtask).toBeDefined();
    expect(newSubtask?.status).toBe('todo');
    expect(newSubtask?.layer).toBe('backend');
    expect(newSubtask?.component).toBe('API');
  });

  test('should update subtask status', async ({ page }) => {
    // Create test subtask
    const subtask = await api.createSubtask({
      storyId,
      title: 'Write unit tests',
      description: 'Add test coverage',
      layer: 'tests',
    });

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Find subtask card
    const subtaskCard = page.locator(`[data-testid="subtask-${subtask.id}"]`);
    await expect(subtaskCard).toBeVisible();

    // Click status dropdown
    await subtaskCard.locator('[data-testid="status-dropdown"]').click();

    // Select "in_progress"
    await page.click('[data-testid="status-in_progress"]');

    // Wait for update
    await page.waitForSelector(`[data-testid="subtask-${subtask.id}"] [data-testid="subtask-status"]:has-text("in_progress")`);

    // Verify status changed in UI
    await expect(subtaskCard.locator('[data-testid="subtask-status"]')).toHaveText('in_progress');

    // Verify via API
    const updatedSubtask = await api.getSubtasks(storyId);
    const updated = updatedSubtask.find((s) => s.id === subtask.id);
    expect(updated?.status).toBe('in_progress');

    // Cleanup
    await api.deleteSubtask(subtask.id);
  });

  test('should edit subtask details', async ({ page }) => {
    // Create test subtask
    const subtask = await api.createSubtask({
      storyId,
      title: 'Original Title',
      description: 'Original description',
    });

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Click edit button on subtask
    await page.click(`[data-testid="edit-subtask-${subtask.id}"]`);

    // Update fields
    await page.fill('[data-testid="subtask-title"]', 'Updated Title');
    await page.fill('[data-testid="subtask-description"]', 'Updated description');
    await page.selectOption('[data-testid="subtask-layer"]', 'frontend');
    await page.fill('[data-testid="subtask-component"]', 'UI');

    // Save changes
    await page.click('[data-testid="save-subtask"]');

    // Wait for update
    await page.waitForSelector(`[data-testid="subtask-${subtask.id}"]:has-text("Updated Title")`);

    // Verify changes in UI
    const subtaskCard = page.locator(`[data-testid="subtask-${subtask.id}"]`);
    await expect(subtaskCard.locator('[data-testid="subtask-title"]')).toHaveText('Updated Title');
    await expect(subtaskCard.locator('[data-testid="subtask-layer"]')).toHaveText('frontend');

    // Verify via API
    const subtasks = await api.getSubtasks(storyId);
    const updated = subtasks.find((s) => s.id === subtask.id);
    expect(updated?.title).toBe('Updated Title');
    expect(updated?.description).toBe('Updated description');
    expect(updated?.layer).toBe('frontend');
    expect(updated?.component).toBe('UI');

    // Cleanup
    await api.deleteSubtask(subtask.id);
  });

  test('should delete subtask', async ({ page }) => {
    // Create test subtask
    const subtask = await api.createSubtask({
      storyId,
      title: 'Subtask to Delete',
    });

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Verify subtask exists
    await expect(page.locator(`[data-testid="subtask-${subtask.id}"]`)).toBeVisible();

    // Click delete button
    await page.click(`[data-testid="delete-subtask-${subtask.id}"]`);

    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');

    // Wait for subtask to disappear
    await page.waitForSelector(`[data-testid="subtask-${subtask.id}"]`, { state: 'detached' });

    // Verify subtask is gone
    await expect(page.locator(`[data-testid="subtask-${subtask.id}"]`)).not.toBeVisible();

    // Verify via API
    const subtasks = await api.getSubtasks(storyId);
    const deleted = subtasks.find((s) => s.id === subtask.id);
    expect(deleted).toBeUndefined();
  });

  test('should filter subtasks by layer', async ({ page }) => {
    // Create subtasks in different layers
    await api.createSubtask({ storyId, title: 'Backend Task', layer: 'backend' });
    await api.createSubtask({ storyId, title: 'Frontend Task', layer: 'frontend' });
    await api.createSubtask({ storyId, title: 'Test Task', layer: 'tests' });

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // All subtasks should be visible initially
    await expect(page.locator('[data-testid^="subtask-"]')).toHaveCount(expect.any(Number));

    // Filter by backend
    await page.selectOption('[data-testid="filter-layer"]', 'backend');
    await page.waitForTimeout(500); // Wait for filter to apply

    // Only backend subtasks should be visible
    await expect(page.locator('[data-testid^="subtask-"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-testid^="subtask-"]:has-text("Backend Task")')).toBeVisible();
    await expect(page.locator('[data-testid^="subtask-"]:has-text("Frontend Task")')).not.toBeVisible();

    // Filter by frontend
    await page.selectOption('[data-testid="filter-layer"]', 'frontend');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid^="subtask-"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-testid^="subtask-"]:has-text("Frontend Task")')).toBeVisible();
    await expect(page.locator('[data-testid^="subtask-"]:has-text("Backend Task")')).not.toBeVisible();

    // Clear filter
    await page.selectOption('[data-testid="filter-layer"]', 'all');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid^="subtask-"]')).toHaveCount(expect.any(Number));
  });

  test('should assign subtask to agent or human', async ({ page }) => {
    // Create test subtask
    const subtask = await api.createSubtask({
      storyId,
      title: 'Task to Assign',
    });

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Click assign button
    await page.click(`[data-testid="assign-subtask-${subtask.id}"]`);

    // Select assignee type
    await page.selectOption('[data-testid="assignee-type"]', 'agent');

    // Select specific agent
    await page.selectOption('[data-testid="assignee-select"]', 'dev-agent-1');

    // Save assignment
    await page.click('[data-testid="save-assignment"]');

    // Wait for update
    await page.waitForSelector(`[data-testid="subtask-${subtask.id}"] [data-testid="assignee"]:has-text("dev-agent-1")`);

    // Verify assignment in UI
    const subtaskCard = page.locator(`[data-testid="subtask-${subtask.id}"]`);
    await expect(subtaskCard.locator('[data-testid="assignee"]')).toHaveText('dev-agent-1');
    await expect(subtaskCard.locator('[data-testid="assignee-type"]')).toHaveText('agent');

    // Cleanup
    await api.deleteSubtask(subtask.id);
  });

  test('should display subtasks grouped by status', async ({ page }) => {
    // Create subtasks with different statuses
    const subtask1 = await api.createSubtask({ storyId, title: 'Todo Task' });
    const subtask2 = await api.createSubtask({ storyId, title: 'In Progress Task' });
    await api.updateSubtask(subtask2.id, { status: 'in_progress' });
    const subtask3 = await api.createSubtask({ storyId, title: 'Done Task' });
    await api.updateSubtask(subtask3.id, { status: 'done' });

    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Switch to grouped view
    await page.click('[data-testid="group-by-status"]');

    // Verify groups exist
    await expect(page.locator('[data-testid="status-group-todo"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-group-in_progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-group-done"]')).toBeVisible();

    // Verify subtasks are in correct groups
    const todoGroup = page.locator('[data-testid="status-group-todo"]');
    await expect(todoGroup.locator('[data-testid^="subtask-"]:has-text("Todo Task")')).toBeVisible();

    const inProgressGroup = page.locator('[data-testid="status-group-in_progress"]');
    await expect(inProgressGroup.locator('[data-testid^="subtask-"]:has-text("In Progress Task")')).toBeVisible();

    const doneGroup = page.locator('[data-testid="status-group-done"]');
    await expect(doneGroup.locator('[data-testid^="subtask-"]:has-text("Done Task")')).toBeVisible();
  });
});
