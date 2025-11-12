import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importCoverage() {
  const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
  const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));

  let updated = 0;
  let notFound = 0;

  for (const [filePath, data] of Object.entries(coverageData)) {
    if (filePath === 'total') continue;

    const coverage = (data as any).lines?.pct || 0;
    let relativePath = filePath.replace('/opt/stack/AIStudio/backend/', '').replace('/opt/stack/AIStudio/', '');

    try {
      const result = await prisma.codeMetrics.updateMany({
        where: {
          OR: [
            { filePath: relativePath },
            { filePath: `backend/${relativePath}` },
          ]
        },
        data: { testCoverage: coverage },
      });

      if (result.count > 0) {
        updated += result.count;
        console.log('Updated ' + relativePath + ': ' + coverage + '%');
      } else {
        notFound++;
      }
    } catch (error) {
      console.error('Error updating ' + relativePath + ':', error);
    }
  }

  console.log('\nImport complete!');
  console.log('Updated: ' + updated + ' files');
  console.log('Not found: ' + notFound + ' files');
}

importCoverage()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    prisma.$disconnect();
    process.exit(1);
  });
