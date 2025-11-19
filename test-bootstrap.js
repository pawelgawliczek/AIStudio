#!/usr/bin/env node

/**
 * Test script to call bootstrap_project via the MCP server
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const mcpServer = spawn('npx', ['tsx', join(__dirname, 'backend/src/mcp/server.ts')], {
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5433/vibestudio?schema=public',
    NODE_ENV: 'development'
  },
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '0.1.0',
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
};

mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');

// Wait for initialization response, then send tool call
mcpServer.stdout.on('data', (data) => {
  const messages = data.toString().split('\n').filter(line => line.trim());

  for (const message of messages) {
    try {
      const parsed = JSON.parse(message);

      if (parsed.id === 1) {
        // Server initialized, now call bootstrap_project
        const toolRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'bootstrap_project',
            arguments: {
              name: 'AI Studio',
              description: 'MCP Control Plane for managing AI agentic frameworks, tracking their effectiveness, and providing complete traceability from requirements to code to metrics',
              repositoryUrl: 'https://github.com/pawelgawliczek/AIStudio',
              defaultFramework: 'Claude Code + NestJS + React'
            }
          }
        };

        mcpServer.stdin.write(JSON.stringify(toolRequest) + '\n');
      } else if (parsed.id === 2) {
        // Tool call response
        console.log('Bootstrap Project Result:');
        console.log(JSON.stringify(parsed, null, 2));
        mcpServer.kill();
        process.exit(0);
      }
    } catch (e) {
      // Ignore non-JSON lines (like debug output)
    }
  }
});

setTimeout(() => {
  console.error('Timeout waiting for response');
  mcpServer.kill();
  process.exit(1);
}, 10000);
