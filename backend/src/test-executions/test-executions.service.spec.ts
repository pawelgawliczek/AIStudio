import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TestExecutionsService } from './test-executions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportTestExecutionDto } from './dto';

describe('TestExecutionsService', () => {
  let service: TestExecutionsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    testCase: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    story: {
      findUnique: jest.fn(),
    },
    testExecution: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockTestCase = {
    id: 'test-case-id',
    key: 'TC-TEST-001',
    title: 'Test Case',
    testLevel: 'unit' as any,
    status: 'pending' as any,
  };

  const mockStory = {
    id: 'story-id',
    key: 'ST-1',
    title: 'Test Story',
  };

  const mockExecution = {
    id: 'execution-id',
    testCaseId: 'test-case-id',
    storyId: 'story-id',
    commitHash: 'abc123',
    executedAt: new Date(),
    status: 'pass' as any,
    durationMs: 100,
    errorMessage: null,
    coveragePercentage: 85.5,
    linesCovered: 85,
    linesTotal: 100,
    ciRunId: 'ci-run-123',
    environment: 'test',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestExecutionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TestExecutionsService>(TestExecutionsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('reportExecution', () => {
    const reportDto: ReportTestExecutionDto = {
      testCaseId: 'test-case-id',
      storyId: 'story-id',
      commitHash: 'abc123',
      status: 'pass' as any,
      durationMs: 100,
      coveragePercentage: 85.5,
      linesCovered: 85,
      linesTotal: 100,
      ciRunId: 'ci-run-123',
      environment: 'test',
    };

    it('should report a test execution', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.testExecution.create.mockResolvedValue({
        ...mockExecution,
        testCase: mockTestCase,
        story: mockStory,
      });
      mockPrismaService.testCase.update.mockResolvedValue({
        ...mockTestCase,
        status: 'automated',
      });

      const result = await service.reportExecution(reportDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.testExecution.create).toHaveBeenCalled();
      expect(mockPrismaService.testCase.update).toHaveBeenCalledWith({
        where: { id: 'test-case-id' },
        data: { status: 'automated' },
      });
    });

    it('should throw NotFoundException if test case does not exist', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(null);

      await expect(service.reportExecution(reportDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if story does not exist', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.reportExecution(reportDto)).rejects.toThrow(NotFoundException);
    });

    it('should not require storyId', async () => {
      const dtoWithoutStory = { ...reportDto };
      delete dtoWithoutStory.storyId;

      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrismaService.testExecution.create.mockResolvedValue({
        ...mockExecution,
        storyId: null,
        testCase: mockTestCase,
        story: null,
      });
      mockPrismaService.testCase.update.mockResolvedValue({
        ...mockTestCase,
        status: 'automated',
      });

      const result = await service.reportExecution(dtoWithoutStory);

      expect(result).toBeDefined();
      expect(mockPrismaService.story.findUnique).not.toHaveBeenCalled();
    });

    it('should update test case status from pending to automated', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue({
        ...mockTestCase,
        status: 'pending',
      });
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.testExecution.create.mockResolvedValue({
        ...mockExecution,
        testCase: mockTestCase,
        story: mockStory,
      });
      mockPrismaService.testCase.update.mockResolvedValue({
        ...mockTestCase,
        status: 'automated',
      });

      await service.reportExecution(reportDto);

      expect(mockPrismaService.testCase.update).toHaveBeenCalledWith({
        where: { id: 'test-case-id' },
        data: { status: 'automated' },
      });
    });

    it('should not update test case status if already automated', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue({
        ...mockTestCase,
        status: 'automated',
      });
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.testExecution.create.mockResolvedValue({
        ...mockExecution,
        testCase: mockTestCase,
        story: mockStory,
      });

      await service.reportExecution(reportDto);

      expect(mockPrismaService.testCase.update).not.toHaveBeenCalled();
    });
  });

  describe('getExecutionsByTestCase', () => {
    it('should return executions for a test case', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrismaService.testExecution.findMany.mockResolvedValue([mockExecution]);

      const result = await service.getExecutionsByTestCase('test-case-id', 10);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.testExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { testCaseId: 'test-case-id' },
          take: 10,
        }),
      );
    });

    it('should throw NotFoundException if test case not found', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(null);

      await expect(service.getExecutionsByTestCase('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use default limit of 20', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrismaService.testExecution.findMany.mockResolvedValue([]);

      await service.getExecutionsByTestCase('test-case-id');

      expect(mockPrismaService.testExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        }),
      );
    });
  });
});
