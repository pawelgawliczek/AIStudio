#!/usr/bin/env node

/**
 * Vibe Studio MCP Server
 *
 * Implements progressive disclosure pattern with file-based tool discovery.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { ToolRegistry } from './core/registry.js';
import { formatError } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize Tool Registry
const serversPath = path.join(__dirname, 'servers');
const registry = new ToolRegistry(serversPath, prisma);

// Initialize MCP server
const server = new Server(
  {
    name: 'aistudio-mcp-server',
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
 * Note: For progressive disclosure, agents should use search_tools instead.
 * This handler now returns only meta tools by default.
 */
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  try {
    // Return only meta tools by default to encourage progressive disclosure
    const tools = await registry.listTools('meta');

    console.error(`📋 Listing ${tools.length} meta tools (use search_tools for all)`);

    return { tools };
  } catch (error: any) {
    console.error('Error listing tools:', error);
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

  try {
    console.error(`🔧 Executing tool: ${name}`);

    let result: any;

    // Special case: search_tools needs registry access instead of prisma
    if (name === 'search_tools') {
      const toolModule = await registry.discoverTools('meta');
      const searchTool = toolModule.find((t) => t.tool.name === 'search_tools');
      if (searchTool) {
        result = await searchTool.handler(registry, args);
      } else {
        throw new Error('search_tools not found');
      }
    } else {
      // Execute tool via registry (passes prisma automatically)
      result = await registry.executeTool(name, args);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const formattedError = formatError(error);
    console.error(`Error executing tool ${name}:`, formattedError);

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
  console.error('✅ Connected to database');

  // Discover available tools
  const allTools = await registry.discoverTools();
  console.error(`✅ Discovered ${allTools.length} tools from filesystem`);

  // Log categories
  const categories = new Set(allTools.map((t) => t.metadata?.category).filter(Boolean));
  console.error(`📂 Categories: ${Array.from(categories).join(', ')}`);

  // Start MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Vibe Studio MCP Server started');
  console.error('💡 Use search_tools for progressive discovery');
  console.error('Listening for MCP requests...\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n🛑 Shutting down MCP server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('\n🛑 Shutting down MCP server...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
main().catch((error) => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});
