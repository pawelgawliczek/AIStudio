/**
 * ST-265: TDD Tests for Agent Tracking - userPrompts and Code Impact
 *
 * Tests for completeAgentTracking() to verify:
 * 1. userPrompts extraction from turns.manualPrompts
 * 2. Code impact metrics (linesAdded/linesDeleted) for MasterSession workflows
 * 3. Git diff parsing and commit-per-agent approach
 * 4. Fallback to project path from metadata
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { RemoteRunner } from '../../utils/remote-runner';
import {
  completeAgentTracking,
  startAgentTracking,
} from '../agent-tracking';

jest.mock('../../utils/remote-runner');
jest.mock('../../services/websocket-gateway.instance', () => ({
  broadcastComponentStarted: jest.fn(),
  broadcastComponentCompleted: jest.fn(),
  startTranscriptTailing: jest.fn(),
  stopTranscriptTailing: jest.fn(),
}));

describe('Agent Tracking - ST-265 (userPrompts & Code Impact)', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let mockRemoteRunner: jest.Mocked<RemoteRunner>;

  const testProjectId = uuidv4();
  const testWorkflowId = uuidv4();
  const testComponentId = uuidv4();
  const testRunId = uuidv4();
  const testStoryId = uuidv4();

  beforeEach(() => {
    // Mock Prisma
    prisma = {
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      component: {
        findUnique: jest.fn(),
      },
      componentRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      worktree: {
        findFirst: jest.fn(),
      },
      unassignedTranscript: {
        findFirst: jest.fn(),
      },
      transcript: {
        findFirst: jest.fn(),
      },
    } as any;

    // Mock RemoteRunner
    mockRemoteRunner = {
      execute: jest.fn(),
    } as any;
    (RemoteRunner as jest.Mock).mockImplementation(() => mockRemoteRunner);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('userPrompts Extraction from turns.manualPrompts', () => {
    it('should extract userPrompts from transcript turns.manualPrompts', async () => {
      // Setup: Component run exists
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
        userPrompts: 0,
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: testRunId,
        storyId: testStoryId,
        metadata: {
          spawnedAgentTranscripts: [
            {
              componentId: testComponentId,
              transcriptPath: '/path/to/transcript.jsonl',
              agentId: 'agent-123',
              spawnedAt: new Date().toISOString(),
            },
          ],
        },
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
        userPrompts: 8, // Expected value
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      // Mock parse-transcript to return turns.manualPrompts = 8
      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          inputTokens: 10000,
          outputTokens: 2000,
          cacheCreationTokens: 500,
          cacheReadTokens: 200,
          totalTokens: 12500,
          model: 'claude-opus-4-5',
          transcriptPath: '/path/to/transcript.jsonl',
          turns: {
            totalTurns: 12,
            manualPrompts: 8, // This should be extracted as userPrompts
            autoContinues: 4,
          },
        },
      });

      // Execute
      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
        status: 'completed',
      });

      // Verify
      expect(result.success).toBe(true);
      expect(prisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockComponentRun.id },
          data: expect.objectContaining({
            userPrompts: 8, // Should be extracted from turns.manualPrompts
          }),
        })
      );
    });

    it('should handle transcript without turns data', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
        userPrompts: 0,
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: testRunId,
        storyId: testStoryId,
        metadata: {
          spawnedAgentTranscripts: [
            {
              componentId: testComponentId,
              transcriptPath: '/path/to/transcript.jsonl',
            },
          ],
        },
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
        userPrompts: 0,
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      // Mock parse-transcript WITHOUT turns data
      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          inputTokens: 10000,
          outputTokens: 2000,
          totalTokens: 12000,
          model: 'claude-opus-4-5',
          // No turns field
        },
      });

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
        status: 'completed',
      });

      expect(result.success).toBe(true);
      // Should default to 0 when turns data is missing
      expect(prisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userPrompts: 0,
          }),
        })
      );
    });

    it('should handle null manualPrompts gracefully', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
        userPrompts: 0,
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: testRunId,
        storyId: testStoryId,
        metadata: {
          spawnedAgentTranscripts: [
            {
              componentId: testComponentId,
              transcriptPath: '/path/to/transcript.jsonl',
            },
          ],
        },
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          inputTokens: 5000,
          outputTokens: 1000,
          totalTokens: 6000,
          turns: {
            totalTurns: 5,
            manualPrompts: null, // Explicitly null
            autoContinues: 5,
          },
        },
      });

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      expect(result.success).toBe(true);
      expect(prisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userPrompts: 0, // Should treat null as 0
          }),
        })
      );
    });
  });

  describe('Code Impact for MasterSession Workflows', () => {
    it('should calculate linesAdded and linesDeleted from git diff', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'PM Agent',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-123',
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
        linesAdded: 150,
        linesDeleted: 30,
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      // Mock git diff --numstat output
      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          stdout: `100\t20\tsrc/services/agent.service.ts
50\t10\tsrc/controllers/agent.controller.ts`,
          stderr: '',
        },
      });

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
        status: 'completed',
      });

      expect(result.success).toBe(true);
      expect(mockRemoteRunner.execute).toHaveBeenCalledWith(
        'exec-command',
        expect.arrayContaining([
          '--command=git diff main...HEAD --numstat',
          expect.stringContaining('--cwd='),
        ]),
        expect.any(Object)
      );
      expect(prisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linesAdded: 150, // 100 + 50
            linesDeleted: 30, // 20 + 10
            filesModified: expect.arrayContaining([
              'src/services/agent.service.ts',
              'src/controllers/agent.controller.ts',
            ]),
          }),
        })
      );
    });

    it('should handle empty git diff (no changes)', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-123',
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
        linesAdded: 0,
        linesDeleted: 0,
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      // Mock empty git diff
      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          stdout: '', // No changes
          stderr: '',
        },
      });

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      expect(result.success).toBe(true);
      expect(prisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linesAdded: 0,
            linesDeleted: 0,
            filesModified: [],
          }),
        })
      );
    });

    it('should fallback to metadata._transcriptTracking.projectPath when worktree not found', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: null, // No story, so no worktree
          metadata: {
            _transcriptTracking: {
              projectPath: '/Users/user/projects/AIStudio',
              sessionId: 'session-123',
            },
          },
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: null,
          metadata: {
            _transcriptTracking: {
              projectPath: '/Users/user/projects/AIStudio',
            },
          },
        });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue(null); // No worktree
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
        linesAdded: 50,
        linesDeleted: 10,
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          stdout: '50\t10\tsrc/test.ts',
          stderr: '',
        },
      });

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      expect(result.success).toBe(true);
      expect(mockRemoteRunner.execute).toHaveBeenCalledWith(
        'exec-command',
        expect.arrayContaining([
          expect.stringContaining('--cwd=/Users/user/projects/AIStudio'),
        ]),
        expect.any(Object)
      );
    });

    it('should handle git diff parse errors gracefully (non-fatal)', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-123',
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      // Mock git failure
      mockRemoteRunner.execute.mockRejectedValueOnce(
        new Error('Git command failed')
      );

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      // Should still succeed, just without code impact metrics
      expect(result.success).toBe(true);
      expect(prisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            linesAdded: expect.anything(),
            linesDeleted: expect.anything(),
          }),
        })
      );
    });

    it('should parse binary file changes correctly (showing - for added/deleted)', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-123',
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
        linesAdded: 100,
        linesDeleted: 20,
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      // Mock git diff with binary file (shown as - -)
      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          stdout: `100\t20\tsrc/test.ts
-\t-\tassets/image.png`,
          stderr: '',
        },
      });

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      expect(result.success).toBe(true);
      // Binary files should be counted as 0 added/deleted, but file should be in list
      expect(prisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linesAdded: 100,
            linesDeleted: 20,
            filesModified: expect.arrayContaining([
              'src/test.ts',
              'assets/image.png',
            ]),
          }),
        })
      );
    });
  });

  describe('Integration - userPrompts + Code Impact Together', () => {
    it('should populate both userPrompts and code impact metrics', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
        userPrompts: 0,
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Implementer',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {
            spawnedAgentTranscripts: [
              {
                componentId: testComponentId,
                transcriptPath: '/path/to/transcript.jsonl',
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-456',
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
        userPrompts: 12,
        linesAdded: 200,
        linesDeleted: 50,
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      // Mock transcript parsing with turns data
      mockRemoteRunner.execute
        .mockResolvedValueOnce({
          executed: true,
          success: true,
          result: {
            inputTokens: 15000,
            outputTokens: 3000,
            totalTokens: 18000,
            model: 'claude-opus-4-5',
            turns: {
              totalTurns: 20,
              manualPrompts: 12, // userPrompts
              autoContinues: 8,
            },
          },
        })
        // Mock git diff
        .mockResolvedValueOnce({
          executed: true,
          success: true,
          result: {
            stdout: `150\t30\tsrc/main.ts
50\t20\tsrc/utils.ts`,
            stderr: '',
          },
        });

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
        status: 'completed',
      });

      expect(result.success).toBe(true);
      expect(prisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userPrompts: 12,
            linesAdded: 200,
            linesDeleted: 50,
            filesModified: expect.arrayContaining(['src/main.ts', 'src/utils.ts']),
          }),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing transcript gracefully (no userPrompts update)', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: testRunId,
        storyId: testStoryId,
        metadata: {}, // No spawnedAgentTranscripts
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);
      (prisma.unassignedTranscript.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transcript.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      expect(result.success).toBe(true);
      // Should complete successfully even without transcript
      expect(prisma.componentRun.update).toHaveBeenCalled();
    });

    it('should handle workflow run without storyId (no worktree, no git diff)', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Test Component',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: null, // No story
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: null,
          metadata: {},
        });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([mockComponentRun]);

      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      expect(result.success).toBe(true);
      expect(prisma.worktree.findFirst).not.toHaveBeenCalled();
      // Should not attempt git diff without story/worktree
    });
  });

  // ST-278: Tests for startCommitHash tracking
  describe('ST-278: startCommitHash Tracking for Accurate LOC', () => {
    it('should call git rev-parse HEAD and store startCommitHash when starting agent', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(),
        metadata: { startCommitHash: 'abc123def456' },
      };

      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: testRunId,
        status: 'running',
        storyId: testStoryId,
        metadata: {},
      });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-278',
      });
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Implementer',
      });
      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.componentRun.create as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);

      // Mock git rev-parse HEAD returning commit hash
      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          stdout: 'abc123def456\n',
          stderr: '',
          exitCode: 0,
          command: 'git',
        },
      });

      // THIS TEST WILL FAIL - startAgentTracking doesn't capture startCommitHash yet
      const result = await startAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      expect(result.success).toBe(true);

      // Verify git rev-parse HEAD was called
      expect(mockRemoteRunner.execute).toHaveBeenCalledWith(
        'exec-command',
        expect.arrayContaining([
          '--command=git rev-parse HEAD',
          '--cwd=/opt/stack/worktrees/st-278',
        ]),
        expect.objectContaining({
          requestedBy: 'startAgentTracking',
        })
      );

      // Verify ComponentRun was created with startCommitHash in metadata
      expect(prisma.componentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            startCommitHash: 'abc123def456',
          }),
        }),
      });
    });

    it('should use startCommitHash for git diff when completing agent', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(Date.now() - 30000),
        metadata: { startCommitHash: 'start-commit-hash' },
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Implementer',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-278',
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);

      // Mock git diff using startCommitHash
      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          stdout: '50\t10\tsrc/test.ts\n',
          stderr: '',
        },
      });

      // THIS TEST WILL FAIL - completeAgentTracking doesn't use startCommitHash yet
      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
        output: { status: 'done' },
      });

      expect(result.success).toBe(true);

      // Verify git diff was called with startCommitHash...HEAD
      expect(mockRemoteRunner.execute).toHaveBeenCalledWith(
        'exec-command',
        expect.arrayContaining([
          '--command=git diff start-commit-hash...HEAD --numstat',
          '--cwd=/opt/stack/worktrees/st-278',
        ]),
        expect.any(Object)
      );

      // Verify code impact metrics were calculated
      expect(prisma.componentRun.update).toHaveBeenCalledWith({
        where: { id: mockComponentRun.id },
        data: expect.objectContaining({
          linesAdded: 50,
          linesDeleted: 10,
          filesModified: ['src/test.ts'],
        }),
      });
    });

    it('should fallback to main...HEAD when startCommitHash is null', async () => {
      const mockComponentRun = {
        id: uuidv4(),
        workflowRunId: testRunId,
        componentId: testComponentId,
        status: 'running',
        startedAt: new Date(Date.now() - 30000),
        metadata: {}, // No startCommitHash
      };

      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Implementer',
      });
      (prisma.workflowRun.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: testRunId,
          storyId: testStoryId,
          metadata: {},
        });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-278',
      });
      (prisma.componentRun.update as jest.Mock).mockResolvedValue(mockComponentRun);
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);

      mockRemoteRunner.execute.mockResolvedValueOnce({
        executed: true,
        success: true,
        result: {
          stdout: '25\t5\tsrc/test.ts\n',
          stderr: '',
        },
      });

      // THIS TEST WILL FAIL - completeAgentTracking doesn't implement fallback yet
      const result = await completeAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
        output: { status: 'done' },
      });

      expect(result.success).toBe(true);

      // Should fallback to main...HEAD when no startCommitHash
      expect(mockRemoteRunner.execute).toHaveBeenCalledWith(
        'exec-command',
        expect.arrayContaining([
          '--command=git diff main...HEAD --numstat',
        ]),
        expect.any(Object)
      );
    });

    it('should handle git rev-parse failure gracefully when starting agent', async () => {
      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: testRunId,
        status: 'running',
        storyId: testStoryId,
        metadata: {},
      });
      (prisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        worktreePath: '/opt/stack/worktrees/st-278',
      });
      (prisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: testComponentId,
        name: 'Implementer',
      });
      (prisma.componentRun.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.componentRun.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        executionOrder: 1,
        startedAt: new Date(),
      });
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);

      // Mock git rev-parse failure
      mockRemoteRunner.execute.mockRejectedValueOnce(
        new Error('Not a git repository')
      );

      // THIS TEST WILL FAIL - startAgentTracking doesn't handle git failure yet
      const result = await startAgentTracking(prisma as any, {
        runId: testRunId,
        componentId: testComponentId,
      });

      // Should still succeed without startCommitHash
      expect(result.success).toBe(true);
      expect(result.warning).toContain('Failed to capture start commit hash');

      // ComponentRun should be created without startCommitHash
      expect(prisma.componentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.not.objectContaining({
            startCommitHash: expect.any(String),
          }),
        }),
      });
    });
  });
});
