/**
 * Checkpoint System Types
 * For crash recovery and state persistence
 */

/**
 * Current phase within a state execution
 */
export type ExecutionPhase = 'pre' | 'agent' | 'post';

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  /** Number of agents spawned so far */
  agentSpawns: number;
  /** Total tokens used across all sessions */
  tokensUsed: number;
  /** Number of state transitions */
  stateTransitions: number;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Error tracking for recovery
 */
export interface CheckpointError {
  /** Error message */
  message: string;
  /** State where error occurred */
  stateId: string;
  /** Number of recovery attempts made */
  recoveryAttempts: number;
  /** Timestamp of error */
  occurredAt: string;
}

/**
 * Complete checkpoint structure
 * Saved to DB (WorkflowRun.metadata.checkpoint) and file (/app/checkpoints/{runId}.json)
 */
export interface RunnerCheckpoint {
  /** Schema version for migrations */
  version: 1;

  // Identifiers
  /** WorkflowRun ID */
  runId: string;
  /** Workflow ID */
  workflowId: string;
  /** Story ID (if story-based run) */
  storyId?: string;

  // State tracking
  /** Current state being executed */
  currentStateId: string;
  /** Current phase within state */
  currentPhase: ExecutionPhase;
  /** States that completed successfully */
  completedStates: string[];
  /** States that were skipped */
  skippedStates: string[];

  // Session tracking
  /** Master CLI session ID for --resume */
  masterSessionId: string;

  // Resource usage at checkpoint
  resourceUsage: ResourceUsage;

  // Error tracking
  lastError?: CheckpointError;

  // Timestamps
  /** When this checkpoint was created */
  checkpointedAt: string;
  /** When the run originally started */
  runStartedAt: string;
}

/**
 * Create a new checkpoint
 */
export function createCheckpoint(
  runId: string,
  workflowId: string,
  masterSessionId: string,
  storyId?: string
): RunnerCheckpoint {
  const now = new Date().toISOString();
  return {
    version: 1,
    runId,
    workflowId,
    storyId,
    currentStateId: '',
    currentPhase: 'pre',
    completedStates: [],
    skippedStates: [],
    masterSessionId,
    resourceUsage: {
      agentSpawns: 0,
      tokensUsed: 0,
      stateTransitions: 0,
      durationMs: 0,
    },
    checkpointedAt: now,
    runStartedAt: now,
  };
}

/**
 * Validate a checkpoint object
 */
export function isValidCheckpoint(obj: unknown): obj is RunnerCheckpoint {
  if (typeof obj !== 'object' || obj === null) return false;

  const checkpoint = obj as Record<string, unknown>;

  // Check version
  if (checkpoint.version !== 1) return false;

  // Check required string fields
  const requiredStrings = ['runId', 'workflowId', 'currentStateId', 'masterSessionId', 'checkpointedAt', 'runStartedAt'];
  for (const field of requiredStrings) {
    if (typeof checkpoint[field] !== 'string') return false;
  }

  // Check currentPhase
  const validPhases: ExecutionPhase[] = ['pre', 'agent', 'post'];
  if (!validPhases.includes(checkpoint.currentPhase as ExecutionPhase)) return false;

  // Check arrays
  if (!Array.isArray(checkpoint.completedStates)) return false;
  if (!Array.isArray(checkpoint.skippedStates)) return false;

  // Check resourceUsage
  if (typeof checkpoint.resourceUsage !== 'object' || checkpoint.resourceUsage === null) return false;

  return true;
}
