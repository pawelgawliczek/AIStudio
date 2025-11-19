/**
 * Clean up test worktree from database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const storyId = 'd9061630-ad3a-4808-aa55-20b576e3040f';

    await prisma.worktree.deleteMany({
      where: { storyId },
    });

    await prisma.story.update({
      where: { id: storyId },
      data: { currentPhase: null },
    });

    console.log('✅ Cleaned up test worktree records');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
