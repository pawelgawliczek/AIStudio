#!/usr/bin/env tsx
/**
 * ST-17 QA Validation Script
 *
 * This script validates that the coordinator statistics bug fix is working correctly.
 * It performs end-to-end validation of the metrics tracking system.
 *
 * Tests:
 * 1. Check if workflow run has completed
 * 2. Validate coordinator metrics are populated
 * 3. Validate component metrics are populated
 * 4. Verify aggregated totals are correct
 * 5. Verify all BA acceptance criteria are met
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// BA Acceptance Criteria from ST-17
const ACCEPTANCE_CRITERIA = [
  {
    id: 'AC1',
    description: 'After workflow completion, get_workflow_run_results returns accurate token counts',
    check: (data: any) => {
      return data.run?.metrics?.totalTokens > 0 &&
             data.run?.metrics?.totalTokensInput > 0 &&
             data.run?.metrics?.totalTokensOutput > 0;
    }
  },
  {
    id: 'AC2',
    description: 'Orchestrator metrics show actual tokens consumed by coordinator',
    check: (data: any) => {
      const coordMetrics = data.run?.coordinatorMetrics;
      return coordMetrics &&
             coordMetrics.tokensInput > 0 &&
             coordMetrics.tokensOutput > 0 &&
             coordMetrics.totalTokens > 0;
    }
  },
  {
    id: 'AC3',
    description: 'Cost calculations reflect actual API usage',
    check: (data: any) => {
      return data.run?.metrics?.estimatedCost > 0 &&
             data.run?.coordinatorMetrics?.costUsd > 0;
    }
  },
  {
    id: 'AC4',
    description: 'Database stores and retrieves metrics correctly',
    check: (data: any) => {
      // Check that metrics are persisted in DB fields
      return data.run?.totalTokensInput !== null &&
             data.run?.totalTokensOutput !== null &&
             data.run?.estimatedCost !== null &&
             data.run?.coordinatorMetrics !== null;
    }
  },
];

interface ValidationResult {
  passed: boolean;
  criteria: string;
  details: string;
}

async function validateWorkflowRun(runId: string): Promise<{
  success: boolean;
  results: ValidationResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
  };
  metrics?: any;
}> {
  console.log(`\n${'='.repeat(80)}`);
  console.log('ST-17 FIX VALIDATION - Coordinator Statistics Tracking');
  console.log(`${'='.repeat(80)}\n`);

  // Fetch workflow run with all related data
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: true,
      coordinator: true,
      story: true,
      componentRuns: {
        select: {
          id: true,
          componentId: true,
          status: true,
          tokensInput: true,
          tokensOutput: true,
          totalTokens: true,
          cost: true,
          startedAt: true,
          finishedAt: true,
        }
      }
    }
  });

  if (!workflowRun) {
    throw new Error(`Workflow run ${runId} not found`);
  }

  console.log('Workflow Run Information:');
  console.log(`  Run ID: ${workflowRun.id}`);
  console.log(`  Story: ${workflowRun.story?.key} - ${workflowRun.story?.title}`);
  console.log(`  Workflow: ${workflowRun.workflow.name}`);
  console.log(`  Status: ${workflowRun.status}`);
  console.log(`  Started: ${workflowRun.startedAt.toISOString()}`);
  console.log(`  Finished: ${workflowRun.finishedAt?.toISOString() || 'Still running'}`);
  console.log(`  Duration: ${workflowRun.durationSeconds ? `${workflowRun.durationSeconds}s` : 'N/A'}`);
  console.log(`  Components: ${workflowRun.componentRuns.length}`);

  // Check if workflow is complete
  if (!['completed', 'failed', 'cancelled'].includes(workflowRun.status)) {
    console.log(`\n⚠️  WARNING: Workflow is still ${workflowRun.status.toUpperCase()}`);
    console.log('   Metrics are only calculated when workflow completes.');
    console.log('   Please wait for workflow to finish or manually complete it.\n');
    return {
      success: false,
      results: [],
      summary: { totalTests: 0, passed: 0, failed: 0 }
    };
  }

  console.log(`\n${'─'.repeat(80)}`);
  console.log('DATABASE METRICS (Raw Data)');
  console.log(`${'─'.repeat(80)}\n`);

  console.log('Workflow Run Fields:');
  console.log(`  totalTokensInput: ${workflowRun.totalTokensInput}`);
  console.log(`  totalTokensOutput: ${workflowRun.totalTokensOutput}`);
  console.log(`  totalTokens: ${workflowRun.totalTokens}`);
  console.log(`  estimatedCost: ${workflowRun.estimatedCost}`);

  console.log('\nCoordinator Metrics:');
  const coordMetrics = workflowRun.coordinatorMetrics as any;
  if (coordMetrics) {
    console.log(`  tokensInput: ${coordMetrics.tokensInput}`);
    console.log(`  tokensOutput: ${coordMetrics.tokensOutput}`);
    console.log(`  totalTokens: ${coordMetrics.totalTokens}`);
    console.log(`  costUsd: ${coordMetrics.costUsd}`);
    console.log(`  toolCalls: ${coordMetrics.toolCalls}`);
    console.log(`  iterations: ${coordMetrics.iterations}`);
    console.log(`  dataSource: ${coordMetrics.dataSource}`);
    console.log(`  transcriptPath: ${coordMetrics.transcriptPath || 'N/A'}`);
  } else {
    console.log('  ❌ No coordinator metrics found');
  }

  console.log('\nComponent Run Metrics:');
  let totalComponentTokens = 0;
  let totalComponentCost = 0;
  workflowRun.componentRuns.forEach((cr, idx) => {
    console.log(`  Component ${idx + 1}:`);
    console.log(`    Status: ${cr.status}`);
    console.log(`    Tokens (in/out): ${cr.tokensInput}/${cr.tokensOutput}`);
    console.log(`    Total Tokens: ${cr.totalTokens}`);
    console.log(`    Cost: ${cr.cost}`);
    totalComponentTokens += cr.totalTokens || 0;
    totalComponentCost += Number(cr.cost || 0);
  });

  console.log(`\nAggregated Component Metrics:`);
  console.log(`  Total Tokens: ${totalComponentTokens}`);
  console.log(`  Total Cost: $${totalComponentCost.toFixed(4)}`);

  // Check transcript file
  console.log(`\n${'─'.repeat(80)}`);
  console.log('TRANSCRIPT VALIDATION');
  console.log(`${'─'.repeat(80)}\n`);

  if (coordMetrics?.transcriptPath) {
    const transcriptExists = fs.existsSync(coordMetrics.transcriptPath);
    console.log(`  Transcript Path: ${coordMetrics.transcriptPath}`);
    console.log(`  Exists: ${transcriptExists ? '✅ Yes' : '❌ No'}`);

    if (transcriptExists) {
      const stats = fs.statSync(coordMetrics.transcriptPath);
      console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`  Modified: ${stats.mtime.toISOString()}`);
    }
  } else {
    console.log('  ❌ No transcript path recorded');
  }

  // Run acceptance criteria validation
  console.log(`\n${'─'.repeat(80)}`);
  console.log('ACCEPTANCE CRITERIA VALIDATION');
  console.log(`${'─'.repeat(80)}\n`);

  const mockRunResult = {
    run: {
      ...workflowRun,
      metrics: {
        totalTokensInput: workflowRun.totalTokensInput,
        totalTokensOutput: workflowRun.totalTokensOutput,
        totalTokens: workflowRun.totalTokens,
        estimatedCost: workflowRun.estimatedCost,
      },
      coordinatorMetrics: coordMetrics,
    }
  };

  const results: ValidationResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const criterion of ACCEPTANCE_CRITERIA) {
    const testPassed = criterion.check(mockRunResult);
    const result: ValidationResult = {
      passed: testPassed,
      criteria: criterion.description,
      details: testPassed ? 'PASS' : 'FAIL - Metrics missing or zero'
    };
    results.push(result);

    const status = testPassed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${criterion.id}: ${criterion.description}`);

    if (testPassed) passed++;
    else failed++;
  }

  // Additional validation checks
  console.log(`\n${'─'.repeat(80)}`);
  console.log('ADDITIONAL VALIDATION CHECKS');
  console.log(`${'─'.repeat(80)}\n`);

  const additionalChecks = [
    {
      name: 'Aggregation accuracy',
      check: () => {
        if (!coordMetrics) return false;
        const expectedTotal = (coordMetrics.tokensInput || 0) + totalComponentTokens;
        const actualTotal = workflowRun.totalTokens || 0;
        const diff = Math.abs(expectedTotal - actualTotal);
        console.log(`    Expected: ${expectedTotal}, Actual: ${actualTotal}, Diff: ${diff}`);
        return diff < 100; // Allow small rounding differences
      }
    },
    {
      name: 'Coordinator metrics non-zero',
      check: () => coordMetrics?.tokensInput > 0 && coordMetrics?.tokensOutput > 0
    },
    {
      name: 'Component metrics populated',
      check: () => workflowRun.componentRuns.some(cr => (cr.totalTokens || 0) > 0)
    },
    {
      name: 'Cost calculation reasonable',
      check: () => {
        const cost = workflowRun.estimatedCost || 0;
        return cost > 0 && cost < 100; // Sanity check: between $0 and $100
      }
    },
  ];

  for (const check of additionalChecks) {
    const testPassed = check.check();
    const status = testPassed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${check.name}`);
    if (testPassed) passed++;
    else failed++;
  }

  const totalTests = ACCEPTANCE_CRITERIA.length + additionalChecks.length;

  console.log(`\n${'='.repeat(80)}`);
  console.log('VALIDATION SUMMARY');
  console.log(`${'='.repeat(80)}\n`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`  Success Rate: ${((passed / totalTests) * 100).toFixed(1)}%`);
  console.log();

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! ST-17 fix is working correctly.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Review the metrics above.');
  }
  console.log();

  return {
    success: failed === 0,
    results,
    summary: {
      totalTests,
      passed,
      failed
    },
    metrics: {
      workflow: {
        totalTokensInput: workflowRun.totalTokensInput,
        totalTokensOutput: workflowRun.totalTokensOutput,
        totalTokens: workflowRun.totalTokens,
        estimatedCost: workflowRun.estimatedCost,
      },
      coordinator: coordMetrics,
      components: {
        totalTokens: totalComponentTokens,
        totalCost: totalComponentCost,
        count: workflowRun.componentRuns.length,
      }
    }
  };
}

// Main execution
async function main() {
  const runId = process.argv[2] || 'ad475a0c-273a-48ed-8538-57d9a2327116';

  try {
    const result = await validateWorkflowRun(runId);
    await prisma.$disconnect();

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
