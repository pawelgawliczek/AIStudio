#!/usr/bin/env tsx
/**
 * Fix churnCount field by copying from churnRate
 * Then recalculate risk scores
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixChurnCount(projectId: string) {
  console.log('🔧 Fixing churnCount field for project:', projectId);

  try {
    // Get all files with churnRate but churnCount = 0
    const files = await prisma.codeMetrics.findMany({
      where: {
        projectId,
        churnCount: 0,
        churnRate: { gt: 0 },
      },
      select: {
        id: true,
        filePath: true,
        churnRate: true,
        cyclomaticComplexity: true,
        maintainabilityIndex: true,
      },
    });

    console.log(`📊 Found ${files.length} files with churnRate > 0 but churnCount = 0`);

    let updatedCount = 0;

    for (const file of files) {
      // Calculate risk score using the same formula as MetricsCalculationService
      const complexity = file.cyclomaticComplexity || 0;
      const churnCount = file.churnRate || 0;
      const maintainability = file.maintainabilityIndex || 100;

      const complexityFactor = Math.min(complexity / 10, 10);
      const churnFactor = Math.min(churnCount / 5, 10);
      const maintainabilityFactor = Math.max((100 - maintainability) / 10, 0);
      const riskScore = Math.min(
        complexityFactor * churnFactor * maintainabilityFactor * 10,
        100,
      );

      // Update record
      await prisma.codeMetrics.update({
        where: { id: file.id },
        data: {
          churnCount: Math.round(churnCount), // Copy churnRate to churnCount
          riskScore: Math.round(riskScore * 100) / 100, // Round to 2 decimals
        },
      });

      updatedCount++;
      if (updatedCount % 10 === 0) {
        console.log(`  Updated ${updatedCount}/${files.length} files...`);
      }
    }

    console.log(`✅ Updated ${updatedCount} files`);

    // Show top 10 files by risk score
    const topFiles = await prisma.codeMetrics.findMany({
      where: { projectId },
      orderBy: { riskScore: 'desc' },
      take: 10,
      select: {
        filePath: true,
        riskScore: true,
        cyclomaticComplexity: true,
        churnCount: true,
        maintainabilityIndex: true,
      },
    });

    console.log('\n📈 Top 10 files by risk score:');
    topFiles.forEach((file, idx) => {
      console.log(
        `${idx + 1}. ${file.filePath}\n   Risk: ${file.riskScore}, Complexity: ${file.cyclomaticComplexity}, Churn: ${file.churnCount}, Maintainability: ${file.maintainabilityIndex}`,
      );
    });
  } catch (error: any) {
    console.error('❌ Error fixing churn count:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const projectId = process.argv[2];

if (!projectId) {
  console.error('Usage: npx tsx scripts/fix-churn-count.ts <projectId>');
  process.exit(1);
}

fixChurnCount(projectId).catch(console.error);
