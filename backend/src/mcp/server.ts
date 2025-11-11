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
import { ToolRegistry } from './core/registry.js';
import { formatError } from './utils.js';

// Get __dirname for CommonJS (TypeScript will compile to CommonJS, so __dirname is available)
// If running as ES module, this will be undefined but servers path will still work
const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.resolve();

// Initialize Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
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
 * Note: Returns all tools for Claude Code compatibility.
 * Progressive disclosure is still encouraged via search_tools for token efficiency.
 */
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  try {
    // Return all tools to make them callable in Claude Code
    // (Claude Code creates functions based on ListToolsRequest response)
    const tools = await registry.listTools();

    console.error(`📋 Listing ${tools.length} tools (all available for Claude Code)`);

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
  // Debug: Log DATABASE_URL and config test
  console.error(`🔍 DATABASE_URL: ${process.env.DATABASE_URL || 'NOT SET'}`);
  console.error(`🔍 MCP_CONFIG_TEST: ${process.env.MCP_CONFIG_TEST || 'NOT SET'}`);

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
