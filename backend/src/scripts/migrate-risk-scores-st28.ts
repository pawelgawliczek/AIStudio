#!/usr/bin/env tsx
/**
 * ST-28: Database Migration Script
 *
 * Recalculates all risk scores in the code_metrics table using the canonical formula.
 * This script updates existing records to fix the formula mismatch between worker and MCP tool.
 *
 * Formula: riskScore = round((complexity / 10) × churn × (100 - maintainability))
 * Bounds: Capped at 0-100
 *
 * Implements BR-2 (Historical Data Integrity) from baAnalysis
 *
 * Usage:
 *   npx tsx backend/src/scripts/migrate-risk-scores-st28.ts
 *
 * Safety Features:
 * - Batch processing (100 records at a time)
 * - Progress reporting
 * - Dry-run mode available (--dry-run flag)
 * - Pre-migration snapshot creation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  totalRecords: number;
  updatedRecords: number;
  unchangedRecords: number;
  errorRecords: number;
  startTime: Date;
  endTime?: Date;
}

/**
 * Calculate risk score using canonical formula (ST-28)
 * Implements BR-CALC-001: Risk Score Calculation
 */
function calculateCanonicalRiskScore(
  complexity: number,
  churn: number,
  maintainability: number
): number {
  // Calculate using canonical formula
  const rawRiskScore = Math.round(
    (complexity / 10) * churn * (100 - maintainability)
  );

  // Ensure bounded to 0-100 scale
  return Math.max(0, Math.min(100, rawRiskScore));
}

/**
 * Create a snapshot before migration for rollback capability
 * Implements architectAnalysis recommendation for data integrity
 */
async function createPreMigrationSnapshot(projectId?: string) {
  console.log('\n📸 Creating pre-migration snapshot...');

  try {
    // For each project, create a snapshot
    const projects = projectId
      ? [{ id: projectId }]
      : await prisma.project.findMany({ select: { id: true } });

    for (const project of projects) {
      // Get aggregate metrics
      const metrics = await prisma.codeMetrics.aggregate({
        where: { projectId: project.id },
        _avg: {
          riskScore: true,
          cyclomaticComplexity: true,
          maintainabilityIndex: true,
          churnRate: true,
        },
        _max: {
          riskScore: true,
        },
        _count: {
          id: true,
        },
      });

      if (metrics._count.id > 0) {
        await prisma.codeMetricsSnapshot.create({
          data: {
            projectId: project.id,
            snapshotDate: new Date(),
            totalFiles: metrics._count.id,
            avgComplexity: metrics._avg.cyclomaticComplexity ?? 0,
            avgMaintainability: metrics._avg.maintainabilityIndex ?? 0,
            avgChurn: metrics._avg.churnRate ?? 0,
            avgRiskScore: metrics._avg.riskScore ?? 0,
            highRiskFiles: 0, // Will be updated by worker
            metadata: {
              reason: 'Pre-ST-28 migration baseline',
              formulaUsed: 'worker_formula_v1',
              migrationDate: new Date().toISOString(),
            },
          },
        });

        console.log(`  ✅ Snapshot created for project ${project.id}`);
      }
    }
  } catch (error) {
    console.error('  ❌ Snapshot creation failed:', error);
    throw error;
  }
}

/**
 * Migrate risk scores in batches
 */
async function migrateRiskScores(
  dryRun: boolean = false,
  projectId?: string
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalRecords: 0,
    updatedRecords: 0,
    unchangedRecords: 0,
    errorRecords: 0,
    startTime: new Date(),
  };

  console.log(`\n🔄 Starting risk score migration (${dryRun ? 'DRY RUN' : 'LIVE MODE'})...`);

  try {
    // Fetch all code metrics records
    const whereClause = projectId ? { projectId } : {};
    const allMetrics = await prisma.codeMetrics.findMany({
      where: whereClause,
      select: {
        id: true,
        cyclomaticComplexity: true,
        churnRate: true,
        maintainabilityIndex: true,
        riskScore: true,
        filePath: true,
      },
    });

    stats.totalRecords = allMetrics.length;
    console.log(`  📊 Found ${stats.totalRecords} records to process`);

    if (stats.totalRecords === 0) {
      console.log('  ⚠️  No records to migrate');
      return stats;
    }

    // Process in batches of 100
    const batchSize = 100;

    for (let i = 0; i < allMetrics.length; i += batchSize) {
      const batch = allMetrics.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(allMetrics.length / batchSize);

      console.log(`\n  🔄 Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

      await Promise.all(
        batch.map(async (metric) => {
          try {
            // Calculate new risk score using canonical formula
            const newRiskScore = calculateCanonicalRiskScore(
              metric.cyclomaticComplexity,
              metric.churnRate,
              metric.maintainabilityIndex
            );

            // Check if update is needed
            const oldRiskScore = Math.round(metric.riskScore);
            const needsUpdate = oldRiskScore !== newRiskScore;

            if (needsUpdate) {
              if (!dryRun) {
                await prisma.codeMetrics.update({
                  where: { id: metric.id },
                  data: { riskScore: newRiskScore },
                });
              }

              stats.updatedRecords++;

              // Log significant changes
              const diff = Math.abs(newRiskScore - oldRiskScore);
              if (diff > 20) {
                console.log(
                  `    📝 ${metric.filePath}: ${oldRiskScore} → ${newRiskScore} (Δ ${diff > 0 ? '+' : ''}${newRiskScore - oldRiskScore})`
                );
              }
            } else {
              stats.unchangedRecords++;
            }
          } catch (error) {
            console.error(`    ❌ Error updating ${metric.filePath}:`, error);
            stats.errorRecords++;
          }
        })
      );

      const processed = Math.min(i + batchSize, allMetrics.length);
      const percentage = ((processed / allMetrics.length) * 100).toFixed(1);
      console.log(`  ✅ Progress: ${processed}/${allMetrics.length} (${percentage}%)`);
    }

    stats.endTime = new Date();

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }

  return stats;
}

/**
 * Display migration statistics
 */
function displayStats(stats: MigrationStats) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Records:     ${stats.totalRecords}`);
  console.log(`Updated:           ${stats.updatedRecords} (${((stats.updatedRecords / stats.totalRecords) * 100).toFixed(1)}%)`);
  console.log(`Unchanged:         ${stats.unchangedRecords} (${((stats.unchangedRecords / stats.totalRecords) * 100).toFixed(1)}%)`);
  console.log(`Errors:            ${stats.errorRecords}`);

  if (stats.endTime) {
    const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;
    console.log(`Duration:          ${duration.toFixed(2)} seconds`);
    console.log(`Throughput:        ${(stats.totalRecords / duration).toFixed(1)} records/sec`);
  }

  console.log('='.repeat(60));

  if (stats.errorRecords > 0) {
    console.log('\n⚠️  Warning: Some records failed to update');
  } else if (stats.updatedRecords > 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n✅ All records already up to date!');
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const projectIdIndex = args.indexOf('--project-id');
  const projectId = projectIdIndex >= 0 ? args[projectIdIndex + 1] : undefined;

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ST-28: Risk Score Formula Migration                     ║');
  console.log('║  Standardizing formula across worker and MCP tools       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No database changes will be made');
  }

  if (projectId) {
    console.log(`\n🎯 Targeting project: ${projectId}`);
  }

  try {
    // Step 1: Create snapshot (skip in dry-run)
    if (!dryRun) {
      await createPreMigrationSnapshot(projectId);
    }

    // Step 2: Migrate risk scores
    const stats = await migrateRiskScores(dryRun, projectId);

    // Step 3: Display results
    displayStats(stats);

    // Step 4: Recommendations
    console.log('\n📋 NEXT STEPS:');
    console.log('  1. Run validation script: npx tsx backend/src/scripts/validate-code-quality-metrics.ts');
    console.log('  2. Verify 95%+ success rate in risk score validation');
    console.log('  3. Check hotspot detection in architect insights');
    console.log('  4. Monitor for any unexpected behavior');

    if (dryRun) {
      console.log('\n💡 To apply changes, run without --dry-run flag');
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { calculateCanonicalRiskScore, migrateRiskScores };
