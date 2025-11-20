#!/usr/bin/env ts-node

/**
 * Cleanup Backups CLI - Enforce backup retention policies
 *
 * Usage:
 *   npm run db:cleanup              # Clean up old backups based on retention policy
 *   npm run db:cleanup -- --dry-run # Preview what would be deleted
 */

import { BackupService } from '../src/services/backup.service';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Backup Cleanup Tool                  ║');
  console.log('╚════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No backups will be deleted\n');
  }

  const service = new BackupService();

  try {
    if (dryRun) {
      console.log('This would delete old backups based on retention policy.');
      console.log('\nTo actually delete backups, run:');
      console.log('  npm run db:cleanup\n');
      process.exit(0);
    }

    const result = await service.cleanupOldBackups();

    console.log(`\n✅ Cleanup completed!`);
    console.log(`Deleted: ${result.deleted} backup(s)`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((e) => console.error(`  - ${e}`));
    }

    console.log('');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Cleanup error:', error.message, '\n');
    process.exit(1);
  }
}

main();
