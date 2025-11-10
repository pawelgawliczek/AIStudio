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

## 📁 Project Structure

```
AIStudio/
├── backend/              # NestJS backend application
│   ├── src/
│   │   ├── auth/         # Authentication module
│   │   ├── projects/     # Project management module
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

### ✅ Phase 1: Foundation (Current)

- ✅ Monorepo structure setup
- ✅ Docker Compose with PostgreSQL + Redis
- ✅ Database schema with Prisma
- ✅ NestJS backend scaffolding
- ✅ React frontend with Vite + TailwindCSS
- ✅ Authentication (JWT)
- ✅ CI/CD pipeline (GitHub Actions)

### 🔄 Phase 2: MCP Server & Core API (Next)

- MCP Server with core tools
- Project Management API
- Story workflow state machine
- Basic Web UI shell

### 📅 Future Phases

- Phase 3: Use Case Library & Telemetry (MVP Target)
- Phase 4: Code Quality & Metrics
- Phase 5: Testing & QA Features
- Phase 6: Polish & Release

See [plan.md](./plan.md) for detailed sprint breakdown.

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

**Status**: Phase 1 - Foundation ✅ Complete | Sprint 1 of 12

**Version**: 0.1.0

**Last Updated**: 2025-11-10
