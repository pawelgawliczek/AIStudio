import { Page, Locator } from '@playwright/test';

/**
 * KPI Helper utilities for E2E tests
 * Provides functions to extract and compare KPI values from analytics pages
 */

/**
 * Extract number from text (handles "N/A", "0", formatted numbers like "1,234", currency)
 */
export function extractNumber(text: string | null | undefined): number | null {
  if (!text || text === 'N/A' || text === '') return null;
  // Remove commas, dollar signs, and other non-numeric characters except decimal point
  const cleaned = text.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract duration in seconds from text (e.g., "5m 30s" or "45s" or "1h 5m 30s")
 */
export function extractDuration(text: string | null | undefined): number | null {
  if (!text || text === 'N/A' || text === '') return null;

  const hoursMatch = text.match(/(\d+)h/);
  const minutesMatch = text.match(/(\d+)m/);
  const secondsMatch = text.match(/(\d+)s/);

  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
  const seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Extract percentage from text (e.g., "85%" -> 85)
 */
export function extractPercentage(text: string | null | undefined): number | null {
  if (!text || text === 'N/A' || text === '') return null;
  const cleaned = text.replace('%', '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract fraction from text (e.g., "5/10" -> { numerator: 5, denominator: 10 })
 */
export function extractFraction(text: string | null | undefined): { numerator: number; denominator: number } | null {
  if (!text || text === 'N/A' || text === '') return null;
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return {
    numerator: parseInt(match[1]),
    denominator: parseInt(match[2]),
  };
}

/**
 * Compare numbers with tolerance (for calculated averages)
 * @param actual - Actual value from UI
 * @param expected - Expected value from API
 * @param tolerancePercent - Tolerance as percentage (default 1%)
 */
export function compareWithTolerance(
  actual: number | null,
  expected: number | null,
  tolerancePercent: number = 1
): boolean {
  if (actual === null && expected === null) return true;
  if (actual === null || expected === null) return false;
  if (expected === 0) return actual === 0;

  const diff = Math.abs(actual - expected);
  const percentDiff = (diff / Math.abs(expected)) * 100;
  return percentDiff <= tolerancePercent;
}

/**
 * Get KPI value from a metric card on the page
 * Assumes structure: <MetricCard><label>{label}</label><h5>{value}</h5></MetricCard>
 */
export async function getKPIValue(page: Page, label: string): Promise<string | null> {
  try {
    const value = await page.locator(`text=${label}`).locator('..').locator('h5').textContent();
    return value;
  } catch (error) {
    console.warn(`Failed to extract KPI value for label "${label}":`, error);
    return null;
  }
}

/**
 * Get multiple KPI values at once
 */
export async function getKPIValues(page: Page, labels: string[]): Promise<Record<string, string | null>> {
  const values: Record<string, string | null> = {};
  for (const label of labels) {
    values[label] = await getKPIValue(page, label);
  }
  return values;
}

/**
 * Wait for KPI section to be visible and loaded
 */
export async function waitForKPISection(page: Page, sectionTitle: string, timeout: number = 10000): Promise<void> {
  await page.waitForSelector(`text=${sectionTitle}`, { timeout });
}

/**
 * Assertion helper with detailed error message
 */
export interface KPIAssertion {
  label: string;
  displayed: number | null;
  expected: number | null;
  tolerance?: number;
}

export function assertKPI(assertion: KPIAssertion): void {
  const { label, displayed, expected, tolerance } = assertion;

  if (tolerance !== undefined) {
    if (!compareWithTolerance(displayed, expected, tolerance)) {
      throw new Error(
        `KPI "${label}" mismatch: displayed ${displayed}, expected ${expected} (tolerance: ±${tolerance}%)`
      );
    }
  } else {
    if (displayed !== expected) {
      throw new Error(`KPI "${label}" mismatch: displayed ${displayed}, expected ${expected}`);
    }
  }
}

/**
 * Extract all token metrics from Workflow Monitor page
 */
export async function extractTokenMetrics(page: Page): Promise<{
  totalTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreation: number | null;
  cacheRead: number | null;
}> {
  await waitForKPISection(page, 'Token Usage');

  const values = await getKPIValues(page, [
    'Total Tokens',
    'Input Tokens',
    'Output Tokens',
    'Cache Creation',
    'Cache Read',
  ]);

  return {
    totalTokens: extractNumber(values['Total Tokens']),
    inputTokens: extractNumber(values['Input Tokens']),
    outputTokens: extractNumber(values['Output Tokens']),
    cacheCreation: extractNumber(values['Cache Creation']),
    cacheRead: extractNumber(values['Cache Read']),
  };
}

/**
 * Extract all efficiency & cost metrics from Workflow Monitor page
 */
export async function extractEfficiencyMetrics(page: Page): Promise<{
  tokensPerLOC: number | null;
  totalCost: number | null;
  costPerLOC: number | null;
  duration: number | null;
}> {
  await waitForKPISection(page, 'Efficiency & Cost');

  const values = await getKPIValues(page, [
    'Tokens / LOC',
    'Total Cost',
    'Cost / LOC',
    'Duration',
  ]);

  return {
    tokensPerLOC: extractNumber(values['Tokens / LOC']),
    totalCost: extractNumber(values['Total Cost']),
    costPerLOC: extractNumber(values['Cost / LOC']),
    duration: extractDuration(values['Duration']),
  };
}

/**
 * Extract all code impact metrics from Workflow Monitor page
 */
export async function extractCodeImpactMetrics(page: Page): Promise<{
  linesAdded: number | null;
  linesModified: number | null;
  linesDeleted: number | null;
  locGenerated: number | null;
  testsAdded: number | null;
}> {
  await waitForKPISection(page, 'Code Impact');

  const values = await getKPIValues(page, [
    'Lines Added',
    'Lines Modified',
    'Lines Deleted',
    'LOC Generated',
    'Tests Added',
  ]);

  return {
    linesAdded: extractNumber(values['Lines Added']),
    linesModified: extractNumber(values['Lines Modified']),
    linesDeleted: extractNumber(values['Lines Deleted']),
    locGenerated: extractNumber(values['LOC Generated']),
    testsAdded: extractNumber(values['Tests Added']),
  };
}

/**
 * Extract all execution metrics from Workflow Monitor page
 */
export async function extractExecutionMetrics(page: Page): Promise<{
  componentsCompleted: number | null;
  componentsTotal: number | null;
  humanPrompts: number | null;
  iterations: number | null;
  interventions: number | null;
}> {
  await waitForKPISection(page, 'Execution Metrics');

  const values = await getKPIValues(page, [
    'Agents',
    'Human Prompts',
    'Iterations',
    'Interventions',
  ]);

  // Parse agents count (format: "X/Y")
  const fractionData = extractFraction(values['Agents']);

  return {
    componentsCompleted: fractionData?.numerator ?? null,
    componentsTotal: fractionData?.denominator ?? null,
    humanPrompts: extractNumber(values['Human Prompts']),
    iterations: extractNumber(values['Iterations']),
    interventions: extractNumber(values['Interventions']),
  };
}

/**
 * Format number with commas (inverse of extractNumber)
 */
export function formatNumber(num: number | null): string {
  if (num === null) return 'N/A';
  return num.toLocaleString();
}

/**
 * Format cost (inverse of extractNumber for currency)
 */
export function formatCost(cost: number | null): string {
  if (cost === null) return '$0.00';
  return `$${cost.toFixed(4)}`;
}

/**
 * Format duration in seconds to human readable string (inverse of extractDuration)
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  if (seconds < 60) return `${seconds}s`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}
