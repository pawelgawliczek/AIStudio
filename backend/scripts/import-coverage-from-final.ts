#!/usr/bin/env ts-node
/**
 * Import Test Coverage from coverage-final.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importCoverage(projectId: string) {
  console.log('📊 Importing coverage from coverage-final.json...');

  try {
    // Read coverage file
    const coveragePath = path.join(__dirname, '../coverage/coverage-final.json');

    if (!fs.existsSync(coveragePath)) {
      console.error('❌ coverage-final.json not found. Run: npm run test:cov');
      process.exit(1);
    }

    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));

    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { localPath: true, name: true },
    });

    if (!project?.localPath) {
      console.error('❌ Project not found or has no local path');
      process.exit(1);
    }

    console.log(`📈 Processing coverage for project: ${project.name}`);

    let updatedCount = 0;
    let totalCoverage = { statements: 0, branches: 0, functions: 0, lines: 0, fileCount: 0 };

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
        project.localPath + '/',           // Project local path
        '/opt/stack/AIStudio/',            // Host path
        '/app/',                           // Container path
      ];

      for (const prefix of pathPrefixes) {
        if (prefix && relativePath.startsWith(prefix)) {
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

      // Accumulate totals
      totalCoverage.statements += stmtPercent;
      totalCoverage.branches += branchPercent;
      totalCoverage.functions += funcPercent;
      totalCoverage.fileCount++;

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
          if (updatedCount % 10 === 0) {
            console.log(`  Updated ${updatedCount} files...`);
          }
        }
      } catch (error) {
        // Silently skip files not in database
      }
    }

    console.log(`\n✅ Coverage import complete!`);
    console.log(`   Updated: ${updatedCount} files`);

    if (totalCoverage.fileCount > 0) {
      console.log(`\n📈 Overall Coverage:`);
      console.log(`   Statements: ${Math.round(totalCoverage.statements / totalCoverage.fileCount)}%`);
      console.log(`   Branches: ${Math.round(totalCoverage.branches / totalCoverage.fileCount)}%`);
      console.log(`   Functions: ${Math.round(totalCoverage.functions / totalCoverage.fileCount)}%`);
    }

  } catch (error: any) {
    console.error('❌ Error importing coverage:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const projectId = process.argv[2];

if (!projectId) {
  console.error('Usage: npx tsx scripts/import-coverage-from-final.ts <projectId>');
  process.exit(1);
}

importCoverage(projectId).catch(console.error);
