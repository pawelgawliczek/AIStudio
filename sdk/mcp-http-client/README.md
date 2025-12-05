# @vibestudio/mcp-http-client

Production-ready HTTP client for VibeStudio MCP server with auto-reconnect and real-time streaming.

## Features

- ✅ **HTTP REST API** - Initialize sessions, call tools, list tools
- ✅ **WebSocket Streaming** - Real-time tool execution events
- ✅ **Auto-Reconnect** - Exponential backoff reconnection (1s → 30s)
- ✅ **Session Management** - Automatic heartbeat to keep sessions alive
- ✅ **TypeScript** - Full type safety with comprehensive interfaces
- ✅ **Error Handling** - Comprehensive error handling with meaningful messages
- ✅ **Debug Mode** - Optional debug logging for troubleshooting

## Installation

```bash
npm install @vibestudio/mcp-http-client
```

## Quick Start

```typescript
import { McpHttpClient } from '@vibestudio/mcp-http-client';

// Create client
const client = new McpHttpClient({
  baseUrl: 'https://vibestudio.example.com',
  apiKey: 'proj_abc123_...',
  debug: true // Optional: enable debug logging
});

// Initialize session
const session = await client.initialize('my-app/1.0.0');
console.log('Session ID:', session.sessionId);

// Connect WebSocket for real-time events
client.connect();

// Subscribe to tool events
client.subscribeToEvents({
  onToolStart: (event) => console.log('Tool started:', event.toolName),
  onToolProgress: (event) => console.log('Progress:', event.data.progress),
  onToolComplete: (event) => console.log('Tool completed:', event.data.result),
  onToolError: (event) => console.error('Tool error:', event.data.error),
});

// Start heartbeat (keeps session alive)
client.startHeartbeat();

// Call a tool
const result = await client.callTool('list_projects', {});
console.log('Result:', result);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools.length);

// Close session when done
await client.close();
```

## API Reference

### Constructor

```typescript
new McpHttpClient(options: McpHttpClientOptions)
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | *required* | Base URL of MCP server |
| `apiKey` | string | *required* | API key for authentication |
| `autoReconnect` | boolean | `true` | Enable auto-reconnect on disconnect |
| `maxReconnectAttempts` | number | `10` | Maximum reconnection attempts |
| `initialReconnectDelay` | number | `1000` | Initial delay in ms |
| `maxReconnectDelay` | number | `30000` | Maximum delay in ms |
| `heartbeatInterval` | number | `60000` | Heartbeat interval in ms |
| `debug` | boolean | `false` | Enable debug logging |

### Methods

#### `initialize(clientInfo: string): Promise<SessionResponse>`

Initialize a new MCP session.

**Parameters:**
- `clientInfo` - Client information string (e.g., "my-app/1.0.0")

**Returns:**
- `SessionResponse` - Session details including session ID

**Example:**
```typescript
const session = await client.initialize('my-app/1.0.0');
console.log('Session ID:', session.sessionId);
console.log('Expires at:', session.expiresAt);
```

---

#### `connect(): void`

Connect to WebSocket for real-time event streaming.

Establishes WebSocket connection and subscribes to session events. Automatically reconnects on disconnect.

**Example:**
```typescript
client.connect();
```

---

#### `disconnect(): void`

Disconnect from WebSocket and stop all reconnection attempts.

**Example:**
```typescript
client.disconnect();
```

---

#### `subscribeToEvents(callbacks: EventCallbacks): void`

Subscribe to real-time tool events.

**Parameters:**
- `callbacks` - Object with event callback functions

**Event Callbacks:**
- `onToolStart` - Called when tool execution starts
- `onToolProgress` - Called when tool execution progresses
- `onToolComplete` - Called when tool execution completes
- `onToolError` - Called when tool execution fails
- `onSessionRevoked` - Called when session is revoked

**Example:**
```typescript
client.subscribeToEvents({
  onToolStart: (event) => {
    console.log(`Tool ${event.toolName} started at ${event.timestamp}`);
  },
  onToolProgress: (event) => {
    console.log(`Progress: ${event.data.progress}%`);
  },
  onToolComplete: (event) => {
    console.log(`Tool completed:`, event.data.result);
  },
  onToolError: (event) => {
    console.error(`Tool error:`, event.data.error);
  },
  onSessionRevoked: (event) => {
    console.warn('Session revoked:', event.data.message);
  },
});
```

---

#### `unsubscribeFromEvents(): void`

Unsubscribe from all tool events.

**Example:**
```typescript
client.unsubscribeFromEvents();
```

---

#### `on(eventType: ClientEventType, callback: (event: ClientEvent) => void): void`

Subscribe to client lifecycle events.

**Event Types:**
- `connect` - WebSocket connected
- `disconnect` - WebSocket disconnected
- `reconnecting` - Attempting reconnection
- `reconnect:failed` - Max reconnection attempts reached
- `session:expired` - Session expired (410 error)
- `session:revoked` - Session revoked by server
- `error` - Connection or server error

**Example:**
```typescript
client.on('reconnecting', (event) => {
  console.log(`Reconnecting... attempt ${event.data.attempt}, delay ${event.data.delay}ms`);
});

client.on('reconnect:failed', (event) => {
  console.error(`Reconnection failed after ${event.data.attempts} attempts`);
});

client.on('session:expired', (event) => {
  console.warn('Session expired, re-initializing...');
  client.initialize('my-app/1.0.0').then(() => {
    client.connect();
  });
});
```

---

#### `off(eventType: ClientEventType, callback?: (event: ClientEvent) => void): void`

Unsubscribe from client lifecycle events.

**Example:**
```typescript
// Remove all listeners for an event
client.off('reconnecting');

// Remove specific listener
const callback = (event) => console.log(event);
client.on('connect', callback);
client.off('connect', callback);
```

---

#### `callTool(toolName: string, args?: Record<string, any>): Promise<ToolResult>`

Call an MCP tool.

**Parameters:**
- `toolName` - Tool name (e.g., "list_projects")
- `args` - Tool arguments (optional)

**Returns:**
- `ToolResult` - Tool execution result

**Example:**
```typescript
const result = await client.callTool('list_projects', {
  status: 'active',
  page: 1,
  pageSize: 20
});

console.log('Projects:', result.result);
```

---

#### `listTools(options?: ListToolsOptions): Promise<ToolInfo[]>`

List available MCP tools.

**Parameters:**
- `options` - List tools options (optional)

**Options:**
- `category` - Filter by category
- `detail_level` - Detail level ("names_only", "with_descriptions", "full_schema")
- `query` - Search query

**Returns:**
- `ToolInfo[]` - Array of tool information

**Example:**
```typescript
// List all tools
const tools = await client.listTools();

// Filter by category
const storyTools = await client.listTools({ category: 'stories' });

// Search tools
const searchResults = await client.listTools({ query: 'project' });

// Get full schemas
const fullTools = await client.listTools({ detail_level: 'full_schema' });
```

---

#### `heartbeat(): Promise<void>`

Send heartbeat to keep session alive.

Updates session timestamp and resets TTL. Called automatically if `startHeartbeat()` is used.

**Example:**
```typescript
await client.heartbeat();
```

---

#### `startHeartbeat(): void`

Start automatic heartbeat.

Sends heartbeat at regular intervals (default: 30 seconds) to keep session alive.

**Example:**
```typescript
client.startHeartbeat();
```

---

#### `stopHeartbeat(): void`

Stop automatic heartbeat.

**Example:**
```typescript
client.stopHeartbeat();
```

---

#### `close(): Promise<void>`

Close session.

Closes the MCP session, stops heartbeat, and disconnects WebSocket.

**Example:**
```typescript
await client.close();
```

---

#### `getConnectionState(): ConnectionState`

Get current connection state.

**Returns:**
- `ConnectionState` - Connection state enum

**States:**
- `DISCONNECTED` - Not connected
- `CONNECTING` - Connection in progress
- `CONNECTED` - Connected and ready
- `RECONNECTING` - Attempting reconnection
- `FAILED` - Reconnection failed (max attempts reached)

**Example:**
```typescript
const state = client.getConnectionState();
console.log('Connection state:', state);
```

---

#### `getSessionId(): string | null`

Get current session ID.

**Returns:**
- `string | null` - Session ID or null if not initialized

**Example:**
```typescript
const sessionId = client.getSessionId();
console.log('Session ID:', sessionId);
```

---

## Auto-Reconnect Behavior

The client automatically reconnects on WebSocket disconnect using exponential backoff:

```
Attempt 1: 1 second delay
Attempt 2: 2 seconds delay
Attempt 3: 4 seconds delay
Attempt 4: 8 seconds delay
Attempt 5: 16 seconds delay
Attempt 6+: 30 seconds delay (capped)
```

After 10 failed attempts (by default), the `reconnect:failed` event is emitted and reconnection stops.

## Session Management

Sessions have a 1-hour TTL by default. The heartbeat mechanism keeps the session alive:

```typescript
// Start automatic heartbeat (every 30 seconds)
client.startHeartbeat();

// Session will remain alive as long as heartbeat is running
// TTL is reset on each heartbeat
```

If the session expires (410 Gone error), handle it in the `session:expired` event:

```typescript
client.on('session:expired', async (event) => {
  console.warn('Session expired, re-initializing...');
  const newSession = await client.initialize('my-app/1.0.0');
  client.connect();
  client.startHeartbeat();
});
```

## Error Handling

The client provides comprehensive error handling:

```typescript
try {
  const result = await client.callTool('invalid_tool', {});
} catch (error) {
  console.error('Error:', error.message);
  // Errors include:
  // - "Authentication failed: Invalid API key" (401)
  // - "Access denied: Forbidden" (403)
  // - "Not found: Resource not found" (404)
  // - "Session expired: Session no longer exists" (410)
  // - "Rate limit exceeded: Too many requests" (429)
  // - "Server error: ..." (500)
  // - "Network error: ..." (no response)
  // - "Client error: ..." (request setup)
}
```

## Complete Example

```typescript
import { McpHttpClient, ConnectionState } from '@vibestudio/mcp-http-client';

async function main() {
  // Create client
  const client = new McpHttpClient({
    baseUrl: 'https://vibestudio.example.com',
    apiKey: process.env.MCP_API_KEY!,
    debug: true,
  });

  // Subscribe to client events
  client.on('connect', () => console.log('✅ Connected'));
  client.on('disconnect', (event) => console.log('❌ Disconnected:', event.data.reason));
  client.on('reconnecting', (event) => console.log(`🔄 Reconnecting (attempt ${event.data.attempt})...`));
  client.on('reconnect:failed', () => console.error('❌ Reconnection failed'));
  client.on('session:expired', async () => {
    console.warn('⚠️ Session expired, re-initializing...');
    await client.initialize('my-app/1.0.0');
    client.connect();
    client.startHeartbeat();
  });

  // Initialize session
  const session = await client.initialize('my-app/1.0.0');
  console.log('📝 Session ID:', session.sessionId);

  // Connect WebSocket
  client.connect();

  // Subscribe to tool events
  client.subscribeToEvents({
    onToolStart: (event) => console.log('🚀 Tool started:', event.toolName),
    onToolProgress: (event) => console.log('⏳ Progress:', event.data.progress),
    onToolComplete: (event) => console.log('✅ Tool completed:', event.toolName),
    onToolError: (event) => console.error('❌ Tool error:', event.data.error),
  });

  // Start heartbeat
  client.startHeartbeat();

  // List tools
  const tools = await client.listTools({ detail_level: 'with_descriptions' });
  console.log(`📋 Available tools: ${tools.length}`);

  // Call a tool
  const result = await client.callTool('list_projects', { status: 'active' });
  console.log('📦 Projects:', result.result);

  // Keep running for a while
  await new Promise((resolve) => setTimeout(resolve, 60000));

  // Clean shutdown
  await client.close();
  console.log('👋 Closed');
}

main().catch(console.error);
```

## TypeScript Support

The SDK is written in TypeScript and includes comprehensive type definitions:

```typescript
import {
  McpHttpClient,
  McpHttpClientOptions,
  SessionResponse,
  ToolInfo,
  ToolResult,
  ToolEvent,
  EventCallbacks,
  ListToolsOptions,
  ConnectionState,
  ClientEvent,
  ClientEventType,
} from '@vibestudio/mcp-http-client';
```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
