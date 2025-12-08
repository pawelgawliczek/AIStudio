/**
 * Tests for manage_breakpoints MCP tool
 * ST-187: MCP Tool Optimization & Step Commands
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../manage_breakpoints';

describe('manage_breakpoints MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      story: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      workflowRun: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      runnerBreakpoint: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockRun = () => ({
    id: 'run-uuid',
    status: 'running',
    storyId: 'story-uuid',
    metadata: {},
    workflow: {
      id: 'workflow-uuid',
      name: 'Test Workflow',
      states: [
        { id: 'state-1', name: 'analysis', order: 1 },
        { id: 'state-2', name: 'implementation', order: 2 },
      ],
    },
    story: { id: 'story-uuid', key: 'ST-123', title: 'Test' },
  });

  describe('Input Validation', () => {
    it('should throw error if neither story nor runId provided (except clearByBreakpointId)', async () => {
      await expect(handler(mockPrisma, { action: 'list' })).rejects.toThrow(
        'Either story or runId is required'
      );
    });
  });

  describe('Set Action', () => {
    it('should create new breakpoint', async () => {
      const mockRun = createMockRun();
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({
        id: 'bp-uuid',
        stateId: 'state-1',
        position: 'before',
        isActive: true,
        condition: null,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      // Resolve story first
      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue({
        id: 'story-uuid',
        key: 'ST-123',
        title: 'Test',
        status: 'planning',
        projectId: 'project-uuid',
      });
      (mockPrisma.workflowRun.findFirst as jest.Mock).mockResolvedValue({
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        status: 'running',
        storyId: 'story-uuid',
      });

      const result: any = await handler(mockPrisma, {
        action: 'set',
        story: 'ST-123',
        stateName: 'analysis',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('set');
      expect(result.status).toBe('created');
      expect(result.breakpointId).toBe('bp-uuid');
    });

    it('should reactivate existing inactive breakpoint', async () => {
      const mockRun = createMockRun();
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-uuid',
        stateId: 'state-1',
        position: 'before',
        isActive: false,
        condition: null,
      });
      (mockPrisma.runnerBreakpoint.update as jest.Mock).mockResolvedValue({
        id: 'bp-uuid',
        stateId: 'state-1',
        position: 'before',
        isActive: true,
        condition: null,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, {
        action: 'set',
        runId: 'run-uuid',
        stateName: 'analysis',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('reactivated');
    });

    it('should return already_exists for active breakpoint', async () => {
      const mockRun = createMockRun();
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-uuid',
        stateId: 'state-1',
        position: 'before',
        isActive: true,
        condition: null,
      });

      const result: any = await handler(mockPrisma, {
        action: 'set',
        runId: 'run-uuid',
        stateName: 'analysis',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('already_exists');
    });
  });

  describe('Clear Action', () => {
    it('should clear by breakpoint ID', async () => {
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-uuid',
        workflowRunId: 'run-uuid',
        stateId: 'state-1',
        position: 'before',
        state: { name: 'analysis' },
      });
      (mockPrisma.runnerBreakpoint.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({ metadata: {} });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result: any = await handler(mockPrisma, {
        action: 'clear',
        breakpointId: 'bp-uuid',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('clear');
      expect(result.clearedCount).toBe(1);
    });

    it('should clear all breakpoints', async () => {
      const mockRun = createMockRun();
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        { id: 'bp-1', state: { name: 'analysis' }, position: 'before' },
        { id: 'bp-2', state: { name: 'implementation' }, position: 'after' },
      ]);
      (mockPrisma.runnerBreakpoint.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result: any = await handler(mockPrisma, {
        action: 'clear',
        runId: 'run-uuid',
        clearAll: true,
      });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(2);
    });

    it('should clear by state and position', async () => {
      const mockRun = createMockRun();
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-uuid',
        workflowRunId: 'run-uuid',
      });
      (mockPrisma.runnerBreakpoint.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result: any = await handler(mockPrisma, {
        action: 'clear',
        runId: 'run-uuid',
        stateName: 'analysis',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(1);
    });
  });

  describe('List Action', () => {
    it('should list active breakpoints', async () => {
      const mockRun = createMockRun();
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'bp-1',
          stateId: 'state-1',
          position: 'before',
          isActive: true,
          isTemporary: false,
          condition: null,
          hitAt: null,
          createdAt: new Date(),
          state: { name: 'analysis', order: 1 },
        },
      ]);

      const result: any = await handler(mockPrisma, {
        action: 'list',
        runId: 'run-uuid',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('list');
      expect(result.breakpoints).toHaveLength(1);
      expect(result.breakpoints[0].stateName).toBe('analysis');
      expect(result.summary.active).toBe(1);
    });

    it('should include inactive when requested', async () => {
      const mockRun = createMockRun();
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'bp-1',
          stateId: 'state-1',
          position: 'before',
          isActive: true,
          isTemporary: false,
          condition: null,
          hitAt: null,
          createdAt: new Date(),
          state: { name: 'analysis', order: 1 },
        },
        {
          id: 'bp-2',
          stateId: 'state-2',
          position: 'after',
          isActive: false,
          isTemporary: false,
          condition: null,
          hitAt: null,
          createdAt: new Date(),
          state: { name: 'implementation', order: 2 },
        },
      ]);

      const result: any = await handler(mockPrisma, {
        action: 'list',
        runId: 'run-uuid',
        includeInactive: true,
      });

      expect(result.breakpoints).toHaveLength(2);
      expect(result.summary.active).toBe(1);
      expect(result.summary.inactive).toBe(1);
    });
  });

  describe('Story Key Resolution', () => {
    it('should resolve story key to run', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-123',
        title: 'Test',
        status: 'planning',
        projectId: 'project-uuid',
      };
      const mockRunResolved = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        status: 'running',
        storyId: 'story-uuid',
      };
      const mockRun = createMockRun();

      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.workflowRun.findFirst as jest.Mock).mockResolvedValue(mockRunResolved);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([]);

      const result: any = await handler(mockPrisma, {
        action: 'list',
        story: 'ST-123',
      });

      expect(result.success).toBe(true);
      expect(result.story?.key).toBe('ST-123');
    });
  });
});
