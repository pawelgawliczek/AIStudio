/**
 * Tests for start_runner MCP tool
 * ST-195: Updated to test HTTP-based runner start via backend REST endpoint
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../start_runner';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('start_runner MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

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
      story: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    } as any;

    // Set default environment
    process.env.BACKEND_URL = 'http://localhost:3000';

    // Reset fetch mock
    mockFetch.mockReset();
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

  describe('HTTP API Calls', () => {
    beforeEach(() => {
      // Setup valid workflow and run
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [{ id: 'state-1' }],
      });

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-123',
      });
    });

    it('should call backend API with correct parameters', async () => {
      // Mock story resolution for ST-789
      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue({
        id: 'story-uuid-789',
        key: 'ST-789',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          runId: 'run-123',
          status: 'started',
          message: 'Runner started successfully',
          jobId: 'job-abc',
          agentId: 'agent-xyz',
        }),
      });

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
        storyId: 'ST-789', // Use valid story key format
        triggeredBy: 'test-user',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/runner/run-123/start',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: 'workflow-456',
            storyId: 'story-uuid-789', // Resolved from ST-789
            triggeredBy: 'test-user',
          }),
        })
      );

      expect(result.success).toBe(true);
      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('started');
      expect(result.jobId).toBe('job-abc');
      expect(result.agentId).toBe('agent-xyz');
    });

    it('should use default triggeredBy when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          runId: 'run-123',
          status: 'started',
        }),
      });

      await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"triggeredBy":"mcp-tool"'),
        })
      );
    });

    it('should throw error on backend API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(
        handler(mockPrisma, {
          runId: 'run-123',
          workflowId: 'workflow-456',
        })
      ).rejects.toThrow('Backend API error (500)');
    });

    it('should handle connection refused error', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));

      await expect(
        handler(mockPrisma, {
          runId: 'run-123',
          workflowId: 'workflow-456',
        })
      ).rejects.toThrow(/Cannot connect to backend/);
    });

    it('should return response from backend API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          runId: 'run-123',
          status: 'queued',
          message: 'Runner queued for execution',
          jobId: 'job-123',
        }),
      });

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
      });

      expect(result).toEqual({
        success: true,
        runId: 'run-123',
        workflowId: 'workflow-456',
        storyId: undefined,
        status: 'queued',
        message: 'Runner queued for execution',
        jobId: 'job-123',
        agentId: undefined,
      });
    });
  });

  describe('Environment Configuration', () => {
    beforeEach(() => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
        id: 'workflow-456',
        states: [{ id: 'state-1' }],
      });

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-123',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, runId: 'run-123', status: 'started' }),
      });
    });

    it('should use BACKEND_URL environment variable', async () => {
      process.env.BACKEND_URL = 'https://custom-backend.example.com';

      await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-backend.example.com/api/runner/run-123/start',
        expect.any(Object)
      );
    });

    it('should default to localhost:3000 when BACKEND_URL not set', async () => {
      delete process.env.BACKEND_URL;

      await handler(mockPrisma, {
        runId: 'run-123',
        workflowId: 'workflow-456',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/runner/run-123/start',
        expect.any(Object)
      );
    });
  });
});
