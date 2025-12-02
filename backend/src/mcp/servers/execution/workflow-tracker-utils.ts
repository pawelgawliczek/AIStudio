/**
 * ST-164: Workflow Tracker Utilities
 *
 * Functions to manage workflow tracking on the laptop via remote agent.
 * This enables context recovery after Claude Code compaction.
 *
 * The workflow tracker manages .claude/running-workflows.json on the laptop.
 */

/**
 * Result of workflow tracker operation
 */
export interface WorkflowTrackerResult {
  success: boolean;
  message?: string;
  error?: string;
  agentOffline?: boolean;
}

/**
 * Execute workflow-tracker script on laptop via remote agent HTTP API
 */
async function executeWorkflowTracker(
  action: 'register' | 'unregister' | 'set-current' | 'get-current' | 'list',
  args: string[] = []
): Promise<WorkflowTrackerResult> {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000';
  const apiSecret = process.env.INTERNAL_API_SECRET || process.env.AGENT_SECRET || '';

  try {
    const response = await fetch(`${backendUrl}/api/remote-agent/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Secret': apiSecret,
      },
      body: JSON.stringify({
        script: 'workflow-tracker',
        params: [action, ...args],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      // Check for specific error patterns
      if (text.includes('No agents online') || text.includes('agent offline')) {
        return {
          success: false,
          agentOffline: true,
          error: 'Laptop agent is offline. Workflow tracking skipped.',
        };
      }
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json() as {
      success: boolean;
      result?: string;
      error?: string;
    };

    return {
      success: result.success,
      message: result.result,
      error: result.error,
    };
  } catch (error: any) {
    // Network errors likely mean agent is offline
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      return {
        success: false,
        agentOffline: true,
        error: 'Cannot connect to backend. Workflow tracking skipped.',
      };
    }
    return {
      success: false,
      error: `Workflow tracker error: ${error.message}`,
    };
  }
}

/**
 * Register a workflow run on the laptop for context recovery
 *
 * @param runId - WorkflowRun ID
 * @param workflowId - Workflow/Team ID
 * @param storyId - Optional Story ID
 * @param sessionId - Optional session ID (auto-generated if not provided)
 */
export async function registerWorkflowOnLaptop(
  runId: string,
  workflowId: string,
  storyId?: string,
  sessionId?: string
): Promise<WorkflowTrackerResult> {
  const args = [runId, workflowId];
  if (storyId) args.push(storyId);
  if (sessionId) args.push(sessionId);

  return executeWorkflowTracker('register', args);
}

/**
 * Unregister a workflow run on the laptop when it completes
 *
 * @param runId - WorkflowRun ID to unregister
 */
export async function unregisterWorkflowOnLaptop(
  runId: string
): Promise<WorkflowTrackerResult> {
  return executeWorkflowTracker('unregister', [runId]);
}

/**
 * Set the current active workflow on the laptop
 *
 * @param runId - WorkflowRun ID to set as current
 */
export async function setCurrentWorkflowOnLaptop(
  runId: string
): Promise<WorkflowTrackerResult> {
  return executeWorkflowTracker('set-current', [runId]);
}

/**
 * Get the current active workflow ID from the laptop
 */
export async function getCurrentWorkflowFromLaptop(): Promise<WorkflowTrackerResult> {
  return executeWorkflowTracker('get-current');
}

/**
 * List all tracked workflows on the laptop
 */
export async function listWorkflowsOnLaptop(): Promise<WorkflowTrackerResult> {
  return executeWorkflowTracker('list');
}
