import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const story = await prisma.story.findUnique({
    where: { id: 'a402f7f8-9d71-42fc-950d-6ebc606f9437' },
    select: {
      key: true,
      title: true,
      contextExploration: true,
      baAnalysis: true,
      designerAnalysis: true,
      contextExploredAt: true,
      baAnalyzedAt: true,
      designerAnalyzedAt: true,
    }
  });

  if (!story.contextExploration && !story.baAnalysis && !story.designerAnalysis) {
    console.log('NO_ANALYSIS_FIELDS');
    process.exit(0);
  }

  console.log(JSON.stringify({
    contextExploration: story.contextExploration,
    baAnalysis: story.baAnalysis,
    designerAnalysis: story.designerAnalysis,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
