/**
 * ST-150: spawn_agent MCP Tool Tests
 */

import { handler } from '../spawn_agent';

describe('spawn_agent', () => {
  const mockPrisma = {
    remoteAgent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    remoteJob: {
      create: jest.fn(),
    },
    workflowState: {
      findUnique: jest.fn(),
    },
    componentRun: {
      update: jest.fn(),
    },
    workflowRun: {
      update: jest.fn(),
    },
  };

  const validParams = {
    componentId: 'comp-123',
    stateId: 'state-456',
    workflowRunId: 'run-789',
    componentRunId: 'comprun-101',
    instructions: 'Implement the feature as described',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handler', () => {
    it('should spawn agent successfully when online agent available', async () => {
      const mockAgent = {
        id: 'agent-1',
        hostname: 'laptop-1',
        status: 'online',
        capabilities: ['claude-code'],
        claudeCodeAvailable: true,
        claudeCodeVersion: '1.0.0',
        currentExecutionId: null,
      };

      const mockJob = {
        id: 'job-123',
        status: 'pending',
      };

      mockPrisma.remoteAgent.findMany.mockResolvedValue([mockAgent]);
      mockPrisma.remoteJob.create.mockResolvedValue(mockJob);
      mockPrisma.remoteAgent.update.mockResolvedValue(mockAgent);
      mockPrisma.componentRun.update.mockResolvedValue({});
      mockPrisma.workflowRun.update.mockResolvedValue({});

      const result = await handler(mockPrisma as any, validParams);

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.agentId).toBe('agent-1');
      expect(result.agentHostname).toBe('laptop-1');
      expect(result.status).toBe('pending');

      // Verify job was created
      expect(mockPrisma.remoteJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          script: 'claude-code',
          status: 'pending',
          agentId: 'agent-1',
          jobType: 'claude-agent',
          componentRunId: 'comprun-101',
          workflowRunId: 'run-789',
        }),
      });

      // Verify agent was updated with current execution
      expect(mockPrisma.remoteAgent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { currentExecutionId: 'job-123' },
      });
    });

    it('should return offline fallback when no agent available', async () => {
      mockPrisma.remoteAgent.findMany.mockResolvedValue([]);
      mockPrisma.workflowState.findUnique.mockResolvedValue({
        id: 'state-456',
        offlineFallback: 'pause',
      });

      const result = await handler(mockPrisma as any, validParams);

      expect(result.success).toBe(false);
      expect(result.agentOffline).toBe(true);
      expect(result.offlineFallback).toBe('pause');
    });

    it('should reject instructions containing secrets', async () => {
      const paramsWithSecret = {
        ...validParams,
        instructions: 'Use API_KEY="sk-12345" to authenticate',
      };

      const result = await handler(mockPrisma as any, paramsWithSecret);

      expect(result.success).toBe(false);
      expect(result.error).toContain('secret');
    });

    it('should reject invalid allowed tools', async () => {
      const paramsWithBadTools = {
        ...validParams,
        allowedTools: ['Bash', 'rm -rf /'], // rm -rf is not a valid tool name
      };

      const mockAgent = {
        id: 'agent-1',
        hostname: 'laptop-1',
        status: 'online',
        capabilities: ['claude-code'],
        claudeCodeAvailable: true,
        currentExecutionId: null,
      };

      mockPrisma.remoteAgent.findMany.mockResolvedValue([mockAgent]);

      const result = await handler(mockPrisma as any, paramsWithBadTools);

      // Should fail validation due to invalid tool pattern
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should select least loaded agent', async () => {
      const busyAgent = {
        id: 'agent-1',
        hostname: 'laptop-1',
        status: 'online',
        capabilities: ['claude-code'],
        claudeCodeAvailable: true,
        currentExecutionId: 'existing-job', // Already executing
      };

      const idleAgent = {
        id: 'agent-2',
        hostname: 'laptop-2',
        status: 'online',
        capabilities: ['claude-code'],
        claudeCodeAvailable: true,
        currentExecutionId: null, // Idle
      };

      const mockJob = { id: 'job-new', status: 'pending' };

      mockPrisma.remoteAgent.findMany.mockResolvedValue([busyAgent, idleAgent]);
      mockPrisma.remoteJob.create.mockResolvedValue(mockJob);
      mockPrisma.remoteAgent.update.mockResolvedValue({});
      mockPrisma.componentRun.update.mockResolvedValue({});
      mockPrisma.workflowRun.update.mockResolvedValue({});

      const result = await handler(mockPrisma as any, validParams);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('agent-2'); // Should select idle agent
      expect(result.agentHostname).toBe('laptop-2');
    });

    it('should include optional parameters in job', async () => {
      const paramsWithOptions = {
        ...validParams,
        storyContext: { storyId: 'ST-150', title: 'Test Story' },
        allowedTools: ['Read', 'Write', 'Bash'],
        model: 'claude-opus-4-20250514',
        maxTurns: 100,
        projectPath: '/home/user/project',
      };

      const mockAgent = {
        id: 'agent-1',
        hostname: 'laptop-1',
        status: 'online',
        capabilities: ['claude-code'],
        claudeCodeAvailable: true,
        currentExecutionId: null,
      };

      const mockJob = { id: 'job-123', status: 'pending' };

      mockPrisma.remoteAgent.findMany.mockResolvedValue([mockAgent]);
      mockPrisma.remoteJob.create.mockResolvedValue(mockJob);
      mockPrisma.remoteAgent.update.mockResolvedValue({});
      mockPrisma.componentRun.update.mockResolvedValue({});
      mockPrisma.workflowRun.update.mockResolvedValue({});

      const result = await handler(mockPrisma as any, paramsWithOptions);

      expect(result.success).toBe(true);

      // Verify job params include all options
      expect(mockPrisma.remoteJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          params: expect.objectContaining({
            storyContext: { storyId: 'ST-150', title: 'Test Story' },
            allowedTools: ['Read', 'Write', 'Bash'],
            model: 'claude-opus-4-20250514',
            maxTurns: 100,
            projectPath: '/home/user/project',
          }),
        }),
      });
    });

    it('should update ComponentRun with execution info', async () => {
      const mockAgent = {
        id: 'agent-1',
        hostname: 'my-laptop',
        status: 'online',
        capabilities: ['claude-code'],
        claudeCodeAvailable: true,
        currentExecutionId: null,
      };

      const mockJob = { id: 'job-xyz', status: 'pending' };

      mockPrisma.remoteAgent.findMany.mockResolvedValue([mockAgent]);
      mockPrisma.remoteJob.create.mockResolvedValue(mockJob);
      mockPrisma.remoteAgent.update.mockResolvedValue({});
      mockPrisma.componentRun.update.mockResolvedValue({});
      mockPrisma.workflowRun.update.mockResolvedValue({});

      await handler(mockPrisma as any, validParams);

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith({
        where: { id: 'comprun-101' },
        data: {
          executedOn: 'laptop:my-laptop',
          remoteJobId: 'job-xyz',
        },
      });
    });
  });
});
