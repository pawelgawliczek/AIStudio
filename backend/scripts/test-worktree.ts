/**
 * Test script for git_create_worktree tool
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../src/mcp/servers/git/git_create_worktree.js';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing git_create_worktree tool...');

    // Test with ST-39 (the story we're implementing)
    const storyId = 'd9061630-ad3a-4808-aa55-20b576e3040f';

    console.log(`\nCreating worktree for story ID: ${storyId}`);

    const result = await handler(prisma, {
      storyId,
      // Let it auto-generate branch name
    });

    console.log('\n✅ Success!');
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
