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

/**
 * ST-323: Upload batch and ACK types
 */

/**
 * Individual item in upload batch
 */
export interface UploadBatchItem {
  queueId: number;
  workflowRunId: string;
  componentRunId: string;
  transcriptPath: string;
  content: string;
  sequenceNumber: number;
  metadata?: Record<string, unknown>;
}

/**
 * Batch upload payload from laptop agent
 */
export interface UploadBatchPayload {
  agentId: string;
  items: UploadBatchItem[];
}

/**
 * Individual ACK item
 */
export interface ItemAckPayload {
  success: boolean;
  id: number;
  isDuplicate?: boolean;
  error?: string;
}

/**
 * Batch ACK response to laptop agent
 */
export interface UploadAckPayload {
  ids: number[];
}

/**
 * ST-326: Artifact upload types
 */
export interface ArtifactUploadItem {
  queueId: number;
  storyKey: string;
  artifactKey: string;
  filePath: string;
  content: string;
  contentType: string;
  timestamp: number;
}

export interface ArtifactUploadBatchPayload {
  agentId: string;
  items: ArtifactUploadItem[];
}

/**
 * ST-329: Transcript lines upload types
 */
export interface TranscriptLinesPayload {
  queueId: number;
  runId: string;
  sessionIndex: number;
  lines: Array<{ line: string; sequenceNumber: number }>;
  isHistorical: boolean;
  timestamp: string;
}

export interface TranscriptBatchPayload {
  queueId: number;
  runId: string;
  sessionIndex: number;
  lines: Array<{ line: string; sequenceNumber: number }>;
  isHistorical: boolean;
  timestamp: string;
}

/**
 * ST-363: Artifact move types
 */

/**
 * Request from backend to laptop-agent to move artifact directory
 */
export interface ArtifactMoveRequestPayload {
  requestId: string;
  storyKey: string;
  epicKey: string | null; // null = move to unassigned
  oldPath: string; // e.g., "docs/ST-123"
  newPath: string; // e.g., "docs/EP-1/ST-123" or "docs/unassigned/ST-123"
  timestamp: number;
}

/**
 * Confirmation from laptop-agent that move completed successfully
 */
export interface ArtifactMoveCompletePayload {
  requestId: string;
  storyKey: string;
  success: true;
  newPath: string;
  timestamp: number;
}

/**
 * Error from laptop-agent that move failed
 */
export interface ArtifactMoveFailedPayload {
  requestId: string;
  storyKey: string;
  success: false;
  error: string;
  timestamp: number;
}
