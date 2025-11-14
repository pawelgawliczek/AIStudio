import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5432/vibestudio?schema=public'
      }
    }
  });

  const projectId = '345a29ee-d6ab-477d-8079-c5dda0844d77';

  // Get overall project metrics (what the UI would show)
  const metrics = await prisma.codeMetrics.findMany({
    where: { projectId },
    select: {
      filePath: true,
      testCoverage: true,
      linesOfCode: true,
      cyclomaticComplexity: true,
      maintainabilityIndex: true,
    },
  });

  const totalFiles = metrics.length;
  const filesWithCoverage = metrics.filter(m => m.testCoverage && m.testCoverage > 0).length;
  const totalLoc = metrics.reduce((sum, m) => sum + (m.linesOfCode || 0), 0);
  const weightedCoverage = metrics.reduce((sum, m) => {
    const coverage = m.testCoverage || 0;
    const loc = m.linesOfCode || 0;
    return sum + (coverage * loc);
  }, 0);
  const avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;

  console.log('\n📊 Project Test Coverage Metrics:\n');
  console.log(`  Overall Coverage: ${avgCoverage.toFixed(1)}%`);
  console.log(`  Total Files: ${totalFiles}`);
  console.log(`  Files with Coverage > 0%: ${filesWithCoverage}`);
  console.log(`  Files with 0% Coverage: ${totalFiles - filesWithCoverage}`);
  console.log(`  Total LOC: ${totalLoc.toLocaleString()}\n`);

  console.log('📋 Recently modified workflow files:\n');
  const keyFiles = [
    'backend/src/coordinators/coordinators.service.ts',
    'backend/src/workflows/workflows.service.ts',
    'frontend/src/pages/CoordinatorLibraryView.tsx',
    'frontend/src/pages/WorkflowManagementView.tsx',
    'frontend/src/pages/ComponentLibraryView.tsx'
  ];

  for (const filePath of keyFiles) {
    const file = metrics.find(m => m.filePath === filePath);
    if (file) {
      const icon = file.testCoverage && file.testCoverage > 0 ? '✅' : '❌';
      console.log(`  ${icon} ${(file.testCoverage || 0).toFixed(1)}% | ${filePath}`);
      console.log(`     LOC: ${file.linesOfCode} | Complexity: ${file.cyclomaticComplexity || 0} | Maintainability: ${file.maintainabilityIndex || 0}`);
    } else {
      console.log(`  ⚠️  NOT IN DATABASE | ${filePath}`);
    }
  }

  console.log('\n📈 Top 10 files by coverage:\n');
  const topCoverage = metrics
    .filter(m => m.testCoverage && m.testCoverage > 0)
    .sort((a, b) => (b.testCoverage || 0) - (a.testCoverage || 0))
    .slice(0, 10);

  topCoverage.forEach(m => {
    console.log(`  ${(m.testCoverage || 0).toFixed(1)}% | ${m.filePath}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
