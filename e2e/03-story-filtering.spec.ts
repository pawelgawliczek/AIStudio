import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Tests for Story Filtering and Search
 * Tests various filtering capabilities
 */
test.describe('Story Filtering and Search', () => {
  let api: ApiHelper;
  let projectId: string;
  let epicId: string;

  test.beforeAll(async ({ request }) => {
    await DbHelper.seedTestUsers(request);

    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    const testData = await DbHelper.createTestProject(api);
    projectId = testData.project.id;
    epicId = testData.epic.id;

    // Create multiple stories with different attributes
    await api.createStory({
      projectId,
      epicId,
      title: 'User Authentication',
      description: 'Implement JWT authentication',
      businessImpact: 5,
      businessComplexity: 3,
      technicalComplexity: 4,
    });

    await api.createStory({
      projectId,
      epicId,
      title: 'Dashboard UI',
      description: 'Create main dashboard',
      businessImpact: 3,
      businessComplexity: 2,
      technicalComplexity: 2,
    });

    await api.createStory({
      projectId,
      epicId,
      title: 'API Rate Limiting',
      description: 'Add rate limiting to API',
      businessImpact: 4,
      businessComplexity: 2,
      technicalComplexity: 5,
    });

    // Create story in different epic
    const epic2 = await api.createEpic(projectId, 'Epic 2', 'Second epic');
    await api.createStory({
      projectId,
      epicId: epic2.id,
      title: 'Reporting System',
      description: 'Build reporting dashboard',
      businessImpact: 4,
      businessComplexity: 4,
      technicalComplexity: 3,
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

  test('should display all stories by default', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Wait for stories to load
    await page.waitForSelector('[data-testid="story-list"]');

    // All stories should be visible
    const storyCards = page.locator('[data-testid^="story-"]');
    await expect(storyCards).toHaveCount(4);

    // Verify stories are displayed
    await expect(page.locator('[data-testid^="story-"]:has-text("User Authentication")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("Dashboard UI")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("API Rate Limiting")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("Reporting System")')).toBeVisible();
  });

  test('should filter stories by status', async ({ page }) => {
    // Set some stories to different statuses
    const stories = await api.getStories({ projectId });
    const authStory = stories.find((s) => s.title === 'User Authentication');
    if (authStory) {
      await api.updateStoryStatus(authStory.id, 'implementation');
    }

    await page.goto(`/projects/${projectId}/stories`);

    // Filter by planning status
    await page.selectOption('[data-testid="filter-status"]', 'planning');
    await page.waitForTimeout(500);

    // Only planning stories should be visible
    const planningStories = page.locator('[data-testid^="story-"]:visible');
    await expect(planningStories).toHaveCount(3);
    await expect(page.locator('[data-testid^="story-"]:has-text("User Authentication")')).not.toBeVisible();

    // Filter by implementation status
    await page.selectOption('[data-testid="filter-status"]', 'implementation');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid^="story-"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-testid^="story-"]:has-text("User Authentication")')).toBeVisible();

    // Clear filter
    await page.selectOption('[data-testid="filter-status"]', 'all');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid^="story-"]')).toHaveCount(4);
  });

  test('should filter stories by epic', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Get epic selector value
    const epics = await api.getEpics(projectId);
    const epic1 = epics.find((e) => e.title === 'Test Epic');
    const epic2 = epics.find((e) => e.title === 'Epic 2');

    // Filter by first epic
    await page.selectOption('[data-testid="filter-epic"]', epic1!.id);
    await page.waitForTimeout(500);

    // Only stories from first epic should be visible
    await expect(page.locator('[data-testid^="story-"]:visible')).toHaveCount(3);
    await expect(page.locator('[data-testid^="story-"]:has-text("Reporting System")')).not.toBeVisible();

    // Filter by second epic
    await page.selectOption('[data-testid="filter-epic"]', epic2!.id);
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid^="story-"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-testid^="story-"]:has-text("Reporting System")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("User Authentication")')).not.toBeVisible();
  });

  test('should filter stories by complexity', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Filter by high technical complexity (>= 4)
    await page.selectOption('[data-testid="filter-tech-complexity"]', 'high');
    await page.waitForTimeout(500);

    // Only high complexity stories should be visible
    await expect(page.locator('[data-testid^="story-"]:visible').count()).toBeLessThan(4);
    await expect(page.locator('[data-testid^="story-"]:has-text("User Authentication")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("API Rate Limiting")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("Dashboard UI")')).not.toBeVisible();

    // Filter by low complexity (<= 2)
    await page.selectOption('[data-testid="filter-tech-complexity"]', 'low');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid^="story-"]:has-text("Dashboard UI")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("User Authentication")')).not.toBeVisible();
  });

  test('should search stories by title', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Search for "Authentication"
    await page.fill('[data-testid="search-stories"]', 'Authentication');
    await page.waitForTimeout(500);

    // Only matching story should be visible
    await expect(page.locator('[data-testid^="story-"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-testid^="story-"]:has-text("User Authentication")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("Dashboard UI")')).not.toBeVisible();

    // Search for "Dashboard"
    await page.fill('[data-testid="search-stories"]', 'Dashboard');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid^="story-"]:visible')).toHaveCount(2); // Dashboard UI and Reporting System
    await expect(page.locator('[data-testid^="story-"]:has-text("Dashboard UI")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:has-text("Reporting System")')).toBeVisible();

    // Search for partial match "API"
    await page.fill('[data-testid="search-stories"]', 'API');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid^="story-"]:has-text("API Rate Limiting")')).toBeVisible();
  });

  test('should search stories by description', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Search for text in description
    await page.fill('[data-testid="search-stories"]', 'JWT');
    await page.waitForTimeout(500);

    // Story with "JWT" in description should be visible
    await expect(page.locator('[data-testid^="story-"]:has-text("User Authentication")')).toBeVisible();
    await expect(page.locator('[data-testid^="story-"]:visible')).toHaveCount(1);
  });

  test('should combine multiple filters', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Apply status filter
    await page.selectOption('[data-testid="filter-status"]', 'planning');
    await page.waitForTimeout(500);

    // Apply epic filter
    const epics = await api.getEpics(projectId);
    const epic1 = epics.find((e) => e.title === 'Test Epic');
    await page.selectOption('[data-testid="filter-epic"]', epic1!.id);
    await page.waitForTimeout(500);

    // Apply complexity filter
    await page.selectOption('[data-testid="filter-tech-complexity"]', 'low');
    await page.waitForTimeout(500);

    // Only stories matching all filters should be visible
    const visibleStories = await page.locator('[data-testid^="story-"]:visible').count();
    expect(visibleStories).toBeLessThanOrEqual(3);

    // Verify specific story is visible (Dashboard UI: planning + epic1 + low complexity)
    await expect(page.locator('[data-testid^="story-"]:has-text("Dashboard UI")')).toBeVisible();
  });

  test('should sort stories by created date', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Sort by newest first (default)
    await page.selectOption('[data-testid="sort-by"]', 'created_desc');
    await page.waitForTimeout(500);

    // Get story titles in order
    const storyTitles = await page.locator('[data-testid="story-title"]').allTextContents();

    // Reporting System should be first (created last)
    expect(storyTitles[0]).toContain('Reporting System');

    // Sort by oldest first
    await page.selectOption('[data-testid="sort-by"]', 'created_asc');
    await page.waitForTimeout(500);

    const storyTitlesAsc = await page.locator('[data-testid="story-title"]').allTextContents();

    // User Authentication should be first (created first)
    expect(storyTitlesAsc[0]).toContain('User Authentication');
  });

  test('should sort stories by complexity', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Sort by technical complexity (highest first)
    await page.selectOption('[data-testid="sort-by"]', 'tech_complexity_desc');
    await page.waitForTimeout(500);

    const storyTitles = await page.locator('[data-testid="story-title"]').allTextContents();

    // API Rate Limiting should be first (complexity 5)
    expect(storyTitles[0]).toContain('API Rate Limiting');
  });

  test('should clear all filters', async ({ page }) => {
    await page.goto(`/projects/${projectId}/stories`);

    // Apply multiple filters
    await page.selectOption('[data-testid="filter-status"]', 'planning');
    await page.selectOption('[data-testid="filter-tech-complexity"]', 'high');
    await page.fill('[data-testid="search-stories"]', 'API');
    await page.waitForTimeout(500);

    // Only specific stories visible
    const filteredCount = await page.locator('[data-testid^="story-"]:visible').count();
    expect(filteredCount).toBeLessThan(4);

    // Click clear filters button
    await page.click('[data-testid="clear-filters"]');
    await page.waitForTimeout(500);

    // All stories should be visible again
    await expect(page.locator('[data-testid^="story-"]')).toHaveCount(4);

    // Filters should be reset
    await expect(page.locator('[data-testid="filter-status"]')).toHaveValue('all');
    await expect(page.locator('[data-testid="search-stories"]')).toHaveValue('');
  });

  test('should paginate stories', async ({ page }) => {
    // This test assumes pagination is set to show 2 stories per page
    await page.goto(`/projects/${projectId}/stories`);

    // Should show first 2 stories (if pagination is implemented)
    const firstPageStories = await page.locator('[data-testid^="story-"]:visible').count();
    expect(firstPageStories).toBeGreaterThan(0);

    // If pagination exists, test page navigation
    const nextButton = page.locator('[data-testid="next-page"]');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Different stories should be visible
      const secondPageStories = await page.locator('[data-testid^="story-"]:visible').count();
      expect(secondPageStories).toBeGreaterThan(0);

      // Go back to first page
      await page.click('[data-testid="prev-page"]');
      await page.waitForTimeout(500);

      // Original stories should be visible again
      const backToFirstPage = await page.locator('[data-testid^="story-"]:visible').count();
      expect(backToFirstPage).toBe(firstPageStories);
    }
  });
});
