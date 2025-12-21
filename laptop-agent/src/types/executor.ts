import { EventEmitter } from 'events';

/**
 * ST-381: Agent execution types
 */
export type ExecutionType = 'custom' | 'native_explore' | 'native_plan' | 'native_general';

/**
 * ST-381: Native agent configuration
 */
export interface NativeAgentConfig {
  questionTimeout?: number;  // Timeout for question response (ms)
  maxQuestions?: number;     // Max questions per execution
  allowedTools?: string[];   // Override tools for native agent
}

/**
 * Job payload from server
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
    // ST-160: Native subagent support
    executionType?: ExecutionType;
    nativeAgentConfig?: NativeAgentConfig;
  };
  signature: string;
  timestamp: number;
  jobToken: string;
}

/**
 * Progress event types
 */
export type ProgressEventType =
  | 'token_update'
  | 'tool_call'
  | 'tool_result'
  | 'activity_change'
  | 'stream_end'
  | 'question_detected'  // ST-160: Agent is asking a question
  | 'session_init';       // ST-160: Session ID captured from init message

/**
 * Execution result
 */
export interface ExecutionResult {
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
  // ST-160: Session tracking for resume support
  sessionId?: string;
  error?: string;
}

/**
 * ST-381: Generic Agent Executor Interface
 * Extends EventEmitter to support streaming progress events.
 */
export interface IAgentExecutor extends EventEmitter {
  execute(job: ClaudeCodeJobPayload): Promise<ExecutionResult>;
  resumeWithAnswer(
    sessionId: string,
    answer: string,
    originalJob: ClaudeCodeJobPayload
  ): Promise<ExecutionResult>;
  stop(): void;
}
