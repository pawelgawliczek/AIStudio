/**
 * MCP HTTP WebSocket Gateway (Tasks 3.1, 3.1a)
 *
 * WebSocket gateway for real-time MCP tool execution streaming.
 *
 * Features:
 * - WebSocket namespace: /mcp-stream
 * - Session subscription: subscribe:session
 * - Event types: tool:start, tool:progress, tool:complete, tool:error
 * - API key authentication during handshake (Task 3.1a)
 * - Session ownership validation
 *
 * @see ST-163 Task 3.1: Implement WebSocket Gateway for Streaming
 * @see ST-163 Task 3.1a: WebSocket Authentication
 */

import { Logger, Injectable } from '@nestjs/common';
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
import { McpSessionService } from './mcp-session.service';

/**
 * Tool event types for streaming
 */
export interface ToolEvent {
  type: 'tool:start' | 'tool:progress' | 'tool:complete' | 'tool:error' | 'session:revoked';
  sessionId: string;
  toolName?: string;
  timestamp: string;
  data: {
    progress?: number;      // 0-100 for progress events
    partialResult?: any;    // Streaming output
    result?: any;           // Final result
    error?: { code: string; message: string };
    message?: string;       // For session:revoked
  };
}

/**
 * WebSocket Gateway for MCP streaming events
 *
 * Namespace: /mcp-stream
 * CORS: Allows cross-origin connections
 */
@WebSocketGateway({
  namespace: '/mcp-stream',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  },
})
@Injectable()
export class McpHttpGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(McpHttpGateway.name);

  constructor(private readonly sessionService: McpSessionService) {}

  /**
   * Handle WebSocket connection
   * Task 3.1a: Authenticate using API key from handshake
   */
  async handleConnection(client: Socket) {
    this.logger.log(`WebSocket client connecting: ${client.id}`);

    try {
      // Extract API key from handshake (auth.apiKey or Authorization header)
      const apiKey = client.handshake.auth?.apiKey ||
                     client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!apiKey) {
        this.logger.warn(`WebSocket connection rejected: No API key provided (${client.id})`);
        client.emit('error', { code: 'UNAUTHORIZED', message: 'API key required' });
        client.disconnect();
        return;
      }

      // Validate API key using the utility from Phase 2
      try {
        const { validateApiKey } = await import('./utils/api-key.util');
        const { PrismaService } = await import('../prisma/prisma.service');
        const prisma = new PrismaService();

        const validatedKey = await validateApiKey(apiKey, prisma);

        // Store validated key in socket data
        client.data.apiKey = validatedKey;

        this.logger.log(`WebSocket client authenticated: ${client.id} (API key: ${validatedKey.keyPrefix})`);
      } catch (error: any) {
        this.logger.warn(`WebSocket authentication failed: ${error.message} (${client.id})`);
        client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid API key' });
        client.disconnect();
        return;
      }
    } catch (error: any) {
      this.logger.error(`WebSocket connection error: ${error.message} (${client.id})`);
      client.emit('error', { code: 'INTERNAL_ERROR', message: 'Connection failed' });
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  async handleDisconnect(client: Socket) {
    const apiKeyPrefix = client.data.apiKey?.keyPrefix || 'unknown';
    this.logger.log(`WebSocket client disconnected: ${client.id} (API key: ${apiKeyPrefix})`);
  }

  /**
   * Subscribe to session events
   * Client sends: { sessionId: "sess_abc123..." }
   *
   * Validates:
   * - Session exists
   * - Session belongs to API key
   *
   * @event subscribe:session
   */
  @SubscribeMessage('subscribe:session')
  async handleSubscribeSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string }
  ) {
    const { sessionId } = data;

    if (!client.data.apiKey) {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }

    try {
      // Validate session exists and belongs to API key
      const session = await this.sessionService.getSession(sessionId);

      if (!session) {
        this.logger.warn(`Session not found: ${sessionId} (client: ${client.id})`);
        client.emit('error', { code: 'NOT_FOUND', message: 'Session not found' });
        return;
      }

      if (session.apiKeyId !== client.data.apiKey.id) {
        this.logger.warn(
          `Access denied to session ${sessionId}: belongs to API key ${session.apiKeyId}, ` +
          `client has ${client.data.apiKey.id} (client: ${client.id})`
        );
        client.emit('error', { code: 'FORBIDDEN', message: 'Access denied to session' });
        return;
      }

      // Join session room
      client.join(`session:${sessionId}`);

      this.logger.log(`Client ${client.id} subscribed to session ${sessionId}`);

      // Send subscription confirmation
      client.emit('subscribed', { sessionId, success: true });
    } catch (error: any) {
      this.logger.error(`Subscribe error: ${error.message} (client: ${client.id})`);
      client.emit('error', { code: 'INTERNAL_ERROR', message: 'Subscription failed' });
    }
  }

  /**
   * Unsubscribe from session events
   * Client sends: { sessionId: "sess_abc123..." }
   *
   * @event unsubscribe:session
   */
  @SubscribeMessage('unsubscribe:session')
  async handleUnsubscribeSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string }
  ) {
    const { sessionId } = data;

    // Leave session room
    client.leave(`session:${sessionId}`);

    this.logger.log(`Client ${client.id} unsubscribed from session ${sessionId}`);

    // Send unsubscribe confirmation
    client.emit('unsubscribed', { sessionId, success: true });
  }

  /**
   * Emit tool event to all clients subscribed to session
   * Called by McpSessionService during tool execution
   *
   * @param sessionId - Session ID to emit to
   * @param event - Tool event data
   */
  emitToSession(sessionId: string, event: ToolEvent): void {
    // Server may not be initialized if no WebSocket clients connected
    if (!this.server) {
      this.logger.debug(`WebSocket server not initialized, skipping event ${event.type}`);
      return;
    }

    // Ensure timestamp is set
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Emit to session room
    this.server.to(`session:${sessionId}`).emit(event.type, event);

    this.logger.log(
      `Emitted ${event.type} to session ${sessionId} ` +
      `(tool: ${event.toolName || 'N/A'})`
    );
  }

  /**
   * Emit generic event to session room
   * Used for session:revoked and other non-tool events
   *
   * @param sessionId - Session ID
   * @param eventType - Event type string
   * @param data - Event payload
   */
  emitGenericEvent(sessionId: string, eventType: string, data: any): void {
    // Server may not be initialized if no WebSocket clients connected
    if (!this.server) {
      this.logger.debug(`WebSocket server not initialized, skipping event ${eventType}`);
      return;
    }

    this.server.to(`session:${sessionId}`).emit(eventType, {
      sessionId,
      timestamp: new Date().toISOString(),
      ...data,
    });

    this.logger.log(`Emitted ${eventType} to session ${sessionId}`);
  }

  /**
   * Get count of clients subscribed to a session
   * Useful for debugging and monitoring
   *
   * @param sessionId - Session ID
   * @returns Number of subscribed clients
   */
  async getSubscriberCount(sessionId: string): Promise<number> {
    const room = this.server.sockets.adapter.rooms.get(`session:${sessionId}`);
    return room?.size || 0;
  }
}
