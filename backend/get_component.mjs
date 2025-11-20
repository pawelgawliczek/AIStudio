import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const component = await prisma.component.findUnique({
    where: { id: '507e2765-c099-4ead-8441-b376f3f8b48e' }, // Context Explore
    select: {
      name: true,
      inputInstructions: true,
      operationInstructions: true,
      outputInstructions: true,
      tools: true
    }
  });
  console.log(JSON.stringify(component, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
