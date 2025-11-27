#!/usr/bin/env ts-node
/**
 * Merge Coverage Reports
 *
 * Combines coverage reports from backend (Jest) and frontend (Vitest) into a single
 * unified report that the Code Quality Dashboard can consume.
 *
 * Input:
 *   - backend/coverage/coverage-summary.json (Jest lcov format)
 *   - frontend/coverage/coverage-summary.json (Vitest lcov format)
 *
 * Output:
 *   - coverage/coverage-summary.json (merged, weighted by lines)
 */

import * as fs from 'fs';
import * as path from 'path';

interface CoverageMetrics {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface FileCoverage {
  lines: CoverageMetrics;
  statements: CoverageMetrics;
  functions: CoverageMetrics;
  branches: CoverageMetrics;
}

interface CoverageSummary {
  total: FileCoverage;
  [filePath: string]: FileCoverage;
}

const ROOT_DIR = path.join(__dirname, '..');
const BACKEND_COVERAGE = path.join(ROOT_DIR, 'backend', 'coverage', 'coverage-summary.json');
const FRONTEND_COVERAGE = path.join(ROOT_DIR, 'frontend', 'coverage', 'coverage-summary.json');
const OUTPUT_COVERAGE = path.join(ROOT_DIR, 'coverage', 'coverage-summary.json');

function loadCoverageReport(filePath: string): CoverageSummary | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Coverage file not found: ${filePath}`);
      return null;
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error reading coverage from ${filePath}:`, error);
    return null;
  }
}

function mergeMetrics(
  backend: CoverageMetrics | undefined,
  frontend: CoverageMetrics | undefined,
): CoverageMetrics {
  if (!backend && !frontend) {
    return { total: 0, covered: 0, skipped: 0, pct: 0 };
  }

  if (!backend) return frontend!;
  if (!frontend) return backend;

  const total = backend.total + frontend.total;
  const covered = backend.covered + frontend.covered;
  const skipped = backend.skipped + frontend.skipped;
  const pct = total > 0 ? (covered / total) * 100 : 0;

  return { total, covered, skipped, pct };
}

function mergeFileCoverage(
  backend: FileCoverage | undefined,
  frontend: FileCoverage | undefined,
): FileCoverage {
  return {
    lines: mergeMetrics(backend?.lines, frontend?.lines),
    statements: mergeMetrics(backend?.statements, frontend?.statements),
    functions: mergeMetrics(backend?.functions, frontend?.functions),
    branches: mergeMetrics(backend?.branches, frontend?.branches),
  };
}

function mergeCoverageReports(
  backendCoverage: CoverageSummary | null,
  frontendCoverage: CoverageSummary | null,
): CoverageSummary {
  if (!backendCoverage && !frontendCoverage) {
    console.error('❌ No coverage reports found to merge');
    process.exit(1);
  }

  if (!backendCoverage) {
    console.log('ℹ️  Using frontend coverage only (no backend coverage found)');
    return frontendCoverage!;
  }

  if (!frontendCoverage) {
    console.log('ℹ️  Using backend coverage only (no frontend coverage found)');
    return backendCoverage;
  }

  console.log('✅ Merging backend and frontend coverage reports...');

  // Merge total coverage
  const merged: CoverageSummary = {
    total: mergeFileCoverage(backendCoverage.total, frontendCoverage.total),
  };

  // Merge file-level coverage (prefix paths for clarity)
  for (const [filePath, coverage] of Object.entries(backendCoverage)) {
    if (filePath !== 'total') {
      merged[`backend/${filePath}`] = coverage;
    }
  }

  for (const [filePath, coverage] of Object.entries(frontendCoverage)) {
    if (filePath !== 'total') {
      merged[`frontend/${filePath}`] = coverage;
    }
  }

  return merged;
}

function main() {
  console.log('🔀 Merging Coverage Reports\n');

  // Load coverage reports
  const backendCoverage = loadCoverageReport(BACKEND_COVERAGE);
  const frontendCoverage = loadCoverageReport(FRONTEND_COVERAGE);

  // Merge reports
  const merged = mergeCoverageReports(backendCoverage, frontendCoverage);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_COVERAGE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }

  // Write merged report
  fs.writeFileSync(OUTPUT_COVERAGE, JSON.stringify(merged, null, 2));

  console.log(`\n✅ Merged coverage report written to: ${OUTPUT_COVERAGE}`);
  console.log(`\n📊 Coverage Summary:`);
  console.log(`   Lines:      ${merged.total.lines.pct.toFixed(2)}% (${merged.total.lines.covered}/${merged.total.lines.total})`);
  console.log(`   Statements: ${merged.total.statements.pct.toFixed(2)}% (${merged.total.statements.covered}/${merged.total.statements.total})`);
  console.log(`   Functions:  ${merged.total.functions.pct.toFixed(2)}% (${merged.total.functions.covered}/${merged.total.functions.total})`);
  console.log(`   Branches:   ${merged.total.branches.pct.toFixed(2)}% (${merged.total.branches.covered}/${merged.total.branches.total})`);

  if (backendCoverage && frontendCoverage) {
    console.log(`\n📦 Backend Coverage:`);
    console.log(`   Lines: ${backendCoverage.total.lines.pct.toFixed(2)}%`);
    console.log(`\n🎨 Frontend Coverage:`);
    console.log(`   Lines: ${frontendCoverage.total.lines.pct.toFixed(2)}%`);
  }
}

if (require.main === module) {
  main();
}

export { mergeCoverageReports, loadCoverageReport };
