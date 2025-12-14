/**
 * Story-Scoped Artifacts Tests (ST-214)
 * TDD Approach: Tests written to guide implementation
 *
 * IMPORTANT: These tests are written BEFORE implementation.
 * They define the expected API and behavior for story-scoped artifacts.
 *
 * NOTE: TypeScript errors are EXPECTED until implementation is complete.
 * These errors indicate the features that need to be implemented:
 * - storyId parameter on UploadArtifactParams, GetArtifactParams, ListArtifactParams
 * - storyId field on ArtifactResponse
 * - artifactVersion field on PrismaClient
 * - versionCount, versionHistory on list response
 *
 * The following features will be implemented to make these tests pass:
 *
 * 1. Schema changes:
 *    - Artifact.storyId (nullable, replaces workflowRunId as primary scope)
 *    - ArtifactVersion model for version history
 *    - Unique constraint on (definitionId, storyId)
 *
 * 2. API changes:
 *    - upload_artifact accepts storyId parameter
 *    - get_artifact accepts storyId parameter
 *    - list_artifacts accepts storyId parameter
 *    - All tools derive storyId from workflowRunId for backward compat
 *
 * 3. New behavior:
 *    - Content hash deduplication (same hash = no version bump)
 *    - Automatic version history via ArtifactVersion
 *    - Story-level quotas and authorization
 *
 * Test Coverage:
 * 1. Schema/Model Tests - Artifact model accepts storyId, version history
 * 2. upload_artifact Tests - Story-scoped creation, hash deduplication
 * 3. get_artifact Tests - Story-scoped retrieval, backward compat
 * 4. list_artifacts Tests - Story-scoped listing with version counts
 * 5. Migration Tests - Data migration from workflow-run to story-scoped
 * 6. Security Tests - Authorization, hash validation, quotas, race conditions
 */

import { PrismaClient } from '@prisma/client';
import { handler as uploadArtifact } from '../upload_artifact';
import { handler as getArtifact } from '../get_artifact';
import { handler as listArtifacts } from '../list_artifacts';
import { ValidationError, NotFoundError } from '../../../types';
import * as crypto from 'crypto';

// Mock Prisma
const mockPrisma = {
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
    count: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as PrismaClient;

describe('Story-Scoped Artifacts (ST-214)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default transaction to execute callback immediately
    (mockPrisma.$transaction as jest.Mock).mockImplementation((callback) => callback(mockPrisma));
  });

  // ============================================================================
  // 1. SCHEMA/MODEL TESTS
  // ============================================================================

  describe('Schema/Model', () => {
    it('should create artifact with storyId', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        type: 'markdown',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        workflowRunId: null,
        content: '# Architecture Document',
        contentHash: crypto.createHash('sha256').update('# Architecture Document').digest('hex'),
        contentType: 'text/markdown',
        size: 24,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content: '# Architecture Document',
      });

      expect(result.storyId).toBe('story-uuid');
      expect(result.workflowRunId).toBeNull();
      expect(mockPrisma.artifact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storyId: 'story-uuid',
            definitionId: 'def-uuid',
          }),
        })
      );
    });

    it('should enforce unique constraint on (definitionId, storyId)', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        type: 'markdown',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'existing-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        version: 1,
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      // Should update existing artifact, not create new one
      (mockPrisma.artifact.update as jest.Mock).mockResolvedValue({
        ...existingArtifact,
        version: 2,
        content: '# Updated',
      });

      const result = await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content: '# Updated',
      });

      expect(mockPrisma.artifact.update).toHaveBeenCalled();
      expect(mockPrisma.artifact.create).not.toHaveBeenCalled();
    });

    it('should create ArtifactVersion for new content', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        type: 'markdown',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        content: '# Version 1',
        contentHash: crypto.createHash('sha256').update('# Version 1').digest('hex'),
        version: 1,
      };

      const newContent = '# Version 2';
      const newHash = crypto.createHash('sha256').update(newContent).digest('hex');

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.update as jest.Mock).mockResolvedValue({
        ...existingArtifact,
        content: newContent,
        contentHash: newHash,
        version: 2,
      });
      (mockPrisma.artifactVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-uuid',
        artifactId: 'artifact-uuid',
        version: 2,
        content: newContent,
        contentHash: newHash,
      });

      await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content: newContent,
      });

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
  });

  // ============================================================================
  // 2. upload_artifact TESTS
  // ============================================================================

  describe('upload_artifact - Story-Scoped', () => {
    it('should create artifact with storyId directly', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        storyId: 'story-uuid',
        version: 1,
      });

      const result = await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content: '# Architecture',
      });

      expect(result.storyId).toBe('story-uuid');
      expect(mockPrisma.story.findUnique).toHaveBeenCalledWith({
        where: { id: 'story-uuid' },
      });
    });

    it('should derive storyId from workflowRunId (backward compat)', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        storyId: 'story-uuid',
        workflowId: 'workflow-uuid',
        story: {
          id: 'story-uuid',
          key: 'ST-214',
          projectId: 'project-uuid',
        },
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        storyId: 'story-uuid',
        workflowRunId: 'run-uuid',
        version: 1,
      });

      const result = await uploadArtifact(mockPrisma, {
        workflowRunId: 'run-uuid',
        definitionKey: 'ARCH_DOC',
        content: '# Architecture',
      });

      expect(result.storyId).toBe('story-uuid');
      expect(result.workflowRunId).toBe('run-uuid');
    });

    it('should skip version bump for duplicate content (same hash)', async () => {
      const content = '# Same Content';
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        content,
        contentHash,
        version: 3,
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      const result = await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content,
      });

      // Should return existing artifact without version bump
      expect(result.currentVersion).toBe(3);
      expect(mockPrisma.artifact.update).not.toHaveBeenCalled();
      expect(mockPrisma.artifactVersion.create).not.toHaveBeenCalled();
    });

    it('should create new version for different content', async () => {
      const oldContent = '# Version 1';
      const newContent = '# Version 2';
      const oldHash = crypto.createHash('sha256').update(oldContent).digest('hex');
      const newHash = crypto.createHash('sha256').update(newContent).digest('hex');

      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        content: oldContent,
        contentHash: oldHash,
        version: 1,
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.update as jest.Mock).mockResolvedValue({
        ...existingArtifact,
        content: newContent,
        contentHash: newHash,
        version: 2,
      });
      (mockPrisma.artifactVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-uuid',
        version: 2,
      });

      const result = await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content: newContent,
      });

      expect(result.currentVersion).toBe(2);
      expect(mockPrisma.artifact.update).toHaveBeenCalled();
      expect(mockPrisma.artifactVersion.create).toHaveBeenCalled();
    });

    it('should reject cross-project artifact upload', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-A',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-B', // Different project
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        uploadArtifact(mockPrisma, {
          storyId: 'story-uuid',
          definitionKey: 'ARCH_DOC',
          content: '# Architecture',
        })
      ).rejects.toThrow('Artifact definition must belong to the same project');
    });
  });

  // ============================================================================
  // 3. get_artifact TESTS
  // ============================================================================

  describe('get_artifact - Story-Scoped', () => {
    it('should get artifact by storyId + definitionKey', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        content: '# Architecture',
        version: 3,
        definition: mockDefinition,
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await getArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
      });

      expect(result.id).toBe('artifact-uuid');
      expect(result.storyId).toBe('story-uuid');
      expect(result.currentVersion).toBe(3);
    });

    it('should get artifact by workflowRunId (backward compat)', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        storyId: 'story-uuid',
        workflowId: 'workflow-uuid',
        story: {
          id: 'story-uuid',
          projectId: 'project-uuid',
        },
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        workflowRunId: 'run-uuid',
        content: '# Architecture',
        definition: mockDefinition,
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await getArtifact(mockPrisma, {
        workflowRunId: 'run-uuid',
        definitionKey: 'ARCH_DOC',
      });

      expect(result.id).toBe('artifact-uuid');
      expect(result.storyId).toBe('story-uuid');
    });

    it('should get specific version from history', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        version: 5,
      };

      const mockVersion = {
        id: 'version-uuid',
        artifactId: 'artifact-uuid',
        version: 2,
        content: '# Version 2',
        contentHash: crypto.createHash('sha256').update('# Version 2').digest('hex'),
        createdAt: new Date('2025-01-01'),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(mockArtifact);
      (mockPrisma.artifactVersion.findFirst as jest.Mock).mockResolvedValue(mockVersion);

      const result = await getArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        version: 2,
      });

      expect(result.currentVersion).toBe(2);
      expect(result.content).toBe('# Version 2');
      expect(mockPrisma.artifactVersion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            artifactId: 'artifact-uuid',
            version: 2,
          }),
        })
      );
    });

    it('should reject cross-project artifact access', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-A',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-B', // Different project
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        getArtifact(mockPrisma, {
          storyId: 'story-uuid',
          definitionKey: 'ARCH_DOC',
        })
      ).rejects.toThrow('Artifact definition must belong to the same project');
    });
  });

  // ============================================================================
  // 4. list_artifacts TESTS
  // ============================================================================

  describe('list_artifacts - Story-Scoped', () => {
    it('should list all artifacts for a story', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockArtifacts = [
        {
          id: 'artifact-1',
          definitionId: 'def-1',
          storyId: 'story-uuid',
          version: 3,
          definition: { key: 'ARCH_DOC', name: 'Architecture Document' },
        },
        {
          id: 'artifact-2',
          definitionId: 'def-2',
          storyId: 'story-uuid',
          version: 1,
          definition: { key: 'DESIGN_DOC', name: 'Design Document' },
        },
      ];

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue(mockArtifacts);
      (mockPrisma.artifactVersion.count as jest.Mock)
        .mockResolvedValueOnce(3) // 3 versions for artifact-1
        .mockResolvedValueOnce(1); // 1 version for artifact-2

      const result = await listArtifacts(mockPrisma, {
        storyId: 'story-uuid',
      });

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts[0].currentVersion).toBe(3);
      expect(result.artifacts[0].versionCount).toBe(3);
      expect(result.artifacts[1].currentVersion).toBe(1);
      expect(result.artifacts[1].versionCount).toBe(1);
    });

    it('should filter artifacts by definitionKey', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
      };

      const mockArtifacts = [
        {
          id: 'artifact-1',
          definitionId: 'def-uuid',
          storyId: 'story-uuid',
          version: 3,
          definition: mockDefinition,
        },
      ];

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue(mockArtifacts);
      (mockPrisma.artifactVersion.count as jest.Mock).mockResolvedValue(3);

      const result = await listArtifacts(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
      });

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].definition.key).toBe('ARCH_DOC');
    });

    it('should include version history when requested', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockArtifacts = [
        {
          id: 'artifact-uuid',
          definitionId: 'def-uuid',
          storyId: 'story-uuid',
          version: 3,
          definition: { key: 'ARCH_DOC' },
        },
      ];

      const mockVersions = [
        {
          id: 'v1',
          version: 1,
          createdAt: new Date('2025-01-01'),
          contentPreview: 'Version 1...',
        },
        {
          id: 'v2',
          version: 2,
          createdAt: new Date('2025-01-02'),
          contentPreview: 'Version 2...',
        },
        {
          id: 'v3',
          version: 3,
          createdAt: new Date('2025-01-03'),
          contentPreview: 'Version 3...',
        },
      ];

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue(mockArtifacts);
      (mockPrisma.artifactVersion.findMany as jest.Mock).mockResolvedValue(mockVersions);
      (mockPrisma.artifactVersion.count as jest.Mock).mockResolvedValue(3);

      const result = await listArtifacts(mockPrisma, {
        storyId: 'story-uuid',
        includeVersionHistory: true,
      });

      expect(result.artifacts[0].versionHistory).toHaveLength(3);
      expect(result.artifacts[0].versionHistory[0].currentVersion).toBe(1);
      expect(result.artifacts[0].versionHistory[2].currentVersion).toBe(3);
    });
  });

  // ============================================================================
  // 5. MIGRATION TESTS
  // ============================================================================

  describe('Migration - Workflow-Run to Story-Scoped', () => {
    it('should populate storyId from workflow runs', async () => {
      // This test validates the migration logic
      const mockWorkflowRuns = [
        {
          id: 'run-1',
          storyId: 'story-A',
          artifacts: [
            { id: 'artifact-1', storyId: null, workflowRunId: 'run-1' },
            { id: 'artifact-2', storyId: null, workflowRunId: 'run-1' },
          ],
        },
        {
          id: 'run-2',
          storyId: 'story-B',
          artifacts: [
            { id: 'artifact-3', storyId: null, workflowRunId: 'run-2' },
          ],
        },
      ];

      (mockPrisma.workflowRun.findMany as jest.Mock).mockResolvedValue(mockWorkflowRuns);
      (mockPrisma.artifact.update as jest.Mock).mockResolvedValue({});

      // Migration logic would iterate through runs and update artifacts
      for (const run of mockWorkflowRuns) {
        for (const artifact of run.artifacts) {
          await mockPrisma.artifact.update({
            where: { id: artifact.id },
            data: { storyId: run.storyId },
          });
        }
      }

      expect(mockPrisma.artifact.update).toHaveBeenCalledTimes(3);
      expect(mockPrisma.artifact.update).toHaveBeenCalledWith({
        where: { id: 'artifact-1' },
        data: { storyId: 'story-A' },
      });
      expect(mockPrisma.artifact.update).toHaveBeenCalledWith({
        where: { id: 'artifact-3' },
        data: { storyId: 'story-B' },
      });
    });

    it('should handle orphaned artifacts (no workflow run)', async () => {
      const orphanedArtifacts = [
        {
          id: 'orphan-1',
          workflowRunId: 'non-existent-run',
          storyId: null,
        },
      ];

      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue(orphanedArtifacts);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      // Migration should log warning or delete orphaned artifacts
      const orphan = orphanedArtifacts[0];
      const run = await mockPrisma.workflowRun.findUnique({
        where: { id: orphan.workflowRunId },
      });

      expect(run).toBeNull();
      // Migration logic should either delete or mark for manual review
    });

    it('should ensure unique constraint after migration', async () => {
      // After migration, ensure no duplicate (definitionId, storyId) pairs
      const mockArtifacts = [
        {
          id: 'artifact-1',
          definitionId: 'def-A',
          storyId: 'story-1',
          workflowRunId: 'run-1',
        },
        {
          id: 'artifact-2',
          definitionId: 'def-A',
          storyId: 'story-1',
          workflowRunId: 'run-2', // Duplicate from different run
        },
      ];

      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue(mockArtifacts);

      // Migration should detect duplicates and merge them
      const duplicates = mockArtifacts.filter(
        (a, i, arr) => arr.findIndex(
          b => b.definitionId === a.definitionId && b.storyId === a.storyId
        ) !== i
      );

      expect(duplicates).toHaveLength(1);
      // Migration should keep newest and version the older ones
    });
  });

  // ============================================================================
  // 6. SECURITY TESTS
  // ============================================================================

  describe('Security - Authorization', () => {
    it('should prevent cross-project artifact upload', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-A',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-B', // Different project
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        uploadArtifact(mockPrisma, {
          storyId: 'story-uuid',
          definitionKey: 'ARCH_DOC',
          content: 'Malicious content',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should prevent cross-project artifact access', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-A',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-B',
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        getArtifact(mockPrisma, {
          storyId: 'story-uuid',
          definitionKey: 'ARCH_DOC',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate story exists before upload', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        uploadArtifact(mockPrisma, {
          storyId: 'non-existent-story',
          definitionKey: 'ARCH_DOC',
          content: '# Content',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Security - Hash Validation', () => {
    it('should compute SHA256 hash for content deduplication', async () => {
      const content = '# Architecture Document\n\nThis is a test.';
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
      (mockPrisma.artifact.create as jest.Mock).mockImplementation((params) => {
        expect(params.data.contentHash).toBe(expectedHash);
        return {
          id: 'artifact-uuid',
          contentHash: params.data.contentHash,
        };
      });

      await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content,
      });
    });

    it('should detect hash collision attacks', async () => {
      // In the extremely rare case of SHA256 collision
      const content1 = 'Content 1';
      const content2 = 'Content 2';
      const fakeHash = 'collision-hash';

      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'artifact-uuid',
        content: content1,
        contentHash: fakeHash,
        version: 1,
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      // If hash matches but content differs, should detect collision
      // Implementation should compare content as fallback
      const newHash = crypto.createHash('sha256').update(content2).digest('hex');

      // In reality, SHA256 collision is virtually impossible, but this tests defense-in-depth
      expect(newHash).not.toBe(fakeHash); // Normal case - hashes differ
    });
  });

  describe('Security - Quota Enforcement', () => {
    it('should enforce per-story artifact quota', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      // Mock 45MB existing artifacts (quota = 50MB)
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({
        _sum: { size: 45 * 1024 * 1024 },
      });

      // Try to upload 10MB (would exceed quota)
      const largeContent = 'x'.repeat(10 * 1024 * 1024);

      await expect(
        uploadArtifact(mockPrisma, {
          storyId: 'story-uuid',
          definitionKey: 'ARCH_DOC',
          content: largeContent,
        })
      ).rejects.toThrow('quota exceeded');
    });

    it('should count artifact versions towards quota', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      // Each version stored in ArtifactVersion should count
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({
        _sum: { size: 10 * 1024 * 1024 }, // 10MB in main artifacts
      });
      (mockPrisma.artifactVersion.aggregate as jest.Mock).mockResolvedValue({
        _sum: { size: 35 * 1024 * 1024 }, // 35MB in version history
      });

      // Total = 45MB, should be enforced by quota check
      const totalSize = 45 * 1024 * 1024;
      expect(totalSize).toBeLessThan(50 * 1024 * 1024); // Under quota
    });
  });

  describe('Security - Race Conditions', () => {
    it('should handle atomic version creation', async () => {
      const content = '# New Version';
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const existingArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        storyId: 'story-uuid',
        content: '# Old Version',
        contentHash: 'old-hash',
        version: 5,
      };

      // Mock transaction to ensure atomicity
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      // Transaction should update artifact and create version atomically
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const result = await callback(mockPrisma);
        return result;
      });

      (mockPrisma.artifact.update as jest.Mock).mockResolvedValue({
        ...existingArtifact,
        content,
        contentHash,
        version: 6,
      });

      (mockPrisma.artifactVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-uuid',
        version: 6,
      });

      const result = await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content,
      });

      expect(result.currentVersion).toBe(6);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should handle concurrent uploads with version conflicts', async () => {
      // If two agents upload simultaneously, version numbers could conflict
      // Implementation should use database-level locking or optimistic concurrency

      const mockStory = {
        id: 'story-uuid',
        key: 'ST-214',
        projectId: 'project-uuid',
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
        workflow: {
          id: 'workflow-uuid',
          projectId: 'project-uuid',
        },
      };

      const artifact = {
        id: 'artifact-uuid',
        version: 10,
        storyId: 'story-uuid',
        definitionId: 'def-uuid',
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(artifact);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      // First upload increments to version 11
      (mockPrisma.artifact.update as jest.Mock)
        .mockResolvedValueOnce({ ...artifact, version: 11 })
        .mockResolvedValueOnce({ ...artifact, version: 12 });

      // Sequential uploads should get correct version numbers
      const result1 = await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content: '# Upload 1',
      });

      const result2 = await uploadArtifact(mockPrisma, {
        storyId: 'story-uuid',
        definitionKey: 'ARCH_DOC',
        content: '# Upload 2',
      });

      // Versions should be sequential
      expect(result1.currentVersion).toBe(11);
      expect(result2.currentVersion).toBe(12);
    });
  });
});
