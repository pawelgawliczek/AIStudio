import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket, Server } from 'socket.io';
import { AppWebSocketGateway } from '../websocket.gateway';

describe('AppWebSocketGateway', () => {
  let gateway: AppWebSocketGateway;
  let jwtService: JwtService;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  const validPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    role: 'admin',
  };

  // Helper to create mock socket with custom handshake
  const createMockSocket = (handshakeOverrides: Partial<Socket['handshake']> = {}): Partial<Socket> => ({
    id: 'socket-123',
    handshake: {
      auth: { token: 'valid-token' },
      query: {},
      headers: {},
      time: new Date().toString(),
      address: '127.0.0.1',
      xdomain: false,
      secure: false,
      issued: Date.now(),
      url: '/',
      ...handshakeOverrides,
    } as Socket['handshake'],
    data: {},
    disconnect: jest.fn(),
  });

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
    };

    mockSocket = createMockSocket();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppWebSocketGateway,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<AppWebSocketGateway>(AppWebSocketGateway);
    jwtService = module.get<JwtService>(JwtService);

    // Set the mock server
    gateway.server = mockServer as Server;
  });

  describe('handleConnection', () => {
    it('should authenticate client with valid token', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(validPayload);

      await gateway.handleConnection(mockSocket as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
        secret: expect.any(String),
      });
      expect(mockSocket.data.user).toEqual({
        userId: validPayload.sub,
        email: validPayload.email,
        role: validPayload.role,
      });
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should reject client without token', async () => {
      const socketWithoutToken = createMockSocket({ auth: {}, query: {} });

      await gateway.handleConnection(socketWithoutToken as Socket);

      expect(socketWithoutToken.disconnect).toHaveBeenCalled();
    });

    it('should reject client with invalid token', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('Invalid token')
      );

      await gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should extract token from query if not in auth', async () => {
      const socketWithQueryToken = createMockSocket({
        auth: {},
        query: { token: 'query-token' }
      });

      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(validPayload);

      await gateway.handleConnection(socketWithQueryToken as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('query-token', {
        secret: expect.any(String),
      });
    });
  });

  describe('handleDisconnect', () => {
    it('should handle disconnect gracefully', () => {
      expect(() => gateway.handleDisconnect(mockSocket as Socket)).not.toThrow();
    });
  });

  describe('getServer', () => {
    it('should return the Socket.IO server instance', () => {
      expect(gateway.getServer()).toBe(mockServer);
    });
  });

  describe('Project Broadcasts', () => {
    it('should broadcast project updated event', () => {
      const projectId = 'project-123';
      const data = { name: 'Updated Project' };

      gateway.broadcastProjectUpdated(projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('project:updated', {
        ...data,
        projectId,
      });
    });
  });

  describe('Story Broadcasts', () => {
    it('should broadcast story created event', () => {
      const projectId = 'project-123';
      const story = { id: 'story-123', title: 'New Story' };

      gateway.broadcastStoryCreated(projectId, story);

      expect(mockServer.emit).toHaveBeenCalledWith('story:created', {
        ...story,
        projectId,
      });
    });

    it('should broadcast story updated event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const story = { title: 'Updated Story' };

      gateway.broadcastStoryUpdated(storyId, projectId, story);

      expect(mockServer.emit).toHaveBeenCalledWith('story:updated', {
        ...story,
        storyId,
        projectId,
      });
    });

    it('should broadcast story status changed event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const data = { status: 'done', previousStatus: 'review' };

      gateway.broadcastStoryStatusChanged(storyId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('story:status:changed', {
        ...data,
        storyId,
        projectId,
      });
    });

    it('should broadcast story deleted event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const data = { deletedBy: 'user-123' };

      gateway.broadcastStoryDeleted(storyId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('story:deleted', {
        ...data,
        storyId,
        projectId,
      });
    });
  });

  describe('Subtask Broadcasts', () => {
    it('should broadcast subtask created event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const subtask = { id: 'subtask-123', title: 'New Subtask' };

      gateway.broadcastSubtaskCreated(storyId, projectId, subtask);

      expect(mockServer.emit).toHaveBeenCalledWith('subtask:created', {
        ...subtask,
        storyId,
        projectId,
      });
    });

    it('should broadcast subtask updated event', () => {
      const subtaskId = 'subtask-123';
      const storyId = 'story-123';
      const projectId = 'project-123';
      const subtask = { status: 'completed' };

      gateway.broadcastSubtaskUpdated(subtaskId, storyId, projectId, subtask);

      expect(mockServer.emit).toHaveBeenCalledWith('subtask:updated', {
        ...subtask,
        subtaskId,
        storyId,
        projectId,
      });
    });
  });

  describe('Epic Broadcasts', () => {
    it('should broadcast epic created event', () => {
      const projectId = 'project-123';
      const epic = { id: 'epic-123', title: 'New Epic' };

      gateway.broadcastEpicCreated(projectId, epic);

      expect(mockServer.emit).toHaveBeenCalledWith('epic:created', {
        ...epic,
        projectId,
      });
    });

    it('should broadcast epic updated event', () => {
      const epicId = 'epic-123';
      const projectId = 'project-123';
      const epic = { status: 'in_progress' };

      gateway.broadcastEpicUpdated(epicId, projectId, epic);

      expect(mockServer.emit).toHaveBeenCalledWith('epic:updated', {
        ...epic,
        epicId,
        projectId,
      });
    });
  });

  describe('Commit and Run Broadcasts', () => {
    it('should broadcast commit linked event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const commit = { hash: 'abc123', message: 'Fix bug' };

      gateway.broadcastCommitLinked(storyId, projectId, commit);

      expect(mockServer.emit).toHaveBeenCalledWith('commit:linked', {
        ...commit,
        storyId,
        projectId,
      });
    });

    it('should broadcast commit linked event with null storyId', () => {
      const projectId = 'project-123';
      const commit = { hash: 'abc123', message: 'Generic fix' };

      gateway.broadcastCommitLinked(null, projectId, commit);

      expect(mockServer.emit).toHaveBeenCalledWith('commit:linked', {
        ...commit,
        storyId: null,
        projectId,
      });
    });

    it('should broadcast run logged event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const run = { id: 'run-123', status: 'completed' };

      gateway.broadcastRunLogged(storyId, projectId, run);

      expect(mockServer.emit).toHaveBeenCalledWith('run:logged', {
        ...run,
        storyId,
        projectId,
      });
    });

    it('should broadcast comment added event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const comment = { id: 'comment-123', text: 'Great work!' };

      gateway.broadcastCommentAdded(storyId, projectId, comment);

      expect(mockServer.emit).toHaveBeenCalledWith('comment:added', {
        ...comment,
        storyId,
        projectId,
      });
    });

    it('should broadcast use case linked event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const useCaseLink = { useCaseId: 'uc-123', relation: 'implements' };

      gateway.broadcastUseCaseLinked(storyId, projectId, useCaseLink);

      expect(mockServer.emit).toHaveBeenCalledWith('usecase:linked', {
        ...useCaseLink,
        storyId,
        projectId,
      });
    });
  });

  describe('Workflow Execution Broadcasts', () => {
    it('should broadcast workflow started event', () => {
      const runId = 'run-123';
      const projectId = 'project-123';
      const data = { storyKey: 'ST-123', storyTitle: 'Test Story' };

      gateway.broadcastWorkflowStarted(runId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('workflow:started', {
        ...data,
        runId,
        projectId,
      });
    });

    it('should broadcast workflow status updated event', () => {
      const runId = 'run-123';
      const projectId = 'project-123';
      const data = { status: 'completed' };

      gateway.broadcastWorkflowStatusUpdated(runId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('workflow:status', {
        ...data,
        runId,
        projectId,
      });
    });

    it('should broadcast component started event', () => {
      const runId = 'run-123';
      const projectId = 'project-123';
      const data = { componentName: 'Implementer', startedAt: new Date().toISOString() };

      gateway.broadcastComponentStarted(runId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('component:started', {
        ...data,
        runId,
        projectId,
      });
    });

    it('should broadcast component progress event', () => {
      const runId = 'run-123';
      const projectId = 'project-123';
      const data = { componentName: 'Implementer', progress: 50 };

      gateway.broadcastComponentProgress(runId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('component:progress', {
        ...data,
        runId,
        projectId,
      });
    });

    it('should broadcast component completed event', () => {
      const runId = 'run-123';
      const projectId = 'project-123';
      const data = { componentName: 'Implementer', status: 'completed' };

      gateway.broadcastComponentCompleted(runId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('component:completed', {
        ...data,
        runId,
        projectId,
      });
    });

    it('should broadcast artifact stored event', () => {
      const runId = 'run-123';
      const projectId = 'project-123';
      const data = { artifactId: 'artifact-123', type: 'code' };

      gateway.broadcastArtifactStored(runId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('artifact:stored', {
        ...data,
        runId,
        projectId,
      });
    });

    it('should broadcast metrics updated event', () => {
      const runId = 'run-123';
      const projectId = 'project-123';
      const data = { totalTokens: 5000, totalCost: 0.05 };

      gateway.broadcastMetricsUpdated(runId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('metrics:updated', {
        ...data,
        runId,
        projectId,
      });
    });

    it('should broadcast queue updated event', () => {
      const runId = 'run-123';
      const projectId = 'project-123';
      const data = { queuePosition: 1, estimatedWait: 300 };

      gateway.broadcastQueueUpdated(runId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('queue:updated', {
        ...data,
        runId,
        projectId,
      });
    });
  });

  describe('Workflow Control Messages (ST-53)', () => {
    it('should handle workflow pause request', () => {
      const result = gateway.handleWorkflowPause(mockSocket as Socket, {
        runId: 'run-123',
      });

      expect(result).toEqual({
        success: true,
        runId: 'run-123',
        action: 'pause',
      });
    });

    it('should handle workflow cancel request', () => {
      const result = gateway.handleWorkflowCancel(mockSocket as Socket, {
        runId: 'run-123',
      });

      expect(result).toEqual({
        success: true,
        runId: 'run-123',
        action: 'cancel',
      });
    });
  });

  describe('Deployment Broadcasts (ST-108)', () => {
    it('should broadcast deployment started event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const data = {
        environment: 'test',
        storyKey: 'ST-123',
        startedAt: new Date().toISOString(),
      };

      gateway.broadcastDeploymentStarted(storyId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('deployment:started', {
        ...data,
        storyId,
        projectId,
      });
    });

    it('should broadcast deployment completed event with success', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const data = {
        environment: 'production',
        storyKey: 'ST-123',
        status: 'success',
        completedAt: new Date().toISOString(),
      };

      gateway.broadcastDeploymentCompleted(storyId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('deployment:completed', {
        ...data,
        storyId,
        projectId,
      });
    });

    it('should broadcast deployment completed event with failure', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const data = {
        environment: 'production',
        storyKey: 'ST-123',
        status: 'failed',
        error: 'Health check failed',
        completedAt: new Date().toISOString(),
      };

      gateway.broadcastDeploymentCompleted(storyId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('deployment:completed', {
        ...data,
        storyId,
        projectId,
      });
    });

    it('should broadcast review ready event', () => {
      const storyId = 'story-123';
      const projectId = 'project-123';
      const data = {
        storyKey: 'ST-123',
        readyAt: new Date().toISOString(),
      };

      gateway.broadcastReviewReady(storyId, projectId, data);

      expect(mockServer.emit).toHaveBeenCalledWith('review:ready', {
        ...data,
        storyId,
        projectId,
      });
    });
  });

  describe('CORS Configuration', () => {
    // CORS is configured via the @WebSocketGateway decorator
    // We verify the gateway is properly configured by checking it doesn't throw on instantiation
    it('should be properly instantiated with CORS config', () => {
      expect(gateway).toBeDefined();
    });
  });
});
