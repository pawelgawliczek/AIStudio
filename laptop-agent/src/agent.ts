import { io, Socket } from 'socket.io-client';
import { AgentConfig } from './config';
import { executeScript } from './scripts';

/**
 * Remote Agent
 *
 * WebSocket client that connects to VibeStudio backend
 * and executes approved scripts on demand.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Heartbeat monitoring
 * - JWT authentication
 * - Job execution with timeout
 */

export class RemoteAgent {
  private socket: Socket | null = null;
  private config: AgentConfig;
  private jwtToken: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second

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
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Reconnection failed - max attempts reached');
    });

    // Job assignment
    this.socket.on('agent:job', (job: any) => {
      console.log(`Received job: ${job.id} (${job.script})`);
      this.executeJob(job);
    });

    // Acknowledgement
    this.socket.on('agent:ack', (data: any) => {
      console.log(`Job ${data.jobId} acknowledged by server`);
    });
  }

  /**
   * Execute a job
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
   * Start heartbeat to maintain online status
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('agent:heartbeat');
      }
    }, 30000); // Every 30 seconds
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
