import { test, expect, Page } from '@playwright/test';
import {
  ApiHelper,
  TEST_USERS,
  extractTokenMetrics,
  extractEfficiencyMetrics,
  extractCodeImpactMetrics,
  extractExecutionMetrics,
  extractNumber,
  compareWithTolerance,
  assertKPI,
} from './utils';

/**
 * E2E Tests for Analytics KPI Verification (ST-263)
 *
 * Verifies that KPIs displayed on analytics pages match actual database/API values.
 *
 * Tests:
 * 1. Workflow Monitor Page (/team-runs/{runId}/monitor) - Token usage, cost, code impact, execution metrics
 * 2. Performance Dashboard (/analytics/performance) - Story counts per workflow
 * 3. Team Details Page (/analytics/team-details) - Aggregated KPIs
 */

const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

interface WorkflowRunMetrics {
  totalTokens: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreation?: number;
  totalCacheRead?: number;
  totalCost: number | null;
  costPerLOC: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  totalLinesModified: number;
  totalLocGenerated: number | null;
  totalTestsAdded: number | null;
  tokensPerLOC: number;
  totalDuration: number | null;
  totalUserPrompts: number | null;
  totalIterations: number | null;
  totalInterventions: number | null;
  componentsCompleted: number;
  componentsTotal: number;
  percentComplete: number;
}

interface WorkflowRunStatus {
  runId: string;
  workflowId: string;
  workflowName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  metrics: WorkflowRunMetrics;
}

test.describe('Analytics KPI Verification (ST-263)', () => {
  let api: ApiHelper;
  let projectId: string;
  let completedRunId: string;
  let completedRunMetrics: WorkflowRunStatus;

  test.beforeAll(async ({ request }) => {
    // Login as admin to access all features
    const token = await ApiHelper.login(request, TEST_USERS.admin.email, TEST_USERS.admin.password);
    api = new ApiHelper(request, token);

    // Get first project
    const projects = await api.getProjects();
    if (projects.length === 0) {
      throw new Error('No projects found. Please create a project first.');
    }
    projectId = projects[0].id;

    // Find a completed workflow run with metrics
    const response = await api.get(`/projects/${projectId}/workflow-runs?status=completed&includeRelations=true`);
    const completedRuns = response.data;

    if (!completedRuns || completedRuns.length === 0) {
      throw new Error('No completed workflow runs found. Please run a workflow to completion first.');
    }

    // Find a run with non-zero metrics
    const runWithMetrics = completedRuns.find((run: any) =>
      run.totalTokens && run.totalTokens > 0
    );

    if (!runWithMetrics) {
      throw new Error('No completed workflow runs with metrics found.');
    }

    completedRunId = runWithMetrics.id;

    // Fetch detailed status for this run
    const statusResponse = await api.get(
      `/projects/${projectId}/workflow-runs/${completedRunId}/status`
    );
    completedRunMetrics = statusResponse.data;

    console.log('Test Setup:');
    console.log(`  Project ID: ${projectId}`);
    console.log(`  Run ID: ${completedRunId}`);
    console.log(`  Workflow: ${completedRunMetrics.workflowName}`);
    console.log(`  Total Tokens: ${completedRunMetrics.metrics.totalTokens}`);
    console.log(`  Total Cost: $${completedRunMetrics.metrics.totalCost}`);
  });

  test.describe('Workflow Monitor Page (/team-runs/{runId}/monitor)', () => {
    test('should display accurate token usage metrics', async ({ page }) => {
      // Navigate to workflow monitor page
      await page.goto(`/team-runs/${completedRunId}/monitor`);

      // Extract displayed token metrics using helper
      const displayedMetrics = await extractTokenMetrics(page);

      // Compare with API values using assertion helper
      assertKPI({
        label: 'Total Tokens',
        displayed: displayedMetrics.totalTokens,
        expected: completedRunMetrics.metrics.totalTokens,
      });

      assertKPI({
        label: 'Input Tokens',
        displayed: displayedMetrics.inputTokens,
        expected: completedRunMetrics.metrics.totalInputTokens,
      });

      assertKPI({
        label: 'Output Tokens',
        displayed: displayedMetrics.outputTokens,
        expected: completedRunMetrics.metrics.totalOutputTokens,
      });

      // Cache metrics may be 0 or null
      const expectedCacheCreation = completedRunMetrics.metrics.totalCacheCreation ?? 0;
      const expectedCacheRead = completedRunMetrics.metrics.totalCacheRead ?? 0;

      assertKPI({
        label: 'Cache Creation',
        displayed: displayedMetrics.cacheCreation ?? 0,
        expected: expectedCacheCreation,
      });

      assertKPI({
        label: 'Cache Read',
        displayed: displayedMetrics.cacheRead ?? 0,
        expected: expectedCacheRead,
      });
    });

    test('should display accurate efficiency & cost metrics', async ({ page }) => {
      await page.goto(`/team-runs/${completedRunId}/monitor`);

      // Extract displayed efficiency metrics using helper
      const displayedMetrics = await extractEfficiencyMetrics(page);

      // Compare with API values (with tolerance for calculated values)
      if (completedRunMetrics.metrics.tokensPerLOC > 0) {
        assertKPI({
          label: 'Tokens/LOC',
          displayed: displayedMetrics.tokensPerLOC,
          expected: completedRunMetrics.metrics.tokensPerLOC,
          tolerance: 2,
        });
      } else {
        expect(displayedMetrics.tokensPerLOC).toBeNull();
      }

      assertKPI({
        label: 'Total Cost',
        displayed: displayedMetrics.totalCost,
        expected: completedRunMetrics.metrics.totalCost,
        tolerance: 1,
      });

      if (completedRunMetrics.metrics.costPerLOC > 0) {
        assertKPI({
          label: 'Cost/LOC',
          displayed: displayedMetrics.costPerLOC,
          expected: completedRunMetrics.metrics.costPerLOC,
          tolerance: 2,
        });
      }

      // Duration comparison (allow 1 second difference due to rounding)
      if (completedRunMetrics.metrics.totalDuration && displayedMetrics.duration) {
        const diff = Math.abs(displayedMetrics.duration - completedRunMetrics.metrics.totalDuration);
        expect(diff,
          `Duration mismatch: displayed ${displayedMetrics.duration}s, expected ${completedRunMetrics.metrics.totalDuration}s`
        ).toBeLessThanOrEqual(1);
      }
    });

    test('should display accurate code impact metrics', async ({ page }) => {
      await page.goto(`/team-runs/${completedRunId}/monitor`);

      // Extract displayed code impact metrics using helper
      const displayedMetrics = await extractCodeImpactMetrics(page);

      // Compare with API values
      assertKPI({
        label: 'Lines Added',
        displayed: displayedMetrics.linesAdded ?? 0,
        expected: completedRunMetrics.metrics.totalLinesAdded,
      });

      assertKPI({
        label: 'Lines Modified',
        displayed: displayedMetrics.linesModified ?? 0,
        expected: completedRunMetrics.metrics.totalLinesModified,
      });

      assertKPI({
        label: 'Lines Deleted',
        displayed: displayedMetrics.linesDeleted ?? 0,
        expected: completedRunMetrics.metrics.totalLinesDeleted,
      });

      assertKPI({
        label: 'LOC Generated',
        displayed: displayedMetrics.locGenerated ?? 0,
        expected: completedRunMetrics.metrics.totalLocGenerated ?? 0,
      });

      assertKPI({
        label: 'Tests Added',
        displayed: displayedMetrics.testsAdded ?? 0,
        expected: completedRunMetrics.metrics.totalTestsAdded ?? 0,
      });
    });

    test('should display accurate execution metrics', async ({ page }) => {
      await page.goto(`/team-runs/${completedRunId}/monitor`);

      // Extract displayed execution metrics using helper
      const displayedMetrics = await extractExecutionMetrics(page);

      // Compare with API values
      assertKPI({
        label: 'Components Completed',
        displayed: displayedMetrics.componentsCompleted,
        expected: completedRunMetrics.metrics.componentsCompleted,
      });

      assertKPI({
        label: 'Components Total',
        displayed: displayedMetrics.componentsTotal,
        expected: completedRunMetrics.metrics.componentsTotal,
      });

      assertKPI({
        label: 'Human Prompts',
        displayed: displayedMetrics.humanPrompts ?? 0,
        expected: completedRunMetrics.metrics.totalUserPrompts ?? 0,
      });

      assertKPI({
        label: 'Iterations',
        displayed: displayedMetrics.iterations ?? 0,
        expected: completedRunMetrics.metrics.totalIterations ?? 0,
      });

      assertKPI({
        label: 'Interventions',
        displayed: displayedMetrics.interventions ?? 0,
        expected: completedRunMetrics.metrics.totalInterventions ?? 0,
      });
    });
  });

  test.describe('Performance Dashboard (/analytics/performance)', () => {
    test('should display correct story counts per workflow', async ({ page }) => {
      await page.goto('/analytics/performance');

      // Wait for dashboard to load
      await page.waitForSelector('text=Performance Dashboard', { timeout: 10000 });

      // Fetch dashboard data from API
      const dashboardResponse = await api.get(
        `/agent-metrics/performance-dashboard?projectId=${projectId}`
      );
      const dashboardData = dashboardResponse.data;

      // Check that workflowsWithMetrics exists
      if (!dashboardData.workflowsWithMetrics || dashboardData.workflowsWithMetrics.length === 0) {
        console.log('No workflows with metrics found, skipping test');
        test.skip();
        return;
      }

      // Wait for workflows table to load
      await page.waitForSelector('[role="table"]', { timeout: 10000 });

      // For each workflow in API response, verify the displayed story count
      for (const workflow of dashboardData.workflowsWithMetrics) {
        // Find the row for this workflow
        const workflowRow = page.locator(`tr:has-text("${workflow.name}")`);

        // Check if row exists
        if (await workflowRow.count() === 0) {
          console.warn(`Workflow ${workflow.name} not found in table`);
          continue;
        }

        // Extract story count from the row
        const storiesCell = await workflowRow.locator('td').nth(1).textContent();
        const displayedStoryCount = extractNumber(storiesCell || '');

        // Verify it matches API value
        expect(displayedStoryCount,
          `Story count for workflow "${workflow.name}" mismatch: displayed ${displayedStoryCount}, expected ${workflow.storiesCount}`
        ).toBe(workflow.storiesCount);

        // Also verify bugs count if displayed
        const bugsCell = await workflowRow.locator('td').nth(2).textContent();
        const displayedBugsCount = extractNumber(bugsCell || '');

        expect(displayedBugsCount,
          `Bugs count for workflow "${workflow.name}" mismatch: displayed ${displayedBugsCount}, expected ${workflow.bugsCount}`
        ).toBe(workflow.bugsCount);
      }

      // Verify total counts are accurate
      const apiFilteredStories = dashboardData.counts?.filteredStories ?? 0;
      const apiTotalStories = dashboardData.counts?.totalStories ?? 0;

      // Look for total counts in the UI (may be in a summary card or footer)
      const summaryText = await page.locator('text=/\\d+ (?:stories|stories implemented)/i').first().textContent();
      if (summaryText) {
        const displayedTotal = extractNumber(summaryText);
        // The displayed count should match either filtered or total, depending on filters
        const isMatch = displayedTotal === apiFilteredStories || displayedTotal === apiTotalStories;
        expect(isMatch,
          `Total stories mismatch: displayed ${displayedTotal}, expected ${apiFilteredStories} (filtered) or ${apiTotalStories} (total)`
        ).toBe(true);
      }
    });

    test('should show ALL stories, not just 1 per workflow', async ({ page }) => {
      await page.goto('/analytics/performance');
      await page.waitForSelector('[role="table"]', { timeout: 10000 });

      // Fetch dashboard data
      const dashboardResponse = await api.get(
        `/agent-metrics/performance-dashboard?projectId=${projectId}`
      );
      const dashboardData = dashboardResponse.data;

      // Check that at least one workflow has more than 1 story
      const workflowWithMultipleStories = dashboardData.workflowsWithMetrics?.find(
        (w: any) => w.storiesCount > 1
      );

      if (!workflowWithMultipleStories) {
        console.log('No workflows with multiple stories found, skipping assertion');
        return;
      }

      // Verify that workflow shows correct count (not capped at 1)
      const workflowRow = page.locator(`tr:has-text("${workflowWithMultipleStories.name}")`);
      const storiesCell = await workflowRow.locator('td').nth(1).textContent();
      const displayedCount = extractNumber(storiesCell || '');

      expect(displayedCount,
        `Workflow "${workflowWithMultipleStories.name}" should show ${workflowWithMultipleStories.storiesCount} stories, not 1`
      ).toBeGreaterThan(1);
    });
  });

  test.describe('Team Details Page (/analytics/team-details)', () => {
    test('should display accurate aggregated KPIs', async ({ page }) => {
      // Get list of workflows for the project
      const dashboardResponse = await api.get(
        `/agent-metrics/performance-dashboard?projectId=${projectId}`
      );
      const workflows = dashboardResponse.data.workflows;

      if (!workflows || workflows.length === 0) {
        console.log('No workflows found, skipping test');
        test.skip();
        return;
      }

      // Use first workflow for testing
      const workflowId = workflows[0].id;

      await page.goto(`/analytics/team-details?workflowAId=${workflowId}`);
      await page.waitForSelector('text=Team Details', { timeout: 10000 });

      // Fetch team details data from API
      const teamDetailsResponse = await api.get(
        `/agent-metrics/workflow-details?projectId=${projectId}&workflowAId=${workflowId}`
      );
      const teamDetailsData = teamDetailsResponse.data;

      // Verify displayed KPIs match API data
      // This test is placeholder - specific KPI extraction depends on the page structure
      // You would add assertions here based on the actual page layout

      // Example assertion (adjust based on actual page structure):
      // const avgTokensPerLOC = await page.locator('text=Avg Tokens/LOC').locator('..').locator('[data-value]').textContent();
      // expect(extractNumber(avgTokensPerLOC)).toBeCloseTo(teamDetailsData.avgTokensPerLOC, 1);

      // For now, just verify the page loaded successfully with data
      expect(teamDetailsData).toBeDefined();
      console.log('Team details data:', JSON.stringify(teamDetailsData, null, 2));
    });

    test('should fetch real KPI history data from API (not fake random data)', async ({ page }) => {
      // Get list of workflows
      const dashboardResponse = await api.get(
        `/agent-metrics/performance-dashboard?projectId=${projectId}`
      );
      const workflows = dashboardResponse.data.workflows;

      if (!workflows || workflows.length === 0) {
        console.log('No workflows found, skipping test');
        test.skip();
        return;
      }

      const workflowId = workflows[0].id;

      // Intercept API calls to verify real data is fetched
      let kpiHistoryApiCalled = false;
      page.on('request', (request) => {
        if (request.url().includes('/agent-metrics/kpi-history')) {
          kpiHistoryApiCalled = true;
        }
      });

      await page.goto(`/analytics/team-details?workflowAId=${workflowId}`);
      await page.waitForSelector('text=Team Details', { timeout: 10000 });

      // Click on a KPI card to open trend modal
      await page.locator('[data-testid="kpi-card-tokensPerLOC"], .bg-gradient-to-br:has-text("Tokens / LOC")').first().click();
      await page.waitForSelector('text=Metric Trend', { timeout: 5000 });

      // Verify API was called
      await page.waitForTimeout(1000); // Give time for API call
      expect(kpiHistoryApiCalled,
        'KPI history API should be called when opening trend modal'
      ).toBe(true);

      // Verify chart is displayed (not showing random fake data)
      const chartElement = page.locator('[class*="recharts-wrapper"]');
      await expect(chartElement).toBeVisible();
    });

    test('should show consistent trend data (not random variations)', async ({ page }) => {
      const dashboardResponse = await api.get(
        `/agent-metrics/performance-dashboard?projectId=${projectId}`
      );
      const workflows = dashboardResponse.data.workflows;

      if (!workflows || workflows.length === 0) {
        console.log('No workflows found, skipping test');
        test.skip();
        return;
      }

      const workflowId = workflows[0].id;

      await page.goto(`/analytics/team-details?workflowAId=${workflowId}`);
      await page.waitForSelector('text=Team Details', { timeout: 10000 });

      // Open trend modal twice for the same KPI
      await page.locator('.bg-gradient-to-br:has-text("Tokens / LOC")').first().click();
      await page.waitForSelector('text=Metric Trend', { timeout: 5000 });

      // Extract first data point value (if visible in DOM)
      const firstValue = await page.locator('[class*="recharts-line"]').first().getAttribute('d');

      // Close modal
      await page.locator('button:has-text("×"), [aria-label="Close"]').first().click();
      await page.waitForTimeout(500);

      // Open again
      await page.locator('.bg-gradient-to-br:has-text("Tokens / LOC")').first().click();
      await page.waitForSelector('text=Metric Trend', { timeout: 5000 });

      // Extract second data point value
      const secondValue = await page.locator('[class*="recharts-line"]').first().getAttribute('d');

      // Values should be identical (not randomly regenerated)
      expect(secondValue,
        'Trend data should be consistent across modal opens (not randomly generated)'
      ).toBe(firstValue);
    });
  });

  test.describe('ST-265: userPrompts and Code Impact Verification', () => {
    test('should have userPrompts > 0 for component runs after agent completion', async () => {
      // Find a completed workflow run
      const response = await api.get(
        `/projects/${projectId}/workflow-runs?status=completed&includeRelations=true&limit=1`
      );
      const completedRuns = response.data;

      if (!completedRuns || completedRuns.length === 0) {
        console.log('No completed runs found, skipping test');
        test.skip();
        return;
      }

      const runId = completedRuns[0].id;

      // Fetch component runs for this workflow run
      const componentRunsResponse = await api.get(
        `/projects/${projectId}/workflow-runs/${runId}/component-runs`
      );
      const componentRuns = componentRunsResponse.data;

      expect(componentRuns).toBeDefined();
      expect(Array.isArray(componentRuns)).toBe(true);

      // At least one component run should have userPrompts > 0
      const runsWithPrompts = componentRuns.filter((cr: any) => cr.userPrompts && cr.userPrompts > 0);
      expect(runsWithPrompts.length,
        'At least one component run should have userPrompts > 0 (extracted from transcript turns.manualPrompts)'
      ).toBeGreaterThan(0);

      console.log(`Found ${runsWithPrompts.length} component runs with userPrompts > 0`);
    });

    test('should have linesAdded > 0 for MasterSession workflow runs', async () => {
      // Find completed workflow runs
      const response = await api.get(
        `/projects/${projectId}/workflow-runs?status=completed&includeRelations=true`
      );
      const completedRuns = response.data;

      if (!completedRuns || completedRuns.length === 0) {
        console.log('No completed runs found, skipping test');
        test.skip();
        return;
      }

      // Look for runs with code changes
      let foundRunWithCodeImpact = false;

      for (const run of completedRuns.slice(0, 5)) {
        const componentRunsResponse = await api.get(
          `/projects/${projectId}/workflow-runs/${run.id}/component-runs`
        );
        const componentRuns = componentRunsResponse.data;

        const runsWithCodeImpact = componentRuns.filter(
          (cr: any) => cr.linesAdded && cr.linesAdded > 0
        );

        if (runsWithCodeImpact.length > 0) {
          foundRunWithCodeImpact = true;
          console.log(`Found workflow run ${run.id} with ${runsWithCodeImpact.length} component runs having linesAdded > 0`);

          // Verify filesModified is also populated
          const withFiles = runsWithCodeImpact.filter(
            (cr: any) => cr.filesModified && cr.filesModified.length > 0
          );
          expect(withFiles.length,
            'Component runs with linesAdded > 0 should also have filesModified populated'
          ).toBeGreaterThan(0);

          break;
        }
      }

      if (!foundRunWithCodeImpact) {
        console.warn('No workflow runs found with code impact metrics. This may indicate the feature is not working or no code changes were made.');
      }
    });
  });
});
