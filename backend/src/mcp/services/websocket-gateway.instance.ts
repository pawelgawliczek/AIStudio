/**
 * Shared WebSocket Gateway Instance for MCP Handlers (ST-129)
 *
 * This singleton provides access to the WebSocket gateway from MCP handlers
 * which run outside the NestJS dependency injection context.
 *
 * Pattern: Lazy initialization - gateway is created on first access
 */

import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';

let gatewayInstance: AppWebSocketGateway | null = null;

/**
 * Get or create the shared WebSocket gateway instance
 */
export function getWebSocketGateway(): AppWebSocketGateway {
  if (!gatewayInstance) {
    // Initialize JWT service with same config as WebSocketModule
    const jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      signOptions: { expiresIn: '24h' },
    });

    // Create gateway instance
    gatewayInstance = new AppWebSocketGateway(jwtService);

    console.log('[WebSocketGateway] Created shared instance for MCP handlers');
  }

  return gatewayInstance;
}

/**
 * Set the WebSocket server instance (called by NestJS app after bootstrap)
 * This is needed because the Socket.IO server is created by NestJS WebSocket adapter
 */
export function setWebSocketServer(server: Server): void {
  const gateway = getWebSocketGateway();
  gateway.server = server;
  console.log('[WebSocketGateway] Server instance attached to shared gateway');
}
