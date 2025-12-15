import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTelemetry() {
  // Count all workflow runs
  const totalRuns = await prisma.workflowRun.count();
  console.log(`\nTotal workflow runs: ${totalRuns}`);

  if (totalRuns === 0) {
    console.log('No workflow runs found in production database');
    return;
  }

  // Get the most recent workflow run
  const latestRun = await prisma.workflowRun.findFirst({
    orderBy: {
      startedAt: 'desc'
    },
    include: {
      componentRuns: {
        select: {
          id: true,
          tokensInput: true,
          tokensOutput: true,
          totalTokens: true,
          cost: true,
          status: true,
        }
      }
    }
  });

  if (!latestRun) {
    console.log('Could not find latest run');
    return;
  }

  console.log('\n=== Latest Workflow Run ===');
  console.log(`ID: ${latestRun.id}`);
  console.log(`Status: ${latestRun.status}`);
  console.log(`Started: ${latestRun.startedAt}`);
  console.log(`Component runs: ${latestRun.componentRuns.length}`);
  console.log(`Total Tokens Input: ${latestRun.totalTokensInput}`);
  console.log(`Total Tokens Output: ${latestRun.totalTokensOutput}`);
  console.log(`Total Tokens: ${latestRun.totalTokens}`);
  console.log(`Estimated Cost: ${latestRun.estimatedCost}`);

  if (latestRun.componentRuns.length > 0) {
    console.log('\n=== Component Runs ===');
    latestRun.componentRuns.forEach((cr, idx) => {
      console.log(`\nComponent ${idx + 1}:`);
      console.log(`  ID: ${cr.id}`);
      console.log(`  Status: ${cr.status}`);
      console.log(`  Tokens Input: ${cr.tokensInput}`);
      console.log(`  Tokens Output: ${cr.tokensOutput}`);
      console.log(`  Total Tokens: ${cr.totalTokens}`);
      console.log(`  Cost: ${cr.cost}`);
    });

    // Calculate what the aggregates should be
    const expectedInput = latestRun.componentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0), 0);
    const expectedOutput = latestRun.componentRuns.reduce((sum, cr) => sum + (cr.tokensOutput || 0), 0);
    const expectedTotal = latestRun.componentRuns.reduce((sum, cr) => sum + (cr.totalTokens || 0), 0);
    const expectedCost = latestRun.componentRuns.reduce((sum, cr) => sum + (Number(cr.cost) || 0), 0);

    console.log('\n=== Expected Aggregates ===');
    console.log(`Expected Input: ${expectedInput}`);
    console.log(`Expected Output: ${expectedOutput}`);
    console.log(`Expected Total: ${expectedTotal}`);
    console.log(`Expected Cost: ${expectedCost.toFixed(4)}`);

    console.log('\n=== Verification ===');
    console.log(`Input matches: ${latestRun.totalTokensInput === expectedInput}`);
    console.log(`Output matches: ${latestRun.totalTokensOutput === expectedOutput}`);
    console.log(`Total matches: ${latestRun.totalTokens === expectedTotal}`);
    console.log(`Cost matches: ${Math.abs((latestRun.estimatedCost || 0) - expectedCost) < 0.0001}`);
  } else {
    console.log('\nNo component runs found for this workflow run');
  }
}

checkTelemetry()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
