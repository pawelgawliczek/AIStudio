import { PrismaClient, MappingSource } from '@prisma/client';
import { handler } from './link_commit';

describe('link_commit automatic mapping creation', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
    commit: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    storyUseCaseLink: {
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

  describe('automatic file-to-usecase mapping', () => {
    it('should create mappings when commit is linked to story with use cases', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        author: 'test@example.com',
        timestamp: new Date(),
        message: 'Test commit',
        story: { key: 'ST-1' },
        epic: null,
        files: [
          {
            filePath: 'backend/src/auth/login.service.ts',
            locAdded: 50,
            locDeleted: 20,
          },
          {
            filePath: 'backend/src/auth/login.controller.ts',
            locAdded: 30,
            locDeleted: 10,
          },
        ],
      };

      const mockUseCaseLinks = [
        {
          useCaseId: 'uc-1',
          useCase: { key: 'UC-AUTH-001' },
        },
        {
          useCaseId: 'uc-2',
          useCase: { key: 'UC-AUTH-002' },
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.commit.findUnique.mockResolvedValue(null);
      mockPrismaClient.commit.create.mockResolvedValue(mockCommit);
      mockPrismaClient.storyUseCaseLink.findMany.mockResolvedValue(
        mockUseCaseLinks,
      );
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      const result = await handler(prisma, {
        hash: 'abc123',
        projectId: 'proj-1',
        author: 'test@example.com',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        storyId: 'story-1',
        files: [
          {
            filePath: 'backend/src/auth/login.service.ts',
            locAdded: 50,
            locDeleted: 20,
          },
          {
            filePath: 'backend/src/auth/login.controller.ts',
            locAdded: 30,
            locDeleted: 10,
          },
        ],
      });

      // 2 files × 2 use cases = 4 mappings
      expect(mockPrismaClient.fileUseCaseLink.create).toHaveBeenCalledTimes(4);
      expect(result.fileMappings.created).toBe(4);
      expect(result.fileMappings.message).toContain(
        'Created 4 file-to-usecase mapping(s)',
      );
    });

    it('should not create mappings when commit has no story', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: null,
        story: null,
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.commit.findUnique.mockResolvedValue(null);
      mockPrismaClient.commit.create.mockResolvedValue(mockCommit);

      const result = await handler(prisma, {
        hash: 'abc123',
        projectId: 'proj-1',
        author: 'test@example.com',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      });

      expect(mockPrismaClient.fileUseCaseLink.create).not.toHaveBeenCalled();
      expect(result.fileMappings.created).toBe(0);
      expect(result.fileMappings.message).toBe('No use cases linked to story');
    });

    it('should not create mappings when story has no use case links', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        story: { key: 'ST-1' },
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.commit.findUnique.mockResolvedValue(null);
      mockPrismaClient.commit.create.mockResolvedValue(mockCommit);
      mockPrismaClient.storyUseCaseLink.findMany.mockResolvedValue([]);

      const result = await handler(prisma, {
        hash: 'abc123',
        projectId: 'proj-1',
        author: 'test@example.com',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        storyId: 'story-1',
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      });

      expect(mockPrismaClient.fileUseCaseLink.create).not.toHaveBeenCalled();
      expect(result.fileMappings.created).toBe(0);
    });

    it('should update existing mappings instead of creating duplicates', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        story: { key: 'ST-1' },
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      };

      const mockUseCaseLinks = [
        {
          useCaseId: 'uc-1',
          useCase: { key: 'UC-001' },
        },
      ];

      const existingMapping = {
        id: 'mapping-1',
        occurrences: 3,
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.commit.findUnique.mockResolvedValue(null);
      mockPrismaClient.commit.create.mockResolvedValue(mockCommit);
      mockPrismaClient.storyUseCaseLink.findMany.mockResolvedValue(
        mockUseCaseLinks,
      );
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(
        existingMapping,
      );
      mockPrismaClient.fileUseCaseLink.update.mockResolvedValue({
        ...existingMapping,
        occurrences: 4,
      });

      const result = await handler(prisma, {
        hash: 'abc123',
        projectId: 'proj-1',
        author: 'test@example.com',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        storyId: 'story-1',
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      });

      expect(mockPrismaClient.fileUseCaseLink.create).not.toHaveBeenCalled();
      expect(mockPrismaClient.fileUseCaseLink.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          occurrences: { increment: 1 },
          lastSeenAt: expect.any(Date),
        },
      });
      expect(result.fileMappings.created).toBe(0);
    });

    it('should create mappings with correct source and confidence', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        story: { key: 'ST-1' },
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      };

      const mockUseCaseLinks = [
        {
          useCaseId: 'uc-1',
          useCase: { key: 'UC-001' },
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.commit.findUnique.mockResolvedValue(null);
      mockPrismaClient.commit.create.mockResolvedValue(mockCommit);
      mockPrismaClient.storyUseCaseLink.findMany.mockResolvedValue(
        mockUseCaseLinks,
      );
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      await handler(prisma, {
        hash: 'abc123',
        projectId: 'proj-1',
        author: 'test@example.com',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        storyId: 'story-1',
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      });

      expect(mockPrismaClient.fileUseCaseLink.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseId: 'uc-1',
          source: 'COMMIT_DERIVED',
          confidence: 0.8,
        },
      });
    });

    it('should handle mix of new and existing mappings', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        story: { key: 'ST-1' },
        files: [
          { filePath: 'file1.ts', locAdded: 10, locDeleted: 5 },
          { filePath: 'file2.ts', locAdded: 20, locDeleted: 10 },
        ],
      };

      const mockUseCaseLinks = [
        {
          useCaseId: 'uc-1',
          useCase: { key: 'UC-001' },
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.commit.findUnique.mockResolvedValue(null);
      mockPrismaClient.commit.create.mockResolvedValue(mockCommit);
      mockPrismaClient.storyUseCaseLink.findMany.mockResolvedValue(
        mockUseCaseLinks,
      );

      // First file mapping exists, second doesn't
      mockPrismaClient.fileUseCaseLink.findUnique
        .mockResolvedValueOnce({
          id: 'mapping-1',
          occurrences: 5,
        })
        .mockResolvedValueOnce(null);

      mockPrismaClient.fileUseCaseLink.update.mockResolvedValue({});
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      const result = await handler(prisma, {
        hash: 'abc123',
        projectId: 'proj-1',
        author: 'test@example.com',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        storyId: 'story-1',
        files: [
          { filePath: 'file1.ts', locAdded: 10, locDeleted: 5 },
          { filePath: 'file2.ts', locAdded: 20, locDeleted: 10 },
        ],
      });

      expect(mockPrismaClient.fileUseCaseLink.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.fileUseCaseLink.create).toHaveBeenCalledTimes(1);
      expect(result.fileMappings.created).toBe(1);
    });

    it('should include mapping info in commit result', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        author: 'test@example.com',
        timestamp: new Date(),
        message: 'Test commit',
        story: { key: 'ST-1' },
        epic: null,
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      };

      const mockUseCaseLinks = [
        {
          useCaseId: 'uc-1',
          useCase: { key: 'UC-001' },
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.commit.findUnique.mockResolvedValue(null);
      mockPrismaClient.commit.create.mockResolvedValue(mockCommit);
      mockPrismaClient.storyUseCaseLink.findMany.mockResolvedValue(
        mockUseCaseLinks,
      );
      mockPrismaClient.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaClient.fileUseCaseLink.create.mockResolvedValue({});

      const result = await handler(prisma, {
        hash: 'abc123',
        projectId: 'proj-1',
        author: 'test@example.com',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        storyId: 'story-1',
        files: [{ filePath: 'file1.ts', locAdded: 10, locDeleted: 5 }],
      });

      expect(result.success).toBe(true);
      expect(result.commit.hash).toBe('abc123');
      expect(result.fileMappings).toBeDefined();
      expect(result.fileMappings.created).toBe(1);
      expect(result.fileMappings.message).toBe(
        'Created 1 file-to-usecase mapping(s)',
      );
    });
  });

  describe('backward compatibility', () => {
    it('should still work when updating existing commits', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const existingCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-old',
      };

      const mockCommit = {
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-new',
        story: { key: 'ST-2' },
        epic: null,
        files: [],
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.commit.findUnique.mockResolvedValue(existingCommit);
      mockPrismaClient.commit.update.mockResolvedValue(mockCommit);
      mockPrismaClient.storyUseCaseLink.findMany.mockResolvedValue([]);

      const result = await handler(prisma, {
        hash: 'abc123',
        projectId: 'proj-1',
        author: 'test@example.com',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        storyId: 'story-new',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('updated successfully');
    });
  });
});
