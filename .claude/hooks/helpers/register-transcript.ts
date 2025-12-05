#!/usr/bin/env tsx
/**
 * Helper script to register agent transcript via MCP HTTP client
 * Called by PostToolUse hook after agent spawns
 *
 * Usage: register-transcript.ts <runId> <componentId> <agentId> <transcriptPath>
 */

import { McpHttpClient } from '../../../sdk/mcp-http-client/src/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [runId, componentId, agentId, transcriptPath] = process.argv.slice(2);

  if (!runId || !componentId || !agentId || !transcriptPath) {
    console.error('Usage: register-transcript.ts <runId> <componentId> <agentId> <transcriptPath>');
    process.exit(1);
  }

  // Read MCP config from ~/.vibestudio/mcp-config.json
  const configPath = path.join(process.env.HOME!, '.vibestudio', 'mcp-config.json');

  if (!fs.existsSync(configPath)) {
    console.error('Error: MCP config not found at', configPath);
    console.error('Please create config with: { "apiKey": "proj_...", "baseUrl": "https://vibestudio.example.com" }');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Create MCP client
  const client = new McpHttpClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    debug: false,
  });

  try {
    // Initialize session
    await client.initialize('vibestudio-hook/1.0.0');

    // Call add_transcript
    const result = await client.callTool('add_transcript', {
      runId,
      componentId,
      agentId,
      transcriptPath,
      type: 'agent',
    });

    console.log('[ST-172] Transcript registered:', JSON.stringify(result, null, 2));

    // Close session
    await client.close();

    process.exit(0);
  } catch (error: any) {
    console.error('[ST-172] Failed to register transcript:', error.message);
    process.exit(1);
  }
}

main();
