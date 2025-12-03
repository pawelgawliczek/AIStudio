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

  // Reconnection state
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly initialReconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private reconnectTimeout: NodeJS.Timeout | null = null;

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
    this.heartbeatIntervalMs = options.heartbeatInterval ?? 30000;
    this.debug = options.debug ?? false;

    // Create HTTP client with default headers
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
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
    if (this.socket?.connected) {
      this.log('Already connected to WebSocket');
      return;
    }

    this.log('Connecting to WebSocket', { namespace: '/mcp-stream' });
    this.connectionState = ConnectionState.CONNECTING;

    this.socket = io(`${this.baseUrl}/mcp-stream`, {
      auth: { apiKey: this.apiKey },
      transports: ['websocket', 'polling'],
      reconnection: false, // We handle reconnection manually
    });

    // Connection established
    this.socket.on('connect', () => {
      this.log('WebSocket connected', { socketId: this.socket?.id });
      this.connectionState = ConnectionState.CONNECTED;
      this.reconnectAttempts = 0;

      // Subscribe to session events
      if (this.sessionId && this.socket) {
        this.socket.emit('subscribe:session', this.sessionId);
        this.log('Subscribed to session', { sessionId: this.sessionId });
      }

      // Emit connect event
      this.emitClientEvent('connect', {});
    });

    // Disconnection
    this.socket.on('disconnect', (reason: string) => {
      this.log('WebSocket disconnected', { reason });
      this.connectionState = ConnectionState.DISCONNECTED;

      // Emit disconnect event
      this.emitClientEvent('disconnect', { reason });

      // Auto-reconnect if not a clean disconnect
      if (reason !== 'io client disconnect') {
        this.handleReconnect();
      }
    });

    // Connection error
    this.socket.on('connect_error', (error: Error) => {
      this.log('WebSocket connection error', { error: error.message });

      // Emit error event
      this.emitClientEvent('error', { error: error.message });

      // Handle reconnection
      this.handleReconnect();
    });

    // Tool events
    this.socket.on('tool:start', (event: ToolEvent) => {
      this.log('Tool start event', { toolName: event.toolName });
      this.eventCallbacks.onToolStart?.(event);
    });

    this.socket.on('tool:progress', (event: ToolEvent) => {
      this.log('Tool progress event', { toolName: event.toolName, progress: event.data.progress });
      this.eventCallbacks.onToolProgress?.(event);
    });

    this.socket.on('tool:complete', (event: ToolEvent) => {
      this.log('Tool complete event', { toolName: event.toolName });
      this.eventCallbacks.onToolComplete?.(event);
    });

    this.socket.on('tool:error', (event: ToolEvent) => {
      this.log('Tool error event', { toolName: event.toolName, error: event.data.error });
      this.eventCallbacks.onToolError?.(event);
    });

    // Session revocation
    this.socket.on('session:revoked', (event: ToolEvent) => {
      this.log('Session revoked', { message: event.data.message });
      this.eventCallbacks.onSessionRevoked?.(event);
      this.emitClientEvent('session:revoked', { message: event.data.message });
      this.disconnect();
    });

    // Generic error from server
    this.socket.on('error', (error: any) => {
      this.log('Server error', { error });
      this.emitClientEvent('error', { error });
    });
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

    try {
      const response = await this.httpClient.post<ToolResult>('/api/mcp/v1/call-tool', {
        sessionId: this.sessionId,
        toolName,
        arguments: args,
      });

      this.log('Tool call successful', { toolName });
      return response.data;
    } catch (error: any) {
      this.log('Tool call failed', { toolName, error: error.message });
      throw this.handleHttpError(error);
    }
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

    try {
      const response = await this.httpClient.get<ToolInfo[]>('/api/mcp/v1/list-tools', {
        params: {
          sessionId: this.sessionId,
          ...options,
        },
      });

      this.log('List tools successful', { count: response.data.length });
      return response.data;
    } catch (error: any) {
      this.log('List tools failed', { error: error.message });
      throw this.handleHttpError(error);
    }
  }

  /**
   * Send heartbeat to keep session alive
   *
   * Updates session timestamp and resets TTL.
   */
  async heartbeat(): Promise<void> {
    this.ensureSession();

    this.log('Sending heartbeat', { sessionId: this.sessionId });

    try {
      await this.httpClient.post(`/api/mcp/v1/session/${this.sessionId}/heartbeat`);
      this.log('Heartbeat successful');
    } catch (error: any) {
      this.log('Heartbeat failed', { error: error.message });

      // If session expired, emit event
      if (error.response?.status === 410) {
        this.emitClientEvent('session:expired', { sessionId: this.sessionId });
      }

      throw this.handleHttpError(error);
    }
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
      console.log(`[McpHttpClient] ${message}`, data || '');
    }
  }
}
