import { PrismaClient, MappingSource } from '@prisma/client';
import { handler, tool } from './analyze_file_impact';

describe('analyze_file_impact MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
    fileUseCaseLink: {
      findMany: jest.fn(),
    },
    testCase: {
      findMany: jest.fn(),
    },
    codeMetrics: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('analyze_file_impact');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('use cases');
    });

    it('should require projectId and filePaths', () => {
      expect(tool.inputSchema.required).toContain('projectId');
      expect(tool.inputSchema.required).toContain('filePaths');
    });

    it('should have optional parameters', () => {
      const properties = tool.inputSchema.properties;
      expect(properties.minConfidence).toBeDefined();
      expect(properties.includeIndirect).toBeDefined();
    });
  });

  describe('handler', () => {
    it('should throw error when projectId is missing', async () => {
      await expect(
        handler(prisma, {
          filePaths: ['file1.ts'],
        }),
      ).rejects.toThrow('projectId is required');
    });

    it('should throw error when filePaths is missing', async () => {
      await expect(
        handler(prisma, {
          projectId: 'proj-1',
        }),
      ).rejects.toThrow('filePaths must be a non-empty array');
    });

    it('should throw error when filePaths is empty', async () => {
      await expect(
        handler(prisma, {
          projectId: 'proj-1',
          filePaths: [],
        }),
      ).rejects.toThrow('filePaths must be a non-empty array');
    });

    it('should throw error when project does not exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, {
          projectId: 'non-existent',
          filePaths: ['file1.ts'],
        }),
      ).rejects.toThrow('Project non-existent not found');
    });

    it('should return empty results when no mappings exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue([]);

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.affectedUseCases).toHaveLength(0);
      expect(data.summary.totalUseCases).toBe(0);
    });

    it('should analyze file impact and return affected use cases', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
      };

      const mockMappings = [
        {
          useCaseId: 'uc-1',
          filePath: 'backend/src/auth/login.service.ts',
          confidence: 0.85,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date('2025-11-10T10:30:00Z'),
          occurrences: 12,
          useCase: {
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
          },
        },
      ];

      const mockTestCases = [
        {
          executions: [
            {
              coveragePercentage: 78.5,
            },
          ],
        },
      ];

      const mockCodeMetrics = [
        {
          filePath: 'backend/src/auth/login.service.ts',
          cyclomaticComplexity: 12,
          maintainabilityIndex: 55,
          riskScore: 65,
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaClient.testCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(
        mockCodeMetrics,
      );

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePaths: ['backend/src/auth/login.service.ts'],
      });

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);

      expect(data.projectName).toBe('Test Project');
      expect(data.filesAnalyzed).toEqual([
        'backend/src/auth/login.service.ts',
      ]);
      expect(data.affectedUseCases).toHaveLength(1);
      expect(data.affectedUseCases[0].useCaseKey).toBe('UC-AUTH-001');
      expect(data.affectedUseCases[0].title).toBe('User Login');
      expect(data.affectedUseCases[0].riskLevel).toBe('high');
      expect(data.affectedUseCases[0].testCoverage).toBe(78.5);
      expect(data.summary.highRisk).toBe(1);
      expect(data.summary.recommendation).toContain('HIGH IMPACT');
    });

    it('should respect minConfidence parameter', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
      });
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue([]);

      await handler(prisma, {
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
        minConfidence: 0.75,
      });

      expect(mockPrismaClient.fileUseCaseLink.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          filePath: { in: ['file1.ts'] },
          confidence: { gte: 0.75 },
        },
        include: expect.any(Object),
        orderBy: { confidence: 'desc' },
      });
    });

    it('should use default minConfidence of 0.5', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
      });
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue([]);

      await handler(prisma, {
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(mockPrismaClient.fileUseCaseLink.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          confidence: { gte: 0.5 },
        }),
        include: expect.any(Object),
        orderBy: { confidence: 'desc' },
      });
    });

    it('should calculate medium risk level correctly', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockMappings = [
        {
          useCaseId: 'uc-1',
          filePath: 'file1.ts',
          confidence: 0.65,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
          useCase: {
            id: 'uc-1',
            key: 'UC-001',
            title: 'Test',
            area: null,
            storyLinks: [],
          },
        },
      ];

      const mockMetrics = [
        {
          filePath: 'file1.ts',
          cyclomaticComplexity: 8,
          maintainabilityIndex: 65,
          riskScore: 35,
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaClient.testCase.findMany.mockResolvedValue([]);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.affectedUseCases[0].riskLevel).toBe('medium');
      expect(data.summary.mediumRisk).toBe(1);
      expect(data.summary.recommendation).toContain('MEDIUM IMPACT');
    });

    it('should handle multiple files affecting multiple use cases', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockMappings = [
        {
          useCaseId: 'uc-1',
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
          useCase: {
            id: 'uc-1',
            key: 'UC-001',
            title: 'Use Case 1',
            area: null,
            storyLinks: [],
          },
        },
        {
          useCaseId: 'uc-2',
          filePath: 'file2.ts',
          confidence: 0.75,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 3,
          useCase: {
            id: 'uc-2',
            key: 'UC-002',
            title: 'Use Case 2',
            area: null,
            storyLinks: [],
          },
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaClient.testCase.findMany.mockResolvedValue([]);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePaths: ['file1.ts', 'file2.ts'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.affectedUseCases).toHaveLength(2);
      expect(data.summary.totalUseCases).toBe(2);
    });
  });
});
