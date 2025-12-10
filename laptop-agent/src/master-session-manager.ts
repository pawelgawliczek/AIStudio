/**
 * Master Session Manager - Phase 1 (ST-200)
 *
 * Manages persistent Claude CLI Master Sessions on laptop agent.
 * Supports multi-command execution, session resume, and crash recovery.
 */

import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { generateNonce, validateNonce, sanitizeError } from './security/sanitization';

export interface MasterSessionConfig {
  workflowRunId: string;
  projectPath: string;
  model: string;
  sessionId?: string; // For resume
}

export interface SessionMetadata {
  sessionId: string;
  transcriptPath: string;
  workflowRunId: string;
  pid: number;
}

export interface CommandOptions {
  timeoutMs?: number;
}

export interface CommandResult {
  output: string;
  nonce?: string;
}

interface SessionInfo {
  process: ChildProcess;
  sessionId: string;
  transcriptPath: string;
  workflowRunId: string;
  pid: number;
  lastError?: string;
}

export class MasterSessionManager {
  private sessions: Map<string, SessionInfo> = new Map();

  /**
   * Start a new Master Session with Claude CLI
   */
  async startSession(config: MasterSessionConfig): Promise<SessionMetadata> {
    if (this.sessions.has(config.workflowRunId)) {
      throw new Error(`Session already exists for workflow run: ${config.workflowRunId}`);
    }

    const sessionId = uuidv4();
    const args = [
      '--session-id', sessionId,
      '--output-format', 'stream-json',
      '--model', config.model,
      '--verbose',
    ];

    return new Promise((resolve, reject) => {
      const process = spawn('claude', args, {
        cwd: config.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let transcriptPath = `/tmp/claude-transcript-${sessionId}.jsonl`; // Default

      // Handle process errors
      const errorHandler = (error: Error) => {
        this.sessions.delete(config.workflowRunId); // Cleanup on error
        reject(error);
      };

      process.on('error', errorHandler);

      // Create session info immediately
      const sessionInfo: SessionInfo = {
        process,
        sessionId,
        transcriptPath,
        workflowRunId: config.workflowRunId,
        pid: process.pid!,
      };

      this.sessions.set(config.workflowRunId, sessionInfo);

      // Monitor stdout for transcript path (async, doesn't block resolve)
      process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        const match = output.match(/Transcript: (.+\.jsonl)/);
        if (match) {
          sessionInfo.transcriptPath = match[1];
        }
      });

      // Monitor stderr for errors
      process.stderr?.on('data', (data: Buffer) => {
        sessionInfo.lastError = sanitizeError(data.toString());
      });

      // Resolve immediately (session is started, transcript path will update async)
      resolve({
        sessionId,
        transcriptPath,
        workflowRunId: config.workflowRunId,
        pid: process.pid!,
      });
    });
  }

  /**
   * Resume an existing Master Session
   */
  async resumeSession(config: MasterSessionConfig): Promise<SessionMetadata> {
    if (this.sessions.has(config.workflowRunId)) {
      throw new Error(`Session already exists for workflow run: ${config.workflowRunId}`);
    }

    if (!config.sessionId) {
      throw new Error('sessionId is required for resume');
    }

    const args = [
      '--resume', config.sessionId,
      '--model', config.model,
    ];

    return new Promise((resolve, reject) => {
      const process = spawn('claude', args, {
        cwd: config.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let transcriptPath = `/tmp/claude-transcript-${config.sessionId}.jsonl`; // Default

      // Handle process errors
      const errorHandler = (error: Error) => {
        this.sessions.delete(config.workflowRunId); // Cleanup on error
        reject(error);
      };

      process.on('error', errorHandler);

      // Create session info immediately
      const sessionInfo: SessionInfo = {
        process,
        sessionId: config.sessionId!,
        transcriptPath,
        workflowRunId: config.workflowRunId,
        pid: process.pid!,
      };

      this.sessions.set(config.workflowRunId, sessionInfo);

      // Monitor stdout for transcript path (async)
      process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        const match = output.match(/Transcript: (.+\.jsonl)/);
        if (match) {
          sessionInfo.transcriptPath = match[1];
        }
      });

      // Monitor stderr for errors
      process.stderr?.on('data', (data: Buffer) => {
        sessionInfo.lastError = sanitizeError(data.toString());
      });

      // Resolve immediately
      resolve({
        sessionId: config.sessionId!,
        transcriptPath,
        workflowRunId: config.workflowRunId,
        pid: process.pid!,
      });
    });
  }

  /**
   * Send command to Master Session and wait for response
   */
  async sendCommand(
    workflowRunId: string,
    command: string,
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    const session = this.sessions.get(workflowRunId);
    if (!session) {
      throw new Error(`Session not found for workflow run: ${workflowRunId}`);
    }

    const nonce = generateNonce();
    const commandWithNonce = `${command}\n\n[NONCE:${nonce}]\n`;
    const timeoutMs = options.timeoutMs || 60000;

    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      let responseReceived = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          session.process.stdout?.removeListener('data', stdoutHandler);
          session.process.removeListener('exit', exitHandler);
          reject(new Error(`Command timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Capture response from stdout
      const stdoutHandler = (data: Buffer) => {
        outputBuffer += data.toString();

        // Check if response contains nonce (indicates completion)
        if (outputBuffer.includes('[NONCE:')) {
          responseReceived = true;
          clearTimeout(timeout);

          // Validate nonce
          const validation = validateNonce(outputBuffer, nonce);
          if (!validation.valid) {
            session.process.stdout?.removeListener('data', stdoutHandler);
            session.process.removeListener('exit', exitHandler);
            reject(new Error(`Response nonce mismatch - possible forgery`));
            return;
          }

          session.process.stdout?.removeListener('data', stdoutHandler);
          session.process.removeListener('exit', exitHandler);

          resolve({
            output: outputBuffer,
            nonce: validation.extractedNonce,
          });
        }
      };

      // Handle process crashes during command
      const exitHandler = (code: number | null, signal: string | null) => {
        if (!responseReceived) {
          clearTimeout(timeout);
          session.process.stdout?.removeListener('data', stdoutHandler);
          session.process.removeListener('exit', exitHandler);
          reject(new Error(`Process crashed with code ${code}, signal ${signal}`));
        }
      };

      session.process.stdout?.on('data', stdoutHandler);
      session.process.on('exit', exitHandler);

      // Send command to stdin
      try {
        session.process.stdin?.write(commandWithNonce);
      } catch (error) {
        clearTimeout(timeout);
        session.process.stdout?.removeListener('data', stdoutHandler);
        session.process.removeListener('exit', exitHandler);
        reject(error);
      }
    });
  }

  /**
   * Stop Master Session gracefully (SIGTERM)
   */
  async stopSession(workflowRunId: string, options: { timeoutMs?: number } = {}): Promise<void> {
    const session = this.sessions.get(workflowRunId);
    if (!session) {
      return; // Already stopped or never existed
    }

    const timeoutMs = options.timeoutMs || 5000;

    return new Promise((resolve) => {
      let gracefulShutdown = false;

      // Set up force kill timeout
      const timeout = setTimeout(() => {
        if (!gracefulShutdown) {
          session.process.kill('SIGKILL');
          this.sessions.delete(workflowRunId);
          resolve();
        }
      }, timeoutMs);

      // Wait for graceful exit
      const exitHandler = () => {
        gracefulShutdown = true;
        clearTimeout(timeout);
        this.sessions.delete(workflowRunId);
        resolve();
      };

      session.process.on('exit', exitHandler);

      // Send SIGTERM
      session.process.kill('SIGTERM');
    });
  }

  /**
   * List all active sessions
   */
  listSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).map(session => ({
      sessionId: session.sessionId,
      transcriptPath: session.transcriptPath,
      workflowRunId: session.workflowRunId,
      pid: session.pid,
    }));
  }

  /**
   * Get specific session metadata
   */
  getSession(workflowRunId: string): (SessionMetadata & { lastError?: string }) | undefined {
    const session = this.sessions.get(workflowRunId);
    if (!session) {
      return undefined;
    }

    return {
      sessionId: session.sessionId,
      transcriptPath: session.transcriptPath,
      workflowRunId: session.workflowRunId,
      pid: session.pid,
      lastError: session.lastError,
    };
  }
}
