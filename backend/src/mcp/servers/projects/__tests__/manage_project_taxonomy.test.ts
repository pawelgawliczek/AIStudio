/**
 * Integration Tests for manage_project_taxonomy MCP Tool
 * Tests all 7 actions: list, add, remove, rename, merge, suggest, validate
 */

import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../manage_project_taxonomy';

describe('manage_project_taxonomy MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    useCase: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (operations: any) => {
      if (typeof operations === 'function') {
        return operations(mockPrismaClient);
      }
      return Promise.all(operations);
    }),
  };

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    taxonomy: ['Authentication', 'Authorization', 'User Management', 'Reporting', 'Billing'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
    mockPrismaClient.$transaction.mockImplementation(async (operations: any) => {
      if (typeof operations === 'function') {
        return operations(mockPrismaClient);
      }
      return Promise.all(operations);
    });
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('manage_project_taxonomy');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('taxonomy');
    });

    it('should require projectId and action', () => {
      expect(tool.inputSchema.required).toContain('projectId');
      expect(tool.inputSchema.required).toContain('action');
    });

    it('should define valid actions', () => {
      const actionEnum = tool.inputSchema.properties.action.enum;
      expect(actionEnum).toEqual(['list', 'add', 'remove', 'rename', 'merge', 'suggest', 'validate']);
    });
  });

  describe('list action', () => {
    it('should list all taxonomy areas', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'list',
      });

      expect(result.areas).toEqual(mockProject.taxonomy);
      expect(result.count).toBe(5);
    });

    it('should include usage counts when requested', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.count
        .mockResolvedValueOnce(10) // Authentication
        .mockResolvedValueOnce(5)  // Authorization
        .mockResolvedValueOnce(3)  // User Management
        .mockResolvedValueOnce(2)  // Reporting
        .mockResolvedValueOnce(1); // Billing

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'list',
        includeUsage: true,
      });

      expect(result.usage).toBeDefined();
      expect(result.usage['Authentication']).toBe(10);
      expect(result.usage['Billing']).toBe(1);
    });

    it('should handle empty taxonomy', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        ...mockProject,
        taxonomy: [],
      });

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'list',
      });

      expect(result.areas).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should fail for non-existent project', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, {
          projectId: 'non-existent',
          action: 'list',
        })
      ).rejects.toThrow('Project with ID non-existent not found');
    });
  });

  describe('add action', () => {
    it('should add new area to taxonomy', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.project.update.mockResolvedValue({
        ...mockProject,
        taxonomy: [...mockProject.taxonomy, 'API Gateway'],
      });

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'add',
        area: 'API Gateway',
      });

      expect(result.added).toBe('API Gateway');
      expect(result.taxonomy).toContain('API Gateway');
      expect(mockPrismaClient.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'project-1' },
          data: expect.objectContaining({
            taxonomy: expect.arrayContaining(['API Gateway']),
          }),
        })
      );
    });

    it('should normalize area before adding', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.project.update.mockResolvedValue(mockProject);

      await handler(prisma, {
        projectId: 'project-1',
        action: 'add',
        area: '  api gateway  ', // Should be normalized to 'Api Gateway'
      });

      expect(mockPrismaClient.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taxonomy: expect.arrayContaining(['Api Gateway']),
          }),
        })
      );
    });

    it('should reject duplicate area (exact match)', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'add',
          area: 'Authentication',
        })
      ).rejects.toThrow('already exists');
    });

    it('should reject similar area within threshold', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'add',
          area: 'Authentcation', // Typo, should be rejected
        })
      ).rejects.toThrow('similar area');
    });

    it('should allow force add to bypass similarity check', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.project.update.mockResolvedValue(mockProject);

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'add',
        area: 'Authentcation',
        force: true,
      });

      expect(result.added).toBe('Authentcation');
      expect(result.warnings[0]).toMatch(/Similar areas exist/);
    });

    it('should require area parameter', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'add',
        } as any)
      ).rejects.toThrow('Missing required fields: area');
    });

    it('should reject empty area', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'add',
          area: '  ',
        })
      ).rejects.toThrow('area cannot be empty');
    });
  });

  describe('remove action', () => {
    it('should remove area from taxonomy', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.count.mockResolvedValue(0);
      mockPrismaClient.project.update.mockResolvedValue({
        ...mockProject,
        taxonomy: mockProject.taxonomy.filter((a) => a !== 'Billing'),
      });

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'remove',
        area: 'Billing',
      });

      expect(result.removed).toBe('Billing');
      expect(result.taxonomy).not.toContain('Billing');
    });

    it('should warn when removing area with use cases', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.count.mockResolvedValue(5);
      mockPrismaClient.project.update.mockResolvedValue({
        ...mockProject,
        taxonomy: mockProject.taxonomy.filter((a) => a !== 'Authentication'),
      });

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'remove',
        area: 'Authentication',
        force: true,
      });

      expect(result.removed).toBe('Authentication');
      expect(result.warnings[0]).toMatch(/5 use cases/);
    });

    it('should prevent removal of area with use cases without force', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.count.mockResolvedValue(5);

      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'remove',
          area: 'Authentication',
        })
      ).rejects.toThrow('5 use cases');
    });

    it('should fail for non-existent area', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'remove',
          area: 'NonExistent',
        })
      ).rejects.toThrow('not found in taxonomy');
    });

    it('should require area parameter', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'remove',
        } as any)
      ).rejects.toThrow('Missing required fields: area');
    });
  });

  describe('rename action', () => {
    it('should rename area and cascade to use cases', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.project.update.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.updateMany.mockResolvedValue({ count: 10 });

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'rename',
        area: 'User Management',
        newName: 'User Administration',
      });

      expect(result.renamed.from).toBe('User Management');
      expect(result.renamed.to).toBe('User Administration');
      expect(result.useCasesUpdated).toBe(10);
      expect(mockPrismaClient.useCase.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', area: 'User Management' },
        data: { area: 'User Administration' },
      });
    });

    it('should normalize new name', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.project.update.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.updateMany.mockResolvedValue({ count: 0 });

      await handler(prisma, {
        projectId: 'project-1',
        action: 'rename',
        area: 'Billing',
        newName: '  payment processing  ',
      });

      expect(mockPrismaClient.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taxonomy: expect.arrayContaining(['Payment Processing']),
          }),
        })
      );
    });

    it('should reject rename to existing area', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'rename',
          area: 'Billing',
          newName: 'Authentication',
        })
      ).rejects.toThrow('already exists');
    });

    it('should fail for non-existent area', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'rename',
          area: 'NonExistent',
          newName: 'NewName',
        })
      ).rejects.toThrow('not found in taxonomy');
    });

    it('should require newName parameter', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'rename',
          area: 'Billing',
        } as any)
      ).rejects.toThrow('Missing required fields: newName');
    });

    it('should use transaction for atomic update', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      await handler(prisma, {
        projectId: 'project-1',
        action: 'rename',
        area: 'Billing',
        newName: 'Payment',
      });

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });
  });

  describe('merge action', () => {
    it('should merge multiple areas into target', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.project.update.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.updateMany.mockResolvedValue({ count: 15 });

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'merge',
        areas: ['Authentication', 'Authorization'],
        targetArea: 'Security',
      });

      expect(result.merged.from).toEqual(['Authentication', 'Authorization']);
      expect(result.merged.to).toBe('Security');
      expect(result.useCasesUpdated).toBe(15);
    });

    it('should remove merged areas from taxonomy', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.project.update.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.updateMany.mockResolvedValue({ count: 0 });

      await handler(prisma, {
        projectId: 'project-1',
        action: 'merge',
        areas: ['Authentication', 'Authorization'],
        targetArea: 'Security',
      });

      expect(mockPrismaClient.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taxonomy: expect.not.arrayContaining(['Authentication', 'Authorization']),
          }),
        })
      );
    });

    it('should add target area if it does not exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.project.update.mockResolvedValue(mockProject);
      mockPrismaClient.useCase.updateMany.mockResolvedValue({ count: 0 });

      await handler(prisma, {
        projectId: 'project-1',
        action: 'merge',
        areas: ['Billing', 'Reporting'],
        targetArea: 'Finance',
      });

      expect(mockPrismaClient.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taxonomy: expect.arrayContaining(['Finance']),
          }),
        })
      );
    });

    it('should require at least 2 areas to merge', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'merge',
          areas: ['Authentication'],
          targetArea: 'Security',
        } as any)
      ).rejects.toThrow('at least 2 areas');
    });

    it('should require targetArea parameter', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'merge',
          areas: ['Authentication', 'Authorization'],
        } as any)
      ).rejects.toThrow('Missing required fields: targetArea');
    });

    it('should use transaction for atomic update', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      await handler(prisma, {
        projectId: 'project-1',
        action: 'merge',
        areas: ['Authentication', 'Authorization'],
        targetArea: 'Security',
      });

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });
  });

  describe('suggest action', () => {
    it('should return similar areas for input', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'suggest',
        area: 'Authentcation', // Typo
      });

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].area).toBe('Authentication');
    });

    it('should return empty array when no similar areas', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'suggest',
        area: 'Completely Different',
      });

      expect(result.suggestions).toEqual([]);
    });

    it('should normalize input before comparison', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'suggest',
        area: '  AUTHENTICATION  ',
      });

      expect(result.suggestions[0].distance).toBe(0);
    });

    it('should require area parameter', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'suggest',
        } as any)
      ).rejects.toThrow('Missing required fields: area');
    });
  });

  describe('validate action', () => {
    it('should return valid for existing area', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'validate',
        area: 'Authentication',
      });

      expect(result.valid).toBe(true);
      expect(result.exactMatch).toBe(true);
    });

    it('should return valid with suggestions for similar area', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'validate',
        area: 'Authentcation',
      });

      expect(result.valid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should return invalid for new area', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'validate',
        area: 'New Area',
      });

      expect(result.valid).toBe(false);
      expect(result.exactMatch).toBe(false);
      expect(result.suggestions).toEqual([]);
    });

    it('should require area parameter', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'validate',
        } as any)
      ).rejects.toThrow('Missing required fields: area');
    });
  });

  describe('Error Handling', () => {
    it('should require projectId', async () => {
      await expect(
        handler(prisma, {
          action: 'list',
        } as any)
      ).rejects.toThrow('projectId');
    });

    it('should require action', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
        } as any)
      ).rejects.toThrow('action');
    });

    it('should reject invalid action', async () => {
      await expect(
        handler(prisma, {
          projectId: 'project-1',
          action: 'invalid',
        } as any)
      ).rejects.toThrow('Invalid action');
    });

    it('should handle null taxonomy gracefully', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        ...mockProject,
        taxonomy: null,
      });

      const result = await handler(prisma, {
        projectId: 'project-1',
        action: 'list',
      });

      expect(result.areas).toEqual([]);
    });
  });
});
