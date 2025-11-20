import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const component = await prisma.workflowComponent.findFirst({
    where: { name: { contains: 'Full-Stack', mode: 'insensitive' } }
  });

  if (component) {
    console.log('Component ID:', component.id);
    console.log('Component Name:', component.name);
    console.log('\nOperation Instructions:');
    console.log(component.operationInstructions);
  } else {
    console.log('No Full-Stack component found');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
