/**
 * ST-363: Artifact Move Integration Tests
 *
 * Tests the complete artifact move flow:
 * 1. update_story detects epicId change
 * 2. Calls internal API endpoint
 * 3. Gateway emits move request to laptop agent
 * 4. Agent processes move
 * 5. Agent emits completion/failure
 * 6. Frontend receives broadcast
 *
 * Test Categories:
 * - Integration: Full flow end-to-end
 * - WebSocket: Event emission and handling
 * - API: Internal endpoint authentication and validation
 * - Error Handling: No agent available, move failures
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket as ServerSocket } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { RemoteAgentGateway } from '../remote-agent.gateway';
import { RemoteAgentController } from '../remote-agent.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryService } from '../../telemetry/telemetry.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { ArtifactHandler } from '../handlers/artifact.handler';
import { ClaudeCodeHandler } from '../handlers/claude-code.handler';
import { GitJobHandler } from '../handlers/git-job.handler';
import { TranscriptHandler } from '../handlers/transcript.handler';
import { StreamEventService } from '../stream-event.service';
import { TranscriptRegistrationService } from '../transcript-registration.service';

describe('Artifact Move Integration (ST-363)', () => {
  let app: INestApplication;
  let gateway: RemoteAgentGateway;
  let controller: RemoteAgentController;
  let prisma: PrismaService;
  let laptopClient: ClientSocket;
  let frontendClient: ClientSocket;

  const mockAgent = {
    id: 'test-agent-123',
    hostname: 'test-laptop',
    capabilities: ['artifact-move'],
    status: 'online',
    socketId: null as string | null,
    lastHeartbeat: new Date(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteAgentGateway,
        RemoteAgentController,
        {
          provide: PrismaService,
          useValue: {
            remoteAgent: {
              findUnique: jest.fn(),
              findMany: jest.fn().mockResolvedValue([mockAgent]),
              update: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({ agentId: mockAgent.id }),
          },
        },
        {
          provide: TelemetryService,
          useValue: {
            withSpan: jest.fn((name, fn) => fn({ setAttribute: jest.fn(), recordException: jest.fn() })),
          },
        },
        {
          provide: AppWebSocketGateway,
          useValue: {
            server: {
              emit: jest.fn(),
            },
          },
        },
        {
          provide: ArtifactHandler,
          useValue: {},
        },
        {
          provide: ClaudeCodeHandler,
          useValue: {},
        },
        {
          provide: GitJobHandler,
          useValue: {},
        },
        {
          provide: TranscriptHandler,
          useValue: {},
        },
        {
          provide: StreamEventService,
          useValue: {},
        },
        {
          provide: TranscriptRegistrationService,
          useValue: {},
        },
      ],
    }).compile();

    gateway = moduleRef.get<RemoteAgentGateway>(RemoteAgentGateway);
    controller = moduleRef.get<RemoteAgentController>(RemoteAgentController);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // Initialize gateway
    gateway.afterInit();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset mock agent
    mockAgent.socketId = null;
  });

  afterAll(async () => {
    if (laptopClient) {
      laptopClient.disconnect();
    }
    if (frontendClient) {
      frontendClient.disconnect();
    }
  });

  describe('Gateway - emitArtifactMoveRequest', () => {
    it('should emit move request to agent with artifact-move capability', async () => {
      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;
      mockAgent.socketId = 'mock-socket-id';

      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-123',
        epicKey: 'EP-1',
        oldPath: 'docs/ST-123',
        newPath: 'docs/EP-1/ST-123',
      });

      expect(mockServerSocket.to).toHaveBeenCalledWith('mock-socket-id');
      expect(mockServerSocket.emit).toHaveBeenCalledWith(
        'artifact:move-request',
        expect.objectContaining({
          requestId: expect.stringContaining('move-'),
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-123',
          newPath: 'docs/EP-1/ST-123',
          timestamp: expect.any(Number),
        })
      );
    });

    it('should handle case when no agents with artifact-move capability are online', async () => {
      (prisma.remoteAgent.findMany as jest.Mock).mockResolvedValueOnce([]);

      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;

      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-456',
        epicKey: 'EP-2',
        oldPath: 'docs/ST-456',
        newPath: 'docs/EP-2/ST-456',
      });

      // Should not emit (no agents available)
      expect(mockServerSocket.emit).not.toHaveBeenCalled();
    });

    it('should handle case when agent has no socketId', async () => {
      mockAgent.socketId = null;

      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;

      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-789',
        epicKey: 'EP-3',
        oldPath: 'docs/ST-789',
        newPath: 'docs/EP-3/ST-789',
      });

      // Should not emit (no socket ID)
      expect(mockServerSocket.emit).not.toHaveBeenCalled();
    });

    it('should generate unique request IDs for each move', async () => {
      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;
      mockAgent.socketId = 'socket-123';

      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-1',
        epicKey: 'EP-1',
        oldPath: 'docs/ST-1',
        newPath: 'docs/EP-1/ST-1',
      });

      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-2',
        epicKey: 'EP-1',
        oldPath: 'docs/ST-2',
        newPath: 'docs/EP-1/ST-2',
      });

      expect(mockServerSocket.emit).toHaveBeenCalledTimes(2);

      const requestId1 = (mockServerSocket.emit as jest.Mock).mock.calls[0][1].requestId;
      const requestId2 = (mockServerSocket.emit as jest.Mock).mock.calls[1][1].requestId;

      expect(requestId1).not.toBe(requestId2);
    });

    it('should support move to unassigned (epicKey = null)', async () => {
      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;
      mockAgent.socketId = 'socket-123';

      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-100',
        epicKey: null,
        oldPath: 'docs/ST-100',
        newPath: 'docs/unassigned/ST-100',
      });

      expect(mockServerSocket.emit).toHaveBeenCalledWith(
        'artifact:move-request',
        expect.objectContaining({
          storyKey: 'ST-100',
          epicKey: null,
          newPath: 'docs/unassigned/ST-100',
        })
      );
    });
  });

  describe('Gateway - handleArtifactMoveComplete', () => {
    it('should broadcast success to frontend clients', async () => {
      const mockAppGateway = {
        server: {
          emit: jest.fn(),
        },
      };

      (gateway as any).appWebSocketGateway = mockAppGateway;

      const mockClient = {
        data: { agentId: mockAgent.id },
      } as any;

      const completeData = {
        requestId: 'move-123',
        storyKey: 'ST-200',
        success: true as const,
        newPath: 'docs/EP-5/ST-200',
        timestamp: Date.now(),
      };

      await gateway.handleArtifactMoveComplete(mockClient, completeData);

      expect(mockAppGateway.server.emit).toHaveBeenCalledWith(
        'artifact:moved',
        {
          storyKey: 'ST-200',
          newPath: 'docs/EP-5/ST-200',
          timestamp: expect.any(Date),
        }
      );
    });

    it('should include timestamp in frontend broadcast', async () => {
      const mockAppGateway = {
        server: {
          emit: jest.fn(),
        },
      };

      (gateway as any).appWebSocketGateway = mockAppGateway;

      const mockClient = {
        data: { agentId: mockAgent.id },
      } as any;

      const timestamp = Date.now();

      await gateway.handleArtifactMoveComplete(mockClient, {
        requestId: 'move-456',
        storyKey: 'ST-300',
        success: true,
        newPath: 'docs/EP-10/ST-300',
        timestamp,
      });

      const emitCall = (mockAppGateway.server.emit as jest.Mock).mock.calls[0];
      expect(emitCall[1].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Gateway - handleArtifactMoveFailed', () => {
    it('should broadcast failure to frontend clients', async () => {
      const mockAppGateway = {
        server: {
          emit: jest.fn(),
        },
      };

      (gateway as any).appWebSocketGateway = mockAppGateway;

      const mockClient = {
        data: { agentId: mockAgent.id },
      } as any;

      const failedData = {
        requestId: 'move-789',
        storyKey: 'ST-400',
        success: false as const,
        error: 'Source directory does not exist',
        timestamp: Date.now(),
      };

      await gateway.handleArtifactMoveFailed(mockClient, failedData);

      expect(mockAppGateway.server.emit).toHaveBeenCalledWith(
        'artifact:move-failed',
        {
          storyKey: 'ST-400',
          error: 'Source directory does not exist',
          timestamp: expect.any(Date),
        }
      );
    });

    it('should include error message in frontend broadcast', async () => {
      const mockAppGateway = {
        server: {
          emit: jest.fn(),
        },
      };

      (gateway as any).appWebSocketGateway = mockAppGateway;

      const mockClient = {
        data: { agentId: mockAgent.id },
      } as any;

      await gateway.handleArtifactMoveFailed(mockClient, {
        requestId: 'move-999',
        storyKey: 'ST-500',
        success: false,
        error: 'Target directory already exists',
        timestamp: Date.now(),
      });

      const emitCall = (mockAppGateway.server.emit as jest.Mock).mock.calls[0];
      expect(emitCall[1].error).toBe('Target directory already exists');
    });
  });

  describe('Controller - requestArtifactMove', () => {
    const validSecret = process.env.INTERNAL_API_SECRET || 'test-secret';

    it('should accept valid internal API secret', async () => {
      const mockGateway = {
        emitArtifactMoveRequest: jest.fn().mockResolvedValue(undefined),
      };

      (controller as any).remoteAgentGateway = mockGateway;

      const result = await controller.requestArtifactMove(validSecret, {
        storyKey: 'ST-600',
        storyId: 'story-uuid-600',
        epicKey: 'EP-20',
        oldPath: 'docs/ST-600',
        newPath: 'docs/EP-20/ST-600',
      });

      expect(result.success).toBe(true);
      expect(mockGateway.emitArtifactMoveRequest).toHaveBeenCalledWith({
        storyKey: 'ST-600',
        epicKey: 'EP-20',
        oldPath: 'docs/ST-600',
        newPath: 'docs/EP-20/ST-600',
      });
    });

    it('should reject invalid internal API secret', async () => {
      await expect(
        controller.requestArtifactMove('invalid-secret', {
          storyKey: 'ST-700',
          storyId: 'story-uuid-700',
          epicKey: 'EP-30',
          oldPath: 'docs/ST-700',
          newPath: 'docs/EP-30/ST-700',
        })
      ).rejects.toThrow();
    });

    it('should handle gateway errors gracefully', async () => {
      const mockGateway = {
        emitArtifactMoveRequest: jest.fn().mockRejectedValue(new Error('Gateway error')),
      };

      (controller as any).remoteAgentGateway = mockGateway;

      const result = await controller.requestArtifactMove(validSecret, {
        storyKey: 'ST-800',
        storyId: 'story-uuid-800',
        epicKey: 'EP-40',
        oldPath: 'docs/ST-800',
        newPath: 'docs/EP-40/ST-800',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gateway error');
    });

    it('should support move to unassigned (epicKey = null)', async () => {
      const mockGateway = {
        emitArtifactMoveRequest: jest.fn().mockResolvedValue(undefined),
      };

      (controller as any).remoteAgentGateway = mockGateway;

      const result = await controller.requestArtifactMove(validSecret, {
        storyKey: 'ST-900',
        storyId: 'story-uuid-900',
        epicKey: null,
        oldPath: 'docs/ST-900',
        newPath: 'docs/unassigned/ST-900',
      });

      expect(result.success).toBe(true);
      expect(mockGateway.emitArtifactMoveRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          epicKey: null,
        })
      );
    });
  });

  describe('Event Flow Integration', () => {
    it('should complete full flow: request -> move -> complete -> broadcast', async () => {
      const mockAppGateway = {
        server: {
          emit: jest.fn(),
        },
      };

      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;
      (gateway as any).appWebSocketGateway = mockAppGateway;
      mockAgent.socketId = 'socket-flow-test';

      // Step 1: Request move
      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-1000',
        epicKey: 'EP-50',
        oldPath: 'docs/ST-1000',
        newPath: 'docs/EP-50/ST-1000',
      });

      expect(mockServerSocket.emit).toHaveBeenCalledWith(
        'artifact:move-request',
        expect.objectContaining({
          storyKey: 'ST-1000',
        })
      );

      const requestId = (mockServerSocket.emit as jest.Mock).mock.calls[0][1].requestId;

      // Step 2: Agent completes move
      const mockClient = {
        data: { agentId: mockAgent.id },
      } as any;

      await gateway.handleArtifactMoveComplete(mockClient, {
        requestId,
        storyKey: 'ST-1000',
        success: true,
        newPath: 'docs/EP-50/ST-1000',
        timestamp: Date.now(),
      });

      // Step 3: Verify frontend broadcast
      expect(mockAppGateway.server.emit).toHaveBeenCalledWith(
        'artifact:moved',
        expect.objectContaining({
          storyKey: 'ST-1000',
          newPath: 'docs/EP-50/ST-1000',
        })
      );
    });

    it('should handle failure flow: request -> move -> failed -> broadcast', async () => {
      const mockAppGateway = {
        server: {
          emit: jest.fn(),
        },
      };

      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;
      (gateway as any).appWebSocketGateway = mockAppGateway;
      mockAgent.socketId = 'socket-fail-test';

      // Step 1: Request move
      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-2000',
        epicKey: 'EP-60',
        oldPath: 'docs/ST-2000',
        newPath: 'docs/EP-60/ST-2000',
      });

      const requestId = (mockServerSocket.emit as jest.Mock).mock.calls[0][1].requestId;

      // Step 2: Agent fails move
      const mockClient = {
        data: { agentId: mockAgent.id },
      } as any;

      await gateway.handleArtifactMoveFailed(mockClient, {
        requestId,
        storyKey: 'ST-2000',
        success: false,
        error: 'Permission denied',
        timestamp: Date.now(),
      });

      // Step 3: Verify frontend broadcast
      expect(mockAppGateway.server.emit).toHaveBeenCalledWith(
        'artifact:move-failed',
        expect.objectContaining({
          storyKey: 'ST-2000',
          error: 'Permission denied',
        })
      );
    });
  });

  describe('Capability-Based Routing', () => {
    it('should only send move requests to agents with artifact-move capability', async () => {
      const agentsWithoutCapability = [
        { id: 'agent-1', capabilities: ['watch-transcripts'], socketId: 'sock-1', status: 'online' },
        { id: 'agent-2', capabilities: ['git-jobs'], socketId: 'sock-2', status: 'online' },
      ];

      (prisma.remoteAgent.findMany as jest.Mock).mockResolvedValueOnce(agentsWithoutCapability);

      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;

      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-3000',
        epicKey: 'EP-70',
        oldPath: 'docs/ST-3000',
        newPath: 'docs/EP-70/ST-3000',
      });

      // Should not emit to agents without capability
      expect(mockServerSocket.emit).not.toHaveBeenCalled();
    });

    it('should prefer first available agent with artifact-move capability', async () => {
      const multipleAgents = [
        { id: 'agent-1', capabilities: ['artifact-move'], socketId: 'sock-1', status: 'online' },
        { id: 'agent-2', capabilities: ['artifact-move'], socketId: 'sock-2', status: 'online' },
      ];

      (prisma.remoteAgent.findMany as jest.Mock).mockResolvedValueOnce(multipleAgents);

      const mockServerSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServerSocket as any;

      await gateway.emitArtifactMoveRequest({
        storyKey: 'ST-4000',
        epicKey: 'EP-80',
        oldPath: 'docs/ST-4000',
        newPath: 'docs/EP-80/ST-4000',
      });

      // Should send to first agent's socket
      expect(mockServerSocket.to).toHaveBeenCalledWith('sock-1');
    });
  });
});
