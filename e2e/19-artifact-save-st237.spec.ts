/**
 * ST-237: E2E test for artifact save functionality
 * Verifies the artifact editor save button works in production
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.FRONTEND_URL || 'https://vibestudio.example.com';
const API_URL = process.env.API_URL || 'https://vibestudio.example.com/api';

test.describe('ST-237: Artifact Editor Save Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@aistudio.local');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|projects|workflows)/);
  });

  test('should show Edit tab and Save button in artifact viewer modal', async ({ page }) => {
    // Navigate to workflows page
    await page.goto(`${BASE_URL}/workflows`);
    await page.waitForLoadState('networkidle');

    // Find a completed workflow run to view artifacts
    const workflowRunLink = page.locator('a[href*="/workflow-runs/"]').first();
    
    if (await workflowRunLink.count() === 0) {
      test.skip('No workflow runs available to test');
      return;
    }

    await workflowRunLink.click();
    await page.waitForLoadState('networkidle');

    // Switch to Artifacts tab
    const artifactsTab = page.getByRole('tab', { name: /artifacts/i });
    if (await artifactsTab.count() > 0) {
      await artifactsTab.click();
      await page.waitForTimeout(1000);
    }

    // Find an artifact to view
    const viewButton = page.getByRole('button', { name: /view/i }).first();
    
    if (await viewButton.count() === 0) {
      test.skip('No artifacts available to test');
      return;
    }

    await viewButton.click();
    await page.waitForTimeout(500);

    // Verify modal opened with View and Edit tabs
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const viewTab = modal.getByRole('tab', { name: /view/i });
    const editTab = modal.getByRole('tab', { name: /edit/i });

    await expect(viewTab).toBeVisible();
    await expect(editTab).toBeVisible();

    // Click Edit tab
    await editTab.click();
    await page.waitForTimeout(300);

    // Verify Save button is visible in edit mode
    const saveButton = modal.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeVisible();
  });

  test('API endpoint should accept PUT request for artifact update', async ({ request }) => {
    // Get auth token
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'admin@aistudio.local',
        password: 'admin123',
      },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const { accessToken } = await loginResponse.json();

    // Get a project to test with
    const projectsResponse = await request.get(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(projectsResponse.ok()).toBeTruthy();
    const projects = await projectsResponse.json();
    
    if (projects.length === 0) {
      test.skip('No projects available to test');
      return;
    }

    const projectId = projects[0].id;

    // Get workflow runs for this project
    const runsResponse = await request.get(`${API_URL}/projects/${projectId}/workflow-runs`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(runsResponse.ok()).toBeTruthy();
    const runs = await runsResponse.json();

    if (runs.length === 0) {
      test.skip('No workflow runs available to test');
      return;
    }

    const runId = runs[0].id;

    // Get artifacts for this run
    const artifactsResponse = await request.get(
      `${API_URL}/projects/${projectId}/workflow-runs/${runId}/artifacts`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    expect(artifactsResponse.ok()).toBeTruthy();
    const artifacts = await artifactsResponse.json();

    if (artifacts.length === 0) {
      test.skip('No artifacts available to test');
      return;
    }

    const artifact = artifacts[0];

    // Test the PUT endpoint with the same content (should be skipped due to hash match)
    const updateResponse = await request.put(
      `${API_URL}/projects/${projectId}/workflow-runs/${runId}/artifacts/${artifact.id}`,
      {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          content: artifact.content || artifact.contentPreview || 'Test content',
        },
      }
    );

    expect(updateResponse.ok()).toBeTruthy();
    const result = await updateResponse.json();
    
    // Should have artifact info in response
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('definitionKey');
  });
});
