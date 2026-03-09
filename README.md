# AI Studio

A platform that lets you run Claude Code as a coordinated team of agents instead of one long session. You define workflows with states like analysis, architecture, and implementation. Each state spawns a specialized agent. Everything gets tracked: tokens, cost, files changed, commits.

## What it does

AI Studio sits between you and Claude Code. It connects via MCP (Model Context Protocol) and gives you tools to manage how features get built.

The idea is simple: instead of dumping a big task into one Claude session and hoping for the best, you break it into phases. Each phase gets its own agent with specific instructions and access to the artifacts it needs. A PM agent analyzes requirements. An Explorer agent investigates the codebase. An Architect writes the design doc. An Implementer writes the code. You orchestrate the whole thing with a few MCP commands, and the system records what each agent did.

## Features

- **Story and epic management** - create, update, and track work items through MCP tools
- **Multi-agent workflows** - define a sequence of states, each with its own agent type and config
- **Orchestrator loop** - `get_current_step` / `advance_step` / `repeat_step` to control execution
- **Automatic telemetry** - token counts, cost, duration, files modified, commits, lines of code per agent run
- **Versioned artifacts** - architecture docs, design specs, plans, all with version history
- **Approval gates** - pause the workflow for human review, then approve, reject with feedback, or edit artifacts
- **Remote execution** - run agents on your laptop or on a server, with failover if the remote goes offline
- **Live streaming** - watch agents work in real time via WebSocket

## Architecture

```
Frontend (React + Vite + Tailwind)
    |
Backend (NestJS + Prisma + PostgreSQL + pgvector)
    |
MCP Server (11 categories, 60+ tools)
    |
Claude Code (Task agents spawned per workflow state)
```

- **Backend**: NestJS with Prisma ORM. PostgreSQL with pgvector for semantic search. WebSocket gateway for streaming. REST API with JWT auth.
- **Frontend**: React with Vite and TailwindCSS. Workflow monitoring, story boards, artifact viewer.
- **MCP Server**: 25 core tools loaded for every agent. Another 40+ discoverable via `search_tools`.
- **Agent components**: PM, Explorer, Architect, Designer, Implementer. Each has its own instructions and artifact access rules.

## MCP commands

### Story management

| Command | Description |
|---------|-------------|
| `create_story` | Create a new story with title, type, and priority |
| `get_story` | Get story details by ID or key (ST-123) |
| `update_story` | Update status, description, or assignment |
| `list_stories` | Search and filter stories across projects |

### Workflow execution

| Command | Description |
|---------|-------------|
| `list_teams` | List available workflow teams |
| `start_team_run` | Start a workflow run for a story |
| `get_current_step` | Get instructions for the current phase |
| `advance_step` | Move to the next phase or state |
| `repeat_step` | Retry current state with feedback |
| `get_runner_status` | Check workflow execution status |

### Artifacts and context

| Command | Description |
|---------|-------------|
| `create_artifact` | Create or update a versioned artifact |
| `get_artifact` | Retrieve artifact by ID or key |
| `list_artifacts` | List artifacts for a story or workflow run |
| `get_component_context` | Get component instructions and artifact access |
| `search_tools` | Find tools by keyword or category |
| `invoke_tool` | Call any non-core tool by name |

## 📊 Telemetry Dashboards

Every agent run is tracked automatically: tokens, cost, duration, files changed, commits, lines of code. These dashboards show the data collected across weekly sprints.

| Weekly KPI Timeline | KPI Trend Explorer |
|---|---|
| ![Agent effectiveness timeline](https://pawelgawliczek.cloud/agenteffectivness1.webp) | ![KPI trends across weeks](https://pawelgawliczek.cloud/agenteffectivness2.webp) |

## How a workflow runs

```
1. start_team_run({ story: 'ST-123', teamId: '...' })
   -> Creates WorkflowRun, sets up state tracking

2. get_current_step({ story: 'ST-123' })
   -> Returns pre-execution instructions, agent spawn config, post-execution validation

3. Spawn agent via Task tool with the provided config
   -> Agent does the work (coding, analysis, etc.)
   -> Artifacts written to docs/ST-123/*.md (auto-uploaded)

4. advance_step({ story: 'ST-123', output: agentResult })
   -> Tracks metrics, generates summary, moves to next state

5. Repeat steps 2-4 until the workflow completes
```

Each state runs in three phases:
- **Pre-execution** - the orchestrator gathers context and prepares inputs
- **Agent execution** - a specialized agent does the actual work
- **Post-execution** - the orchestrator validates output and updates story status

## Quick start

### Prerequisites

- Docker and Docker Compose
- Claude Code with MCP support
- Node.js 18+ (for development)

### Setup

```bash
git clone https://github.com/pawelgawliczek/AIStudio.git
cd AIStudio
cp .env.example .env
# Edit .env with your configuration
docker compose up -d
```

### MCP configuration

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "vibestudio": {
      "command": "node",
      "args": ["backend/dist/mcp/server.js"],
      "cwd": "/path/to/AIStudio",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/aistudio?schema=public"
      }
    }
  }
}
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

## Project structure

```
AIStudio/
├── backend/              # NestJS backend
│   ├── src/
│   │   ├── mcp/          # MCP server (11 tool categories)
│   │   ├── projects/     # Project management
│   │   ├── auth/         # JWT authentication
│   │   └── prisma/       # Database service
│   └── prisma/
│       └── schema.prisma # Database schema
├── frontend/             # React frontend
│   └── src/
│       ├── components/   # UI components
│       └── pages/        # Page views
├── runner/               # Docker-based story runner
├── sdk/                  # MCP HTTP client SDK
├── scripts/              # Utility scripts
├── docs/                 # Architecture and system docs
└── docker-compose.yml    # Full stack deployment
```

## Development

```bash
# Start dev environment
npm run dev

# Database migrations
cd backend && npx prisma migrate dev --name description

# Run tests
npm test

# Type checking
npm run typecheck
```

## License

MIT

![](https://analytics.pawelgawliczek.cloud/p/aistudio)
