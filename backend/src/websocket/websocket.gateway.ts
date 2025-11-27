import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

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

  constructor(private jwtService: JwtService) {}

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
      this.logger.warn(`Client ${client.id} rejected: Invalid token - ${error.message}`);
      client.disconnect();
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Extract from auth object (WebSocket doesn't support headers)
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    return token as string | null;
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ============================================================================
  // Event Broadcasting Methods (called by services)
  // All broadcasts are global - sent to all connected authenticated clients
  // ============================================================================

  /**
   * Broadcast project update
   */
  broadcastProjectUpdated(projectId: string, data: any) {
    this.server.emit('project:updated', { ...data, projectId });
    this.logger.log(`Broadcasted project update globally`);
  }

  /**
   * Broadcast story created
   */
  broadcastStoryCreated(projectId: string, story: any) {
    this.server.emit('story:created', { ...story, projectId });
    this.logger.log(`Broadcasted story created globally`);
  }

  /**
   * Broadcast story updated
   */
  broadcastStoryUpdated(storyId: string, projectId: string, story: any) {
    this.server.emit('story:updated', { ...story, storyId, projectId });
    this.logger.log(`Broadcasted story update globally`);
  }

  /**
   * Broadcast story status changed
   */
  broadcastStoryStatusChanged(storyId: string, projectId: string, data: any) {
    this.server.emit('story:status:changed', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted story status change globally`);
  }

  /**
   * Broadcast subtask created
   */
  broadcastSubtaskCreated(storyId: string, projectId: string, subtask: any) {
    this.server.emit('subtask:created', { ...subtask, storyId, projectId });
    this.logger.log(`Broadcasted subtask created globally`);
  }

  /**
   * Broadcast subtask updated
   */
  broadcastSubtaskUpdated(subtaskId: string, storyId: string, projectId: string, subtask: any) {
    this.server.emit('subtask:updated', { ...subtask, subtaskId, storyId, projectId });
    this.logger.log(`Broadcasted subtask update globally`);
  }

  /**
   * Broadcast epic created
   */
  broadcastEpicCreated(projectId: string, epic: any) {
    this.server.emit('epic:created', { ...epic, projectId });
    this.logger.log(`Broadcasted epic created globally`);
  }

  /**
   * Broadcast epic updated
   */
  broadcastEpicUpdated(epicId: string, projectId: string, epic: any) {
    this.server.emit('epic:updated', { ...epic, epicId, projectId });
    this.logger.log(`Broadcasted epic update globally`);
  }

  /**
   * Broadcast story deleted
   */
  broadcastStoryDeleted(storyId: string, projectId: string, data: any) {
    this.server.emit('story:deleted', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted story deletion globally`);
  }

  /**
   * Broadcast commit linked
   */
  broadcastCommitLinked(storyId: string | null, projectId: string, commit: any) {
    this.server.emit('commit:linked', { ...commit, storyId, projectId });
    this.logger.log(`Broadcasted commit linked globally`);
  }

  /**
   * Broadcast run logged
   */
  broadcastRunLogged(storyId: string | null, projectId: string, run: any) {
    this.server.emit('run:logged', { ...run, storyId, projectId });
    this.logger.log(`Broadcasted run logged globally`);
  }

  /**
   * Broadcast comment added (for story detail drawer)
   */
  broadcastCommentAdded(storyId: string, projectId: string, comment: any) {
    this.server.emit('comment:added', { ...comment, storyId, projectId });
    this.logger.log(`Broadcasted comment added globally`);
  }

  /**
   * Broadcast use case linked
   */
  broadcastUseCaseLinked(storyId: string, projectId: string, useCaseLink: any) {
    this.server.emit('usecase:linked', { ...useCaseLink, storyId, projectId });
    this.logger.log(`Broadcasted use case linked globally`);
  }

  // ============================================================================
  // Workflow Execution Events
  // ============================================================================

  /**
   * Broadcast workflow run started
   */
  broadcastWorkflowStarted(runId: string, projectId: string, data: any) {
    this.server.emit('workflow:started', { ...data, runId, projectId });
    this.logger.log(`Broadcasted workflow started globally`);
  }

  /**
   * Broadcast workflow status updated
   */
  broadcastWorkflowStatusUpdated(runId: string, projectId: string, data: any) {
    this.server.emit('workflow:status', { ...data, runId, projectId });
    this.logger.log(`Broadcasted workflow status globally`);
  }

  /**
   * Broadcast component execution started
   */
  broadcastComponentStarted(runId: string, projectId: string, data: any) {
    this.server.emit('component:started', { ...data, runId, projectId });
    this.logger.log(`Broadcasted component started globally`);
  }

  /**
   * Broadcast component execution progress
   */
  broadcastComponentProgress(runId: string, projectId: string, data: any) {
    this.server.emit('component:progress', { ...data, runId, projectId });
    this.logger.debug(`Broadcasted component progress globally`);
  }

  /**
   * Broadcast component execution completed
   */
  broadcastComponentCompleted(runId: string, projectId: string, data: any) {
    this.server.emit('component:completed', { ...data, runId, projectId });
    this.logger.log(`Broadcasted component completed globally`);
  }

  /**
   * Broadcast artifact stored
   */
  broadcastArtifactStored(runId: string, projectId: string, data: any) {
    this.server.emit('artifact:stored', { ...data, runId, projectId });
    this.logger.log(`Broadcasted artifact stored globally`);
  }

  /**
   * Broadcast aggregated metrics updated
   */
  broadcastMetricsUpdated(runId: string, projectId: string, data: any) {
    this.server.emit('metrics:updated', { ...data, runId, projectId });
    this.logger.debug(`Broadcasted metrics updated globally`);
  }

  /**
   * Broadcast queue status updated (ST-53)
   * Notifies clients of queue position, priority, wait time, and lock status changes
   */
  broadcastQueueUpdated(runId: string, projectId: string, data: any) {
    this.server.emit('queue:updated', { ...data, runId, projectId });
    this.logger.log(`Broadcasted queue updated globally`);
  }

  /**
   * Handle workflow pause request (ST-53)
   */
  @SubscribeMessage('workflow:pause')
  handleWorkflowPause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string }
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
    @MessageBody() data: { runId: string }
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
  broadcastDeploymentStarted(storyId: string, projectId: string, data: any) {
    this.server.emit('deployment:started', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted deployment started globally`);
  }

  /**
   * Broadcast deployment completed
   */
  broadcastDeploymentCompleted(storyId: string, projectId: string, data: any) {
    this.server.emit('deployment:completed', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted deployment completed globally`);
  }

  /**
   * Broadcast review ready (ST-108)
   */
  broadcastReviewReady(storyId: string, projectId: string, data: any) {
    this.server.emit('review:ready', { ...data, storyId, projectId });
    this.logger.log(`Broadcasted review ready globally`);
  }
}
