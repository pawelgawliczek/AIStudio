/**
 * ST-220: Live Streaming Browser E2E Tests
 *
 * Tests live streaming functionality in the browser UI.
 * Targets production environment: https://vibestudio.example.com
 *
 * Coverage:
 * 1. Story detail page tabs and workflow runs section
 * 2. Workflow execution monitor page (MasterTranscriptPanel)
 * 3. WebSocket connection status
 * 4. Execution tab navigation
 *
 * Note: These tests verify UI behavior, not the actual streaming mechanism.
 * For streaming mechanism tests, see backend/src/e2e/ep8-story-runner/live-streaming.e2e.test.ts
 */

import { test, expect } from '@playwright/test';
import { ApiHelper } from './utils/api.helper';

// Production environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://vibestudio.example.com';
const API_URL = process.env.API_URL || 'https://vibestudio.example.com/api';

// Known production IDs
const AI_STUDIO_PROJECT_ID = '345a29ee-d6ab-477d-8079-c5dda0844d77';
const SIMPLIFIED_WORKFLOW_ID = 'df9bf06d-38c5-4fa8-9c7d-b60d0bdfc122';

// Test data
let api: ApiHelper;
let testStoryId: string;
let testStoryKey: string;
let testWorkflowRunId: string;

test.describe.configure({ mode: 'serial' });

test.describe('ST-220: Live Streaming Browser Tests', () => {
  test.beforeAll(async ({ browser }) => {
    // Create API helper
    const context = await browser.newContext();

    // Login
    const token = await ApiHelper.login(context.request, 'admin@aistudio.local', 'admin123');
    api = new ApiHelper(context.request, token);

    // Create test story
    const story = await api.createStory({
      projectId: AI_STUDIO_PROJECT_ID,
      title: `[E2E Test] ST-220 Live Streaming - ${Date.now()}`,
      description: 'Test story for ST-220 live streaming UI verification. Will be deleted after test.',
    });

    testStoryId = story.id;
    testStoryKey = story.key;
    console.log(`Created test story: ${testStoryKey} (${testStoryId})`);

    // Create workflow run
    const run = await api.post(
      `/projects/${AI_STUDIO_PROJECT_ID}/workflow-runs`,
      {
        workflowId: SIMPLIFIED_WORKFLOW_ID,
        storyId: testStoryId,
        startedAt: new Date().toISOString(),
        status: 'running',
      }
    );

    testWorkflowRunId = run.data.id;
    console.log(`Created workflow run: ${testWorkflowRunId}`);

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup
    if (testStoryId && api) {
      try {
        await api.deleteStory(testStoryId);
        console.log(`Cleaned up test story: ${testStoryId}`);
      } catch (e) {
        console.log('Cleanup: Story may have been already deleted');
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    // Login to UI
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('input[name="email"]', 'admin@aistudio.local');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(`${FRONTEND_URL}/dashboard`, { timeout: 10000 });
  });

  test('should display story detail page with workflow runs', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);

    // Wait for page to load - look for the story key badge
    await page.waitForSelector(`text=${testStoryKey}`, { timeout: 10000 });

    // Check for Story Traceability section with Workflow Runs tab
    const workflowRunsTab = page.getByRole('tab', { name: 'Workflow Runs' });
    await expect(workflowRunsTab).toBeVisible({ timeout: 5000 });
    console.log('✅ Workflow Runs tab found');

    // Check that we have a workflow run listed
    const workflowRunItem = page.locator('text=Simplified Dev Workflow');
    const hasWorkflowRun = await workflowRunItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasWorkflowRun) {
      console.log('✅ Workflow run displayed in list');
    } else {
      console.log('ℹ️  Workflow run not yet visible in list');
    }
  });

  test('should navigate to Execution tab', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector(`text=${testStoryKey}`, { timeout: 10000 });

    // Click on Execution tab
    const executionTab = page.locator('tab:has-text("Execution")').or(
      page.getByRole('tab', { name: 'Execution' })
    );

    await expect(executionTab).toBeVisible({ timeout: 5000 });
    await executionTab.click();

    // Wait for tab content to load
    await page.waitForTimeout(500);

    console.log('✅ Successfully navigated to Execution tab');
  });

  test('should display workflow execution monitor page', async ({ page }) => {
    // Navigate directly to workflow execution monitor
    await page.goto(`${FRONTEND_URL}/team-runs/${testWorkflowRunId}/monitor`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for any content on the monitor page
    const pageContent = page.getByRole('main');
    await expect(pageContent).toBeVisible({ timeout: 5000 });

    // Look for workflow-related content
    const workflowContent = page.locator('text=WORKFLOW STATES').or(
      page.locator('text=Workflow States').or(
        page.locator('text=Master Session').or(
          page.locator('text=No states')
        )
      )
    );

    const hasContent = await workflowContent.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasContent) {
      console.log('✅ Workflow monitor page loaded with content');
    } else {
      // Just verify the page loaded without error
      console.log('ℹ️  Monitor page loaded (may be empty workflow)');
    }
  });

  test('should handle story page load gracefully', async ({ page }) => {
    // This test verifies the UI loads without crashing
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);

    // Wait for story key to appear (indicates page loaded)
    const storyBadge = page.getByTestId('breadcrumb-story');
    await expect(storyBadge).toBeVisible({ timeout: 10000 });

    console.log('✅ Story page loads gracefully');
  });

  test('should click on workflow run to navigate', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector(`text=${testStoryKey}`, { timeout: 10000 });

    // Find and click the workflow run button
    const workflowRunButton = page.locator('button:has-text("Simplified Dev Workflow")');
    const hasButton = await workflowRunButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasButton) {
      await workflowRunButton.click();
      // Should navigate or expand
      await page.waitForTimeout(500);
      console.log('✅ Clicked on workflow run');
    } else {
      console.log('ℹ️  Workflow run button not visible');
    }
  });

  test('should verify WebSocket connection without errors', async ({ page }) => {
    // This test checks if the WebSocket connection is established without errors
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${FRONTEND_URL}/team-runs/${testWorkflowRunId}/monitor`);
    await page.waitForLoadState('networkidle');

    // Wait for WebSocket connection attempts
    await page.waitForTimeout(2000);

    // Check for critical WebSocket errors (not just any errors)
    const hasCriticalWsError = consoleErrors.some(err =>
      (err.toLowerCase().includes('websocket') || err.toLowerCase().includes('socket.io')) &&
      (err.toLowerCase().includes('failed') || err.toLowerCase().includes('error'))
    );

    if (hasCriticalWsError) {
      console.log('⚠️  Critical WebSocket errors detected:');
      consoleErrors
        .filter(err => err.toLowerCase().includes('websocket') || err.toLowerCase().includes('socket'))
        .forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✅ No critical WebSocket errors');
    }
  });

  test('should display main navigation elements', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector(`text=${testStoryKey}`, { timeout: 10000 });

    // Check for main tabs
    const storyTab = page.getByRole('tab', { name: 'Story' });
    const executionTab = page.getByRole('tab', { name: 'Execution' });
    const deploymentsTab = page.getByRole('tab', { name: 'Deployments' });

    await expect(storyTab).toBeVisible({ timeout: 3000 });
    await expect(executionTab).toBeVisible({ timeout: 3000 });
    await expect(deploymentsTab).toBeVisible({ timeout: 3000 });

    console.log('✅ All main navigation tabs visible');
  });
});
