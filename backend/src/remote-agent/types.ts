/**
 * Remote job result types
 */
export interface RemoteJobResult {
  status: 'completed' | 'failed' | 'timeout';
  result?: unknown;
  error?: string;
}

export interface AgentJob {
  id: string;
  script?: string;
  params?: Record<string, unknown> | string[];
  jobToken?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface TranscriptDetectionPayload {
  agentId: string | null;
  transcriptPath: string;
  projectPath: string;
  metadata?: Record<string, unknown>;
}

/**
 * ST-160: Native subagent execution types
 */
export type ExecutionType = 'custom' | 'native_explore' | 'native_plan' | 'native_general';

/**
 * ST-160: Native agent configuration
 */
export interface NativeAgentConfig {
  questionTimeout?: number;
  maxQuestions?: number;
  allowedTools?: string[];
}

/**
 * ST-150: Claude Code job payload sent to laptop agent
 * ST-160: Added executionType and nativeAgentConfig
 */
export interface ClaudeCodeJobPayload {
  id: string;
  componentId: string;
  stateId: string;
  workflowRunId: string;
  instructions: string;
  config: {
    storyContext?: Record<string, unknown>;
    allowedTools?: string[];
    model?: string;
    maxTurns?: number;
    projectPath?: string;
    executionType?: ExecutionType;
    nativeAgentConfig?: NativeAgentConfig;
  };
  signature: string;
  timestamp: number;
  jobToken: string;
}

/**
 * ST-150: Progress event from laptop agent
 * ST-160: Added session_init and question_detected event types
 */
export interface ClaudeCodeProgressEvent {
  jobId: string;
  jobToken: string;
  type: 'token_update' | 'tool_call' | 'tool_result' | 'activity_change' | 'stream_end'
    | 'session_init' | 'question_detected';
  payload: Record<string, unknown>;
  timestamp: number;
  sequenceNumber: number;
}

/**
 * ST-150: Completion event from laptop agent
 */
export interface ClaudeCodeCompleteEvent {
  jobId: string;
  jobToken: string;
  success: boolean;
  output?: unknown;
  metrics?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    totalTokens: number;
  };
  transcriptPath?: string;
  sessionId?: string;
  error?: string;
}

/**
 * ST-153: Git job payload sent to laptop agent
 */
export interface GitJobPayload {
  id: string;
  command: string;
  cwd: string;
  timeout?: number;
}

/**
 * ST-153: Git job result from laptop agent
 */
export interface GitResultEvent {
  jobId: string;
  status: 'completed' | 'failed';
  output?: string;
  operation?: string;
  exitCode?: number;
  error?: string;
}
