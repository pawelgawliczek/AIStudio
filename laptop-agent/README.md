# VibeStudio Remote Agent

Remote execution agent for VibeStudio. Runs on your local machine (where Claude Code operates) to execute transcript analysis scripts that require access to local files.

## Features

- **Secure WebSocket connection** to VibeStudio backend
- **Pre-shared secret authentication** with JWT tokens
- **Whitelisted script execution** (only approved scripts)
- **Auto-reconnect** with exponential backoff
- **Heartbeat monitoring** to maintain connection

## Installation

```bash
npm install
npm run build
```

## Configuration

Create `~/.vibestudio/config.json`:

```json
{
  "serverUrl": "https://vibestudio.example.com",
  "agentSecret": "your-secret-here",
  "hostname": "my-laptop",
  "capabilities": [
    "parse-transcript",
    "analyze-story-transcripts",
    "list-transcripts"
  ],
  "projectPath": "/path/to/AIStudio"
}
```

Or use environment variables (see `.env.example`).

## Usage

### Start Agent

```bash
# Production
npm start

# Development
npm run dev

# Global CLI (after install)
vibestudio-agent start
```

### Check Status

```bash
vibestudio-agent status
```

### Stop Agent

```bash
vibestudio-agent stop
```

## Commands

- `start` - Start the agent and connect to server
- `status` - Check agent connection status
- `stop` - Stop the agent gracefully

## Security

- **Pre-shared secret** for initial registration
- **JWT tokens** for authenticated communication
- **Whitelisted scripts** - only approved scripts can execute
- **Whitelisted parameters** - only approved parameters allowed
- **WSS encryption** - all communication encrypted

## Approved Scripts

Only these scripts can be executed remotely:

- `parse-transcript.ts` - Parse Claude Code transcripts
- `analyze-story-transcripts.ts` - Analyze story-related transcripts
- `list-transcripts.ts` - List available transcripts

See `backend/src/remote-agent/approved-scripts.ts` for full list.

## Architecture

1. Agent connects to `/remote-agent` WebSocket namespace
2. Registers with pre-shared secret
3. Receives JWT token for authentication
4. Waits for job assignments
5. Executes approved scripts locally
6. Returns results to server

## Troubleshooting

### Connection Failed

- Check `SERVER_URL` in config
- Verify network connectivity
- Check firewall settings

### Authentication Failed

- Verify `AGENT_SECRET` matches backend
- Check JWT token expiration

### Script Execution Failed

- Verify `PROJECT_PATH` is correct
- Check script permissions
- Review agent logs

## Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run tests (coming soon)
npm test
```

## License

MIT
