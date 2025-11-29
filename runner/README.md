# Story Runner

Node.js process that orchestrates workflow execution using Claude Code CLI sessions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Story Runner                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ MasterSession│  │ AgentSession │  │   CheckpointService  │  │
│  │  (persistent)│  │ (per-state)  │  │   (DB + file)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ResponseHandler│  │ResourceManager│ │   BackendClient      │  │
│  │ (action→flow) │  │ (limits)     │  │   (API calls)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Master  │   │  Agent   │   │  Agent   │
        │  CLI     │   │  CLI 1   │   │  CLI 2   │
        │ (--session)  │ (--print) │   │ (--print) │
        └──────────┘   └──────────┘   └──────────┘
```

## MasterResponse Protocol

The Master CLI session communicates with the Runner via JSON blocks:

```json
{
  "action": "proceed|spawn_agent|pause|stop|retry|skip|wait|rerun_state",
  "status": "success|error|warning|info",
  "message": "Description of what happened",
  "output": { ... },
  "control": {
    "skipToState": "state-id",
    "retryCount": 3,
    "waitCondition": { "type": "timeout", "timeout": 5000 }
  }
}
```

## Usage

### CLI Commands

```bash
# Start a new workflow run
story-runner start --run-id <uuid> --workflow-id <uuid> [--story-id <uuid>]

# Resume a paused or crashed run
story-runner resume --run-id <uuid>
```

### Docker

```bash
# Build the container
npm run docker:build

# Run with docker-compose
npm run docker:run
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RUNNER_BACKEND_URL` | `http://localhost:3001` | Backend API URL |
| `RUNNER_WORKING_DIRECTORY` | `/workspace` | Claude Code working directory |
| `RUNNER_MAX_TOKEN_BUDGET` | `500000` | Max tokens per run |
| `RUNNER_MAX_AGENT_SPAWNS` | `20` | Max agent processes |
| `RUNNER_MAX_RUN_DURATION` | `7200000` | Max run time (2 hours) |
| `ANTHROPIC_API_KEY` | - | API key for Claude |

## Crash Recovery

The runner uses dual-redundancy checkpoints:

1. **Database**: Stored via backend API
2. **File**: Local JSON file in `.runner/checkpoints/`

On crash, resume with:
```bash
story-runner resume --run-id <uuid>
```

## Resource Limits

Default limits (configurable):

- **Token Budget**: 500,000 tokens
- **Agent Spawns**: 20 max
- **State Transitions**: 50 max
- **Run Duration**: 2 hours

## Backend API Requirements

The runner expects these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows/:id` | GET | Get workflow with states |
| `/api/workflow-runs/:id` | GET/PATCH | Get/update run |
| `/api/stories/:id` | GET | Get story context |
| `/api/component-runs` | POST | Start component run |
| `/api/component-runs/:id` | PATCH | Complete component run |
| `/api/runner/checkpoints` | POST | Save checkpoint |
| `/api/runner/checkpoints/:id` | GET/DELETE | Load/delete checkpoint |

## Integration Points

### ST-146: Breakpoints (Deferred)
- Add `RunnerBreakpoint` checks before/after each state
- Pause when breakpoint condition matches
- Resume via MCP tool

### ST-148: Approval Gates (Deferred)
- Handle `wait` action with `approval` condition
- Block until human approves via UI/API
- Track approval status in WorkflowRun

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally (development)
npm run dev -- start --run-id <uuid> --workflow-id <uuid>

# Run tests
npm test
```

## License

MIT
