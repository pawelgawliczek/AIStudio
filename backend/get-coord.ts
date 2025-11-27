import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const c = await prisma.coordinator.findUnique({ 
    where: { id: '4ca9aa54-c556-4c42-af45-ad4a7f2fdc54' }, 
    select: { coordinatorInstructions: true, config: true } 
  });
  console.log(JSON.stringify(c, null, 2));
  await prisma.$disconnect();
}
main();
