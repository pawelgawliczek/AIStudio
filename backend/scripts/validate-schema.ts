#!/usr/bin/env ts-node

/**
 * Schema Validation CLI - Validate database schema without running migrations
 *
 * Usage:
 *   npm run db:validate              # Run all validation levels
 *   npm run db:validate -- --level schema  # Run specific level only
 */

import { ValidationService } from '../src/services/validation.service';
import { ValidationLevel } from '../src/types/migration.types';

async function main() {
  const args = process.argv.slice(2);

  const levelArg = args.find((a) => a.startsWith('--level='))?.split('=')[1];

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Database Schema Validation           ║');
  console.log('╚════════════════════════════════════════╝\n');

  const service = new ValidationService();

  try {
    let results;

    if (levelArg) {
      // Run specific level
      console.log(`Running ${levelArg} validation...\n`);
      switch (levelArg) {
        case 'schema':
          results = { schema: await service.validateSchema() };
          break;
        case 'dataIntegrity':
          results = { dataIntegrity: await service.validateDataIntegrity() };
          break;
        case 'health':
          results = { health: await service.validateHealth() };
          break;
        case 'smokeTests':
          results = { smokeTests: await service.runSmokeTests() };
          break;
        default:
          console.error(`Unknown validation level: ${levelArg}`);
          process.exit(1);
      }
    } else {
      // Run all levels
      console.log('Running all validation levels...\n');
      results = await service.validateAll();
    }

    // Print results
    let allPassed = true;

    for (const [level, result] of Object.entries(results)) {
      if (!result) continue;

      const icon = result.passed ? '✅' : '❌';
      console.log(`\n${icon} ${level.toUpperCase()}`);
      console.log(`Duration: ${result.duration}ms`);

      if (result.checks && result.checks.length > 0) {
        result.checks.forEach((check) => {
          const checkIcon = check.passed ? '  ✓' : '  ✗';
          console.log(`${checkIcon} ${check.name}: ${check.message || ''}`);
        });
      }

      if (result.errors && result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach((e) => console.error(`  - ${e}`));
      }

      if (!result.passed) {
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log('\n✅ All validations passed!\n');
      process.exit(0);
    } else {
      console.log('\n❌ Some validations failed!\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Validation error:', error.message, '\n');
    process.exit(1);
  }
}

main();
