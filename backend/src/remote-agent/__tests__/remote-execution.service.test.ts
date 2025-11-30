import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RemoteAgentGateway } from '../remote-agent.gateway';
import { RemoteExecutionService } from '../remote-execution.service';

describe('RemoteExecutionService', () => {
  let service: RemoteExecutionService;
  let prismaService: jest.Mocked<PrismaService>;
  let gateway: jest.Mocked<RemoteAgentGateway>;

  const mockPrismaService = {
    remoteJob: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    remoteAgent: {
      findMany: jest.fn(),
    },
  };

  const mockGateway = {
    getOnlineAgentsWithCapability: jest.fn(),
    emitJobToAgent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteExecutionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RemoteAgentGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<RemoteExecutionService>(RemoteExecutionService);
    prismaService = module.get(PrismaService) as any;
    gateway = module.get(RemoteAgentGateway) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute script when agent is online', async () => {
      const mockAgent = { id: 'agent-123', hostname: 'laptop-1' };
      const mockJob = {
        id: 'job-123',
        script: 'parse-transcript',
        params: ['--latest'],
        status: 'pending',
        agentId: 'agent-123',
      };

      const mockCompletedJob = {
        ...mockJob,
        status: 'completed',
        result: { output: 'test results' },
      };

      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([mockAgent]);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockCompletedJob as any);
      mockGateway.emitJobToAgent.mockResolvedValue(undefined);

      // Mock polling - return completed job
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockCompletedJob as any);

      const result = await service.execute('parse-transcript', ['--latest'], 'test-user');

      expect(mockGateway.getOnlineAgentsWithCapability).toHaveBeenCalledWith('parse-transcript');
      expect(mockPrismaService.remoteJob.create).toHaveBeenCalledWith({
        data: {
          script: 'parse-transcript',
          params: ['--latest'],
          status: 'pending',
          agentId: 'agent-123',
          requestedBy: 'test-user',
        },
      });
      expect(mockGateway.emitJobToAgent).toHaveBeenCalledWith('agent-123', {
        id: 'job-123',
        script: 'parse-transcript',
        params: ['--latest'],
      });
      expect(result).toEqual({ output: 'test results' });
    });

    it('should return fallback command when agent is offline', async () => {
      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([]);

      const result = await service.execute('parse-transcript', ['--latest'], 'test-user');

      expect(result).toEqual({
        agentOffline: true,
        fallbackCommand: 'ts-node scripts/parse-transcript.ts --latest',
        message: 'Remote agent offline. Run this command locally instead.',
      });
      expect(mockPrismaService.remoteJob.create).not.toHaveBeenCalled();
    });

    it('should reject unapproved script', async () => {
      await expect(
        service.execute('malicious-script', [], 'test-user')
      ).rejects.toThrow('not approved for remote execution');
    });

    it('should reject invalid params', async () => {
      await expect(
        service.execute('parse-transcript', ['--invalid-param'], 'test-user')
      ).rejects.toThrow('not allowed');
    });

    it('should use default requestedBy when not provided', async () => {
      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([]);

      await service.execute('parse-transcript', ['--latest']);

      // Check fallback was returned (no error thrown)
      expect(mockGateway.getOnlineAgentsWithCapability).toHaveBeenCalled();
    });

    it('should handle multiple params correctly', async () => {
      const mockAgent = { id: 'agent-123', hostname: 'laptop-1' };
      const mockJob = {
        id: 'job-123',
        script: 'parse-transcript',
        params: ['--latest', '--file=test.jsonl'],
        status: 'completed',
        result: {},
      };

      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([mockAgent]);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockJob as any);
      mockGateway.emitJobToAgent.mockResolvedValue(undefined);

      await service.execute('parse-transcript', ['--latest', '--file=test.jsonl']);

      expect(mockPrismaService.remoteJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          params: ['--latest', '--file=test.jsonl'],
        }),
      });
    });
  });

  describe('timeout handling', () => {
    it('should timeout if job takes too long', async () => {
      const mockAgent = { id: 'agent-123', hostname: 'laptop-1' };
      const mockPendingJob = {
        id: 'job-123',
        status: 'running',
      };

      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([mockAgent]);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockPendingJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockPendingJob as any);
      mockGateway.emitJobToAgent.mockResolvedValue(undefined);

      // Mock polling - keep returning running status
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockPendingJob as any);

      // This should timeout quickly due to script timeout
      await expect(
        service.execute('list-transcripts', ['--limit=10'])
      ).rejects.toThrow('timed out');

      // Verify timeout status was set
      expect(mockPrismaService.remoteJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'timeout',
            error: 'Execution timeout exceeded',
          }),
        })
      );
    }, 15000); // Allow test to run for 15s max

    it('should handle failed job status', async () => {
      const mockAgent = { id: 'agent-123', hostname: 'laptop-1' };
      const mockJob = {
        id: 'job-123',
        status: 'pending',
      };
      const mockFailedJob = {
        id: 'job-123',
        status: 'failed',
        error: 'Script execution failed',
      };

      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([mockAgent]);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockJob as any);
      mockGateway.emitJobToAgent.mockResolvedValue(undefined);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockFailedJob as any);

      await expect(
        service.execute('parse-transcript', ['--latest'])
      ).rejects.toThrow('Script execution failed');
    });

    it('should handle timeout status from agent', async () => {
      const mockAgent = { id: 'agent-123', hostname: 'laptop-1' };
      const mockJob = {
        id: 'job-123',
        status: 'pending',
      };
      const mockTimeoutJob = {
        id: 'job-123',
        status: 'timeout',
      };

      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([mockAgent]);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockJob as any);
      mockGateway.emitJobToAgent.mockResolvedValue(undefined);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockTimeoutJob as any);

      await expect(
        service.execute('parse-transcript', ['--latest'])
      ).rejects.toThrow('timed out on remote agent');
    });
  });

  describe('error handling', () => {
    it('should handle job creation failure', async () => {
      const mockAgent = { id: 'agent-123', hostname: 'laptop-1' };

      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([mockAgent]);
      mockPrismaService.remoteJob.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.execute('parse-transcript', ['--latest'])
      ).rejects.toThrow('Database error');
    });

    it('should handle emit failure and update job status', async () => {
      const mockAgent = { id: 'agent-123', hostname: 'laptop-1' };
      const mockJob = {
        id: 'job-123',
        status: 'pending',
      };

      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([mockAgent]);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockGateway.emitJobToAgent.mockRejectedValue(new Error('WebSocket error'));

      await expect(
        service.execute('parse-transcript', ['--latest'])
      ).rejects.toThrow('WebSocket error');

      expect(mockPrismaService.remoteJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'failed',
          error: 'WebSocket error',
        }),
      });
    });

    it('should handle missing job during polling', async () => {
      const mockAgent = { id: 'agent-123', hostname: 'laptop-1' };
      const mockJob = {
        id: 'job-123',
        status: 'pending',
      };

      mockGateway.getOnlineAgentsWithCapability.mockResolvedValue([mockAgent]);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockJob as any);
      mockGateway.emitJobToAgent.mockResolvedValue(undefined);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(null);

      await expect(
        service.execute('parse-transcript', ['--latest'])
      ).rejects.toThrow('Job not found');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'completed',
        result: { output: 'test' },
      };

      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockJob as any);

      const result = await service.getJobStatus('job-123');

      expect(result).toEqual(mockJob);
      expect(mockPrismaService.remoteJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-123' },
      });
    });

    it('should return null for non-existent job', async () => {
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(null);

      const result = await service.getJobStatus('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listJobs', () => {
    it('should return recent jobs with default limit', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'completed' },
        { id: 'job-2', status: 'running' },
      ];

      mockPrismaService.remoteJob.findMany.mockResolvedValue(mockJobs as any);

      const result = await service.listJobs();

      expect(result).toEqual(mockJobs);
      expect(mockPrismaService.remoteJob.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    it('should respect custom limit', async () => {
      mockPrismaService.remoteJob.findMany.mockResolvedValue([]);

      await service.listJobs(50);

      expect(mockPrismaService.remoteJob.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('getOnlineAgents', () => {
    it('should return list of online agents', async () => {
      const mockAgents = [
        { id: 'agent-1', status: 'online', hostname: 'laptop-1' },
        { id: 'agent-2', status: 'online', hostname: 'laptop-2' },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);

      const result = await service.getOnlineAgents();

      expect(result).toEqual(mockAgents);
      expect(mockPrismaService.remoteAgent.findMany).toHaveBeenCalledWith({
        where: { status: 'online' },
      });
    });

    it('should return empty array when no agents online', async () => {
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      const result = await service.getOnlineAgents();

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // ST-153: Git Execution Tests
  // ===========================================================================

  describe('executeGitCommand', () => {
    const mockGitAgent = {
      id: 'git-agent-123',
      hostname: 'laptop-1',
      status: 'online',
      capabilities: ['git-execute'],
    };

    beforeEach(() => {
      // Add emitGitJob mock
      (mockGateway as any).emitGitJob = jest.fn().mockResolvedValue(undefined);
    });

    it('should execute git command when agent is online', async () => {
      const mockJob = {
        id: 'git-job-123',
        script: 'git-status',
        params: { command: 'git status --porcelain', cwd: '/path/to/worktree' },
        status: 'pending',
        agentId: 'git-agent-123',
      };

      const mockCompletedJob = {
        ...mockJob,
        status: 'completed',
        result: { output: '## main...origin/main', operation: 'status' },
      };

      mockPrismaService.remoteAgent.findMany.mockResolvedValue([mockGitAgent] as any);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockCompletedJob as any);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockCompletedJob as any);

      const result = await service.executeGitCommand(
        {
          command: 'git status --porcelain',
          cwd: '/path/to/worktree',
        },
        'test-user'
      );

      expect(result).toEqual({
        success: true,
        jobId: 'git-job-123',
        agentId: 'git-agent-123',
        output: '## main...origin/main',
        operation: 'status',
      });

      expect(mockPrismaService.remoteAgent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'online',
          capabilities: { has: 'git-execute' },
        },
      });
    });

    it('should return offline error when no git agent available', async () => {
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      const result = await service.executeGitCommand({
        command: 'git status',
        cwd: '/path/to/worktree',
      });

      expect(result).toEqual({
        agentOffline: true,
        error: 'Laptop agent is offline. Cannot execute git command on remote worktree.',
      });
    });

    it('should reject unapproved git command', async () => {
      await expect(
        service.executeGitCommand({
          command: 'git rm -rf .',
          cwd: '/path/to/worktree',
        })
      ).rejects.toThrow('not approved');
    });

    it('should reject forbidden git command', async () => {
      await expect(
        service.executeGitCommand({
          command: 'git push --force',
          cwd: '/path/to/worktree',
        })
      ).rejects.toThrow('Forbidden');
    });

    it('should reject git reset --hard', async () => {
      await expect(
        service.executeGitCommand({
          command: 'git reset --hard HEAD~1',
          cwd: '/path/to/worktree',
        })
      ).rejects.toThrow('Forbidden');
    });

    it('should handle failed git job', async () => {
      const mockJob = {
        id: 'git-job-456',
        script: 'git-status',
        status: 'pending',
        agentId: 'git-agent-123',
      };

      const mockFailedJob = {
        ...mockJob,
        status: 'failed',
        error: 'fatal: not a git repository',
        result: { exitCode: 128 },
      };

      mockPrismaService.remoteAgent.findMany.mockResolvedValue([mockGitAgent] as any);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockFailedJob as any);

      const result = await service.executeGitCommand({
        command: 'git status',
        cwd: '/invalid/path',
      });

      expect(result).toEqual({
        success: false,
        jobId: 'git-job-456',
        agentId: 'git-agent-123',
        error: 'fatal: not a git repository',
        output: undefined,
        exitCode: 128,
      });
    });

    it('should use correct timeout based on operation', async () => {
      const mockJob = {
        id: 'git-job-789',
        script: 'git-fetch',
        status: 'completed',
        result: { output: '' },
        agentId: 'git-agent-123',
      };

      mockPrismaService.remoteAgent.findMany.mockResolvedValue([mockGitAgent] as any);
      mockPrismaService.remoteJob.create.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.update.mockResolvedValue(mockJob as any);
      mockPrismaService.remoteJob.findUnique.mockResolvedValue(mockJob as any);

      await service.executeGitCommand({
        command: 'git fetch origin',
        cwd: '/path/to/worktree',
      });

      // Verify emitGitJob was called with correct timeout (fetch = 120000ms)
      expect((mockGateway as any).emitGitJob).toHaveBeenCalledWith(
        'git-agent-123',
        expect.objectContaining({
          timeout: 120000, // fetch timeout
        })
      );
    });
  });

  describe('getGitExecuteAgents', () => {
    it('should return git-capable agents', async () => {
      const mockAgents = [
        { id: 'agent-1', hostname: 'laptop-1', capabilities: ['git-execute'] },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);

      const result = await service.getGitExecuteAgents();

      expect(result).toEqual(mockAgents);
      expect(mockPrismaService.remoteAgent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'online',
          capabilities: { has: 'git-execute' },
        },
      });
    });
  });
});
