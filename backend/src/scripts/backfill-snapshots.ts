/**
 * ST-18: Backfill Script for Code Metrics Snapshots
 *
 * This script creates initial historical snapshots from existing code metrics data.
 * It aggregates current metrics and creates a snapshot dated with the latest analysis timestamp.
 *
 * Usage:
 *   npm run backfill:snapshots -- --project-id=<uuid>
 *   npm run backfill:snapshots -- --all
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillOptions {
  projectId?: string;
  all?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--project-id=')) {
      options.projectId = arg.split('=')[1];
    } else if (arg === '--all') {
      options.all = true;
    }
  }

  return options;
}

/**
 * Create snapshot for a single project
 */
async function createSnapshotForProject(projectId: string): Promise<boolean> {
  try {
    console.log(`\nProcessing project: ${projectId}`);

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    if (!project) {
      console.error(`  ❌ Project ${projectId} not found`);
      return false;
    }

    console.log(`  📊 Project: ${project.name}`);

    // Check if any code metrics exist
    const metricsCount = await prisma.codeMetrics.count({
      where: { projectId },
    });

    if (metricsCount === 0) {
      console.log(`  ⚠️  No code metrics found - skipping`);
      return false;
    }

    console.log(`  📁 Found ${metricsCount} files with metrics`);

    // Get aggregated metrics (same logic as code-analysis.processor.ts)
    const stats = await prisma.codeMetrics.aggregate({
      where: { projectId },
      _avg: {
        maintainabilityIndex: true,
        cyclomaticComplexity: true,
        testCoverage: true,
      },
      _sum: {
        codeSmellCount: true,
        linesOfCode: true,
      },
      _count: {
        filePath: true,
      },
    });

    // Get latest analysis timestamp
    const latestMetric = await prisma.codeMetrics.findFirst({
      where: { projectId },
      orderBy: { lastAnalyzedAt: 'desc' },
      select: { lastAnalyzedAt: true },
    });

    if (!latestMetric) {
      console.error(`  ❌ No analyzed metrics found`);
      return false;
    }

    // Calculate health score (same logic as code-analysis.processor.ts)
    const maintainability = stats._avg.maintainabilityIndex || 0;
    const complexityPenalty = Math.min(20, (stats._avg.cyclomaticComplexity || 0) - 10);
    const smellPenalty = Math.min(20, (stats._sum.codeSmellCount || 0) / 10);
    const healthScore = Math.max(
      0,
      Math.min(100, maintainability - complexityPenalty - smellPenalty),
    );

    // Calculate tech debt ratio
    const techDebtRatio = 100 - maintainability;

    // Check if snapshot already exists for this date
    const existingSnapshot = await prisma.codeMetricsSnapshot.findUnique({
      where: {
        projectId_snapshotDate: {
          projectId,
          snapshotDate: latestMetric.lastAnalyzedAt,
        },
      },
    });

    if (existingSnapshot) {
      console.log(`  ⚠️  Snapshot already exists for ${latestMetric.lastAnalyzedAt.toISOString()}`);
      return false;
    }

    // Create the backfill snapshot
    await prisma.codeMetricsSnapshot.create({
      data: {
        projectId,
        snapshotDate: latestMetric.lastAnalyzedAt,
        totalFiles: stats._count.filePath || 0,
        totalLOC: stats._sum.linesOfCode || 0,
        avgComplexity: stats._avg.cyclomaticComplexity || 0,
        avgCoverage: stats._avg.testCoverage || 0,
        healthScore,
        techDebtRatio,
        metadata: {
          backfilled: true,
          backfilledAt: new Date().toISOString(),
        },
      },
    });

    console.log(`  ✅ Created snapshot:`);
    console.log(`     - Date: ${latestMetric.lastAnalyzedAt.toISOString()}`);
    console.log(`     - Files: ${stats._count.filePath}`);
    console.log(`     - LOC: ${stats._sum.linesOfCode}`);
    console.log(`     - Health Score: ${healthScore.toFixed(1)}`);
    console.log(`     - Coverage: ${(stats._avg.testCoverage || 0).toFixed(2)}%`);

    return true;
  } catch (error) {
    console.error(`  ❌ Error creating snapshot for project ${projectId}:`, error);
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Code Metrics Snapshot Backfill Script');
  console.log('=========================================\n');

  const options = parseArgs();

  if (!options.projectId && !options.all) {
    console.error('❌ Error: Must specify --project-id=<uuid> or --all');
    console.log('\nUsage:');
    console.log('  npm run backfill:snapshots -- --project-id=<uuid>');
    console.log('  npm run backfill:snapshots -- --all');
    process.exit(1);
  }

  let projectIds: string[] = [];

  if (options.all) {
    console.log('🔍 Finding all active projects...');
    const projects = await prisma.project.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
    });

    projectIds = projects.map(p => p.id);
    console.log(`   Found ${projectIds.length} active projects\n`);
  } else {
    projectIds = [options.projectId!];
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const projectId of projectIds) {
    const success = await createSnapshotForProject(projectId);
    if (success) {
      successCount++;
    } else {
      const hasMetrics = await prisma.codeMetrics.count({ where: { projectId } });
      if (hasMetrics === 0) {
        skipCount++;
      } else {
        errorCount++;
      }
    }
  }

  console.log('\n=========================================');
  console.log('📊 Summary:');
  console.log(`   ✅ Snapshots created: ${successCount}`);
  console.log(`   ⚠️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('\n✨ Backfill complete!');
}

// Execute main and handle errors
main()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    prisma.$disconnect();
    process.exit(1);
  });
