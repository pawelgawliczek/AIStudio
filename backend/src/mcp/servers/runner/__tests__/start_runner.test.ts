/**
 * Tests for start_runner MCP tool
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { handler } from '../start_runner';

// Mock child_process
jest.mock('child_process');

describe('start_runner MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockProcess: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      workflow: {
        findUnique: jest.fn(),
      },
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    // Create mock child process
    mockProcess = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    });

    (spawn as jest.Mock).mockReturnValue(mockProcess);

    // Set default environment
    process.env.PROJECT_PATH = '/test/project';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('should throw error if workflow not found', async () => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, {
          runId: 'run-123',
          workflowId: 'workflow-456',
        })
      ).rejects.toThrow('Workflow not found');
    });

    it('should throw error if workflow has no states', async () => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [],
      });

      await expect(
        handler(mockPrisma, {
          runId: 'run-123',
          workflowId: 'workflow-456',
        })
      ).rejects.toThrow('Workflow has no states defined');
    });

    it('should throw error if run not found', async () => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [{ id: 'state-1' }],
      });

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, {
          runId: 'run-123',
          workflowId: 'workflow-456',
        })
      ).rejects.toThrow('WorkflowRun not found');
    });
  });

  describe('Docker Command Building', () => {
    beforeEach(() => {
      // Setup valid workflow and run
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [{ id: 'state-1' }],
      });

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-123',
      });

      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});
    });

    it('should spawn docker with correct arguments in detached mode', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        detached: true,
      });

      // Immediately resolve to simulate detached mode
      const result: any = await promise;

      expect(spawn).toHaveBeenCalledWith(
        'docker',
        [
          'compose',
          '-f',
          'runner/docker-compose.runner.yml',
          'run',
          '--rm',
          '-d',
          'runner',
          'start',
          '--run-id',
          'run-123',
          '--workflow-id',
          'workflow-456',
          '--triggered-by',
          'mcp-tool',
        ],
        {
          cwd: '/test/project',
          stdio: 'pipe',
          detached: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('started');
    });

    it('should include story ID when provided', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        storyId: 'story-789',
        detached: true,
      });

      await promise;

      const spawnCall = (spawn as jest.Mock).mock.calls[0];
      const args = spawnCall[1];

      expect(args).toContain('--story-id');
      expect(args).toContain('story-789');
    });

    it('should include custom triggeredBy when provided', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        triggeredBy: 'claude-agent',
        detached: true,
      });

      await promise;

      const spawnCall = (spawn as jest.Mock).mock.calls[0];
      const args = spawnCall[1];

      expect(args).toContain('--triggered-by');
      expect(args).toContain('claude-agent');
    });

    it('should not include -d flag in attached mode', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        detached: false,
      });

      // Simulate successful completion
      setTimeout(() => {
        mockProcess.emit('exit', 0);
      }, 10);

      await promise;

      const spawnCall = (spawn as jest.Mock).mock.calls[0];
      const args = spawnCall[1];

      expect(args).not.toContain('-d');
    });
  });

  describe('Run Status Update', () => {
    beforeEach(() => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [{ id: 'state-1' }],
      });

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-123',
      });

      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});
    });

    it('should update run status to running', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        detached: true,
      });

      await promise;

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          status: 'running',
          startedAt: expect.any(Date),
        },
      });
    });
  });

  describe('Detached Mode', () => {
    beforeEach(() => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [{ id: 'state-1' }],
      });

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-123',
      });

      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});
    });

    it('should return immediately in detached mode', async () => {
      const result: any = await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        detached: true,
      });

      expect(result.success).toBe(true);
      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('started');
      expect(result.message).toContain('Story Runner started');
    });

    it('should include command in response', async () => {
      const result: any = await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        storyId: 'story-789',
        detached: true,
      });

      expect(result.command).toContain('docker');
      expect(result.command).toContain('--run-id run-123');
      expect(result.command).toContain('--story-id story-789');
    });
  });

  describe('Attached Mode', () => {
    beforeEach(() => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [{ id: 'state-1' }],
      });

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-123',
      });

      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});
    });

    it('should wait for completion in attached mode', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        detached: false,
      });

      // Simulate process output and completion
      setTimeout(() => {
        mockProcess.stdout!.emit('data', 'Runner output\n');
        mockProcess.emit('exit', 0);
      }, 10);

      const result: any = await promise;

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.stdout).toContain('Runner output');
    });

    it('should reject on non-zero exit code', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        detached: false,
      });

      // Simulate failure
      setTimeout(() => {
        mockProcess.stderr!.emit('data', 'Error occurred\n');
        mockProcess.emit('exit', 1);
      }, 10);

      await expect(promise).rejects.toThrow('Story Runner failed with code 1');
    });

    it('should reject on process error', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        detached: false,
      });

      // Simulate error
      setTimeout(() => {
        mockProcess.emit('error', new Error('Spawn error'));
      }, 10);

      await expect(promise).rejects.toThrow('Failed to start Story Runner');
    });

    it('should collect stdout and stderr', async () => {
      const promise = handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        detached: false,
      });

      setTimeout(() => {
        mockProcess.stdout!.emit('data', 'Line 1\n');
        mockProcess.stdout!.emit('data', 'Line 2\n');
        mockProcess.stderr!.emit('data', 'Warning\n');
        mockProcess.emit('exit', 0);
      }, 10);

      const result: any = await promise;

      expect(result.stdout).toContain('Line 1');
      expect(result.stdout).toContain('Line 2');
    });
  });

  describe('Default Parameters', () => {
    beforeEach(() => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [{ id: 'state-1' }],
      });

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-123',
      });

      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});
    });

    it('should default to detached mode', async () => {
      await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
      });

      const spawnCall = (spawn as jest.Mock).mock.calls[0];
      const args = spawnCall[1];

      expect(args).toContain('-d');
    });

    it('should default triggeredBy to mcp-tool', async () => {
      await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
      });

      const spawnCall = (spawn as jest.Mock).mock.calls[0];
      const args = spawnCall[1];

      expect(args).toContain('--triggered-by');
      expect(args).toContain('mcp-tool');
    });
  });
});
