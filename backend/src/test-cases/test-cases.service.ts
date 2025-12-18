import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { TestCaseType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestCaseDto, UpdateTestCaseDto, TestCaseSearchDto } from './dto';

@Injectable()
export class TestCasesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new test case
   */
  async create(dto: CreateTestCaseDto, createdById: string) {
    // Validate project and use case exist
    const [project, useCase] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: dto.projectId } }),
      this.prisma.useCase.findUnique({ where: { id: dto.useCaseId } })
    ]);

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    if (!useCase) {
      throw new NotFoundException(`Use case with ID ${dto.useCaseId} not found`);
    }

    // Check for duplicate key within project
    const existing = await this.prisma.testCase.findUnique({
      where: {
        projectId_key: {
          projectId: dto.projectId,
          key: dto.key
        }
      }
    });

    if (existing) {
      throw new ConflictException(`Test case with key ${dto.key} already exists in this project`);
    }

    // Create test case
    return this.prisma.testCase.create({
      data: {
        projectId: dto.projectId,
        useCaseId: dto.useCaseId,
        key: dto.key,
        title: dto.title,
        description: dto.description,
        testLevel: dto.testLevel,
        priority: dto.priority || 'medium',
        preconditions: dto.preconditions,
        testSteps: dto.testSteps,
        expectedResults: dto.expectedResults,
        testData: dto.testData || null,
        testFilePath: dto.testFilePath,
        assignedToId: dto.assignedToId,
        createdById
      },
      include: {
        useCase: {
          select: {
            id: true,
            key: true,
            title: true,
            area: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Find all test cases with optional filters
   */
  async findAll(searchDto: TestCaseSearchDto) {
    const {
      projectId,
      useCaseId,
      testLevel,
      priority,
      status,
      assignedToId,
      includeRelations,
      page = 1,
      limit = 20
    } = searchDto;

    const where: any = {};

    if (projectId) where.projectId = projectId;
    if (useCaseId) where.useCaseId = useCaseId;
    if (testLevel) where.testLevel = testLevel;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;

    const skip = (page - 1) * limit;

    const [testCases, total] = await Promise.all([
      this.prisma.testCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: includeRelations ? {
          useCase: {
            select: {
              id: true,
              key: true,
              title: true,
              area: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        } : undefined
      }),
      this.prisma.testCase.count({ where })
    ]);

    return {
      data: testCases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Find a single test case by ID
   */
  async findOne(id: string, includeRelations: boolean = true) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
      include: includeRelations ? {
        useCase: {
          select: {
            id: true,
            key: true,
            title: true,
            area: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 10,
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true
              }
            }
          }
        }
      } : undefined
    });

    if (!testCase) {
      throw new NotFoundException(`Test case with ID ${id} not found`);
    }

    return testCase;
  }

  /**
   * Update a test case
   */
  async update(id: string, dto: UpdateTestCaseDto) {
    const testCase = await this.findOne(id, false);

    return this.prisma.testCase.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        testLevel: dto.testLevel,
        priority: dto.priority,
        status: dto.status,
        preconditions: dto.preconditions,
        testSteps: dto.testSteps,
        expectedResults: dto.expectedResults,
        testData: dto.testData !== undefined ? dto.testData : undefined,
        testFilePath: dto.testFilePath,
        assignedToId: dto.assignedToId
      },
      include: {
        useCase: {
          select: {
            id: true,
            key: true,
            title: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Delete a test case
   */
  async remove(id: string) {
    const testCase = await this.findOne(id, false);

    await this.prisma.testCase.delete({
      where: { id }
    });

    return { message: `Test case ${testCase.key} deleted successfully` };
  }

  /**
   * Get test cases for a specific use case with coverage statistics
   */
  async getUseCaseCoverage(useCaseId: string) {
    const useCase = await this.prisma.useCase.findUnique({
      where: { id: useCaseId },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!useCase) {
      throw new NotFoundException(`Use case with ID ${useCaseId} not found`);
    }

    // Get all test cases for this use case
    const testCases = await this.prisma.testCase.findMany({
      where: { useCaseId },
      include: {
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 1 // Get latest execution for each test case
        }
      }
    });

    // Calculate coverage statistics
    const stats = this.calculateCoverageStats(testCases);

    return {
      useCase: {
        id: useCase.id,
        key: useCase.key,
        title: useCase.title,
        area: useCase.area,
        project: useCase.project
      },
      coverage: stats,
      testCases: testCases.map(tc => ({
        ...tc,
        latestExecution: tc.executions[0] || null,
        executions: undefined as any // Remove executions array from response
      }))
    };
  }

  /**
   * Get component-level test coverage
   */
  async getComponentCoverage(projectId: string, component?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Get all use cases for the project (optionally filtered by component/area)
    const where: any = { projectId };
    if (component) {
      where.area = { contains: component, mode: 'insensitive' };
    }

    const useCases = await this.prisma.useCase.findMany({
      where,
      include: {
        testCases: {
          include: {
            executions: {
              orderBy: { executedAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    // Calculate coverage for each use case
    const useCasesCoverage = useCases.map(uc => {
      const stats = this.calculateCoverageStats(uc.testCases);
      return {
        useCase: {
          id: uc.id,
          key: uc.key,
          title: uc.title,
          area: uc.area
        },
        coverage: stats.overall,
        byLevel: {
          unit: stats.byLevel.unit.coverage,
          integration: stats.byLevel.integration.coverage,
          e2e: stats.byLevel.e2e.coverage
        },
        testCounts: {
          unit: stats.byLevel.unit.testCount,
          integration: stats.byLevel.integration.testCount,
          e2e: stats.byLevel.e2e.testCount
        },
        totalTests: stats.totalTests,
        implementedTests: stats.implementedTests
      };
    });

    // Calculate component overall coverage
    const totalCoverage = useCasesCoverage.length > 0
      ? useCasesCoverage.reduce((sum, uc) => sum + uc.coverage, 0) / useCasesCoverage.length
      : 0;

    return {
      project: {
        id: project.id,
        name: project.name
      },
      component,
      overallCoverage: Math.round(totalCoverage * 10) / 10,
      useCases: useCasesCoverage
    };
  }

  /**
   * Calculate coverage statistics for a set of test cases
   * Weighted formula: unit 30%, integration 30%, e2e 40%
   */
  private calculateCoverageStats(testCases: any[]) {
    type TestLevel = 'unit' | 'integration' | 'e2e';
    const byLevel: Record<TestLevel, { testCount: number; implemented: number; coverage: number; avgCoverage: number }> = {
      unit: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 },
      integration: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 },
      e2e: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 }
    };

    testCases.forEach(tc => {
      const level = tc.testLevel as TestLevel;
      const levelStats = byLevel[level];

      if (levelStats) {
        levelStats.testCount++;

        if (tc.status === 'implemented' || tc.status === 'automated') {
          levelStats.implemented++;
        }

        // Get coverage from latest execution
        if (tc.executions && tc.executions.length > 0) {
          const latestExecution = tc.executions[0];
          if (latestExecution.coveragePercentage) {
            levelStats.avgCoverage += Number(latestExecution.coveragePercentage);
          }
        }
      }
    });

    // Calculate averages and coverage percentages
    Object.keys(byLevel).forEach(levelKey => {
      const level = levelKey as TestLevel;
      const stats = byLevel[level];
      if (stats.implemented > 0) {
        stats.avgCoverage = stats.avgCoverage / stats.implemented;
      }
      stats.coverage = stats.testCount > 0
        ? (stats.avgCoverage * stats.implemented) / stats.testCount
        : 0;
    });

    // Calculate overall weighted coverage
    const overall =
      (byLevel.unit.coverage * 0.3) +
      (byLevel.integration.coverage * 0.3) +
      (byLevel.e2e.coverage * 0.4);

    const totalTests = testCases.length;
    const implementedTests = testCases.filter(tc =>
      tc.status === 'implemented' || tc.status === 'automated'
    ).length;
    const pendingTests = totalTests - implementedTests;

    return {
      overall: Math.round(overall * 10) / 10,
      byLevel,
      totalTests,
      implementedTests,
      pendingTests,
      implementationRate: totalTests > 0
        ? Math.round((implementedTests / totalTests) * 100)
        : 0
    };
  }

  /**
   * Identify coverage gaps for a use case
   */
  async getCoverageGaps(useCaseId: string) {
    const coverage = await this.getUseCaseCoverage(useCaseId);
    const gaps = [];

    // Check for missing test levels
    if (coverage.coverage.byLevel.unit.testCount === 0) {
      gaps.push({
        type: 'missing_level',
        level: 'unit',
        severity: 'high',
        message: 'No unit tests defined for this use case'
      });
    }

    if (coverage.coverage.byLevel.integration.testCount === 0) {
      gaps.push({
        type: 'missing_level',
        level: 'integration',
        severity: 'medium',
        message: 'No integration tests defined for this use case'
      });
    }

    if (coverage.coverage.byLevel.e2e.testCount === 0) {
      gaps.push({
        type: 'missing_level',
        level: 'e2e',
        severity: 'high',
        message: 'No E2E tests defined for this use case'
      });
    }

    // Check for low coverage at each level
    Object.entries(coverage.coverage.byLevel).forEach(([level, stats]: [string, any]) => {
      if (stats.testCount > 0 && stats.coverage < 80) {
        gaps.push({
          type: 'low_coverage',
          level,
          severity: stats.coverage < 50 ? 'high' : 'medium',
          message: `${level} test coverage is ${Math.round(stats.coverage)}% (target: 80%)`,
          currentCoverage: stats.coverage,
          targetCoverage: 80
        });
      }
    });

    // Check for pending implementations
    if (coverage.coverage.pendingTests > 0) {
      gaps.push({
        type: 'pending_implementation',
        severity: 'medium',
        message: `${coverage.coverage.pendingTests} test case(s) not yet implemented`,
        count: coverage.coverage.pendingTests
      });
    }

    return {
      useCase: coverage.useCase,
      gaps,
      gapCount: gaps.length,
      overallCoverage: coverage.coverage.overall
    };
  }
}
