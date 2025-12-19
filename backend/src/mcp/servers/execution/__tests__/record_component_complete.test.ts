/**
 * Unit tests for record_component_complete MCP tool
 * Tests agent completion tracking with metrics and transcripts
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../record_component_complete';
import { ValidationError } from '../../../types';
import { RemoteRunner } from '../../../utils/remote-runner';

// Mock dependencies
jest.mock('../../../utils/remote-runner');
jest.mock('../../../services/websocket-gateway.instance', () => ({
  broadcastComponentCompleted: jest.fn().mockResolvedValue(undefined),
  stopTranscriptTailing: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../utils/pricing', () => ({
  calculateCost: jest.fn((metrics) => {
    const total = (metrics.tokensInput || 0) + (metrics.tokensOutput || 0);
    return total * 0.00001; // Mock pricing
  }),
}));
jest.mock('../parse-context-output', () => ({
  parseContextOutput: jest.fn((output: string) => ({
    tokensInput: 3000,
    tokensOutput: 2000,
    tokensCacheCreation: 100,
    tokensCacheRead: 50,
    tokensSystemPrompt: null,
    tokensSystemTools: null,
    tokensMcpTools: null,
    tokensMemoryFiles: null,
    tokensMessages: null,
    sessionId: 'test-session-123',
  })),
}));

describe('record_component_complete MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRemoteRunner: jest.Mocked<RemoteRunner>;

  const mockComponentRun = {
    id: 'cr-123',
    workflowRunId: 'wr-123',
    componentId: 'comp-123',
    status: 'running',
    startedAt: new Date('2024-01-01T10:00:00Z'),
    outputData: {},
    metadata: {},
    sessionId: null,
  };

  const mockComponent = {
    id: 'comp-123',
    name: 'Test Component',
  };

  const mockWorkflowRun = {
    id: 'wr-123',
    projectId: 'proj-123',
    storyId: 'story-123',
    metadata: {},
  };

  const mockStory = {
    id: 'story-123',
    key: 'ST-123',
    title: 'Test Story',
  };

  beforeEach(() => {
    mockPrisma = {
      componentRun: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      component: {
        findUnique: jest.fn(),
      },
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      story: {
        findUnique: jest.fn(),
      },
      transcript: {
        create: jest.fn(),
      },
      unassignedTranscript: {
        findFirst: jest.fn(),
      },
    } as any;

    mockRemoteRunner = new RemoteRunner() as jest.Mocked<RemoteRunner>;
    (RemoteRunner as jest.Mock).mockImplementation(() => mockRemoteRunner);

    jest.clearAllMocks();
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('Input Validation', () => {
    it('should throw ValidationError if runId missing', async () => {
      await expect(handler(mockPrisma, {
        componentId: 'comp-123',
      })).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, {
        componentId: 'comp-123',
      })).rejects.toThrow('Missing required parameter: runId');
    });

    it('should throw ValidationError if componentId missing', async () => {
      await expect(handler(mockPrisma, {
        runId: 'wr-123',
      })).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, {
        runId: 'wr-123',
      })).rejects.toThrow('Missing required parameter: componentId');
    });

    it('should throw ValidationError for invalid status', async () => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);

      await expect(handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        status: 'invalid',
      })).rejects.toThrow(ValidationError);
    });

    it('should accept "completed" status', async () => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      const result = await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        status: 'completed',
      });

      expect(result.status).toBe('completed');
    });

    it('should accept "failed" status', async () => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'failed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      const result = await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        status: 'failed',
        errorMessage: 'Test error',
      });

      expect(result.status).toBe('failed');
    });

    it('should throw ValidationError if no running component found', async () => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(null);

      await expect(handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      })).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      })).rejects.toThrow('No running component execution found');
    });
  });

  // ==========================================================================
  // Basic Completion Tests
  // ==========================================================================

  describe('Basic Completion', () => {
    beforeEach(() => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
    });

    it('should complete component without metrics', async () => {
      const result = await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      });

      expect(result.success).toBe(true);
      expect(result.componentRunId).toBe('cr-123');
      expect(result.componentName).toBe('Test Component');
      expect(result.dataSource).toBe('none');
    });

    it('should calculate duration from start to completion time', async () => {
      const completionTime = new Date('2024-01-01T10:05:00Z'); // 5 minutes after start
      jest.spyOn(Date.prototype, 'getTime')
        .mockReturnValueOnce(completionTime.getTime());

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            durationSeconds: 300, // 5 minutes
          }),
        })
      );
    });

    it('should store output data', async () => {
      const outputData = { result: 'success', details: 'test output' };

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        output: outputData,
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outputData,
          }),
        })
      );
    });

    it('should store error message for failed status', async () => {
      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        status: 'failed',
        errorMessage: 'Component execution failed',
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            errorMessage: 'Component execution failed',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Metrics from contextOutput Tests
  // ==========================================================================

  describe('Context Output Metrics', () => {
    beforeEach(() => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
    });

    it('should parse contextOutput and extract metrics', async () => {
      const contextOutput = `
Session ID: test-session-123
Total Tokens: 5000
Input Tokens: 3000
Output Tokens: 2000
Cache Creation Tokens: 100
Cache Read Tokens: 50
      `;

      const result = await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        contextOutput,
      });

      expect(result.dataSource).toBe('context');
      expect(result.contextMetrics).toBeDefined();
      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokensInput: expect.any(Number),
            tokensOutput: expect.any(Number),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Direct Transcript Metrics Tests
  // ==========================================================================

  describe('Direct Transcript Metrics (ST-242)', () => {
    beforeEach(() => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
    });

    it('should use direct transcriptMetrics parameter', async () => {
      const transcriptMetrics = {
        inputTokens: 2000,
        outputTokens: 1500,
        cacheCreationTokens: 200,
        cacheReadTokens: 100,
        model: 'claude-sonnet-4',
      };

      const result = await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        transcriptMetrics,
      });

      expect(result.dataSource).toBe('direct');
      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokensInput: 2000,
            tokensOutput: 1500,
            totalTokens: 3800, // 2000 + 1500 + 200 + 100
            modelId: 'claude-sonnet-4',
          }),
        })
      );
    });

    it('should calculate cost from transcript metrics', async () => {
      const transcriptMetrics = {
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-opus-4',
      };

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        transcriptMetrics,
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cost: expect.any(Number),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Turn Metrics Tests
  // ==========================================================================

  describe('Turn Metrics (ST-147)', () => {
    beforeEach(() => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
    });

    it('should store turn metrics', async () => {
      const turnMetrics = {
        totalTurns: 10,
        manualPrompts: 7,
        autoContinues: 3,
      };

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        turnMetrics,
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalTurns: 10,
            manualPrompts: 7,
            autoContinues: 3,
          }),
        })
      );
    });

    it('should include turn metrics in response', async () => {
      const turnMetrics = {
        totalTurns: 5,
        manualPrompts: 4,
        autoContinues: 1,
      };

      const result = await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        turnMetrics,
      });

      expect(result.turnMetrics).toEqual(turnMetrics);
    });
  });

  // ==========================================================================
  // Component Summary Tests
  // ==========================================================================

  describe('Component Summary (ST-147)', () => {
    beforeEach(() => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
    });

    it('should store component summary', async () => {
      const summary = 'Component analyzed 5 files and generated 200 LOC';

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        componentSummary: summary,
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            componentSummary: summary,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Aggregation Tests
  // ==========================================================================

  describe('Workflow Run Aggregation', () => {
    it('should aggregate metrics from all completed components', async () => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([
        {
          tokensInput: 1000,
          tokensOutput: 500,
          totalTokens: 1500,
          cost: 0.05,
          durationSeconds: 60,
          totalTurns: 5,
          manualPrompts: 4,
          linesAdded: 100,
          linesDeleted: 10,
          metadata: { cacheTokens: { creation: 50, read: 25 } },
        },
        {
          tokensInput: 2000,
          tokensOutput: 1000,
          totalTokens: 3000,
          cost: 0.10,
          durationSeconds: 120,
          totalTurns: 8,
          manualPrompts: 6,
          linesAdded: 200,
          linesDeleted: 20,
          metadata: { cacheTokens: { creation: 100, read: 50 } },
        },
      ]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      });

      const updateCall = mockPrisma.workflowRun.update.mock.calls[0][0];
      expect(updateCall.data.totalTokensInput).toBe(3000);
      expect(updateCall.data.totalTokensOutput).toBe(1500);
      expect(updateCall.data.totalTokens).toBe(4500);
      expect(updateCall.data.estimatedCost).toBeCloseTo(0.15, 10);
      expect(updateCall.data.durationSeconds).toBe(180);
      expect(updateCall.data.totalTurns).toBe(13);
      expect(updateCall.data.totalManualPrompts).toBe(10);
      expect(updateCall.data.totalLocGenerated).toBe(270); // (100-10) + (200-20)
    });

    it('should calculate average prompts per component', async () => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([
        { manualPrompts: 4, totalTurns: 5 },
        { manualPrompts: 6, totalTurns: 8 },
      ]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      });

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            avgPromptsPerComponent: 5, // 10 total / 2 components
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Code Impact Metrics Tests (ST-234)
  // ==========================================================================

  describe('Code Impact Metrics', () => {
    beforeEach(() => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        storyId: 'story-123',
      });
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
    });

    it('should retrieve code impact from git diff', async () => {
      const worktree = { worktreePath: '/opt/stack/worktrees/st-123' };
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        ...mockWorkflowRun,
        storyId: 'story-123',
      });
      (mockPrisma as any).worktree = {
        findFirst: jest.fn().mockResolvedValue(worktree),
      };
      mockRemoteRunner.execute = jest.fn().mockResolvedValue({
        executed: true,
        success: true,
        result: {
          stdout: '100\t20\tfile1.ts\n50\t10\tfile2.ts\n',
        },
      });

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linesAdded: 150,
            linesDeleted: 30,
            filesModified: ['file1.ts', 'file2.ts'],
          }),
        })
      );
    });

    it('should handle git diff errors gracefully', async () => {
      (mockPrisma as any).worktree = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      const result = await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      });

      expect(result.success).toBe(true);
      // Code impact metrics should be null when git fails
    });
  });

  // ==========================================================================
  // Cache Metrics Tests
  // ==========================================================================

  describe('Cache Metrics', () => {
    beforeEach(() => {
      mockPrisma.componentRun.findFirst.mockResolvedValue(mockComponentRun);
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrisma.workflowRun.update.mockResolvedValue(mockWorkflowRun);
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
    });

    it('should store cache tokens in metadata', async () => {
      const transcriptMetrics = {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 100,
        cacheReadTokens: 50,
      };

      await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
        transcriptMetrics,
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              cacheTokens: {
                creation: 100,
                read: 50,
              },
            }),
          }),
        })
      );
    });

    it('should aggregate cache tokens from all components', async () => {
      mockPrisma.componentRun.findMany.mockResolvedValue([
        {
          metadata: { cacheTokens: { creation: 100, read: 50 } },
        },
        {
          metadata: { cacheTokens: { creation: 200, read: 75 } },
        },
      ]);

      const result = await handler(mockPrisma, {
        runId: 'wr-123',
        componentId: 'comp-123',
      });

      expect(result.aggregatedMetrics.totalCacheCreation).toBe(300);
      expect(result.aggregatedMetrics.totalCacheRead).toBe(125);
    });
  });
});
