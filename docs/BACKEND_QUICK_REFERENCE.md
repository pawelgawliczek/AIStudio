# AI Studio Backend - Quick Reference

## Key Files & Paths

### Entry Points
- **REST API Entry:** `/home/user/AIStudio/backend/src/main.ts`
- **MCP Server Entry:** `/home/user/AIStudio/backend/src/mcp/server.ts`
- **Database Schema:** `/home/user/AIStudio/backend/prisma/schema.prisma`
- **App Config:** `/home/user/AIStudio/backend/src/app.module.ts`

### Directory Structure
```
backend/
├── src/
│   ├── main.ts                    # NestJS bootstrap
│   ├── app.module.ts              # Root module
│   ├── health.controller.ts       # Health check
│   ├── common/                    # Global infrastructure
│   │   ├── filters/               # Exception handling
│   │   ├── interceptors/          # Request/response logging
│   │   └── logger/                # Winston logger
│   ├── auth/                      # Authentication (JWT, Roles)
│   ├── prisma/                    # Database service (global)
│   ├── websocket/                 # Real-time WebSocket gateway
│   ├── mcp/                       # MCP Server implementation
│   │   ├── core/                  # Registry & Loader
│   │   ├── servers/               # Tool implementations (9 categories)
│   │   ├── types.ts               # Type definitions
│   │   └── utils.ts               # Utility functions
│   └── [domain-modules]/          # 14 feature modules
│       └── [module-name]/
│           ├── [module].module.ts
│           ├── [module].service.ts
│           ├── [module].controller.ts
│           └── dto/
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── seed.ts                    # Initial seed
│   └── seed-demo.ts               # Demo data
├── package.json
└── tsconfig.json
```

---

## Domain Modules (15 Total)

| Module | Purpose | Key Entities |
|--------|---------|--------------|
| **AuthModule** | JWT authentication, Passport strategies, RBAC | User credentials, tokens, roles |
| **ProjectsModule** | Project management | Project CRUD |
| **StoriesModule** | Story/feature tracking | Story state machine, status workflow |
| **EpicsModule** | Epic organization | Epic hierarchy |
| **SubtasksModule** | Story decomposition | Subtask layers (frontend/backend/infra/test) |
| **UseCasesModule** | Requirements, semantic search | UseCase versions with pgvector embeddings |
| **TestCasesModule** | Test case definitions | Test specs (unit/integration/e2e) |
| **TestExecutionsModule** | Test execution results | Test run results with coverage |
| **CommitsModule** | Git commit tracking | Commit hashes, file changes, metrics |
| **RunsModule** | Agent execution tracking | Agent runs with token costs |
| **CodeMetricsModule** | Code quality metrics | Complexity, coverage, churn |
| **AgentMetricsModule** | Agent performance analytics | Framework comparisons, efficiency |
| **UsersModule** | User management | User profiles, roles |
| **WebSocketModule** | Real-time communication | Socket.IO gateway |
| **PrismaModule** | Database (Global) | PostgreSQL ORM layer |

---

## Service Layer Architecture

### Pattern
Each service follows:
1. **Constructor injection** - Dependencies provided by NestJS DI
2. **Prisma queries** - Database access via PrismaService
3. **Error handling** - Custom exceptions (NotFoundException, BadRequestException, etc.)
4. **Business logic** - Validation, state management, orchestration
5. **Response formatting** - DTOs for consistent API responses

### Example: StoriesService
```typescript
@Injectable()
export class StoriesService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebSocketGateway,
  ) {}
  
  // Story workflow state machine (8 states)
  // planning → analysis → architecture → design 
  // → implementation → review → qa → done
  
  async create(dto: CreateStoryDto, userId: string)
  async update(id: string, dto: UpdateStoryDto)
  async updateStatus(id: string, newStatus: StoryStatus)
  
  // Validates workflow transitions
  // Emits WebSocket events
  // Formats responses
}
```

---

## Data Layer (Prisma)

### Core Tables
| Table | Purpose | Relations |
|-------|---------|-----------|
| **users** | User accounts | Projects (created_stories), Roles |
| **projects** | Project container | All domain entities |
| **epics** | Feature grouping | Stories |
| **stories** | Features/bugs/tasks | Subtasks, UseCase links, Commits, Runs, TestExecutions |
| **subtasks** | Story decomposition | Runs |
| **use_cases** | Requirements | Versions, StoryLinks, TestCases |
| **use_case_versions** | Versioned content with embeddings | pgvector (1536 dimensions) |
| **test_cases** | Test specifications | Executions |
| **test_executions** | Test results | Coverage, status (pass/fail/skip/error) |
| **commits** | Git metadata | CommitFiles, linked stories/epics |
| **commit_files** | File-level changes | LOC, complexity, coverage deltas |
| **agents** | Individual agents | Runs |
| **agent_frameworks** | Multi-agent systems | Runs, Story assignments |
| **runs** | Agent executions | Metadata, token counts |
| **releases** | Release management | ReleaseItems |
| **audit_log** | Activity tracking | All entity changes |
| **defects** | Bug tracking | Origin/discovery stages, severity |

### Key Constraints
- **Unique:** `[projectId, key]` for Epic, Story, UseCase, TestCase
- **Cascade delete:** Project → all children
- **Indexes:** `[projectId, status]`, `[projectId, startedAt]`, `[filePath]`, etc.
- **Vector:** UseCaseVersion.embedding (pgvector for semantic search)

---

## MCP Server Implementation

### Architecture
```
MCP Server (stdio)
    ↓
Tool Registry (manages discovery)
    ↓
Tool Loader (dynamic filesystem loading)
    ↓
9 Tool Categories (servers/ directory)
    ├─ meta/
    ├─ projects/
    ├─ stories/
    ├─ epics/
    ├─ use-cases/
    ├─ telemetry/
    ├─ test-coverage/
    ├─ code-quality/
    └─ tools/
```

### Progressive Disclosure
Agents discover tools at three detail levels:
1. **names_only** (~100 bytes) - Just names
2. **with_descriptions** (~500 bytes) - Names + descriptions
3. **full_schema** (~1KB) - Complete tool definitions with input schemas

### Tool Structure
Each tool exports:
```typescript
export const tool: Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

export const metadata {
  category: string;
  domain: string;
  tags: string[];
  version: string;
  since: string;
}

export async function handler(
  prisma: PrismaClient,
  params: any
): Promise<any>
```

---

## Authentication & Authorization

### Flow
1. **User Login** → POST /api/auth/login
2. **Validate** credentials (email + bcrypt password check)
3. **Generate JWT** (access token: 15m, refresh token: 7d)
4. **Return tokens** + user info

### Guards & Decorators
- **@UseGuards(AuthGuard('jwt'))** - Verify JWT token
- **@UseGuards(RolesGuard)** - Check user role
- **@Roles(UserRole.admin, pm, ba)** - Specify required roles
- **@Public()** - Skip auth (for login endpoint)

### Roles
- admin, pm (project manager), ba (business analyst)
- architect, dev, qa, viewer

---

## API Endpoints (REST)

### Standard CRUD Pattern
```
GET    /api/{resource}              # List with filters
GET    /api/{resource}/:id          # Get single
POST   /api/{resource}              # Create
PATCH  /api/{resource}/:id          # Update
DELETE /api/{resource}/:id          # Delete
```

### Custom Endpoints
```
PATCH  /api/stories/:id/status      # Update with workflow validation
GET    /api/projects/:id            # Include counts and summary
GET    /api/use-cases/search        # Semantic search with OpenAI
GET    /api/metrics/framework       # Analytics and comparisons
GET    /api/health                  # Health check
```

### All Endpoints
See `/api/docs` (Swagger UI) for complete documentation

---

## Error Handling

### Response Format
```json
{
  "statusCode": 400,
  "timestamp": "2024-11-11T10:30:45.123Z",
  "path": "/api/stories",
  "method": "POST",
  "message": "Invalid status transition from planning to done"
}
```

### Exception Types
- **NotFoundException** (404) - Resource not found
- **BadRequestException** (400) - Invalid input or business logic error
- **ForbiddenException** (403) - Permission denied
- **ConflictException** (409) - Duplicate key or constraint violation
- **UnauthorizedException** (401) - Authentication failed

### Logging
- **5xx errors** → logged as errors with stack trace
- **4xx errors** → logged as warnings
- **All requests** → logged via LoggingInterceptor

---

## WebSocket Real-time Events

### Gateway: WebSocketGateway
Endpoints: `ws://localhost:3000` (same port as REST API)

### Events
```typescript
// Client → Server
client.emit('join-room', { room: 'project-123' })
client.emit('leave-room', { room: 'project-123' })

// Server → Client
server.emit('user-joined', { userId, socketId })
server.emit('user-left', { userId })
server.emit('story-updated', { storyId, update })
server.emit('active-users-updated', { room, count })
```

---

## Development Commands

### Running
```bash
# Backend REST API
npm run dev              # Watch mode
npm start               # Production

# MCP Server
npm run mcp:dev         # Development mode
ts-node src/mcp/server.ts

# Database
npm run db:migrate:dev  # Create/apply migrations
npm run db:seed         # Seed data
npm run db:studio       # Prisma Studio (GUI)

# Testing
npm test                # Jest unit tests
npm run test:cov        # Coverage report
npm run test:e2e        # E2E tests
```

### Database
```bash
npm run db:migrate:dev          # Create migration
npm run db:migrate:deploy       # Apply migrations (prod)
npm run db:seed                 # Run seed.ts
npm run db:seed:demo            # Run seed-demo.ts
npm run db:reset                # Reset (DEV ONLY)
npm run db:generate             # Generate Prisma client
```

---

## Configuration

### Environment Variables
```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aistudio

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info

# Optional: AI Integrations
OPENAI_API_KEY=sk-...
```

### Files
- `.env` - Environment variables
- `.env.example` - Template
- `nest-cli.json` - NestJS CLI config
- `tsconfig.json` - TypeScript config
- `package.json` - Dependencies and scripts

---

## Testing Infrastructure

### Test Files
- `*.spec.ts` - Unit tests (Jest)
- `test/jest-e2e.json` - E2E config
- Coverage reports in `coverage/` directory

### Database Models
- **TestCase** - Test specifications (unit/integration/e2e)
- **TestExecution** - Test run results (pass/fail/skip/error)
- Coverage tracked: percentage, lines_covered, lines_total

### Code Metrics
- **Commits** tracked with file-level metrics
- **CommitFile** records LOC changes (added/deleted)
- **Complexity** before/after per file
- **Coverage** before/after per file

---

## Performance Optimization

### Database Indexes
- `[projectId, status]` - Story filtering
- `[projectId, startedAt]` - Run time-series
- `[filePath]` - Commit file lookup
- `[entityType, entityId]` - Audit trails

### Pagination
- Default pageSize: 20
- Max pageSize: 100
- Supports page-based pagination in tools

### Vector Search
- UseCase embeddings: 1536 dimensions (OpenAI)
- pgvector extension for similarity search
- Full-text search: pg_trgm extension

### Caching Opportunities
- Use-case versions (versioned content)
- Project aggregate counts
- Framework metrics (cacheable analytics)

---

## Key Architectural Decisions

1. **Modular NestJS** - 15 feature modules, clear separation of concerns
2. **Prisma ORM** - Type-safe database access with migrations
3. **JWT Authentication** - Stateless, scalable auth
4. **PostgreSQL Extensions** - pgvector (semantic), pg_trgm (full-text)
5. **WebSocket Gateway** - Real-time updates via Socket.IO
6. **MCP Server** - Separate stdio-based server for agents
7. **Progressive Disclosure** - Efficient tool discovery by detail level
8. **Story State Machine** - Enforced workflow transitions
9. **Global Services** - PrismaModule available everywhere
10. **DTOs + Validation** - Runtime validation, compile-time types

---

## Useful Links

- **API Documentation:** `http://localhost:3000/api/docs` (Swagger)
- **Database GUI:** `npm run db:studio` (Prisma Studio)
- **Full Architecture:** `docs/BACKEND_ARCHITECTURE_ANALYSIS.md`
- **Diagrams:** `docs/BACKEND_ARCHITECTURE_DIAGRAM.md`

