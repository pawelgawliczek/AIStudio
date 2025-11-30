/**
 * Tests for BreakpointService
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BreakpointService, BreakpointContext } from '../breakpoint.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BreakpointPosition } from '@prisma/client';

describe('BreakpointService', () => {
  let service: BreakpointService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockBreakpoint = {
    id: 'bp-123',
    workflowRunId: 'run-123',
    stateId: 'state-1',
    position: 'before' as BreakpointPosition,
    isActive: true,
    isTemporary: false,
    condition: null,
    hitAt: null,
    createdAt: new Date(),
    state: {
      name: 'analysis',
      order: 1,
    },
  };

  const mockContext: BreakpointContext = {
    tokensUsed: 5000,
    agentSpawns: 2,
    stateTransitions: 3,
    durationMs: 60000,
    currentStateIndex: 1,
    totalStates: 4,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      runnerBreakpoint: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BreakpointService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BreakpointService>(BreakpointService);
    prismaService = module.get(PrismaService);
  });

  describe('loadBreakpoints', () => {
    it('should load active breakpoints for a run', async () => {
      (prismaService.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        mockBreakpoint,
      ]);
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T00:00:00Z' },
      });

      const result = await service.loadBreakpoints('run-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('bp-123');
      expect(result[0].stateName).toBe('analysis');
      expect(result[0].stateOrder).toBe(1);
    });

    it('should cache loaded breakpoints', async () => {
      (prismaService.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        mockBreakpoint,
      ]);
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T00:00:00Z' },
      });

      await service.loadBreakpoints('run-123');
      const cached = service.getCachedBreakpoints('run-123');

      expect(cached).toHaveLength(1);
      expect(cached![0].id).toBe('bp-123');
    });
  });

  describe('syncIfNeeded', () => {
    it('should reload if no cache exists', async () => {
      (prismaService.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: null,
      });

      const result = await service.syncIfNeeded('run-123');

      expect(result).toBe(true);
      expect(prismaService.runnerBreakpoint.findMany).toHaveBeenCalled();
    });

    it('should reload if breakpointsModifiedAt changed', async () => {
      // First load
      (prismaService.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        mockBreakpoint,
      ]);
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T00:00:00Z' },
      });
      await service.loadBreakpoints('run-123');

      // Change modified time
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T01:00:00Z' },
      });

      const result = await service.syncIfNeeded('run-123');

      expect(result).toBe(true);
    });

    it('should not reload if cache is valid', async () => {
      // First load
      (prismaService.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        mockBreakpoint,
      ]);
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T00:00:00Z' },
      });
      await service.loadBreakpoints('run-123');

      // Same modified time
      jest.clearAllMocks();
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T00:00:00Z' },
      });

      const result = await service.syncIfNeeded('run-123');

      expect(result).toBe(false);
      expect(prismaService.runnerBreakpoint.findMany).not.toHaveBeenCalled();
    });
  });

  describe('shouldPause', () => {
    beforeEach(async () => {
      (prismaService.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        mockBreakpoint,
      ]);
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T00:00:00Z' },
      });
    });

    it('should return shouldPause=true for matching breakpoint', async () => {
      const result = await service.shouldPause(
        'run-123',
        'state-1',
        'before',
        mockContext
      );

      expect(result.shouldPause).toBe(true);
      expect(result.breakpoint).toBeDefined();
      expect(result.breakpoint!.id).toBe('bp-123');
      expect(result.reason).toBe('breakpoint_hit');
    });

    it('should return shouldPause=false for non-matching state', async () => {
      const result = await service.shouldPause(
        'run-123',
        'state-999',
        'before',
        mockContext
      );

      expect(result.shouldPause).toBe(false);
    });

    it('should return shouldPause=false for non-matching position', async () => {
      const result = await service.shouldPause(
        'run-123',
        'state-1',
        'after',
        mockContext
      );

      expect(result.shouldPause).toBe(false);
    });
  });

  describe('shouldPause with conditions', () => {
    it('should pause when condition is met', async () => {
      const conditionalBreakpoint = {
        ...mockBreakpoint,
        condition: { tokensUsed: { $gt: 1000 } },
      };

      (prismaService.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        conditionalBreakpoint,
      ]);
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T00:00:00Z' },
      });

      const result = await service.shouldPause(
        'run-123',
        'state-1',
        'before',
        { ...mockContext, tokensUsed: 5000 }
      );

      expect(result.shouldPause).toBe(true);
      expect(result.reason).toBe('conditional_breakpoint_hit');
    });

    it('should not pause when condition is not met', async () => {
      const conditionalBreakpoint = {
        ...mockBreakpoint,
        condition: { tokensUsed: { $gt: 10000 } },
      };

      (prismaService.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        conditionalBreakpoint,
      ]);
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { breakpointsModifiedAt: '2025-01-01T00:00:00Z' },
      });

      const result = await service.shouldPause(
        'run-123',
        'state-1',
        'before',
        { ...mockContext, tokensUsed: 5000 }
      );

      expect(result.shouldPause).toBe(false);
      expect(result.reason).toBe('condition_not_met');
    });
  });

  describe('recordHit', () => {
    it('should update hitAt for persistent breakpoints', async () => {
      const breakpointData = {
        id: 'bp-123',
        stateId: 'state-1',
        stateName: 'analysis',
        stateOrder: 1,
        position: 'before' as BreakpointPosition,
        isActive: true,
        isTemporary: false,
        condition: null,
        hitAt: null,
        createdAt: new Date(),
      };

      await service.recordHit(breakpointData);

      expect(prismaService.runnerBreakpoint.update).toHaveBeenCalledWith({
        where: { id: 'bp-123' },
        data: { hitAt: expect.any(Date) },
      });
    });

    it('should delete temporary breakpoints', async () => {
      const breakpointData = {
        id: 'bp-temp',
        stateId: 'state-1',
        stateName: 'analysis',
        stateOrder: 1,
        position: 'before' as BreakpointPosition,
        isActive: true,
        isTemporary: true,
        condition: null,
        hitAt: null,
        createdAt: new Date(),
      };

      await service.recordHit(breakpointData);

      expect(prismaService.runnerBreakpoint.delete).toHaveBeenCalledWith({
        where: { id: 'bp-temp' },
      });
      expect(prismaService.runnerBreakpoint.update).not.toHaveBeenCalled();
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate $gt operator', () => {
      expect(
        service.evaluateCondition({ tokensUsed: { $gt: 1000 } }, mockContext)
      ).toBe(true);

      expect(
        service.evaluateCondition({ tokensUsed: { $gt: 10000 } }, mockContext)
      ).toBe(false);
    });

    it('should evaluate $gte operator', () => {
      expect(
        service.evaluateCondition({ tokensUsed: { $gte: 5000 } }, mockContext)
      ).toBe(true);

      expect(
        service.evaluateCondition({ tokensUsed: { $gte: 5001 } }, mockContext)
      ).toBe(false);
    });

    it('should evaluate $lt operator', () => {
      expect(
        service.evaluateCondition({ tokensUsed: { $lt: 10000 } }, mockContext)
      ).toBe(true);

      expect(
        service.evaluateCondition({ tokensUsed: { $lt: 1000 } }, mockContext)
      ).toBe(false);
    });

    it('should evaluate $lte operator', () => {
      expect(
        service.evaluateCondition({ tokensUsed: { $lte: 5000 } }, mockContext)
      ).toBe(true);

      expect(
        service.evaluateCondition({ tokensUsed: { $lte: 4999 } }, mockContext)
      ).toBe(false);
    });

    it('should evaluate $eq operator', () => {
      expect(
        service.evaluateCondition({ agentSpawns: { $eq: 2 } }, mockContext)
      ).toBe(true);

      expect(
        service.evaluateCondition({ agentSpawns: { $eq: 3 } }, mockContext)
      ).toBe(false);
    });

    it('should evaluate $ne operator', () => {
      expect(
        service.evaluateCondition({ agentSpawns: { $ne: 5 } }, mockContext)
      ).toBe(true);

      expect(
        service.evaluateCondition({ agentSpawns: { $ne: 2 } }, mockContext)
      ).toBe(false);
    });

    it('should evaluate $and operator', () => {
      expect(
        service.evaluateCondition(
          {
            $and: [
              { tokensUsed: { $gt: 1000 } },
              { agentSpawns: { $gte: 2 } },
            ],
          },
          mockContext
        )
      ).toBe(true);

      expect(
        service.evaluateCondition(
          {
            $and: [
              { tokensUsed: { $gt: 10000 } },
              { agentSpawns: { $gte: 2 } },
            ],
          },
          mockContext
        )
      ).toBe(false);
    });

    it('should evaluate $or operator', () => {
      expect(
        service.evaluateCondition(
          {
            $or: [
              { tokensUsed: { $gt: 10000 } },
              { agentSpawns: { $eq: 2 } },
            ],
          },
          mockContext
        )
      ).toBe(true);

      expect(
        service.evaluateCondition(
          {
            $or: [
              { tokensUsed: { $gt: 10000 } },
              { agentSpawns: { $eq: 5 } },
            ],
          },
          mockContext
        )
      ).toBe(false);
    });

    it('should evaluate $not operator', () => {
      expect(
        service.evaluateCondition(
          { $not: { tokensUsed: { $gt: 10000 } } },
          mockContext
        )
      ).toBe(true);

      expect(
        service.evaluateCondition(
          { $not: { tokensUsed: { $gt: 1000 } } },
          mockContext
        )
      ).toBe(false);
    });

    it('should support field aliases', () => {
      // tokenCount -> tokensUsed
      expect(
        service.evaluateCondition({ tokenCount: { $gt: 1000 } }, mockContext)
      ).toBe(true);

      // spawns -> agentSpawns
      expect(
        service.evaluateCondition({ spawns: { $eq: 2 } }, mockContext)
      ).toBe(true);

      // duration -> durationMs
      expect(
        service.evaluateCondition({ duration: { $gt: 30000 } }, mockContext)
      ).toBe(true);
    });

    it('should evaluate direct equality', () => {
      expect(
        service.evaluateCondition({ agentSpawns: 2 }, mockContext)
      ).toBe(true);

      expect(
        service.evaluateCondition({ agentSpawns: 5 }, mockContext)
      ).toBe(false);
    });
  });

  describe('setPaused', () => {
    it('should set isPaused and pauseReason', async () => {
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: { someKey: 'someValue' },
      });

      await service.setPaused('run-123', true, 'breakpoint_hit');

      expect(prismaService.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          isPaused: true,
          pauseReason: 'breakpoint_hit',
        }),
      });
    });

    it('should clear pauseReason when resuming', async () => {
      (prismaService.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        metadata: {},
      });

      await service.setPaused('run-123', false);

      expect(prismaService.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          isPaused: false,
          pauseReason: null,
        }),
      });
    });
  });
});
