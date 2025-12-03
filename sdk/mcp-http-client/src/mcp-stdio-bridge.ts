#!/usr/bin/env node
/**
 * MCP STDIO Bridge for VibeStudio HTTP Transport
 *
 * This bridge allows Claude Code to connect to our MCP HTTP server
 * via stdio transport. It translates stdio MCP protocol to HTTP calls.
 *
 * Usage:
 *   npx ts-node mcp-stdio-bridge.ts --api-key=<key> [--base-url=<url>]
 *
 * Environment variables:
 *   VIBESTUDIO_API_KEY - API key for authentication
 *   VIBESTUDIO_BASE_URL - Base URL (default: https://vibestudio.example.com)
 */

import { McpHttpClient } from './client';
import * as readline from 'readline';

// Configuration
const API_KEY_FROM_ARG = process.argv.find(a => a.startsWith('--api-key='))?.split('=')[1];
const API_KEY = process.env.VIBESTUDIO_API_KEY || API_KEY_FROM_ARG || '';

const BASE_URL_FROM_ARG = process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1];
const BASE_URL = process.env.VIBESTUDIO_BASE_URL || BASE_URL_FROM_ARG || 'https://vibestudio.example.com';

if (!API_KEY) {
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

// MCP client instance
let client: McpHttpClient | null = null;
let sessionInitialized = false;

/**
 * Initialize the HTTP client and session
 */
async function initializeSession(): Promise<void> {
  if (sessionInitialized) return;

  client = new McpHttpClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    debug: false,
  });

  try {
    await client.initialize('claude-code-mcp-bridge-1.0');
    sessionInitialized = true;
  } catch (error: any) {
    throw new Error(`Failed to initialize session: ${error.message}`);
  }
}

/**
 * Handle MCP JSON-RPC request
 */
async function handleRequest(request: any): Promise<any> {
  const { method, params, id } = request;

  try {
    switch (method) {
      case 'initialize':
        await initializeSession();
        return {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'vibestudio-mcp-http-bridge',
              version: '1.0.0',
            },
          },
          id,
        };

      case 'initialized':
        // Notification, no response needed
        return null;

      case 'tools/list':
        await initializeSession();
        const tools = await client!.listTools();
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
        const result = await client!.callTool(name, args || {});
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
        return {
          jsonrpc: '2.0',
          result: {},
          id,
        };

      default:
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
 * Main entry point - read from stdin, write to stdout
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    // Don't use output - we write directly to stdout for MCP protocol
    terminal: false,
  });

  rl.on('line', (line) => {
    if (!line.trim()) return;

    // Handle async in a separate function to avoid blocking readline
    (async () => {
      try {
        const request = JSON.parse(line);
        const response = await handleRequest(request);

        // Only send response if not a notification
        if (response !== null) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (error: any) {
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
    })();
  });

  rl.on('close', () => {
    // Cleanup session if needed
    if (client && sessionInitialized) {
      client.close().catch(() => {});
    }
    process.exit(0);
  });

  // Handle process signals
  process.on('SIGINT', () => {
    if (client && sessionInitialized) {
      client.close().catch(() => {});
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    if (client && sessionInitialized) {
      client.close().catch(() => {});
    }
    process.exit(0);
  });
}

main().catch((error) => {
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
