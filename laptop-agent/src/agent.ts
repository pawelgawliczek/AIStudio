import { io, Socket } from 'socket.io-client';
import { AgentConfig } from './config';
import { executeScript } from './scripts';
import {
  ClaudeCodeExecutor,
  ClaudeCodeJobPayload,
  ExecutionResult,
} from './claude-code-executor';

/**
 * Remote Agent
 * ST-133: Script Execution
 * ST-150: Claude Code Agent Execution
 *
 * WebSocket client that connects to VibeStudio backend
 * and executes approved scripts and Claude Code agents on demand.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Heartbeat monitoring (tiered: 5s during execution, 30s idle)
 * - JWT authentication
 * - Job execution with timeout
 * - Claude Code agent execution with streaming progress
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

  constructor(config: AgentConfig) {
    this.config = config;
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
   * Register agent with server using pre-shared secret
   */
  private async register(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket!.emit(
        'agent:register',
        {
          secret: this.config.agentSecret,
          hostname: this.config.hostname,
          capabilities: this.config.capabilities,
          claudeCodeVersion: this.claudeCodeVersion || undefined, // ST-150
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

    // Resume acknowledgment
    this.socket.on('agent:resume_ack', (data: any) => {
      console.log(`Resume acknowledged for job ${data.jobId}`);
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
}
