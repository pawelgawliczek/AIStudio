#!/usr/bin/env ts-node
/**
 * Import Test Coverage Script
 *
 * This script:
 * 1. Runs Jest with coverage
 * 2. Parses coverage-summary.json
 * 3. Updates CodeMetrics table with test coverage data
 *
 * Usage: npx ts-node scripts/import-coverage.ts <projectId>
 */

import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function importCoverage(projectId: string) {
  console.log('🧪 Running tests with coverage...');

  try {
    // Run tests with coverage
    await execAsync('npm run test:cov -- --silent', {
      cwd: path.join(__dirname, '..'),
    });

    console.log('✅ Tests completed, parsing coverage...');

    // Read coverage summary
    const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');

    if (!fs.existsSync(coveragePath)) {
      console.error('❌ Coverage file not found. Make sure tests ran successfully.');
      process.exit(1);
    }

    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));

    // Get project to determine repo path
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { localPath: true, name: true },
    });

    if (!project?.localPath) {
      console.error('❌ Project not found or has no local path');
      process.exit(1);
    }

    console.log(`📊 Importing coverage for project: ${project.name}`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Process each file in coverage report
    for (const [absolutePath, coverage] of Object.entries(coverageData)) {
      if (absolutePath === 'total') continue;

      const fileCoverage = coverage as any;

      // Convert absolute path to relative path from project root
      let relativePath = absolutePath;

      // Try to make path relative to project localPath
      if (absolutePath.startsWith(project.localPath)) {
        relativePath = absolutePath.substring(project.localPath.length + 1);
      } else if (absolutePath.startsWith('/')) {
        // Try to extract relative path from common patterns
        const backendMatch = absolutePath.match(/\/backend\/(.+)$/);
        const frontendMatch = absolutePath.match(/\/frontend\/(.+)$/);

        if (backendMatch) {
          relativePath = `backend/${backendMatch[1]}`;
        } else if (frontendMatch) {
          relativePath = `frontend/${frontendMatch[1]}`;
        } else {
          // Skip if we can't determine relative path
          skippedCount++;
          continue;
        }
      }

      // Calculate overall coverage percentage
      // Jest provides: statements, branches, functions, lines
      const coveragePercent = Math.round(
        (fileCoverage.statements.pct +
          fileCoverage.branches.pct +
          fileCoverage.functions.pct +
          fileCoverage.lines.pct) / 4
      );

      // Update CodeMetrics table
      try {
        await prisma.codeMetrics.updateMany({
          where: {
            projectId,
            filePath: relativePath,
          },
          data: {
            testCoverage: coveragePercent,
          },
        });

        updatedCount++;

        if (updatedCount % 10 === 0) {
          console.log(`  Updated ${updatedCount} files...`);
        }
      } catch (error) {
        // File might not exist in CodeMetrics yet
        skippedCount++;
      }
    }

    console.log(`\n✅ Coverage import complete!`);
    console.log(`   Updated: ${updatedCount} files`);
    console.log(`   Skipped: ${skippedCount} files (not in CodeMetrics table)`);

    // Show overall coverage
    const totalCoverage = coverageData.total as any;
    if (totalCoverage) {
      console.log(`\n📈 Overall Coverage:`);
      console.log(`   Statements: ${totalCoverage.statements.pct}%`);
      console.log(`   Branches: ${totalCoverage.branches.pct}%`);
      console.log(`   Functions: ${totalCoverage.functions.pct}%`);
      console.log(`   Lines: ${totalCoverage.lines.pct}%`);
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
  console.error('Usage: npx ts-node scripts/import-coverage.ts <projectId>');
  process.exit(1);
}

importCoverage(projectId).catch(console.error);
