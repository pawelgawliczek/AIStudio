# THE_PLAN - ST-334: Add Health Endpoint to laptop-agent

## Story Context
- **Story**: ST-334 - [E-3] Add health endpoint to laptop-agent  
- **Epic**: EP-14 - File-Based Architecture & Guaranteed Delivery
- **Goal**: Add a simple HTTP health endpoint on port 3002 to enable SessionStart hook to verify laptop connectivity for workflow sessions

## Architecture Context

**Where Components Run:**
- **Claude Code**: Runs on laptop (user's local machine)
- **SessionStart Hook**: Runs on laptop (via Claude Code, uses CLAUDE_PROJECT_DIR)
- **laptop-agent**: Runs on laptop (same machine as Claude Code)
- **Backend**: Runs on Hostinger (remote server)

**Communication Flow:**
```
Laptop (127.0.0.1):
  Claude Code → SessionStart hook → curl http://127.0.0.1:3002/health → laptop-agent

Remote (Hostinger):
  Backend ← WebSocket ← laptop-agent
```

**Why 127.0.0.1 is Correct:**
The health endpoint is called by a local hook script running on the same laptop, so binding to localhost (127.0.0.1) is correct and secure.

## Exploration Findings

### 1. Relevant Files

**Files to Modify:**
- `/Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/agent.ts` - Main RemoteAgent class (986 lines)
  - Add health server initialization in constructor
  - Start server in `connect()` method
  - Stop server in `disconnect()` method
  - Add connection status tracking

- `/Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/config.ts` - Configuration management (171 lines)
  - Add `healthPort: number` field to `AgentConfig` interface (line 14-28)
  - Add to `DEFAULT_CONFIG` object (line 30-50) with default value 3002

**Reference Files:**
- `/Users/pawelgawliczek/projects/AIStudio/backend/src/health.controller.ts` - NestJS health endpoint pattern
- `/Users/pawelgawliczek/projects/AIStudio/backend/src/main.ts` - NestJS server startup on port 3000
- `/Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/wake-detector.ts` - Simple class pattern for lifecycle management
- `/Users/pawelgawliczek/projects/AIStudio/.claude/hooks/vibestudio-session-start.sh` - Will call health endpoint

### 2. Existing Patterns & Conventions

**Agent Lifecycle Pattern:**
The RemoteAgent class follows a clear lifecycle:
```typescript
constructor() { /* Initialize components */ }
async connect() { /* Start all services */ }
disconnect() { /* Stop all services */ }
```

**Similar Components Already in Agent:**
- `WakeDetector` - Started in connect(), stopped in disconnect()
- `TranscriptWatcher` - Started in connect(), stopped in disconnect()
- `ArtifactWatcher` - Started after registration, stopped in disconnect()
- `UploadManager` - Initialized after registration, stopped in disconnect()

**Cleanup Pattern:**
All services follow this pattern in `disconnect()`:
```typescript
if (this.service) {
  this.service.stop().catch((err) => {
    console.error('Error stopping service:', err.message);
  });
  this.service = null;
}
```

### 3. HTTP Server Implementation Approach

**No Express/Fastify in Dependencies:**
The laptop-agent package.json shows NO HTTP framework dependencies. We should use Node.js native `http` module to minimize overhead and bundle size.

**Pattern from Backend (NestJS):**
```typescript
// Backend uses NestJS which wraps http.createServer
await app.listen(port);
```

**Native Node.js HTTP Pattern:**
```typescript
import * as http from 'http';

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'connected', agentId, uptime }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3002, '127.0.0.1', () => {
  console.log('Health server listening on 127.0.0.1:3002');
});
```

### 4. Key Dependencies & Imports

**Required Imports:**
```typescript
import * as http from 'http';  // Built-in Node.js module
```

**Available Data:**
- `this.agentId` - Set after registration (string | null)
- `this.socket?.connected` - WebSocket connection status (boolean)
- `process.uptime()` - Node.js process uptime in seconds

### 5. Configuration

**Port Configuration:**
- Default: 3002 (as per EP-14 plan)
- Configurable via environment variable `HEALTH_PORT`
- Configurable via ~/.vibestudio/config.json

**Binding:**
- Bind to 127.0.0.1 (localhost only) for security
- No external access needed - hook runs locally on same machine

### 6. Response Format

**Endpoint:** GET /health

**Response (connected):**
```json
{
  "status": "connected",
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "uptime": 3600.5
}
```

**Response (not connected):**
```json
{
  "status": "disconnected",
  "agentId": null,
  "uptime": 3600.5
}
```

**Status Determination:**
- `connected` - `this.socket?.connected === true && this.agentId !== null`
- `disconnected` - Otherwise

### 7. Test Files Identified

**Existing Test Patterns:**
- `/Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/__tests__/wake-detector.test.ts` - Simple class lifecycle tests
- `/Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/__tests__/agent-artifact-watcher.test.ts` - Agent integration tests

**New Test File:**
- `laptop-agent/src/__tests__/health-server.test.ts` - Unit tests for health server
- Test server startup/shutdown
- Test response format
- Test status accuracy

### 8. Potential Risks & Considerations

**Port Conflicts:**
- Port 3002 might be in use by another service
- Server should handle EADDRINUSE gracefully
- Log clear error message if port is unavailable

**Startup Order:**
- Health server should start BEFORE agent registration
- This allows health checks during agent connection process
- Stop server AFTER disconnecting from backend

**Minimal Overhead:**
- Use native http module (no framework overhead)
- Simple synchronous handler (no async complexity)
- No authentication needed (localhost only, called by local hook)

**Error Handling:**
- Handle server.listen() errors
- Handle server.close() errors
- Don't crash agent if health server fails

### 9. Git History Insights

**Recent Agent Changes:**
- ST-363: Added epic file hierarchy (artifact-mover integration)
- ST-327: Integrated ArtifactWatcher (follows same lifecycle pattern)
- ST-281: Added WakeDetector (good lifecycle reference)
- ST-182: Added TranscriptTailer (WebSocket integration pattern)

**Lifecycle Management Pattern Confirmed:**
All recent features follow the same pattern:
1. Private class property
2. Initialize in constructor or connect()
3. Start in connect() or after registration
4. Stop in disconnect() with null check

### 10. Related Use Cases

**Primary Use Case:**
- SessionStart hook checks laptop connectivity
- Only for workflow sessions (not regular Claude Code)
- Fast check (< 1s timeout expected)

**Future Use Cases:**
- Menu bar app status indicator
- Health monitoring dashboard
- Automated testing/CI checks

## Implementation Plan

### Phase 1: Create Health Server Class
1. Create `laptop-agent/src/health-server.ts`
2. Implement simple HTTP server with lifecycle methods
3. Match WakeDetector pattern for consistency

### Phase 2: Update Configuration
1. Add `healthPort` to AgentConfig interface
2. Add default value (3002) to DEFAULT_CONFIG
3. Add environment variable support

### Phase 3: Integrate into RemoteAgent
1. Add private `healthServer` property
2. Initialize in constructor
3. Start in `connect()` before registration
4. Stop in `disconnect()` with error handling

### Phase 4: Testing
1. Unit tests for HealthServer class
2. Integration tests with RemoteAgent
3. Manual test with curl
4. Manual test with SessionStart hook

### Phase 5: Documentation
1. Update AGENT_PROGRESS.md
2. Document configuration options
3. Add troubleshooting notes

## Implementation Details

### File Structure
```
laptop-agent/src/
├── health-server.ts          (NEW - 80-100 lines)
├── agent.ts                  (MODIFY - add 15 lines)
├── config.ts                 (MODIFY - add 3 lines)
└── __tests__/
    └── health-server.test.ts (NEW - 150-200 lines)
```

### Configuration Changes
```typescript
// config.ts
export interface AgentConfig {
  // ... existing fields
  healthPort: number;  // NEW
}

const DEFAULT_CONFIG: Partial<AgentConfig> = {
  // ... existing defaults
  healthPort: 3002,  // NEW
};

// Add environment variable support in loadEnvConfig()
if (process.env.HEALTH_PORT) {
  const parsed = parseInt(process.env.HEALTH_PORT, 10);
  if (!isNaN(parsed) && parsed > 0) {
    config.healthPort = parsed;
  }
}
```

### Agent Integration
```typescript
// agent.ts
import { HealthServer } from './health-server';

export class RemoteAgent {
  private healthServer: HealthServer | null = null;  // NEW

  constructor(config: AgentConfig) {
    // ... existing code
    this.healthServer = new HealthServer(config.healthPort);  // NEW
  }

  async connect(): Promise<void> {
    // Start health server FIRST (before registration)
    try {
      await this.healthServer!.start(() => ({
        status: this.isConnected() ? 'connected' : 'disconnected',
        agentId: this.agentId,
        uptime: process.uptime(),
      }));
    } catch (error: any) {
      console.error('Failed to start health server:', error.message);
      // Don't fail agent startup if health server fails
    }

    // ... existing connection code
  }

  disconnect(): void {
    // ... existing cleanup code

    // Stop health server LAST
    if (this.healthServer) {
      this.healthServer.stop().catch((err) => {
        console.error('Error stopping health server:', err.message);
      });
      this.healthServer = null;
    }
  }
}
```

### HealthServer Class
```typescript
// health-server.ts
import * as http from 'http';
import { Logger } from './logger';

export interface HealthStatus {
  status: 'connected' | 'disconnected';
  agentId: string | null;
  uptime: number;
}

export class HealthServer {
  private server: http.Server | null = null;
  private readonly port: number;
  private readonly logger = new Logger('HealthServer');
  private getStatus: (() => HealthStatus) | null = null;

  constructor(port: number) {
    this.port = port;
  }

  async start(getStatus: () => HealthStatus): Promise<void> {
    this.getStatus = getStatus;

    this.server = http.createServer((req, res) => {
      // Simple routing - only /health endpoint
      if (req.method === 'GET' && req.url === '/health') {
        const status = this.getStatus!();
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'  // For future menu bar app
        });
        res.end(JSON.stringify(status));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, '127.0.0.1', () => {
        this.logger.info('Health server started', { port: this.port });
        resolve();
      });

      this.server!.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          this.logger.error('Health server port already in use', { 
            port: this.port,
            suggestion: 'Change HEALTH_PORT in config or stop other service'
          });
        } else {
          this.logger.error('Health server error', { error: error.message });
        }
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.logger.info('Health server stopped');
          this.server = null;
          resolve();
        });
      });
    }
  }
}
```

## Testing Strategy

### Unit Tests
1. HealthServer starts and binds to port
2. GET /health returns correct status
3. Other endpoints return 404
4. Server stops cleanly
5. Error handling for port conflicts

### Integration Tests
1. Agent starts with health server
2. Status reflects connection state
3. AgentId populated after registration
4. Server stops when agent disconnects

### Manual Testing
1. Start agent with `vibestudio-agent start`
2. Verify: `curl http://127.0.0.1:3002/health`
3. Expected: `{"status":"connected","agentId":"...","uptime":123.45}`
4. Check SessionStart hook integration (ST-333)
5. Test port conflict handling

## Success Criteria

- [ ] Health server starts on port 3002 (configurable)
- [ ] GET /health returns connection status
- [ ] Status reflects actual WebSocket connection
- [ ] AgentId included when available
- [ ] Uptime accurate (from process.uptime())
- [ ] Minimal overhead (< 5MB memory)
- [ ] Graceful error handling for EADDRINUSE
- [ ] Clean shutdown
- [ ] SessionStart hook can verify connectivity via curl
- [ ] Tests pass
- [ ] Binds to 127.0.0.1 only (localhost security)

## Dependencies

**No new npm packages required** - uses built-in Node.js `http` module.

## Related Stories

- ST-333: [E-2] Add laptop connectivity check to SessionStart hook (will consume this endpoint)
- ST-349: [E-4] Distinguish workflow vs regular sessions in hook (uses health check)

## Security Considerations

**Localhost Only:**
- Binds to 127.0.0.1 (not 0.0.0.0)
- Only accessible from local machine
- No authentication needed (local-only access)

**No Sensitive Data:**
- Response contains only status, agentId, and uptime
- No credentials or secrets exposed

---

**Exploration completed**: 2025-12-20
**Next step**: Implementation (Architect or Implementer agent)
