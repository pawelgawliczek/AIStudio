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
import { Logger } from '@nestjs/common';

/**
 * WebSocket Gateway for real-time updates
 * Handles real-time events for projects, stories, and subtasks
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class AppWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppWebSocketGateway.name);

  // Track active users per room
  private activeUsers = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
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
}
