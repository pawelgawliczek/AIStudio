import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMetrics() {
  const run = await prisma.componentRun.findFirst({
    where: {
      workflowRunId: '502a17d8-6300-447e-ab99-308b48cd2344',
      componentId: '4b16a6f1-2c2a-4f4e-91c8-132d4ea07548',
    },
  });

  if (!run) {
    console.error('Component run not found');
    return;
  }

  console.log('Full-Stack Developer Current Metrics:');
  console.log('- ID:', run.id);
  console.log('- Total Tokens:', run.totalTokens);
  console.log('- Duration:', run.durationSeconds, 'seconds');
  console.log('- LOC Generated:', run.locGenerated);
  console.log('- Files Modified:', run.filesModified?.length || 0);
  console.log('- System Iterations:', run.systemIterations);
  console.log('- Status:', run.status);
  
  // Now update with correct values
  const updated = await prisma.componentRun.update({
    where: { id: run.id },
    data: {
      totalTokens: 111100,
      tokensInput: 88880, // 80% estimate
      tokensOutput: 22220, // 20% estimate
      durationSeconds: 631, // 10m 31s
      systemIterations: 74, // tool uses
      locGenerated: 1735, // from commit
      filesModified: ["backend/src/mcp/servers/components/update_component.ts", "backend/src/mcp/servers/components/__tests__/update_component.test.ts", "backend/src/mcp/servers/components/index.ts", "backend/src/mcp/servers/coordinators/update_coordinator.ts", "backend/src/mcp/servers/coordinators/__tests__/update_coordinator.test.ts", "backend/src/mcp/servers/coordinators/index.ts", "backend/src/mcp/servers/workflows/update_workflow.ts", "backend/src/mcp/servers/workflows/__tests__/update_workflow.test.ts", "backend/src/mcp/servers/workflows/index.ts"],
    },
  });

  console.log('\n✅ Updated to correct metrics:');
  console.log('- Total Tokens:', updated.totalTokens);
  console.log('- Duration:', updated.durationSeconds, 'seconds');
  console.log('- LOC Generated:', updated.locGenerated);
  console.log('- Files Modified:', updated.filesModified?.length);
  console.log('- System Iterations:', updated.systemIterations);
}

checkMetrics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
