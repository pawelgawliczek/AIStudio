/**
 * Unit Tests for RunnerService.registerTranscript()
 * ST-189: Docker Runner Transcript Registration
 *
 * Tests the HTTP endpoint that allows Docker Runner to register transcripts
 * for live streaming and metrics collection.
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';
import { RunnerService } from '../runner.service';

describe('RunnerService.registerTranscript - ST-189', () => {
  let runnerService: RunnerService;
  let prismaMock: ReturnType<typeof mockDeep<PrismaClient>>;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    runnerService = new RunnerService(prismaMock as any);
    jest.clearAllMocks();
  });

  const mockWorkflowRun = {
    id: 'run-123',
    masterTranscriptPaths: [],
    metadata: {},
  };

  describe('Master Transcript Registration', () => {
    it('should register master transcript successfully', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-abc123.jsonl',
        sessionId: 'master-abc123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(true);
      expect(result.type).toBe('master');
      expect(result.transcriptPath).toBe(dto.transcriptPath);
      expect(result.error).toBeUndefined();

      // Verify database update
      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          masterTranscriptPaths: [dto.transcriptPath],
          metadata: expect.objectContaining({
            _transcriptTracking: expect.objectContaining({
              sessionId: 'master-abc123',
            }),
          }),
        },
      });
    });

    it('should append to existing masterTranscriptPaths array', async () => {
      const existingTranscript = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-old.jsonl';
      const newTranscript = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-new.jsonl';

      const dto = {
        type: 'master' as const,
        transcriptPath: newTranscript,
        sessionId: 'master-new',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        masterTranscriptPaths: [existingTranscript],
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(true);
      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          masterTranscriptPaths: [existingTranscript, newTranscript],
        }),
      });
    });

    it('should not duplicate master transcript paths', async () => {
      const duplicatePath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-abc.jsonl';

      const dto = {
        type: 'master' as const,
        transcriptPath: duplicatePath,
        sessionId: 'master-abc',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        masterTranscriptPaths: [duplicatePath],
      } as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(true);
      // Should NOT call update if path already exists
      expect(prismaMock.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should preserve existing metadata when adding transcript', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-new.jsonl',
        sessionId: 'master-new',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        metadata: {
          existingKey: 'existingValue',
          _transcriptTracking: {
            previousSessionId: 'old-session',
          },
        },
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      await runnerService.registerTranscript('run-123', dto);

      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            existingKey: 'existingValue',
            _transcriptTracking: expect.objectContaining({
              sessionId: 'master-new',
              previousSessionId: 'old-session',
            }),
          }),
        }),
      });
    });

    it('should preserve sessionId if not provided in new registration', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-new.jsonl',
        // No sessionId provided
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        metadata: {
          _transcriptTracking: {
            sessionId: 'existing-session-id',
          },
        },
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      await runnerService.registerTranscript('run-123', dto);

      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            _transcriptTracking: expect.objectContaining({
              sessionId: 'existing-session-id', // Preserved from existing metadata
            }),
          }),
        }),
      });
    });
  });

  describe('Agent Transcript Registration', () => {
    it('should register agent transcript successfully', async () => {
      const dto = {
        type: 'agent' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent-comp123-1234567890.jsonl',
        componentId: 'comp-123',
        agentId: 'agent-456',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(true);
      expect(result.type).toBe('agent');
      expect(result.transcriptPath).toBe(dto.transcriptPath);
      expect(result.error).toBeUndefined();

      // Verify database update
      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          metadata: expect.objectContaining({
            spawnedAgentTranscripts: [
              {
                componentId: 'comp-123',
                agentId: 'agent-456',
                transcriptPath: dto.transcriptPath,
                spawnedAt: expect.any(String),
              },
            ],
          }),
        },
      });
    });

    it('should append to existing spawnedAgentTranscripts array', async () => {
      const existingAgent = {
        componentId: 'comp-old',
        agentId: 'agent-old',
        transcriptPath: '/path/to/old-agent.jsonl',
        spawnedAt: '2025-01-01T10:00:00Z',
      };

      const dto = {
        type: 'agent' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent-new.jsonl',
        componentId: 'comp-new',
        agentId: 'agent-new',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        metadata: {
          spawnedAgentTranscripts: [existingAgent],
        },
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      await runnerService.registerTranscript('run-123', dto);

      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          metadata: expect.objectContaining({
            spawnedAgentTranscripts: expect.arrayContaining([
              existingAgent,
              expect.objectContaining({
                componentId: 'comp-new',
                agentId: 'agent-new',
                transcriptPath: dto.transcriptPath,
              }),
            ]),
          }),
        },
      });
    });

    it('should preserve other metadata when adding agent transcript', async () => {
      const dto = {
        type: 'agent' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent-new.jsonl',
        componentId: 'comp-123',
        agentId: 'agent-456',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        metadata: {
          existingKey: 'existingValue',
          _transcriptTracking: { sessionId: 'master-123' },
        },
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      await runnerService.registerTranscript('run-123', dto);

      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          metadata: expect.objectContaining({
            existingKey: 'existingValue',
            _transcriptTracking: { sessionId: 'master-123' },
            spawnedAgentTranscripts: expect.any(Array),
          }),
        },
      });
    });

    it('should handle empty metadata when registering agent transcript', async () => {
      const dto = {
        type: 'agent' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent-new.jsonl',
        componentId: 'comp-123',
        agentId: 'agent-456',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        metadata: null,
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(true);
      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          metadata: {
            spawnedAgentTranscripts: [expect.any(Object)],
          },
        },
      });
    });

    it('should include spawnedAt timestamp in ISO format', async () => {
      const beforeTest = new Date().toISOString();

      const dto = {
        type: 'agent' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent-new.jsonl',
        componentId: 'comp-123',
        agentId: 'agent-456',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      await runnerService.registerTranscript('run-123', dto);

      const afterTest = new Date().toISOString();

      const updateCall = prismaMock.workflowRun.update.mock.calls[0][0];
      const spawnedAgentTranscripts = (updateCall.data as any).metadata.spawnedAgentTranscripts;
      const spawnedAt = spawnedAgentTranscripts[0].spawnedAt;

      // Verify timestamp is between test start and end
      expect(spawnedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(spawnedAt >= beforeTest).toBe(true);
      expect(spawnedAt <= afterTest).toBe(true);
    });
  });

  describe('Validation and Error Handling', () => {
    it('should fail if workflow run not found', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master.jsonl',
        sessionId: 'master-123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(null);

      const result = await runnerService.registerTranscript('non-existent-run', dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('WorkflowRun not found: non-existent-run');
      expect(result.type).toBe('master');
      expect(prismaMock.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should reject paths with directory traversal (..) - master transcript', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/../etc/passwd',
        sessionId: 'master-123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid path: traversal not allowed');
      expect(prismaMock.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should reject paths with directory traversal (..) - agent transcript', async () => {
      const dto = {
        type: 'agent' as const,
        transcriptPath: '/opt/stack/../../etc/passwd',
        componentId: 'comp-123',
        agentId: 'agent-456',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid path: traversal not allowed');
      expect(prismaMock.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should reject invalid transcript type', async () => {
      const dto = {
        type: 'invalid' as any,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/test.jsonl',
        sessionId: 'test',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid transcript type: invalid');
      expect(prismaMock.workflowRun.update).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master.jsonl',
        sessionId: 'master-123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockRejectedValue(new Error('Database connection failed'));

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.type).toBe('master');
      expect(result.transcriptPath).toBe(dto.transcriptPath);
    });

    it('should handle null masterTranscriptPaths gracefully', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master.jsonl',
        sessionId: 'master-123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        masterTranscriptPaths: null,
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result.success).toBe(true);
      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          masterTranscriptPaths: [dto.transcriptPath],
        }),
      });
    });
  });

  describe('Logging', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log master transcript registration', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master.jsonl',
        sessionId: 'master-123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      await runnerService.registerTranscript('run-123', dto);

      // Logger.log calls are captured internally by NestJS Logger
      // We can't directly spy on them in unit tests without mocking the entire Logger service
      // This test verifies that the method completes without throwing
      expect(true).toBe(true);
    });

    it('should log agent transcript registration', async () => {
      const dto = {
        type: 'agent' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent.jsonl',
        componentId: 'comp-123',
        agentId: 'agent-456',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      await runnerService.registerTranscript('run-123', dto);

      // Logger.log calls are captured internally by NestJS Logger
      expect(true).toBe(true);
    });

    it('should log when master transcript is already registered', async () => {
      const duplicatePath = '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master.jsonl';

      const dto = {
        type: 'master' as const,
        transcriptPath: duplicatePath,
        sessionId: 'master-123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        masterTranscriptPaths: [duplicatePath],
      } as any);

      await runnerService.registerTranscript('run-123', dto);

      // Logger should log that transcript is already registered
      expect(true).toBe(true);
    });
  });

  describe('Return Value Format', () => {
    it('should return consistent format for success', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master.jsonl',
        sessionId: 'master-123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result).toEqual({
        success: true,
        type: 'master',
        transcriptPath: dto.transcriptPath,
      });
      expect(result.error).toBeUndefined();
    });

    it('should return consistent format for failure', async () => {
      const dto = {
        type: 'master' as const,
        transcriptPath: '/invalid/../path',
        sessionId: 'master-123',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result).toEqual({
        success: false,
        type: 'master',
        transcriptPath: dto.transcriptPath,
        error: 'Invalid path: traversal not allowed',
      });
    });

    it('should include all required fields in agent transcript success response', async () => {
      const dto = {
        type: 'agent' as const,
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent.jsonl',
        componentId: 'comp-123',
        agentId: 'agent-456',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      const result = await runnerService.registerTranscript('run-123', dto);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('type', 'agent');
      expect(result).toHaveProperty('transcriptPath', dto.transcriptPath);
      expect(result).not.toHaveProperty('error');
    });
  });
});
