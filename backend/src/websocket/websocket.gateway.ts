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
 * Handles real-time events for projects, stories, and subtasks
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

  // Track active users per room
  private activeUsers = new Map<string, Set<string>>();

  constructor(private jwtService: JwtService) {}

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

    // Remove user from all rooms
    this.activeUsers.forEach((users, room) => {
      users.delete(client.id);
      if (users.size === 0) {
        this.activeUsers.delete(room);
      } else {
        // Notify remaining users
        this.server.to(room).emit('active-users-updated', {
          room,
          count: users.size,
          users: Array.from(users),
        });
      }
    });
  }

  /**
   * Join a room (project or story)
   */
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; userId?: string; userName?: string }
  ) {
    client.join(data.room);

    // Track active users
    if (!this.activeUsers.has(data.room)) {
      this.activeUsers.set(data.room, new Set());
    }
    this.activeUsers.get(data.room)!.add(client.id);

    this.logger.log(`Client ${client.id} joined room: ${data.room}`);

    // Notify others in the room
    client.to(data.room).emit('user-joined', {
      userId: data.userId,
      userName: data.userName,
      socketId: client.id,
    });

    // Send active users count to the joining user
    const activeUserCount = this.activeUsers.get(data.room)!.size;
    client.emit('active-users-updated', {
      room: data.room,
      count: activeUserCount,
    });

    return { success: true, room: data.room, activeUsers: activeUserCount };
  }

  /**
   * Leave a room
   */
  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; userId?: string; userName?: string }
  ) {
    client.leave(data.room);

    // Remove from active users
    if (this.activeUsers.has(data.room)) {
      this.activeUsers.get(data.room)!.delete(client.id);
      const remainingUsers = this.activeUsers.get(data.room)!.size;

      if (remainingUsers === 0) {
        this.activeUsers.delete(data.room);
      } else {
        // Notify remaining users
        this.server.to(data.room).emit('active-users-updated', {
          room: data.room,
          count: remainingUsers,
        });
      }
    }

    this.logger.log(`Client ${client.id} left room: ${data.room}`);

    // Notify others in the room
    client.to(data.room).emit('user-left', {
      userId: data.userId,
      userName: data.userName,
      socketId: client.id,
    });

    return { success: true, room: data.room };
  }

  /**
   * User is typing indicator
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; userId: string; userName: string; isTyping: boolean }
  ) {
    client.to(data.room).emit('user-typing', {
      userId: data.userId,
      userName: data.userName,
      isTyping: data.isTyping,
    });

    return { success: true };
  }

  // ============================================================================
  // Event Broadcasting Methods (called by services)
  // ============================================================================

  /**
   * Broadcast project update
   */
  broadcastProjectUpdated(projectId: string, data: any) {
    const room = `project:${projectId}`;
    this.server.to(room).emit('project:updated', data);
    this.logger.log(`Broadcasted project update to room: ${room}`);
  }

  /**
   * Broadcast story created
   */
  broadcastStoryCreated(projectId: string, story: any) {
    const room = `project:${projectId}`;
    this.server.to(room).emit('story:created', story);
    this.logger.log(`Broadcasted story created to room: ${room}`);
  }

  /**
   * Broadcast story updated
   */
  broadcastStoryUpdated(storyId: string, projectId: string, story: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('story:updated', story);
    this.server.to(projectRoom).emit('story:updated', story);

    this.logger.log(`Broadcasted story update to rooms: ${storyRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast story status changed
   */
  broadcastStoryStatusChanged(storyId: string, projectId: string, data: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('story:status:changed', data);
    this.server.to(projectRoom).emit('story:status:changed', data);

    this.logger.log(`Broadcasted story status change to rooms: ${storyRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast subtask created
   */
  broadcastSubtaskCreated(storyId: string, projectId: string, subtask: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('subtask:created', subtask);
    this.server.to(projectRoom).emit('subtask:created', subtask);

    this.logger.log(`Broadcasted subtask created to rooms: ${storyRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast subtask updated
   */
  broadcastSubtaskUpdated(subtaskId: string, storyId: string, projectId: string, subtask: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('subtask:updated', subtask);
    this.server.to(projectRoom).emit('subtask:updated', subtask);

    this.logger.log(`Broadcasted subtask update to rooms: ${storyRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast epic created
   */
  broadcastEpicCreated(projectId: string, epic: any) {
    const room = `project:${projectId}`;
    this.server.to(room).emit('epic:created', epic);
    this.logger.log(`Broadcasted epic created to room: ${room}`);
  }

  /**
   * Broadcast epic updated
   */
  broadcastEpicUpdated(epicId: string, projectId: string, epic: any) {
    const room = `project:${projectId}`;
    this.server.to(room).emit('epic:updated', epic);
    this.logger.log(`Broadcasted epic update to room: ${room}`);
  }

  /**
   * Broadcast story deleted
   */
  broadcastStoryDeleted(storyId: string, projectId: string, data: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('story:deleted', data);
    this.server.to(projectRoom).emit('story:deleted', data);

    this.logger.log(`Broadcasted story deletion to rooms: ${storyRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast commit linked
   */
  broadcastCommitLinked(storyId: string | null, projectId: string, commit: any) {
    const projectRoom = `project:${projectId}`;
    this.server.to(projectRoom).emit('commit:linked', commit);

    if (storyId) {
      const storyRoom = `story:${storyId}`;
      this.server.to(storyRoom).emit('commit:linked', commit);
      this.logger.log(`Broadcasted commit linked to rooms: ${storyRoom}, ${projectRoom}`);
    } else {
      this.logger.log(`Broadcasted commit linked to room: ${projectRoom}`);
    }
  }

  /**
   * Broadcast run logged
   */
  broadcastRunLogged(storyId: string | null, projectId: string, run: any) {
    const projectRoom = `project:${projectId}`;
    this.server.to(projectRoom).emit('run:logged', run);

    if (storyId) {
      const storyRoom = `story:${storyId}`;
      this.server.to(storyRoom).emit('run:logged', run);
      this.logger.log(`Broadcasted run logged to rooms: ${storyRoom}, ${projectRoom}`);
    } else {
      this.logger.log(`Broadcasted run logged to room: ${projectRoom}`);
    }
  }

  /**
   * Broadcast comment added (for story detail drawer)
   */
  broadcastCommentAdded(storyId: string, projectId: string, comment: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('comment:added', comment);
    this.server.to(projectRoom).emit('comment:added', comment);

    this.logger.log(`Broadcasted comment added to rooms: ${storyRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast use case linked
   */
  broadcastUseCaseLinked(storyId: string, projectId: string, useCaseLink: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('usecase:linked', useCaseLink);
    this.server.to(projectRoom).emit('usecase:linked', useCaseLink);

    this.logger.log(`Broadcasted use case linked to rooms: ${storyRoom}, ${projectRoom}`);
  }

  // ============================================================================
  // Workflow Execution Events
  // ============================================================================

  /**
   * Broadcast workflow run started
   */
  broadcastWorkflowStarted(runId: string, projectId: string, data: any) {
    const runRoom = `workflow-run:${runId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(runRoom).emit('workflow:started', data);
    this.server.to(projectRoom).emit('workflow:started', data);

    this.logger.log(`Broadcasted workflow started to rooms: ${runRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast workflow status updated
   */
  broadcastWorkflowStatusUpdated(runId: string, projectId: string, data: any) {
    const runRoom = `workflow-run:${runId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(runRoom).emit('workflow:status', data);
    this.server.to(projectRoom).emit('workflow:status', data);

    this.logger.log(`Broadcasted workflow status to rooms: ${runRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast component execution started
   */
  broadcastComponentStarted(runId: string, projectId: string, data: any) {
    const runRoom = `workflow-run:${runId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(runRoom).emit('component:started', data);
    this.server.to(projectRoom).emit('component:started', data);

    this.logger.log(`Broadcasted component started to room: ${runRoom}`);
  }

  /**
   * Broadcast component execution progress
   */
  broadcastComponentProgress(runId: string, projectId: string, data: any) {
    const runRoom = `workflow-run:${runId}`;

    this.server.to(runRoom).emit('component:progress', data);

    this.logger.debug(`Broadcasted component progress to room: ${runRoom}`);
  }

  /**
   * Broadcast component execution completed
   */
  broadcastComponentCompleted(runId: string, projectId: string, data: any) {
    const runRoom = `workflow-run:${runId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(runRoom).emit('component:completed', data);
    this.server.to(projectRoom).emit('component:completed', data);

    this.logger.log(`Broadcasted component completed to room: ${runRoom}`);
  }

  /**
   * Broadcast artifact stored
   */
  broadcastArtifactStored(runId: string, projectId: string, data: any) {
    const runRoom = `workflow-run:${runId}`;

    this.server.to(runRoom).emit('artifact:stored', data);

    this.logger.log(`Broadcasted artifact stored to room: ${runRoom}`);
  }

  /**
   * Broadcast aggregated metrics updated
   */
  broadcastMetricsUpdated(runId: string, projectId: string, data: any) {
    const runRoom = `workflow-run:${runId}`;

    this.server.to(runRoom).emit('metrics:updated', data);

    this.logger.debug(`Broadcasted metrics updated to room: ${runRoom}`);
  }

  /**
   * Broadcast queue status updated (ST-53)
   * Notifies clients of queue position, priority, wait time, and lock status changes
   */
  broadcastQueueUpdated(runId: string, projectId: string, data: any) {
    const runRoom = `workflow-run:${runId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(runRoom).emit('queue:updated', data);
    this.server.to(projectRoom).emit('queue:updated', data);

    this.logger.log(`Broadcasted queue updated to rooms: ${runRoom}, ${projectRoom}`);
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
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('deployment:started', data);
    this.server.to(projectRoom).emit('deployment:started', data);

    this.logger.log(`Broadcasted deployment started to rooms: ${storyRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast deployment completed
   */
  broadcastDeploymentCompleted(storyId: string, projectId: string, data: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('deployment:completed', data);
    this.server.to(projectRoom).emit('deployment:completed', data);

    this.logger.log(`Broadcasted deployment completed to rooms: ${storyRoom}, ${projectRoom}`);
  }

  /**
   * Broadcast review ready (ST-108)
   */
  broadcastReviewReady(storyId: string, projectId: string, data: any) {
    const storyRoom = `story:${storyId}`;
    const projectRoom = `project:${projectId}`;

    this.server.to(storyRoom).emit('review:ready', data);
    this.server.to(projectRoom).emit('review:ready', data);

    this.logger.log(`Broadcasted review ready to rooms: ${storyRoom}, ${projectRoom}`);
  }
}
