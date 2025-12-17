/**
 * Unit Tests for Active Agents Endpoint (ST-259 Phase 1)
 *
 * TDD Implementation - These tests WILL FAIL until getActiveAgents() is implemented
 *
 * Tests cover:
 * - getActiveAgents() method in RemoteAgentGateway
 * - REST endpoint in RemoteAgentController
 * - Authentication requirement (X-Agent-Secret)
 * - Response format validation
 * - Job information enrichment
 */

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryService } from '../../telemetry/telemetry.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { RemoteAgentController } from '../remote-agent.controller';
import { RemoteAgentGateway } from '../remote-agent.gateway';
import { RemoteExecutionService } from '../remote-execution.service';
import { StreamEventService } from '../stream-event.service';
import { TranscriptRegistrationService } from '../transcript-registration.service';

describe('Active Agents Endpoint (TDD)', () => {
  let gateway: RemoteAgentGateway;
  let controller: RemoteAgentController;
  let prismaService: jest.Mocked<PrismaService>;

  // NOTE: TypeScript errors expected until implementation:
  // - Property 'getActiveAgents' does not exist on type 'RemoteAgentGateway'
  // - Property 'getActiveAgents' does not exist on type 'RemoteAgentController'
  // This is intentional TDD - tests written before implementation

  const VALID_SECRET = 'test-agent-secret';
  const INTERNAL_API_SECRET = 'test-internal-secret';
  const INVALID_SECRET = 'wrong-secret';

  const mockPrismaService = {
    remoteAgent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    remoteJob: {
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockStreamEventService = {
    storeEvent: jest.fn(),
  };

  const mockTranscriptRegistrationService = {
    registerTranscript: jest.fn(),
  };

  const mockAppWebSocketGateway = {
    server: {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    },
  };

  const mockRemoteExecutionService = {
    executeScript: jest.fn(),
  };

  const mockTelemetryService = {
    withSpan: jest.fn((name, fn) => fn({ setAttributes: jest.fn(), setAttribute: jest.fn(), recordException: jest.fn() })),
    addSpanAttributes: jest.fn(),
    getCurrentTraceId: jest.fn(() => null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set environment variables for authentication
    process.env.AGENT_SECRET = VALID_SECRET;
    process.env.INTERNAL_API_SECRET = INTERNAL_API_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemoteAgentController],
      providers: [
        RemoteAgentGateway,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: StreamEventService,
          useValue: mockStreamEventService,
        },
        {
          provide: TranscriptRegistrationService,
          useValue: mockTranscriptRegistrationService,
        },
        {
          provide: AppWebSocketGateway,
          useValue: mockAppWebSocketGateway,
        },
        {
          provide: RemoteExecutionService,
          useValue: mockRemoteExecutionService,
        },
        {
          provide: TelemetryService,
          useValue: mockTelemetryService,
        },
      ],
    }).compile();

    gateway = module.get<RemoteAgentGateway>(RemoteAgentGateway);
    controller = module.get<RemoteAgentController>(RemoteAgentController);
    prismaService = module.get(PrismaService) as any;
  });

  afterEach(() => {
    delete process.env.AGENT_SECRET;
    delete process.env.INTERNAL_API_SECRET;
    delete process.env.JWT_SECRET;
  });

  describe('RemoteAgentGateway.getActiveAgents()', () => {
    it('should return online agents with job information', async () => {
      // This test will fail until getActiveAgents() is implemented
      const mockAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: ['parse-transcript', 'git-operations'],
          createdAt: new Date('2025-12-01T10:00:00Z'),
          lastSeenAt: new Date('2025-12-16T10:00:00Z'),
          currentExecutionId: 'job-123',
        },
        {
          id: 'agent-2',
          hostname: 'laptop-2',
          status: 'online',
          capabilities: ['parse-transcript'],
          createdAt: new Date('2025-12-01T11:00:00Z'),
          lastSeenAt: new Date('2025-12-16T10:01:00Z'),
          currentExecutionId: null,
        },
      ];

      const mockJob = {
        id: 'job-123',
        jobType: 'parse-transcript',
        workflowRunId: 'run-456',
      };

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count
        .mockResolvedValueOnce(2) // agent-1 has 2 jobs in flight
        .mockResolvedValueOnce(0); // agent-2 has 0 jobs in flight
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockJob as any);

      const result = await gateway.getActiveAgents();

      expect(result).toHaveLength(2);

      // Verify first agent (with current execution)
      expect(result[0]).toEqual({
        id: 'agent-1',
        hostname: 'laptop-1',
        status: 'online',
        capabilities: ['parse-transcript', 'git-operations'],
        connectedAt: new Date('2025-12-01T10:00:00Z'),
        lastSeenAt: new Date('2025-12-16T10:00:00Z'),
        currentJobId: 'job-123',
        currentJobType: 'parse-transcript',
        currentWorkflowRunId: 'run-456',
        jobsInFlight: 2,
      });

      // Verify second agent (no current execution)
      expect(result[1]).toEqual({
        id: 'agent-2',
        hostname: 'laptop-2',
        status: 'online',
        capabilities: ['parse-transcript'],
        connectedAt: new Date('2025-12-01T11:00:00Z'),
        lastSeenAt: new Date('2025-12-16T10:01:00Z'),
        currentJobId: undefined,
        currentJobType: undefined,
        currentWorkflowRunId: undefined,
        jobsInFlight: 0,
      });

      // Verify correct query was made
      expect(mockPrismaService.remoteAgent.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { status: 'online' },
            { currentExecutionId: { not: null } },
          ],
        },
        orderBy: { lastSeenAt: 'desc' },
      });
    });

    it('should include agents with currentExecutionId even if status is offline', async () => {
      // ST-259: Include agents that are currently executing even if marked offline
      const mockAgents = [
        {
          id: 'agent-stale',
          hostname: 'laptop-stale',
          status: 'offline',
          capabilities: ['parse-transcript'],
          createdAt: new Date('2025-12-01T10:00:00Z'),
          lastSeenAt: new Date('2025-12-16T09:00:00Z'),
          currentExecutionId: 'job-stale',
        },
      ];

      const mockJob = {
        id: 'job-stale',
        jobType: 'analyze-transcripts',
        workflowRunId: 'run-stale',
      };

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(1);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockJob as any);

      const result = await gateway.getActiveAgents();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'agent-stale',
        hostname: 'laptop-stale',
        status: 'offline',
        capabilities: ['parse-transcript'],
        connectedAt: new Date('2025-12-01T10:00:00Z'),
        lastSeenAt: new Date('2025-12-16T09:00:00Z'),
        currentJobId: 'job-stale',
        currentJobType: 'analyze-transcripts',
        currentWorkflowRunId: 'run-stale',
        jobsInFlight: 1,
      });
    });

    it('should handle agents with no jobs in flight', async () => {
      const mockAgents = [
        {
          id: 'agent-idle',
          hostname: 'laptop-idle',
          status: 'online',
          capabilities: ['git-operations'],
          createdAt: new Date('2025-12-01T10:00:00Z'),
          lastSeenAt: new Date('2025-12-16T10:00:00Z'),
          currentExecutionId: null,
        },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(0);

      const result = await gateway.getActiveAgents();

      expect(result).toHaveLength(1);
      expect(result[0].jobsInFlight).toBe(0);
      expect(result[0].currentJobId).toBeUndefined();
      expect(result[0].currentJobType).toBeUndefined();
      expect(result[0].currentWorkflowRunId).toBeUndefined();
    });

    it('should return empty array when no agents are active', async () => {
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      const result = await gateway.getActiveAgents();

      expect(result).toEqual([]);
    });

    it('should handle missing current job gracefully', async () => {
      const mockAgents = [
        {
          id: 'agent-missing-job',
          hostname: 'laptop-missing',
          status: 'online',
          capabilities: ['parse-transcript'],
          createdAt: new Date('2025-12-01T10:00:00Z'),
          lastSeenAt: new Date('2025-12-16T10:00:00Z'),
          currentExecutionId: 'job-nonexistent',
        },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(0);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(null); // Job not found

      const result = await gateway.getActiveAgents();

      expect(result).toHaveLength(1);
      expect(result[0].currentJobId).toBeUndefined();
      expect(result[0].currentJobType).toBeUndefined();
      expect(result[0].currentWorkflowRunId).toBeUndefined();
    });

    it('should count jobs in pending, running, and paused status', async () => {
      const mockAgents = [
        {
          id: 'agent-busy',
          hostname: 'laptop-busy',
          status: 'online',
          capabilities: ['parse-transcript'],
          createdAt: new Date('2025-12-01T10:00:00Z'),
          lastSeenAt: new Date('2025-12-16T10:00:00Z'),
          currentExecutionId: null,
        },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(5);

      await gateway.getActiveAgents();

      // Verify count query includes correct status filters
      expect(mockPrismaService.remoteJob.count).toHaveBeenCalledWith({
        where: {
          agentId: 'agent-busy',
          status: { in: ['pending', 'running', 'paused'] },
        },
      });
    });

    it('should order agents by lastSeenAt descending', async () => {
      const mockAgents = [
        {
          id: 'agent-recent',
          hostname: 'laptop-recent',
          status: 'online',
          capabilities: [],
          createdAt: new Date('2025-12-01T10:00:00Z'),
          lastSeenAt: new Date('2025-12-16T10:05:00Z'),
          currentExecutionId: null,
        },
        {
          id: 'agent-older',
          hostname: 'laptop-older',
          status: 'online',
          capabilities: [],
          createdAt: new Date('2025-12-01T10:00:00Z'),
          lastSeenAt: new Date('2025-12-16T10:00:00Z'),
          currentExecutionId: null,
        },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(0);

      const result = await gateway.getActiveAgents();

      expect(result[0].hostname).toBe('laptop-recent');
      expect(result[1].hostname).toBe('laptop-older');

      expect(mockPrismaService.remoteAgent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastSeenAt: 'desc' },
        })
      );
    });
  });

  describe('RemoteAgentController.getActiveAgents() - Authentication', () => {
    it('should return active agents with valid AGENT_SECRET', async () => {
      // Mock gateway method
      const mockActiveAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: ['parse-transcript'],
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          jobsInFlight: 0,
        },
      ];

      jest.spyOn(gateway, 'getActiveAgents').mockResolvedValue(mockActiveAgents as any);

      const result = await controller.getActiveAgents(VALID_SECRET);

      expect(result).toEqual(mockActiveAgents);
      expect(gateway.getActiveAgents).toHaveBeenCalled();
    });

    it('should return active agents with valid INTERNAL_API_SECRET', async () => {
      // ST-259: Accept INTERNAL_API_SECRET for Grafana calls
      const mockActiveAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: ['parse-transcript'],
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          jobsInFlight: 0,
        },
      ];

      jest.spyOn(gateway, 'getActiveAgents').mockResolvedValue(mockActiveAgents as any);

      const result = await controller.getActiveAgents(INTERNAL_API_SECRET);

      expect(result).toEqual(mockActiveAgents);
      expect(gateway.getActiveAgents).toHaveBeenCalled();
    });

    it('should reject request with invalid secret', async () => {
      await expect(
        controller.getActiveAgents(INVALID_SECRET)
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.getActiveAgents(INVALID_SECRET)
      ).rejects.toThrow('Invalid or missing X-Agent-Secret header');
    });

    it('should reject request with missing secret', async () => {
      await expect(
        controller.getActiveAgents(undefined as any)
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.getActiveAgents(undefined as any)
      ).rejects.toThrow('Invalid or missing X-Agent-Secret header');
    });

    it('should reject request with empty secret', async () => {
      await expect(
        controller.getActiveAgents('')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not call gateway if authentication fails', async () => {
      const gatewaySpy = jest.spyOn(gateway, 'getActiveAgents');

      await expect(
        controller.getActiveAgents(INVALID_SECRET)
      ).rejects.toThrow();

      expect(gatewaySpy).not.toHaveBeenCalled();
    });
  });

  describe('Response Format Validation', () => {
    it('should return correctly typed response', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: ['parse-transcript', 'git-operations'],
          createdAt: new Date('2025-12-01T10:00:00Z'),
          lastSeenAt: new Date('2025-12-16T10:00:00Z'),
          currentExecutionId: 'job-123',
        },
      ];

      const mockJob = {
        id: 'job-123',
        jobType: 'parse-transcript',
        workflowRunId: 'run-456',
      };

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(1);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockJob as any);

      const result = await gateway.getActiveAgents();

      // Verify all required fields are present
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('hostname');
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('capabilities');
      expect(result[0]).toHaveProperty('connectedAt');
      expect(result[0]).toHaveProperty('lastSeenAt');
      expect(result[0]).toHaveProperty('jobsInFlight');

      // Verify optional fields
      expect(result[0]).toHaveProperty('currentJobId');
      expect(result[0]).toHaveProperty('currentJobType');
      expect(result[0]).toHaveProperty('currentWorkflowRunId');

      // Verify types
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].hostname).toBe('string');
      expect(typeof result[0].status).toBe('string');
      expect(Array.isArray(result[0].capabilities)).toBe(true);
      expect(result[0].connectedAt).toBeInstanceOf(Date);
      expect(result[0].lastSeenAt).toBeInstanceOf(Date);
      expect(typeof result[0].jobsInFlight).toBe('number');
    });

    it('should handle all agent statuses correctly', async () => {
      const statuses = ['online', 'offline', 'error'];

      for (const status of statuses) {
        const mockAgents = [
          {
            id: `agent-${status}`,
            hostname: `laptop-${status}`,
            status,
            capabilities: [],
            createdAt: new Date(),
            lastSeenAt: new Date(),
            currentExecutionId: null,
          },
        ];

        mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
        mockPrismaService.remoteJob.count.mockResolvedValue(0);

        const result = await gateway.getActiveAgents();

        expect(result[0].status).toBe(status);
      }
    });

    it('should handle empty capabilities array', async () => {
      const mockAgents = [
        {
          id: 'agent-no-caps',
          hostname: 'laptop-no-caps',
          status: 'online',
          capabilities: [],
          createdAt: new Date(),
          lastSeenAt: new Date(),
          currentExecutionId: null,
        },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(0);

      const result = await gateway.getActiveAgents();

      expect(result[0].capabilities).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrismaService.remoteAgent.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(gateway.getActiveAgents()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle job count query errors', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: [],
          createdAt: new Date(),
          lastSeenAt: new Date(),
          currentExecutionId: null,
        },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockRejectedValue(
        new Error('Job query failed')
      );

      await expect(gateway.getActiveAgents()).rejects.toThrow(
        'Job query failed'
      );
    });

    it('should handle job detail query errors', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: [],
          createdAt: new Date(),
          lastSeenAt: new Date(),
          currentExecutionId: 'job-123',
        },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(1);
      mockPrismaService.remoteJob.findUnique.mockRejectedValue(
        new Error('Job detail query failed')
      );

      await expect(gateway.getActiveAgents()).rejects.toThrow(
        'Job detail query failed'
      );
    });
  });

  describe('Performance', () => {
    it('should handle large number of active agents efficiently', async () => {
      const mockAgents = Array(100).fill(0).map((_, i) => ({
        id: `agent-${i}`,
        hostname: `laptop-${i}`,
        status: 'online',
        capabilities: ['parse-transcript'],
        createdAt: new Date(),
        lastSeenAt: new Date(),
        currentExecutionId: null,
      }));

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(0);

      const startTime = Date.now();
      const result = await gateway.getActiveAgents();
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(100);

      // Should complete in reasonable time (target: <100ms from plan)
      // Allow more headroom for test environments
      expect(duration).toBeLessThan(500);
    });

    it('should batch job queries efficiently', async () => {
      const mockAgents = Array(10).fill(0).map((_, i) => ({
        id: `agent-${i}`,
        hostname: `laptop-${i}`,
        status: 'online',
        capabilities: [],
        createdAt: new Date(),
        lastSeenAt: new Date(),
        currentExecutionId: `job-${i}`,
      }));

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);
      mockPrismaService.remoteJob.count.mockResolvedValue(1);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue({
        id: 'job-1',
        jobType: 'test',
        workflowRunId: 'run-1',
      } as any);

      await gateway.getActiveAgents();

      // Should query job count for each agent
      expect(mockPrismaService.remoteJob.count).toHaveBeenCalledTimes(10);

      // Should query job details for agents with currentExecutionId
      expect(mockPrismaService.remoteJob.findUnique).toHaveBeenCalledTimes(10);
    });
  });
});
