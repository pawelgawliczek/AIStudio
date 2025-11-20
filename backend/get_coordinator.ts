import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const coordinator = await prisma.coordinator.findUnique({
    where: { id: '0f37e71a-b69c-4ff8-a3c1-3ea83d098181' },
    select: {
      id: true,
      name: true,
      coordinatorInstructions: true,
      version: true,
    },
  });
  
  console.log(JSON.stringify(coordinator, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
