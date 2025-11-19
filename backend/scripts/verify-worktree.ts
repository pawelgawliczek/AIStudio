/**
 * Verify worktree database records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const storyId = 'd9061630-ad3a-4808-aa55-20b576e3040f';

    // Check story currentPhase
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        key: true,
        title: true,
        currentPhase: true,
        status: true,
      },
    });

    console.log('\n📋 Story Details:');
    console.log(JSON.stringify(story, null, 2));

    // Check worktree record
    const worktree = await prisma.worktree.findFirst({
      where: { storyId },
    });

    console.log('\n🌳 Worktree Record:');
    console.log(JSON.stringify(worktree, null, 2));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
