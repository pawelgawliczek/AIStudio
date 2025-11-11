# AI Studio Backend Architecture - Complete Documentation Index

## Overview

This directory contains comprehensive documentation of the AI Studio backend architecture, spanning 2,366 lines across three detailed documents.

---

## Documentation Files

### 1. BACKEND_ARCHITECTURE_ANALYSIS.md (1,313 lines, 35KB)
**Comprehensive Technical Deep Dive**

Complete architectural analysis covering:
- **Section 1:** NestJS Module Organization (15 modules)
- **Section 2:** Data Layer & Prisma Schema (Database design, relationships, indexes)
- **Section 3:** Service Layer Patterns (Business logic, validation, transactions)
- **Section 4:** MCP Server Implementation (Progressive disclosure, tool registry, registry/loader architecture)
- **Section 5:** Common Infrastructure (Exception filters, authentication, logging)
- **Section 6:** Real-time Communication (WebSocket gateway, Socket.IO events)
- **Section 7:** API Design Patterns (REST conventions, Swagger documentation)
- **Section 8:** Technology Stack (Dependencies and frameworks)
- **Section 9:** Architectural Principles (Type safety, progressive disclosure, scalability)
- **Section 10:** Development & Deployment

**Best for:** Understanding the complete system architecture, design decisions, and implementation details.

---

### 2. BACKEND_ARCHITECTURE_DIAGRAM.md (643 lines, 37KB)
**Visual Architecture & Flow Diagrams**

ASCII diagrams and flowcharts showing:
- **Section 1:** High-level system overview (15 modules, MCP server, PostgreSQL)
- **Section 2:** Module dependencies graph (AppModule relationships)
- **Section 3:** Request flow architecture
  - HTTP request pipeline (10 stages: CORS → Validation → Guards → Logging → Service)
  - MCP tool request flow (Tool discovery and execution)
- **Section 4:** Database schema hierarchy (Project relationships)
- **Section 5:** Story creation data flow (End-to-end creation process)
- **Section 6:** Progressive disclosure tool discovery (Three detail levels)
- **Section 7:** Authentication & authorization flow (JWT + RBAC)
- **Section 8:** Service dependencies pattern (Dependency injection)
- **Section 9:** Error handling flow (Exception filters and logging)
- **Section 10:** MCP tool implementation structure (Tool loading and execution)

**Best for:** Visual learners, understanding data flows, and system interactions.

---

### 3. BACKEND_QUICK_REFERENCE.md (410 lines, 13KB)
**Quick Reference & Cheat Sheet**

Quick lookup guide including:
- **Entry Points:** File locations for REST API, MCP server, database schema
- **Directory Structure:** Backend folder organization with brief descriptions
- **15 Domain Modules:** Table overview of each module's purpose and entities
- **Service Layer Architecture:** Pattern description and StoriesService example
- **Data Layer (Prisma):** Core tables, relationships, constraints, indexes
- **MCP Server Implementation:** Architecture, progressive disclosure levels, tool structure
- **Authentication & Authorization:** Login flow, guards, decorators, roles
- **API Endpoints:** Standard CRUD patterns and custom endpoints
- **Error Handling:** Response format and exception types
- **WebSocket Events:** Real-time event types and patterns
- **Development Commands:** Running, testing, database commands
- **Configuration:** Environment variables and key files
- **Testing Infrastructure:** Test file organization and metrics
- **Performance Optimization:** Database indexes, pagination, vector search
- **Key Architectural Decisions:** 10 core design decisions
- **Useful Links:** Quick access to documentation and tools

**Best for:** Quick lookups, command reference, and developers new to the project.

---

## Key Statistics

| Metric | Value |
|--------|-------|
| **Total Documentation** | 2,366 lines |
| **Analysis Document** | 1,313 lines (11 sections) |
| **Diagrams Document** | 643 lines (10 diagrams) |
| **Quick Reference** | 410 lines (16 sections) |
| **Backend Modules** | 15 (Auth, Projects, Stories, etc.) |
| **MCP Tool Categories** | 9 (Meta, Projects, Stories, etc.) |
| **Database Tables** | 17 (Projects, Stories, Runs, etc.) |
| **Service Classes** | 15+ |
| **API Controllers** | 15+ |

---

## Architecture at a Glance

### Stack
- **Framework:** NestJS 10.3 (TypeScript)
- **Database:** PostgreSQL + Prisma ORM
- **Extensions:** pgvector (semantic search), pg_trgm (full-text)
- **Authentication:** JWT + Passport.js + RBAC
- **Real-time:** Socket.IO (WebSocket)
- **Logging:** Winston
- **API Docs:** Swagger/OpenAPI
- **MCP Server:** Stdio-based tool server

### Core Concepts
1. **15 Domain Modules** - Feature-based organization
2. **Story State Machine** - 8-state workflow (planning → done)
3. **Progressive Disclosure** - Tool discovery at 3 detail levels
4. **Vector Database** - pgvector for semantic search on use cases
5. **Global Services** - Prisma available to all modules
6. **Real-time Updates** - WebSocket events for live collaboration
7. **Role-based Access** - 7 role types with decorator-based RBAC
8. **Type Safety** - End-to-end TypeScript + Prisma types

---

## Module Organization

### Domain Modules (15)
1. **AuthModule** - JWT authentication & RBAC
2. **ProjectsModule** - Project CRUD
3. **StoriesModule** - Feature/bug tracking with state machine
4. **EpicsModule** - Epic organization
5. **SubtasksModule** - Story decomposition
6. **UseCasesModule** - Requirements with semantic search
7. **TestCasesModule** - Test specifications
8. **TestExecutionsModule** - Test results & coverage
9. **CommitsModule** - Git commit tracking
10. **RunsModule** - Agent execution tracking
11. **CodeMetricsModule** - Code quality analytics
12. **AgentMetricsModule** - Agent performance analytics
13. **UsersModule** - User management
14. **WebSocketModule** - Real-time communication
15. **PrismaModule** - Database (Global)

---

## Service Layer Pattern

```
Controller
  ↓ (HTTP Request)
Guard (JWT Auth, RBAC)
  ↓
ValidationPipe (DTO validation)
  ↓
Controller Handler
  ↓
Service Layer
  ├─ Prisma queries
  ├─ Business logic validation
  ├─ Error handling
  └─ WebSocket events
  ↓
Response Formatting
  ↓
HTTP Response / Exception Filter
```

---

## Database Hierarchy

```
Project (Root)
├── Epic → Story → Subtask → Run
├── UseCase → UseCaseVersion (with embeddings)
├── TestCase → TestExecution
├── Commit → CommitFile
├── Agent / AgentFramework → Run
├── Release → ReleaseItem
└── AuditLog
```

---

## MCP Server Architecture

```
Agent Client
    ↓
MCP Server (stdio)
    ↓
ToolRegistry (discovery & execution)
    ↓
ToolLoader (dynamic filesystem loading)
    ↓
Tool Handlers (9 categories, 20+ tools)
    ↓
Prisma Client (database access)
    ↓
PostgreSQL
```

---

## How to Use This Documentation

### I want to...

**Understand the overall architecture:**
→ Start with BACKEND_ARCHITECTURE_ANALYSIS.md Sections 1-2

**See how data flows:**
→ Check BACKEND_ARCHITECTURE_DIAGRAM.md Sections 3-5

**Learn MCP implementation:**
→ BACKEND_ARCHITECTURE_ANALYSIS.md Section 4
→ BACKEND_ARCHITECTURE_DIAGRAM.md Sections 2, 6, 10

**Find a specific command:**
→ BACKEND_QUICK_REFERENCE.md "Development Commands" section

**Understand authentication:**
→ BACKEND_ARCHITECTURE_ANALYSIS.md Section 5.2
→ BACKEND_ARCHITECTURE_DIAGRAM.md Section 7

**Learn about a specific module:**
→ BACKEND_QUICK_REFERENCE.md "Domain Modules" table
→ BACKEND_ARCHITECTURE_ANALYSIS.md Sections 1 or 3

**Set up the project:**
→ BACKEND_QUICK_REFERENCE.md Configuration section

**Debug an issue:**
→ BACKEND_ARCHITECTURE_DIAGRAM.md "Error Handling Flow"
→ BACKEND_ARCHITECTURE_ANALYSIS.md Section 5.1

---

## Key Files to Explore

### Entry Points
- `/src/main.ts` - REST API bootstrap
- `/src/mcp/server.ts` - MCP server bootstrap
- `/src/app.module.ts` - Root module definition

### Infrastructure
- `/src/common/` - Global filters, interceptors, logger
- `/src/auth/` - Authentication & authorization
- `/src/prisma/` - Database service

### MCP Implementation
- `/src/mcp/core/registry.ts` - Tool registry
- `/src/mcp/core/loader.ts` - Tool loader
- `/src/mcp/servers/` - Tool implementations (9 directories)

### Database
- `/prisma/schema.prisma` - Database schema (17 models)
- `/prisma/seed.ts` - Initial data seeding

---

## Architecture Principles

1. **Separation of Concerns** - Controllers, Services, Data Layer
2. **Type Safety** - End-to-end TypeScript + Prisma
3. **Modularity** - 15 independent feature modules
4. **Security** - JWT + RBAC with guard-based enforcement
5. **Observability** - Winston logging, request interceptors
6. **Scalability** - Database indexes, pagination, horizontal scaling
7. **Maintainability** - DTOs, consistent patterns, Swagger docs
8. **Real-time** - WebSocket support for live updates
9. **Progressive Disclosure** - Efficient tool discovery for agents
10. **State Management** - Story workflow state machine

---

## Technology Choices

| Aspect | Technology | Reason |
|--------|-----------|--------|
| Framework | NestJS | Enterprise structure, DI, decorators |
| Language | TypeScript | Type safety, compile-time checks |
| Database | PostgreSQL | Relational, extensions (pgvector, pg_trgm) |
| ORM | Prisma | Type-safe, migrations, studio GUI |
| Auth | JWT + Passport | Stateless, scalable, industry standard |
| Real-time | Socket.IO | WebSocket abstraction, cross-platform |
| Logging | Winston | Structured logging, multiple transports |
| API Docs | Swagger | Auto-generated, interactive |
| Testing | Jest | Industry standard for Node.js |
| Validation | class-validator | Decorator-based, composable |
| AI Integration | MCP + OpenAI | Model Context Protocol for agents |

---

## Next Steps

1. **Read** BACKEND_ARCHITECTURE_ANALYSIS.md for deep understanding
2. **Reference** BACKEND_ARCHITECTURE_DIAGRAM.md for visual flows
3. **Bookmark** BACKEND_QUICK_REFERENCE.md for quick lookups
4. **Explore** `/src` directory following the documented patterns
5. **Review** Database schema at `/prisma/schema.prisma`
6. **Check** MCP server implementation at `/src/mcp/`
7. **Test** API endpoints at `http://localhost:3000/api/docs`
8. **Run** MCP server with `npm run mcp:dev`

---

## Contributing

When adding new features:
1. Follow the modular pattern (Module → Service → Controller → DTO)
2. Use Prisma for database access
3. Add Swagger decorators for API docs
4. Implement proper error handling
5. Add WebSocket events for real-time updates
6. Update this documentation

---

## Support

- **API Documentation:** http://localhost:3000/api/docs (Swagger UI)
- **Database GUI:** `npm run db:studio` (Prisma Studio)
- **Full Analysis:** BACKEND_ARCHITECTURE_ANALYSIS.md
- **Visual Flows:** BACKEND_ARCHITECTURE_DIAGRAM.md
- **Quick Lookup:** BACKEND_QUICK_REFERENCE.md

---

## Document Metadata

| Property | Value |
|----------|-------|
| Generated | 2024-11-11 |
| Project | AI Studio |
| Backend | NestJS 10.3 |
| Database | PostgreSQL |
| Documentation Version | 1.0 |

