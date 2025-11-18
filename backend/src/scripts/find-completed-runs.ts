import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findCompletedRuns() {
  const runs = await prisma.workflowRun.findMany({
    where: { status: 'completed' },
    orderBy: { finishedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      totalTokens: true,
      totalTokensInput: true,
      totalTokensOutput: true,
      estimatedCost: true,
      coordinatorMetrics: true,
      story: { select: { key: true, title: true } }
    }
  });

  console.log(`\nFound ${runs.length} completed workflow runs:\n`);

  runs.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.story?.key}: ${r.id.substring(0, 8)}...`);
    console.log(`   Title: ${r.story?.title?.substring(0, 60)}`);
    console.log(`   Finished: ${r.finishedAt?.toISOString()}`);
    console.log(`   Tokens: ${r.totalTokens || 'null'}`);
    console.log(`   Cost: $${r.estimatedCost || 'null'}`);
    console.log(`   Has Coordinator Metrics: ${r.coordinatorMetrics ? 'Yes ✅' : 'No ❌'}`);
    if (r.coordinatorMetrics) {
      const cm = r.coordinatorMetrics as any;
      console.log(`     Coordinator Tokens: ${cm.totalTokens || 0}`);
      console.log(`     Coordinator Cost: $${cm.costUsd || 0}`);
    }
    console.log();
  });

  await prisma.$disconnect();
}

findCompletedRuns();
