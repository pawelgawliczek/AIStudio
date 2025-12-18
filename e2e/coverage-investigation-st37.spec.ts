/**
 * Coverage Investigation Test for ST-37
 *
 * This test captures coverage data from all layers:
 * 1. Frontend UI (what users see)
 * 2. API responses (backend data)
 * 3. Database values (source of truth)
 *
 * Purpose: Identify where coverage percentage mismatch occurs
 */

import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@playwright/test';

const TEST_PROJECT_ID = '345a29ee-d6ab-477d-8079-c5dda0844d77';
const BASE_URL = 'https://vibestudio.example.com';
const API_BASE_URL = 'https://vibestudio.example.com/api';

interface CoverageReport {
  timestamp: string;
  frontend: {
    overview_tab: {
      coverage_percentage: number | null;
      screenshot_path: string;
      raw_text: string;
    };
    test_coverage_tab: {
      coverage_percentage: number | null;
      total_tests: number | null;
      passing_tests: number | null;
      screenshot_path: string;
      raw_text: string;
    };
  };
  api: {
    project_metrics: any;
    test_summary: any;
  };
  database: {
    note: string;
  };
  analysis: {
    mismatch_detected: boolean;
    mismatch_details: string;
    recommendations: string[];
  };
}

test.describe('ST-37: Coverage Investigation - Full Stack Analysis', () => {
  let report: CoverageReport;

  test.beforeAll(async () => {
    // Initialize report
    report = {
      timestamp: new Date().toISOString(),
      frontend: {
        overview_tab: {
          coverage_percentage: null,
          screenshot_path: '',
          raw_text: ''
        },
        test_coverage_tab: {
          coverage_percentage: null,
          total_tests: null,
          passing_tests: null,
          screenshot_path: '',
          raw_text: ''
        }
      },
      api: {
        project_metrics: null,
        test_summary: null
      },
      database: {
        note: 'Database queries should be run manually or via separate script'
      },
      analysis: {
        mismatch_detected: false,
        mismatch_details: '',
        recommendations: []
      }
    };

    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(process.cwd(), 'screenshots', 'coverage-investigation');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Layer 1: Capture Frontend Coverage Display - Overview Tab', async ({ page }) => {
    console.log('\n========================================');
    console.log('LAYER 1: FRONTEND - OVERVIEW TAB');
    console.log('========================================\n');

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/projects/${TEST_PROJECT_ID}/code-quality`);
    await page.waitForSelector('[data-testid="code-quality-dashboard"]', { timeout: 10000 });

    // Click Overview tab (should be default, but let's be explicit)
    const overviewTab = page.locator('text=Overview').first();
    if (await overviewTab.count() > 0) {
      await overviewTab.click();
      await page.waitForTimeout(1000); // Wait for tab content to render
    }

    // Take full screenshot
    const screenshotPath = 'screenshots/coverage-investigation/overview-tab-full.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    report.frontend.overview_tab.screenshot_path = screenshotPath;

    // Try multiple selectors to find coverage percentage in Overview tab
    const coverageSelectors = [
      'text=/\\d+\\.?\\d*%.*coverage/i',
      '[data-testid*="coverage"]',
      'text=/coverage.*\\d+\\.?\\d*%/i',
      '.MuiCard-root:has-text("Coverage")',
      '.metric-card:has-text("Coverage")'
    ];

    let foundCoverage = false;
    for (const selector of coverageSelectors) {
      try {
        const coverageElement = page.locator(selector).first();
        if (await coverageElement.count() > 0) {
          await coverageElement.waitFor({ state: 'visible', timeout: 2000 });
          const coverageText = await coverageElement.textContent();
          report.frontend.overview_tab.raw_text = coverageText || '';

          // Extract percentage
          const coverageMatch = coverageText?.match(/(\d+\.?\d*)\s*%/);
          if (coverageMatch) {
            report.frontend.overview_tab.coverage_percentage = parseFloat(coverageMatch[1]);
            foundCoverage = true;
            console.log(`✓ Found coverage in Overview tab: ${coverageMatch[1]}%`);
            console.log(`  Selector: ${selector}`);
            console.log(`  Raw text: "${coverageText}"`);
            break;
          }
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }

    if (!foundCoverage) {
      console.log('✗ No coverage percentage found in Overview tab');
      // Capture all text content for debugging
      const bodyText = await page.locator('body').textContent();
      console.log('Page content sample:', bodyText?.substring(0, 500));
    }

    // Take screenshot of specific coverage section if found
    if (foundCoverage) {
      const coverageCard = page.locator('.MuiCard-root:has-text("Coverage")').first();
      if (await coverageCard.count() > 0) {
        await coverageCard.screenshot({
          path: 'screenshots/coverage-investigation/overview-coverage-card.png'
        });
      }
    }
  });

  test('Layer 1: Capture Frontend Coverage Display - Test Coverage Tab', async ({ page }) => {
    console.log('\n========================================');
    console.log('LAYER 1: FRONTEND - TEST COVERAGE TAB');
    console.log('========================================\n');

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/projects/${TEST_PROJECT_ID}/code-quality`);
    await page.waitForSelector('[data-testid="code-quality-dashboard"]', { timeout: 10000 });

    // Click Test Coverage tab
    await page.click('text=Test Coverage');
    await page.waitForSelector('[data-testid="test-coverage-tab"]', { timeout: 5000 });

    // Take full screenshot
    const screenshotPath = 'screenshots/coverage-investigation/test-coverage-tab-full.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    report.frontend.test_coverage_tab.screenshot_path = screenshotPath;

    // Extract total tests
    try {
      const totalTestsElement = page.locator('[data-testid="total-tests"]').first();
      await totalTestsElement.waitFor({ state: 'visible', timeout: 5000 });
      const totalTestsText = await totalTestsElement.textContent();
      const totalTests = parseInt(totalTestsText?.replace(/\D/g, '') || '0');
      report.frontend.test_coverage_tab.total_tests = totalTests;
      console.log(`✓ Total tests: ${totalTests}`);
    } catch (e) {
      console.log('✗ Could not find total tests element');
    }

    // Extract passing tests
    try {
      const passingElement = page.locator('text=/\\d+ passing/i').first();
      await passingElement.waitFor({ state: 'visible', timeout: 5000 });
      const passingText = await passingElement.textContent();
      const passingMatch = passingText?.match(/(\d+)/);
      const passingTests = parseInt(passingMatch?.[1] || '0');
      report.frontend.test_coverage_tab.passing_tests = passingTests;
      console.log(`✓ Passing tests: ${passingTests}`);
    } catch (e) {
      console.log('✗ Could not find passing tests element');
    }

    // Extract coverage percentage from Test Coverage tab
    try {
      const coverageElement = page.locator('text=/\\d+\\.?\\d*%.*coverage/i').first();
      await coverageElement.waitFor({ state: 'visible', timeout: 5000 });
      const coverageText = await coverageElement.textContent();
      report.frontend.test_coverage_tab.raw_text = coverageText || '';

      const coverageMatch = coverageText?.match(/(\d+\.?\d*)\s*%/);
      if (coverageMatch) {
        report.frontend.test_coverage_tab.coverage_percentage = parseFloat(coverageMatch[1]);
        console.log(`✓ Coverage percentage: ${coverageMatch[1]}%`);
        console.log(`  Raw text: "${coverageText}"`);
      }
    } catch (e) {
      console.log('✗ Could not find coverage percentage in Test Coverage tab');
    }

    // Take screenshot of metrics section
    const metricsSection = page.locator('[data-testid="test-metrics"]').first();
    if (await metricsSection.count() > 0) {
      await metricsSection.screenshot({
        path: 'screenshots/coverage-investigation/test-metrics-section.png'
      });
    }
  });

  test('Layer 2: Capture API Response - Project Metrics', async ({ request }) => {
    console.log('\n========================================');
    console.log('LAYER 2: API - PROJECT METRICS');
    console.log('========================================\n');

    try {
      const response = await request.get(`${API_BASE_URL}/code-metrics/project/${TEST_PROJECT_ID}`);

      console.log(`Status: ${response.status()}`);

      if (response.ok()) {
        const data = await response.json();
        report.api.project_metrics = data;

        console.log('✓ Project Metrics Response:');
        console.log(JSON.stringify(data, null, 2));

        // Extract coverage from response
        if (data.overview) {
          console.log('\nOverview metrics:');
          console.log(`  Coverage: ${data.overview.coverage}%`);
          console.log(`  Health Score: ${data.overview.healthScore}`);
        }

        if (data.testMetrics) {
          console.log('\nTest metrics:');
          console.log(`  Total tests: ${data.testMetrics.total}`);
          console.log(`  Passing: ${data.testMetrics.passing}`);
          console.log(`  Coverage: ${data.testMetrics.coverage}%`);
        }
      } else {
        console.log(`✗ API request failed with status ${response.status()}`);
        const text = await response.text();
        console.log(`Response: ${text}`);
      }
    } catch (e) {
      console.log(`✗ API request error: ${e}`);
    }
  });

  test('Layer 2: Capture API Response - Test Summary', async ({ request }) => {
    console.log('\n========================================');
    console.log('LAYER 2: API - TEST SUMMARY');
    console.log('========================================\n');

    try {
      const response = await request.get(`${API_BASE_URL}/code-metrics/project/${TEST_PROJECT_ID}/test-summary`);

      console.log(`Status: ${response.status()}`);

      if (response.ok()) {
        const data = await response.json();
        report.api.test_summary = data;

        console.log('✓ Test Summary Response:');
        console.log(JSON.stringify(data, null, 2));

        // Extract coverage from response
        if (data.coverage !== undefined) {
          console.log(`\nTest Coverage: ${data.coverage}%`);
        }
        if (data.totalTests !== undefined) {
          console.log(`Total Tests: ${data.totalTests}`);
        }
        if (data.passingTests !== undefined) {
          console.log(`Passing Tests: ${data.passingTests}`);
        }
      } else {
        console.log(`✗ API request failed with status ${response.status()}`);
        const text = await response.text();
        console.log(`Response: ${text}`);
      }
    } catch (e) {
      console.log(`✗ API request error: ${e}`);
    }
  });

  test('Final Analysis: Generate Coverage Investigation Report', async ({}) => {
    console.log('\n========================================');
    console.log('FINAL ANALYSIS');
    console.log('========================================\n');

    // Compare values across layers
    const frontendOverview = report.frontend.overview_tab.coverage_percentage;
    const frontendTestCoverage = report.frontend.test_coverage_tab.coverage_percentage;
    const apiProjectMetrics = report.api.project_metrics?.overview?.coverage ||
                              report.api.project_metrics?.testMetrics?.coverage;
    const apiTestSummary = report.api.test_summary?.coverage;

    console.log('Coverage Values Comparison:');
    console.log('----------------------------');
    console.log(`Frontend (Overview Tab):      ${frontendOverview !== null ? frontendOverview + '%' : 'NOT FOUND'}`);
    console.log(`Frontend (Test Coverage Tab): ${frontendTestCoverage !== null ? frontendTestCoverage + '%' : 'NOT FOUND'}`);
    console.log(`API (Project Metrics):        ${apiProjectMetrics !== undefined ? apiProjectMetrics + '%' : 'NOT FOUND'}`);
    console.log(`API (Test Summary):           ${apiTestSummary !== undefined ? apiTestSummary + '%' : 'NOT FOUND'}`);

    // Detect mismatches
    const allValues = [frontendOverview, frontendTestCoverage, apiProjectMetrics, apiTestSummary]
      .filter(v => v !== null && v !== undefined);

    if (allValues.length > 1) {
      const min = Math.min(...allValues);
      const max = Math.max(...allValues);

      if (max - min > 0.1) { // Allow for floating point differences
        report.analysis.mismatch_detected = true;
        report.analysis.mismatch_details = `Coverage values range from ${min}% to ${max}% (difference: ${(max - min).toFixed(2)}%)`;

        console.log('\n⚠️  MISMATCH DETECTED!');
        console.log(report.analysis.mismatch_details);

        // Determine recommendations
        if (frontendOverview !== apiProjectMetrics) {
          report.analysis.recommendations.push(
            'Frontend Overview tab shows different value than API - check component data mapping'
          );
        }
        if (frontendTestCoverage !== apiTestSummary) {
          report.analysis.recommendations.push(
            'Frontend Test Coverage tab shows different value than API - check test summary data mapping'
          );
        }
        if (apiProjectMetrics !== apiTestSummary) {
          report.analysis.recommendations.push(
            'API endpoints return different values - check backend data aggregation logic'
          );
        }
      } else {
        console.log('\n✓ All values are consistent');
      }
    }

    // Additional diagnostics
    console.log('\nTest Metrics:');
    console.log('-------------');
    console.log(`Total Tests (Frontend): ${report.frontend.test_coverage_tab.total_tests}`);
    console.log(`Passing Tests (Frontend): ${report.frontend.test_coverage_tab.passing_tests}`);
    console.log(`Total Tests (API): ${report.api.test_summary?.totalTests || 'N/A'}`);
    console.log(`Passing Tests (API): ${report.api.test_summary?.passingTests || 'N/A'}`);

    // Write report to file
    const reportPath = path.join(process.cwd(), 'screenshots', 'coverage-investigation', 'coverage-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✓ Full report saved to: ${reportPath}`);

    // Print recommendations
    if (report.analysis.recommendations.length > 0) {
      console.log('\nRecommendations:');
      console.log('----------------');
      report.analysis.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

    console.log('\n========================================');
    console.log('Investigation Complete!');
    console.log('========================================\n');
  });
});
