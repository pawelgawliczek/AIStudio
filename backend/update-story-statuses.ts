#!/usr/bin/env npx tsx

/**
 * Story Status Reconstruction Script
 * Updates story statuses based on PR merge state from GitHub
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Stories with merged PRs should be marked as "done"
const MERGED_STORIES = [
  'ST-8', 'ST-9', 'ST-10', 'ST-11', 'ST-14', 'ST-16', 'ST-17', 'ST-18',
  'ST-26', 'ST-27', 'ST-28', 'ST-36', 'ST-37', 'ST-38', 'ST-39', 'ST-40',
  'ST-41', 'ST-42', 'ST-44', 'ST-45', 'ST-46', 'ST-47', 'ST-48', 'ST-50',
  'ST-54', 'ST-56', 'ST-57', 'ST-58', 'ST-59', 'ST-60', 'ST-61', 'ST-62',
  'ST-63', 'ST-68', 'ST-69', 'ST-70', 'ST-71', 'ST-73', 'ST-74', 'ST-75',
  'ST-76', 'ST-77', 'ST-79', 'ST-80', 'ST-82', 'ST-83', 'ST-85'
];

// Stories with open PRs or in progress
const IN_PROGRESS_STORIES = [
  'ST-64', // Has commits but not merged yet
  'ST-86'  // Open PR
];

async function updateStoryStatuses() {
  console.log('Starting story status reconstruction...\n');

  // Mark merged stories as done
  console.log('Updating merged stories to "done" status...');
  for (const storyKey of MERGED_STORIES) {
    try {
      const result = await prisma.story.updateMany({
        where: { key: storyKey },
        data: { status: 'done' }
      });

      if (result.count > 0) {
        console.log(`✓ ${storyKey}: marked as done`);
      } else {
        console.log(`⚠ ${storyKey}: not found in database (may need to be created)`);
      }
    } catch (error) {
      console.error(`✗ ${storyKey}: error updating -`, error.message);
    }
  }

  console.log('\nUpdating in-progress stories...');
  for (const storyKey of IN_PROGRESS_STORIES) {
    try {
      const result = await prisma.story.updateMany({
        where: { key: storyKey },
        data: { status: 'impl' }
      });

      if (result.count > 0) {
        console.log(`✓ ${storyKey}: marked as impl`);
      } else {
        console.log(`⚠ ${storyKey}: not found in database`);
      }
    } catch (error) {
      console.error(`✗ ${storyKey}: error updating -`, error.message);
    }
  }

  // Get summary
  console.log('\n=== Summary ===');
  const statusCounts = await prisma.story.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  console.log('\nStory count by status:');
  statusCounts.forEach(({ status, _count }) => {
    console.log(`  ${status}: ${_count.status}`);
  });

  const totalStories = await prisma.story.count();
  console.log(`\nTotal stories: ${totalStories}`);
}

updateStoryStatuses()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
