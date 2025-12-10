/**
 * WebSocket Orchestrator (ST-200 Phase 2)
 * Manages WebSocket communication with laptop agent for Master Session orchestration
 */

import { io, Socket } from 'socket.io-client';

/**
 * Configuration for WebSocket orchestrator
 */
export interface WebSocketOrchestratorConfig {
  serverUrl: string;
  apiKey: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

/**
 * Master session configuration
 */
export interface MasterSessionConfig {
  workflowRunId: string;
  projectPath: string;
  model: string;
  jobToken: string;
}

/**
 * Session metadata returned after starting
 */
export interface SessionMetadata {
  sessionId: string;
  transcriptPath: string;
  workflowRunId: string;
  pid: number;
}

/**
 * Command to send to Master Session
 */
export interface MasterCommand {
  workflowRunId: string;
  command: string;
  nonce: string;
}

/**
 * Response from Master Session
 */
export interface CommandResult {
  output: string;
  nonce: string;
  metrics?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Options for operations
 */
export interface OperationOptions {
  timeoutMs?: number;
}

/**
 * Stop session options
 */
export interface StopSessionOptions extends OperationOptions {
  forceKill?: boolean;
}

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

/**
 * WebSocket Orchestrator
 * Connects to laptop agent and orchestrates Master CLI sessions
 */
export class WebSocketOrchestrator {
  private config: WebSocketOrchestratorConfig;
  private socket: Socket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private activeSessions: Set<string> = new Set();

  // Pending operations (keyed by request ID or workflowRunId)
  private pendingOperations: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: WebSocketOrchestratorConfig) {
    this.config = config;
    this.maxReconnectAttempts = config.reconnectAttempts || 10;
    this.reconnectDelay = config.reconnectDelay || 5000;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(options?: OperationOptions): Promise<void> {
    if (this.connectionState === 'connected') {
      console.log('[WebSocketOrchestrator] Already connected');
      return;
    }

    const timeoutMs = options?.timeoutMs || 10000;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.cleanup();
        reject(new Error('Connection timeout'));
      }, timeoutMs);

      this.connectionState = 'connecting';
      console.log(`[WebSocketOrchestrator] Connecting to ${this.config.serverUrl}...`);

      this.socket = io(this.config.serverUrl, {
        auth: {
          apiKey: this.config.apiKey,
        },
        transports: ['websocket'],
        reconnection: false, // We handle reconnection manually
      });

      // Set up event listeners
      this.setupEventListeners();

      // Handle connection success
      this.socket.on('connect', () => {
        clearTimeout(timeoutHandle);
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        console.log('[WebSocketOrchestrator] Connected');
        resolve();
      });

      // Handle connection error
      this.socket.on('connect_error', (error: Error) => {
        clearTimeout(timeoutHandle);
        this.cleanup();
        this.connectionState = 'disconnected';
        console.error('[WebSocketOrchestrator] Connection error:', error.message);
        reject(error);
      });
    });
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Handle disconnect
    this.socket.on('disconnect', (reason: string) => {
      console.log(`[WebSocketOrchestrator] Disconnected: ${reason}`);
      this.connectionState = 'disconnected';

      // Reject all pending operations
      const pendingKeys = Array.from(this.pendingOperations.keys());
      for (const key of pendingKeys) {
        const pending = this.pendingOperations.get(key);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection lost'));
        }
      }
      this.pendingOperations.clear();

      // Attempt reconnection
      this.attemptReconnect();
    });

    // Handle master session started
    this.socket.on('agent:master_started', (response: any) => {
      console.log('[WebSocketOrchestrator] Master session started');
      this.resolvePending(response.workflowRunId, response);
    });

    // Handle master session response
    this.socket.on('agent:master_response', (response: any) => {
      console.log('[WebSocketOrchestrator] Master session response received');
      this.resolvePending(response.workflowRunId, response);
    });

    // Handle master session stopped
    this.socket.on('agent:master_stopped', (response: any) => {
      console.log('[WebSocketOrchestrator] Master session stopped');
      this.activeSessions.delete(response.workflowRunId);
      this.resolvePending(response.workflowRunId, response);
    });

    // Handle errors
    this.socket.on('agent:master_error', (error: any) => {
      console.error('[WebSocketOrchestrator] Master session error:', error.error);
      this.rejectPending(error.workflowRunId, new Error(error.error));
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocketOrchestrator] Max reconnect attempts reached');
      this.connectionState = 'failed';
      return;
    }

    this.connectionState = 'reconnecting';
    this.reconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    console.log(`[WebSocketOrchestrator] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.connectionState === 'reconnecting') {
        this.socket?.connect();
      }
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    if (!this.socket || this.connectionState === 'disconnected') {
      return;
    }

    console.log('[WebSocketOrchestrator] Disconnecting...');
    this.cleanup();
  }

  /**
   * Cleanup socket and pending operations
   */
  private cleanup(): void {
    if (this.socket) {
      this.socket.off(); // Remove all listeners
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear all pending operations
    const pendingKeys = Array.from(this.pendingOperations.keys());
    for (const key of pendingKeys) {
      const pending = this.pendingOperations.get(key);
      if (pending) {
        clearTimeout(pending.timeout);
      }
    }
    this.pendingOperations.clear();

    this.connectionState = 'disconnected';
  }

  /**
   * Start a Master Session on laptop
   */
  async startMasterSession(
    config: MasterSessionConfig,
    options?: OperationOptions
  ): Promise<SessionMetadata> {
    this.ensureConnected();

    const timeoutMs = options?.timeoutMs || 60000;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingOperations.delete(config.workflowRunId);
        reject(new Error('Master session start timeout'));
      }, timeoutMs);

      this.pendingOperations.set(config.workflowRunId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      console.log(`[WebSocketOrchestrator] Starting master session for run ${config.workflowRunId}`);
      this.socket!.emit('agent:master_start', config);
    });
  }

  /**
   * Send command to Master Session
   */
  async sendCommand(
    command: MasterCommand,
    options?: OperationOptions
  ): Promise<CommandResult> {
    this.ensureConnected();

    const timeoutMs = options?.timeoutMs || 300000; // 5 minutes default

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingOperations.delete(command.workflowRunId);
        reject(new Error('Command execution timeout'));
      }, timeoutMs);

      this.pendingOperations.set(command.workflowRunId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      console.log(`[WebSocketOrchestrator] Sending command to run ${command.workflowRunId}`);
      this.socket!.emit('agent:master_command', command);
    });
  }

  /**
   * Stop Master Session
   */
  async stopMasterSession(
    workflowRunId: string,
    options?: StopSessionOptions
  ): Promise<void> {
    this.ensureConnected();

    const timeoutMs = options?.timeoutMs || 10000;
    const forceKill = options?.forceKill ?? false;

    return new Promise((resolve, reject) => {
      let resolved = false;

      const timeoutHandle = setTimeout(async () => {
        if (resolved) return;

        if (forceKill) {
          console.log(`[WebSocketOrchestrator] Graceful shutdown timeout, force killing`);
          this.socket!.emit('agent:master_kill', {
            workflowRunId,
            signal: 'SIGKILL',
          });

          // Wait a bit for force kill to complete
          setTimeout(() => {
            this.pendingOperations.delete(workflowRunId);
            this.activeSessions.delete(workflowRunId);
            resolved = true;
            resolve();
          }, 2000);
        } else {
          this.pendingOperations.delete(workflowRunId);
          resolved = true;
          reject(new Error('Graceful shutdown timeout'));
        }
      }, timeoutMs);

      this.pendingOperations.set(workflowRunId, {
        resolve: () => {
          if (!resolved) {
            clearTimeout(timeoutHandle);
            resolved = true;
            resolve();
          }
        },
        reject: (error: Error) => {
          if (!resolved) {
            clearTimeout(timeoutHandle);
            resolved = true;
            reject(error);
          }
        },
        timeout: timeoutHandle,
      });

      console.log(`[WebSocketOrchestrator] Stopping master session ${workflowRunId}`);
      this.socket!.emit('agent:master_stop', { workflowRunId });
    });
  }

  /**
   * Resume an existing Master Session (ST-200 Phase 3 extension)
   */
  async resumeMasterSession(config: {
    sessionId: string;
    workflowRunId: string;
    projectPath: string;
    model: string;
  }): Promise<SessionMetadata> {
    this.ensureConnected();

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingOperations.delete(config.workflowRunId);
        reject(new Error('Master session resume timeout'));
      }, 60000);

      this.pendingOperations.set(config.workflowRunId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      console.log(`[WebSocketOrchestrator] Resuming master session ${config.sessionId}`);
      this.socket!.emit('agent:master_resume', config);
    });
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get list of active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions);
  }

  /**
   * Ensure we're connected, throw if not
   */
  private ensureConnected(): void {
    if (!this.socket || this.connectionState !== 'connected') {
      throw new Error('Not connected to WebSocket server');
    }
  }

  /**
   * Resolve a pending operation
   */
  private resolvePending(key: string, value: any): void {
    const pending = this.pendingOperations.get(key);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingOperations.delete(key);

      // Validate response format
      if (this.isValidResponse(value)) {
        pending.resolve(value);
      } else {
        pending.reject(new Error('Invalid response format'));
      }
    }
  }

  /**
   * Reject a pending operation
   */
  private rejectPending(key: string, error: Error): void {
    const pending = this.pendingOperations.get(key);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingOperations.delete(key);
      pending.reject(error);
    }
  }

  /**
   * Validate response has required fields
   */
  private isValidResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    // For session start responses
    if (response.sessionId !== undefined) {
      return true;
    }

    // For command responses
    if (response.output !== undefined || response.workflowRunId !== undefined) {
      return true;
    }

    return false;
  }
}
