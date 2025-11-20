import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5433/vibestudio?schema=public'
    }
  }
});

async function main() {
  const workflowRunId = '6a56e500-c4e9-400d-9f10-d807c63e5959';

  const baRuns = await prisma.componentRun.findMany({
    where: {
      workflowRunId: workflowRunId,
      component: {
        name: 'Business Analyst'
      }
    },
    include: {
      component: true
    },
    orderBy: {
      startedAt: 'desc'
    }
  });

  console.log(`Found ${baRuns.length} Business Analyst runs:\n`);

  for (const run of baRuns) {
    console.log(`Status: ${run.status}`);
    console.log(`Tokens Input: ${run.tokensInput}`);
    console.log(`Tokens Output: ${run.tokensOutput}`);
    console.log(`Total Tokens: ${run.totalTokens}`);
    console.log(`Cache Read: ${run.tokensCacheRead}`);
    console.log(`Cache Write: ${run.tokensCacheWrite}`);
    console.log(`Cost: $${run.cost}`);
    console.log('---');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
