import { Inject, Logger, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { validate } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { getErrorMessage, getErrorStack } from '../common';
import { PrismaService } from '../prisma/prisma.service';
import { RemoteAgentGateway } from '../remote-agent/remote-agent.gateway';
import { TelemetryService } from '../telemetry/telemetry.service';
import { TranscriptSubscriptionDto } from './dto/transcript-subscription.dto';

// WebSocket event payload types
interface ProjectUpdatePayload {
  projectId: string;
  [key: string]: unknown;
}

interface StoryPayload {
  projectId?: string;
  storyId?: string;
  [key: string]: unknown;
}

interface SubtaskPayload {
  storyId?: string;
  projectId?: string;
  subtaskId?: string;
  [key: string]: unknown;
}

interface EpicPayload {
  projectId?: string;
  epicId?: string;
  [key: string]: unknown;
}

interface CommitPayload {
  storyId: string | null;
  projectId: string;
  [key: string]: unknown;
}

interface RunPayload {
  storyId: string | null;
  projectId: string;
  [key: string]: unknown;
}

interface CommentPayload {
  storyId: string;
  projectId: string;
  [key: string]: unknown;
}

interface UseCaseLinkPayload {
  storyId: string;
  projectId: string;
  [key: string]: unknown;
}

interface WorkflowEventPayload {
  runId?: string;
  projectId?: string;
  storyId?: string;
  storyKey?: string;
  status?: string;
  componentId?: string;
  [key: string]: unknown;
}

interface DeploymentEventPayload {
  storyId?: string;
  projectId?: string;
  deploymentLogId?: string;
  [key: string]: unknown;
}

interface TestExecutionPayload {
  executionId?: string;
  projectId?: string;
  status?: string;
  [key: string]: unknown;
}

interface WorkflowActionPayload {
  runId: string;
}

interface MasterTranscriptSubscribePayload {
  runId: string;
  sessionIndex: number;
  filePath: string;
  fromBeginning?: boolean;
}

interface MasterTranscriptUnsubscribePayload {
  runId: string;
  sessionIndex: number;
}

interface TranscriptSubscribePayload {
  componentRunId: string;
}

interface TranscriptUnsubscribePayload {
  componentRunId: string;
}

/**
 * WebSocket Gateway for real-time updates
 * Broadcasts events globally to all authenticated clients
 */
@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://aistudio.example.com',
      'https://vibestudio.example.com',
      'https://test.vibestudio.example.com',
    ],
    credentials: true,
  },
})
export class AppWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppWebSocketGateway.name);

  /**
   * Track user subscriptions to transcript streams (ST-176)
   * Map<userId, Set<componentRunId>>
   */
  private readonly userSubscriptions = new Map<string, Set<string>>();

  /**
   * Maximum concurrent subscriptions per user (ST-176)
   */
  private readonly MAX_SUBSCRIPTIONS_PER_USER = 5;

  constructor(
    private jwtService: JwtService,
    @Inject(PrismaService) private prisma: PrismaService,
    private telemetry: TelemetryService,
    @Inject(forwardRef(() => RemoteAgentGateway)) private remoteAgentGateway: RemoteAgentGateway,
  ) {}

  /**
   * Get the Socket.IO server instance for global broadcasts
   */
  getServer(): Server {
    return this.server;
  }

  async handleConnection(client: Socket) {
    try {
      // ST-108: Extract JWT token from handshake
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: No token provided`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      });

      // Store user data in socket context
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      this.logger.log(`Client ${client.id} authenticated as user: ${payload.sub}`);
    } catch (error) {
      this.logger.warn(`Client ${client.id} rejected: Invalid token - ${getErrorMessage(error)}`);
      client.disconnect();
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Extract from auth object (WebSocket doesn't support headers)
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    return token as string | null;
  }

  handleDisconnect(client: Socket) {
    // Clean up transcript subscriptions (ST-176)
    if (client.data?.user?.userId) {
      const userId = client.data.user.userId;
      const subscriptions = this.userSubscriptions.get(userId);
      if (subscriptions) {
        this.logger.log(
          `Client ${client.id} disconnected with ${subscriptions.size} transcript subscriptions`,
        );
        this.userSubscriptions.delete(userId);
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ============================================================================
  // Event Broadcasting Methods (called by services)
  // All broadcasts are global - sent to all connected authenticated clients
  // ============================================================================

  /**
   * Broadcast project update
   */
  broadcastProjectUpdated(projectId: string, data: ProjectUpdatePayload) {
    this.server.emit('project:updated', { ...data, projectId });
    this.logger.log(`Broadcasted project update globally`);
  }

  /**
   * Broadcast story created
   */
  broadcastStoryCreated(projectId: string, story: StoryPayload) {
    this.server.emit('story:created', { ...story, projectId });
    this.logger.log(`Broadcasted story created globally`);
  }

  /**
   * Broadcast story updated
   */
  broadcastStoryUpdated(storyId: string, projectId: string, story: StoryPayload) {
    this.server.emit('story:updated', { ...story, storyId, projectId });
    this.logger.log(`Broadcasted story update globally`);
  }

  /**
   * Broadcast story status changed
   */
  broadcastStoryStatusChanged(storyId: string, projectId: string, data: StoryPayload) {
    this.server.emit('story:status:changed', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted story status change globally`);
  }

  /**
   * Broadcast subtask created
   */
  broadcastSubtaskCreated(storyId: string, projectId: string, subtask: SubtaskPayload) {
    this.server.emit('subtask:created', { ...subtask, storyId, projectId });
    this.logger.log(`Broadcasted subtask created globally`);
  }

  /**
   * Broadcast subtask updated
   */
  broadcastSubtaskUpdated(subtaskId: string, storyId: string, projectId: string, subtask: SubtaskPayload) {
    this.server.emit('subtask:updated', { ...subtask, subtaskId, storyId, projectId });
    this.logger.log(`Broadcasted subtask update globally`);
  }

  /**
   * Broadcast epic created
   */
  broadcastEpicCreated(projectId: string, epic: EpicPayload) {
    this.server.emit('epic:created', { ...epic, projectId });
    this.logger.log(`Broadcasted epic created globally`);
  }

  /**
   * Broadcast epic updated
   */
  broadcastEpicUpdated(epicId: string, projectId: string, epic: EpicPayload) {
    this.server.emit('epic:updated', { ...epic, epicId, projectId });
    this.logger.log(`Broadcasted epic update globally`);
  }

  /**
   * Broadcast story deleted
   */
  broadcastStoryDeleted(storyId: string, projectId: string, data: StoryPayload) {
    this.server.emit('story:deleted', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted story deletion globally`);
  }

  /**
   * Broadcast commit linked
   */
  broadcastCommitLinked(storyId: string | null, projectId: string, commit: CommitPayload) {
    this.server.emit('commit:linked', { ...commit, storyId, projectId });
    this.logger.log(`Broadcasted commit linked globally`);
  }

  /**
   * Broadcast run logged
   */
  broadcastRunLogged(storyId: string | null, projectId: string, run: RunPayload) {
    this.server.emit('run:logged', { ...run, storyId, projectId });
    this.logger.log(`Broadcasted run logged globally`);
  }

  /**
   * Broadcast comment added (for story detail drawer)
   */
  broadcastCommentAdded(storyId: string, projectId: string, comment: CommentPayload) {
    this.server.emit('comment:added', { ...comment, storyId, projectId });
    this.logger.log(`Broadcasted comment added globally`);
  }

  /**
   * Broadcast use case linked
   */
  broadcastUseCaseLinked(storyId: string, projectId: string, useCaseLink: UseCaseLinkPayload) {
    this.server.emit('usecase:linked', { ...useCaseLink, storyId, projectId });
    this.logger.log(`Broadcasted use case linked globally`);
  }

  // ============================================================================
  // Workflow Execution Events
  // ============================================================================

  /**
   * Broadcast workflow run started
   * ST-258 Phase 4: Add telemetry
   */
  broadcastWorkflowStarted(runId: string, projectId: string, data: WorkflowEventPayload) {
    this.telemetry.withSpan('websocket.broadcast.workflow_started', async (span) => {
      span.setAttribute('workflow.run.id', runId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('event.type', 'workflow:started');
      if (data.storyId) {
        span.setAttribute('story.id', data.storyId);
      }
      if (data.storyKey) {
        span.setAttribute('story.key', data.storyKey);
      }

      this.server.emit('workflow:started', { ...data, runId, projectId });
      this.logger.log(`Broadcasted workflow started globally`);
    });
  }

  /**
   * Broadcast workflow status updated
   * ST-258 Phase 4: Add telemetry
   */
  broadcastWorkflowStatusUpdated(runId: string, projectId: string, data: WorkflowEventPayload) {
    this.telemetry.withSpan('websocket.broadcast.workflow_status', async (span) => {
      span.setAttribute('workflow.run.id', runId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('event.type', 'workflow:status');
      if (data.status) {
        span.setAttribute('workflow.status', data.status);
      }
      if (data.storyId) {
        span.setAttribute('story.id', data.storyId);
      }
      if (data.storyKey) {
        span.setAttribute('story.key', data.storyKey);
      }

      this.server.emit('workflow:status', { ...data, runId, projectId });
      this.logger.log(`Broadcasted workflow status globally`);
    });
  }

  /**
   * Broadcast component execution started
   * ST-258 Phase 4: Add telemetry
   */
  broadcastComponentStarted(runId: string, projectId: string, data: WorkflowEventPayload) {
    this.telemetry.withSpan('websocket.broadcast.component_started', async (span) => {
      span.setAttribute('workflow.run.id', runId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('event.type', 'component:started');
      if (data.componentId) {
        span.setAttribute('component.id', data.componentId);
      }
      if (data.storyId) {
        span.setAttribute('story.id', data.storyId);
      }
      if (data.storyKey) {
        span.setAttribute('story.key', data.storyKey);
      }

      this.server.emit('component:started', { ...data, runId, projectId });
      this.logger.log(`Broadcasted component started globally`);
    });
  }

  /**
   * Broadcast component execution progress
   */
  broadcastComponentProgress(runId: string, projectId: string, data: WorkflowEventPayload) {
    this.server.emit('component:progress', { ...data, runId, projectId });
    this.logger.debug(`Broadcasted component progress globally`);
  }

  /**
   * Broadcast component execution completed
   * ST-258 Phase 4: Add telemetry
   */
  broadcastComponentCompleted(runId: string, projectId: string, data: WorkflowEventPayload) {
    this.telemetry.withSpan('websocket.broadcast.component_completed', async (span) => {
      span.setAttribute('workflow.run.id', runId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('event.type', 'component:completed');
      if (data.componentId) {
        span.setAttribute('component.id', data.componentId);
      }
      if (data.status) {
        span.setAttribute('component.status', data.status);
      }
      if (data.storyId) {
        span.setAttribute('story.id', data.storyId);
      }
      if (data.storyKey) {
        span.setAttribute('story.key', data.storyKey);
      }

      this.server.emit('component:completed', { ...data, runId, projectId });
      this.logger.log(`Broadcasted component completed globally`);
    });
  }

  /**
   * Broadcast artifact stored
   */
  broadcastArtifactStored(runId: string, projectId: string, data: WorkflowEventPayload) {
    this.server.emit('artifact:stored', { ...data, runId, projectId });
    this.logger.log(`Broadcasted artifact stored globally`);
  }

  /**
   * Broadcast aggregated metrics updated
   */
  broadcastMetricsUpdated(runId: string, projectId: string, data: WorkflowEventPayload) {
    this.server.emit('metrics:updated', { ...data, runId, projectId });
    this.logger.debug(`Broadcasted metrics updated globally`);
  }

  /**
   * Broadcast queue status updated (ST-53)
   * Notifies clients of queue position, priority, wait time, and lock status changes
   */
  broadcastQueueUpdated(runId: string, projectId: string, data: WorkflowEventPayload) {
    this.server.emit('queue:updated', { ...data, runId, projectId });
    this.logger.log(`Broadcasted queue updated globally`);
  }

  /**
   * Handle workflow pause request (ST-53)
   */
  @SubscribeMessage('workflow:pause')
  handleWorkflowPause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WorkflowActionPayload
  ) {
    this.logger.log(`Client ${client.id} requested pause for workflow run: ${data.runId}`);
    // Implementation would be handled by WorkflowRunsService
    return { success: true, runId: data.runId, action: 'pause' };
  }

  /**
   * Handle workflow cancel request (ST-53)
   */
  @SubscribeMessage('workflow:cancel')
  handleWorkflowCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WorkflowActionPayload
  ) {
    this.logger.log(`Client ${client.id} requested cancel for workflow run: ${data.runId}`);
    // Implementation would be handled by WorkflowRunsService
    return { success: true, runId: data.runId, action: 'cancel' };
  }

  // ============================================================================
  // Deployment Events (ST-108)
  // ============================================================================

  /**
   * Broadcast deployment started
   */
  broadcastDeploymentStarted(storyId: string, projectId: string, data: DeploymentEventPayload) {
    this.server.emit('deployment:started', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted deployment started globally`);
  }

  /**
   * Broadcast deployment completed
   */
  broadcastDeploymentCompleted(storyId: string, projectId: string, data: DeploymentEventPayload) {
    this.server.emit('deployment:completed', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted deployment completed globally`);
  }

  /**
   * Broadcast review ready (ST-108)
   */
  broadcastReviewReady(storyId: string, projectId: string, data: DeploymentEventPayload) {
    this.server.emit('review:ready', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted review ready globally`);
  }

  /**
   * Broadcast deployment progress (ST-268)
   */
  broadcastDeploymentProgress(
    deploymentLogId: string,
    storyId: string,
    projectId: string,
    data: DeploymentEventPayload
  ) {
    this.server.emit('deployment:progress', { ...data, deploymentLogId, storyId, projectId });
    this.logger.debug(`Broadcasted deployment progress for ${deploymentLogId}`);
  }

  // ============================================================================
  // Test Execution Events (ST-128)
  // ============================================================================

  /**
   * Broadcast test execution started
   */
  broadcastTestExecutionStarted(executionId: string, projectId: string, data: TestExecutionPayload) {
    this.server.emit('test:started', { ...data, executionId, projectId });
    this.logger.log(`Broadcasted test execution started: ${executionId}`);
  }

  /**
   * Broadcast test execution completed
   */
  broadcastTestExecutionCompleted(executionId: string, projectId: string, data: TestExecutionPayload) {
    this.server.emit('test:completed', { ...data, executionId, projectId });
    this.logger.log(`Broadcasted test execution completed: ${executionId} - ${data.status}`);
  }

  // ============================================================================
  // Transcript Streaming (ST-176)
  // ============================================================================

  /**
   * Subscribe to real-time transcript streaming for a component run
   * Uses Socket.IO rooms for targeted broadcasting
   */
  @SubscribeMessage('transcript:subscribe')
  async handleTranscriptSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TranscriptSubscribePayload,
  ): Promise<void> {
    const userId = client.data?.user?.userId;

    if (!userId) {
      throw new WsException('Unauthorized');
    }

    // Validate input
    const dto = new TranscriptSubscriptionDto();
    dto.componentRunId = payload.componentRunId;

    const errors = await validate(dto);
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => Object.values(e.constraints || {}).join(', '));
      throw new WsException(errorMessages.join('; '));
    }

    const { componentRunId } = dto;

    // Validate UUID format more strictly
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(componentRunId)) {
      throw new WsException('Invalid componentRunId format');
    }

    // Check concurrent subscription limit
    const userSubs = this.userSubscriptions.get(userId) || new Set();
    if (userSubs.size >= this.MAX_SUBSCRIPTIONS_PER_USER && !userSubs.has(componentRunId)) {
      throw new WsException('Maximum concurrent subscriptions exceeded');
    }

    try {
      // Verify component run exists
      const componentRun = await this.prisma.componentRun.findUnique({
        where: { id: componentRunId },
        include: {
          workflowRun: {
            select: { projectId: true },
          },
        },
      });

      if (!componentRun) {
        throw new WsException('Component run not found');
      }

      // Verify user has access to project
      const project = await this.prisma.project.findFirst({
        where: {
          id: componentRun.workflowRun.projectId,
          // In a real app, add user access check here
          // For now, assume all authenticated users have access
        },
      });

      if (!project) {
        this.logger.warn(
          `Access denied: User ${userId} attempted to access component run ${componentRunId}`,
        );
        throw new WsException('Access denied');
      }

      // Join Socket.IO room for this component run
      const room = `transcript:${componentRunId}`;
      client.join(room);

      // Track subscription
      userSubs.add(componentRunId);
      this.userSubscriptions.set(userId, userSubs);

      this.logger.log(
        `Client ${client.id} subscribed to transcript ${componentRunId} (${userSubs.size}/${this.MAX_SUBSCRIPTIONS_PER_USER})`,
      );
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }
      this.logger.error(`Error subscribing to transcript: ${getErrorMessage(error)}`, getErrorStack(error));
      throw new WsException('Failed to subscribe to transcript');
    }
  }

  /**
   * Unsubscribe from transcript streaming
   */
  @SubscribeMessage('transcript:unsubscribe')
  async handleTranscriptUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TranscriptUnsubscribePayload,
  ): Promise<void> {
    const userId = client.data?.user?.userId;
    const { componentRunId } = payload;

    // Leave Socket.IO room
    const room = `transcript:${componentRunId}`;
    client.leave(room);

    // Remove from subscription tracking
    if (userId) {
      const userSubs = this.userSubscriptions.get(userId);
      if (userSubs) {
        userSubs.delete(componentRunId);
        if (userSubs.size === 0) {
          this.userSubscriptions.delete(userId);
        }
      }
    }

    this.logger.log(`Client ${client.id} unsubscribed from transcript ${componentRunId}`);
  }

  /**
   * Broadcast transcript line to subscribed clients (called by TranscriptTailService)
   */
  broadcastTranscriptLine(event: {
    componentRunId: string;
    line: string;
    sequenceNumber: number;
    timestamp: Date;
  }): void {
    const room = `transcript:${event.componentRunId}`;
    this.server.to(room).emit('transcript:line', event);
  }

  /**
   * Broadcast transcript completion to subscribed clients
   */
  broadcastTranscriptComplete(componentRunId: string, totalLines: number): void {
    const room = `transcript:${componentRunId}`;
    this.server.to(room).emit('transcript:complete', {
      componentRunId,
      totalLines,
    });
  }

  /**
   * Broadcast transcript error to subscribed clients
   */
  broadcastTranscriptError(
    componentRunId: string,
    error: { message: string; code: string },
  ): void {
    const room = `transcript:${componentRunId}`;
    this.server.to(room).emit('transcript:error', {
      componentRunId,
      message: error.message,
      code: error.code,
    });
  }

  // ============================================================================
  // ST-182: Master Session Transcript Streaming
  // These handlers bridge frontend (default namespace) with laptop agent (/remote-agent namespace)
  // ============================================================================

  /**
   * Track active master transcript subscriptions
   * Map<runId, Set<clientId>>
   */
  private readonly masterTranscriptSubscriptions = new Map<string, Set<string>>();

  /**
   * ST-182: Frontend requests to start tailing a master transcript
   * Forwards request to laptop agent via RemoteAgentGateway
   */
  @SubscribeMessage('master-transcript:subscribe')
  async handleMasterTranscriptSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MasterTranscriptSubscribePayload,
  ) {
    const { runId, sessionIndex, filePath, fromBeginning } = data;
    this.logger.log(`[ST-182] Master transcript subscribe: runId=${runId}, sessionIndex=${sessionIndex}`);

    // Track subscription
    if (!this.masterTranscriptSubscriptions.has(runId)) {
      this.masterTranscriptSubscriptions.set(runId, new Set());
    }
    this.masterTranscriptSubscriptions.get(runId)!.add(client.id);

    // Join room for this workflow's transcript updates
    client.join(`master-transcript:${runId}`);

    // Forward tail request to laptop agent via RemoteAgentGateway
    // This is necessary because cross-namespace emit doesn't work correctly
    const result = await this.remoteAgentGateway.forwardTailRequestToAgent({
      runId,
      sessionIndex,
      filePath,
      fromBeginning,
    });

    if (!result.success) {
      client.emit('master-transcript:error', {
        runId,
        sessionIndex,
        error: result.error,
        code: 'NO_AGENT',
      });
      return;
    }

    this.logger.log(`[ST-182] Forwarded tail request to agent ${result.agentHostname}`);
  }

  /**
   * ST-182: Frontend requests to stop tailing a master transcript
   */
  @SubscribeMessage('master-transcript:unsubscribe')
  async handleMasterTranscriptUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MasterTranscriptUnsubscribePayload,
  ) {
    const { runId, sessionIndex } = data;
    this.logger.log(`[ST-182] Master transcript unsubscribe: runId=${runId}, sessionIndex=${sessionIndex}`);

    // Leave room
    client.leave(`master-transcript:${runId}`);

    // Remove from tracking
    const subs = this.masterTranscriptSubscriptions.get(runId);
    if (subs) {
      subs.delete(client.id);
      if (subs.size === 0) {
        this.masterTranscriptSubscriptions.delete(runId);

        // No more subscribers, tell laptop agent to stop tailing via RemoteAgentGateway
        await this.remoteAgentGateway.forwardStopTailToAgent({ runId, sessionIndex });
      }
    }
  }

}
