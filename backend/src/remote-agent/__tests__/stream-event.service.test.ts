/**
 * ST-150: Stream Event Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { StreamEventService } from '../stream-event.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StreamEventService', () => {
  let service: StreamEventService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    agentStreamEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamEventService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StreamEventService>(StreamEventService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('storeEvent', () => {
    it('should store an event successfully', async () => {
      mockPrismaService.agentStreamEvent.create.mockResolvedValue({
        id: 'event-123',
        componentRunId: 'comp-run-1',
        workflowRunId: 'workflow-run-1',
        eventType: 'tool_use',
        sequenceNumber: 1,
        timestamp: new Date(),
        payload: { tool: 'Read' },
      });

      await service.storeEvent(
        'comp-run-1',
        'workflow-run-1',
        'tool_use',
        1,
        new Date(),
        { tool: 'Read' },
      );

      expect(mockPrismaService.agentStreamEvent.create).toHaveBeenCalledWith({
        data: {
          componentRunId: 'comp-run-1',
          workflowRunId: 'workflow-run-1',
          eventType: 'tool_use',
          sequenceNumber: 1,
          timestamp: expect.any(Date),
          payload: { tool: 'Read' },
        },
      });
    });

    it('should not throw on database error (observability is non-critical)', async () => {
      mockPrismaService.agentStreamEvent.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should not throw
      await expect(
        service.storeEvent(
          'comp-run-1',
          'workflow-run-1',
          'tool_use',
          1,
          new Date(),
          { tool: 'Read' },
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('getEventsForComponentRun', () => {
    it('should return events for a component run', async () => {
      const mockEvents = [
        { id: '1', eventType: 'stream_start', sequenceNumber: 0 },
        { id: '2', eventType: 'tool_use', sequenceNumber: 1 },
        { id: '3', eventType: 'stream_end', sequenceNumber: 2 },
      ];
      mockPrismaService.agentStreamEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.getEventsForComponentRun('comp-run-1');

      expect(result).toEqual(mockEvents);
      expect(mockPrismaService.agentStreamEvent.findMany).toHaveBeenCalledWith({
        where: { componentRunId: 'comp-run-1' },
        orderBy: { sequenceNumber: 'asc' },
        take: 1000,
      });
    });

    it('should filter by event type when specified', async () => {
      mockPrismaService.agentStreamEvent.findMany.mockResolvedValue([]);

      await service.getEventsForComponentRun('comp-run-1', {
        eventType: 'tool_use',
      });

      expect(mockPrismaService.agentStreamEvent.findMany).toHaveBeenCalledWith({
        where: { componentRunId: 'comp-run-1', eventType: 'tool_use' },
        orderBy: { sequenceNumber: 'asc' },
        take: 1000,
      });
    });

    it('should filter by sequence number when specified', async () => {
      mockPrismaService.agentStreamEvent.findMany.mockResolvedValue([]);

      await service.getEventsForComponentRun('comp-run-1', {
        afterSequence: 5,
      });

      expect(mockPrismaService.agentStreamEvent.findMany).toHaveBeenCalledWith({
        where: {
          componentRunId: 'comp-run-1',
          sequenceNumber: { gt: 5 },
        },
        orderBy: { sequenceNumber: 'asc' },
        take: 1000,
      });
    });

    it('should respect limit option', async () => {
      mockPrismaService.agentStreamEvent.findMany.mockResolvedValue([]);

      await service.getEventsForComponentRun('comp-run-1', { limit: 50 });

      expect(mockPrismaService.agentStreamEvent.findMany).toHaveBeenCalledWith({
        where: { componentRunId: 'comp-run-1' },
        orderBy: { sequenceNumber: 'asc' },
        take: 50,
      });
    });
  });

  describe('getEventsForWorkflowRun', () => {
    it('should return events for a workflow run', async () => {
      const mockEvents = [
        { id: '1', componentRunId: 'comp-1', sequenceNumber: 0 },
        { id: '2', componentRunId: 'comp-1', sequenceNumber: 1 },
        { id: '3', componentRunId: 'comp-2', sequenceNumber: 0 },
      ];
      mockPrismaService.agentStreamEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.getEventsForWorkflowRun('workflow-run-1');

      expect(result).toEqual(mockEvents);
      expect(mockPrismaService.agentStreamEvent.findMany).toHaveBeenCalledWith({
        where: { workflowRunId: 'workflow-run-1' },
        orderBy: [{ componentRunId: 'asc' }, { sequenceNumber: 'asc' }],
        take: 5000,
      });
    });

    it('should filter by event type when specified', async () => {
      mockPrismaService.agentStreamEvent.findMany.mockResolvedValue([]);

      await service.getEventsForWorkflowRun('workflow-run-1', {
        eventType: 'stream_end',
      });

      expect(mockPrismaService.agentStreamEvent.findMany).toHaveBeenCalledWith({
        where: { workflowRunId: 'workflow-run-1', eventType: 'stream_end' },
        orderBy: [{ componentRunId: 'asc' }, { sequenceNumber: 'asc' }],
        take: 5000,
      });
    });
  });

  describe('getLatestEvent', () => {
    it('should return latest event for a component run', async () => {
      const mockEvent = { id: '3', eventType: 'stream_end', sequenceNumber: 10 };
      mockPrismaService.agentStreamEvent.findFirst.mockResolvedValue(mockEvent);

      const result = await service.getLatestEvent('comp-run-1');

      expect(result).toEqual(mockEvent);
      expect(mockPrismaService.agentStreamEvent.findFirst).toHaveBeenCalledWith({
        where: { componentRunId: 'comp-run-1' },
        orderBy: { sequenceNumber: 'desc' },
      });
    });

    it('should return null when no events exist', async () => {
      mockPrismaService.agentStreamEvent.findFirst.mockResolvedValue(null);

      const result = await service.getLatestEvent('comp-run-1');

      expect(result).toBeNull();
    });
  });

  describe('getEventCounts', () => {
    it('should return event counts by type', async () => {
      mockPrismaService.agentStreamEvent.groupBy.mockResolvedValue([
        { eventType: 'tool_use', _count: { id: 15 } },
        { eventType: 'text_delta', _count: { id: 42 } },
        { eventType: 'stream_end', _count: { id: 1 } },
      ]);

      const result = await service.getEventCounts('comp-run-1');

      expect(result).toEqual({
        tool_use: 15,
        text_delta: 42,
        stream_end: 1,
      });
    });

    it('should return empty object when no events', async () => {
      mockPrismaService.agentStreamEvent.groupBy.mockResolvedValue([]);

      const result = await service.getEventCounts('comp-run-1');

      expect(result).toEqual({});
    });
  });

  describe('getTokenMetrics', () => {
    it('should return token metrics from stream_end event', async () => {
      mockPrismaService.agentStreamEvent.findFirst.mockResolvedValue({
        id: '1',
        eventType: 'stream_end',
        payload: {
          metrics: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationTokens: 200,
            cacheReadTokens: 800,
            totalTokens: 2500,
          },
        },
      });

      const result = await service.getTokenMetrics('comp-run-1');

      expect(result).toEqual({
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 200,
        cacheReadTokens: 800,
        totalTokens: 2500,
      });
    });

    it('should return null when no stream_end event exists', async () => {
      mockPrismaService.agentStreamEvent.findFirst.mockResolvedValue(null);

      const result = await service.getTokenMetrics('comp-run-1');

      expect(result).toBeNull();
    });

    it('should return null when stream_end has no metrics', async () => {
      mockPrismaService.agentStreamEvent.findFirst.mockResolvedValue({
        id: '1',
        eventType: 'stream_end',
        payload: {},
      });

      const result = await service.getTokenMetrics('comp-run-1');

      expect(result).toBeNull();
    });

    it('should handle missing metric fields with defaults', async () => {
      mockPrismaService.agentStreamEvent.findFirst.mockResolvedValue({
        id: '1',
        eventType: 'stream_end',
        payload: {
          metrics: {
            inputTokens: 100,
            outputTokens: 50,
            // missing cache fields
          },
        },
      });

      const result = await service.getTokenMetrics('comp-run-1');

      expect(result).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
      });
    });
  });

  describe('cleanupOldEvents', () => {
    it('should delete events older than retention period', async () => {
      mockPrismaService.agentStreamEvent.deleteMany.mockResolvedValue({ count: 150 });

      const result = await service.cleanupOldEvents(30);

      expect(result).toBe(150);
      expect(mockPrismaService.agentStreamEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should use default 30 day retention', async () => {
      mockPrismaService.agentStreamEvent.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOldEvents();

      const callArgs = mockPrismaService.agentStreamEvent.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;

      // Verify cutoff is approximately 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      expect(cutoffDate.getTime()).toBeCloseTo(thirtyDaysAgo.getTime(), -4); // Within ~10 seconds
    });

    it('should respect custom retention period', async () => {
      mockPrismaService.agentStreamEvent.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOldEvents(7);

      const callArgs = mockPrismaService.agentStreamEvent.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;

      // Verify cutoff is approximately 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      expect(cutoffDate.getTime()).toBeCloseTo(sevenDaysAgo.getTime(), -4);
    });
  });
});
