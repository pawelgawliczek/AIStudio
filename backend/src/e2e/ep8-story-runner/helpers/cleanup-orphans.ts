#!/usr/bin/env npx tsx
/**
 * EP-8 Story Runner E2E - Orphaned Test Data Cleanup Script
 *
 * Finds and removes any orphaned test data from previous failed test runs.
 * Run this if tests fail and leave behind test projects.
 *
 * Usage: npm run test:e2e:ep8:cleanup
 */

import { PrismaClient } from '@prisma/client';
import { cleanupOrphanedTestData } from './cleanup-utils';

async function main() {
  console.log('\n============================================================');
  console.log('EP-8 E2E Test - Orphaned Data Cleanup');
  console.log('============================================================');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  const prisma = new PrismaClient();

  try {
    const result = await cleanupOrphanedTestData(prisma);

    console.log('\n============================================================');
    console.log('Cleanup Results');
    console.log('============================================================');
    console.log(`Projects deleted: ${result.projectsDeleted}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    console.log('\n============================================================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('============================================================');
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
