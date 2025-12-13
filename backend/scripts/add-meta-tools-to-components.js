const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateComponents() {
  const components = await prisma.component.findMany();

  for (const comp of components) {
    let tools = comp.tools || [];
    let updated = false;

    if (!tools.includes('invoke_tool')) {
      tools.push('invoke_tool');
      updated = true;
    }

    if (!tools.includes('search_tools')) {
      tools.push('search_tools');
      updated = true;
    }

    if (updated) {
      await prisma.component.update({
        where: { id: comp.id },
        data: { tools }
      });
      console.log('Updated:', comp.name);
    }
  }

  console.log('Done');
  await prisma.$disconnect();
}

updateComponents().catch(console.error);
