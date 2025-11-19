#!/usr/bin/env ts-node

/**
 * Backup Database CLI - Manual database backup creation
 *
 * Usage:
 *   npm run db:backup                    # Create manual backup
 *   npm run db:backup -- --type daily    # Create daily backup
 *   npm run db:backup -- --context ST-70 # Add context to filename
 */

import { BackupService } from '../src/services/backup.service';
import { BackupType } from '../src/types/migration.types';
import { formatBytes } from '../src/utils/file-system.util';

async function main() {
  const args = process.argv.slice(2);

  let type: BackupType = BackupType.MANUAL;
  const typeArg = args.find((a) => a.startsWith('--type='))?.split('=')[1];
  if (typeArg) {
    type = typeArg as BackupType;
  }

  const context = args.find((a) => a.startsWith('--context='))?.split('=')[1];

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Database Backup Tool                 ║');
  console.log('╚════════════════════════════════════════╝\n');

  const service = new BackupService();

  try {
    console.log(`Creating ${type} backup...`);
    const backup = await service.createBackup(type, context);

    console.log('\n✅ Backup created successfully!\n');
    console.log(`Filename: ${backup.filename}`);
    console.log(`Location: ${backup.filepath}`);
    console.log(`Size: ${formatBytes(backup.size)}`);
    console.log(`Type: ${backup.type}`);

    if (backup.metadata) {
      console.log(`\nMetadata:`);
      console.log(`  Database: ${backup.metadata.databaseName}`);
      console.log(`  Tables: ${backup.metadata.tableCount}`);
      if (backup.metadata.duration) {
        console.log(`  Duration: ${(backup.metadata.duration / 1000).toFixed(1)}s`);
      }
    }

    console.log('\nVerifying backup...');
    const verification = await service.verifyBackup(backup);

    if (verification.success) {
      console.log('✅ Backup verified successfully!\n');
    } else {
      console.error('❌ Backup verification failed!');
      console.error('Errors:');
      verification.errors.forEach((e) => console.error(`  - ${e}`));
      console.error('');
      process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Backup failed:', error.message, '\n');
    process.exit(1);
  }
}

main();
