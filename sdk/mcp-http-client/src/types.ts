/**
 * MCP HTTP Client Types
 *
 * TypeScript interfaces for MCP HTTP transport client SDK
 */

/**
 * Client configuration options
 */
export interface McpHttpClientOptions {
  /** Base URL of the MCP server (e.g., "https://vibestudio.example.com") */
  baseUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Enable auto-reconnect on WebSocket disconnect (default: true) */
  autoReconnect?: boolean;

  /** Maximum reconnection attempts for WebSocket (default: 10) */
  maxReconnectAttempts?: number;

  /** Initial reconnection delay in milliseconds (default: 1000) */
  initialReconnectDelay?: number;

  /** Maximum reconnection delay in milliseconds (default: 30000) */
  maxReconnectDelay?: number;

  /** Heartbeat interval in milliseconds (default: 60000) */
  heartbeatInterval?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  // HTTP Retry Configuration (ST-171)

  /** Maximum HTTP retry attempts for transient failures (default: 3) */
  maxHttpRetries?: number;

  /** Initial HTTP retry delay in milliseconds (default: 1000) */
  initialHttpRetryDelay?: number;

  /** Maximum HTTP retry delay in milliseconds (default: 10000) */
  maxHttpRetryDelay?: number;

  // Extended Retry Configuration (ST-171) - Long retry loop after initial retries fail

  /** Number of extended retry rounds after initial retries fail (default: 10) */
  extendedRetryAttempts?: number;

  /** Delay between extended retry rounds in milliseconds (default: 30000 = 30s) */
  extendedRetryDelay?: number;
}

/**
 * Session initialization response
 */
export interface SessionResponse {
  /** Unique session identifier */
  sessionId: string;

  /** Protocol version (e.g., "mcp/1.0") */
  protocolVersion: string;

  /** Server information */
  serverInfo: {
    name: string;
    version: string;
  };

  /** Server capabilities */
  capabilities: string[];

  /** Session expiration timestamp (ISO 8601) */
  expiresAt: string;
}

/**
 * Tool information
 */
export interface ToolInfo {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Tool category */
  category: string;

  /** Input schema (JSON Schema) */
  inputSchema: any;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Tool execution result data */
  result: any;

  /** Execution timestamp */
  timestamp: string;
}

/**
 * Tool event types
 */
export type ToolEventType = 'tool:start' | 'tool:progress' | 'tool:complete' | 'tool:error' | 'session:revoked';

/**
 * Tool event data
 */
export interface ToolEvent {
  /** Event type */
  type: ToolEventType;

  /** Session identifier */
  sessionId: string;

  /** Tool name */
  toolName?: string;

  /** Event timestamp */
  timestamp: string;

  /** Event payload */
  data: {
    /** Progress percentage (0-100) for progress events */
    progress?: number;

    /** Partial result for streaming output */
    partialResult?: any;

    /** Final result for complete events */
    result?: any;

    /** Error details for error events */
    error?: {
      code: string;
      message: string;
    };

    /** Message for generic events */
    message?: string;
  };
}

/**
 * Event callback functions
 */
export interface EventCallbacks {
  /** Called when tool execution starts */
  onToolStart?: (event: ToolEvent) => void;

  /** Called when tool execution progresses */
  onToolProgress?: (event: ToolEvent) => void;

  /** Called when tool execution completes */
  onToolComplete?: (event: ToolEvent) => void;

  /** Called when tool execution fails */
  onToolError?: (event: ToolEvent) => void;

  /** Called when session is revoked */
  onSessionRevoked?: (event: ToolEvent) => void;
}

/**
 * List tools options
 */
export interface ListToolsOptions {
  /** Filter by category */
  category?: string;

  /** Filter by detail level */
  detail_level?: 'names_only' | 'with_descriptions' | 'full_schema';

  /** Search query */
  query?: string;
}

/**
 * Connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

/**
 * Client event types
 */
export type ClientEventType =
  | 'connect'
  | 'disconnect'
  | 'reconnecting'
  | 'reconnect:failed'
  | 'session:expired'
  | 'session:revoked'
  | 'error';

/**
 * Client event data
 */
export interface ClientEvent {
  /** Event type */
  type: ClientEventType;

  /** Event timestamp */
  timestamp: string;

  /** Event data */
  data?: any;
}
