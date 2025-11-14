import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:361a30c6d68396be29c7eddc3f9ff1b1cfe07675c707232a370bda33f7c8b518@127.0.0.1:5432/vibestudio?schema=public'
      }
    }
  });
  const projectId = '345a29ee-d6ab-477d-8079-c5dda0844d77';

  const files = await prisma.codeMetrics.findMany({
    where: {
      projectId,
      filePath: {
        in: [
          'backend/src/coordinators/coordinators.service.ts',
          'backend/src/workflows/workflows.service.ts',
          'frontend/src/pages/CoordinatorLibraryView.tsx',
          'frontend/src/pages/WorkflowManagementView.tsx',
          'frontend/src/pages/ComponentLibraryView.tsx'
        ]
      }
    },
    select: { filePath: true, testCoverage: true, linesOfCode: true, updatedAt: true }
  });

  console.log('\n📋 Coverage for recently modified files:\n');
  if (files.length === 0) {
    console.log('  ❌ No files found in database\n');
  } else {
    files.forEach(f => {
      const coverage = f.testCoverage?.toFixed(1) || '0.0';
      const icon = parseFloat(coverage) > 0 ? '✅' : '❌';
      console.log(`  ${icon} ${coverage}% | ${f.filePath}`);
      console.log(`     LOC: ${f.linesOfCode} | Updated: ${f.updatedAt.toISOString()}\n`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
