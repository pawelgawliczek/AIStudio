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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-129] Failed to broadcast component:started: ${message}`);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-129] Failed to broadcast component:completed: ${message}`);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-129] Failed to broadcast deployment:started: ${message}`);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-129] Failed to broadcast deployment:completed: ${message}`);
  }
}

/**
 * Broadcast approval required event via HTTP to backend (ST-148)
 * Emitted when a state with requiresApproval=true completes execution
 */
export async function broadcastApprovalRequired(
  runId: string,
  projectId: string,
  data: {
    requestId: string;
    stateName: string;
    stateOrder: number;
    storyKey?: string;
    contextSummary?: string;
    artifactKeys?: string[];
    tokensUsed?: number;
  }
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        event: 'approval:required',
        runId,
        projectId,
        data,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-148] Failed to broadcast approval:required: ${message}`);
  }
}

/**
 * Broadcast approval resolved event via HTTP to backend (ST-148)
 * Emitted when a pending approval is approved, rejected, or rerun requested
 */
export async function broadcastApprovalResolved(
  runId: string,
  projectId: string,
  data: {
    requestId: string;
    resolution: string;
    resolvedBy: string;
    reExecutionMode?: string;
    storyKey?: string;
  }
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        event: 'approval:resolved',
        runId,
        projectId,
        data,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-148] Failed to broadcast approval:resolved: ${message}`);
  }
}

/**
 * ST-160: Send answer to remote agent for session resume
 * Triggers the remote agent gateway to emit the answer to the laptop agent
 */
export async function sendAnswerToRemoteAgent(
  agentId: string,
  data: {
    sessionId: string;
    answer: string;
    questionId: string;
    jobId: string;
    workflowRunId: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/remote-agent/internal/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        agentId,
        ...data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[ST-160] Failed to send answer to remote agent: ${errorText}`);
      return { success: false, error: errorText };
    }

    const result = await response.json() as { success: boolean; error?: string };
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-160] Failed to send answer to remote agent: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * ST-160: Broadcast question detected event via HTTP to backend
 * Emitted when a Claude CLI agent asks a question during execution
 */
export async function broadcastQuestionDetected(
  workflowRunId: string,
  projectId: string,
  data: {
    questionId: string;
    componentRunId?: string;
    sessionId: string;
    questionText: string;
    canHandoff: boolean;
    executionType: string;
  }
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        event: 'question:detected',
        workflowRunId,
        projectId,
        data,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-160] Failed to broadcast question:detected: ${message}`);
  }
}

/**
 * ST-160: Broadcast question answered event via HTTP to backend
 * Emitted when a pending question is answered
 */
export async function broadcastQuestionAnswered(
  workflowRunId: string,
  projectId: string,
  data: {
    questionId: string;
    answeredBy?: string;
    resumeTriggered: boolean;
  }
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        event: 'question:answered',
        workflowRunId,
        projectId,
        data,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-160] Failed to broadcast question:answered: ${message}`);
  }
}

/**
 * ST-176: Start transcript tailing via HTTP to backend
 * Called when component execution starts
 */
export async function startTranscriptTailing(
  componentRunId: string,
  transcriptPath: string
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/transcript/start-tailing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        componentRunId,
        transcriptPath,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-176] Failed to start transcript tailing: ${message}`);
  }
}

/**
 * ST-176: Stop transcript tailing via HTTP to backend
 * Called when component execution completes
 */
export async function stopTranscriptTailing(
  componentRunId: string
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/internal/transcript/stop-tailing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        componentRunId,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-176] Failed to stop transcript tailing: ${message}`);
  }
}

/**
 * ST-363: Request artifact move via HTTP to backend
 * Called when update_story changes epicId
 */
export async function requestArtifactMove(data: {
  storyKey: string;
  storyId: string;
  epicKey: string | null;
  oldPath: string;
  newPath: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/internal/artifact-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[ST-363] Failed to request artifact move: ${errorText}`);
      return { success: false, error: errorText };
    }

    const result = await response.json() as { success: boolean; error?: string };
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ST-363] Failed to request artifact move: ${message}`);
    return { success: false, error: message };
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
