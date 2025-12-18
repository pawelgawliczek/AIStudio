#!/usr/bin/env node
/**
 * MCP STDIO Bridge for VibeStudio HTTP Transport
 *
 * This bridge allows Claude Code to connect to our MCP HTTP server
 * via stdio transport. It translates stdio MCP protocol to HTTP calls.
 *
 * Features:
 * - Heartbeat to keep session alive
 * - WebSocket connection for real-time events
 * - Auto-reconnect with exponential backoff
 * - Comprehensive logging for debugging
 *
 * Usage:
 *   npx ts-node mcp-stdio-bridge.ts --api-key=<key> [--base-url=<url>] [--debug]
 *
 * Environment variables:
 *   VIBESTUDIO_API_KEY - API key for authentication
 *   VIBESTUDIO_BASE_URL - Base URL (default: https://vibestudio.example.com)
 *   VIBESTUDIO_DEBUG - Enable debug logging (1 or true)
 */

import * as readline from 'readline';
import { McpHttpClient } from './client';
import { ConnectionState } from './types';

// Configuration
const API_KEY_FROM_ARG = process.argv.find(a => a.startsWith('--api-key='))?.split('=')[1];
const API_KEY = process.env.VIBESTUDIO_API_KEY || API_KEY_FROM_ARG || '';

const BASE_URL_FROM_ARG = process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1];
const BASE_URL = process.env.VIBESTUDIO_BASE_URL || BASE_URL_FROM_ARG || 'https://vibestudio.example.com';

const DEBUG_FROM_ARG = process.argv.includes('--debug');
const DEBUG = process.env.VIBESTUDIO_DEBUG === '1' || process.env.VIBESTUDIO_DEBUG === 'true' || DEBUG_FROM_ARG;

/**
 * Log to stderr (stdout is reserved for MCP protocol)
 */
function log(message: string, data?: any): void {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const logLine = data
      ? `[${timestamp}] [MCP-Bridge] ${message} ${JSON.stringify(data)}`
      : `[${timestamp}] [MCP-Bridge] ${message}`;
    process.stderr.write(logLine + '\n');
  }
}

if (!API_KEY) {
  log('ERROR: Missing API key');
  console.error(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32600,
      message: 'Missing API key. Set VIBESTUDIO_API_KEY environment variable or use --api-key=<key>'
    },
    id: null
  }));
  process.exit(1);
}

log('Bridge starting', { baseUrl: BASE_URL, debug: DEBUG });

// MCP client instance
let client: McpHttpClient | null = null;
let sessionInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the HTTP client and session with stability features
 */
async function initializeSession(): Promise<void> {
  // Prevent race conditions - use single initialization promise
  if (initializationPromise) {
    return initializationPromise;
  }

  if (sessionInitialized) return;

  initializationPromise = (async () => {
    log('Initializing session...');

    client = new McpHttpClient({
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      debug: DEBUG,
      heartbeatInterval: 60000, // 60 seconds (reduced frequency for multiple clients)
      maxReconnectAttempts: 10,
      initialReconnectDelay: 1000,
      maxReconnectDelay: 30000,
    });

    try {
      await client.initialize('claude-code-mcp-bridge-1.0');
      log('Session initialized', { sessionId: client.getSessionId() });

      // Start heartbeat to keep session alive
      client.startHeartbeat();
      log('Heartbeat started (60s interval)');

      // Connect WebSocket for real-time events and connection monitoring
      client.connect();
      log('WebSocket connection initiated');

      // Subscribe to connection state events for monitoring
      client.on('connect', (event) => {
        log('WebSocket connected', event.data);
      });

      client.on('disconnect', (event) => {
        log('WebSocket disconnected', event.data);
      });

      client.on('reconnecting', (event) => {
        log('WebSocket reconnecting', event.data);
      });

      client.on('reconnect:failed', (event) => {
        log('WebSocket reconnection failed', event.data);
      });

      client.on('session:expired', (event) => {
        log('Session expired!', event.data);
        sessionInitialized = false;
        initializationPromise = null;
      });

      client.on('error', (event) => {
        log('Client error', event.data);
      });

      sessionInitialized = true;
    } catch (error: any) {
      log('Session initialization failed', { error: error.message });
      initializationPromise = null;
      throw new Error(`Failed to initialize session: ${error.message}`);
    }
  })();

  return initializationPromise;
}

/**
 * Handle MCP JSON-RPC request
 */
async function handleRequest(request: any): Promise<any> {
  const { method, params, id } = request;

  log(`Request: ${method}`, { id, hasParams: !!params });

  try {
    switch (method) {
      case 'initialize':
        await initializeSession();
        log('Initialize complete');
        return {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'vibestudio-mcp-http-bridge',
              version: '1.1.0', // Updated version with stability features
            },
          },
          id,
        };

      case 'initialized':
        log('Client sent initialized notification');
        // Notification, no response needed
        return null;

      case 'tools/list':
        await initializeSession();
        const tools = await client!.listTools();
        log(`Listed ${tools.length} tools`);
        return {
          jsonrpc: '2.0',
          result: {
            tools: tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
          id,
        };

      case 'tools/call':
        await initializeSession();
        const { name, arguments: args } = params;
        log(`Calling tool: ${name}`);
        const startTime = Date.now();
        const result = await client!.callTool(name, args || {});
        const duration = Date.now() - startTime;
        log(`Tool ${name} completed in ${duration}ms`);
        return {
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
          },
          id,
        };

      case 'ping':
        log('Ping received');
        return {
          jsonrpc: '2.0',
          result: {},
          id,
        };

      default:
        log(`Unknown method: ${method}`);
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
          id,
        };
    }
  } catch (error: any) {
    log(`Error handling ${method}`, { error: error.message });
    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message || 'Internal error',
      },
      id,
    };
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(reason: string): Promise<void> {
  log(`Shutting down: ${reason}`);

  if (client && sessionInitialized) {
    try {
      client.stopHeartbeat();
      log('Heartbeat stopped');

      await client.close();
      log('Session closed successfully');
    } catch (error: any) {
      log('Error during shutdown', { error: error.message });
    }
  }

  process.exit(0);
}

/**
 * Request queue to prevent race conditions
 */
let requestQueue: Promise<void> = Promise.resolve();

/**
 * Main entry point - read from stdin, write to stdout
 */
async function main() {
  log('Main loop starting');

  const rl = readline.createInterface({
    input: process.stdin,
    // Don't use output - we write directly to stdout for MCP protocol
    terminal: false,
  });

  rl.on('line', (line) => {
    if (!line.trim()) return;

    // Queue requests to prevent race conditions
    requestQueue = requestQueue.then(async () => {
      try {
        const request = JSON.parse(line);
        const response = await handleRequest(request);

        // Only send response if not a notification
        if (response !== null) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (error: any) {
        log('Parse error', { error: error.message, line: line.substring(0, 100) });
        const errorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: `Parse error: ${error.message}`,
          },
          id: null,
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });
  });

  rl.on('close', () => {
    shutdown('stdin closed');
  });

  // Handle process signals
  process.on('SIGINT', () => {
    shutdown('SIGINT received');
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM received');
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    log('Uncaught exception', { error: error.message, stack: error.stack });
    shutdown('uncaught exception');
  });

  process.on('unhandledRejection', (reason) => {
    log('Unhandled rejection', { reason });
    // Don't exit on unhandled rejection, just log it
  });

  log('Bridge ready and listening for requests');
}

main().catch((error) => {
  log('Bridge startup failed', { error: error.message });
  console.error(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: `Bridge startup failed: ${error.message}`,
    },
    id: null,
  }));
  process.exit(1);
});
