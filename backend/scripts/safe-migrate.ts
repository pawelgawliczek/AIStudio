#!/usr/bin/env ts-node

/**
 * Safe Migration CLI - Main entry point for safe database migrations
 *
 * Usage:
 *   npm run migrate:safe                    # Run migrations with all safeguards
 *   npm run migrate:safe -- --dry-run       # Preview migrations without applying
 *   npm run migrate:safe -- --story-id ST-70  # Associate with story
 *   npm run migrate:safe -- --skip-validation # Skip post-migration validation (not recommended)
 */

import { SafeMigrationService } from '../src/services/safe-migration.service';
import { MigrationOptions } from '../src/types/migration.types';

async function main() {
  const args = process.argv.slice(2);

  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    environment: (args.find((a) => a.startsWith('--env='))?.split('=')[1] as any) || 'development',
    storyId: args.find((a) => a.startsWith('--story-id='))?.split('=')[1],
    skipValidation: args.includes('--skip-validation'),
  };

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Safe Database Migration Tool         ║');
  console.log('╚════════════════════════════════════════╝\n');

  const service = new SafeMigrationService();

  try {
    const result = await service.executeMigration(options);

    if (result.success) {
      console.log('\n✅ Migration completed successfully!\n');
      process.exit(0);
    } else {
      console.error('\n❌ Migration failed!\n');
      console.error('Errors:');
      result.errors.forEach((e) => console.error(`  - ${e}`));
      console.error('');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Migration error:', error.message, '\n');
    process.exit(1);
  }
}

main();
