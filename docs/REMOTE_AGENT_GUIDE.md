# Remote Agent Guide (Laptop ↔ KVM Communication)

The remote agent enables the KVM server to execute scripts on the developer's laptop (where Claude Code runs) via WebSocket.

---

## Architecture

```
┌─────────────────┐     WebSocket (outbound)     ┌─────────────────┐
│  Laptop Agent   │ ──────────────────────────▶  │   KVM Server    │
│  (your machine) │                              │  (vibestudio)   │
└─────────────────┘                              └─────────────────┘
     Executes:                                        Sends:
     - parse-transcript.ts                           - Job requests
     - analyze-story-transcripts.ts                  - JWT tokens
     - list-transcripts.ts
```

**Key Points:**
- Laptop initiates outbound WebSocket connection (NAT-friendly, no public IP needed)
- Pre-shared secret authentication with JWT token issuance
- Whitelisted script execution only (security)
- Auto-reconnect with exponential backoff

---

## Laptop Setup (macOS)

### 1. Configuration File

Create `~/.vibestudio/config.json`:

```json
{
  "serverUrl": "https://vibestudio.example.com",
  "agentSecret": "<secret-from-kvm-.env>",
  "hostname": "pawels-macbook",
  "capabilities": ["parse-transcript", "analyze-story-transcripts", "list-transcripts"],
  "projectPath": "/Users/pawelgawliczek/projects/AIStudio"
}
```

### 2. Build the Agent

```bash
cd /Users/pawelgawliczek/projects/AIStudio/laptop-agent
npm install && npm run build
```

### 3. launchd Auto-Start

The agent auto-starts on login via macOS launchd.

**Plist location:** `~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist`

---

## Useful Commands

```bash
# Check status
launchctl list | grep vibestudio

# View logs
tail -f ~/.vibestudio/agent.log
tail -f ~/.vibestudio/agent.error.log

# Stop agent
launchctl unload ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist

# Start agent
launchctl load ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist

# Restart agent
launchctl unload ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist && \
launchctl load ~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist
```

---

## KVM Server Setup

### SSH Access

The production server SSH alias is `hostinger`:

```bash
ssh hostinger       # Correct - connects to production KVM server
```

The alias is configured in `~/.ssh/config` on the laptop.

### Environment Variable

Add to `/opt/stack/AIStudio/.env`:

```bash
AGENT_SECRET=<same-secret-as-laptop-config>
```

### Restart Backend

After adding the secret:

```bash
docker compose up -d --force-recreate backend
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `remote_agents` | Tracks connected agents (hostname, status, capabilities) |
| `remote_jobs` | Tracks job execution (script, params, status, result) |

---

## Security Model

| Layer | Implementation |
|-------|----------------|
| Authentication | Pre-shared secret for initial registration |
| Authorization | JWT tokens for authenticated communication |
| Execution | Whitelisted scripts only (see `backend/src/remote-agent/approved-scripts.ts`) |
| Parameters | Whitelisted parameters only |
| Transport | WSS encryption in production |

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main Claude Code configuration
- [MCP Debug Guide](MCP_DEBUG_GUIDE.md) - MCP server debugging
