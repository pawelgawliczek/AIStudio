/**
 * Master Session
 * Manages a persistent Claude Code CLI session for pre/post execution instructions
 */

import { spawn, ChildProcess } from 'child_process';
import { MasterResponse, DEFAULT_MASTER_RESPONSE } from '../types';
import { StreamParser } from './stream-parser';

/**
 * Options for master session
 */
export interface MasterSessionOptions {
  /** Session ID for persistence (--session-id) */
  sessionId: string;
  /** Working directory for Claude Code */
  workingDirectory: string;
  /** Maximum turns */
  maxTurns?: number;
  /** Model to use */
  model?: string;
  /** Timeout for responses in milliseconds */
  timeout?: number;
}

/**
 * Master CLI Session
 * Persistent Claude Code process for executing pre/post instructions
 */
export class MasterSession {
  private options: MasterSessionOptions;
  private process: ChildProcess | null = null;
  private streamParser: StreamParser;
  private isRunning: boolean = false;
  private responsePromise: {
    resolve: (response: MasterResponse) => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(options: MasterSessionOptions) {
    this.options = {
      timeout: 300000, // 5 minutes default
      ...options,
    };
    this.streamParser = new StreamParser();
  }

  /**
   * Start a new master session
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Master session already running');
    }

    console.log(`[MasterSession] Starting session: ${this.options.sessionId}`);

    const args = this.buildStartArgs();
    await this.spawnProcess(args);

    // Send initial prompt to establish session
    const initPrompt = `You are the Story Runner Master session.
Your role is to execute pre/post instructions for workflow states.
After each instruction, you MUST respond with a JSON block in this exact format:

\`\`\`json:master-response
{
  "action": "proceed",
  "status": "success",
  "message": "Ready to execute instructions"
}
\`\`\`

Acknowledge this by responding with the JSON block now.`;

    await this.execute(initPrompt);
    console.log(`[MasterSession] Session initialized`);
  }

  /**
   * Resume an existing session
   */
  async resume(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Master session already running');
    }

    console.log(`[MasterSession] Resuming session: ${this.options.sessionId}`);

    const args = this.buildResumeArgs();
    await this.spawnProcess(args);

    console.log(`[MasterSession] Session resumed`);
  }

  /**
   * Build CLI args for starting a new session
   */
  private buildStartArgs(): string[] {
    const args = [
      '--session-id', this.options.sessionId,
      '--output-format', 'stream-json',
      '--yes-always',
    ];

    if (this.options.maxTurns) {
      args.push('--max-turns', this.options.maxTurns.toString());
    }

    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    return args;
  }

  /**
   * Build CLI args for resuming a session
   */
  private buildResumeArgs(): string[] {
    return [
      '--resume', this.options.sessionId,
      '--output-format', 'stream-json',
      '--yes-always',
    ];
  }

  /**
   * Spawn the Claude Code process
   */
  private async spawnProcess(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[MasterSession] Spawning: claude ${args.join(' ')}`);

      this.process = spawn('claude', args, {
        cwd: this.options.workingDirectory,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CLAUDE_CODE_ENABLE_TELEMETRY: '1',
        },
      });

      this.isRunning = true;

      // Handle stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        this.streamParser.append(text);

        // Check if we have a complete response
        if (this.responsePromise && this.streamParser.hasCompleteResponse()) {
          const response = this.streamParser.extractMasterResponse();
          this.streamParser.clear();
          this.responsePromise.resolve(response);
          this.responsePromise = null;
        }
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        console.error(`[MasterSession] stderr: ${text}`);
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        console.log(`[MasterSession] Process exited with code: ${code}`);
        this.isRunning = false;

        if (this.responsePromise) {
          this.responsePromise.reject(new Error(`Master session exited with code: ${code}`));
          this.responsePromise = null;
        }
      });

      // Handle process error
      this.process.on('error', (error) => {
        console.error(`[MasterSession] Process error:`, error);
        this.isRunning = false;
        reject(error);
      });

      // Wait for process to be ready (first output)
      const readyTimeout = setTimeout(() => {
        if (this.isRunning) {
          resolve();
        }
      }, 2000);

      this.process.stdout?.once('data', () => {
        clearTimeout(readyTimeout);
        resolve();
      });
    });
  }

  /**
   * Execute an instruction and wait for MasterResponse
   */
  async execute(instruction: string): Promise<MasterResponse> {
    if (!this.isRunning || !this.process) {
      throw new Error('Master session not running');
    }

    // Clear previous buffer
    this.streamParser.clear();

    return new Promise((resolve, reject) => {
      // Set up response promise
      this.responsePromise = { resolve, reject };

      // Set up timeout
      const timeout = setTimeout(() => {
        if (this.responsePromise) {
          console.warn('[MasterSession] Response timeout, using default response');
          this.responsePromise.resolve(DEFAULT_MASTER_RESPONSE);
          this.responsePromise = null;
        }
      }, this.options.timeout);

      // Override resolve to clear timeout
      const originalResolve = resolve;
      this.responsePromise.resolve = (response: MasterResponse) => {
        clearTimeout(timeout);
        originalResolve(response);
      };

      // Send instruction to stdin
      console.log(`[MasterSession] Sending instruction (${instruction.length} chars)`);
      this.process!.stdin?.write(instruction + '\n');
    });
  }

  /**
   * Stop the master session gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.process) {
      return;
    }

    console.log(`[MasterSession] Stopping session`);

    return new Promise((resolve) => {
      // Send exit command
      this.process!.stdin?.write('/exit\n');
      this.process!.stdin?.end();

      // Wait for graceful exit
      const killTimeout = setTimeout(() => {
        if (this.process && this.isRunning) {
          console.log(`[MasterSession] Force killing process`);
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process!.on('exit', () => {
        clearTimeout(killTimeout);
        this.isRunning = false;
        resolve();
      });
    });
  }

  /**
   * Kill the session immediately
   */
  kill(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.isRunning = false;
    }
  }

  /**
   * Check if session is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.options.sessionId;
  }
}
