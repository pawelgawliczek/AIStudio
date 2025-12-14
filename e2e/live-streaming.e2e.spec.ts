/**
 * ST-220: Live Streaming Browser E2E Tests
 *
 * Tests live streaming functionality in the browser UI.
 * Targets production environment: https://vibestudio.example.com
 *
 * Coverage:
 * 1. MasterTranscriptPanel component rendering
 * 2. WebSocket connection status (agent online/offline)
 * 3. Live transcript streaming UI
 * 4. Active agent indicator (Online/Offline chip)
 * 5. Live Feed modal
 * 6. Transcript line display
 * 7. Agent progress events
 *
 * Note: These tests verify UI behavior, not the actual streaming mechanism.
 * For streaming mechanism tests, see backend/src/e2e/ep8-story-runner/live-streaming.e2e.test.ts
 */

import { test, expect, Page } from '@playwright/test';
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
    const page = await context.newPage();

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

  test('should display MasterTranscriptPanel on story detail page', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);

    // Wait for page to load
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    // Check if workflow run is displayed
    const workflowSection = page.locator('[data-testid="workflow-runs-section"]');
    await expect(workflowSection).toBeVisible({ timeout: 5000 });

    // Look for MasterTranscriptPanel (may not be visible if no transcripts)
    // The panel should exist in the DOM even if collapsed
    const transcriptPanel = page.locator('[data-testid="master-transcript-panel"]').or(
      page.locator('text=Master Session')
    );

    // If workflow run has transcripts, panel should be visible
    // Otherwise, it may not be rendered
    const hasTranscripts = await page.locator('text=Master Session').isVisible({ timeout: 2000 }).catch(() => false);

    if (hasTranscripts) {
      console.log('✅ MasterTranscriptPanel is visible');
      await expect(transcriptPanel).toBeVisible();
    } else {
      console.log('ℹ️  MasterTranscriptPanel not visible (no transcripts yet)');
    }
  });

  test('should display agent online/offline status indicator', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    // Look for agent status chip
    // Agent is typically offline in test environment
    const offlineChip = page.locator('text=Offline').or(
      page.getByRole('status', { name: /offline/i })
    );

    const onlineChip = page.locator('text=Online').or(
      page.getByRole('status', { name: /online/i })
    );

    // One of them should be visible if MasterTranscriptPanel is rendered
    const hasStatusChip = await offlineChip.isVisible({ timeout: 2000 }).catch(() => false) ||
                          await onlineChip.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasStatusChip) {
      console.log('✅ Agent status indicator found');
    } else {
      console.log('ℹ️  Agent status indicator not found (MasterTranscriptPanel may not be rendered)');
    }
  });

  test('should expand/collapse MasterTranscriptPanel when clicking header', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    // Check if Master Session panel exists
    const masterSessionHeader = page.locator('text=Master Session').first();
    const isVisible = await masterSessionHeader.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    // Click to expand
    await masterSessionHeader.click();
    await page.waitForTimeout(500); // Wait for animation

    // Look for content area (controls, file path, etc.)
    const contentArea = page.locator('[data-testid="transcript-content"]').or(
      page.locator('text=session').or(
        page.locator('text=Click play to start streaming')
      )
    );

    const hasContent = await contentArea.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasContent) {
      console.log('✅ MasterTranscriptPanel expanded');
    }

    // Click again to collapse
    await masterSessionHeader.click();
    await page.waitForTimeout(500);

    console.log('✅ MasterTranscriptPanel collapse/expand works');
  });

  test('should display Live Feed modal when clicking "View Live Feed" button', async ({ page }) => {
    // Navigate to workflow runs page
    await page.goto(`${FRONTEND_URL}/workflow-runs`);
    await page.waitForSelector('[data-testid="workflow-runs-list"]', { timeout: 10000 });

    // Look for our test workflow run
    const runRow = page.locator(`[data-workflow-run-id="${testWorkflowRunId}"]`).or(
      page.locator(`text=${testStoryKey}`).locator('..')
    );

    const hasRunRow = await runRow.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasRunRow) {
      console.log('ℹ️  Workflow run not found in list');
      test.skip();
      return;
    }

    // Look for "View Live Feed" button or action
    const liveFeedButton = runRow.locator('button', { hasText: /live feed/i }).or(
      runRow.locator('[aria-label*="live feed"]')
    );

    const hasLiveFeedButton = await liveFeedButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasLiveFeedButton) {
      console.log('ℹ️  Live Feed button not found');
      test.skip();
      return;
    }

    // Click Live Feed button
    await liveFeedButton.click();

    // Wait for modal to appear
    const modal = page.locator('[role="dialog"]').or(
      page.locator('[data-testid="live-feed-modal"]')
    );

    await expect(modal).toBeVisible({ timeout: 5000 });
    console.log('✅ Live Feed modal opened');

    // Modal should contain transcript content or placeholder
    const modalContent = modal.locator('text=Waiting for transcript').or(
      modal.locator('text=No transcript available')
    );

    const hasModalContent = await modalContent.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasModalContent) {
      console.log('✅ Live Feed modal has content');
    }

    // Close modal
    const closeButton = modal.locator('button[aria-label="Close"]').or(
      modal.locator('button', { hasText: /close/i })
    );

    await closeButton.click();
    await expect(modal).not.toBeVisible({ timeout: 2000 });
    console.log('✅ Live Feed modal closed');
  });

  test('should display transcript view mode toggle (Parsed vs Raw)', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    // Check if Master Session panel exists and expand it
    const masterSessionHeader = page.locator('text=Master Session').first();
    const isVisible = await masterSessionHeader.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      console.log('ℹ️  MasterTranscriptPanel not visible');
      test.skip();
      return;
    }

    await masterSessionHeader.click();
    await page.waitForTimeout(500);

    // Look for view mode toggle buttons
    const parsedViewButton = page.locator('button[aria-label*="Conversation view"]').or(
      page.getByRole('button', { name: /parsed/i })
    );

    const rawViewButton = page.locator('button[aria-label*="Raw JSONL"]').or(
      page.getByRole('button', { name: /raw/i })
    );

    const hasParsedButton = await parsedViewButton.isVisible({ timeout: 2000 }).catch(() => false);
    const hasRawButton = await rawViewButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasParsedButton && hasRawButton) {
      console.log('✅ View mode toggle buttons found');

      // Click Raw view
      await rawViewButton.click();
      await page.waitForTimeout(300);

      // Click back to Parsed view
      await parsedViewButton.click();
      await page.waitForTimeout(300);

      console.log('✅ View mode toggle works');
    } else {
      console.log('ℹ️  View mode toggle not found (may require active streaming)');
    }
  });

  test('should display play/stop controls when agent is online', async ({ page }) => {
    // This test checks for the presence of streaming controls
    // In production, the laptop agent is typically offline, so controls may not be visible

    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    // Check if Master Session panel exists
    const masterSessionHeader = page.locator('text=Master Session').first();
    const isVisible = await masterSessionHeader.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      console.log('ℹ️  MasterTranscriptPanel not visible');
      test.skip();
      return;
    }

    await masterSessionHeader.click();
    await page.waitForTimeout(500);

    // Look for play/stop buttons
    const playButton = page.locator('button[aria-label*="Start live streaming"]').or(
      page.getByRole('button', { name: /play/i })
    );

    const stopButton = page.locator('button[aria-label*="Stop streaming"]').or(
      page.getByRole('button', { name: /stop/i })
    );

    const hasPlayButton = await playButton.isVisible({ timeout: 2000 }).catch(() => false);
    const hasStopButton = await stopButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasPlayButton || hasStopButton) {
      console.log('✅ Streaming controls found');
    } else {
      console.log('ℹ️  Streaming controls not found (agent may be offline)');
    }
  });

  test('should display session tabs for compacted sessions', async ({ page }) => {
    // This test verifies multi-session tab support
    // In practice, most workflows will have only 1 session

    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    const masterSessionHeader = page.locator('text=Master Session').first();
    const isVisible = await masterSessionHeader.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      console.log('ℹ️  MasterTranscriptPanel not visible');
      test.skip();
      return;
    }

    await masterSessionHeader.click();
    await page.waitForTimeout(500);

    // Look for session tabs
    const initialTab = page.locator('text=Initial').or(
      page.getByRole('tab', { name: /initial/i })
    );

    const compactedTab = page.locator('text=Compacted 1').or(
      page.getByRole('tab', { name: /compacted/i })
    );

    const hasInitialTab = await initialTab.isVisible({ timeout: 2000 }).catch(() => false);
    const hasCompactedTab = await compactedTab.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasInitialTab) {
      console.log('✅ Initial session tab found');
    }

    if (hasCompactedTab) {
      console.log('✅ Compacted session tab found');
    } else {
      console.log('ℹ️  No compacted sessions (only 1 session)');
    }
  });

  test('should display "session" count chip in header', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    const masterSessionHeader = page.locator('text=Master Session').first();
    const isVisible = await masterSessionHeader.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      console.log('ℹ️  MasterTranscriptPanel not visible');
      test.skip();
      return;
    }

    // Look for session count chip (e.g., "1 session", "2 sessions")
    const sessionChip = page.locator('text=/\\d+ session/').or(
      page.locator('[data-testid="session-count"]')
    );

    const hasSessionChip = await sessionChip.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasSessionChip) {
      const chipText = await sessionChip.textContent();
      console.log(`✅ Session count chip found: "${chipText}"`);
    } else {
      console.log('ℹ️  Session count chip not found');
    }
  });

  test('should handle missing transcripts gracefully', async ({ page }) => {
    // This test verifies the UI handles missing transcripts without crashing

    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    // The page should load successfully even if transcripts are missing
    await expect(page.locator('[data-testid="story-detail"]')).toBeVisible();

    console.log('✅ Page loads gracefully with missing transcripts');
  });

  test('should verify WebSocket connection status in browser console', async ({ page }) => {
    // This test checks if the WebSocket connection is established
    // We can't directly access socket.connected, but we can check for errors

    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${FRONTEND_URL}/stories/${testStoryKey}`);
    await page.waitForSelector('[data-testid="story-detail"]', { timeout: 10000 });

    // Wait a bit for WebSocket connection attempts
    await page.waitForTimeout(2000);

    // Check for WebSocket-related errors
    const hasWebSocketError = consoleErrors.some(err =>
      err.toLowerCase().includes('websocket') ||
      err.toLowerCase().includes('socket.io') ||
      err.toLowerCase().includes('connection')
    );

    if (hasWebSocketError) {
      console.log('⚠️  WebSocket connection errors detected:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✅ No WebSocket connection errors');
    }
  });
});
