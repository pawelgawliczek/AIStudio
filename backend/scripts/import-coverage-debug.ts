#!/usr/bin/env ts-node
/**
 * Import Test Coverage from coverage-final.json (DEBUG VERSION)
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Use explicit database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5432/vibestudio?schema=public'
    }
  }
});

async function importCoverage(projectId: string) {
  console.log('📊 Importing coverage from coverage-final.json (DEBUG MODE)...\n');

  try {
    // Read coverage file
    const coveragePath = path.join(__dirname, '../coverage/coverage-final.json');

    if (!fs.existsSync(coveragePath)) {
      console.error('❌ coverage-final.json not found. Run: npm run test:cov');
      process.exit(1);
    }

    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
    console.log(`📁 Coverage file loaded: ${Object.keys(coverageData).length} files\n`);

    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { localPath: true, name: true },
    });

    if (!project) {
      console.error('❌ Project not found');
      process.exit(1);
    }

    console.log(`📈 Processing coverage for project: ${project.name}`);
    console.log(`   Local path: ${project.localPath || '(not set)'}\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    const processedFiles: Array<{ path: string; coverage: number; status: string }> = [];

    // Process each file
    for (const [absolutePath, fileCoverage] of Object.entries(coverageData)) {
      const coverage = fileCoverage as any;

      // Convert absolute path to relative path
      // Handle multiple path formats:
      // 1. Container paths: /app/backend/...
      // 2. Host paths: /opt/stack/AIStudio/backend/...
      // 3. Already relative: backend/...
      let relativePath = absolutePath;

      // Remove known absolute path prefixes
      const pathPrefixes = [
        project.localPath ? project.localPath + '/' : null,  // Project local path
        '/opt/stack/AIStudio/',                               // Host path
        '/app/',                                              // Container path
      ].filter(Boolean) as string[];

      for (const prefix of pathPrefixes) {
        if (relativePath.startsWith(prefix)) {
          relativePath = relativePath.substring(prefix.length);
          break;
        }
      }

      // If still absolute, try to extract relative path from common patterns
      if (relativePath.startsWith('/')) {
        const parts = relativePath.split('/');
        const markers = ['backend', 'frontend', 'shared'];
        for (const marker of markers) {
          const index = parts.indexOf(marker);
          if (index >= 0) {
            relativePath = parts.slice(index).join('/');
            break;
          }
        }
      }

      // Skip if we couldn't normalize the path
      if (relativePath.startsWith('/') || !relativePath.includes('/')) {
        skippedCount++;
        continue;
      }

      // Calculate coverage percentages
      const statements = coverage.s || {};
      const branches = coverage.b || {};
      const functions = coverage.f || {};

      const stmtTotal = Object.keys(statements).length;
      const stmtCovered = Object.values(statements).filter((v: any) => v > 0).length;
      const stmtPercent = stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 100;

      const branchTotal = Object.keys(branches).length;
      let branchCovered = 0;
      for (const branchArray of Object.values(branches) as any[]) {
        if (Array.isArray(branchArray)) {
          branchCovered += branchArray.filter((v: any) => v > 0).length;
        }
      }
      const branchPercent = branchTotal > 0 ? (branchCovered / (branchTotal * 2)) * 100 : 100;

      const funcTotal = Object.keys(functions).length;
      const funcCovered = Object.values(functions).filter((v: any) => v > 0).length;
      const funcPercent = funcTotal > 0 ? (funcCovered / funcTotal) * 100 : 100;

      // Overall coverage
      const coveragePercent = Math.round((stmtPercent + branchPercent + funcPercent) / 3);

      // Update database
      try {
        const result = await prisma.codeMetrics.updateMany({
          where: {
            projectId,
            filePath: relativePath,
          },
          data: {
            testCoverage: coveragePercent,
          },
        });

        if (result.count > 0) {
          updatedCount++;
          processedFiles.push({ path: relativePath, coverage: coveragePercent, status: 'UPDATED' });
        } else {
          notFoundCount++;
          processedFiles.push({ path: relativePath, coverage: coveragePercent, status: 'NOT_FOUND_IN_DB' });
        }
      } catch (error) {
        processedFiles.push({ path: relativePath, coverage: coveragePercent, status: 'ERROR' });
      }
    }

    console.log(`\n✅ Coverage import complete!`);
    console.log(`   Updated: ${updatedCount} files`);
    console.log(`   Not found in DB: ${notFoundCount} files`);
    console.log(`   Skipped (path mismatch): ${skippedCount} files\n`);

    // Show detailed results for key files
    console.log('📋 Detailed results for key files:\n');
    const keyFiles = [
      'backend/src/coordinators/coordinators.service.ts',
      'backend/src/workflows/workflows.service.ts'
    ];

    for (const keyFile of keyFiles) {
      const found = processedFiles.find(f => f.path === keyFile);
      if (found) {
        console.log(`  ${found.status === 'UPDATED' ? '✅' : '❌'} ${found.path}`);
        console.log(`     Coverage: ${found.coverage}% | Status: ${found.status}\n`);
      } else {
        console.log(`  ⚠️  ${keyFile}`);
        console.log(`     NOT PROCESSED (not in coverage file)\n`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error importing coverage:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const projectId = process.argv[2];

if (!projectId) {
  console.error('Usage: npx tsx scripts/import-coverage-debug.ts <projectId>');
  process.exit(1);
}

importCoverage(projectId).catch(console.error);
