# AI Studio - MCP Control Plane

A unified platform for managing AI agentic frameworks, tracking their effectiveness, and providing complete traceability from requirements to code to metrics.

## 📋 Project Overview

AI Studio is an MCP (Model Context Protocol) control plane designed to:

- **Manage AI Projects**: Track projects, epics, stories, and subtasks with JIRA-like interface
- **Automatic Telemetry**: Zero-friction metrics collection from AI agents via MCP protocol
- **Framework Comparison**: Compare effectiveness of different agentic frameworks
- **Code Quality Monitoring**: Track complexity, churn, and hotspots
- **Living Documentation**: Use case library with semantic search
- **Test Coverage**: Track unit, integration, and E2E test coverage

## 🏗️ Architecture

The system follows a 4-tier layered architecture:

- **Presentation Layer**: React Web UI, MCP Server, CLI Tool
- **Application Layer**: NestJS REST API, WebSocket Gateway, Background Workers
- **Domain Layer**: Business logic for projects, agents, quality analysis, use cases
- **Infrastructure Layer**: PostgreSQL with pgvector, Redis, Git hooks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/pawelgawliczek/AIStudio.git
cd AIStudio
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Edit the `.env` files with your configuration.

4. **Start the development environment**

```bash
# Start PostgreSQL and Redis
npm run docker:up

# Run database migrations
npm run db:migrate:dev

# Seed the database (optional)
npm run db:seed

# Start backend and frontend
npm run dev
```

The application will be available at:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs

### Using Docker Compose Only

Alternatively, you can run everything in Docker:

```bash
docker compose up -d
```

## 🔌 MCP Server Setup

AI Studio includes an MCP (Model Context Protocol) server for integration with Claude Code and other MCP-compatible clients.

### Quick MCP Setup

1. **Build the backend**

```bash
npm run build:backend
```

2. **Configure Claude Code**

Add to your Claude Code configuration file:

**Development Mode (using ts-node):**
```json
{
  "mcpServers": {
    "aistudio": {
      "command": "npx",
      "args": ["ts-node", "--esm", "backend/src/mcp/server.ts"],
      "cwd": "/path/to/AIStudio",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/aistudio?schema=public",
        "NODE_ENV": "development"
      }
    }
  }
}
```

**Production Mode (using built files):**
```json
{
  "mcpServers": {
    "aistudio": {
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

3. **Start using MCP tools in Claude Code**

The MCP server provides 10 tools for Sprint 3:
- `bootstrap_project` - Create project with default structure
- `create_project` - Create basic project
- `list_projects` - List all projects
- `get_project` - Get project details
- `create_epic` - Create an epic
- `list_epics` - List epics
- `create_story` - Create a story
- `list_stories` - List stories with filters
- `get_story` - Get story details
- `update_story` - Update story

Example usage:
```
Ask Claude: "Use the bootstrap_project tool to create a project called 'MyApp'"
```

See [backend/src/mcp/README.md](./backend/src/mcp/README.md) for detailed MCP documentation.

### Running MCP Server Standalone

For testing or debugging:

```bash
npm run mcp:dev
```

## 📁 Project Structure

```
AIStudio/
├── backend/              # NestJS backend application
│   ├── src/
│   │   ├── auth/         # Authentication module
│   │   ├── projects/     # Project management module
│   │   ├── users/        # User management module
│   │   ├── mcp/          # MCP Server (Sprint 3)
│   │   │   ├── server.ts # MCP server entry point
│   │   │   ├── tools/    # MCP tool implementations
│   │   │   ├── types.ts  # MCP type definitions
│   │   │   └── utils.ts  # MCP utilities
│   │   ├── prisma/       # Prisma ORM service
│   │   └── main.ts       # Application entry point
│   └── prisma/
│       └── schema.prisma # Database schema
├── frontend/             # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   └── main.tsx      # Application entry point
│   └── vite.config.ts    # Vite configuration
├── shared/               # Shared types and utilities
│   └── src/
│       ├── types.ts      # Common type definitions
│       └── constants.ts  # Shared constants
├── scripts/              # Utility scripts
├── .github/              # GitHub Actions CI/CD
├── docker-compose.yml    # Docker services configuration
└── package.json          # Monorepo root package
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start backend + frontend in dev mode
npm run dev:backend      # Start backend only
npm run dev:frontend     # Start frontend only

# Database
npm run db:migrate:dev   # Run database migrations
npm run db:migrate:deploy # Deploy migrations (production)
npm run db:seed          # Seed database with test data
npm run db:reset         # Reset database (⚠️ deletes all data)
npm run db:studio        # Open Prisma Studio

# Testing
npm test                 # Run all tests
npm run test:backend     # Run backend tests
npm run test:frontend    # Run frontend tests
npm run test:coverage    # Generate coverage report

# Linting & Formatting
npm run lint             # Lint all workspaces
npm run format           # Format all files
npm run format:check     # Check formatting
npm run typecheck        # Type check all workspaces

# Building
npm run build            # Build all workspaces
npm run build:backend    # Build backend only
npm run build:frontend   # Build frontend only

# Docker
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
npm run docker:logs      # View Docker logs
```

### Database Migrations

Create a new migration:

```bash
cd backend
npx prisma migrate dev --name your_migration_name
```

## 🧪 Testing

The project uses Jest for backend testing and Vitest for frontend testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm run test:coverage
```

## 📚 Documentation

- **[Requirements](./req.md)**: Detailed requirements specification
- **[Architecture](./architecture.md)**: System architecture and design decisions
- **[Development Plan](./plan.md)**: Sprint plan and implementation roadmap
- **[Use Cases](./use-cases/)**: All 36 use cases organized by role
- **[Designs](./designs/)**: UI designs for 5 main screens
- **[API Documentation](http://localhost:3000/api/docs)**: Swagger/OpenAPI docs (when running)

## 🗓️ Development Phases

### ✅ Phase 1: Foundation (COMPLETE)

- ✅ Sprint 1: Monorepo structure setup
- ✅ Sprint 1: Docker Compose with PostgreSQL + Redis
- ✅ Sprint 1: Database schema with Prisma
- ✅ Sprint 1: NestJS backend scaffolding
- ✅ Sprint 1: React frontend with Vite + TailwindCSS
- ✅ Sprint 2: Authentication (JWT + RBAC)
- ✅ Sprint 2: Projects & Users CRUD API
- ✅ Sprint 2: CI/CD pipeline (GitHub Actions)

### ✅ Phase 2: MCP Server & Core API (COMPLETE)

- ✅ Sprint 3: MCP Server with 10 core tools
- ✅ Sprint 3: Project, Epic, Story management tools
- ✅ Sprint 3: Claude Code integration
- ✅ Sprint 4.5: Progressive disclosure architecture
- ✅ Sprint 4.5: File-based tool organization with auto-discovery

### ✅ Phase 3: Use Case Library & Telemetry (COMPLETE)

- ✅ Sprint 5: Use case CRUD API with versioning
- ✅ Sprint 5: Component/layer-based search
- ✅ Sprint 5: Use case linking to stories (4 MCP tools)
- ✅ Sprint 6: Telemetry collection (log_run, link_commit)
- ✅ Sprint 6: Git post-commit hooks
- ✅ Sprint 6: Agent execution tracking

### 🔄 Phase 4: Code Quality & Metrics (Current - Sprint 7 Complete)

- ✅ Sprint 7: Code quality analysis with health scores
- ✅ Sprint 7: Hotspot detection algorithm
- ✅ Sprint 7: Code Quality Dashboard UI
- ✅ Sprint 7: Architect MCP tools (get_architect_insights, get_component_health)
- 🚧 Sprint 8: Agent Performance Metrics (In Progress)
- Next: Framework comparison dashboard
- Next: Metrics aggregation worker

### 📅 Future Phases

- Phase 5: Testing & QA Features (Sprints 9-10)
- Phase 6: Polish & Release (Sprints 11-12)

**Current Sprint:** Sprint 8 - Agent Performance Metrics
**Completion:** 7 of 12 sprints complete (58%)
**Status:** On track for MVP (Sprint 6 backend complete)

See [plan.md](./plan.md) for detailed sprint breakdown and [SPRINT_7_SUMMARY.md](./SPRINT_7_SUMMARY.md) for latest implementation details.

## 🤝 Contributing

This project is currently in active development. Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

```bash
# Before committing
npm run lint
npm run typecheck
npm test
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **GitHub**: https://github.com/pawelgawliczek/AIStudio
- **Documentation**: See `docs/` directory
- **Issues**: https://github.com/pawelgawliczek/AIStudio/issues

## 📞 Support

For questions or issues, please:

1. Check the [documentation](./docs/)
2. Search [existing issues](https://github.com/pawelgawliczek/AIStudio/issues)
3. Create a new issue if needed

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- UI powered by [React](https://react.dev/) and [TailwindCSS](https://tailwindcss.com/)
- Database with [PostgreSQL](https://www.postgresql.org/) and [Prisma](https://www.prisma.io/)
- MCP integration via [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)

---

**Status**: Phase 2 - MCP Server & Core API 🔄 | Sprint 3 of 12

**Version**: 0.1.0

**Last Updated**: 2025-11-10
