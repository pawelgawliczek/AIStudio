/**
 * Tests for RunnerService.registerTranscript
 * ST-189: Docker Runner Transcript Registration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RunnerService } from '../runner.service';

describe('RunnerService - registerTranscript (ST-189)', () => {
  let service: RunnerService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    // Create mock Prisma service
    const mockPrisma = {
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunnerService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<RunnerService>(RunnerService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('Master Transcript Registration', () => {
    it('should register master transcript for the first time', async () => {
      const runId = 'run-123';
      const transcriptPath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-session-456.jsonl';
      const sessionId = 'master-session-456';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath,
        sessionId,
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe('master');
      expect(result.transcriptPath).toBe(transcriptPath);

      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: runId },
        data: {
          masterTranscriptPaths: [transcriptPath],
          metadata: {
            _transcriptTracking: {
              sessionId,
            },
          },
        },
      });
    });

    it('should append master transcript to existing paths', async () => {
      const runId = 'run-123';
      const existingPath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-old.jsonl';
      const newPath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-new.jsonl';
      const sessionId = 'master-session-456';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [existingPath],
        metadata: {
          _transcriptTracking: {
            sessionId: 'old-session',
          },
        },
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath: newPath,
        sessionId,
      });

      expect(result.success).toBe(true);

      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: runId },
        data: {
          masterTranscriptPaths: [existingPath, newPath],
          metadata: {
            _transcriptTracking: {
              sessionId,
            },
          },
        },
      });
    });

    it('should not duplicate master transcript paths', async () => {
      const runId = 'run-123';
      const transcriptPath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-session-456.jsonl';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [transcriptPath],
        metadata: {},
      } as any);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath,
      });

      expect(result.success).toBe(true);

      // Should not call update since path already exists
      expect(prisma.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should preserve existing sessionId if new sessionId not provided', async () => {
      const runId = 'run-123';
      const transcriptPath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-new.jsonl';
      const existingSessionId = 'existing-session-123';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {
          _transcriptTracking: {
            sessionId: existingSessionId,
          },
        },
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath,
      });

      expect(result.success).toBe(true);

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.metadata._transcriptTracking.sessionId).toBe(existingSessionId);
    });

    it('should handle null masterTranscriptPaths', async () => {
      const runId = 'run-123';
      const transcriptPath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-session-456.jsonl';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: null,
        metadata: null,
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath,
      });

      expect(result.success).toBe(true);

      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: runId },
        data: {
          masterTranscriptPaths: [transcriptPath],
          metadata: {
            _transcriptTracking: {},
          },
        },
      });
    });
  });

  describe('Agent Transcript Registration', () => {
    it('should register agent transcript', async () => {
      const runId = 'run-123';
      const transcriptPath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent-comp123-1234567890.jsonl';
      const componentId = 'component-123';
      const agentId = 'agent-456';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'agent',
        transcriptPath,
        componentId,
        agentId,
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe('agent');
      expect(result.transcriptPath).toBe(transcriptPath);

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const spawnedAgentTranscripts = updateCall.data.metadata.spawnedAgentTranscripts;

      expect(spawnedAgentTranscripts).toHaveLength(1);
      expect(spawnedAgentTranscripts[0]).toMatchObject({
        componentId,
        agentId,
        transcriptPath,
      });
      expect(spawnedAgentTranscripts[0].spawnedAt).toBeDefined();
    });

    it('should append agent transcript to existing list', async () => {
      const runId = 'run-123';
      const existingTranscript = {
        componentId: 'component-old',
        agentId: 'agent-old',
        transcriptPath: '/path/to/old-agent.jsonl',
        spawnedAt: '2025-01-01T00:00:00Z',
      };

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {
          spawnedAgentTranscripts: [existingTranscript],
        },
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'agent',
        transcriptPath: '/path/to/new-agent.jsonl',
        componentId: 'component-new',
        agentId: 'agent-new',
      });

      expect(result.success).toBe(true);

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const spawnedAgentTranscripts = updateCall.data.metadata.spawnedAgentTranscripts;

      expect(spawnedAgentTranscripts).toHaveLength(2);
      expect(spawnedAgentTranscripts[0]).toEqual(existingTranscript);
      expect(spawnedAgentTranscripts[1]).toMatchObject({
        componentId: 'component-new',
        agentId: 'agent-new',
        transcriptPath: '/path/to/new-agent.jsonl',
      });
    });

    it('should handle null metadata when registering agent transcript', async () => {
      const runId = 'run-123';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: null,
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'agent',
        transcriptPath: '/path/to/agent.jsonl',
        componentId: 'component-123',
        agentId: 'agent-456',
      });

      expect(result.success).toBe(true);

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const spawnedAgentTranscripts = updateCall.data.metadata.spawnedAgentTranscripts;

      expect(spawnedAgentTranscripts).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should return error if workflow run not found', async () => {
      const runId = 'non-existent-run';

      prisma.workflowRun.findUnique.mockResolvedValue(null);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath: '/path/to/transcript.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('WorkflowRun not found');
      expect(prisma.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should reject path traversal attempts', async () => {
      const runId = 'run-123';
      const maliciousPath = '/opt/stack/../../../etc/passwd';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath: maliciousPath,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid path: traversal not allowed');
      expect(prisma.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should return error for invalid transcript type', async () => {
      const runId = 'run-123';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      const result = await service.registerTranscript(runId, {
        type: 'invalid' as any,
        transcriptPath: '/path/to/transcript.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transcript type');
      expect(prisma.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should handle database update errors gracefully', async () => {
      const runId = 'run-123';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      prisma.workflowRun.update.mockRejectedValue(new Error('Database connection lost'));

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath: '/path/to/transcript.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection lost');
    });

    it('should handle Prisma errors during update', async () => {
      const runId = 'run-123';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      const prismaError = new Error('Unique constraint violation');
      (prismaError as any).code = 'P2002';
      prisma.workflowRun.update.mockRejectedValue(prismaError);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath: '/path/to/transcript.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unique constraint violation');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string paths', async () => {
      const runId = 'run-123';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath: '',
      });

      expect(result.success).toBe(true);
      expect(prisma.workflowRun.update).toHaveBeenCalled();
    });

    it('should handle very long transcript paths', async () => {
      const runId = 'run-123';
      const longPath = '/opt/stack/AIStudio/.claude/projects/' + 'a'.repeat(500) + '/transcript.jsonl';

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      const result = await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath: longPath,
      });

      expect(result.success).toBe(true);
    });

    it('should handle multiple path traversal patterns', async () => {
      const runId = 'run-123';
      const paths = [
        '../../../etc/passwd',
        'foo/../../bar',
        '/opt/stack/../AIStudio',
      ];

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: {},
      } as any);

      for (const path of paths) {
        const result = await service.registerTranscript(runId, {
          type: 'master',
          transcriptPath: path,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid path: traversal not allowed');
      }
    });

    it('should preserve other metadata fields when updating', async () => {
      const runId = 'run-123';
      const existingMetadata = {
        checkpoint: { version: 1 },
        lastCheckpointAt: '2025-01-01T00:00:00Z',
        customField: 'custom value',
      };

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: [],
        metadata: existingMetadata,
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      await service.registerTranscript(runId, {
        type: 'master',
        transcriptPath: '/path/to/transcript.jsonl',
      });

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const newMetadata = updateCall.data.metadata;

      // Should preserve existing fields
      expect(newMetadata.checkpoint).toEqual(existingMetadata.checkpoint);
      expect(newMetadata.lastCheckpointAt).toBe(existingMetadata.lastCheckpointAt);
      expect(newMetadata.customField).toBe(existingMetadata.customField);
    });
  });

  describe('Concurrent Registration', () => {
    it('should handle multiple master transcript registrations', async () => {
      const runId = 'run-123';
      const paths = [
        '/path/to/transcript1.jsonl',
        '/path/to/transcript2.jsonl',
        '/path/to/transcript3.jsonl',
      ];

      let currentPaths: string[] = [];

      prisma.workflowRun.findUnique.mockImplementation(() =>
        Promise.resolve({
          id: runId,
          masterTranscriptPaths: [...currentPaths],
          metadata: {},
        } as any)
      );

      prisma.workflowRun.update.mockImplementation((args) => {
        currentPaths = args.data.masterTranscriptPaths as string[];
        return Promise.resolve({} as any);
      });

      for (const path of paths) {
        const result = await service.registerTranscript(runId, {
          type: 'master',
          transcriptPath: path,
        });
        expect(result.success).toBe(true);
      }

      expect(currentPaths).toEqual(paths);
    });
  });
});
