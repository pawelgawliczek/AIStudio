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
 * ST-147: Turn tracking for session telemetry
 */
export interface TurnCounts {
  /** All user messages (manual + auto) */
  totalTurns: number;
  /** Actual user-typed input requiring thought/decision */
  manualPrompts: number;
  /** Auto-continue/confirmation prompts */
  autoContinues: number;
}

/**
 * ST-147: Decision record for audit trail
 */
export interface DecisionRecord {
  /** When the decision was made */
  timestamp: string;
  /** State ID where decision was made */
  stateId: string;
  /** Human-readable state name */
  stateName: string;
  /** Type of decision */
  decisionType: 'state_transition' | 'agent_spawn' | 'skip' | 'retry' | 'pause' | 'approval';
  /** Reason for the decision */
  reason: string;
  /** Outcome of the decision */
  outcome: 'success' | 'failed' | 'pending';
  /** Additional metadata */
  metadata?: {
    componentId?: string;
    tokensUsed?: number;
    durationMs?: number;
    errorMessage?: string;
  };
}

/**
 * ST-147: Session telemetry for complete audit trail
 */
export interface SessionTelemetry {
  /** Path to runner transcript JSONL */
  runnerTranscriptPath?: string;
  /** Runner (master session) token usage */
  runnerTokensInput: number;
  runnerTokensOutput: number;
  totalRunnerTokens: number;
  /** Turn tracking (aggregated across all sessions) */
  turns: TurnCounts;
  /** AI-generated summary for resume */
  resumeSummary?: string;
  /** List of artifact keys created */
  artifacts: string[];
  /** Decision history for audit */
  decisionHistory: DecisionRecord[];
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

  // ST-147: Session telemetry
  telemetry: SessionTelemetry;

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
    // ST-147: Initialize telemetry
    telemetry: {
      runnerTokensInput: 0,
      runnerTokensOutput: 0,
      totalRunnerTokens: 0,
      turns: {
        totalTurns: 0,
        manualPrompts: 0,
        autoContinues: 0,
      },
      artifacts: [],
      decisionHistory: [],
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

  // ST-147: Check telemetry (optional for backward compatibility with old checkpoints)
  // If telemetry exists, validate its structure
  if (checkpoint.telemetry !== undefined) {
    if (typeof checkpoint.telemetry !== 'object' || checkpoint.telemetry === null) return false;
    const telemetry = checkpoint.telemetry as Record<string, unknown>;
    if (typeof telemetry.turns !== 'object' || telemetry.turns === null) return false;
    if (!Array.isArray(telemetry.decisionHistory)) return false;
  }

  return true;
}

/**
 * ST-147: Create an empty telemetry object
 * Used for backward compatibility when loading old checkpoints
 */
export function createEmptyTelemetry(): SessionTelemetry {
  return {
    runnerTokensInput: 0,
    runnerTokensOutput: 0,
    totalRunnerTokens: 0,
    turns: {
      totalTurns: 0,
      manualPrompts: 0,
      autoContinues: 0,
    },
    artifacts: [],
    decisionHistory: [],
  };
}

/**
 * ST-147: Add a decision to the telemetry history
 */
export function addDecision(
  telemetry: SessionTelemetry,
  decision: Omit<DecisionRecord, 'timestamp'>
): void {
  telemetry.decisionHistory.push({
    ...decision,
    timestamp: new Date().toISOString(),
  });
}

/**
 * ST-147: Update turn counts in telemetry
 */
export function updateTurnCounts(
  telemetry: SessionTelemetry,
  turns: TurnCounts
): void {
  telemetry.turns.totalTurns += turns.totalTurns;
  telemetry.turns.manualPrompts += turns.manualPrompts;
  telemetry.turns.autoContinues += turns.autoContinues;
}
