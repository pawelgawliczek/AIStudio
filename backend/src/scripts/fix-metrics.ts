import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMetrics() {
  const result = await prisma.componentRun.update({
    where: {
      id: '5bf97a80-e7e6-439f-a59b-7157fb1df2ff',
    },
    data: {
      totalTokens: 98900,
      tokensInput: 79120, // Estimated 80% input
      tokensOutput: 19780, // Estimated 20% output
      durationSeconds: 197, // 3m 17s
    },
  });

  console.log('Updated component run metrics:', JSON.stringify(result, null, 2));
}

fixMetrics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
