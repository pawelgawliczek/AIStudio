import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { RemoteAgentGateway } from '../remote-agent.gateway';
import { StreamEventService } from '../stream-event.service';

describe('RemoteAgentGateway', () => {
  let gateway: RemoteAgentGateway;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  const VALID_SECRET = 'test-secret-123';
  const INVALID_SECRET = 'wrong-secret';

  const mockPrismaService = {
    remoteAgent: {
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    remoteJob: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockStreamEventService = {
    storeEvent: jest.fn(),
    getEventsForComponentRun: jest.fn(),
    getLatestEvent: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const createMockSocket = (customData: Partial<Socket['data']> = {}): Partial<Socket> => ({
    id: 'socket-123',
    data: {
      ...customData,
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
  });

  beforeEach(async () => {
    // Set env variable for tests
    process.env.AGENT_SECRET = VALID_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret';

    mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    };

    mockSocket = createMockSocket();

    const module: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile();

    gateway = module.get<RemoteAgentGateway>(RemoteAgentGateway);
    prismaService = module.get(PrismaService) as any;
    jwtService = module.get(JwtService) as any;

    gateway.server = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.AGENT_SECRET;
    delete process.env.JWT_SECRET;
  });

  describe('handleConnection', () => {
    it('should log agent connection', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleConnection(mockSocket as Socket);

      expect(logSpy).toHaveBeenCalledWith('Agent connecting: socket-123');
    });

    it('should not authenticate immediately on connection', () => {
      gateway.handleConnection(mockSocket as Socket);

      expect(mockPrismaService.remoteAgent.upsert).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should mark agent as offline on disconnect', async () => {
      await gateway.handleDisconnect(mockSocket as Socket);

      expect(mockPrismaService.remoteAgent.updateMany).toHaveBeenCalledWith({
        where: { socketId: 'socket-123' },
        data: {
          status: 'offline',
          socketId: null,
          lastSeenAt: expect.any(Date),
          currentExecutionId: null, // ST-150: Clear execution reference on disconnect
        },
      });
    });

    it('should handle disconnect errors gracefully', async () => {
      mockPrismaService.remoteAgent.updateMany.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        gateway.handleDisconnect(mockSocket as Socket)
      ).resolves.not.toThrow();
    });
  });

  describe('handleAgentRegister', () => {
    const validRegistrationData = {
      secret: VALID_SECRET,
      hostname: 'laptop-1',
      capabilities: ['parse-transcript', 'analyze-story-transcripts'],
    };

    it('should register agent with valid secret', async () => {
      const mockAgent = {
        id: 'agent-uuid-123',
        hostname: 'laptop-1',
        status: 'online',
      };

      const mockToken = 'jwt-token-abc123';

      mockJwtService.signAsync.mockResolvedValue(mockToken);
      mockPrismaService.remoteAgent.upsert.mockResolvedValue(mockAgent as any);

      await gateway.handleAgentRegister(mockSocket as Socket, validRegistrationData);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { hostname: 'laptop-1', type: 'remote-agent' },
        {
          secret: 'test-jwt-secret',
          expiresIn: '30d',
        }
      );

      expect(mockPrismaService.remoteAgent.upsert).toHaveBeenCalledWith({
        where: { hostname: 'laptop-1' },
        create: {
          hostname: 'laptop-1',
          socketId: 'socket-123',
          status: 'online',
          capabilities: ['parse-transcript', 'analyze-story-transcripts'],
          lastSeenAt: expect.any(Date),
          // ST-150: Claude Code fields (defaults)
          claudeCodeAvailable: false,
          claudeCodeVersion: null,
        },
        update: {
          socketId: 'socket-123',
          status: 'online',
          capabilities: ['parse-transcript', 'analyze-story-transcripts'],
          lastSeenAt: expect.any(Date),
          // ST-150: Claude Code fields (defaults)
          claudeCodeAvailable: false,
          claudeCodeVersion: null,
          currentExecutionId: null, // ST-150: Clear execution on reconnect
        },
      });

      expect(mockSocket.data.agentId).toBe('agent-uuid-123');
      expect(mockSocket.data.hostname).toBe('laptop-1');

      expect(mockSocket.emit).toHaveBeenCalledWith('agent:registered', {
        success: true,
        token: mockToken,
        agentId: 'agent-uuid-123',
      });
    });

    it('should reject agent with invalid secret', async () => {
      const invalidData = {
        ...validRegistrationData,
        secret: INVALID_SECRET,
      };

      await gateway.handleAgentRegister(mockSocket as Socket, invalidData);

      expect(mockSocket.emit).toHaveBeenCalledWith('agent:error', {
        error: 'Invalid secret',
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(mockPrismaService.remoteAgent.upsert).not.toHaveBeenCalled();
    });

    it('should handle registration failure gracefully', async () => {
      mockJwtService.signAsync.mockResolvedValue('token');
      mockPrismaService.remoteAgent.upsert.mockRejectedValue(
        new Error('Database error')
      );

      await gateway.handleAgentRegister(mockSocket as Socket, validRegistrationData);

      expect(mockSocket.emit).toHaveBeenCalledWith('agent:error', {
        error: 'Registration failed',
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should update existing agent on re-registration', async () => {
      const mockExistingAgent = {
        id: 'existing-agent-id',
        hostname: 'laptop-1',
        status: 'online',
      };

      mockJwtService.signAsync.mockResolvedValue('new-token');
      mockPrismaService.remoteAgent.upsert.mockResolvedValue(mockExistingAgent as any);

      await gateway.handleAgentRegister(mockSocket as Socket, validRegistrationData);

      expect(mockPrismaService.remoteAgent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hostname: 'laptop-1' },
          update: expect.objectContaining({
            socketId: 'socket-123',
            status: 'online',
          }),
        })
      );
    });
  });

  describe('handleAgentHeartbeat', () => {
    it('should update lastSeenAt on heartbeat', async () => {
      const authenticatedSocket = createMockSocket({ agentId: 'agent-123' });

      await gateway.handleAgentHeartbeat(authenticatedSocket as Socket);

      expect(mockPrismaService.remoteAgent.update).toHaveBeenCalledWith({
        where: { id: 'agent-123' },
        data: { lastSeenAt: expect.any(Date) },
      });
    });

    it('should reject heartbeat from unregistered agent', async () => {
      const unauthenticatedSocket = createMockSocket({ agentId: undefined });

      await gateway.handleAgentHeartbeat(unauthenticatedSocket as Socket);

      expect(unauthenticatedSocket.emit).toHaveBeenCalledWith('agent:error', {
        error: 'Not registered',
      });
      expect(mockPrismaService.remoteAgent.update).not.toHaveBeenCalled();
    });

    it('should handle heartbeat update errors', async () => {
      const authenticatedSocket = createMockSocket({ agentId: 'agent-123' });
      mockPrismaService.remoteAgent.update.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        gateway.handleAgentHeartbeat(authenticatedSocket as Socket)
      ).resolves.not.toThrow();
    });
  });

  describe('handleAgentResult', () => {
    const resultData = {
      jobId: 'job-uuid-123',
      status: 'completed' as const,
      result: { output: 'test output' },
    };

    it('should process completed job result', async () => {
      const authenticatedSocket = createMockSocket({ agentId: 'agent-123' });

      await gateway.handleAgentResult(authenticatedSocket as Socket, resultData);

      expect(mockPrismaService.remoteJob.update).toHaveBeenCalledWith({
        where: { id: 'job-uuid-123' },
        data: {
          status: 'completed',
          result: { output: 'test output' },
          error: null,
          completedAt: expect.any(Date),
          agentId: 'agent-123',
        },
      });

      expect(authenticatedSocket.emit).toHaveBeenCalledWith('agent:ack', {
        jobId: 'job-uuid-123',
        received: true,
      });
    });

    it('should process failed job result', async () => {
      const authenticatedSocket = createMockSocket({ agentId: 'agent-123' });
      const failedData = {
        jobId: 'job-uuid-456',
        status: 'failed' as const,
        error: 'Script execution failed',
      };

      await gateway.handleAgentResult(authenticatedSocket as Socket, failedData);

      expect(mockPrismaService.remoteJob.update).toHaveBeenCalledWith({
        where: { id: 'job-uuid-456' },
        data: {
          status: 'failed',
          result: null,
          error: 'Script execution failed',
          completedAt: expect.any(Date),
          agentId: 'agent-123',
        },
      });
    });

    it('should process timeout job result', async () => {
      const authenticatedSocket = createMockSocket({ agentId: 'agent-123' });
      const timeoutData = {
        jobId: 'job-uuid-789',
        status: 'timeout' as const,
        error: 'Script timed out',
      };

      await gateway.handleAgentResult(authenticatedSocket as Socket, timeoutData);

      expect(mockPrismaService.remoteJob.update).toHaveBeenCalledWith({
        where: { id: 'job-uuid-789' },
        data: expect.objectContaining({
          status: 'timeout',
          error: 'Script timed out',
        }),
      });
    });

    it('should reject result from unregistered agent', async () => {
      const unauthenticatedSocket = createMockSocket({ agentId: undefined });

      await gateway.handleAgentResult(unauthenticatedSocket as Socket, resultData);

      expect(unauthenticatedSocket.emit).toHaveBeenCalledWith('agent:error', {
        error: 'Not registered',
      });
      expect(mockPrismaService.remoteJob.update).not.toHaveBeenCalled();
    });

    it('should handle job update errors', async () => {
      const authenticatedSocket = createMockSocket({ agentId: 'agent-123' });
      mockPrismaService.remoteJob.update.mockRejectedValue(
        new Error('Database error')
      );

      await gateway.handleAgentResult(authenticatedSocket as Socket, resultData);

      expect(authenticatedSocket.emit).toHaveBeenCalledWith('agent:error', {
        error: 'Failed to update job',
      });
    });
  });

  describe('emitJobToAgent', () => {
    it('should emit job to online agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        status: 'online',
        socketId: 'socket-456',
      };

      const mockJob = {
        id: 'job-123',
        script: 'parse-transcript',
        params: ['--latest'],
      };

      mockPrismaService.remoteAgent.findUnique.mockResolvedValue(mockAgent as any);

      await gateway.emitJobToAgent('agent-123', mockJob);

      expect(mockPrismaService.remoteAgent.findUnique).toHaveBeenCalledWith({
        where: { id: 'agent-123' },
      });

      expect(mockServer.to).toHaveBeenCalledWith('socket-456');
    });

    it('should throw error when agent is offline', async () => {
      const mockOfflineAgent = {
        id: 'agent-123',
        status: 'offline',
        socketId: null,
      };

      mockPrismaService.remoteAgent.findUnique.mockResolvedValue(mockOfflineAgent as any);

      await expect(
        gateway.emitJobToAgent('agent-123', { id: 'job-123' })
      ).rejects.toThrow('Agent not online');
    });

    it('should throw error when agent not found', async () => {
      mockPrismaService.remoteAgent.findUnique.mockResolvedValue(null);

      await expect(
        gateway.emitJobToAgent('non-existent', { id: 'job-123' })
      ).rejects.toThrow('Agent not online');
    });
  });

  describe('getOnlineAgentsWithCapability', () => {
    it('should return agents with specific capability', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: ['parse-transcript', 'analyze-story-transcripts'],
        },
        {
          id: 'agent-2',
          hostname: 'laptop-2',
          status: 'online',
          capabilities: ['parse-transcript'],
        },
      ];

      mockPrismaService.remoteAgent.findMany.mockResolvedValue(mockAgents as any);

      const result = await gateway.getOnlineAgentsWithCapability('parse-transcript');

      expect(result).toEqual(mockAgents);
      expect(mockPrismaService.remoteAgent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'online',
          capabilities: {
            has: 'parse-transcript',
          },
        },
      });
    });

    it('should return empty array when no agents have capability', async () => {
      mockPrismaService.remoteAgent.findMany.mockResolvedValue([]);

      const result = await gateway.getOnlineAgentsWithCapability('rare-capability');

      expect(result).toEqual([]);
    });
  });

  describe('Security tests', () => {
    it('should use environment variable for secret validation', async () => {
      const customSecret = 'custom-production-secret';
      process.env.AGENT_SECRET = customSecret;

      const data = {
        secret: customSecret,
        hostname: 'laptop-1',
        capabilities: ['parse-transcript'],
      };

      mockJwtService.signAsync.mockResolvedValue('token');
      mockPrismaService.remoteAgent.upsert.mockResolvedValue({
        id: 'agent-id',
        hostname: 'laptop-1',
      } as any);

      await gateway.handleAgentRegister(mockSocket as Socket, data);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'agent:registered',
        expect.objectContaining({ success: true })
      );
    });

    it('should issue JWT with 30-day expiration', async () => {
      const data = {
        secret: VALID_SECRET,
        hostname: 'laptop-1',
        capabilities: ['parse-transcript'],
      };

      mockJwtService.signAsync.mockResolvedValue('token');
      mockPrismaService.remoteAgent.upsert.mockResolvedValue({
        id: 'agent-id',
        hostname: 'laptop-1',
      } as any);

      await gateway.handleAgentRegister(mockSocket as Socket, data);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          expiresIn: '30d',
        })
      );
    });
  });
});
