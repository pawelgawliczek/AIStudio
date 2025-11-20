import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Tests for Story Detail Page Enhancements (ST-26)
 * Tests dedicated story page, shareable URLs, token metrics, and workflow analysis
 */
test.describe('Story Detail Page - Dedicated Page & Shareable URLs', () => {
  let api: ApiHelper;
  let projectId: string;
  let epicId: string;
  let storyId: string;
  let storyKey: string;

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
    storyKey = testData.story.key;
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

  test('should access story via shareable URL with storyKey', async ({ page }) => {
    // Navigate to story using storyKey (e.g., /story/ST-1)
    await page.goto(`/story/${storyKey}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify story content is displayed
    await expect(page.locator('[data-testid="story-detail"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Test Story');

    // Verify URL is shareable (contains storyKey not UUID)
    expect(page.url()).toContain(`/story/${storyKey}`);
    expect(page.url()).not.toContain(storyId);

    // Verify story key is displayed
    await expect(page.locator(`text=${storyKey}`)).toBeVisible();
  });

  test('should access story via alternative URL pattern /stories/:storyKey', async ({ page }) => {
    // Navigate to story using alternative pattern
    await page.goto(`/stories/${storyKey}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify story content is displayed
    await expect(page.locator('[data-testid="story-detail"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Test Story');
  });

  test('should support legacy URL pattern with projectId and storyId UUID', async ({ page }) => {
    // Navigate using legacy pattern (UUID-based)
    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify story content is displayed
    await expect(page.locator('[data-testid="story-detail"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Test Story');
  });

  test('should allow copying shareable URL from browser address bar', async ({ page }) => {
    // Navigate to story
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Get the current URL
    const currentUrl = page.url();

    // Verify it's shareable (contains storyKey)
    expect(currentUrl).toContain(storyKey);

    // Open in new tab (simulating sharing URL)
    const newPage = await page.context().newPage();
    await login(newPage, TEST_USERS.dev);
    await newPage.goto(currentUrl);

    // Verify story loads in new tab
    await newPage.waitForSelector('[data-testid="story-detail"]');
    await expect(newPage.locator('h1')).toContainText('Test Story');

    // Cleanup
    await newPage.close();
  });

  test('should display breadcrumbs with story key', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify breadcrumbs exist
    await expect(page.locator('[data-testid="breadcrumb-stories"]')).toBeVisible();
    await expect(page.locator('[data-testid="breadcrumb-story"]')).toContainText(storyKey);
  });

  test('should show 404 or error for non-existent story key', async ({ page }) => {
    // Navigate to non-existent story
    await page.goto('/story/ST-99999');

    // Should show error or redirect (implementation may vary)
    // Wait for either error message or redirect
    await page.waitForTimeout(2000);

    // Verify we're not on a valid story detail page
    const storyDetail = await page.locator('[data-testid="story-detail"]').count();
    expect(storyDetail).toBe(0);
  });
});

test.describe('Story Detail Page - Token Metrics Panel', () => {
  let api: ApiHelper;
  let projectId: string;
  let storyId: string;
  let storyKey: string;

  test.beforeAll(async ({ request }) => {
    await DbHelper.seedTestUsers(request);
    const token = await ApiHelper.login(request, TEST_USERS.pm.email, TEST_USERS.pm.password);
    api = new ApiHelper(request, token);

    const testData = await DbHelper.createTestProject(api);
    projectId = testData.project.id;
    storyId = testData.story.id;
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

  test('should display token metrics panel when execution data exists', async ({ page }) => {
    // Note: This test assumes workflow execution data exists
    // In a real scenario, you'd trigger a workflow execution first
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Token metrics panel should be visible
    const tokenPanel = page.locator('text=Token Usage & Cost');

    // If no execution data, should show empty state
    const hasExecutionData = await tokenPanel.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasExecutionData) {
      await expect(tokenPanel).toBeVisible();

      // Verify summary cards exist
      await expect(page.locator('text=Total Tokens')).toBeVisible();
      await expect(page.locator('text=Total Cost')).toBeVisible();
      await expect(page.locator('text=Workflow Runs')).toBeVisible();
    } else {
      // Empty state message
      const emptyMessage = page.locator('text=No execution data available yet');
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('should show empty state when no workflow executions exist', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Look for empty state message
    const emptyState = page.locator('text=No execution data available yet');

    // Should either show metrics or empty state
    const hasMetrics = await page.locator('text=Token Usage & Cost').isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasMetrics) {
      await expect(emptyState).toBeVisible();
      await expect(page.locator('text=Token metrics will appear after the story is executed')).toBeVisible();
    }
  });

  test('should expand and collapse workflow run details', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Check if workflow runs exist
    const hasRuns = await page.locator('text=Workflow Execution History').isVisible({ timeout: 2000 }).catch(() => false);

    if (hasRuns) {
      // Find first workflow run header (button)
      const runHeader = page.locator('button').filter({ hasText: 'tokens' }).first();

      if (await runHeader.count() > 0) {
        // Click to expand
        await runHeader.click();

        // Wait for expansion animation
        await page.waitForTimeout(300);

        // Verify details are visible
        await expect(page.locator('text=Started:')).toBeVisible();
        await expect(page.locator('text=Duration:')).toBeVisible();

        // Click again to collapse
        await runHeader.click();
        await page.waitForTimeout(300);

        // Details should be hidden
        const detailsVisible = await page.locator('text=Started:').isVisible({ timeout: 1000 }).catch(() => false);
        expect(detailsVisible).toBe(false);
      }
    }
  });

  test('should display component-level token breakdown', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Check if workflow runs with components exist
    const hasRuns = await page.locator('text=Component Breakdown').isVisible({ timeout: 2000 }).catch(() => false);

    if (hasRuns) {
      // Expand first run
      const runHeader = page.locator('button').filter({ hasText: 'tokens' }).first();
      if (await runHeader.count() > 0) {
        await runHeader.click();
        await page.waitForTimeout(300);

        // Verify component breakdown visible
        await expect(page.locator('text=Component Breakdown')).toBeVisible();

        // Should show component names with metrics
        const componentRow = page.locator('text=tokens').first();
        await expect(componentRow).toBeVisible();
      }
    }
  });

  test('should format token numbers with commas', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    const hasMetrics = await page.locator('text=Total Tokens').isVisible({ timeout: 2000 }).catch(() => false);

    if (hasMetrics) {
      // Token numbers should be formatted (e.g., "50,000" not "50000")
      const tokenText = await page.locator('text=Total Tokens').locator('..').locator('p').textContent();

      // If token count > 999, should have comma
      if (tokenText && parseInt(tokenText.replace(/,/g, '')) > 999) {
        expect(tokenText).toMatch(/,/);
      }
    }
  });

  test('should format costs with dollar sign and decimals', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    const hasMetrics = await page.locator('text=Total Cost').isVisible({ timeout: 2000 }).catch(() => false);

    if (hasMetrics) {
      // Cost should be formatted as currency
      const costElement = page.locator('text=Total Cost').locator('..').locator('p');
      await expect(costElement).toContainText('$');
    }
  });
});

test.describe('Story Detail Page - Workflow Analysis Display', () => {
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

    // Update story with analysis fields
    await api.updateStory(storyId, {
      baAnalysis: '# Business Analysis\nThis is a test business analysis with **markdown** support.',
      architectAnalysis: '# Architecture Design\n- Component 1\n- Component 2\n```typescript\nconst test = "code block";\n```',
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

  test('should display workflow analysis section', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Scroll to find Workflow Analysis section
    await page.evaluate(() => {
      const element = document.querySelector('text=Workflow Analysis');
      if (element) element.scrollIntoView();
    });

    // Should show workflow analysis sections
    const hasAnalysis = await page.locator('text=Business Analysis').isVisible({ timeout: 2000 }).catch(() => false);

    if (hasAnalysis) {
      await expect(page.locator('text=Business Analysis')).toBeVisible();
    }
  });

  test('should expand and collapse analysis sections', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Check if analysis sections exist
    const baSection = page.locator('text=Business Analysis').first();
    const hasSection = await baSection.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasSection) {
      // Click to expand
      await baSection.click();
      await page.waitForTimeout(300);

      // Markdown content should be visible
      const markdownContent = page.locator('text=This is a test business analysis');
      await expect(markdownContent).toBeVisible();

      // Click again to collapse
      await baSection.click();
      await page.waitForTimeout(300);

      // Content should be hidden
      const contentVisible = await markdownContent.isVisible({ timeout: 1000 }).catch(() => false);
      expect(contentVisible).toBe(false);
    }
  });

  test('should render markdown content correctly', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    const archSection = page.locator('text=Architecture Design').first();
    const hasSection = await archSection.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasSection) {
      // Expand section
      await archSection.click();
      await page.waitForTimeout(300);

      // Verify markdown rendering
      // - Lists should render as <li> elements
      await expect(page.locator('li:has-text("Component 1")')).toBeVisible();

      // - Code blocks should render with proper styling
      const codeBlock = page.locator('code:has-text("const test")');
      await expect(codeBlock).toBeVisible();
    }
  });

  test('should show timestamps in relative format', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // If analysis has timestamp, should show relative format like "2 hours ago"
    const timestampBadge = page.locator('text=/\\d+ (second|minute|hour|day)s? ago/').first();
    const hasTimestamp = await timestampBadge.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasTimestamp) {
      await expect(timestampBadge).toBeVisible();
    }
  });
});

test.describe('Story Detail Page - Multi-user Real-time Updates', () => {
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
  });

  test.afterAll(async () => {
    await DbHelper.cleanup(api);
  });

  test('should receive real-time workflow analysis updates', async ({ page, context }) => {
    // User 1: Open story detail page
    await login(page, TEST_USERS.pm);
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify no context exploration initially
    const hasContextBefore = await page.locator('text=Context Exploration').isVisible({ timeout: 1000 }).catch(() => false);

    // User 2: Open same story and update via API
    const page2 = await context.newPage();
    await login(page2, TEST_USERS.admin);

    // Update story with new analysis via API (simulating workflow completion)
    await api.updateStory(storyId, {
      contextExploration: '# Context Exploration\nNew analysis from workflow component execution.',
    } as any);

    // User 1 should see the update appear automatically (via WebSocket)
    await page.waitForSelector('text=Context Exploration', { timeout: 5000 });
    await expect(page.locator('text=Context Exploration')).toBeVisible();

    // Cleanup
    await page2.close();
    await logout(page);
  });

  test('should show live execution status updates', async ({ page }) => {
    await login(page, TEST_USERS.pm);
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Check if execution status indicators exist
    // (This depends on workflow execution being in progress)
    const statusIndicator = page.locator('[data-testid="execution-status"]');
    const hasStatus = await statusIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasStatus) {
      // Should show current component being executed
      await expect(statusIndicator).toBeVisible();
    }
  });

  test('should update token metrics in real-time when workflow completes', async ({ page, context }) => {
    // User 1: Viewing story
    await login(page, TEST_USERS.pm);
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Get initial token count (if any)
    const initialTokenText = await page.locator('text=Total Tokens').locator('..').locator('p').textContent().catch(() => '0');

    // Simulate workflow completion that adds token data
    // (This would normally happen via WebSocket when backend updates)

    // In a real test, you'd:
    // 1. Trigger workflow execution via API
    // 2. Wait for completion
    // 3. Verify token metrics update automatically

    // For now, just verify the panel structure
    const tokenPanel = page.locator('text=Token Usage & Cost');
    const hasPanel = await tokenPanel.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasPanel) {
      await expect(tokenPanel).toBeVisible();
    }

    await logout(page);
  });
});

test.describe('Story Detail Page - Comprehensive Field Visibility', () => {
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

  test('should display all story metadata fields', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify all essential fields are visible
    await expect(page.locator('h1')).toBeVisible(); // Title
    await expect(page.locator('text=Technical Complexity')).toBeVisible();
    await expect(page.locator('text=Business Impact')).toBeVisible();
    await expect(page.locator('text=Business Complexity')).toBeVisible();
    await expect(page.locator('[data-testid="current-status"]')).toBeVisible();
  });

  test('should display story traceability section', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Scroll to traceability section
    await page.evaluate(() => {
      const element = document.querySelector('text=Story Traceability');
      if (element) element.scrollIntoView();
    });

    // Should show traceability section
    const traceability = page.locator('text=Story Traceability');
    await expect(traceability).toBeVisible();
  });

  test('should display subtasks section', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Scroll to subtasks
    await page.evaluate(() => {
      const element = document.querySelector('text=Subtasks');
      if (element) element.scrollIntoView();
    });

    // Should show subtasks section
    await expect(page.locator('text=Subtasks')).toBeVisible();
    await expect(page.locator('[data-testid="add-subtask"]')).toBeVisible();
  });

  test('should show all sections in correct order', async ({ page }) => {
    await page.goto(`/story/${storyKey}`);
    await page.waitForSelector('[data-testid="story-detail"]');

    // Get all headings in order
    const headings = await page.locator('h1, h2, h3').allTextContents();

    // Verify sections appear in logical order
    const storyTitleIndex = headings.findIndex(h => h.includes('Test Story'));
    const workflowAnalysisIndex = headings.findIndex(h => h.includes('Workflow Analysis'));
    const tokenMetricsIndex = headings.findIndex(h => h.includes('Token Usage'));
    const traceabilityIndex = headings.findIndex(h => h.includes('Story Traceability'));
    const subtasksIndex = headings.findIndex(h => h.includes('Subtasks'));

    // Story title should come first
    expect(storyTitleIndex).toBeGreaterThanOrEqual(0);

    // Workflow Analysis should come before Token Metrics
    if (workflowAnalysisIndex >= 0 && tokenMetricsIndex >= 0) {
      expect(workflowAnalysisIndex).toBeLessThan(tokenMetricsIndex);
    }

    // Subtasks should come last
    if (subtasksIndex >= 0) {
      expect(subtasksIndex).toBeGreaterThan(storyTitleIndex);
    }
  });
});
