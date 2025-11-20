import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getMetrics() {
  const run = await prisma.componentRun.findUnique({
    where: { id: '7db02ceb-1814-4571-86c3-180f091dc39f' },
  });

  if (!run) {
    console.error('Component run not found');
    return;
  }

  console.log('Architect Component Metrics:');
  console.log('- Total Tokens:', run.totalTokens);
  console.log('- Tokens Input:', run.tokensInput);
  console.log('- Tokens Output:', run.tokensOutput);
  console.log('- Duration:', run.durationSeconds, 'seconds');
  console.log('- System Iterations:', run.systemIterations);
  console.log('- Cost:', run.cost);
  console.log('- Status:', run.status);
}

getMetrics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
