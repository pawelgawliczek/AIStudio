/**
 * Tests for RunnerService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RunnerService, RunnerCheckpoint, RunnerStatus } from '../runner.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RunnerService', () => {
  let service: RunnerService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    // Create mock Prisma service
    const mockPrisma = {
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
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

  describe('saveCheckpoint', () => {
    const testCheckpoint: RunnerCheckpoint = {
      version: 1,
      runId: 'run-123',
      workflowId: 'workflow-456',
      storyId: 'story-789',
      currentStateId: 'state-1',
      currentPhase: 'agent',
      completedStates: ['state-0'],
      skippedStates: [],
      masterSessionId: 'session-abc',
      resourceUsage: {
        tokensUsed: 5000,
        agentSpawns: 2,
        stateTransitions: 3,
        durationMs: 30000,
      },
      checkpointedAt: '2025-01-01T00:00:00Z',
      runStartedAt: '2025-01-01T00:00:00Z',
    };

    it('should save checkpoint to database', async () => {
      prisma.workflowRun.update.mockResolvedValue({} as any);

      await service.saveCheckpoint(testCheckpoint);

      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          currentStateId: 'state-1',
          metadata: {
            checkpoint: testCheckpoint,
            lastCheckpointAt: expect.any(String),
          },
        },
      });
    });

    it('should update lastCheckpointAt timestamp', async () => {
      prisma.workflowRun.update.mockResolvedValue({} as any);

      const beforeSave = new Date().toISOString();
      await service.saveCheckpoint(testCheckpoint);
      const afterSave = new Date().toISOString();

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const metadata = updateCall.data.metadata;

      expect(metadata.lastCheckpointAt).toBeGreaterThanOrEqual(beforeSave);
      expect(metadata.lastCheckpointAt).toBeLessThanOrEqual(afterSave);
    });
  });

  describe('loadCheckpoint', () => {
    it('should load checkpoint from database', async () => {
      const testCheckpoint: RunnerCheckpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'pre',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: {
          tokensUsed: 0,
          agentSpawns: 0,
          stateTransitions: 0,
          durationMs: 0,
        },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      prisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-123',
        metadata: {
          checkpoint: testCheckpoint,
        },
      } as any);

      const result = await service.loadCheckpoint('run-123');

      expect(result).toEqual(testCheckpoint);
    });

    it('should return null if no checkpoint in metadata', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-123',
        metadata: {},
      } as any);

      const result = await service.loadCheckpoint('run-123');

      expect(result).toBeNull();
    });

    it('should return null if metadata is null', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-123',
        metadata: null,
      } as any);

      const result = await service.loadCheckpoint('run-123');

      expect(result).toBeNull();
    });

    it('should throw NotFoundException if run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(service.loadCheckpoint('run-123')).rejects.toThrow(NotFoundException);
      await expect(service.loadCheckpoint('run-123')).rejects.toThrow('WorkflowRun not found');
    });
  });

  describe('deleteCheckpoint', () => {
    it('should delete checkpoint from metadata', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-123',
        metadata: {
          checkpoint: {},
          otherData: 'keep this',
        },
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      await service.deleteCheckpoint('run-123');

      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          metadata: {
            otherData: 'keep this',
          },
        },
      });
    });

    it('should handle null metadata', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-123',
        metadata: null,
      } as any);

      prisma.workflowRun.update.mockResolvedValue({} as any);

      await service.deleteCheckpoint('run-123');

      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          metadata: {},
        },
      });
    });

    it('should throw NotFoundException if run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(service.deleteCheckpoint('run-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    const testStatus: RunnerStatus = {
      state: 'executing',
      currentStateId: 'state-2',
      resourceUsage: {
        tokensUsed: 10000,
        agentSpawns: 3,
        stateTransitions: 5,
        durationMs: 60000,
      },
      warnings: ['Token budget at 85%'],
    };

    it('should update run status', async () => {
      prisma.workflowRun.update.mockResolvedValue({} as any);

      await service.updateStatus('run-123', testStatus);

      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          status: 'running',
          currentStateId: 'state-2',
          metadata: {
            lastStatus: testStatus,
            lastStatusAt: expect.any(String),
          },
        },
      });
    });

    it('should map state to status correctly', async () => {
      prisma.workflowRun.update.mockResolvedValue({} as any);

      const stateToStatus = [
        { state: 'created', expectedStatus: 'pending' },
        { state: 'initializing', expectedStatus: 'running' },
        { state: 'executing', expectedStatus: 'running' },
        { state: 'paused', expectedStatus: 'paused' },
        { state: 'completed', expectedStatus: 'completed' },
        { state: 'failed', expectedStatus: 'failed' },
        { state: 'cancelled', expectedStatus: 'cancelled' },
      ];

      for (const { state, expectedStatus } of stateToStatus) {
        await service.updateStatus('run-123', { ...testStatus, state });

        const call = (prisma.workflowRun.update as jest.Mock).mock.calls.pop();
        expect(call[0].data.status).toBe(expectedStatus);
      }
    });

    it('should default to pending for unknown state', async () => {
      prisma.workflowRun.update.mockResolvedValue({} as any);

      await service.updateStatus('run-123', { ...testStatus, state: 'unknown_state' });

      const call = (prisma.workflowRun.update as jest.Mock).mock.calls.pop();
      expect(call[0].data.status).toBe('pending');
    });
  });

  describe('getTeamContext', () => {
    it('should return team context with workflow and story', async () => {
      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [
            {
              id: 'state-1',
              name: 'State 1',
              order: 1,
              component: { id: 'comp-1', name: 'Component 1' },
            },
          ],
        },
        story: {
          id: 'story-789',
          title: 'Test Story',
        },
        componentRuns: [
          {
            id: 'run-1',
            componentId: 'comp-1',
            status: 'completed',
            output: { result: 'success' },
            component: { name: 'Component 1' },
          },
        ],
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockRun as any);

      const result = await service.getTeamContext('run-123');

      expect(result.runId).toBe('run-123');
      expect(result.workflow).toBeDefined();
      expect(result.story).toBeDefined();
      expect(result.previousOutputs).toHaveProperty('Component 1');
      expect(result.previousOutputs['Component 1']).toEqual({ result: 'success' });
    });

    it('should build previousOutputs from completed runs', async () => {
      const mockRun = {
        id: 'run-123',
        workflow: { id: 'wf-1', states: [] },
        story: null,
        componentRuns: [
          {
            id: 'run-1',
            componentId: 'comp-1',
            status: 'completed',
            output: { data: 'output1' },
            component: { name: 'Comp1' },
          },
          {
            id: 'run-2',
            componentId: 'comp-2',
            status: 'running',
            output: { data: 'output2' },
            component: { name: 'Comp2' },
          },
          {
            id: 'run-3',
            componentId: 'comp-3',
            status: 'completed',
            output: null,
            component: { name: 'Comp3' },
          },
        ],
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockRun as any);

      const result = await service.getTeamContext('run-123');

      // Only completed runs with output should be included
      expect(result.previousOutputs).toHaveProperty('Comp1');
      expect(result.previousOutputs).not.toHaveProperty('Comp2'); // not completed
      expect(result.previousOutputs).not.toHaveProperty('Comp3'); // no output
    });

    it('should throw NotFoundException if run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(service.getTeamContext('run-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWorkflow', () => {
    it('should return workflow with states', async () => {
      const mockWorkflow = {
        id: 'workflow-456',
        name: 'Test Workflow',
        states: [
          {
            id: 'state-1',
            name: 'State 1',
            order: 1,
            component: { id: 'comp-1', name: 'Component 1' },
          },
        ],
      };

      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow as any);

      const result = await service.getWorkflow('workflow-456');

      expect(result).toEqual(mockWorkflow);
    });

    it('should throw NotFoundException if workflow not found', async () => {
      (prisma as any).workflow = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      await expect(service.getWorkflow('workflow-456')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWorkflowRun', () => {
    it('should return workflow run', async () => {
      const mockRun = {
        id: 'run-123',
        workflow: { id: 'workflow-456', name: 'Test Workflow' },
        story: { id: 'story-789', title: 'Test Story' },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockRun as any);

      const result = await service.getWorkflowRun('run-123');

      expect(result).toEqual(mockRun);
    });

    it('should throw NotFoundException if run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(service.getWorkflowRun('run-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listActiveRuns', () => {
    it('should return running and paused runs', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          status: 'running',
          workflow: { id: 'wf-1', name: 'Workflow 1' },
          story: { id: 'story-1', title: 'Story 1' },
          startedAt: new Date('2025-01-01'),
        },
        {
          id: 'run-2',
          status: 'paused',
          workflow: { id: 'wf-2', name: 'Workflow 2' },
          story: null,
          startedAt: new Date('2025-01-02'),
        },
      ];

      prisma.workflowRun.findMany.mockResolvedValue(mockRuns as any);

      const result = await service.listActiveRuns();

      expect(result).toHaveLength(2);
      expect(prisma.workflowRun.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['running', 'paused'],
          },
        },
        include: {
          workflow: true,
          story: true,
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('should return empty array when no active runs', async () => {
      prisma.workflowRun.findMany.mockResolvedValue([]);

      const result = await service.listActiveRuns();

      expect(result).toEqual([]);
    });
  });
});
