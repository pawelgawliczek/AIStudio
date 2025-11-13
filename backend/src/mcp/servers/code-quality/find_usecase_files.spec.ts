import { PrismaClient, MappingSource } from '@prisma/client';
import { handler, tool } from './find_usecase_files';

describe('find_usecase_files MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    useCase: {
      findFirst: jest.fn(),
    },
    fileUseCaseLink: {
      findMany: jest.fn(),
    },
    codeMetrics: {
      findFirst: jest.fn(),
    },
    commitFile: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('find_usecase_files');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('implement a use case');
    });

    it('should require only projectId', () => {
      expect(tool.inputSchema.required).toEqual(['projectId']);
    });

    it('should have optional useCaseId and useCaseKey', () => {
      const properties = tool.inputSchema.properties;
      expect(properties.useCaseId).toBeDefined();
      expect(properties.useCaseKey).toBeDefined();
      expect(properties.minConfidence).toBeDefined();
      expect(properties.includeMetrics).toBeDefined();
    });
  });

  describe('handler', () => {
    it('should throw error when projectId is missing', async () => {
      await expect(
        handler(prisma, {
          useCaseKey: 'UC-001',
        }),
      ).rejects.toThrow('projectId is required');
    });

    it('should throw error when both useCaseId and useCaseKey are missing', async () => {
      await expect(
        handler(prisma, {
          projectId: 'proj-1',
        }),
      ).rejects.toThrow('Either useCaseId or useCaseKey is required');
    });

    it('should throw error when use case does not exist', async () => {
      mockPrismaClient.useCase.findFirst.mockResolvedValue(null);

      await expect(
        handler(prisma, {
          projectId: 'proj-1',
          useCaseKey: 'UC-NONEXISTENT',
        }),
      ).rejects.toThrow('Use case UC-NONEXISTENT not found');
    });

    it('should find use case by key', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-AUTH-001',
        title: 'User Login',
        area: 'Authentication',
        storyLinks: [],
        project: { name: 'Test Project' },
      };

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue([]);

      await handler(prisma, {
        projectId: 'proj-1',
        useCaseKey: 'UC-AUTH-001',
      });

      expect(mockPrismaClient.useCase.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          key: 'UC-AUTH-001',
        },
        include: expect.any(Object),
      });
    });

    it('should find use case by ID', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-AUTH-001',
        title: 'User Login',
        area: 'Authentication',
        storyLinks: [],
        project: { name: 'Test Project' },
      };

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue([]);

      await handler(prisma, {
        projectId: 'proj-1',
        useCaseId: 'uc-1',
      });

      expect(mockPrismaClient.useCase.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          id: 'uc-1',
        },
        include: expect.any(Object),
      });
    });

    it('should return implementing files with metrics', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-AUTH-001',
        title: 'User Login',
        area: 'Authentication',
        storyLinks: [
          {
            story: {
              key: 'ST-45',
              title: 'Implement SSO',
              status: 'in_progress',
            },
          },
        ],
        project: { name: 'Test Project' },
      };

      const mockMappings = [
        {
          filePath: 'backend/src/auth/login.service.ts',
          confidence: 0.85,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date('2025-11-10T10:30:00Z'),
          occurrences: 12,
        },
      ];

      const mockMetrics = {
        linesOfCode: 245,
        cyclomaticComplexity: 8.5,
        maintainabilityIndex: 72,
        testCoverage: 85.0,
        churnRate: 3,
        riskScore: 24.5,
      };

      const mockCommits = [
        {
          commit: {
            hash: 'abc1234567890',
            message: 'Fix login validation',
            author: 'john@example.com',
            timestamp: new Date('2025-11-10T10:30:00Z'),
          },
        },
      ];

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaClient.codeMetrics.findFirst.mockResolvedValue(mockMetrics);
      mockPrismaClient.commitFile.findMany.mockResolvedValue(mockCommits);

      const result = await handler(prisma, {
        projectId: 'proj-1',
        useCaseKey: 'UC-AUTH-001',
        includeMetrics: true,
      });

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);

      expect(data.projectName).toBe('Test Project');
      expect(data.useCase.key).toBe('UC-AUTH-001');
      expect(data.useCase.title).toBe('User Login');
      expect(data.implementingFiles).toHaveLength(1);
      expect(data.implementingFiles[0].filePath).toBe(
        'backend/src/auth/login.service.ts',
      );
      expect(data.implementingFiles[0].metrics).toEqual({
        linesOfCode: 245,
        cyclomaticComplexity: 8.5,
        maintainabilityIndex: 72,
        testCoverage: 85.0,
        churnRate: 3,
        riskScore: 24.5,
      });
      expect(data.implementingFiles[0].recentCommits).toHaveLength(1);
      expect(data.implementingFiles[0].recentCommits[0].hash).toBe('abc1234');
    });

    it('should skip metrics when includeMetrics is false', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
        project: { name: 'Test' },
      };

      const mockMappings = [
        {
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
      ];

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );

      const result = await handler(prisma, {
        projectId: 'proj-1',
        useCaseId: 'uc-1',
        includeMetrics: false,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.implementingFiles[0].metrics).toBeUndefined();
      expect(data.implementingFiles[0].recentCommits).toBeUndefined();
      expect(mockPrismaClient.codeMetrics.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaClient.commitFile.findMany).not.toHaveBeenCalled();
    });

    it('should add warning for high complexity files', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
        project: { name: 'Test' },
      };

      const mockMappings = [
        {
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
      ];

      const mockMetrics = {
        linesOfCode: 500,
        cyclomaticComplexity: 20, // High complexity
        maintainabilityIndex: 60,
        testCoverage: 80,
        churnRate: 5,
        riskScore: 45,
      };

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaClient.codeMetrics.findFirst.mockResolvedValue(mockMetrics);
      mockPrismaClient.commitFile.findMany.mockResolvedValue([]);

      const result = await handler(prisma, {
        projectId: 'proj-1',
        useCaseId: 'uc-1',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.implementingFiles[0].warning).toBe(
        'High complexity - refactor before changes',
      );
    });

    it('should add warning for low maintainability files', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
        project: { name: 'Test' },
      };

      const mockMappings = [
        {
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
      ];

      const mockMetrics = {
        linesOfCode: 300,
        cyclomaticComplexity: 8,
        maintainabilityIndex: 40, // Low maintainability
        testCoverage: 70,
        churnRate: 3,
        riskScore: 35,
      };

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaClient.codeMetrics.findFirst.mockResolvedValue(mockMetrics);
      mockPrismaClient.commitFile.findMany.mockResolvedValue([]);

      const result = await handler(prisma, {
        projectId: 'proj-1',
        useCaseId: 'uc-1',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.implementingFiles[0].warning).toBe('Low maintainability');
    });

    it('should calculate summary statistics correctly', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
        project: { name: 'Test' },
      };

      const mockMappings = [
        {
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
        {
          filePath: 'file2.ts',
          confidence: 0.9,
          source: MappingSource.MANUAL,
          lastSeenAt: new Date(),
          occurrences: 10,
        },
      ];

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );

      // First file metrics
      mockPrismaClient.codeMetrics.findFirst
        .mockResolvedValueOnce({
          linesOfCode: 100,
          cyclomaticComplexity: 5,
          maintainabilityIndex: 80,
          testCoverage: 90,
          churnRate: 2,
          riskScore: 20,
        })
        // Second file metrics
        .mockResolvedValueOnce({
          linesOfCode: 200,
          cyclomaticComplexity: 10,
          maintainabilityIndex: 70,
          testCoverage: 80,
          churnRate: 4,
          riskScore: 30,
        });

      mockPrismaClient.commitFile.findMany.mockResolvedValue([]);

      const result = await handler(prisma, {
        projectId: 'proj-1',
        useCaseId: 'uc-1',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.totalFiles).toBe(2);
      expect(data.summary.totalLOC).toBe(300);
      expect(data.summary.avgComplexity).toBeCloseTo(7.5, 1);
      expect(data.summary.avgMaintainability).toBe(75);
      expect(data.summary.avgTestCoverage).toBeCloseTo(85, 1);
      expect(data.summary.avgConfidence).toBeCloseTo(0.85, 2);
    });

    it('should generate high-risk recommendation', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
        project: { name: 'Test' },
      };

      const mockMappings = [
        {
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
      ];

      const mockMetrics = {
        linesOfCode: 500,
        cyclomaticComplexity: 15,
        maintainabilityIndex: 60,
        testCoverage: 70,
        churnRate: 8,
        riskScore: 65, // High risk
      };

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaClient.codeMetrics.findFirst.mockResolvedValue(mockMetrics);
      mockPrismaClient.commitFile.findMany.mockResolvedValue([]);

      const result = await handler(prisma, {
        projectId: 'proj-1',
        useCaseId: 'uc-1',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.highRiskFiles).toBe(1);
      expect(data.summary.recommendation).toContain('high-risk');
    });

    it('should respect minConfidence parameter', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
        project: { name: 'Test' },
      };

      mockPrismaClient.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue([]);

      await handler(prisma, {
        projectId: 'proj-1',
        useCaseId: 'uc-1',
        minConfidence: 0.75,
      });

      expect(mockPrismaClient.fileUseCaseLink.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          useCaseId: 'uc-1',
          confidence: { gte: 0.75 },
        },
        orderBy: { confidence: 'desc' },
      });
    });
  });
});
