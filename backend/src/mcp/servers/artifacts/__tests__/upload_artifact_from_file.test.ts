/**
 * upload_artifact_from_file MCP Tool Tests (ST-177)
 * TDD Approach: Tests written BEFORE implementation
 *
 * Test Coverage (14 test cases):
 * - Security Tests (7): Path traversal, API key redaction, size limits, quota enforcement,
 *   error sanitization, unauthorized access, definition ownership
 * - Functional Tests (7): Validation errors, NotFoundError, agent offline, successful upload,
 *   quota validation, definition lookup, error propagation
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../../types';
import { RemoteRunner } from '../../../utils/remote-runner';
import { handler as createArtifact } from '../create_artifact';
import { handler } from '../upload_artifact_from_md_file';

// Mock dependencies
jest.mock('../../../utils/remote-runner');
jest.mock('../create_artifact');

// Mock Prisma
const mockPrisma = {
  workflowRun: {
    findUnique: jest.fn(),
  },
  artifactDefinition: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  artifact: {
    findFirst: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('upload_artifact_from_file', () => {
  let mockRemoteRunner: jest.Mocked<RemoteRunner>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock RemoteRunner instance
    mockRemoteRunner = {
      execute: jest.fn(),
    } as any;

    // Mock RemoteRunner constructor
    (RemoteRunner as jest.MockedClass<typeof RemoteRunner>).mockImplementation(() => mockRemoteRunner);
  });

  // ============================================================================
  // A. FUNCTIONAL TESTS (7 test cases)
  // ============================================================================

  describe('Validation', () => {
    it('should throw ValidationError when filePath is missing', async () => {
      await expect(
        handler(mockPrisma, {
          workflowRunId: 'run-uuid',
          // filePath is missing
        } as any)
      ).rejects.toThrow(ValidationError);

      await expect(
        handler(mockPrisma, {
          workflowRunId: 'run-uuid',
          // filePath is missing
        } as any)
      ).rejects.toThrow('filePath is required');
    });

    it('should throw ValidationError when workflowRunId is missing', async () => {
      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/THE_PLAN.md',
          // workflowRunId is missing
        } as any)
      ).rejects.toThrow(ValidationError);

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/THE_PLAN.md',
          // workflowRunId is missing
        } as any)
      ).rejects.toThrow('workflowRunId is required');
    });

    it('should throw NotFoundError when workflow run does not exist', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/THE_PLAN.md',
          workflowRunId: 'non-existent-uuid',
        })
      ).rejects.toThrow(NotFoundError);

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/THE_PLAN.md',
          workflowRunId: 'non-existent-uuid',
        })
      ).rejects.toThrow('WorkflowRun not found');
    });
  });

  describe('Agent Offline Scenario', () => {
    it('should return fallback command when laptop agent is offline', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      // Mock RemoteRunner returning agent offline
      mockRemoteRunner.execute.mockResolvedValue({
        executed: false,
        success: false,
        fallbackCommand: 'claude code "Upload THE_PLAN.md to artifact system"',
      });

      const result = await handler(mockPrisma, {
        filePath: '~/.claude/projects/test/THE_PLAN.md',
        workflowRunId: 'run-uuid',
      });

      expect(result.success).toBe(true);
      expect(result.agentOffline).toBe(true);
      expect(result.fallbackCommand).toContain('Upload THE_PLAN.md');
      expect(result.message).toContain('Agent offline');
    });
  });

  describe('Successful Upload', () => {
    it('should successfully read file and upload artifact', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        name: 'The Plan',
        key: 'THE_PLAN',
        type: 'markdown',
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        definitionId: 'def-uuid',
        workflowRunId: 'run-uuid',
        content: '# Implementation Plan\n\nThis is the plan.',
        contentType: 'text/markdown',
        size: 50,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);

      // Mock RemoteRunner returning file content
      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: true,
        result: {
          content: '# Implementation Plan\n\nThis is the plan.',
          size: 50,
        },
      });

      // Mock quota validation (no existing artifacts)
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({
        _sum: { size: 0 },
      });

      // Mock upload_artifact handler
      (createArtifact as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await handler(mockPrisma, {
        filePath: '~/.claude/projects/test/THE_PLAN.md',
        workflowRunId: 'run-uuid',
        definitionKey: 'THE_PLAN',
      });

      expect(result.success).toBe(true);
      expect(result.artifact).toBeDefined();
      expect(result.artifact?.id).toBe('artifact-uuid');
      expect(createArtifact).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          workflowRunId: 'run-uuid',
          definitionKey: 'THE_PLAN',
          content: expect.any(String),
        })
      );
    });
  });

  describe('Quota Validation', () => {
    it('should validate quota before reading file', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      // Mock quota exceeded (9MB existing + estimated 2MB new file)
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({
        _sum: { size: 9 * 1024 * 1024 }, // 9MB
      });

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/large-file.md',
          workflowRunId: 'run-uuid',
          maxFileSize: 2 * 1024 * 1024, // 2MB
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/large-file.md',
          workflowRunId: 'run-uuid',
          maxFileSize: 2 * 1024 * 1024,
        })
      ).rejects.toThrow(/quota exceeded/i);

      // RemoteRunner should NOT be called if quota check fails early
      expect(mockRemoteRunner.execute).not.toHaveBeenCalled();
    });

    it('should validate quota after reading file with actual size', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      // First quota check passes (estimate)
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 8 * 1024 * 1024 } }) // 8MB (pre-check)
        .mockResolvedValueOnce({ _sum: { size: 8 * 1024 * 1024 } }); // 8MB (post-check)

      // Mock RemoteRunner returning 3MB file (exceeds 10MB run quota)
      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: true,
        result: {
          content: 'x'.repeat(3 * 1024 * 1024), // 3MB
          size: 3 * 1024 * 1024,
        },
      });

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/large-file.md',
          workflowRunId: 'run-uuid',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/large-file.md',
          workflowRunId: 'run-uuid',
        })
      ).rejects.toThrow(/quota exceeded/i);

      // RemoteRunner should be called but upload_artifact should NOT
      expect(mockRemoteRunner.execute).toHaveBeenCalled();
      expect(createArtifact).not.toHaveBeenCalled();
    });
  });

  describe('Definition Lookup', () => {
    it('should lookup definition by definitionId', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'THE_PLAN',
        type: 'markdown',
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: true,
        result: { content: '# Plan', size: 10 },
      });

      (uploadArtifact as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        version: 1,
      });

      await handler(mockPrisma, {
        filePath: '~/.claude/projects/test/THE_PLAN.md',
        workflowRunId: 'run-uuid',
        definitionId: 'def-uuid',
      });

      expect(mockPrisma.artifactDefinition.findUnique).toHaveBeenCalledWith({
        where: { id: 'def-uuid' },
      });
    });

    it('should lookup definition by definitionKey + workflowRunId', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'THE_PLAN',
        type: 'markdown',
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: true,
        result: { content: '# Plan', size: 10 },
      });

      (uploadArtifact as jest.Mock).mockResolvedValue({
        id: 'artifact-uuid',
        version: 1,
      });

      await handler(mockPrisma, {
        filePath: '~/.claude/projects/test/THE_PLAN.md',
        workflowRunId: 'run-uuid',
        definitionKey: 'THE_PLAN',
      });

      expect(mockPrisma.artifactDefinition.findFirst).toHaveBeenCalledWith({
        where: {
          key: 'THE_PLAN',
          workflowId: 'workflow-uuid',
        },
      });
    });
  });

  describe('Error Propagation', () => {
    it('should propagate errors from upload_artifact handler', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: true,
        result: { content: '# Plan', size: 10 },
      });

      // Mock upload_artifact throwing an error
      (createArtifact as jest.Mock).mockRejectedValue(
        new ValidationError('Artifact definition must belong to the same workflow')
      );

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/THE_PLAN.md',
          workflowRunId: 'run-uuid',
          definitionId: 'wrong-def-uuid',
        })
      ).rejects.toThrow('Artifact definition must belong to the same workflow');
    });
  });

  // ============================================================================
  // B. SECURITY TESTS (7 test cases from Security Review)
  // ============================================================================

  describe('Security - Path Traversal', () => {
    it('should block path traversal attempts', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      // Mock RemoteRunner returning security error from read-file.ts
      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: false,
        error: 'File path is outside allowed directory',
      });

      const result = await handler(mockPrisma, {
        filePath: '~/.claude/projects/../../etc/passwd',
        workflowRunId: 'run-uuid',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('outside allowed directory');
    });
  });

  describe('Security - API Key Redaction', () => {
    it('should redact API keys from file content', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'CONFIG',
        type: 'code',
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      // Mock RemoteRunner returning file with API key
      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: true,
        result: {
          content: 'OPENAI_API_KEY=sk-1234567890abcdefghij1234567890AB\nOTHER_CONFIG=value',
          size: 60,
        },
      });

      (createArtifact as jest.Mock).mockImplementation(async (prisma, params) => {
        // Verify that the content passed to upload_artifact is redacted
        expect(params.content).toContain('[REDACTED-KEY]');
        expect(params.content).not.toContain('sk-1234567890');

        return {
          id: 'artifact-uuid',
          content: params.content,
          version: 1,
        };
      });

      const result = await handler(mockPrisma, {
        filePath: '~/.claude/projects/test/config.env',
        workflowRunId: 'run-uuid',
        definitionKey: 'CONFIG',
      });

      expect(result.success).toBe(true);
      expect(createArtifact).toHaveBeenCalled();
    });
  });

  describe('Security - File Size Limit', () => {
    it('should enforce per-file size limit (2MB default)', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      // Mock RemoteRunner returning error about file size
      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: false,
        error: 'File too large: 3145728 bytes exceeds limit of 2097152 bytes',
      });

      const result = await handler(mockPrisma, {
        filePath: '~/.claude/projects/test/large-file.txt',
        workflowRunId: 'run-uuid',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('File too large');
    });
  });

  describe('Security - Quota Enforcement', () => {
    it('should enforce per-run quota (10MB)', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      // Mock 9MB existing artifacts
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({
        _sum: { size: 9 * 1024 * 1024 },
      });

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/file.txt',
          workflowRunId: 'run-with-9mb',
          maxFileSize: 2 * 1024 * 1024,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/file.txt',
          workflowRunId: 'run-with-9mb',
          maxFileSize: 2 * 1024 * 1024,
        })
      ).rejects.toThrow(/quota exceeded/i);
    });
  });

  describe('Security - Error Sanitization', () => {
    it('should sanitize error messages to remove paths and usernames', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        workflow: { id: 'workflow-uuid', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      // Mock RemoteRunner returning sanitized error from read-file.ts
      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: false,
        error: 'File not found at [PATH]',
      });

      const result = await handler(mockPrisma, {
        filePath: '~/.claude/projects/test/missing.txt',
        workflowRunId: 'run-uuid',
      });

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('/Users/');
      expect(result.message).not.toContain('pawel');
      expect(result.message).toMatch(/\[PATH\]/);
    });
  });

  describe('Security - Unauthorized Access', () => {
    it('should reject unauthorized workflow runs', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/file.txt',
          workflowRunId: 'non-existent-uuid',
        })
      ).rejects.toThrow(NotFoundError);

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/file.txt',
          workflowRunId: 'non-existent-uuid',
        })
      ).rejects.toThrow('WorkflowRun not found');
    });
  });

  describe('Security - Artifact Definition Ownership', () => {
    it('should validate artifact definition ownership', async () => {
      const mockWorkflowRun = {
        id: 'run-uuid',
        workflowId: 'workflow-A',
        workflow: { id: 'workflow-A', projectId: 'project-uuid' },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifact.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });

      mockRemoteRunner.execute.mockResolvedValue({
        executed: true,
        success: true,
        result: { content: '# Plan', size: 10 },
      });

      // Mock upload_artifact throwing ownership error
      (createArtifact as jest.Mock).mockRejectedValue(
        new ValidationError('Artifact definition must belong to the same workflow')
      );

      await expect(
        handler(mockPrisma, {
          filePath: '~/.claude/projects/test/file.txt',
          workflowRunId: 'run-uuid',
          definitionId: 'definition-workflow-B', // Wrong workflow
        })
      ).rejects.toThrow('must belong to the same workflow');
    });
  });
});
