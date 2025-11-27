#!/usr/bin/env node
/**
 * Generate coverage-summary.json from coverage-final.json
 * Vitest with V8 coverage generates coverage-final.json, but we need
 * coverage-summary.json for the merge script.
 */

const fs = require('fs');
const path = require('path');

const coverageDir = path.join(__dirname, '..', 'coverage');
const finalPath = path.join(coverageDir, 'coverage-final.json');
const summaryPath = path.join(coverageDir, 'coverage-summary.json');

function calculateMetrics(files) {
  const totals = {
    lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
    statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
    functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
    branches: { total: 0, covered: 0, skipped: 0, pct: 0 }
  };

  const summary = { total: totals };

  for (const [filePath, coverage] of Object.entries(files)) {
    // Extract metrics from coverage-final.json format
    const fileMetrics = {
      lines: {
        total: Object.keys(coverage.statementMap || {}).length,
        covered: Object.values(coverage.s || {}).filter(count => count > 0).length,
        skipped: 0,
        pct: 0
      },
      statements: {
        total: Object.keys(coverage.statementMap || {}).length,
        covered: Object.values(coverage.s || {}).filter(count => count > 0).length,
        skipped: 0,
        pct: 0
      },
      functions: {
        total: Object.keys(coverage.fnMap || {}).length,
        covered: Object.values(coverage.f || {}).filter(count => count > 0).length,
        skipped: 0,
        pct: 0
      },
      branches: {
        total: Object.keys(coverage.branchMap || {}).length,
        covered: Object.values(coverage.b || {}).flat().filter(count => count > 0).length,
        skipped: 0,
        pct: 0
      }
    };

    // Calculate percentages
    ['lines', 'statements', 'functions', 'branches'].forEach(metric => {
      if (fileMetrics[metric].total > 0) {
        fileMetrics[metric].pct = (fileMetrics[metric].covered / fileMetrics[metric].total) * 100;
      }
    });

    // Add to totals
    ['lines', 'statements', 'functions', 'branches'].forEach(metric => {
      totals[metric].total += fileMetrics[metric].total;
      totals[metric].covered += fileMetrics[metric].covered;
    });

    // Add file to summary (remove absolute path prefix)
    const relativePath = filePath.replace(/^.*\/frontend\//, '');
    summary[relativePath] = fileMetrics;
  }

  // Calculate total percentages
  ['lines', 'statements', 'functions', 'branches'].forEach(metric => {
    if (totals[metric].total > 0) {
      totals[metric].pct = (totals[metric].covered / totals[metric].total) * 100;
    }
  });

  return summary;
}

try {
  // Read coverage-final.json
  const coverageFinal = JSON.parse(fs.readFileSync(finalPath, 'utf-8'));

  // Convert to summary format
  const summary = calculateMetrics(coverageFinal);

  // Write coverage-summary.json
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('✅ Generated coverage-summary.json');
  console.log(`   Lines: ${summary.total.lines.pct.toFixed(2)}% (${summary.total.lines.covered}/${summary.total.lines.total})`);
  console.log(`   Statements: ${summary.total.statements.pct.toFixed(2)}% (${summary.total.statements.covered}/${summary.total.statements.total})`);
  console.log(`   Functions: ${summary.total.functions.pct.toFixed(2)}% (${summary.total.functions.covered}/${summary.total.functions.total})`);
  console.log(`   Branches: ${summary.total.branches.pct.toFixed(2)}% (${summary.total.branches.covered}/${summary.total.branches.total})`);
} catch (error) {
  console.error('❌ Error generating coverage summary:', error.message);
  process.exit(1);
}
