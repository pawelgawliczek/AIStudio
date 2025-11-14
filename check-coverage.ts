import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAnalysis() {
  try {
    // Check code metrics for execution files
    const executionFiles = await prisma.codeMetrics.findMany({
      where: {
        projectId: '345a29ee-d6ab-477d-8079-c5dda0844d77',
        filePath: {
          contains: 'execution'
        }
      },
      select: {
        filePath: true,
        testCoverage: true,
        linesOfCode: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 15
    });

    console.log('\n📊 Execution Files - Test Coverage Status:\n');
    executionFiles.forEach(file => {
      const coverage = file.testCoverage != null ? file.testCoverage.toFixed(1) + '%' : '0.0%';
      console.log(`  ${coverage.padEnd(8)} | ${file.filePath}`);
    });

    console.log(`\nTotal execution files found: ${executionFiles.length}`);
    if (executionFiles.length > 0) {
      console.log(`Last updated: ${executionFiles[0].updatedAt}`);
    }

    // Check total file count
    const totalCount = await prisma.codeMetrics.count({
      where: { projectId: '345a29ee-d6ab-477d-8079-c5dda0844d77' }
    });
    console.log(`\nTotal files in database: ${totalCount}`);

    // Check files with coverage > 0
    const coveredFiles = await prisma.codeMetrics.count({
      where: {
        projectId: '345a29ee-d6ab-477d-8079-c5dda0844d77',
        testCoverage: { gt: 0 }
      }
    });
    console.log(`Files with coverage > 0%: ${coveredFiles}`);

    // Show some sample files with coverage
    const samplesWithCoverage = await prisma.codeMetrics.findMany({
      where: {
        projectId: '345a29ee-d6ab-477d-8079-c5dda0844d77',
        testCoverage: { gt: 0 }
      },
      select: {
        filePath: true,
        testCoverage: true
      },
      orderBy: {
        testCoverage: 'desc'
      },
      take: 10
    });

    console.log('\n🎯 Top 10 files with test coverage:');
    samplesWithCoverage.forEach(file => {
      const coverage = file.testCoverage != null ? file.testCoverage.toFixed(1) + '%' : '0.0%';
      console.log(`  ${coverage.padEnd(8)} | ${file.filePath}`);
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAnalysis();
