#!/usr/bin/env node

/**
 * Vibe Studio MCP Server
 *
 * Implements progressive disclosure pattern with file-based tool discovery.
 */

// ============================================================================
// CRITICAL: Redirect console.log to stderr (ST-171)
// MCP protocol uses stdout for JSON-RPC. Any non-JSON output breaks the protocol.
// This ensures ALL console.log calls in tool handlers go to stderr instead.
// ============================================================================
console.log = (...args: unknown[]) => {
  console.error(...args);
};

import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolRegistry } from './core/registry.js';
import { formatError } from './utils.js';

// ============================================================================
// LOGGING UTILITY
// ============================================================================

/**
 * Debug mode - enables verbose logging when MCP_DEBUG=1 or MCP_DEBUG=true
 * Basic info/error logs are always enabled for production visibility
 */
const MCP_DEBUG = process.env.MCP_DEBUG === '1' || process.env.MCP_DEBUG === 'true';

type LogLevel = 'info' | 'debug' | 'warn' | 'error';

/**
 * Structured logging utility for MCP server
 *
 * Levels:
 * - info: Always enabled (server lifecycle, connections)
 * - debug: Enabled via MCP_DEBUG=1 (tool calls, timing, sizes)
 * - warn: Always enabled (non-fatal issues)
 * - error: Always enabled (failures)
 *
 * All output goes to stderr (stdout reserved for MCP protocol)
 */
function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  // Skip debug logs unless MCP_DEBUG is enabled
  if (level === 'debug' && !MCP_DEBUG) {
    return;
  }

  const timestamp = new Date().toISOString();
  const levelTag = level.toUpperCase().padEnd(5);
  const prefix = `[${timestamp}] [MCP] [${levelTag}]`;
  const logLine = data ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`;
  process.stderr.write(logLine + '\n');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Get __dirname for CommonJS (TypeScript will compile to CommonJS, so __dirname is available)
// If running as ES module, this will be undefined but servers path will still work
const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.resolve();

// WORKAROUND: Claude Code doesn't pass env vars from mcp-config.json correctly
// Force the correct DATABASE_URL for MCP server (port 5433)
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes(':5432/')) {
  process.env.DATABASE_URL = 'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5433/vibestudio?schema=public';
  log('warn', 'DATABASE_URL override', { reason: 'Claude Code env vars not working', port: 5433 });
}

// Initialize Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Initialize Tool Registry
const serversPath = path.join(currentDir, 'servers');
const registry = new ToolRegistry(serversPath, prisma);

// Initialize MCP server
const server = new Server(
  {
    name: 'vibestudio-mcp-server',
    version: '0.2.0', // Sprint 4.5
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

/**
 * List available tools
 *
 * ST-197: Now supports profile-based filtering
 * - MCP_PROFILE=core (default): Returns ~28 frequently-used tools
 * - MCP_PROFILE=full: Returns all ~153 tools
 *
 * Tools not in profile can be called via invoke_tool
 */
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  try {
    const profile = registry.getActiveProfile();
    const tools = await registry.listTools();

    log('info', 'Listing tools', { profile, count: tools.length });

    return { tools };
  } catch (error: any) {
    log('error', 'Failed to list tools', { error: error.message });
    throw error;
  }
});

/**
 * Call a tool
 *
 * Tools are loaded dynamically from the filesystem.
 * Special handling for search_tools which requires registry access.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();

  try {
    log('debug', 'Executing tool', { name, args });

    let result: any;

    // Special case: Meta tools need registry access instead of prisma
    if (name === 'search_tools' || name === 'invoke_tool') {
      log('debug', `Special handling for ${name}`);
      const toolModule = await registry.discoverTools('meta');
      const metaTool = toolModule.find((t) => t.tool.name === name);
      if (metaTool) {
        result = await metaTool.handler(registry, args);
      } else {
        throw new Error(`${name} not found`);
      }
    } else {
      // Execute tool via registry (passes prisma automatically)
      result = await registry.executeTool(name, args);
    }

    const jsonResult = JSON.stringify(result, null, 2);
    const durationMs = Date.now() - startTime;

    log('debug', 'Tool completed', { name, durationMs, responseSizeBytes: jsonResult.length });

    return {
      content: [
        {
          type: 'text',
          text: jsonResult,
        },
      ],
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const formattedError = formatError(error);

    log('error', 'Tool failed', { name, durationMs, error: formattedError });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedError, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function main() {
  // Connect to database
  await prisma.$connect();
  log('info', 'Database connected');

  // Get profile and discover tools
  const profile = registry.getActiveProfile();
  const allTools = await registry.discoverTools();
  const profileTools = await registry.listTools();
  const categories = Array.from(new Set(allTools.map((t) => t.metadata?.category).filter(Boolean)));

  log('info', 'Server starting', {
    profile,
    totalTools: allTools.length,
    profileTools: profileTools.length,
    categories,
  });

  // Start MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Connection lifecycle handlers
  server.oninitialized = () => {
    log('info', 'Client connected');
  };

  transport.onclose = () => {
    log('info', 'Client disconnected');
  };

  transport.onerror = (error: Error) => {
    log('error', 'Transport error', { message: error.message, stack: error.stack });
  };

  log('info', 'Server started', { version: '0.2.0', debug: MCP_DEBUG });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  log('info', 'Shutting down', { signal: 'SIGINT' });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('info', 'Shutting down', { signal: 'SIGTERM' });
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
main().catch((error) => {
  log('error', 'Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
});
