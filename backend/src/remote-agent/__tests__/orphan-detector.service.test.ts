/**
 * ST-150: Orphan Detector Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OrphanDetectorService } from '../orphan-detector.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('OrphanDetectorService', () => {
  let service: OrphanDetectorService;

  const mockPrismaService = {
    remoteJob: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    remoteAgent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workflowRun: {
      update: jest.fn(),
    },
    componentRun: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrphanDetectorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrphanDetectorService>(OrphanDetectorService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('detectOrphanedJobs', () => {
    it('should detect stale running jobs without heartbeat', async () => {
      const staleJob = {
        id: 'job-1',
        status: 'running',
        jobType: 'claude-agent',
        lastHeartbeatAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
        agentId: 'agent-1',
      };

      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([staleJob]) // stale running jobs
        .mockResolvedValueOnce([]); // expired waiting jobs
      mockPrismaService.remoteAgent.findUnique.mockResolvedValue({
        id: 'agent-1',
        status: 'offline',
        hostname: 'test-laptop',
      });
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]); // orphaned agents
      mockPrismaService.remoteJob.update.mockResolvedValue({ ...staleJob, status: 'waiting_reconnect' });

      await service.detectOrphanedJobs();

      // Should transition to waiting_reconnect since agent is offline
      expect(mockPrismaService.remoteJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'waiting_reconnect',
          disconnectedAt: expect.any(Date),
          reconnectExpiresAt: expect.any(Date),
        },
      });
    });

    it('should fail stale job if agent is online (crash detection)', async () => {
      const staleJob = {
        id: 'job-2',
        status: 'running',
        jobType: 'claude-agent',
        lastHeartbeatAt: new Date(Date.now() - 6 * 60 * 1000),
        agentId: 'agent-1',
        workflowRunId: null,
        componentRunId: null,
      };

      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([staleJob])
        .mockResolvedValueOnce([]);
      mockPrismaService.remoteAgent.findUnique.mockResolvedValue({
        id: 'agent-1',
        status: 'online',
        hostname: 'test-laptop',
      });
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);
      mockPrismaService.remoteJob.update.mockResolvedValue({ ...staleJob, status: 'failed' });

      await service.detectOrphanedJobs();

      // Should fail the job since agent is online but not heartbeating
      expect(mockPrismaService.remoteJob.update).toHaveBeenCalledWith({
        where: { id: 'job-2' },
        data: {
          status: 'failed',
          error: 'Job timeout - no heartbeat for 5 minutes',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should detect expired waiting_reconnect jobs', async () => {
      const expiredJob = {
        id: 'job-3',
        status: 'waiting_reconnect',
        reconnectExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        agentId: 'agent-1',
        workflowRunId: null,
        componentRunId: null,
      };

      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([]) // stale running jobs
        .mockResolvedValueOnce([expiredJob]); // expired waiting jobs
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);
      mockPrismaService.remoteJob.update.mockResolvedValue({ ...expiredJob, status: 'failed' });

      await service.detectOrphanedJobs();

      expect(mockPrismaService.remoteJob.update).toHaveBeenCalledWith({
        where: { id: 'job-3' },
        data: {
          status: 'failed',
          error: 'Agent did not reconnect within 15 minute grace period',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should detect orphaned agents with stale execution reference', async () => {
      const orphanedAgent = {
        id: 'agent-1',
        hostname: 'test-laptop',
        currentExecutionId: 'completed-job',
      };

      const completedJob = {
        id: 'completed-job',
        status: 'completed', // Not running or waiting_reconnect
      };

      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([orphanedAgent]);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(completedJob);

      await service.detectOrphanedJobs();

      expect(mockPrismaService.remoteAgent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { currentExecutionId: null },
      });
    });

    it('should not fail on database errors (circuit breaker)', async () => {
      mockPrismaService.remoteJob.findMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should not throw
      await expect(service.detectOrphanedJobs()).resolves.not.toThrow();
    });
  });

  describe('failJob', () => {
    it('should update job and clear agent reference', async () => {
      mockPrismaService.remoteJob.update.mockResolvedValue({
        id: 'job-1',
        agentId: 'agent-1',
        workflowRunId: null,
        componentRunId: null,
      });

      // Access private method via runDetection which calls it internally
      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'job-1',
            status: 'waiting_reconnect',
            reconnectExpiresAt: new Date(Date.now() - 1000),
            agentId: 'agent-1',
          },
        ]);
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      await service.runDetection();

      expect(mockPrismaService.remoteAgent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { currentExecutionId: null },
      });
    });

    it('should update workflow run when job has workflowRunId', async () => {
      mockPrismaService.remoteJob.update.mockResolvedValue({
        id: 'job-1',
        agentId: 'agent-1',
        workflowRunId: 'workflow-run-1',
        componentRunId: null,
      });

      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'job-1',
            status: 'waiting_reconnect',
            reconnectExpiresAt: new Date(Date.now() - 1000),
            agentId: 'agent-1',
          },
        ]);
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      await service.runDetection();

      expect(mockPrismaService.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'workflow-run-1' },
        data: {
          executingAgentId: null,
          agentDisconnectedAt: null,
        },
      });
    });

    it('should update component run when job has componentRunId', async () => {
      mockPrismaService.remoteJob.update.mockResolvedValue({
        id: 'job-1',
        agentId: 'agent-1',
        workflowRunId: null,
        componentRunId: 'comp-run-1',
      });

      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'job-1',
            status: 'waiting_reconnect',
            reconnectExpiresAt: new Date(Date.now() - 1000),
            agentId: 'agent-1',
          },
        ]);
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      await service.runDetection();

      expect(mockPrismaService.componentRun.update).toHaveBeenCalledWith({
        where: { id: 'comp-run-1' },
        data: {
          status: 'failed',
          errorType: 'orphan_detection',
          errorMessage: 'Agent did not reconnect within 15 minute grace period',
          finishedAt: expect.any(Date),
        },
      });
    });
  });

  describe('runDetection (manual trigger)', () => {
    it('should return detection counts', async () => {
      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([]) // stale running
        .mockResolvedValueOnce([]); // expired waiting
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      const result = await service.runDetection();

      expect(result).toEqual({
        staleJobs: 0,
        expiredWaiting: 0,
        orphanedAgents: 0,
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status initially', () => {
      const status = service.getHealthStatus();

      expect(status).toEqual({
        healthy: true,
        circuitOpen: false,
        consecutiveFailures: 0,
      });
    });
  });

  describe('circuit breaker behavior', () => {
    it('should open circuit after 5 consecutive failures', async () => {
      mockPrismaService.remoteJob.findMany.mockRejectedValue(new Error('DB error'));

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        await service.detectOrphanedJobs();
      }

      const status = service.getHealthStatus();
      expect(status.circuitOpen).toBe(true);
      expect(status.healthy).toBe(false);
    });

    it('should skip detection when circuit is open', async () => {
      mockPrismaService.remoteJob.findMany.mockRejectedValue(new Error('DB error'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await service.detectOrphanedJobs();
      }

      // Clear mock calls
      mockPrismaService.remoteJob.findMany.mockClear();

      // Try to run detection
      await service.detectOrphanedJobs();

      // Should not have called database
      expect(mockPrismaService.remoteJob.findMany).not.toHaveBeenCalled();
    });

    it('should reset consecutive failures on success', async () => {
      // First, fail once
      mockPrismaService.remoteJob.findMany.mockRejectedValueOnce(new Error('DB error'));
      await service.detectOrphanedJobs();

      let status = service.getHealthStatus();
      expect(status.consecutiveFailures).toBe(1);

      // Then succeed
      mockPrismaService.remoteJob.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      await service.detectOrphanedJobs();

      status = service.getHealthStatus();
      expect(status.consecutiveFailures).toBe(0);
    });
  });
});
