import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkArchitectOutput() {
  const story = await prisma.story.findUnique({
    where: { id: 'a89629d4-26e3-46b8-8746-3bd02f02e201' },
    select: {
      architectAnalysis: true,
      architectAnalyzedAt: true,
      technicalComplexity: true,
    },
  });

  if (!story) {
    console.error('Story not found');
    return;
  }

  console.log('Architect Analysis Status:');
  console.log('- architectAnalysis exists:', !!story.architectAnalysis);
  console.log('- architectAnalysis length:', story.architectAnalysis?.length || 0);
  console.log('- architectAnalyzedAt:', story.architectAnalyzedAt);
  console.log('- technicalComplexity:', story.technicalComplexity);
  
  if (story.architectAnalysis) {
    console.log('\nFirst 500 characters of architectAnalysis:');
    console.log(story.architectAnalysis.substring(0, 500));
  } else {
    console.log('\n❌ PROBLEM: architectAnalysis is NULL - architect did not store output!');
  }
}

checkArchitectOutput()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
