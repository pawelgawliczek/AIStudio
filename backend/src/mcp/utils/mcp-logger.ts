/**
 * MCP Logger Utility (ST-171)
 *
 * Provides structured logging for MCP server handlers.
 * All output goes to stderr to avoid corrupting the JSON-RPC protocol on stdout.
 *
 * Usage:
 *   import { mcpLog, mcpDebug, mcpWarn, mcpError } from '../utils/mcp-logger';
 *   mcpLog('Operation completed', { duration: 123 });
 */

const MCP_DEBUG = process.env.MCP_DEBUG === '1' || process.env.MCP_DEBUG === 'true';

export type LogLevel = 'info' | 'debug' | 'warn' | 'error';

/**
 * Write a log message to stderr with timestamp and level
 */
function writeLog(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  // Skip debug messages unless MCP_DEBUG is enabled
  if (level === 'debug' && !MCP_DEBUG) return;

  const timestamp = new Date().toISOString();
  const levelTag = level.toUpperCase().padEnd(5);
  const prefix = `[${timestamp}] [MCP] [${levelTag}]`;

  const logLine = data
    ? `${prefix} ${message} ${JSON.stringify(data)}`
    : `${prefix} ${message}`;

  // Write to stderr to avoid corrupting MCP JSON-RPC on stdout
  process.stderr.write(logLine + '\n');
}

/**
 * Log an informational message (always visible)
 */
export function mcpLog(message: string, data?: Record<string, unknown>): void {
  writeLog('info', message, data);
}

/**
 * Log a debug message (only visible when MCP_DEBUG=1)
 */
export function mcpDebug(message: string, data?: Record<string, unknown>): void {
  writeLog('debug', message, data);
}

/**
 * Log a warning message (always visible)
 */
export function mcpWarn(message: string, data?: Record<string, unknown>): void {
  writeLog('warn', message, data);
}

/**
 * Log an error message (always visible)
 */
export function mcpError(message: string, data?: Record<string, unknown>): void {
  writeLog('error', message, data);
}

/**
 * Create a scoped logger with a prefix
 *
 * Usage:
 *   const log = createMcpLogger('run_tests');
 *   log.info('Starting test execution');
 *   log.debug('Validation passed', { storyId });
 */
export function createMcpLogger(scope: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) =>
      mcpLog(`[${scope}] ${message}`, data),
    debug: (message: string, data?: Record<string, unknown>) =>
      mcpDebug(`[${scope}] ${message}`, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      mcpWarn(`[${scope}] ${message}`, data),
    error: (message: string, data?: Record<string, unknown>) =>
      mcpError(`[${scope}] ${message}`, data),
  };
}
