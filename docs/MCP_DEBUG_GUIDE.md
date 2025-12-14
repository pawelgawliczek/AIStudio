# MCP Debug & HTTP Retry Guide

Reference documentation for troubleshooting MCP server connections and HTTP client configuration.

---

## MCP Server Debug Mode

Enable verbose logging by setting the `MCP_DEBUG` environment variable:

```bash
MCP_DEBUG=1
# or
MCP_DEBUG=true
```

### Log Levels

| Level | When Enabled | What's Logged |
|-------|--------------|---------------|
| `info` | Always | Server start, client connect/disconnect, errors |
| `debug` | `MCP_DEBUG=1` | Tool calls, timing, response sizes |
| `warn` | Always | Non-fatal issues (e.g., DATABASE_URL override) |
| `error` | Always | Failures with stack traces |

### Log Format

```
[2025-01-15T10:30:00.000Z] [MCP] [INFO ] Server started {"toolCount":150,"categories":["stories","epics"]}
[2025-01-15T10:30:01.000Z] [MCP] [DEBUG] Executing tool {"name":"list_stories","args":{}}
```

All logs go to stderr (stdout is reserved for MCP protocol).

---

## MCP HTTP Bridge Debug Mode

For the laptop HTTP bridge (`mcp-stdio-bridge.ts`):

```bash
# Via environment variable
VIBESTUDIO_DEBUG=1

# Via command line
npx ts-node mcp-stdio-bridge.ts --api-key=<key> --debug
```

---

## HTTP Retry Configuration

The HTTP client implements a two-tier retry strategy for maximum resilience.

### Tier 1: Initial Retries (Fast, Exponential Backoff)

- 3 attempts with delays: 1s → 2s → 4s
- Handles brief network glitches

### Tier 2: Extended Retries (Long Delay Between Rounds)

- 10 rounds with 30s delay between each
- Each round retries the initial 3 attempts
- Handles prolonged outages (up to ~5 minutes)

### Retryable Errors

| Error Type | Examples |
|------------|----------|
| Rate limiting | 429 |
| Server errors | 502, 503, 504 |
| Network errors | ECONNRESET, ETIMEDOUT, ECONNREFUSED |

### Auto Re-init

On 401/410 (session expired), the client automatically re-initializes the session and retries.

---

## McpHttpClientOptions Reference

```typescript
const client = new McpHttpClient({
  baseUrl: 'https://vibestudio.example.com',
  apiKey: 'your-api-key',
  debug: true,

  // Initial retry config
  maxHttpRetries: 3,           // Max attempts per round (default: 3)
  initialHttpRetryDelay: 1000, // Initial delay in ms (default: 1000)
  maxHttpRetryDelay: 10000,    // Max delay in ms (default: 10000)

  // Extended retry config
  extendedRetryAttempts: 10,   // Retry rounds after initial fails (default: 10)
  extendedRetryDelay: 30000,   // Delay between rounds in ms (default: 30000)
});
```

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main Claude Code configuration
- [Remote Agent Guide](REMOTE_AGENT_GUIDE.md) - Laptop ↔ KVM communication setup
