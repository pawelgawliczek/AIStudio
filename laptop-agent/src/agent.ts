import { io, Socket } from 'socket.io-client';
import {
  ClaudeCodeExecutor,
  ClaudeCodeJobPayload,
  ExecutionResult,
} from './claude-code-executor';
import { AgentConfig } from './config';
import { executeGitCommand, checkGitAvailable, GitExecutionResult } from './git-executor';
import { Logger } from './logger';
import { executeScript } from './scripts';
import { TranscriptTailer, TailRequest } from './transcript-tailer';
import { TranscriptWatcher } from './transcript-watcher';
import { WakeDetector } from './wake-detector';
import { ArtifactWatcher } from './artifact-watcher';
import { UploadManager } from './upload-manager';

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

  // ST-281: Wake detector for hibernation recovery
  private wakeDetector: WakeDetector | null = null;

  // ST-327: Upload manager for guaranteed delivery
  private uploadManager: UploadManager | null = null;

  // ST-327: Artifact watcher for story artifacts
  private artifactWatcher: ArtifactWatcher | null = null;

  // ST-281: Logger for structured logging
  private readonly logger = new Logger('Agent');

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
      timeout: 60000, // 60s to handle longer MCP operations
    });

    // Setup event handlers
    this.setupEventHandlers();

    // ST-281: Start wake detection for hibernation recovery
    this.wakeDetector = new WakeDetector();
    this.wakeDetector.onWakeDetected = () => this.handleWakeFromHibernation();
    this.wakeDetector.start();

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

          // ST-327: Initialize UploadManager with socket and agentId
          this.uploadManager = new UploadManager({
            socket: this.socket!,
            agentId: data.agentId,
          });
          console.log('[ST-327] UploadManager initialized');

          // ST-170: Start transcript watcher if capability enabled
          if (this.config.capabilities.includes('watch-transcripts')) {
            this.startTranscriptWatcher().catch((err) => {
              console.error('Failed to start transcript watcher:', err.message);
            });
          }

          // ST-327: Start artifact watcher if UploadManager is available
          if (this.uploadManager) {
            this.startArtifactWatcher().catch((err) => {
              console.error('[ST-327] Failed to start artifact watcher:', err.message);
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

      // Fast path for exec-command: run git directly instead of through tsx
      if (script === 'exec-command') {
        const result = await this.executeGitCommandDirectly(params);
        if (result.success) {
          this.socket!.emit('agent:result', {
            jobId: id,
            status: 'completed',
            result: result.result,
          });
          console.log(`Job ${id} completed successfully (direct git)`);
        } else {
          this.socket!.emit('agent:result', {
            jobId: id,
            status: 'failed',
            error: result.error,
          });
          console.error(`Job ${id} failed: ${result.error}`);
        }
        return;
      }

      const result = await executeScript(
        this.config.projectPath,
        script,
        params,
        30000
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
   * Execute git command directly (fast path for exec-command)
   * This avoids the tsx overhead that causes hangs in daemon context
   */
  private async executeGitCommandDirectly(params: string[]): Promise<{ success: boolean; result?: any; error?: string }> {
    // Parse params to get --command= and --cwd= values
    let command = '';
    let cwd = this.config.projectPath;

    for (const param of params) {
      if (param.startsWith('--command=')) {
        command = param.slice('--command='.length);
      } else if (param.startsWith('--cwd=')) {
        cwd = param.slice('--cwd='.length);
      }
    }

    if (!command) {
      return { success: false, error: 'Missing --command parameter' };
    }

    // Security: Only allow whitelisted git commands
    const allowedPatterns = [
      /^git diff(\s|$)/,
      /^git status(\s|$)/,
      /^git rev-parse(\s|$)/,
    ];

    if (!allowedPatterns.some(pattern => pattern.test(command))) {
      return { success: false, error: `Command not whitelisted: ${command.split(' ')[0]}` };
    }

    // Parse command into executable and args
    const parts = command.split(/\s+/);
    const executable = parts[0];
    const args = parts.slice(1);

    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const startTime = Date.now();

      const proc = spawn(executable, args, {
        cwd,
        timeout: 10000,
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        const elapsed = Date.now() - startTime;
        console.log(`[exec-command] git exited with code ${code} after ${elapsed}ms`);
        resolve({
          success: true,
          result: {
            stdout,
            stderr,
            exitCode: code ?? 0,
            command: executable,
          },
        });
      });

      proc.on('error', (error: Error) => {
        resolve({
          success: false,
          error: `Command execution failed: ${error.message}`,
        });
      });
    });
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

    // ST-281: Stop wake detector
    if (this.wakeDetector) {
      this.wakeDetector.stop();
      this.wakeDetector = null;
    }

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

    // ST-327: Stop artifact watcher
    if (this.artifactWatcher) {
      this.artifactWatcher.stop().catch((err) => {
        console.error('[ST-327] Error stopping artifact watcher:', err.message);
      });
      this.artifactWatcher = null;
    }

    // ST-327: Stop upload manager
    if (this.uploadManager) {
      this.uploadManager.stop().catch((err) => {
        console.error('[ST-327] Error stopping upload manager:', err.message);
      });
      this.uploadManager = null;
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
   * ST-327: Start artifact watcher daemon
   */
  private async startArtifactWatcher(): Promise<void> {
    console.log('[ST-327] Starting artifact watcher...');

    if (!this.uploadManager) {
      console.error('[ST-327] Cannot start artifact watcher - UploadManager not initialized');
      return;
    }

    // Create artifact watcher with UploadManager reference
    this.artifactWatcher = new ArtifactWatcher({
      uploadManager: this.uploadManager,
      projectPath: this.config.projectPath,
    });

    // Start watching
    await this.artifactWatcher.start();

    console.log('[ST-327] Artifact watcher started successfully');
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

  /**
   * ST-281: Verify connection health with server ping
   */
  private async verifyConnectionHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.warn('Health check timed out', { timeoutMs: 5000 });
        resolve(false);
      }, 5000);

      this.socket?.emit('agent:ping', {}, (response: any) => {
        clearTimeout(timeout);
        const healthy = response?.pong === true;
        this.logger.info('Health check completed', { healthy, response });
        resolve(healthy);
      });
    });
  }

  /**
   * ST-281: Force reconnection after detecting unhealthy connection
   */
  private async forceReconnect(): Promise<void> {
    this.logger.info('Forcing reconnection due to unhealthy connection');
    this.stopHeartbeat();
    this.wakeDetector?.stop();
    this.socket?.disconnect();

    // Small delay to ensure clean disconnect
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.connect();
    this.logger.info('Reconnection completed');
  }

  /**
   * ST-281: Handle wake from hibernation
   */
  private async handleWakeFromHibernation(): Promise<void> {
    this.logger.info('Wake from hibernation detected, checking connection health');

    const healthy = await this.verifyConnectionHealth();
    if (!healthy) {
      this.logger.warn('Connection unhealthy after wake, forcing reconnect');
      await this.forceReconnect();
    } else {
      this.logger.info('Connection healthy after wake, no action needed');
    }
  }
}
