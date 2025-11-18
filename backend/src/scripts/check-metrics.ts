import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMetrics() {
  const run = await prisma.workflowRun.findUnique({
    where: { id: 'ad475a0c-273a-48ed-8538-57d9a2327116' },
    include: {
      componentRuns: {
        select: {
          id: true,
          componentId: true,
          status: true,
          tokensInput: true,
          tokensOutput: true,
          totalTokens: true,
          cost: true
        }
      }
    }
  });

  console.log('\n=== WORKFLOW RUN METRICS (ST-17 Fix Validation) ===');
  console.log('Run ID:', run?.id);
  console.log('Status:', run?.status);
  console.log('Total Tokens Input:', run?.totalTokensInput);
  console.log('Total Tokens Output:', run?.totalTokensOutput);
  console.log('Total Tokens:', run?.totalTokens);
  console.log('Estimated Cost:', run?.estimatedCost);
  console.log('\nCoordinator Metrics:', JSON.stringify(run?.coordinatorMetrics, null, 2));

  console.log('\n=== COMPONENT RUN METRICS ===');
  let totalComponentTokens = 0;
  let totalComponentCost = 0;
  run?.componentRuns.forEach((cr, i) => {
    console.log(`\nComponent ${i + 1}:`);
    console.log('  ID:', cr.id);
    console.log('  Status:', cr.status);
    console.log('  Tokens Input:', cr.tokensInput);
    console.log('  Tokens Output:', cr.tokensOutput);
    console.log('  Total Tokens:', cr.totalTokens);
    console.log('  Cost:', cr.cost);

    totalComponentTokens += cr.totalTokens || 0;
    totalComponentCost += cr.cost || 0;
  });

  console.log('\n=== AGGREGATED STATS ===');
  console.log('Total Component Tokens:', totalComponentTokens);
  console.log('Total Component Cost:', totalComponentCost);
  console.log('Number of Components:', run?.componentRuns.length);

  // Validation checks
  console.log('\n=== VALIDATION (BA Acceptance Criteria) ===');
  const checks = {
    'Total tokens calculated': run?.totalTokens !== null && run?.totalTokens !== undefined,
    'Total tokens input calculated': run?.totalTokensInput !== null,
    'Total tokens output calculated': run?.totalTokensOutput !== null,
    'Cost calculated': run?.estimatedCost !== null,
    'Coordinator metrics exist': run?.coordinatorMetrics !== null,
    'Coordinator has input tokens': (run?.coordinatorMetrics as any)?.tokensInput > 0,
    'Coordinator has output tokens': (run?.coordinatorMetrics as any)?.tokensOutput > 0,
    'Component metrics populated': run?.componentRuns.some(cr => cr.totalTokens && cr.totalTokens > 0)
  };

  let passCount = 0;
  let failCount = 0;

  Object.entries(checks).forEach(([check, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${check}`);
    if (passed) passCount++;
    else failCount++;
  });

  console.log(`\n=== SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);

  await prisma.$disconnect();
}

checkMetrics().catch(console.error);
