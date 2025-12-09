import { io, Socket } from 'socket.io-client';
import { AgentConfig } from './config';
import { executeScript } from './scripts';
import {
  ClaudeCodeExecutor,
  ClaudeCodeJobPayload,
  ExecutionResult,
} from './claude-code-executor';
import { executeGitCommand, checkGitAvailable, GitExecutionResult } from './git-executor';
import { TranscriptWatcher } from './transcript-watcher';
import { TranscriptTailer, TailRequest } from './transcript-tailer';

/**
 * ST-153: Git job payload from server
 */
export interface GitJobPayload {
  id: string;
  command: string; // Full git command (e.g., "git status --porcelain")
  cwd: string; // Working directory (worktree path)
  timeout?: number;
}

/**
 * Remote Agent
 * ST-133: Script Execution
 * ST-150: Claude Code Agent Execution
 * ST-153: Git Command Execution
 *
 * WebSocket client that connects to VibeStudio backend
 * and executes approved scripts, Claude Code agents, and git commands on demand.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Heartbeat monitoring (tiered: 5s during execution, 30s idle)
 * - JWT authentication
 * - Job execution with timeout
 * - Claude Code agent execution with streaming progress
 * - Git command execution with whitelist validation
 */

export class RemoteAgent {
  private socket: Socket | null = null;
  private config: AgentConfig;
  private jwtToken: string | null = null;
  private agentId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second

  // ST-150: Claude Code execution
  private claudeCodeExecutor: ClaudeCodeExecutor | null = null;
  private claudeCodeVersion: string | null = null;
  private currentClaudeJob: ClaudeCodeJobPayload | null = null;
  private isExecutingClaudeCode = false;

  // ST-153: Git execution
  private gitVersion: string | null = null;

  // ST-170: Transcript watcher
  private transcriptWatcher: TranscriptWatcher | null = null;

  // ST-182: Transcript tailer for live streaming
  private transcriptTailer: TranscriptTailer | null = null;

  constructor(config: AgentConfig) {
    this.config = config;

    // ST-182: Add tail-file capability (always available on laptop)
    if (!this.config.capabilities.includes('tail-file')) {
      this.config.capabilities.push('tail-file');
    }
  }

  /**
   * Connect to server and register agent
   */
  async connect(): Promise<void> {
    const serverUrl = this.config.serverUrl;
    const namespace = '/remote-agent';

    console.log(`Connecting to ${serverUrl}${namespace}...`);

    // ST-150: Check if Claude Code is available
    await this.checkClaudeCodeAvailability();

    // ST-153: Check if git is available
    this.checkGitAvailability();

    this.socket = io(`${serverUrl}${namespace}`, {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.baseReconnectDelay,
      reconnectionDelayMax: 30000, // 30 seconds
      timeout: 20000,
    });

    // Setup event handlers
    this.setupEventHandlers();

    // Wait for connection
    return new Promise((resolve, reject) => {
      this.socket!.on('connect', () => {
        console.log('Connected to server');
        this.register()
          .then(() => resolve())
          .catch((err) => reject(err));
      });

      this.socket!.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        reject(error);
      });
    });
  }

  /**
   * ST-150: Check if Claude Code CLI is available
   */
  private async checkClaudeCodeAvailability(): Promise<void> {
    const { available, version } = await ClaudeCodeExecutor.checkAvailability();

    if (available) {
      this.claudeCodeVersion = version || 'unknown';
      console.log(`Claude Code available: ${this.claudeCodeVersion}`);

      // Initialize executor
      this.claudeCodeExecutor = new ClaudeCodeExecutor({
        agentSecret: this.config.agentSecret,
        projectPath: this.config.projectPath,
      });

      // Add claude-code to capabilities if not present
      if (!this.config.capabilities.includes('claude-code')) {
        this.config.capabilities.push('claude-code');
      }
    } else {
      console.log('Claude Code CLI not available');
      // Remove claude-code from capabilities
      this.config.capabilities = this.config.capabilities.filter(
        (c) => c !== 'claude-code'
      );
    }
  }

  /**
   * ST-153: Check if git is available
   */
  private checkGitAvailability(): void {
    const { available, version } = checkGitAvailable();

    if (available) {
      this.gitVersion = version || 'unknown';
      console.log(`Git available: ${this.gitVersion}`);

      // Add git-execute to capabilities if not present
      if (!this.config.capabilities.includes('git-execute')) {
        this.config.capabilities.push('git-execute');
      }
    } else {
      console.log('Git not available');
      // Remove git-execute from capabilities
      this.config.capabilities = this.config.capabilities.filter(
        (c) => c !== 'git-execute'
      );
    }
  }

  /**
   * Register agent with server using pre-shared secret
   * ST-158: Include projectPath and worktreeRoot for MCP orchestration
   */
  private async register(): Promise<void> {
    // ST-158: Calculate worktree root path
    const worktreeRoot = `${this.config.projectPath}/worktrees`;

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        'agent:register',
        {
          secret: this.config.agentSecret,
          hostname: this.config.hostname,
          capabilities: this.config.capabilities,
          claudeCodeVersion: this.claudeCodeVersion || undefined, // ST-150
          // ST-158: Include paths for MCP-orchestrated worktree creation
          config: {
            projectPath: this.config.projectPath,
            worktreeRoot,
          },
        },
        (response: any) => {
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }
        }
      );

      // Listen for registration response
      this.socket!.once('agent:registered', (data: any) => {
        if (data.success) {
          this.jwtToken = data.token;
          this.agentId = data.agentId;
          console.log(`Agent registered successfully. ID: ${data.agentId}`);
          this.startHeartbeat();

          // ST-170: Start transcript watcher if capability enabled
          if (this.config.capabilities.includes('watch-transcripts')) {
            this.startTranscriptWatcher().catch((err) => {
              console.error('Failed to start transcript watcher:', err.message);
            });
          }

          resolve();
        } else {
          reject(new Error('Registration failed'));
        }
      });

      this.socket!.once('agent:error', (data: any) => {
        reject(new Error(data.error || 'Registration failed'));
      });
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.log(`Disconnected: ${reason}`);
      this.stopHeartbeat();
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      this.reconnectAttempts = 0;
      this.register().catch((err) => {
        console.error('Re-registration failed:', err.message);
      });

      // ST-182: Update TranscriptTailer socket reference after reconnection
      if (this.transcriptTailer && this.socket) {
        this.transcriptTailer.updateSocket(this.socket);
      }

      // ST-150: Check if we have a job that needs resuming
      if (this.currentClaudeJob && this.isExecutingClaudeCode) {
        this.notifyResumeAvailable();
      }
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Reconnection failed - max attempts reached');
    });

    // Script job assignment (ST-133)
    this.socket.on('agent:job', (job: any) => {
      console.log(`Received script job: ${job.id} (${job.script})`);
      this.executeJob(job);
    });

    // ST-150: Claude Code job assignment
    this.socket.on('agent:claude_job', (job: ClaudeCodeJobPayload) => {
      console.log(`Received Claude Code job: ${job.id}`);
      this.executeClaudeCodeJob(job);
    });

    // ST-153: Git job assignment
    this.socket.on('agent:git_job', (job: GitJobPayload) => {
      console.log(`Received git job: ${job.id} (${job.command})`);
      this.executeGitJob(job);
    });

    // ST-182: Transcript tail requests
    this.socket.on('transcript:start_tail', (request: TailRequest) => {
      console.log(`[ST-182] Received tail request for ${request.runId}:${request.sessionIndex}`);
      this.handleStartTail(request);
    });

    this.socket.on('transcript:stop_tail', (data: { runId: string; sessionIndex: number }) => {
      console.log(`[ST-182] Received stop tail request for ${data.runId}:${data.sessionIndex}`);
      this.handleStopTail(data.runId, data.sessionIndex);
    });

    // Resume acknowledgment
    this.socket.on('agent:resume_ack', (data: any) => {
      console.log(`Resume acknowledged for job ${data.jobId}`);
    });

    // ST-160: Resume with answer - server sends answer for pending question
    this.socket.on('agent:resume_with_answer', (data: {
      sessionId: string;
      answer: string;
      questionId: string;
      jobId: string;
    }) => {
      console.log(`[ST-160] Received answer for question ${data.questionId} (job ${data.jobId})`);
      this.handleResumeWithAnswer(data);
    });

    // Acknowledgement
    this.socket.on('agent:ack', (data: any) => {
      console.log(`Job ${data.jobId} acknowledged by server`);
    });
  }

  /**
   * ST-150: Notify server that we can resume a job after reconnection
   */
  private notifyResumeAvailable(): void {
    if (!this.currentClaudeJob || !this.socket) return;

    console.log(`Notifying server of resume availability for job ${this.currentClaudeJob.id}`);

    this.socket.emit('agent:resume_available', {
      jobId: this.currentClaudeJob.id,
      jobToken: this.currentClaudeJob.jobToken,
      lastSequence: 0, // Claude Code executor tracks this internally
    });
  }

  /**
   * ST-160: Handle resume with answer from server
   * Resumes a paused Claude Code session with the provided answer
   */
  private async handleResumeWithAnswer(data: {
    sessionId: string;
    answer: string;
    questionId: string;
    jobId: string;
  }): Promise<void> {
    if (!this.claudeCodeExecutor) {
      console.error(`[ST-160] Claude Code not available - cannot resume`);
      return;
    }

    // Verify this is for our current job
    if (!this.currentClaudeJob || this.currentClaudeJob.id !== data.jobId) {
      console.warn(`[ST-160] Resume request for unknown job ${data.jobId}`);
      return;
    }

    console.log(`[ST-160] Resuming session ${data.sessionId} with answer`);

    try {
      // Resume the session with the answer
      const result = await this.claudeCodeExecutor.resumeWithAnswer(
        data.sessionId,
        data.answer,
        this.currentClaudeJob
      );

      console.log(`[ST-160] Resume completed: success=${result.success}`);

      // Send completion event
      this.socket!.emit('agent:claude_complete', {
        jobId: data.jobId,
        jobToken: this.currentClaudeJob.jobToken,
        success: result.success,
        output: result.output,
        metrics: result.metrics,
        transcriptPath: result.transcriptPath,
        error: result.error,
      });
    } catch (error: any) {
      console.error(`[ST-160] Resume error:`, error);

      this.socket!.emit('agent:claude_complete', {
        jobId: data.jobId,
        jobToken: this.currentClaudeJob.jobToken,
        success: false,
        error: error.message,
      });
    } finally {
      // Cleanup
      this.claudeCodeExecutor.removeAllListeners('progress');
      this.currentClaudeJob = null;
      this.isExecutingClaudeCode = false;

      // Switch back to slower heartbeat
      this.startHeartbeat(30000);
    }
  }

  /**
   * Execute a script job (ST-133)
   */
  private async executeJob(job: any): Promise<void> {
    const { id, script, params } = job;

    try {
      console.log(`Executing: ${script} ${params.join(' ')}`);

      const result = await executeScript(
        this.config.projectPath,
        script,
        params,
        30000 // 30 second timeout
      );

      // Send result to server
      if (result.success) {
        this.socket!.emit('agent:result', {
          jobId: id,
          status: 'completed',
          result: result.result,
        });
        console.log(`Job ${id} completed successfully`);
      } else {
        this.socket!.emit('agent:result', {
          jobId: id,
          status: 'failed',
          error: result.error,
        });
        console.error(`Job ${id} failed: ${result.error}`);
      }
    } catch (error: any) {
      this.socket!.emit('agent:result', {
        jobId: id,
        status: 'failed',
        error: error.message,
      });
      console.error(`Job ${id} execution error:`, error.message);
    }
  }

  /**
   * ST-150: Execute a Claude Code job
   */
  private async executeClaudeCodeJob(job: ClaudeCodeJobPayload): Promise<void> {
    if (!this.claudeCodeExecutor) {
      console.error(`Claude Code not available - cannot execute job ${job.id}`);
      this.socket!.emit('agent:claude_complete', {
        jobId: job.id,
        jobToken: job.jobToken,
        success: false,
        error: 'Claude Code CLI not available on this agent',
      });
      return;
    }

    if (this.isExecutingClaudeCode) {
      console.error(`Already executing a Claude Code job - rejecting ${job.id}`);
      this.socket!.emit('agent:claude_complete', {
        jobId: job.id,
        jobToken: job.jobToken,
        success: false,
        error: 'Agent is already executing another Claude Code job',
      });
      return;
    }

    try {
      this.currentClaudeJob = job;
      this.isExecutingClaudeCode = true;

      // Switch to faster heartbeat during execution
      this.startHeartbeat(5000); // 5 second heartbeat during execution

      console.log(`[ST-150] Starting Claude Code execution for job ${job.id}`);

      // Setup progress event forwarding
      this.claudeCodeExecutor.on('progress', (event) => {
        this.socket!.emit('agent:claude_progress', {
          jobId: job.id,
          jobToken: job.jobToken,
          type: event.type,
          payload: event.payload,
          timestamp: Date.now(),
          sequenceNumber: event.sequenceNumber,
        });
      });

      // Execute
      const result = await this.claudeCodeExecutor.execute(job);

      console.log(`[ST-150] Claude Code execution completed for job ${job.id}: success=${result.success}`);

      // Send completion event
      this.socket!.emit('agent:claude_complete', {
        jobId: job.id,
        jobToken: job.jobToken,
        success: result.success,
        output: result.output,
        metrics: result.metrics,
        transcriptPath: result.transcriptPath,
        sessionId: result.sessionId, // ST-195: Include actual sessionId for transcript matching
        error: result.error,
      });
    } catch (error: any) {
      console.error(`[ST-150] Claude Code execution error for job ${job.id}:`, error);

      this.socket!.emit('agent:claude_complete', {
        jobId: job.id,
        jobToken: job.jobToken,
        success: false,
        error: error.message,
      });
    } finally {
      // Cleanup
      this.claudeCodeExecutor.removeAllListeners('progress');
      this.currentClaudeJob = null;
      this.isExecutingClaudeCode = false;

      // Switch back to slower heartbeat
      this.startHeartbeat(30000);
    }
  }

  /**
   * ST-153: Execute a git job
   */
  private async executeGitJob(job: GitJobPayload): Promise<void> {
    const { id, command, cwd, timeout } = job;

    try {
      console.log(`[ST-153] Executing git command: ${command}`);
      console.log(`[ST-153] Working directory: ${cwd}`);

      const result = executeGitCommand(command, cwd, timeout);

      if (result.success) {
        this.socket!.emit('agent:git_result', {
          jobId: id,
          status: 'completed',
          output: result.output,
          operation: result.operation,
        });
        console.log(`[ST-153] Git job ${id} completed successfully`);
      } else {
        this.socket!.emit('agent:git_result', {
          jobId: id,
          status: 'failed',
          error: result.error,
          output: result.output,
          exitCode: result.exitCode,
        });
        console.error(`[ST-153] Git job ${id} failed: ${result.error}`);
      }
    } catch (error: any) {
      this.socket!.emit('agent:git_result', {
        jobId: id,
        status: 'failed',
        error: error.message,
      });
      console.error(`[ST-153] Git job ${id} execution error:`, error.message);
    }
  }

  /**
   * Start heartbeat to maintain online status
   * ST-150: Tiered heartbeat - 5s during execution, 30s idle
   */
  private startHeartbeat(intervalMs: number = 30000): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('agent:heartbeat');
      }
    }, intervalMs);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.stopHeartbeat();

    // ST-170: Stop transcript watcher
    if (this.transcriptWatcher) {
      this.transcriptWatcher.stop().catch((err) => {
        console.error('Error stopping transcript watcher:', err.message);
      });
      this.transcriptWatcher = null;
    }

    // ST-182: Stop transcript tailer
    if (this.transcriptTailer) {
      this.transcriptTailer.stopAll().catch((err) => {
        console.error('Error stopping transcript tailer:', err.message);
      });
      this.transcriptTailer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    console.log('Agent disconnected');
  }

  /**
   * Check if agent is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * ST-170: Start transcript watcher daemon
   */
  private async startTranscriptWatcher(): Promise<void> {
    console.log('[ST-170] Starting transcript watcher...');

    // Create transcript watcher using existing WebSocket connection
    this.transcriptWatcher = new TranscriptWatcher({
      socket: this.socket!,  // Reuse existing authenticated WebSocket
      projectPath: this.config.projectPath,
    });

    // Start watching
    await this.transcriptWatcher.start();

    console.log('[ST-170] Transcript watcher started successfully');
  }

  /**
   * ST-182: Handle start tail request
   */
  private async handleStartTail(request: TailRequest): Promise<void> {
    // Initialize tailer if not already
    if (!this.transcriptTailer && this.socket) {
      this.transcriptTailer = new TranscriptTailer(this.socket);
      console.log('[ST-182] TranscriptTailer initialized');
    }

    if (!this.transcriptTailer) {
      console.error('[ST-182] Cannot start tail - no socket connection');
      return;
    }

    try {
      await this.transcriptTailer.startTailing(request);
    } catch (error: any) {
      console.error('[ST-182] Failed to start tailing:', error.message);
    }
  }

  /**
   * ST-182: Handle stop tail request
   */
  private async handleStopTail(runId: string, sessionIndex: number): Promise<void> {
    if (!this.transcriptTailer) {
      return;
    }

    try {
      await this.transcriptTailer.stopTailing(runId, sessionIndex);
    } catch (error: any) {
      console.error('[ST-182] Failed to stop tailing:', error.message);
    }
  }
}
