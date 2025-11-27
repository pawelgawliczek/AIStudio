/**
 * WebSocket Broadcast Helper for MCP Handlers (ST-129)
 *
 * MCP tools run via stdio transport in a separate process from NestJS.
 * They cannot share memory with the NestJS WebSocket gateway.
 *
 * Solution: Call HTTP endpoint on the backend to trigger broadcasts.
 * Security: Uses INTERNAL_API_SECRET for authentication.
 */

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

/**
 * Broadcast component started event via HTTP to backend
 */
export async function broadcastComponentStarted(
  runId: string,
  projectId: string,
  data: { componentName: string; storyKey: string; storyTitle: string; startedAt: string }
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        event: 'component:started',
        runId,
        projectId,
        data,
      }),
    });
  } catch (error: any) {
    console.warn(`[ST-129] Failed to broadcast component:started: ${error.message}`);
  }
}

/**
 * Broadcast component completed event via HTTP to backend
 */
export async function broadcastComponentCompleted(
  runId: string,
  projectId: string,
  data: { componentName: string; storyKey: string; storyTitle: string; status: string; completedAt: string }
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        event: 'component:completed',
        runId,
        projectId,
        data,
      }),
    });
  } catch (error: any) {
    console.warn(`[ST-129] Failed to broadcast component:completed: ${error.message}`);
  }
}

/**
 * Broadcast deployment started event via HTTP to backend
 */
export async function broadcastDeploymentStarted(
  storyId: string,
  projectId: string,
  data: { storyKey: string; environment: string; startedAt: string }
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        event: 'deployment:started',
        storyId,
        projectId,
        data,
      }),
    });
  } catch (error: any) {
    console.warn(`[ST-129] Failed to broadcast deployment:started: ${error.message}`);
  }
}

/**
 * Broadcast deployment completed event via HTTP to backend
 */
export async function broadcastDeploymentCompleted(
  storyId: string,
  projectId: string,
  data: { storyKey: string; environment: string; status: string; completedAt: string }
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        event: 'deployment:completed',
        storyId,
        projectId,
        data,
      }),
    });
  } catch (error: any) {
    console.warn(`[ST-129] Failed to broadcast deployment:completed: ${error.message}`);
  }
}

// Keep old exports for NestJS-side code (main.ts)
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
let sharedGateway: AppWebSocketGateway | null = null;

export function setSharedWebSocketGateway(gateway: AppWebSocketGateway): void {
  sharedGateway = gateway;
  console.log('[ST-129] Shared WebSocket gateway initialized for MCP handlers');
}

export function getWebSocketGateway(): AppWebSocketGateway | null {
  return sharedGateway;
}
