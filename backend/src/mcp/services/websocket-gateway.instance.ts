/**
 * Shared WebSocket Gateway Instance for MCP Handlers (ST-129)
 *
 * This singleton provides access to the NestJS WebSocket gateway from MCP handlers
 * which run outside the NestJS dependency injection context.
 *
 * The gateway is set during NestJS bootstrap via setSharedWebSocketGateway().
 */

import { AppWebSocketGateway } from '../../websocket/websocket.gateway';

let sharedGateway: AppWebSocketGateway | null = null;

/**
 * Set the shared WebSocket gateway instance (called from main.ts after NestJS bootstrap)
 */
export function setSharedWebSocketGateway(gateway: AppWebSocketGateway): void {
  sharedGateway = gateway;
  console.log('[ST-129] Shared WebSocket gateway initialized for MCP handlers');
}

/**
 * Get the shared WebSocket gateway instance
 * @throws Error if gateway not initialized (app not bootstrapped yet)
 */
export function getWebSocketGateway(): AppWebSocketGateway {
  if (!sharedGateway) {
    console.warn('[ST-129] WebSocket gateway not yet initialized - broadcasts will be skipped');
    // Return a no-op gateway to prevent crashes during startup
    return {
      broadcastComponentStarted: () => {},
      broadcastComponentCompleted: () => {},
      broadcastDeploymentStarted: () => {},
      broadcastDeploymentCompleted: () => {},
    } as unknown as AppWebSocketGateway;
  }

  return sharedGateway;
}
