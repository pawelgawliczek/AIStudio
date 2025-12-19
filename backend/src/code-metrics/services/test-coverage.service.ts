import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { glob } from 'glob';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ST-37: Test Coverage Service
 * Handles test summary from coverage files and TestExecution table
 */
@Injectable()
export class TestCoverageService {
  private readonly logger = new Logger(TestCoverageService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get test execution summary (ST-37: Now uses coverage file instead of database)
   */
  async getTestSummary(projectId: string): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
    coveragePercentage?: number;
  }> {
    return this.getTestSummaryUnified(projectId);
  }

  /**
   * ST-132: Unified test summary data source
   * Primary: TestExecution table (accurate, historical)
   * Fallback: Coverage file (real-time, latest run)
   */
  async getTestSummaryUnified(projectId: string): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
    coveragePercentage?: number;
  }> {
    const recentExecutions = await this.prisma.testExecution.findMany({
      where: {
        testCase: {
          projectId: projectId,
        },
      },
      orderBy: {
        executedAt: 'desc',
      },
      take: 1000,
    });

    if (recentExecutions.length > 0) {
      const summary = {
        totalTests: recentExecutions.length,
        passing: recentExecutions.filter(e => e.status === 'pass').length,
        failing: recentExecutions.filter(e => e.status === 'fail').length,
        skipped: recentExecutions.filter(e => e.status === 'skip').length,
        lastExecution: recentExecutions[0]?.executedAt,
        coveragePercentage: 0,
      };

      const coverages = recentExecutions
        .filter(e => e.coveragePercentage !== null)
        .map(e => Number(e.coveragePercentage));
      if (coverages.length > 0) {
        summary.coveragePercentage = Math.round(
          (coverages.reduce((a, b) => a + b, 0) / coverages.length) * 10
        ) / 10;
      }

      this.logger.log(
        `Using TestExecution table for project ${projectId}: ${summary.totalTests} tests, ${summary.coveragePercentage}% coverage`
      );

      return summary;
    }

    this.logger.log(`No test executions found for project ${projectId}, falling back to coverage file`);
    try {
      return await this.getTestSummaryFromCoverage(projectId);
    } catch (error) {
      this.logger.log(`No coverage data available for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        totalTests: 0,
        passing: 0,
        failing: 0,
        skipped: 0,
        coveragePercentage: 0,
      };
    }
  }

  /**
   * ST-37: Get test summary from coverage file
   * Parses coverage-summary.json instead of querying TestCase database
   */
  async getTestSummaryFromCoverage(projectId: string): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
    coveragePercentage?: number;
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { localPath: true },
    });

    if (!project?.localPath) {
      throw new NotFoundException('Project local path not configured');
    }

    const sanitizedPath = path.normalize(project.localPath).replace(/\.\./g, '');

    // ST-359: Try mounted project path first (where tests run and generate coverage)
    // Fall back to project.localPath (Docker build path) if not found
    const PROJECT_ROOT = process.env.PROJECT_PATH || '/opt/stack/AIStudio';

    // Try multiple possible coverage locations
    const possiblePaths = [
      path.join(PROJECT_ROOT, 'backend', 'coverage', 'coverage-summary.json'),
      path.join(PROJECT_ROOT, 'coverage', 'coverage-summary.json'),
      path.join(sanitizedPath, 'coverage', 'coverage-summary.json'),
      path.join(sanitizedPath, 'backend', 'coverage', 'coverage-summary.json'),
    ];

    let coverageData: string | null = null;
    let usedPath: string = '';
    let lastExecution: Date | undefined;
    let coverage: any;

    for (const coveragePath of possiblePaths) {
      try {
        coverageData = fs.readFileSync(coveragePath, 'utf-8');
        lastExecution = fs.statSync(coveragePath).mtime;
        usedPath = coveragePath;
        this.logger.debug(`Loaded coverage from ${coveragePath}`);
        break;
      } catch {
        // Try next path
        continue;
      }
    }

    if (!coverageData) {
      throw new NotFoundException('Coverage report not found. Run tests with --coverage flag.');
    }

    try {
      coverage = JSON.parse(coverageData);
    } catch (error) {
      throw new BadRequestException('Coverage file is corrupted or invalid JSON');
    }

    const coveragePercentage = coverage.total?.lines?.pct || 0;

    const testFilePatterns = [
      `${sanitizedPath}/**/*.test.ts`,
      `${sanitizedPath}/**/*.test.tsx`,
      `${sanitizedPath}/**/*.spec.ts`,
      `${sanitizedPath}/**/*.spec.tsx`,
    ];

    let totalTests = 0;
    for (const pattern of testFilePatterns) {
      const files = await glob(pattern, { ignore: '**/node_modules/**' });
      totalTests += files.length;
    }

    this.logger.log(
      `Parsed coverage file for project ${projectId}: ${totalTests} tests, ${coveragePercentage}% coverage`,
    );

    return {
      totalTests,
      passing: totalTests,
      failing: 0,
      skipped: 0,
      lastExecution,
      coveragePercentage,
    };
  }
}
