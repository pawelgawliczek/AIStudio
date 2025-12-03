/**
 * Tests for get_runner_status MCP tool
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../get_runner_status';

interface RunnerStatusResult {
  success: boolean;
  runId: string;
  status: string;
  workflow: { name: string };
  story?: { id: string; key: string; title: string };
  progress: {
    completedStates: number;
    skippedStates: number;
    totalStates: number;
    percentage: number;
  };
  currentExecution: {
    stateId: string;
    stateName: string;
    phase: string;
    componentName: string;
  } | null;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
    durationFormatted: string;
  };
  recentComponentRuns: Array<{ componentName: string; status: string }>;
  warnings?: string[];
  checkpoint?: unknown;
}

describe('get_runner_status MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workflowRun: {
        findUnique: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should throw error if run not found', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('WorkflowRun not found');
    });

    it('should return status for valid run', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        isPaused: false,
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [
            { id: 'state-1', name: 'State 1', order: 1 },
            { id: 'state-2', name: 'State 2', order: 2 },
          ],
        },
        story: {
          id: 'story-789',
          key: 'ST-1',
          title: 'Test Story',
        },
        componentRuns: [],
        startedAt: new Date('2025-01-01T00:00:00Z'),
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.success).toBe(true);
      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('running');
      expect(result.workflow.name).toBe('Test Workflow');
      expect(result.story).toBeDefined();
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress correctly', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: Array.from({ length: 10 }, (_, i) => ({
            id: `state-${i}`,
            name: `State ${i}`,
            order: i,
          })),
        },
        story: null,
        componentRuns: [],
        metadata: {
          checkpoint: {
            completedStates: ['state-0', 'state-1', 'state-2'],
            skippedStates: ['state-3'],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.progress.completedStates).toBe(3);
      expect(result.progress.skippedStates).toBe(1);
      expect(result.progress.totalStates).toBe(10);
      expect(result.progress.percentage).toBe(40); // (3 + 1) / 10 * 100 = 40%
    });

    it('should handle 0% progress', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        story: null,
        componentRuns: [],
        metadata: {},
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.progress.percentage).toBe(0);
    });

    it('should handle 100% progress', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'completed',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [
            { id: 'state-1', name: 'State 1', order: 1 },
            { id: 'state-2', name: 'State 2', order: 2 },
          ],
        },
        story: null,
        componentRuns: [],
        metadata: {
          checkpoint: {
            completedStates: ['state-1', 'state-2'],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.progress.percentage).toBe(100);
    });
  });

  describe('Current Execution', () => {
    it('should include current state info when available', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [
            { id: 'state-1', name: 'State 1', order: 1, component: { name: 'Component 1' } },
            { id: 'state-2', name: 'State 2', order: 2, component: { name: 'Component 2' } },
          ],
        },
        story: null,
        componentRuns: [],
        metadata: {
          checkpoint: {
            currentStateId: 'state-2',
            currentPhase: 'agent',
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.currentExecution).toBeDefined();
      expect(result.currentExecution?.stateId).toBe('state-2');
      expect(result.currentExecution?.stateName).toBe('State 2');
      expect(result.currentExecution?.phase).toBe('agent');
      expect(result.currentExecution?.componentName).toBe('Component 2');
    });

    it('should return null current execution when not in checkpoint', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'pending',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [],
        },
        story: null,
        componentRuns: [],
        metadata: {},
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.currentExecution).toBeNull();
    });
  });

  describe('Resource Usage', () => {
    it('should extract resource usage from checkpoint', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [],
        },
        story: null,
        componentRuns: [],
        metadata: {
          checkpoint: {
            resourceUsage: {
              tokensUsed: 50000,
              agentSpawns: 5,
              stateTransitions: 10,
              durationMs: 120000,
            },
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.resourceUsage.tokensUsed).toBe(50000);
      expect(result.resourceUsage.agentSpawns).toBe(5);
      expect(result.resourceUsage.stateTransitions).toBe(10);
      expect(result.resourceUsage.durationMs).toBe(120000);
      expect(result.resourceUsage.durationFormatted).toBe('2m 0s');
    });

    it('should fallback to lastStatus for resource usage', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [],
        },
        story: null,
        componentRuns: [],
        metadata: {
          lastStatus: {
            resourceUsage: {
              tokensUsed: 10000,
              agentSpawns: 2,
              stateTransitions: 3,
              durationMs: 30000,
            },
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.resourceUsage.tokensUsed).toBe(10000);
      expect(result.resourceUsage.durationFormatted).toBe('30s');
    });

    it('should use run fields if no checkpoint or status', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [],
        },
        story: null,
        componentRuns: [],
        totalTokens: 5000,
        durationSeconds: 60,
        metadata: {},
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.resourceUsage.tokensUsed).toBe(5000);
      expect(result.resourceUsage.durationMs).toBe(60000);
    });
  });

  describe('Duration Formatting', () => {
    it('should format duration in seconds', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test', states: [] },
        story: null,
        componentRuns: [],
        metadata: {
          checkpoint: {
            resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 45000 },
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.resourceUsage.durationFormatted).toBe('45s');
    });

    it('should format duration in minutes and seconds', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test', states: [] },
        story: null,
        componentRuns: [],
        metadata: {
          checkpoint: {
            resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 125000 },
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.resourceUsage.durationFormatted).toBe('2m 5s');
    });

    it('should format duration in hours and minutes', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test', states: [] },
        story: null,
        componentRuns: [],
        metadata: {
          checkpoint: {
            resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 7380000 },
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' }) ;

      expect(result.resourceUsage.durationFormatted).toBe('2h 3m');
    });
  });

  describe('Component Runs', () => {
    it('should include recent component runs', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test', states: [] },
        story: null,
        componentRuns: [
          {
            id: 'run-1',
            component: { name: 'Component 1' },
            status: 'completed',
            startedAt: new Date('2025-01-01T00:00:00Z'),
            completedAt: new Date('2025-01-01T00:05:00Z'),
          },
          {
            id: 'run-2',
            component: { name: 'Component 2' },
            status: 'running',
            startedAt: new Date('2025-01-01T00:05:00Z'),
            completedAt: null,
          },
        ],
        metadata: {},
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.recentComponentRuns).toHaveLength(2);
      expect(result.recentComponentRuns[0].componentName).toBe('Component 1');
      expect(result.recentComponentRuns[0].status).toBe('completed');
    });
  });

  describe('Warnings', () => {
    it('should include warnings from lastStatus', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test', states: [] },
        story: null,
        componentRuns: [],
        metadata: {
          lastStatus: {
            resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
            warnings: ['Token budget at 85%', 'Agent spawns at 90%'],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.warnings).toEqual(['Token budget at 85%', 'Agent spawns at 90%']);
    });

    it('should not include warnings if none present', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test', states: [] },
        story: null,
        componentRuns: [],
        metadata: {},
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.warnings).toBeUndefined();
    });
  });

  describe('Checkpoint Inclusion', () => {
    it('should include checkpoint when requested', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        completedStates: [],
      };

      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test', states: [] },
        story: null,
        componentRuns: [],
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123', includeCheckpoint: true });

      expect(result.checkpoint).toEqual(checkpoint);
    });

    it('should not include checkpoint by default', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test', states: [] },
        story: null,
        componentRuns: [],
        metadata: { checkpoint: {} },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint).toBeUndefined();
    });
  });
});
