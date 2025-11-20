import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkComponentRun() {
  const runs = await prisma.componentRun.findMany({
    where: {
      workflowRunId: '502a17d8-6300-447e-ab99-308b48cd2344',
      componentId: '1bf75572-a8fe-429b-98a7-a068486854ca',
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  console.log('Component runs found:', runs.length);
  runs.forEach(run => {
    console.log('- ID:', run.id);
    console.log('  Status:', run.status);
    console.log('  Started:', run.startedAt);
    console.log('  Finished:', run.finishedAt);
  });
}

checkComponentRun()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
