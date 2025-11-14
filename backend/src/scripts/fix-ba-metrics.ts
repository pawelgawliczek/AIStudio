import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMetrics() {
  const result = await prisma.componentRun.update({
    where: {
      id: 'f0dba6a7-42f5-4608-9c0d-3cd59fcd13ff',
    },
    data: {
      totalTokens: 65900,
      tokensInput: 52720, // Estimated 80% input
      tokensOutput: 13180, // Estimated 20% output
      durationSeconds: 113, // 1m 53s
      systemIterations: 9, // tool uses
    },
  });

  console.log('✅ Updated BA component run metrics');
  console.log(`Total Tokens: ${result.totalTokens}`);
  console.log(`Duration: ${result.durationSeconds}s`);
  console.log(`Tool Uses: ${result.systemIterations}`);
}

fixMetrics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
