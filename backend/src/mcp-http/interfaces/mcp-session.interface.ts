/**
 * MCP Session Interface (Task 1.3, 1.4a)
 *
 * Defines the session structure with security features:
 * - IP and User-Agent binding for session hijacking prevention
 * - API key revocation tracking
 * - Reconnection tracking
 *
 * @see ST-163 Task 1.3: Implement Session Interface & Types
 * @see ST-163 Task 1.4a: Enhance Session Interface with IP/User-Agent Binding
 */

/**
 * Session TTL: 1 hour (3600 seconds)
 * Sessions expire after 1 hour of inactivity
 */
export const MCP_SESSION_TTL = 3600;

/**
 * Redis key prefix for sessions
 * Format: mcp-session:{sessionId}
 */
export const MCP_SESSION_PREFIX = 'mcp-session:';

/**
 * MCP Session representation stored in Redis
 */
export interface McpSession {
  /** Unique session identifier (format: sess_{uuid}) */
  sessionId: string;

  /** API key ID that created this session */
  apiKeyId: string;

  /** Project ID associated with the API key */
  projectId: string;

  /** MCP protocol version (e.g., "mcp/1.0") */
  protocolVersion: string;

  /** Client information string */
  clientInfo: string;

  /** Client capabilities (e.g., ["tools", "prompts"]) */
  capabilities: string[];

  /** Session creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last heartbeat timestamp (ISO 8601) */
  lastHeartbeat: string;

  /** Number of reconnection attempts */
  reconnectCount: number;

  // ===== Security Features (Task 1.4a) =====

  /** Origin IP address for session binding */
  originIp: string;

  /** User-Agent header for session binding */
  userAgent: string;

  /** Flag indicating if the API key has been revoked */
  apiKeyRevoked: boolean;
}

/**
 * Data required to create a new session
 */
export interface CreateSessionData {
  apiKeyId: string;
  projectId: string;
  protocolVersion: string;
  clientInfo: string;
  capabilities: string[];
}
