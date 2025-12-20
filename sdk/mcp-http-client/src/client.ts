/**
 * MCP HTTP Client
 *
 * Production-ready HTTP client for MCP protocol with:
 * - Auto-reconnect with exponential backoff
 * - WebSocket real-time streaming
 * - Session management with heartbeat
 * - Comprehensive error handling
 */

import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import {
  McpHttpClientOptions,
  SessionResponse,
  ToolInfo,
  ToolResult,
  ToolEvent,
  EventCallbacks,
  ListToolsOptions,
  ConnectionState,
  ClientEvent,
  ClientEventType,
} from './types';

/**
 * MCP HTTP Client with auto-reconnect and real-time streaming
 */
export class McpHttpClient {
  private baseUrl: string;
  private apiKey: string;
  private sessionId: string | null = null;
  private socket: Socket | null = null;
  private httpClient: AxiosInstance;

  // WebSocket reconnection state
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly initialReconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // HTTP retry configuration (ST-171)
  private readonly maxHttpRetries: number;
  private readonly initialHttpRetryDelay: number;
  private readonly maxHttpRetryDelay: number;

  // Extended retry configuration (ST-171) - Long retry loop after initial retries fail
  private readonly extendedRetryAttempts: number;
  private readonly extendedRetryDelay: number;

  // Heartbeat state
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs: number;

  // Connection state
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  // Event callbacks
  private eventCallbacks: EventCallbacks = {};
  private clientEventListeners: Map<ClientEventType, ((event: ClientEvent) => void)[]> = new Map();

  // Debug mode
  private readonly debug: boolean;

  /**
   * Create a new MCP HTTP client
   *
   * @param options - Client configuration options
   */
  constructor(options: McpHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = options.apiKey;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.initialReconnectDelay = options.initialReconnectDelay ?? 1000;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
    this.heartbeatIntervalMs = options.heartbeatInterval ?? 60000; // 60s default
    this.debug = options.debug ?? false;

    // HTTP retry configuration (ST-171)
    this.maxHttpRetries = options.maxHttpRetries ?? 3;
    this.initialHttpRetryDelay = options.initialHttpRetryDelay ?? 1000;
    this.maxHttpRetryDelay = options.maxHttpRetryDelay ?? 10000;

    // Extended retry configuration (ST-171) - Long retry loop after initial retries fail
    this.extendedRetryAttempts = options.extendedRetryAttempts ?? 10;
    this.extendedRetryDelay = options.extendedRetryDelay ?? 30000; // 30 seconds

    // Create HTTP client with default headers
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 120 second timeout
    });

    this.log('Client initialized', { baseUrl: this.baseUrl });
  }

  /**
   * Initialize a new MCP session
   *
   * @param clientInfo - Client information string
   * @returns Session response with session ID
   */
  async initialize(clientInfo: string): Promise<SessionResponse> {
    this.log('Initializing session', { clientInfo });

    try {
      const response = await this.httpClient.post<SessionResponse>('/api/mcp/v1/initialize', {
        protocolVersion: 'mcp/1.0',
        clientInfo,
        capabilities: [],
      });

      this.sessionId = response.data.sessionId;
      this.log('Session initialized', { sessionId: this.sessionId });

      return response.data;
    } catch (error: any) {
      this.log('Session initialization failed', { error: error.message });
      throw this.handleHttpError(error);
    }
  }

  /**
   * Connect to WebSocket for real-time event streaming
   *
   * Establishes WebSocket connection and subscribes to session events.
   * Automatically reconnects on disconnect with exponential backoff.
   */
  connect(): void {
    // WebSocket disabled for now due to namespace handshake issues on Hostinger
    this.log('WebSocket connection disabled (using HTTP fallback)');
    return;
  }

  /**
   * Disconnect from WebSocket
   *
   * Cleanly disconnects and stops all reconnection attempts.
   */
  disconnect(): void {
    this.log('Disconnecting from WebSocket');

    // Clear reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionState = ConnectionState.DISCONNECTED;
  }

  /**
   * Handle WebSocket reconnection with exponential backoff
   *
   * @private
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached', { attempts: this.reconnectAttempts });
      this.connectionState = ConnectionState.FAILED;
      this.emitClientEvent('reconnect:failed', { attempts: this.reconnectAttempts });
      return;
    }

    this.connectionState = ConnectionState.RECONNECTING;
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    this.log('Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      delay,
      maxAttempts: this.maxReconnectAttempts,
    });

    this.emitClientEvent('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimeout = setTimeout(() => {
      this.log('Attempting reconnection', { attempt: this.reconnectAttempts });
      this.socket?.connect();
    }, delay);
  }

  /**
   * Subscribe to real-time tool events
   *
   * @param callbacks - Event callback functions
   */
  subscribeToEvents(callbacks: EventCallbacks): void {
    this.eventCallbacks = { ...this.eventCallbacks, ...callbacks };
    this.log('Subscribed to tool events', { callbacks: Object.keys(callbacks) });
  }

  /**
   * Unsubscribe from all tool events
   */
  unsubscribeFromEvents(): void {
    this.eventCallbacks = {};
    this.log('Unsubscribed from all tool events');
  }

  /**
   * Subscribe to client lifecycle events
   *
   * @param eventType - Client event type
   * @param callback - Event callback function
   */
  on(eventType: ClientEventType, callback: (event: ClientEvent) => void): void {
    if (!this.clientEventListeners.has(eventType)) {
      this.clientEventListeners.set(eventType, []);
    }
    this.clientEventListeners.get(eventType)!.push(callback);
    this.log('Subscribed to client event', { eventType });
  }

  /**
   * Unsubscribe from client lifecycle events
   *
   * @param eventType - Client event type
   * @param callback - Event callback function (if not provided, removes all listeners)
   */
  off(eventType: ClientEventType, callback?: (event: ClientEvent) => void): void {
    if (!callback) {
      this.clientEventListeners.delete(eventType);
      this.log('Removed all listeners', { eventType });
    } else {
      const listeners = this.clientEventListeners.get(eventType) ?? [];
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
        this.log('Removed listener', { eventType });
      }
    }
  }

  /**
   * Emit client lifecycle event
   *
   * @private
   */
  private emitClientEvent(type: ClientEventType, data: any): void {
    const event: ClientEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    const listeners = this.clientEventListeners.get(type) ?? [];
    listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error: any) {
        this.log('Error in client event listener', { type, error: error.message });
      }
    });
  }

  /**
   * Call an MCP tool
   *
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @returns Tool execution result
   */
  async callTool(toolName: string, args: Record<string, any> = {}): Promise<ToolResult> {
    this.ensureSession();

    this.log('Calling tool', { toolName, sessionId: this.sessionId });

    return this.executeWithRetry(
      async () => {
        const response = await this.httpClient.post<ToolResult>('/api/mcp/v1/call-tool', {
          sessionId: this.sessionId,
          toolName,
          arguments: args,
        });

        this.log('Tool call successful', { toolName });
        return response.data;
      },
      `callTool(${toolName})`,
      true // Can re-init session on auth errors
    );
  }

  /**
   * List available MCP tools
   *
   * @param options - List tools options
   * @returns Array of tool information
   */
  async listTools(options?: ListToolsOptions): Promise<ToolInfo[]> {
    this.ensureSession();

    this.log('Listing tools', { sessionId: this.sessionId, options });

    return this.executeWithRetry(
      async () => {
        const response = await this.httpClient.get<{ tools: ToolInfo[] }>('/api/mcp/v1/list-tools', {
          params: {
            sessionId: this.sessionId,
            ...options,
          },
        });

        const tools = response.data.tools || [];
        this.log('List tools successful', { count: tools.length });
        return tools;
      },
      'listTools',
      true // Can re-init session on auth errors
    );
  }

  /**
   * Send heartbeat to keep session alive
   *
   * Updates session timestamp and resets TTL.
   * Note: Heartbeats don't retry on 429 (rate limit) to prevent retry storms.
   */
  async heartbeat(): Promise<void> {
    this.ensureSession();

    this.log('Sending heartbeat', { sessionId: this.sessionId });

    return this.executeWithRetry(
      async () => {
        await this.httpClient.post(`/api/mcp/v1/session/${this.sessionId}/heartbeat`);
        this.log('Heartbeat successful');
      },
      'heartbeat',
      true, // Can re-init session on auth errors (will emit session:expired)
      [429] // Don't retry on rate limit (prevents retry storm with multiple clients)
    );
  }

  /**
   * Start automatic heartbeat
   *
   * Sends heartbeat at regular intervals to keep session alive.
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) {
      this.log('Heartbeat already running');
      return;
    }

    this.log('Starting heartbeat', { interval: this.heartbeatIntervalMs });

    this.heartbeatInterval = setInterval(() => {
      this.heartbeat().catch((error) => {
        this.log('Heartbeat error', { error: error.message });
      });
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop automatic heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.log('Heartbeat stopped');
    }
  }

  /**
   * Close session
   *
   * Closes the MCP session, stops heartbeat, and disconnects WebSocket.
   */
  async close(): Promise<void> {
    this.ensureSession();

    this.log('Closing session', { sessionId: this.sessionId });

    try {
      // Stop heartbeat
      this.stopHeartbeat();

      // Close session on server
      await this.httpClient.delete(`/api/mcp/v1/session/${this.sessionId}`);

      // Disconnect WebSocket
      this.disconnect();

      // Clear session ID
      this.sessionId = null;

      this.log('Session closed successfully');
    } catch (error: any) {
      this.log('Session close failed', { error: error.message });
      throw this.handleHttpError(error);
    }
  }

  /**
   * Get current connection state
   *
   * @returns Current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current session ID
   *
   * @returns Session ID or null if not initialized
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Ensure session is initialized
   *
   * @private
   * @throws Error if session is not initialized
   */
  private ensureSession(): void {
    if (!this.sessionId) {
      throw new Error('Session not initialized. Call initialize() first.');
    }
  }

  /**
   * Handle HTTP errors
   *
   * @private
   * @param error - Axios error
   * @returns Formatted error
   */
  private handleHttpError(error: any): Error {
    if (error.response) {
      // Server responded with error
      const status = error.response.status;
      const data = error.response.data?.error || error.response.data;

      if (status === 401) {
        return new Error(`Authentication failed: ${data.message || 'Invalid API key'}`);
      } else if (status === 403) {
        return new Error(`Access denied: ${data.message || 'Forbidden'}`);
      } else if (status === 404) {
        return new Error(`Not found: ${data.message || 'Resource not found'}`);
      } else if (status === 410) {
        return new Error(`Session expired: ${data.message || 'Session no longer exists'}`);
      } else if (status === 429) {
        return new Error(`Rate limit exceeded: ${data.message || 'Too many requests'}`);
      } else {
        return new Error(`Server error: ${data.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      // No response received
      return new Error(`Network error: ${error.message}`);
    } else {
      // Error setting up request
      return new Error(`Client error: ${error.message}`);
    }
  }

  /**
   * Debug logging
   *
   * @private
   */
  private log(message: string, data?: any): void {
    if (this.debug) {
      const timestamp = new Date().toISOString();
      const logLine = data
        ? `[${timestamp}] [McpHttpClient] ${message} ${JSON.stringify(data)}`
        : `[${timestamp}] [McpHttpClient] ${message}`;
      process.stderr.write(logLine + '\n');
    }
  }

  // ============================================================================
  // HTTP RETRY LOGIC (ST-171)
  // ============================================================================

  /**
   * Check if an error is retryable (transient failure)
   *
   * @private
   * @param error - Axios error
   * @param excludeStatuses - Status codes to exclude from retry (e.g., [429] for heartbeats)
   * @returns true if the error is retryable
   */
  private isRetryableError(error: any, excludeStatuses: number[] = []): boolean {
    // Network errors (no response received)
    if (!error.response) {
      const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'];
      return retryableCodes.includes(error.code);
    }

    // Server errors that are typically transient
    const retryableStatuses = [429, 502, 503, 504];
    const status = error.response?.status;

    // Exclude specified status codes from retry
    if (excludeStatuses.includes(status)) {
      return false;
    }

    return retryableStatuses.includes(status);
  }

  /**
   * Check if error requires session re-initialization
   *
   * @private
   * @param error - Axios error
   * @returns true if session needs re-initialization
   */
  private needsReInit(error: any): boolean {
    const reInitStatuses = [401, 410]; // Unauthorized or Gone (session expired)
    return reInitStatuses.includes(error.response?.status);
  }

  /**
   * Calculate retry delay with exponential backoff
   *
   * @private
   * @param attempt - Current attempt number (1-indexed)
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.initialHttpRetryDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.maxHttpRetryDelay);
  }

  /**
   * Sleep for specified milliseconds
   *
   * @private
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute initial retry attempts with exponential backoff
   *
   * @private
   * @param operation - Async operation to execute
   * @param operationName - Name for logging
   * @param canReInit - Whether to attempt session re-init on auth errors
   * @param excludeRetryStatuses - Status codes to exclude from retry
   * @returns Operation result or throws if all retries fail
   */
  private async executeInitialRetries<T>(
    operation: () => Promise<T>,
    operationName: string,
    canReInit: boolean,
    excludeRetryStatuses: number[] = []
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxHttpRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        this.log(`${operationName} failed`, {
          attempt,
          maxAttempts: this.maxHttpRetries,
          error: error.message,
          code: error.code,
          status: error.response?.status,
        });

        // Check if session needs re-initialization
        if (this.needsReInit(error) && canReInit) {
          this.log(`${operationName}: Session invalid, re-initializing...`);
          try {
            await this.initialize('re-init-after-error');
            // Retry immediately after re-init
            return await operation();
          } catch (reInitError: any) {
            this.log(`${operationName}: Re-initialization failed`, { error: reInitError.message });
            throw error; // Re-throw original error for extended retry handling
          }
        }

        // Check if error is retryable
        if (!this.isRetryableError(error, excludeRetryStatuses)) {
          this.log(`${operationName}: Non-retryable error, failing immediately`);
          throw this.handleHttpError(error);
        }

        // Don't retry if we've exhausted attempts
        if (attempt === this.maxHttpRetries) {
          throw error; // Re-throw for extended retry handling
        }

        // Calculate and apply delay
        const delay = this.calculateRetryDelay(attempt);
        this.log(`${operationName}: Retrying in ${delay}ms`, { attempt, nextAttempt: attempt + 1 });
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute HTTP operation with retry logic
   *
   * Implements two-tier retry strategy:
   * 1. Initial retries with exponential backoff (default: 3 attempts, 1s-10s delays)
   * 2. Extended retries with long delay (default: 10 rounds, 30s between rounds)
   *
   * Total resilience: up to 30+ attempts over ~5 minutes
   *
   * @private
   * @param operation - Async operation to execute
   * @param operationName - Name for logging
   * @param canReInit - Whether to attempt session re-init on auth errors
   * @param excludeRetryStatuses - Status codes to exclude from retry (e.g., [429] for heartbeats)
   * @returns Operation result
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    canReInit = false,
    excludeRetryStatuses: number[] = []
  ): Promise<T> {
    let lastError: any;

    // Extended retry loop - outer loop with long delays between rounds
    for (let extendedRound = 0; extendedRound <= this.extendedRetryAttempts; extendedRound++) {
      try {
        // First round (extendedRound=0) or subsequent rounds after 30s delay
        return await this.executeInitialRetries(operation, operationName, canReInit, excludeRetryStatuses);
      } catch (error: any) {
        lastError = error;

        // If error was already handled (non-retryable), re-throw
        if (error.message?.startsWith('Authentication failed:') ||
            error.message?.startsWith('Access denied:') ||
            error.message?.startsWith('Not found:')) {
          throw error;
        }

        // Check if we should enter extended retry mode
        if (extendedRound < this.extendedRetryAttempts && this.isRetryableError(error, excludeRetryStatuses)) {
          this.log(`${operationName}: Initial retries exhausted, entering extended retry mode`, {
            extendedRound: extendedRound + 1,
            maxExtendedRounds: this.extendedRetryAttempts,
            delaySeconds: this.extendedRetryDelay / 1000,
          });

          // Wait before next extended retry round
          await this.sleep(this.extendedRetryDelay);
          continue;
        }

        // All retries exhausted
        this.log(`${operationName}: All retry attempts exhausted`, {
          initialRetries: this.maxHttpRetries,
          extendedRounds: this.extendedRetryAttempts,
        });
        throw this.handleHttpError(error);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw this.handleHttpError(lastError);
  }
}
