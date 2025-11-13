import { PrismaClient, MappingSource } from '@prisma/client';
import { handler, tool } from './update_file_mappings';

describe('update_file_mappings MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
    useCase: {
      findMany: jest.fn(),
    },
    fileUseCaseLink: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('update_file_mappings');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('create or update');
    });

    it('should require projectId, filePath, and useCaseKeys', () => {
      expect(tool.inputSchema.required).toContain('projectId');
      expect(tool.inputSchema.required).toContain('filePath');
      expect(tool.inputSchema.required).toContain('useCaseKeys');
    });

    it('should have optional source and confidence', () => {
      const properties = tool.inputSchema.properties;
      expect(properties.source).toBeDefined();
      expect(properties.confidence).toBeDefined();
    });

    it('should define valid mapping sources', () => {
      const sourceProperty = tool.inputSchema.properties.source as any;
      const sourceEnum = sourceProperty.enum;
      expect(sourceEnum).toContain('MANUAL');
      expect(sourceEnum).toContain('COMMIT_DERIVED');
      expect(sourceEnum).toContain('AI_INFERRED');
      expect(sourceEnum).toContain('PATTERN_MATCHED');
      expect(sourceEnum).toContain('IMPORT_ANALYSIS');
    });
  });

  describe('handler', () => {
    it('should throw error when projectId is missing', async () => {
      await expect(
        handler(prisma, {
          filePath: 'file1.ts',
          useCaseKeys: ['UC-001'],
        }),
      ).rejects.toThrow('projectId is required');
    });

    it('should throw error when filePath is missing', async () => {
      await expect(
        handler(prisma, {
          projectId: 'proj-1',
          useCaseKeys: ['UC-001'],
        }),
      ).rejects.toThrow('filePath is required');
    });

    it('should throw error when useCaseKeys is missing', async () => {
      await expect(
        handler(prisma, {
          projectId: 'proj-1',
          filePath: 'file1.ts',
        }),
      ).rejects.toThrow('useCaseKeys must be a non-empty array');
    });

    it('should throw error when useCaseKeys is empty', async () => {
      await expect(
        handler(prisma, {
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseKeys: [],
        }),
      ).rejects.toThrow('useCaseKeys must be a non-empty array');
    });

    it('should throw error when project does not exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, {
          projectId: 'non-existent',
          filePath: 'file1.ts',
          useCaseKeys: ['UC-001'],
        }),
      ).rejects.toThrow('Project non-existent not found');
    });

    it('should throw error when no use cases found', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([]);

      await expect(
        handler(prisma, {
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseKeys: ['UC-001'],
        }),
      ).rejects.toThrow('No use cases found with keys: UC-001');
    });

    it('should throw error when some use cases not found', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([
        { id: 'uc-1', key: 'UC-001', title: 'Test' },
      ]);

      await expect(
        handler(prisma, {
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseKeys: ['UC-001', 'UC-002'],
        }),
      ).rejects.toThrow('Use case(s) not found: UC-002');
    });

    it('should create new mapping with default MANUAL source and confidence 1.0', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([
        { id: 'uc-1', key: 'UC-001', title: 'Test Use Case' },
      ]);
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({
        id: 'mapping-1',
      });

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseKeys: ['UC-001'],
      });

      expect(mockPrismaClient.fileUseCaseLink.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseId: 'uc-1',
          source: MappingSource.MANUAL,
          confidence: 1.0,
        },
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.created).toBe(1);
      expect(data.summary.updated).toBe(0);
      expect(data.mappings[0].action).toBe('created');
    });

    it('should update existing mapping and increment occurrences', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([
        { id: 'uc-1', key: 'UC-001', title: 'Test Use Case' },
      ]);
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue({
        id: 'mapping-1',
        confidence: 0.7,
        occurrences: 3,
      });
      mockPrismaClient.fileUseCaseLink.update.mockResolvedValue({
        id: 'mapping-1',
        confidence: 0.85,
        occurrences: 4,
      });

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseKeys: ['UC-001'],
        source: 'COMMIT_DERIVED',
        confidence: 0.85,
      });

      expect(mockPrismaClient.fileUseCaseLink.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          occurrences: { increment: 1 },
          confidence: 0.85,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: expect.any(Date),
        },
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.created).toBe(0);
      expect(data.summary.updated).toBe(1);
      expect(data.mappings[0].action).toBe('updated');
      expect(data.mappings[0].previousOccurrences).toBe(3);
      expect(data.mappings[0].newOccurrences).toBe(4);
    });

    it('should handle multiple use case mappings', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([
        { id: 'uc-1', key: 'UC-001', title: 'Use Case 1' },
        { id: 'uc-2', key: 'UC-002', title: 'Use Case 2' },
      ]);
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseKeys: ['UC-001', 'UC-002'],
      });

      expect(mockPrismaClient.fileUseCaseLink.create).toHaveBeenCalledTimes(2);

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.total).toBe(2);
      expect(data.summary.created).toBe(2);
      expect(data.mappings).toHaveLength(2);
    });

    it('should use correct default confidence for different sources', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([
        { id: 'uc-1', key: 'UC-001', title: 'Test' },
      ]);
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      const testCases = [
        { source: 'MANUAL', expectedConfidence: 1.0 },
        { source: 'COMMIT_DERIVED', expectedConfidence: 0.8 },
        { source: 'AI_INFERRED', expectedConfidence: 0.5 },
        { source: 'PATTERN_MATCHED', expectedConfidence: 0.6 },
        { source: 'IMPORT_ANALYSIS', expectedConfidence: 0.7 },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        mockPrismaClient.project.findUnique.mockResolvedValue({
          id: 'proj-1',
          name: 'Test',
        });
        mockPrismaClient.useCase.findMany.mockResolvedValue([
          { id: 'uc-1', key: 'UC-001', title: 'Test' },
        ]);
        mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
        mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

        await handler(prisma, {
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseKeys: ['UC-001'],
          source: testCase.source,
        });

        expect(mockPrismaClient.fileUseCaseLink.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            confidence: testCase.expectedConfidence,
          }),
        });
      }
    });

    it('should allow custom confidence override', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([
        { id: 'uc-1', key: 'UC-001', title: 'Test' },
      ]);
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      await handler(prisma, {
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseKeys: ['UC-001'],
        source: 'AI_INFERRED',
        confidence: 0.95,
      });

      expect(mockPrismaClient.fileUseCaseLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidence: 0.95,
        }),
      });
    });

    it('should mix created and updated mappings', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([
        { id: 'uc-1', key: 'UC-001', title: 'UC 1' },
        { id: 'uc-2', key: 'UC-002', title: 'UC 2' },
      ]);

      // First mapping exists, second doesn't
      mockPrismaClient.fileUseCaseLink.findUnique
        .mockResolvedValueOnce({
          id: 'mapping-1',
          confidence: 0.8,
          occurrences: 5,
        })
        .mockResolvedValueOnce(null);

      mockPrismaClient.fileUseCaseLink.update.mockResolvedValue({
        id: 'mapping-1',
        confidence: 0.9,
        occurrences: 6,
      });
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseKeys: ['UC-001', 'UC-002'],
        confidence: 0.9,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.created).toBe(1);
      expect(data.summary.updated).toBe(1);
      expect(data.summary.total).toBe(2);
    });

    it('should return formatted result with all mapping details', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'My Project',
      });
      mockPrismaClient.useCase.findMany.mockResolvedValue([
        { id: 'uc-1', key: 'UC-AUTH-001', title: 'User Login' },
      ]);
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      const result = await handler(prisma, {
        projectId: 'proj-1',
        filePath: 'backend/src/auth/login.service.ts',
        useCaseKeys: ['UC-AUTH-001'],
        source: 'MANUAL',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.projectName).toBe('My Project');
      expect(data.filePath).toBe('backend/src/auth/login.service.ts');
      expect(data.source).toBe('MANUAL');
      expect(data.mappings[0].useCaseKey).toBe('UC-AUTH-001');
      expect(data.mappings[0].useCaseTitle).toBe('User Login');
      expect(data.mappings[0].action).toBe('created');
      expect(data.mappings[0].confidence).toBe(100);
    });
  });
});
