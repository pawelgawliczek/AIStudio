/**
 * Tests for RunnerController
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RunnerController } from '../runner.controller';
import { RunnerService, RunnerCheckpoint, RunnerStatus } from '../runner.service';

describe('RunnerController', () => {
  let controller: RunnerController;
  let service: jest.Mocked<RunnerService>;

  beforeEach(async () => {
    const mockService = {
      saveCheckpoint: jest.fn(),
      loadCheckpoint: jest.fn(),
      deleteCheckpoint: jest.fn(),
      updateStatus: jest.fn(),
      getTeamContext: jest.fn(),
      getWorkflow: jest.fn(),
      getWorkflowRun: jest.fn(),
      listActiveRuns: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RunnerController],
      providers: [
        {
          provide: RunnerService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<RunnerController>(RunnerController);
    service = module.get(RunnerService) as jest.Mocked<RunnerService>;
  });

  describe('saveCheckpoint', () => {
    it('should save checkpoint and return success', async () => {
      const checkpoint: RunnerCheckpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'agent',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: {
          tokensUsed: 1000,
          agentSpawns: 1,
          stateTransitions: 2,
          durationMs: 5000,
        },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      service.saveCheckpoint.mockResolvedValue();

      const result = await controller.saveCheckpoint({
        runId: 'run-123',
        workflowId: 'workflow-456',
        checkpointData: checkpoint,
      });

      expect(result).toEqual({ success: true });
      expect(service.saveCheckpoint).toHaveBeenCalledWith(checkpoint);
    });

    it('should save checkpoint with story ID', async () => {
      const checkpoint: RunnerCheckpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        storyId: 'story-789',
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

      service.saveCheckpoint.mockResolvedValue();

      await controller.saveCheckpoint({
        runId: 'run-123',
        workflowId: 'workflow-456',
        storyId: 'story-789',
        checkpointData: checkpoint,
      });

      expect(service.saveCheckpoint).toHaveBeenCalledWith(checkpoint);
    });
  });

  describe('loadCheckpoint', () => {
    it('should load checkpoint and return data', async () => {
      const checkpoint: RunnerCheckpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
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

      service.loadCheckpoint.mockResolvedValue(checkpoint);

      const result = await controller.loadCheckpoint('run-123');

      expect(result).toEqual({ checkpointData: checkpoint });
      expect(service.loadCheckpoint).toHaveBeenCalledWith('run-123');
    });

    it('should return null when checkpoint not found', async () => {
      service.loadCheckpoint.mockResolvedValue(null);

      const result = await controller.loadCheckpoint('run-123');

      expect(result).toEqual({ checkpointData: null });
    });
  });

  describe('deleteCheckpoint', () => {
    it('should delete checkpoint', async () => {
      service.deleteCheckpoint.mockResolvedValue();

      await controller.deleteCheckpoint('run-123');

      expect(service.deleteCheckpoint).toHaveBeenCalledWith('run-123');
    });
  });

  describe('reportStatus', () => {
    it('should update status and return success', async () => {
      const status: RunnerStatus = {
        state: 'executing',
        currentStateId: 'state-2',
        resourceUsage: {
          tokensUsed: 10000,
          agentSpawns: 3,
          stateTransitions: 5,
          durationMs: 60000,
        },
      };

      service.updateStatus.mockResolvedValue();

      const result = await controller.reportStatus('run-123', status);

      expect(result).toEqual({ success: true });
      expect(service.updateStatus).toHaveBeenCalledWith('run-123', status);
    });

    it('should handle status with warnings', async () => {
      const status: RunnerStatus = {
        state: 'executing',
        resourceUsage: {
          tokensUsed: 400000,
          agentSpawns: 15,
          stateTransitions: 40,
          durationMs: 6000000,
        },
        warnings: [
          'Token budget at 80%',
          'Agent spawns at 75%',
          'State transitions at 80%',
        ],
      };

      service.updateStatus.mockResolvedValue();

      await controller.reportStatus('run-123', status);

      expect(service.updateStatus).toHaveBeenCalledWith('run-123', status);
    });
  });

  describe('getTeamContext', () => {
    it('should return team context', async () => {
      const context = {
        runId: 'run-123',
        workflow: {
          id: 'workflow-456',
          name: 'Test Workflow',
          states: [],
        },
        story: {
          id: 'story-789',
          title: 'Test Story',
        },
        previousOutputs: {
          'Component1': { result: 'success' },
        },
      };

      service.getTeamContext.mockResolvedValue(context);

      const result = await controller.getTeamContext('run-123');

      expect(result).toEqual(context);
      expect(service.getTeamContext).toHaveBeenCalledWith('run-123');
    });

    it('should handle context without story', async () => {
      const context = {
        runId: 'run-123',
        workflow: { id: 'workflow-456', name: 'Test Workflow' },
        story: null,
        previousOutputs: {},
      };

      service.getTeamContext.mockResolvedValue(context);

      const result = await controller.getTeamContext('run-123');

      expect(result.story).toBeNull();
    });
  });

  describe('getWorkflow', () => {
    it('should return workflow details', async () => {
      const workflow = {
        id: 'workflow-456',
        name: 'Test Workflow',
        description: 'Test Description',
        states: [
          {
            id: 'state-1',
            name: 'State 1',
            order: 1,
            component: { id: 'comp-1', name: 'Component 1' },
          },
        ],
      };

      service.getWorkflow.mockResolvedValue(workflow);

      const result = await controller.getWorkflow('workflow-456');

      expect(result).toEqual(workflow);
      expect(service.getWorkflow).toHaveBeenCalledWith('workflow-456');
    });
  });

  describe('getWorkflowRun', () => {
    it('should return workflow run details', async () => {
      const run = {
        id: 'run-123',
        workflowId: 'workflow-456',
        status: 'running',
        workflow: { id: 'workflow-456', name: 'Test Workflow' },
        story: { id: 'story-789', title: 'Test Story' },
      };

      service.getWorkflowRun.mockResolvedValue(run);

      const result = await controller.getWorkflowRun('run-123');

      expect(result).toEqual(run);
      expect(service.getWorkflowRun).toHaveBeenCalledWith('run-123');
    });
  });

  describe('listActiveRuns', () => {
    it('should return list of active runs', async () => {
      const runs = [
        {
          id: 'run-1',
          status: 'running',
          workflow: { id: 'wf-1', name: 'Workflow 1' },
          story: { id: 'story-1', title: 'Story 1' },
        },
        {
          id: 'run-2',
          status: 'paused',
          workflow: { id: 'wf-2', name: 'Workflow 2' },
          story: null,
        },
      ];

      service.listActiveRuns.mockResolvedValue(runs);

      const result = await controller.listActiveRuns();

      expect(result).toEqual({ runs });
      expect(service.listActiveRuns).toHaveBeenCalled();
    });

    it('should return empty list when no active runs', async () => {
      service.listActiveRuns.mockResolvedValue([]);

      const result = await controller.listActiveRuns();

      expect(result).toEqual({ runs: [] });
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors', async () => {
      service.loadCheckpoint.mockRejectedValue(new Error('Database error'));

      await expect(controller.loadCheckpoint('run-123')).rejects.toThrow('Database error');
    });

    it('should handle checkpoint save errors', async () => {
      const checkpoint: RunnerCheckpoint = {
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

      service.saveCheckpoint.mockRejectedValue(new Error('Save failed'));

      await expect(
        controller.saveCheckpoint({
          runId: 'run-123',
          workflowId: 'workflow-456',
          checkpointData: checkpoint,
        })
      ).rejects.toThrow('Save failed');
    });
  });
});
