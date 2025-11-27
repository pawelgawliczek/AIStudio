#!/usr/bin/env ts-node

/**
 * Test Results Reporter Script
 *
 * Reads JSON test results from test-results/ directory and reports them
 * to the backend API for storage and WebSocket notifications.
 *
 * Usage: npm run report:tests
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const TEST_RESULTS_DIR = path.join(__dirname, '../test-results');
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const PROJECT_ID = process.env.PROJECT_ID || '345a29ee-d6ab-477d-8079-c5dda0844d77'; // Default to AIStudio project

interface TestResult {
  testCaseKey: string;
  testCaseTitle: string;
  testLevel: 'unit' | 'integration' | 'e2e';
  status: 'pass' | 'fail' | 'skip' | 'error';
  durationMs: number;
  errorMessage?: string;
  environment: string;
}

/**
 * Main execution
 */
async function main() {
  console.log('📊 Test Results Reporter');
  console.log('========================\n');

  // Check if test-results directory exists
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    console.log('⚠️  No test-results directory found. Creating...');
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
    console.log('✅ Created test-results directory\n');
    console.log('ℹ️  Run tests first to generate results.');
    return;
  }

  const files = fs.readdirSync(TEST_RESULTS_DIR);
  console.log(`Found ${files.length} files in test-results/\n`);

  let totalReported = 0;

  // Process Jest unit tests
  const unitResultsFile = path.join(TEST_RESULTS_DIR, 'jest-unit-results.json');
  if (fs.existsSync(unitResultsFile)) {
    console.log('📝 Processing Jest unit tests...');
    const results = await parseJestResults(unitResultsFile, 'unit');
    const reported = await reportResults(results);
    totalReported += reported;
    console.log(`  ✅ Reported ${reported} unit test results\n`);
  }

  // Process Jest integration tests
  const integrationResultsFile = path.join(TEST_RESULTS_DIR, 'jest-integration-results.json');
  if (fs.existsSync(integrationResultsFile)) {
    console.log('📝 Processing Jest integration tests...');
    const results = await parseJestResults(integrationResultsFile, 'integration');
    const reported = await reportResults(results);
    totalReported += reported;
    console.log(`  ✅ Reported ${reported} integration test results\n`);
  }

  // Process Playwright e2e tests
  const e2eResultsFile = path.join(TEST_RESULTS_DIR, 'playwright-results.json');
  if (fs.existsSync(e2eResultsFile)) {
    console.log('📝 Processing Playwright e2e tests...');
    const results = await parsePlaywrightResults(e2eResultsFile);
    const reported = await reportResults(results);
    totalReported += reported;
    console.log(`  ✅ Reported ${reported} e2e test results\n`);
  }

  console.log('========================');
  console.log(`✨ Total: ${totalReported} test results reported`);
}

/**
 * Parse Jest JSON results
 */
async function parseJestResults(
  jsonPath: string,
  testLevel: 'unit' | 'integration',
): Promise<TestResult[]> {
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const jestResult = JSON.parse(content);

  const results: TestResult[] = [];

  if (jestResult.testResults) {
    for (const testFile of jestResult.testResults) {
      if (testFile.assertionResults) {
        for (const assertion of testFile.assertionResults) {
          const testName = assertion.fullName || assertion.title || 'Unknown test';
          const keyMatch = testName.match(/TC-[A-Z]+-\d+/);
          const testCaseKey = keyMatch ? keyMatch[0] : generateTestCaseKey(testName);

          results.push({
            testCaseKey,
            testCaseTitle: testName,
            testLevel,
            status: mapJestStatus(assertion.status),
            durationMs: assertion.duration || 0,
            errorMessage: assertion.failureMessages?.join('\n'),
            environment: 'docker',
          });
        }
      }
    }
  }

  return results;
}

/**
 * Parse Playwright JSON results
 */
async function parsePlaywrightResults(jsonPath: string): Promise<TestResult[]> {
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const playwrightResult = JSON.parse(content);

  const results: TestResult[] = [];

  if (playwrightResult.suites) {
    for (const suite of playwrightResult.suites) {
      if (suite.tests) {
        for (const test of suite.tests) {
          const testName = `${suite.title}: ${test.title}`;
          const keyMatch = test.title.match(/TC-[A-Z]+-\d+/);
          const testCaseKey = keyMatch ? keyMatch[0] : generateTestCaseKey(test.title);

          results.push({
            testCaseKey,
            testCaseTitle: testName,
            testLevel: 'e2e',
            status: mapPlaywrightStatus(test.status),
            durationMs: test.duration || 0,
            errorMessage: test.error?.message,
            environment: 'docker',
          });
        }
      }
    }
  }

  return results;
}

/**
 * Report results to backend API
 */
async function reportResults(results: TestResult[]): Promise<number> {
  let reported = 0;

  for (const result of results) {
    try {
      await axios.post(`${API_BASE_URL}/api/test-results/report`, {
        ...result,
        projectId: PROJECT_ID,
      });
      reported++;
    } catch (error) {
      console.error(`  ❌ Failed to report ${result.testCaseKey}: ${error.message}`);
    }
  }

  return reported;
}

/**
 * Map Jest status to internal status
 */
function mapJestStatus(
  jestStatus: string,
): 'pass' | 'fail' | 'skip' | 'error' {
  switch (jestStatus) {
    case 'passed':
      return 'pass';
    case 'failed':
      return 'fail';
    case 'skipped':
    case 'pending':
      return 'skip';
    default:
      return 'error';
  }
}

/**
 * Map Playwright status to internal status
 */
function mapPlaywrightStatus(
  playwrightStatus: string,
): 'pass' | 'fail' | 'skip' | 'error' {
  switch (playwrightStatus) {
    case 'passed':
      return 'pass';
    case 'failed':
      return 'fail';
    case 'skipped':
      return 'skip';
    case 'timedOut':
      return 'error';
    default:
      return 'error';
  }
}

/**
 * Generate test case key from test name
 */
function generateTestCaseKey(testName: string): string {
  const sanitized = testName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toUpperCase();
  const words = sanitized.split(/\s+/).slice(0, 3);
  return `TC-AUTO-${words.join('-')}`;
}

// Execute main
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
