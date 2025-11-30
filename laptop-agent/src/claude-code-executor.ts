import { spawn, ChildProcess } from 'child_process';
import { createHmac } from 'crypto';
import { EventEmitter } from 'events';

/**
 * ST-150: Claude Code Executor
 *
 * Executes Claude Code CLI on the local machine and streams
 * events back to the server via WebSocket.
 *
 * Features:
 * - Signature verification (HMAC)
 * - Streaming progress events
 * - Graceful shutdown
 * - Token metrics collection
 * - Transcript path tracking
 */

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
  | 'stream_end';

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
  error?: string;
}

/**
 * Event emitter interface for progress events
 */
export interface ClaudeCodeEvents {
  progress: (event: {
    type: ProgressEventType;
    sequenceNumber: number;
    payload: Record<string, unknown>;
  }) => void;
  complete: (result: ExecutionResult) => void;
  error: (error: Error) => void;
}

export class ClaudeCodeExecutor extends EventEmitter {
  private agentSecret: string;
  private projectPath: string;
  private claudeCodePath: string;
  private process: ChildProcess | null = null;
  private sequenceNumber = 0;
  private outputBuffer = '';
  private transcriptPath: string | null = null;
  private totalTokens = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private cacheCreationTokens = 0;
  private cacheReadTokens = 0;

  constructor(config: {
    agentSecret: string;
    projectPath: string;
    claudeCodePath?: string;
  }) {
    super();
    this.agentSecret = config.agentSecret;
    this.projectPath = config.projectPath;
    this.claudeCodePath = config.claudeCodePath || 'claude';
  }

  /**
   * Verify job signature (HMAC)
   */
  verifySignature(job: ClaudeCodeJobPayload): boolean {
    const payload = JSON.stringify({
      id: job.id,
      componentId: job.componentId,
      stateId: job.stateId,
      instructions: job.instructions,
      timestamp: job.timestamp,
    });

    const expectedSignature = createHmac('sha256', this.agentSecret)
      .update(payload)
      .digest('hex');

    return job.signature === expectedSignature;
  }

  /**
   * Execute Claude Code CLI with the given job
   */
  async execute(job: ClaudeCodeJobPayload): Promise<ExecutionResult> {
    // Verify signature
    if (!this.verifySignature(job)) {
      throw new Error('Invalid job signature - possible tampering');
    }

    // Check timestamp (reject if too old - 5 minutes)
    const age = Date.now() - job.timestamp;
    if (age > 5 * 60 * 1000) {
      throw new Error(`Job timestamp too old (${age}ms) - possible replay attack`);
    }

    // Reset state
    this.sequenceNumber = 0;
    this.outputBuffer = '';
    this.transcriptPath = null;
    this.totalTokens = 0;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.cacheCreationTokens = 0;
    this.cacheReadTokens = 0;

    // Build Claude Code command
    const args = this.buildClaudeCodeArgs(job);
    const projectPath = job.config.projectPath || this.projectPath;

    console.log(`[ST-150] Executing Claude Code: ${this.claudeCodePath} ${args.join(' ')}`);
    console.log(`[ST-150] Project path: ${projectPath}`);

    return new Promise((resolve, reject) => {
      // Spawn Claude Code process
      this.process = spawn(this.claudeCodePath, args, {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Ensure Claude Code runs in non-interactive mode
          CI: 'true',
          CLAUDE_CODE_NON_INTERACTIVE: 'true',
        },
      });

      // Handle stdout (main output + streaming)
      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleStdout(data.toString());
      });

      // Handle stderr (progress, errors)
      this.process.stderr?.on('data', (data: Buffer) => {
        this.handleStderr(data.toString());
      });

      // Handle process exit
      this.process.on('close', (code) => {
        console.log(`[ST-150] Claude Code exited with code: ${code}`);

        const result: ExecutionResult = {
          success: code === 0,
          output: this.outputBuffer.trim(),
          metrics: {
            inputTokens: this.inputTokens,
            outputTokens: this.outputTokens,
            cacheCreationTokens: this.cacheCreationTokens,
            cacheReadTokens: this.cacheReadTokens,
            totalTokens: this.totalTokens,
          },
          transcriptPath: this.transcriptPath || undefined,
          error: code !== 0 ? `Process exited with code ${code}` : undefined,
        };

        // Emit stream_end event
        this.emitProgress('stream_end', {
          success: result.success,
          metrics: result.metrics,
        });

        this.emit('complete', result);
        resolve(result);
      });

      // Handle process error
      this.process.on('error', (error) => {
        console.error(`[ST-150] Claude Code process error:`, error);
        this.emit('error', error);
        reject(error);
      });

      // Write instructions to stdin (Claude Code prompt)
      if (this.process.stdin) {
        this.process.stdin.write(job.instructions);
        this.process.stdin.end();
      }
    });
  }

  /**
   * Build command line arguments for Claude Code
   */
  private buildClaudeCodeArgs(job: ClaudeCodeJobPayload): string[] {
    const args: string[] = [
      '--print', // Output result only
      '--output-format', 'stream-json', // Streaming JSON output
    ];

    // Model selection
    if (job.config.model) {
      args.push('--model', job.config.model);
    }

    // Max turns
    if (job.config.maxTurns) {
      args.push('--max-turns', String(job.config.maxTurns));
    }

    // Allowed tools
    if (job.config.allowedTools && job.config.allowedTools.length > 0) {
      args.push('--allowedTools', job.config.allowedTools.join(','));
    }

    // Prompt (via --prompt flag or stdin)
    // We use stdin for the prompt to avoid shell escaping issues
    args.push('--prompt', '-'); // Read prompt from stdin

    return args;
  }

  /**
   * Handle stdout data (main output)
   */
  private handleStdout(data: string): void {
    // Accumulate output
    this.outputBuffer += data;

    // Try to parse streaming JSON events
    const lines = data.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);
        this.handleStreamEvent(event);
      } catch {
        // Not JSON, just raw output - skip
      }
    }
  }

  /**
   * Handle stderr data (progress, errors)
   */
  private handleStderr(data: string): void {
    console.error(`[ST-150] Claude Code stderr:`, data);

    // Look for token usage patterns
    const tokenMatch = data.match(
      /Tokens:\s*(\d+)\s*in\s*\+\s*(\d+)\s*out\s*=\s*(\d+)\s*total/
    );
    if (tokenMatch) {
      this.inputTokens = parseInt(tokenMatch[1], 10);
      this.outputTokens = parseInt(tokenMatch[2], 10);
      this.totalTokens = parseInt(tokenMatch[3], 10);

      this.emitProgress('token_update', {
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        totalTokens: this.totalTokens,
      });
    }

    // Look for cache usage
    const cacheMatch = data.match(
      /Cache:\s*(\d+)\s*created\s*\+\s*(\d+)\s*read/
    );
    if (cacheMatch) {
      this.cacheCreationTokens = parseInt(cacheMatch[1], 10);
      this.cacheReadTokens = parseInt(cacheMatch[2], 10);
    }

    // Look for transcript path
    const transcriptMatch = data.match(/Transcript:\s*(.+\.jsonl)/);
    if (transcriptMatch) {
      this.transcriptPath = transcriptMatch[1];
    }
  }

  /**
   * Handle streaming JSON event from Claude Code
   */
  private handleStreamEvent(event: Record<string, unknown>): void {
    const eventType = event.type as string;

    switch (eventType) {
      case 'tool_use':
        this.emitProgress('tool_call', {
          toolName: event.name,
          toolInput: event.input,
        });
        break;

      case 'tool_result':
        this.emitProgress('tool_result', {
          toolName: event.toolName,
          output: event.output,
          success: event.success,
        });
        break;

      case 'text':
        // Periodic text output - could emit as activity
        break;

      case 'usage':
        // Token usage update
        const usage = event.usage as Record<string, number> | undefined;
        if (usage) {
          this.inputTokens = usage.input_tokens || 0;
          this.outputTokens = usage.output_tokens || 0;
          this.cacheCreationTokens = usage.cache_creation_input_tokens || 0;
          this.cacheReadTokens = usage.cache_read_input_tokens || 0;
          this.totalTokens = this.inputTokens + this.outputTokens;

          this.emitProgress('token_update', {
            inputTokens: this.inputTokens,
            outputTokens: this.outputTokens,
            cacheCreationTokens: this.cacheCreationTokens,
            cacheReadTokens: this.cacheReadTokens,
            totalTokens: this.totalTokens,
          });
        }
        break;

      case 'error':
        console.error(`[ST-150] Claude Code error event:`, event.error);
        break;

      default:
        // Other event types - emit as activity change
        if (eventType) {
          this.emitProgress('activity_change', {
            activity: eventType,
            details: event,
          });
        }
    }
  }

  /**
   * Emit a progress event
   */
  private emitProgress(type: ProgressEventType, payload: Record<string, unknown>): void {
    this.sequenceNumber++;
    this.emit('progress', {
      type,
      sequenceNumber: this.sequenceNumber,
      payload,
    });
  }

  /**
   * Stop the running process (graceful shutdown)
   */
  stop(): void {
    if (this.process) {
      console.log('[ST-150] Stopping Claude Code process...');

      // Try graceful SIGTERM first
      this.process.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log('[ST-150] Force killing Claude Code process...');
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  /**
   * Check if Claude Code CLI is available
   */
  static async checkAvailability(
    claudeCodePath: string = 'claude'
  ): Promise<{ available: boolean; version?: string }> {
    return new Promise((resolve) => {
      const process = spawn(claudeCodePath, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let version = '';

      process.stdout?.on('data', (data: Buffer) => {
        version += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && version.trim()) {
          resolve({
            available: true,
            version: version.trim(),
          });
        } else {
          resolve({ available: false });
        }
      });

      process.on('error', () => {
        resolve({ available: false });
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!process.killed) {
          process.kill();
          resolve({ available: false });
        }
      }, 5000);
    });
  }
}
