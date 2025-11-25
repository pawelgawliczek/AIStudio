import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:361a30c6d68396be29c7eddc3f9ff1b1cfe07675c707232a370bda33f7c8b518@127.0.0.1:5433/vibestudio?schema=public'
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
    // ST-110: New token breakdown from /context command
    console.log(`System Prompt: ${run.tokensSystemPrompt}`);
    console.log(`System Tools: ${run.tokensSystemTools}`);
    console.log(`MCP Tools: ${run.tokensMcpTools}`);
    console.log(`Memory Files: ${run.tokensMemoryFiles}`);
    console.log(`Messages: ${run.tokensMessages}`);
    console.log(`Cost: $${run.cost}`);
    console.log('---');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
