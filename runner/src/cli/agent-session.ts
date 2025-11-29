/**
 * Agent Session
 * Manages short-lived Claude Code CLI sessions for component execution
 * Each workflow state spawns a new agent with tool restrictions
 */

import { spawn, ChildProcess } from 'child_process';
import { StreamParser, TokenMetrics } from './stream-parser';
import { AgentConfig, DEFAULT_AGENT_CONFIG } from '../types';

/**
 * Result from agent execution
 */
export interface AgentResult {
  /** Whether execution was successful */
  success: boolean;
  /** Exit code from Claude Code process */
  exitCode: number | null;
  /** Text output from agent */
  output: string;
  /** Token usage metrics */
  metrics: TokenMetrics;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Options for agent session
 */
export interface AgentSessionOptions {
  /** Working directory for Claude Code */
  workingDirectory: string;
  /** Component ID being executed */
  componentId: string;
  /** State ID being executed */
  stateId: string;
  /** Allowed MCP tools (restricts agent capabilities) */
  allowedTools?: string[];
  /** Model to use */
  model?: string;
  /** Maximum turns for agent */
  maxTurns?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Story context for agent prompt */
  storyContext?: {
    storyId: string;
    title: string;
    description?: string;
  };
}

/**
 * Agent CLI Session
 * Short-lived Claude Code process for component execution
 */
export class AgentSession {
  private options: AgentSessionOptions;
  private config: AgentConfig;
  private process: ChildProcess | null = null;
  private streamParser: StreamParser;
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor(options: AgentSessionOptions, config: AgentConfig = DEFAULT_AGENT_CONFIG) {
    this.options = {
      timeout: config.defaultTimeout,
      maxTurns: config.maxTurns,
      ...options,
    };
    this.config = config;
    this.streamParser = new StreamParser();
  }

  /**
   * Execute the agent with given instructions
   * Returns when agent completes or times out
   */
  async execute(instructions: string): Promise<AgentResult> {
    if (this.isRunning) {
      throw new Error('Agent session already running');
    }

    this.startTime = Date.now();
    this.isRunning = true;
    this.streamParser.clear();

    const args = this.buildArgs();
    console.log(`[AgentSession] Starting agent for component: ${this.options.componentId}`);
    console.log(`[AgentSession] Command: claude ${args.join(' ')}`);

    return new Promise((resolve) => {
      // Spawn the Claude Code process
      this.process = spawn('claude', args, {
        cwd: this.options.workingDirectory,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CLAUDE_CODE_ENABLE_TELEMETRY: '1',
        },
      });

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (this.isRunning) {
          console.warn(`[AgentSession] Timeout reached (${this.options.timeout}ms), killing process`);
          this.kill();
          resolve(this.createResult(false, null, 'Agent execution timed out'));
        }
      }, this.options.timeout);

      // Handle stdout (JSONL stream)
      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        this.streamParser.append(text);
        this.streamParser.parseBuffer();
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        console.error(`[AgentSession] stderr: ${text}`);
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        clearTimeout(timeoutHandle);
        this.isRunning = false;

        console.log(`[AgentSession] Process exited with code: ${code}`);

        const success = code === 0;
        resolve(this.createResult(success, code, success ? undefined : `Agent exited with code ${code}`));
      });

      // Handle process error
      this.process.on('error', (error) => {
        clearTimeout(timeoutHandle);
        this.isRunning = false;

        console.error(`[AgentSession] Process error:`, error);
        resolve(this.createResult(false, null, error.message));
      });

      // Send instructions via stdin and close
      const prompt = this.buildPrompt(instructions);
      console.log(`[AgentSession] Sending prompt (${prompt.length} chars)`);

      this.process.stdin?.write(prompt);
      this.process.stdin?.end();
    });
  }

  /**
   * Build CLI arguments for agent process
   */
  private buildArgs(): string[] {
    const args = [
      '--output-format', 'stream-json',
      '--yes-always',
      '--print', // Non-interactive mode, single execution
    ];

    if (this.options.maxTurns) {
      args.push('--max-turns', this.options.maxTurns.toString());
    }

    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    // Add tool restrictions if specified
    if (this.options.allowedTools && this.options.allowedTools.length > 0) {
      args.push('--allowedTools', this.options.allowedTools.join(','));
    }

    return args;
  }

  /**
   * Build the prompt with context
   */
  private buildPrompt(instructions: string): string {
    const parts: string[] = [];

    // Add story context if available
    if (this.options.storyContext) {
      parts.push(`# Story Context`);
      parts.push(`Story ID: ${this.options.storyContext.storyId}`);
      parts.push(`Title: ${this.options.storyContext.title}`);
      if (this.options.storyContext.description) {
        parts.push(`Description: ${this.options.storyContext.description}`);
      }
      parts.push('');
    }

    // Add component context
    parts.push(`# Execution Context`);
    parts.push(`Component ID: ${this.options.componentId}`);
    parts.push(`State ID: ${this.options.stateId}`);
    parts.push('');

    // Add instructions
    parts.push(`# Instructions`);
    parts.push(instructions);

    return parts.join('\n');
  }

  /**
   * Create result object
   */
  private createResult(success: boolean, exitCode: number | null, error?: string): AgentResult {
    const durationMs = Date.now() - this.startTime;
    const output = this.streamParser.extractTextContent();
    const metrics = this.streamParser.calculateMetrics();

    return {
      success,
      exitCode,
      output,
      metrics,
      durationMs,
      error,
    };
  }

  /**
   * Kill the agent process immediately
   */
  kill(): void {
    if (this.process) {
      console.log(`[AgentSession] Killing agent process`);
      this.process.kill('SIGTERM');

      // Force kill after grace period
      setTimeout(() => {
        if (this.process && this.isRunning) {
          this.process.kill('SIGKILL');
        }
      }, 5000);

      this.isRunning = false;
    }
  }

  /**
   * Check if agent is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get component ID
   */
  getComponentId(): string {
    return this.options.componentId;
  }

  /**
   * Get state ID
   */
  getStateId(): string {
    return this.options.stateId;
  }

  /**
   * Get current duration in milliseconds
   */
  getCurrentDuration(): number {
    if (!this.isRunning) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Get parsed records so far
   */
  getRecords() {
    return this.streamParser.getRecords();
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): TokenMetrics {
    return this.streamParser.calculateMetrics();
  }
}

/**
 * Factory function to create agent session with defaults
 */
export function createAgentSession(
  workingDirectory: string,
  componentId: string,
  stateId: string,
  options?: Partial<AgentSessionOptions>
): AgentSession {
  return new AgentSession({
    workingDirectory,
    componentId,
    stateId,
    ...options,
  });
}
