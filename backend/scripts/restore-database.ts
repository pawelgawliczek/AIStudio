#!/usr/bin/env ts-node

/**
 * Restore Database CLI - Manual database restoration from backup
 *
 * Usage:
 *   npm run db:restore -- --list                           # List available backups
 *   npm run db:restore -- --file backup.dump               # Restore from backup
 *   npm run db:restore -- --file backup.dump --force       # Force restore (skip confirmation)
 *   npm run db:restore -- --file backup.dump --skip-validation  # Skip validation
 */

import * as readline from 'readline';
import { RestoreService } from '../src/services/restore.service';
import { formatBytes } from '../src/utils/file-system.util';

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Database Restore Tool                ║');
  console.log('╚════════════════════════════════════════╝\n');

  const service = new RestoreService();

  // List backups mode
  if (args.includes('--list')) {
    console.log('Available backups:\n');
    const backups = await service.listBackups();

    if (backups.length === 0) {
      console.log('No backups found.');
      process.exit(0);
    }

    backups.forEach((backup, i) => {
      console.log(`${i + 1}. ${backup.filename}`);
      console.log(`   Type: ${backup.type}`);
      console.log(`   Size: ${formatBytes(backup.size)}`);
      console.log(`   Location: ${backup.filepath}`);
      if (backup.context) {
        console.log(`   Context: ${backup.context}`);
      }
      console.log('');
    });

    process.exit(0);
  }

  // Restore mode
  const backupFile = args.find((a) => a.startsWith('--file='))?.split('=')[1];

  if (!backupFile) {
    console.error('Error: --file parameter required');
    console.error('Usage: npm run db:restore -- --file <backup-filename>');
    console.error('       npm run db:restore -- --list');
    process.exit(1);
  }

  const force = args.includes('--force');
  const skipValidation = args.includes('--skip-validation');

  try {
    // Show warning
    console.log('⚠️  WARNING: This will restore the database to a previous state.');
    console.log('⚠️  All changes made after the backup was created will be LOST.');
    console.log('');
    console.log(`Backup file: ${backupFile}`);
    console.log('');

    // Ask for confirmation unless --force
    if (!force) {
      const confirmed = await askConfirmation(
        'Are you sure you want to continue? Type "yes" to proceed: '
      );

      if (!confirmed) {
        console.log('\nRestore cancelled.');
        process.exit(0);
      }
    }

    console.log('\nStarting restore...\n');

    const result = await service.restoreFromBackup(backupFile, {
      force: true,
      skipValidation,
    });

    if (result.success) {
      console.log('\n✅ Database restored successfully!\n');
      console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);

      if (result.errors.length > 0) {
        console.log('\nWarnings:');
        result.errors.forEach((e) => console.log(`  - ${e}`));
      }

      console.log('');
      process.exit(0);
    } else {
      console.error('\n❌ Restore failed!\n');
      console.error('Errors:');
      result.errors.forEach((e) => console.error(`  - ${e}`));
      console.error('');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Restore error:', error.message, '\n');
    process.exit(1);
  }
}

main();
