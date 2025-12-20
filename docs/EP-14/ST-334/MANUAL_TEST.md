# ST-334 Manual Testing Guide

## Prerequisites
- laptop-agent built and running
- curl installed
- jq installed (optional, for pretty JSON output)

## Test Scenarios

### 1. Health Check - Agent Not Connected

Start the laptop-agent (it will try to connect to backend but may fail):

```bash
cd /Users/pawelgawliczek/projects/AIStudio/laptop-agent
npm run dev
```

In another terminal:

```bash
curl http://127.0.0.1:3002/health
```

**Expected Response:**
```json
{
  "status": "disconnected",
  "agentId": null,
  "uptime": 1.234
}
```

### 2. Health Check - Agent Connected

If backend is running and agent successfully connects:

```bash
curl http://127.0.0.1:3002/health
```

**Expected Response:**
```json
{
  "status": "connected",
  "agentId": "some-uuid-here",
  "uptime": 10.567
}
```

### 3. Test 404 Responses

```bash
# Root path - should return 404
curl -i http://127.0.0.1:3002/

# Non-existent endpoint - should return 404
curl -i http://127.0.0.1:3002/status

# POST to /health - should return 404
curl -X POST http://127.0.0.1:3002/health
```

**Expected:** All should return 404 Not Found

### 4. Test CORS Header

```bash
curl -i http://127.0.0.1:3002/health | grep -i "access-control"
```

**Expected:** Should see `Access-Control-Allow-Origin: *`

### 5. Test Custom Port Configuration

Set custom port via environment variable:

```bash
HEALTH_PORT=3099 npm run dev
```

In another terminal:

```bash
curl http://127.0.0.1:3099/health
```

**Expected:** Should work on custom port 3099

### 6. Test Port Conflict Handling

Start two agents:

```bash
# Terminal 1
npm run dev

# Terminal 2 (should fail gracefully)
npm run dev
```

**Expected:** Second agent should log error about port conflict but continue running

### 7. SessionStart Hook Integration (ST-333)

Once ST-333 is implemented, test the full workflow:

```bash
# Start workflow session
vibestudio run <story-id>
```

**Expected:** SessionStart hook should call health endpoint and verify connectivity

## Performance Verification

### Memory Overhead

```bash
# Check agent memory usage before and after starting health server
ps aux | grep laptop-agent
```

**Expected:** < 5MB increase

### Response Time

```bash
# Test response time
time curl http://127.0.0.1:3002/health
```

**Expected:** < 100ms response time

## Success Criteria

- [ ] Health endpoint returns valid JSON
- [ ] Status reflects actual connection state
- [ ] AgentId populated when connected
- [ ] Uptime matches process uptime
- [ ] 404 for non-health endpoints
- [ ] CORS header present
- [ ] Custom port configuration works
- [ ] Port conflict handled gracefully
- [ ] Minimal memory overhead (< 5MB)
- [ ] Fast response time (< 100ms)

## Troubleshooting

### Port Already in Use

If you see "EADDRINUSE" error:

```bash
# Find process using port 3002
lsof -i :3002

# Kill the process
kill -9 <PID>
```

### Agent Won't Start

Check logs:

```bash
tail -f ~/.aistudio/logs/laptop-agent-*.log
```

### Health Endpoint Not Responding

Verify agent is running:

```bash
ps aux | grep laptop-agent
```

Verify port is open:

```bash
netstat -an | grep 3002
```
