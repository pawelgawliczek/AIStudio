/**
 * Workflow Types
 * Types for workflow state execution
 */

/**
 * Component (Agent) definition from database
 */
export interface Component {
  id: string;
  name: string;
  description?: string;
  inputInstructions: string;
  operationInstructions: string;
  outputInstructions: string;
  config: ComponentConfig;
  tools: string[];
  onFailure: 'stop' | 'skip' | 'retry' | 'pause';
}

/**
 * Component execution configuration
 */
export interface ComponentConfig {
  modelId?: string;
  temperature?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  timeout?: number;
  maxRetries?: number;
  costLimit?: number;
}

/**
 * Workflow state from database
 */
export interface WorkflowState {
  id: string;
  workflowId: string;
  name: string;
  order: number;
  componentId?: string;
  component?: Component;
  preExecutionInstructions?: string;
  postExecutionInstructions?: string;
  requiresApproval: boolean;
  mandatory: boolean;
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  coordinatorId?: string;
  states: WorkflowState[];
}

/**
 * Story context for execution
 */
export interface StoryContext {
  id: string;
  key: string;
  title: string;
  description?: string;
  type: 'feature' | 'bug' | 'defect' | 'chore' | 'spike';
  status: string;
  epicId?: string;
  projectId: string;
  // Analysis fields
  architectAnalysis?: string;
  baAnalysis?: string;
  designerAnalysis?: string;
  contextExploration?: string;
}

/**
 * Workflow run status
 */
export type RunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

/**
 * Workflow run from database
 */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  storyId?: string;
  status: RunStatus;
  currentStateId?: string;
  runnerSessionId?: string;
  isPaused: boolean;
  pausedAt?: string;
  pauseReason?: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Component run tracking
 */
export interface ComponentRun {
  id: string;
  workflowRunId: string;
  componentId: string;
  executionOrder: number;
  status: RunStatus;
  startedAt?: string;
  finishedAt?: string;
  durationSeconds?: number;
  input?: unknown;
  output?: unknown;
  errorMessage?: string;
  tokensInput?: number;
  tokensOutput?: number;
}

/**
 * State execution result
 */
export interface StateExecutionResult {
  stateId: string;
  success: boolean;
  skipped: boolean;
  componentRunId?: string;
  output?: unknown;
  error?: string;
  durationMs: number;
  tokensUsed: number;
}
