import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: '345a29ee-d6ab-477d-8079-c5dda0844d77' },
    select: { localPath: true, name: true }
  });
  console.log('Project:', project?.name);
  console.log('Local Path:', project?.localPath);

  const run = await prisma.workflowRun.findUnique({
    where: { id: 'f7ba9955-eb8a-4fd2-b8c4-b97a2d43030e' },
    select: { metadata: true }
  });

  const metadata = run?.metadata as any;
  console.log('\nST-28 Transcript Tracking:');
  console.log('Project Path (used):', metadata?._transcriptTracking?.projectPath);
  console.log('Transcript Dir:', metadata?._transcriptTracking?.transcriptDirectory);

  // Check what process.cwd() returns inside Docker
  console.log('\nprocess.cwd() in backend:', process.cwd());

  await prisma.$disconnect();
}

main();
