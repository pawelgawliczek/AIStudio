import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Tests for Epic Management and Project Navigation
 * Tests epic CRUD and navigation between projects
 */
test.describe('Epic Management and Navigation', () => {
  let api: ApiHelper;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    await DbHelper.seedTestUsers(request);

    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    const testData = await DbHelper.createTestProject(api);
    projectId = testData.project.id;
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

  test('should display project selector in navbar', async ({ page }) => {
    await page.goto('/dashboard');

    // Project selector should be visible
    await expect(page.locator('[data-testid="project-selector"]')).toBeVisible();

    // Click to open dropdown
    await page.click('[data-testid="project-selector"]');

    // Should show list of projects
    await expect(page.locator('[data-testid="project-dropdown"]')).toBeVisible();
    await expect(page.locator('[data-testid^="project-option-"]')).toHaveCount(expect.any(Number));
  });

  test('should switch between projects', async ({ page }) => {
    // Create second project
    const project2 = await api.createProject('Test Project 2', 'Second test project');

    await page.goto('/dashboard');

    // Open project selector
    await page.click('[data-testid="project-selector"]');

    // Select first project
    await page.click(`[data-testid="project-option-${projectId}"]`);
    await page.waitForTimeout(500);

    // Verify project is selected
    await expect(page.locator('[data-testid="project-selector"]')).toContainText('Test Project');

    // Navigate to stories page
    await page.goto(`/projects/${projectId}/stories`);
    await page.waitForSelector('[data-testid="story-list"]');

    // Switch to second project
    await page.click('[data-testid="project-selector"]');
    await page.click(`[data-testid="project-option-${project2.id}"]`);

    // Should navigate to second project's stories
    await expect(page).toHaveURL(`/projects/${project2.id}/stories`);
    await expect(page.locator('[data-testid="project-selector"]')).toContainText('Test Project 2');

    // Cleanup
    await api.deleteProject(project2.id);
  });

  test('should create a new epic', async ({ page }) => {
    await page.goto(`/projects/${projectId}/epics`);

    // Click create epic button
    await page.click('[data-testid="create-epic"]');

    // Fill in epic form
    await page.fill('[data-testid="epic-title"]', 'User Management');
    await page.fill('[data-testid="epic-description"]', 'Complete user management system');
    await page.selectOption('[data-testid="epic-priority"]', '5');

    // Submit form
    await page.click('[data-testid="save-epic"]');

    // Wait for epic to appear
    await page.waitForSelector('[data-testid^="epic-"]:has-text("User Management")');

    // Verify epic is visible
    await expect(page.locator('[data-testid^="epic-"]:has-text("User Management")')).toBeVisible();

    // Verify via API
    const epics = await api.getEpics(projectId);
    const newEpic = epics.find((e) => e.title === 'User Management');
    expect(newEpic).toBeDefined();
    expect(newEpic?.description).toBe('Complete user management system');
    expect(newEpic?.key).toMatch(/^EP-\d+$/);
  });

  test('should display epic key automatically', async ({ page }) => {
    await page.goto(`/projects/${projectId}/epics`);

    // Get current epic count
    const epics = await api.getEpics(projectId);
    const nextEpicNumber = epics.length + 1;

    // Click create epic
    await page.click('[data-testid="create-epic"]');

    // Epic key should be auto-populated
    await expect(page.locator('[data-testid="epic-key"]')).toHaveValue(`EP-${nextEpicNumber}`);

    // Epic key field should be readonly
    await expect(page.locator('[data-testid="epic-key"]')).toBeDisabled();

    // Cancel
    await page.click('[data-testid="cancel-epic"]');
  });

  test('should update epic details', async ({ page }) => {
    // Create test epic
    const epic = await api.createEpic(projectId, 'Original Epic Title', 'Original description');

    await page.goto(`/projects/${projectId}/epics`);

    // Click edit button
    await page.click(`[data-testid="edit-epic-${epic.id}"]`);

    // Update fields
    await page.fill('[data-testid="epic-title"]', 'Updated Epic Title');
    await page.fill('[data-testid="epic-description"]', 'Updated description');
    await page.selectOption('[data-testid="epic-status"]', 'in_progress');

    // Save changes
    await page.click('[data-testid="save-epic"]');

    // Wait for update
    await page.waitForSelector('[data-testid^="epic-"]:has-text("Updated Epic Title")');

    // Verify changes
    await expect(page.locator(`[data-testid="epic-${epic.id}"] [data-testid="epic-title"]`)).toHaveText('Updated Epic Title');
    await expect(page.locator(`[data-testid="epic-${epic.id}"] [data-testid="epic-status"]`)).toHaveText('in_progress');

    // Verify via API
    const epics = await api.getEpics(projectId);
    const updated = epics.find((e) => e.id === epic.id);
    expect(updated?.title).toBe('Updated Epic Title');
    expect(updated?.description).toBe('Updated description');
    expect(updated?.status).toBe('in_progress');

    // Cleanup
    await api.deleteEpic(epic.id);
  });

  test('should delete epic with confirmation', async ({ page }) => {
    // Create test epic
    const epic = await api.createEpic(projectId, 'Epic to Delete', 'This epic will be deleted');

    await page.goto(`/projects/${projectId}/epics`);

    // Verify epic exists
    await expect(page.locator(`[data-testid="epic-${epic.id}"]`)).toBeVisible();

    // Click delete button
    await page.click(`[data-testid="delete-epic-${epic.id}"]`);

    // Confirmation dialog should appear
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-confirmation"]')).toContainText('Epic to Delete');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');

    // Wait for epic to disappear
    await page.waitForSelector(`[data-testid="epic-${epic.id}"]`, { state: 'detached' });

    // Verify epic is gone
    await expect(page.locator(`[data-testid="epic-${epic.id}"]`)).not.toBeVisible();

    // Verify via API
    const epics = await api.getEpics(projectId);
    const deleted = epics.find((e) => e.id === epic.id);
    expect(deleted).toBeUndefined();
  });

  test('should prevent deleting epic with stories', async ({ page }) => {
    // Create epic with story
    const epic = await api.createEpic(projectId, 'Epic with Story', 'Has stories');
    await api.createStory({
      projectId,
      epicId: epic.id,
      title: 'Story in Epic',
    });

    await page.goto(`/projects/${projectId}/epics`);

    // Try to delete epic
    await page.click(`[data-testid="delete-epic-${epic.id}"]`);

    // Should show warning
    await expect(page.locator('[data-testid="delete-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-warning"]')).toContainText(
      'This epic has stories'
    );

    // Delete button should be disabled or show different action
    const deleteButton = page.locator('[data-testid="confirm-delete"]');
    if (await deleteButton.isVisible()) {
      await expect(deleteButton).toBeDisabled();
    }

    // Cancel
    await page.click('[data-testid="cancel-delete"]');

    // Epic should still exist
    await expect(page.locator(`[data-testid="epic-${epic.id}"]`)).toBeVisible();

    // Cleanup
    await api.deleteEpic(epic.id); // This should cascade delete stories
  });

  test('should view epic details with story list', async ({ page }) => {
    // Create epic with multiple stories
    const epic = await api.createEpic(projectId, 'Epic Detail Test', 'Epic with stories');
    await api.createStory({ projectId, epicId: epic.id, title: 'Story 1' });
    await api.createStory({ projectId, epicId: epic.id, title: 'Story 2' });
    await api.createStory({ projectId, epicId: epic.id, title: 'Story 3' });

    await page.goto(`/projects/${projectId}/epics/${epic.id}`);

    // Epic details should be visible
    await expect(page.locator('[data-testid="epic-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="epic-title"]')).toHaveText('Epic Detail Test');

    // Stories should be listed
    await expect(page.locator('[data-testid="epic-stories"]')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]')).toHaveCount(3);

    // Verify stories are correct epic's stories
    await expect(page.locator('[data-testid^="story-"]:has-text("Story 1")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("Story 2")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("Story 3")')).toBeVisible();

    // Cleanup
    await api.deleteEpic(epic.id);
  });

  test('should navigate using breadcrumbs', async ({ page }) => {
    // Create epic and story
    const epic = await api.createEpic(projectId, 'Breadcrumb Test Epic');
    const story = await api.createStory({
      projectId,
      epicId: epic.id,
      title: 'Breadcrumb Test Story',
    });

    // Navigate to story detail
    await page.goto(`/projects/${projectId}/stories/${story.id}`);

    // Breadcrumbs should be visible
    await expect(page.locator('[data-testid="breadcrumbs"]')).toBeVisible();

    // Should show: Project > Epic > Story
    await expect(page.locator('[data-testid="breadcrumb-project"]')).toBeVisible();
    await expect(page.locator('[data-testid="breadcrumb-epic"]')).toBeVisible();
    await expect(page.locator('[data-testid="breadcrumb-story"]')).toBeVisible();

    // Click on epic breadcrumb
    await page.click('[data-testid="breadcrumb-epic"]');

    // Should navigate to epic detail
    await expect(page).toHaveURL(`/projects/${projectId}/epics/${epic.id}`);

    // Click on project breadcrumb
    await page.click('[data-testid="breadcrumb-project"]');

    // Should navigate to project view
    await expect(page).toHaveURL(`/projects/${projectId}/stories`);

    // Cleanup
    await api.deleteEpic(epic.id);
  });

  test('should search projects in selector', async ({ page }) => {
    // Create multiple projects
    await api.createProject('Project Alpha');
    await api.createProject('Project Beta');
    await api.createProject('Project Gamma');

    await page.goto('/dashboard');

    // Open project selector
    await page.click('[data-testid="project-selector"]');

    // Should show all projects
    const allProjects = await page.locator('[data-testid^="project-option-"]').count();
    expect(allProjects).toBeGreaterThanOrEqual(4); // At least 4 projects

    // Search for "Beta"
    await page.fill('[data-testid="project-search"]', 'Beta');
    await page.waitForTimeout(300);

    // Should show only matching project
    await expect(page.locator('[data-testid^="project-option-"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-testid^="project-option-"]:has-text("Project Beta")')).toBeVisible();

    // Clear search
    await page.fill('[data-testid="project-search"]', '');
    await page.waitForTimeout(300);

    // Should show all projects again
    const afterClear = await page.locator('[data-testid^="project-option-"]:visible').count();
    expect(afterClear).toBeGreaterThanOrEqual(4);
  });
});
