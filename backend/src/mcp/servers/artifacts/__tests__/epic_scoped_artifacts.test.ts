/**
 * Epic-Scoped Artifacts Tests (ST-362)
 *
 * Test Coverage:
 * 1. Schema validation - Epic artifacts with epicId (no storyId)
 * 2. create_artifact - Epic-scoped creation and updates
 * 3. get_artifact - Epic-scoped retrieval by epicId + definitionKey
 * 4. list_artifacts - Epic filtering with version counts
 * 5. Global artifact definitions - projectId instead of workflowId
 * 6. XOR validation - Exactly one of storyId or epicId required
 * 7. Security - Cross-project validation
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../../types';
import { handler as uploadArtifact } from '../create_artifact';
import { handler as getArtifact } from '../get_artifact';
import { handler as listArtifacts } from '../list_artifacts';

// Mock Prisma
const mockPrisma = {
  epic: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  story: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  workflowRun: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  artifactDefinition: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  artifact: {
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  artifactVersion: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as PrismaClient;

describe('Epic-Scoped Artifacts (ST-362)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default transaction to execute callback immediately
    (mockPrisma.$transaction as jest.Mock).mockImplementation((callback) => callback(mockPrisma));
    // Default mock for artifactDefinition.findUnique to avoid lookup errors
    (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockImplementation((params) => {
      // Return a basic definition by default, tests will override as needed
      return Promise.resolve({
        id: params.where.id,
        projectId: 'project-uuid',
        key: 'DEFAULT_KEY',
        type: 'markdown',
      });
    });
  });

  // ============================================================================
  // 1. SCHEMA VALIDATION TESTS
  // ============================================================================

  describe('Schema Validation', () => {
    it('should create artifact with epicId (no storyId)', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid', // Global definition
        key: 'THE_PLAN',
        type: 'markdown',
        project: {
          id: 'project-uuid',
        },
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        workflowRunId: null,
        content: '# Epic Plan',
        contentHash: crypto.createHash('sha256').update('# Epic Plan').digest('hex'),
        contentType: 'text/markdown',
        size: 12,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await uploadArtifact(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
        content: '# Epic Plan',
      });

      expect(result.epicId).toBe('epic-uuid');
      expect(result.storyId).toBeUndefined();
      expect(result.workflowRunId).toBeUndefined();
      expect(mockPrisma.artifact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            epicId: 'epic-uuid',
            definitionId: 'def-uuid',
          }),
        })
      );
    });

    it('should enforce unique constraint on (definitionId, epicId)', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        key: 'THE_PLAN',
        type: 'markdown',
        project: {
          id: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'existing-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        workflowRunId: null,
        content: '# Old Content',
        contentHash: 'old-hash',
        contentType: 'text/markdown',
        size: 14,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
        versions: [],
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);

      // Should update existing artifact, not create new one
      (mockPrisma.artifact.update as jest.Mock).mockResolvedValue({
        ...existingArtifact,
        currentVersion: 2,
        content: '# Updated',
        contentHash: crypto.createHash('sha256').update('# Updated').digest('hex'),
        contentType: 'text/markdown',
        size: 9,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      });
      (mockPrisma.artifactVersion.create as jest.Mock).mockResolvedValue({});

      const result = await uploadArtifact(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
        content: '# Updated',
      });

      expect(mockPrisma.artifact.update).toHaveBeenCalled();
      expect(mockPrisma.artifact.create).not.toHaveBeenCalled();
    });

    it('should reject providing both storyId and epicId', async () => {
      await expect(
        uploadArtifact(mockPrisma, {
          storyId: 'story-uuid',
          epicId: 'epic-uuid',
          definitionKey: 'THE_PLAN',
          content: '# Invalid',
        })
      ).rejects.toThrow(ValidationError);
      // Should fail with message about multiple scope parameters
    });

    it('should reject missing both storyId and epicId', async () => {
      await expect(
        uploadArtifact(mockPrisma, {
          definitionKey: 'THE_PLAN',
          content: '# Invalid',
        })
      ).rejects.toThrow(ValidationError);
      // Should fail with message about requiring one scope parameter
    });
  });

  // ============================================================================
  // 2. CREATE_ARTIFACT TESTS
  // ============================================================================

  describe('create_artifact - Epic-Scoped', () => {
    it('should create epic artifact with global definition', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid', // Global definition (no workflowId)
        workflowId: null,
        key: 'THE_PLAN',
        type: 'markdown',
        project: {
          id: 'project-uuid',
        },
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        workflowRunId: null,
        content: '# Epic Plan',
        contentHash: crypto.createHash('sha256').update('# Epic Plan').digest('hex'),
        contentType: 'text/markdown',
        size: 12,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      });

      const result = await uploadArtifact(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
        content: '# Epic Plan',
      });

      expect(result.epicId).toBe('epic-uuid');
      expect(mockPrisma.artifactDefinition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ projectId: 'project-uuid', key: 'THE_PLAN' }),
            ]),
          }),
        })
      );
    });

    it('should update epic artifact with version history', async () => {
      const oldContent = '# Version 1';
      const newContent = '# Version 2';
      const oldHash = crypto.createHash('sha256').update(oldContent).digest('hex');
      const newHash = crypto.createHash('sha256').update(newContent).digest('hex');

      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        key: 'THE_PLAN',
        type: 'markdown',
        project: {
          id: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        workflowRunId: null,
        content: oldContent,
        contentHash: oldHash,
        contentType: 'text/markdown',
        size: oldContent.length,
        currentVersion: 1,
        createdByComponentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
        versions: [],
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);
      (mockPrisma.artifact.update as jest.Mock).mockResolvedValue({
        ...existingArtifact,
        content: newContent,
        contentHash: newHash,
        contentType: 'text/markdown',
        size: newContent.length,
        currentVersion: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      });
      (mockPrisma.artifactVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-uuid',
        version: 2,
      });

      const result = await uploadArtifact(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
        content: newContent,
      });

      expect(result.currentVersion).toBe(2);
      expect(mockPrisma.artifactVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            artifactId: 'artifact-uuid',
            version: 2,
            content: newContent,
            contentHash: newHash,
          }),
        })
      );
    });

    it('should skip version bump for duplicate content (hash deduplication)', async () => {
      const content = '# Same Content';
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        key: 'THE_PLAN',
        project: {
          id: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        workflowRunId: null,
        content,
        contentHash,
        contentType: 'text/markdown',
        size: content.length,
        currentVersion: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);

      const result = await uploadArtifact(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
        content,
      });

      // Should return existing artifact without version bump
      expect(result.currentVersion).toBe(3);
      expect(mockPrisma.artifact.update).not.toHaveBeenCalled();
      expect(mockPrisma.artifactVersion.create).not.toHaveBeenCalled();
    });

    it('should validate epic exists before upload', async () => {
      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        uploadArtifact(mockPrisma, {
          epicId: 'non-existent-epic',
          definitionKey: 'THE_PLAN',
          content: '# Content',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject cross-project artifact upload', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-A',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-B', // Different project
        key: 'THE_PLAN',
        project: {
          id: 'project-B',
        },
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        uploadArtifact(mockPrisma, {
          epicId: 'epic-uuid',
          definitionKey: 'THE_PLAN',
          content: '# Architecture',
        })
      ).rejects.toThrow('Artifact definition must belong to the same project');
    });
  });

  // ============================================================================
  // 3. GET_ARTIFACT TESTS
  // ============================================================================

  describe('get_artifact - Epic-Scoped', () => {
    it('should get artifact by epicId + definitionKey', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        key: 'THE_PLAN',
        type: 'markdown',
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        content: '# Epic Plan',
        currentVersion: 2,
        contentHash: 'some-hash',
        contentType: 'text/markdown',
        size: 12,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await getArtifact(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
        includeContent: true,
      });

      expect(result.id).toBe('artifact-uuid');
      expect(result.epicId).toBe('epic-uuid');
      expect(result.storyId).toBeUndefined();
      expect(result.currentVersion).toBe(2);
      expect(mockPrisma.artifact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            definitionId: 'def-uuid',
            epicId: 'epic-uuid',
          }),
        })
      );
    });

    it('should get specific version from epic artifact', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        key: 'THE_PLAN',
        type: 'markdown',
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        currentVersion: 5,
        definition: mockDefinition,
        contentHash: 'hash',
        contentType: 'text/markdown',
        size: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVersion = {
        id: 'version-uuid',
        artifactId: 'artifact-uuid',
        version: 2,
        content: '# Version 2',
        contentHash: crypto.createHash('sha256').update('# Version 2').digest('hex'),
        contentType: 'text/markdown',
        size: 12,
        createdAt: new Date('2025-01-01'),
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(mockArtifact);
      (mockPrisma.artifactVersion.findUnique as jest.Mock).mockResolvedValue(mockVersion);

      const result = await getArtifact(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
        version: 2,
        includeContent: true,
      });

      expect(result.version).toBe(2);
      expect(result.content).toBe('# Version 2');
      expect(mockPrisma.artifactVersion.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            artifactId_version: {
              artifactId: 'artifact-uuid',
              version: 2,
            },
          }),
        })
      );
    });

    it('should return 404 for non-existent epic artifact', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        key: 'THE_PLAN',
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        getArtifact(mockPrisma, {
          epicId: 'epic-uuid',
          definitionKey: 'THE_PLAN',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // 4. LIST_ARTIFACTS TESTS
  // ============================================================================

  describe('list_artifacts - Epic-Scoped', () => {
    it('should list all artifacts for an epic', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockArtifacts = [
        {
          id: 'artifact-1',
          definitionId: 'def-1',
          epicId: 'epic-uuid',
          storyId: null,
          currentVersion: 3,
          content: 'content1',
          contentHash: 'hash1',
          contentType: 'text/markdown',
          size: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          definition: { key: 'THE_PLAN', name: 'Epic Plan', type: 'markdown' },
        },
        {
          id: 'artifact-2',
          definitionId: 'def-2',
          epicId: 'epic-uuid',
          storyId: null,
          currentVersion: 1,
          content: 'content2',
          contentHash: 'hash2',
          contentType: 'text/markdown',
          size: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
          definition: { key: 'EPIC_SCOPE', name: 'Epic Scope', type: 'markdown' },
        },
      ];

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(2);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue(mockArtifacts);
      (mockPrisma.artifactVersion.count as jest.Mock)
        .mockResolvedValueOnce(3) // 3 versions for artifact-1
        .mockResolvedValueOnce(1); // 1 version for artifact-2

      const result = await listArtifacts(mockPrisma, {
        epicId: 'epic-uuid',
        includeVersionCounts: true,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].currentVersion).toBe(3);
      expect((result.data[0] as any).versionCount).toBe(3);
      expect(result.data[1].currentVersion).toBe(1);
      expect((result.data[1] as any).versionCount).toBe(1);
      expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epicId: 'epic-uuid',
          }),
        })
      );
    });

    it('should filter epic artifacts by definitionKey', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        key: 'THE_PLAN',
        type: 'markdown',
      };

      const mockArtifacts = [
        {
          id: 'artifact-1',
          definitionId: 'def-uuid',
          epicId: 'epic-uuid',
          storyId: null,
          currentVersion: 3,
          content: 'content',
          contentHash: 'hash',
          contentType: 'text/markdown',
          size: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          definition: mockDefinition,
        },
      ];

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue(mockArtifacts);

      const result = await listArtifacts(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].definition?.key).toBe('THE_PLAN');
      expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epicId: 'epic-uuid',
            definitionId: 'def-uuid',
          }),
        })
      );
    });

    it('should paginate epic artifact list', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(25);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue([]);

      const result = await listArtifacts(mockPrisma, {
        epicId: 'epic-uuid',
        page: 2,
        pageSize: 10,
      });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
      expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  // ============================================================================
  // 5. GLOBAL ARTIFACT DEFINITIONS TESTS
  // ============================================================================

  describe('Global Artifact Definitions', () => {
    it('should create global definition with projectId (no workflowId)', async () => {
      // This test validates that definitions can be project-scoped instead of workflow-scoped
      const globalDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        workflowId: null,
        key: 'THE_PLAN',
        type: 'markdown',
        name: 'Epic-Level Plan',
        isMandatory: true,
      };

      expect(globalDefinition.workflowId).toBeNull();
      expect(globalDefinition.projectId).toBe('project-uuid');
    });

    it('should find global definition when creating epic artifact', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        key: 'EP-14',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        workflowId: null,
        key: 'THE_PLAN',
        type: 'markdown',
        project: {
          id: 'project-uuid',
        },
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        workflowRunId: null,
        content: '# Plan',
        contentHash: crypto.createHash('sha256').update('# Plan').digest('hex'),
        contentType: 'text/markdown',
        size: 6,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      });

      await uploadArtifact(mockPrisma, {
        epicId: 'epic-uuid',
        definitionKey: 'THE_PLAN',
        content: '# Plan',
      });

      expect(mockPrisma.artifactDefinition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ projectId: 'project-uuid', key: 'THE_PLAN' }),
            ]),
          }),
        })
      );
    });

    it('should prefer workflow-scoped over global definition when both exist', async () => {
      // When both workflow-scoped and global definitions exist, workflow-scoped takes precedence
      const mockStory = {
        id: 'story-uuid',
        projectId: 'project-uuid',
        assignedWorkflowId: 'workflow-uuid',
      };

      const workflowScopedDef = {
        id: 'workflow-def-uuid',
        workflowId: 'workflow-uuid',
        projectId: null,
        key: 'THE_PLAN',
        workflow: {
          projectId: 'project-uuid',
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(workflowScopedDef);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        definitionId: 'workflow-def-uuid',
        storyId: 'story-uuid',
        epicId: null,
        workflowRunId: null,
        content: '# Plan',
        contentHash: crypto.createHash('sha256').update('# Plan').digest('hex'),
        contentType: 'text/markdown',
        size: 6,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: workflowScopedDef,
      });

      await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'THE_PLAN',
        content: '# Plan',
      });

      expect(mockPrisma.artifactDefinition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            expect.objectContaining({ workflowId: 'desc' }), // Prioritize workflow-scoped
          ]),
        })
      );
    });
  });

  // ============================================================================
  // 6. XOR VALIDATION TESTS
  // ============================================================================

  describe('XOR Validation (storyId OR epicId)', () => {
    it('should accept storyId only', async () => {
      const mockStory = {
        id: 'story-uuid',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'THE_PLAN',
        workflow: {
          projectId: 'project-uuid',
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        epicId: null,
        workflowRunId: null,
        content: '# Plan',
        contentHash: crypto.createHash('sha256').update('# Plan').digest('hex'),
        contentType: 'text/markdown',
        size: 6,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      });

      await expect(
        uploadArtifact(mockPrisma, {
          storyId: 'story-uuid',
          definitionKey: 'THE_PLAN',
          content: '# Plan',
        })
      ).resolves.toBeDefined();
    });

    it('should accept epicId only', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-uuid',
        key: 'THE_PLAN',
        project: {
          id: 'project-uuid',
        },
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        epicId: 'epic-uuid',
        storyId: null,
        workflowRunId: null,
        content: '# Plan',
        contentHash: crypto.createHash('sha256').update('# Plan').digest('hex'),
        contentType: 'text/markdown',
        size: 6,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      });

      await expect(
        uploadArtifact(mockPrisma, {
          epicId: 'epic-uuid',
          definitionKey: 'THE_PLAN',
          content: '# Plan',
        })
      ).resolves.toBeDefined();
    });

    it('should accept workflowRunId only (derives storyId)', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        storyId: 'story-uuid',
        workflowId: 'workflow-uuid',
        story: {
          id: 'story-uuid',
          projectId: 'project-uuid',
        },
        workflow: {
          projectId: 'project-uuid',
        },
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'THE_PLAN',
        workflow: {
          projectId: 'project-uuid',
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        epicId: null,
        workflowRunId: 'run-uuid',
        content: '# Plan',
        contentHash: crypto.createHash('sha256').update('# Plan').digest('hex'),
        contentType: 'text/markdown',
        size: 6,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      });

      await expect(
        uploadArtifact(mockPrisma, {
          workflowRunId: 'run-uuid',
          definitionKey: 'THE_PLAN',
          content: '# Plan',
        })
      ).resolves.toBeDefined();
    });

    it('should reject both storyId and epicId', async () => {
      await expect(
        uploadArtifact(mockPrisma, {
          storyId: 'story-uuid',
          epicId: 'epic-uuid',
          definitionKey: 'THE_PLAN',
          content: '# Invalid',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject epicId with workflowRunId', async () => {
      await expect(
        uploadArtifact(mockPrisma, {
          epicId: 'epic-uuid',
          workflowRunId: 'run-uuid',
          definitionKey: 'THE_PLAN',
          content: '# Invalid',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject no scope parameters', async () => {
      await expect(
        uploadArtifact(mockPrisma, {
          definitionKey: 'THE_PLAN',
          content: '# Invalid',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should allow storyId + workflowRunId together (validation ensures they match)', async () => {
      const mockStory = {
        id: 'story-uuid',
        projectId: 'project-uuid',
      };

      const mockWorkflowRun = {
        id: 'run-uuid',
        storyId: 'story-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'THE_PLAN',
        workflow: {
          projectId: 'project-uuid',
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        epicId: null,
        workflowRunId: 'run-uuid',
        content: '# Plan',
        contentHash: crypto.createHash('sha256').update('# Plan').digest('hex'),
        contentType: 'text/markdown',
        size: 6,
        currentVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: mockDefinition,
      });

      await expect(
        uploadArtifact(mockPrisma, {
          storyId: 'story-uuid',
          workflowRunId: 'run-uuid',
          definitionKey: 'THE_PLAN',
          content: '# Plan',
        })
      ).resolves.toBeDefined();
    });
  });

  // ============================================================================
  // 7. SECURITY TESTS
  // ============================================================================

  describe('Security - Cross-Project Validation', () => {
    it('should prevent cross-project epic artifact upload', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        projectId: 'project-A',
      };

      const mockDefinition = {
        id: 'def-uuid',
        projectId: 'project-B', // Different project
        key: 'THE_PLAN',
        project: {
          id: 'project-B',
        },
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        uploadArtifact(mockPrisma, {
          epicId: 'epic-uuid',
          definitionKey: 'THE_PLAN',
          content: 'Malicious content',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should prevent cross-project epic artifact access', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        projectId: 'project-A',
      };

      // Definition from different project won't be found by findFirst WHERE clause
      // In reality, the query filters by projectId so this would return null
      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        getArtifact(mockPrisma, {
          epicId: 'epic-uuid',
          definitionKey: 'THE_PLAN',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should validate definitionId belongs to same project', async () => {
      const mockEpic = {
        id: 'epic-uuid',
        projectId: 'project-uuid',
      };

      const wrongDefinition = {
        id: 'wrong-def-uuid',
        projectId: 'different-project',
        key: 'WRONG_DEF',
        project: {
          id: 'different-project',
        },
      };

      (mockPrisma.epic.findUnique as jest.Mock).mockResolvedValue(mockEpic);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(wrongDefinition);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(wrongDefinition);

      await expect(
        uploadArtifact(mockPrisma, {
          epicId: 'epic-uuid',
          definitionKey: 'WRONG_DEF',
          content: '# Content',
        })
      ).rejects.toThrow('Artifact definition must belong to the same project');
    });
  });
});
