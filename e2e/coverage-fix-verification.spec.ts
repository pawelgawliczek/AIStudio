/**
 * E2E Test: Coverage Fix Verification for ST-37
 *
 * **CRITICAL TEST**: Verify that the coverage fix is working correctly
 *
 * This test validates that the backend API now returns the correct coverage
 * percentage (11.88%) instead of the incorrect 5% that was being calculated.
 *
 * **Expected Result:** API returns ~11.88% coverage (within 0.5% tolerance)
 * **Failure Scenario:** API returns ~5% coverage (old bug)
 *
 * Test runs against: https://vibestudio.example.com
 *
 * Root Cause: The backend was calculating coverage incorrectly by dividing
 * passing tests by total tests instead of using actual code coverage data.
 * The fix implemented proper coverage calculation from coverage.json files.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_PROJECT_ID = '345a29ee-d6ab-477d-8079-c5dda0844d77';
const API_BASE_URL = 'https://vibestudio.example.com/api';
const EXPECTED_COVERAGE = 11.88;
const TOLERANCE = 0.5; // Allow 0.5% variance for rounding differences
const OLD_BUGGY_COVERAGE = 5.0;

interface VerificationReport {
  timestamp: string;
  test_results: {
    project_metrics: {
      status: number;
      coverage_value: number | null;
      expected: number;
      pass: boolean;
      error?: string;
    };
    test_summary: {
      status: number;
      coverage_value: number | null;
      expected: number;
      pass: boolean;
      error?: string;
    };
  };
  overall_result: {
    all_tests_passed: boolean;
    coverage_fixed: boolean;
    summary: string;
  };
}

test.describe('Coverage Fix Verification - ST-37', () => {
  let report: VerificationReport;

  test.beforeAll(() => {
    // Initialize report
    report = {
      timestamp: new Date().toISOString(),
      test_results: {
        project_metrics: {
          status: 0,
          coverage_value: null,
          expected: EXPECTED_COVERAGE,
          pass: false
        },
        test_summary: {
          status: 0,
          coverage_value: null,
          expected: EXPECTED_COVERAGE,
          pass: false
        }
      },
      overall_result: {
        all_tests_passed: false,
        coverage_fixed: false,
        summary: ''
      }
    };

    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(process.cwd(), 'screenshots', 'coverage-fix-verification');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('CRITICAL: Project Metrics API returns correct coverage (11.88%, not 5%)', async ({ request }) => {
    console.log('\n========================================');
    console.log('TEST 1: Project Metrics API Endpoint');
    console.log('========================================\n');

    const endpoint = `${API_BASE_URL}/code-metrics/project/${TEST_PROJECT_ID}`;
    console.log(`Endpoint: ${endpoint}`);

    try {
      const response = await request.get(endpoint);
      const status = response.status();
      report.test_results.project_metrics.status = status;

      console.log(`Status: ${status}`);

      if (!response.ok()) {
        const text = await response.text();
        report.test_results.project_metrics.error = `HTTP ${status}: ${text}`;
        console.log(`✗ API request failed: ${text}`);
        throw new Error(`API returned status ${status}`);
      }

      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));

      // Extract coverage from various possible locations in response
      let coverage: number | null = null;

      if (data.overview?.coverage !== undefined) {
        coverage = parseFloat(data.overview.coverage);
        console.log(`\n✓ Found coverage in overview: ${coverage}%`);
      } else if (data.testMetrics?.coverage !== undefined) {
        coverage = parseFloat(data.testMetrics.coverage);
        console.log(`\n✓ Found coverage in testMetrics: ${coverage}%`);
      } else if (data.coverage !== undefined) {
        coverage = parseFloat(data.coverage);
        console.log(`\n✓ Found coverage in root: ${coverage}%`);
      }

      report.test_results.project_metrics.coverage_value = coverage;

      // Assertions
      expect(coverage, 'Coverage should be present in API response').not.toBeNull();

      console.log(`\nExpected: ${EXPECTED_COVERAGE}% (±${TOLERANCE}%)`);
      console.log(`Actual: ${coverage}%`);

      // Check that coverage is NOT the old buggy value
      const isOldBuggyValue = Math.abs((coverage || 0) - OLD_BUGGY_COVERAGE) < 0.1;
      expect(
        isOldBuggyValue,
        `Coverage should NOT be the old buggy value of ${OLD_BUGGY_COVERAGE}%`
      ).toBe(false);

      if (isOldBuggyValue) {
        console.log(`\n✗ FAILED: Still showing old buggy coverage of ${OLD_BUGGY_COVERAGE}%`);
        console.log('The backend fix has NOT been deployed or is not working!');
        report.test_results.project_metrics.pass = false;
      } else {
        // Check that coverage is within expected range
        const difference = Math.abs((coverage || 0) - EXPECTED_COVERAGE);
        const isCorrect = difference <= TOLERANCE;

        expect(
          coverage,
          `Coverage should be approximately ${EXPECTED_COVERAGE}% (within ±${TOLERANCE}%)`
        ).toBeGreaterThanOrEqual(EXPECTED_COVERAGE - TOLERANCE);

        expect(
          coverage,
          `Coverage should be approximately ${EXPECTED_COVERAGE}% (within ±${TOLERANCE}%)`
        ).toBeLessThanOrEqual(EXPECTED_COVERAGE + TOLERANCE);

        console.log(`\n✅ PASSED: Coverage is ${coverage}% (expected ${EXPECTED_COVERAGE}% ±${TOLERANCE}%)`);
        console.log('The backend fix is working correctly!');
        report.test_results.project_metrics.pass = true;
      }

    } catch (error) {
      report.test_results.project_metrics.error = String(error);
      console.log(`\n✗ Test failed with error: ${error}`);
      throw error;
    }
  });

  test('CRITICAL: Test Summary API returns correct coverage (11.88%, not 5%)', async ({ request }) => {
    console.log('\n========================================');
    console.log('TEST 2: Test Summary API Endpoint');
    console.log('========================================\n');

    const endpoint = `${API_BASE_URL}/code-metrics/project/${TEST_PROJECT_ID}/test-summary`;
    console.log(`Endpoint: ${endpoint}`);

    try {
      const response = await request.get(endpoint);
      const status = response.status();
      report.test_results.test_summary.status = status;

      console.log(`Status: ${status}`);

      if (!response.ok()) {
        const text = await response.text();
        report.test_results.test_summary.error = `HTTP ${status}: ${text}`;
        console.log(`✗ API request failed: ${text}`);
        throw new Error(`API returned status ${status}`);
      }

      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));

      // Extract coverage
      const coverage = data.coverage !== undefined ? parseFloat(data.coverage) : null;
      report.test_results.test_summary.coverage_value = coverage;

      console.log(`\n✓ Coverage from test-summary: ${coverage}%`);

      // Assertions
      expect(coverage, 'Coverage should be present in API response').not.toBeNull();

      console.log(`\nExpected: ${EXPECTED_COVERAGE}% (±${TOLERANCE}%)`);
      console.log(`Actual: ${coverage}%`);

      // Check that coverage is NOT the old buggy value
      const isOldBuggyValue = Math.abs((coverage || 0) - OLD_BUGGY_COVERAGE) < 0.1;
      expect(
        isOldBuggyValue,
        `Coverage should NOT be the old buggy value of ${OLD_BUGGY_COVERAGE}%`
      ).toBe(false);

      if (isOldBuggyValue) {
        console.log(`\n✗ FAILED: Still showing old buggy coverage of ${OLD_BUGGY_COVERAGE}%`);
        console.log('The backend fix has NOT been deployed or is not working!');
        report.test_results.test_summary.pass = false;
      } else {
        // Check that coverage is within expected range
        const difference = Math.abs((coverage || 0) - EXPECTED_COVERAGE);
        const isCorrect = difference <= TOLERANCE;

        expect(
          coverage,
          `Coverage should be approximately ${EXPECTED_COVERAGE}% (within ±${TOLERANCE}%)`
        ).toBeGreaterThanOrEqual(EXPECTED_COVERAGE - TOLERANCE);

        expect(
          coverage,
          `Coverage should be approximately ${EXPECTED_COVERAGE}% (within ±${TOLERANCE}%)`
        ).toBeLessThanOrEqual(EXPECTED_COVERAGE + TOLERANCE);

        console.log(`\n✅ PASSED: Coverage is ${coverage}% (expected ${EXPECTED_COVERAGE}% ±${TOLERANCE}%)`);
        console.log('The backend fix is working correctly!');
        report.test_results.test_summary.pass = true;
      }

    } catch (error) {
      report.test_results.test_summary.error = String(error);
      console.log(`\n✗ Test failed with error: ${error}`);
      throw error;
    }
  });

  test('REPORT: Generate verification summary', async () => {
    console.log('\n========================================');
    console.log('VERIFICATION SUMMARY');
    console.log('========================================\n');

    const projectMetricsPassed = report.test_results.project_metrics.pass;
    const testSummaryPassed = report.test_results.test_summary.pass;
    const allPassed = projectMetricsPassed && testSummaryPassed;

    report.overall_result.all_tests_passed = allPassed;
    report.overall_result.coverage_fixed = allPassed;

    console.log('Test Results:');
    console.log('-------------');
    console.log(`Project Metrics API: ${projectMetricsPassed ? '✅ PASS' : '✗ FAIL'}`);
    console.log(`  Coverage: ${report.test_results.project_metrics.coverage_value}%`);
    console.log(`  Expected: ${EXPECTED_COVERAGE}% (±${TOLERANCE}%)`);

    console.log(`\nTest Summary API: ${testSummaryPassed ? '✅ PASS' : '✗ FAIL'}`);
    console.log(`  Coverage: ${report.test_results.test_summary.coverage_value}%`);
    console.log(`  Expected: ${EXPECTED_COVERAGE}% (±${TOLERANCE}%)`);

    console.log('\n========================================');
    if (allPassed) {
      report.overall_result.summary = '✅ ALL TESTS PASSED - Coverage fix is working correctly!';
      console.log(report.overall_result.summary);
      console.log('Both API endpoints now return the correct coverage percentage.');
      console.log('The backend has been successfully deployed with the fix.');
    } else {
      report.overall_result.summary = '✗ TESTS FAILED - Coverage fix is NOT working';
      console.log(report.overall_result.summary);
      console.log('\nPossible issues:');
      console.log('1. Backend was not redeployed');
      console.log('2. Wrong backend service is running');
      console.log('3. Fix was not merged to deployed branch');
      console.log('4. Cache issues on backend');
    }
    console.log('========================================\n');

    // Write report to file
    const reportPath = path.join(
      process.cwd(),
      'screenshots',
      'coverage-fix-verification',
      'verification-report.json'
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✓ Report saved to: ${reportPath}\n`);

    // Assert overall result
    expect(allPassed, 'All coverage verification tests must pass').toBe(true);
  });
});
