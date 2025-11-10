import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportTestExecutionDto } from './dto';
import { TestCaseStatus } from '@prisma/client';

@Injectable()
export class TestExecutionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Report a new test execution (called by CI/CD)
   */
  async reportExecution(dto: ReportTestExecutionDto) {
    // Validate test case exists
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: dto.testCaseId }
    });

    if (!testCase) {
      throw new NotFoundException(`Test case with ID ${dto.testCaseId} not found`);
    }

    // Validate story if provided
    if (dto.storyId) {
      const story = await this.prisma.story.findUnique({
        where: { id: dto.storyId }
      });

      if (!story) {
        throw new NotFoundException(`Story with ID ${dto.storyId} not found`);
      }
    }

    // Create test execution
    const execution = await this.prisma.testExecution.create({
      data: {
        testCaseId: dto.testCaseId,
        storyId: dto.storyId,
        commitHash: dto.commitHash,
        executedAt: new Date(),
        status: dto.status,
        durationMs: dto.durationMs,
        errorMessage: dto.errorMessage,
        coveragePercentage: dto.coveragePercentage,
        linesCovered: dto.linesCovered,
        linesTotal: dto.linesTotal,
        ciRunId: dto.ciRunId,
        environment: dto.environment
      },
      include: {
        testCase: {
          select: {
            id: true,
            key: true,
            title: true,
            testLevel: true
          }
        },
        story: {
          select: {
            id: true,
            key: true,
            title: true
          }
        }
      }
    });

    // Update test case status to 'automated' if it was 'pending' or 'implemented'
    if (testCase.status === 'pending' || testCase.status === 'implemented') {
      await this.prisma.testCase.update({
        where: { id: dto.testCaseId },
        data: { status: TestCaseStatus.automated }
      });
    }

    return execution;
  }

  /**
   * Get executions for a test case
   */
  async getExecutionsByTestCase(testCaseId: string, limit: number = 20) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: testCaseId }
    });

    if (!testCase) {
      throw new NotFoundException(`Test case with ID ${testCaseId} not found`);
    }

    return this.prisma.testExecution.findMany({
      where: { testCaseId },
      orderBy: { executedAt: 'desc' },
      take: limit,
      include: {
        story: {
          select: {
            id: true,
            key: true,
            title: true
          }
        },
        commit: {
          select: {
            hash: true,
            message: true,
            author: true,
            timestamp: true
          }
        }
      }
    });
  }

  /**
   * Get executions for a story
   */
  async getExecutionsByStory(storyId: string, limit: number = 50) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId }
    });

    if (!story) {
      throw new NotFoundException(`Story with ID ${storyId} not found`);
    }

    return this.prisma.testExecution.findMany({
      where: { storyId },
      orderBy: { executedAt: 'desc' },
      take: limit,
      include: {
        testCase: {
          select: {
            id: true,
            key: true,
            title: true,
            testLevel: true
          }
        }
      }
    });
  }

  /**
   * Get execution statistics for a test case
   */
  async getTestCaseStatistics(testCaseId: string) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: testCaseId },
      include: {
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 30 // Last 30 executions for statistics
        }
      }
    });

    if (!testCase) {
      throw new NotFoundException(`Test case with ID ${testCaseId} not found`);
    }

    const executions = testCase.executions;
    const totalExecutions = executions.length;

    if (totalExecutions === 0) {
      return {
        testCase: {
          id: testCase.id,
          key: testCase.key,
          title: testCase.title
        },
        statistics: {
          totalExecutions: 0,
          passedExecutions: 0,
          failedExecutions: 0,
          skippedExecutions: 0,
          errorExecutions: 0,
          successRate: 0,
          avgDuration: 0,
          avgCoverage: 0,
          lastExecution: null
        }
      };
    }

    const passed = executions.filter(e => e.status === 'pass').length;
    const failed = executions.filter(e => e.status === 'fail').length;
    const skipped = executions.filter(e => e.status === 'skip').length;
    const error = executions.filter(e => e.status === 'error').length;

    const durationsWithValues = executions.filter(e => e.durationMs !== null);
    const avgDuration = durationsWithValues.length > 0
      ? durationsWithValues.reduce((sum, e) => sum + e.durationMs, 0) / durationsWithValues.length
      : 0;

    const coveragesWithValues = executions.filter(e => e.coveragePercentage !== null);
    const avgCoverage = coveragesWithValues.length > 0
      ? coveragesWithValues.reduce((sum, e) => sum + Number(e.coveragePercentage), 0) / coveragesWithValues.length
      : 0;

    return {
      testCase: {
        id: testCase.id,
        key: testCase.key,
        title: testCase.title,
        testLevel: testCase.testLevel
      },
      statistics: {
        totalExecutions,
        passedExecutions: passed,
        failedExecutions: failed,
        skippedExecutions: skipped,
        errorExecutions: error,
        successRate: Math.round((passed / totalExecutions) * 100),
        avgDuration: Math.round(avgDuration),
        avgCoverage: Math.round(avgCoverage * 10) / 10,
        lastExecution: executions[0]
      }
    };
  }

  /**
   * Get a single test execution by ID
   */
  async findOne(id: string) {
    const execution = await this.prisma.testExecution.findUnique({
      where: { id },
      include: {
        testCase: {
          select: {
            id: true,
            key: true,
            title: true,
            testLevel: true,
            useCase: {
              select: {
                id: true,
                key: true,
                title: true
              }
            }
          }
        },
        story: {
          select: {
            id: true,
            key: true,
            title: true
          }
        },
        commit: {
          select: {
            hash: true,
            message: true,
            author: true,
            timestamp: true
          }
        }
      }
    });

    if (!execution) {
      throw new NotFoundException(`Test execution with ID ${id} not found`);
    }

    return execution;
  }
}
