/**
 * Example usage of @vibestudio/mcp-http-client
 *
 * This example demonstrates:
 * - Session initialization
 * - WebSocket connection with auto-reconnect
 * - Real-time event streaming
 * - Tool execution
 * - Session management with heartbeat
 */

import { McpHttpClient, ConnectionState } from './src';

async function main() {
  // Configuration
  const baseUrl = process.env.MCP_BASE_URL || 'https://vibestudio.example.com';
  const apiKey = process.env.MCP_API_KEY;

  if (!apiKey) {
    console.error('❌ MCP_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🚀 MCP HTTP Client Example\n');

  // Create client
  const client = new McpHttpClient({
    baseUrl,
    apiKey,
    debug: true, // Enable debug logging
    maxReconnectAttempts: 5,
    heartbeatInterval: 60000, // 60 seconds
  });

  // Subscribe to client lifecycle events
  client.on('connect', () => {
    console.log('✅ WebSocket connected');
  });

  client.on('disconnect', (event) => {
    console.log('❌ WebSocket disconnected:', event.data.reason);
  });

  client.on('reconnecting', (event) => {
    console.log(`🔄 Reconnecting... (attempt ${event.data.attempt}, delay ${event.data.delay}ms)`);
  });

  client.on('reconnect:failed', (event) => {
    console.error(`❌ Reconnection failed after ${event.data.attempts} attempts`);
  });

  client.on('session:expired', async () => {
    console.warn('⚠️ Session expired, re-initializing...');
    try {
      await client.initialize('example-client/1.0.0');
      client.connect();
      client.startHeartbeat();
      console.log('✅ Session re-initialized');
    } catch (error: any) {
      console.error('❌ Failed to re-initialize session:', error.message);
    }
  });

  client.on('session:revoked', (event) => {
    console.error('❌ Session revoked:', event.data.message);
    process.exit(1);
  });

  client.on('error', (event) => {
    console.error('❌ Error:', event.data.error);
  });

  try {
    // Initialize session
    console.log('📝 Initializing session...');
    const session = await client.initialize('example-client/1.0.0');
    console.log(`✅ Session initialized: ${session.sessionId}`);
    console.log(`📅 Expires at: ${session.expiresAt}`);
    console.log(`🔧 Server: ${session.serverInfo.name} v${session.serverInfo.version}\n`);

    // Connect WebSocket for real-time events
    console.log('🔌 Connecting to WebSocket...');
    client.connect();

    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (client.getConnectionState() !== ConnectionState.CONNECTED) {
      console.warn('⚠️ WebSocket not connected, continuing with HTTP-only mode\n');
    }

    // Subscribe to tool events
    client.subscribeToEvents({
      onToolStart: (event) => {
        console.log(`🚀 Tool started: ${event.toolName} (${event.timestamp})`);
      },
      onToolProgress: (event) => {
        console.log(`⏳ Tool progress: ${event.toolName} - ${event.data.progress}%`);
      },
      onToolComplete: (event) => {
        console.log(`✅ Tool completed: ${event.toolName}`);
        if (event.data.result) {
          console.log('📦 Result:', JSON.stringify(event.data.result, null, 2));
        }
      },
      onToolError: (event) => {
        console.error(`❌ Tool error: ${event.toolName}`);
        console.error('💥 Error:', event.data.error);
      },
    });

    // Start automatic heartbeat
    console.log('💓 Starting heartbeat...\n');
    client.startHeartbeat();

    // List available tools
    console.log('📋 Listing available tools...');
    const tools = await client.listTools({ detail_level: 'with_descriptions' });
    console.log(`✅ Found ${tools.length} tools:\n`);

    // Display first 5 tools
    tools.slice(0, 5).forEach((tool) => {
      console.log(`  • ${tool.name} (${tool.category})`);
      console.log(`    ${tool.description}`);
    });
    console.log();

    // Call a tool (example: list_projects)
    console.log('🔧 Calling tool: list_projects...');
    const result = await client.callTool('list_projects', {
      status: 'active',
      page: 1,
      pageSize: 5,
    });
    console.log('✅ Tool execution successful');
    console.log('📦 Result:', JSON.stringify(result, null, 2));
    console.log();

    // Keep running for a while to demonstrate heartbeat
    console.log('⏳ Running for 60 seconds to demonstrate heartbeat and auto-reconnect...');
    console.log('   (You can kill the server to test auto-reconnect)');
    await new Promise((resolve) => setTimeout(resolve, 60000));

    // Clean shutdown
    console.log('\n🛑 Shutting down...');
    await client.close();
    console.log('✅ Client closed successfully');
    console.log('👋 Goodbye!');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('📋 Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run example
main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
