import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const coordinator = await prisma.coordinatorAgent.findUnique({
    where: { id: '0f37e71a-b69c-4ff8-a3c1-3ea83d098181' },
    select: { coordinatorInstructions: true }
  });
  console.log(coordinator?.coordinatorInstructions || 'Not found');
  await prisma.$disconnect();
}

main().catch(console.error);
