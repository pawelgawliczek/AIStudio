/**
 * MasterResponse Protocol
 * Communication protocol between Master CLI and Runner
 * Based on ST-145 specification
 */

/**
 * Actions the Master CLI can recommend to the Runner
 */
export type MasterAction =
  | 'proceed'       // Continue to next step (spawn agent or next state)
  | 'spawn_agent'   // Explicit: spawn agent for current state
  | 'pause'         // Pause workflow, wait for external trigger
  | 'stop'          // Stop workflow (success or controlled exit)
  | 'retry'         // Retry current state
  | 'skip'          // Skip current state
  | 'wait'          // Wait for condition (approval, timeout, external)
  | 'rerun_state';  // Re-run a previous state

/**
 * Status of the pre/post execution
 */
export type MasterStatus = 'success' | 'error' | 'warning' | 'info';

/**
 * What the Master is waiting for (when action is 'wait' or 'pause')
 */
export type WaitConditionType = 'approval' | 'timeout' | 'event' | 'resource';

/**
 * Wait condition with details
 */
export interface WaitCondition {
  type: WaitConditionType;
  timeout?: number;
  event?: string;
  resource?: string;
}

/**
 * Output data produced by pre/post execution
 */
export interface MasterOutput {
  /** Data to store in ComponentRun.output */
  stateOutput?: unknown;
  /** Reasoning for the action */
  decision?: string;
  /** Context updates for next states */
  updates?: Record<string, unknown>;
  /** Artifact IDs created */
  artifacts?: string[];
}

/**
 * Agent configuration for spawn_agent action
 */
export interface AgentSpawnConfig {
  componentId?: string;
  allowedTools?: string[];
  maxTurns?: number;
  timeout?: number;
}

/**
 * Control flow parameters
 */
export interface MasterControl {
  /** For rerun_state: which state to go back to */
  targetState?: string;
  /** For rerun_state: target state ID */
  targetStateId?: string;
  /** Why this action was recommended */
  reason?: string;
  /** For retry: which attempt this is */
  retryCount?: number;
  /** For retry: max attempts allowed */
  maxRetries?: number;
  /** For wait/pause: condition details */
  waitCondition?: WaitCondition;
  /** For skip: target state to skip to */
  skipToState?: string;
  /** For skip: why skipping */
  skipReason?: string;
  /** For spawn_agent: agent configuration */
  agentConfig?: AgentSpawnConfig;
}

/**
 * Telemetry from Claude CLI execution
 */
export interface MasterMeta {
  /** Tokens used in this execution */
  tokensUsed?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Tools called during execution */
  toolsCalled?: string[];
}

/**
 * Complete MasterResponse structure
 * Master CLI returns this after every pre/post instruction execution
 */
export interface MasterResponse {
  /** What Master recommends Runner should do */
  action: MasterAction;
  /** Outcome of pre/post execution */
  status: MasterStatus;
  /** Human-readable explanation */
  message: string;
  /** Data produced by pre/post execution */
  output?: MasterOutput;
  /** Control flow parameters */
  control?: MasterControl;
  /** Telemetry from Claude CLI */
  meta?: MasterMeta;
}

/**
 * Default response when Master doesn't produce valid JSON
 */
export const DEFAULT_MASTER_RESPONSE: MasterResponse = {
  action: 'proceed',
  status: 'success',
  message: 'No explicit response, proceeding by default',
};

/**
 * Validate a MasterResponse object
 */
export function isValidMasterResponse(obj: unknown): obj is MasterResponse {
  if (typeof obj !== 'object' || obj === null) return false;

  const response = obj as Record<string, unknown>;

  // Required fields
  if (typeof response.action !== 'string') return false;
  if (typeof response.status !== 'string') return false;
  if (typeof response.message !== 'string') return false;

  // Validate action
  const validActions: MasterAction[] = [
    'proceed', 'spawn_agent', 'pause', 'stop',
    'retry', 'skip', 'wait', 'rerun_state'
  ];
  if (!validActions.includes(response.action as MasterAction)) return false;

  // Validate status
  const validStatuses: MasterStatus[] = ['success', 'error', 'warning', 'info'];
  if (!validStatuses.includes(response.status as MasterStatus)) return false;

  return true;
}
