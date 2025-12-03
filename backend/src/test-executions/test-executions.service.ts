import { Injectable, NotFoundException } from '@nestjs/common';
import { TestCaseStatus } from '@prisma/client';
import { getSystemUserId } from '../mcp/utils';
import { PrismaService } from '../prisma/prisma.service';
import { ReportTestExecutionDto, FilterTestExecutionDto } from './dto';

@Injectable()
export class TestExecutionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Report a new test execution (called by CI/CD)
   * Auto-creates test case if it doesn't exist (ST-132)
   */
  async reportExecution(dto: ReportTestExecutionDto) {
    // Validate project exists
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId }
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    // Find or create test case by key
    let testCase = await this.prisma.testCase.findFirst({
      where: {
        projectId: dto.projectId,
        key: dto.testCaseKey
      }
    });

    if (!testCase) {
      // Get system user ID
      const systemUserId = await getSystemUserId(this.prisma);

      // Find or create default "Auto-Generated Tests" use case for this project
      let defaultUseCase = await this.prisma.useCase.findFirst({
        where: {
          projectId: dto.projectId,
          key: 'UC-AUTO-TESTS'
        }
      });

      if (!defaultUseCase) {
        // Create use case with initial version
        defaultUseCase = await this.prisma.useCase.create({
          data: {
            projectId: dto.projectId,
            key: 'UC-AUTO-TESTS',
            title: 'Auto-Generated Tests',
            area: 'Testing',
            versions: {
              create: {
                version: 1,
                summary: 'Container for auto-generated test cases',
                content: 'This use case contains test cases that were automatically generated from test execution reports.',
                createdById: systemUserId
              }
            }
          }
        });
      }

      // Auto-create test case (ST-132 requirement)
      testCase = await this.prisma.testCase.create({
        data: {
          projectId: dto.projectId,
          useCaseId: defaultUseCase.id,
          key: dto.testCaseKey,
          title: dto.testCaseTitle,
          testLevel: dto.testLevel,
          status: TestCaseStatus.automated,
          priority: 'medium',
          description: `Auto-generated test case from test execution report`,
          createdById: systemUserId
        }
      });
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
        testCaseId: testCase.id,
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
        where: { id: testCase.id },
        data: { status: TestCaseStatus.automated }
      });
    }

    return this.transformExecution(execution);
  }

  /**
   * Transform execution to convert Decimal to number
   */
  private transformExecution(execution: any): any {
    return {
      ...execution,
      coveragePercentage: execution.coveragePercentage
        ? Number(execution.coveragePercentage)
        : null
    };
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

    return this.transformExecution(execution);
  }

  /**
   * Get paginated list of test executions with filters (ST-131)
   */
  async findAll(filters: FilterTestExecutionDto) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.projectId) {
      where.testCase = { projectId: filters.projectId };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.testLevel) {
      where.testCase = { ...where.testCase, testLevel: filters.testLevel };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.executedAt = {};
      if (filters.dateFrom) {
        where.executedAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.executedAt.lte = new Date(filters.dateTo);
      }
    }

    // Execute query with pagination
    const [data, total] = await Promise.all([
      this.prisma.testExecution.findMany({
        where,
        include: {
          testCase: {
            select: {
              id: true,
              key: true,
              title: true,
              testLevel: true,
              projectId: true
            }
          },
          story: {
            select: {
              id: true,
              key: true,
              title: true
            }
          }
        },
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.testExecution.count({ where })
    ]);

    // Transform executions
    const transformedData = data.map(execution => this.transformExecution(execution));

    return {
      data: transformedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get project summary - aggregate test executions by test level (ST-132)
   */
  async getProjectSummary(projectId: string) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Get all test executions for the project
    const executions = await this.prisma.testExecution.findMany({
      where: {
        testCase: {
          projectId: projectId,
        },
      },
      include: {
        testCase: {
          select: {
            testLevel: true,
          },
        },
      },
      orderBy: {
        executedAt: 'desc',
      },
      take: 1000, // Last 1000 executions
    });

    // Initialize summary structure
    const summary = {
      unit: { total: 0, passing: 0, failing: 0, skipped: 0, coverage: 0, avgDuration: 0 },
      integration: { total: 0, passing: 0, failing: 0, skipped: 0, coverage: 0, avgDuration: 0 },
      e2e: { total: 0, passing: 0, failing: 0, skipped: 0, coverage: 0, avgDuration: 0 },
    };

    // Group by test level
    const byLevel = {
      unit: executions.filter(e => e.testCase.testLevel === 'unit'),
      integration: executions.filter(e => e.testCase.testLevel === 'integration'),
      e2e: executions.filter(e => e.testCase.testLevel === 'e2e'),
    };

    // Calculate stats per level
    for (const [level, execs] of Object.entries(byLevel)) {
      if (execs.length === 0) continue;

      const levelKey = level as 'unit' | 'integration' | 'e2e';
      summary[levelKey].total = execs.length;
      summary[levelKey].passing = execs.filter(e => e.status === 'pass').length;
      summary[levelKey].failing = execs.filter(e => e.status === 'fail').length;
      summary[levelKey].skipped = execs.filter(e => e.status === 'skip').length;

      // Calculate average coverage
      const coverages = execs
        .filter(e => e.coveragePercentage !== null)
        .map(e => Number(e.coveragePercentage));
      summary[levelKey].coverage = coverages.length > 0
        ? Math.round((coverages.reduce((a, b) => a + b, 0) / coverages.length) * 10) / 10
        : 0;

      // Calculate average duration
      const durations = execs
        .filter(e => e.durationMs !== null)
        .map(e => e.durationMs);
      summary[levelKey].avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
    }

    return summary;
  }

  /**
   * Get project trends - historical test execution data (ST-132)
   */
  async getProjectTrends(projectId: string, days: number = 30) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const executions = await this.prisma.testExecution.findMany({
      where: {
        testCase: {
          projectId: projectId,
        },
        executedAt: {
          gte: since,
        },
      },
      include: {
        testCase: {
          select: {
            testLevel: true,
          },
        },
      },
      orderBy: {
        executedAt: 'asc',
      },
    });

    // Group by day and test level
    const dayMap = new Map<string, any>();

    executions.forEach(exec => {
      const day = exec.executedAt.toISOString().split('T')[0];
      if (!dayMap.has(day)) {
        dayMap.set(day, {
          date: day,
          unit: { passed: 0, failed: 0, coverage: [] },
          integration: { passed: 0, failed: 0, coverage: [] },
          e2e: { passed: 0, failed: 0, coverage: [] },
        });
      }

      const level = exec.testCase.testLevel;
      const data = dayMap.get(day)[level];

      if (exec.status === 'pass') data.passed++;
      if (exec.status === 'fail') data.failed++;
      if (exec.coveragePercentage !== null) {
        data.coverage.push(Number(exec.coveragePercentage));
      }
    });

    // Calculate average coverage per day
    const trendData = Array.from(dayMap.values()).map(day => ({
      date: day.date,
      unit: {
        passed: day.unit.passed,
        failed: day.unit.failed,
        coverage: day.unit.coverage.length > 0
          ? Math.round((day.unit.coverage.reduce((a: number, b: number) => a + b, 0) / day.unit.coverage.length) * 10) / 10
          : 0,
      },
      integration: {
        passed: day.integration.passed,
        failed: day.integration.failed,
        coverage: day.integration.coverage.length > 0
          ? Math.round((day.integration.coverage.reduce((a: number, b: number) => a + b, 0) / day.integration.coverage.length) * 10) / 10
          : 0,
      },
      e2e: {
        passed: day.e2e.passed,
        failed: day.e2e.failed,
        coverage: day.e2e.coverage.length > 0
          ? Math.round((day.e2e.coverage.reduce((a: number, b: number) => a + b, 0) / day.e2e.coverage.length) * 10) / 10
          : 0,
      },
    }));

    return trendData;
  }
}
