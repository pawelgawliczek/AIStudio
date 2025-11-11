# AI Studio Backend Architecture Diagrams

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│                    http://localhost:5173                        │
└────────────────────────────────────────────────────────────────┘
                  ↓                              ↓
        REST API (HTTP/HTTPS)          WebSocket (Socket.IO)
                  ↓                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS Backend API                          │
│                    http://localhost:3000                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    AppModule                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │
│  │  │Auth      │  │Projects  │  │Stories   │  │Epics     │ │ │
│  │  │Module    │  │Module    │  │Module    │  │Module    │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │
│  │  │UseCases  │  │TestCases │  │Runs      │  │Commits   │ │ │
│  │  │Module    │  │Module    │  │Module    │  │Module    │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │
│  │  │Metrics   │  │WebSocket │  │Subtasks  │                │ │
│  │  │Modules   │  │Module    │  │Module    │                │ │
│  │  └──────────┘  └──────────┘  └──────────┘                │ │
│  │                                                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │         Global Infrastructure                      │  │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │ │
│  │  │ │Prisma    │ │Auth      │ │Logging & │            │  │ │
│  │  │ │Service   │ │Guards    │ │Filters   │            │  │ │
│  │  │ │(Global)  │ │(RBAC)    │ │          │            │  │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘            │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (stdio)                            │
│                    ts-node src/mcp/server.ts                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Tool Registry & Loader                       │ │
│  │  (Dynamic filesystem-based tool discovery)              │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Meta Tools │ Projects │ Stories │ UseCases │ Test-Coverage │ │
│  │ Code Quality │ Telemetry │ Epics │ ...       │              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                  ↓
        ┌─────────────────────────────────┐
        │  Agent/Claude Client            │
        │  (via MCP SDK)                  │
        └─────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                                 │
│        (with pgvector, uuid-ossp, pg_trgm extensions)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Dependencies Graph

```
                          AppModule
                             │
           ┌─────────────────┼─────────────────┬──────────┐
           │                 │                 │          │
       ConfigModule      PrismaModule     AuthModule   Others...
       (global)          (Global)         (JWT/RBAC)
           │                 │                 │
           ├─────────┬───────┴──────┬──────────┤
           │         │              │          │
      ProjectsModule │         WebSocketModule │
           │         │              │          │
           └──► StoriesModule  ◄────┘          │
                     │                         │
                     └──► SubtasksModule       │
                           │                   │
                     EpicsModule ◄─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
     UseCasesModule    TestCasesModule   CommitsModule
        │                  │                  │
        └──────┬───────────┼──────────┬───────┘
               │           │          │
         TestExecutionsModule  RunsModule
               │           │          │
        AgentMetricsModule ◄─┴────────┘
        CodeMetricsModule

Legend:
────> = imports
◄──── = exports
────► = uses
```

---

## 3. Request Flow Architecture

### 3.1 HTTP Request Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Frontend Client                                              │
│ (React + TypeScript)                                        │
│                                                              │
│  Example: POST /api/stories                                │
│  Headers: Authorization: Bearer <JWT>                      │
│  Body: { projectId, title, description, ... }            │
└──────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ NestJS Request Pipeline                                     │
├──────────────────────────────────────────────────────────────┤
│ 1. CORS Middleware                                          │
│    Verify origin matches FRONTEND_URL                      │
│                          │                                  │
│                          ↓                                  │
│ 2. Global Validation Pipe                                  │
│    - Validate DTO (CreateStoryDto)                        │
│    - Transform to class instance                          │
│    - Whitelist properties                                 │
│                          │                                  │
│                          ↓                                  │
│ 3. Guard: JWT Auth                                         │
│    Extract token from Authorization header                │
│    Verify signature with JWT_SECRET                       │
│    Extract user info (id, email, role)                   │
│                          │                                  │
│                          ↓                                  │
│ 4. Guard: Roles                                            │
│    @Roles(UserRole.admin, pm, ba)                        │
│    Check user.role in required roles                     │
│                          │                                  │
│                          ↓                                  │
│ 5. Logging Interceptor (before)                           │
│    Record method, url, start time                         │
│                          │                                  │
│                          ↓                                  │
│ 6. Controller Handler                                      │
│    @Post()                                                 │
│    create(body: CreateStoryDto, req)                      │
│    Call: storiesService.create(dto, req.user.id)         │
│                          │                                  │
│                          ↓                                  │
│ 7. Service Layer                                           │
│    ├─ Validate business logic                            │
│    ├─ Check project exists                               │
│    ├─ Verify epic belongs to project                     │
│    ├─ Generate story key (ST-1, ST-2, etc)              │
│    ├─ Create in database (Prisma)                        │
│    ├─ Publish WebSocket event                            │
│    └─ Format and return response                         │
│                          │                                  │
│                          ↓                                  │
│ 8. Response                                                │
│    {                                                       │
│      id, projectId, key, title, status, ...             │
│      createdAt, updatedAt                                │
│    }                                                       │
│                          │                                  │
│                          ↓                                  │
│ 9. Logging Interceptor (after)                            │
│    Record duration, status code                           │
│                          │                                  │
│                          ↓                                  │
│ 10. Exception Filter (on error)                           │
│     Convert exceptions to HTTP responses                  │
│     Log errors appropriately                              │
└──────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ HTTP Response                                               │
│ Status: 201 Created                                        │
│ Body: Story object                                         │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 MCP Tool Request Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Claude / Agent Client                                        │
│ Call Tool: create_story                                    │
│ Args: { projectId, title, description, ... }             │
└──────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ MCP Server (server.ts)                                      │
│                                                              │
│ CallToolRequestSchema Handler                              │
│ Extract: name='create_story', args={...}                 │
│                          │                                  │
│                          ↓                                  │
│ ToolRegistry.executeTool(name, args)                      │
│                          │                                  │
│                          ↓                                  │
│ ToolLoader.getToolByName('create_story')                  │
│ (Load from servers/stories/create_story.ts)              │
│                          │                                  │
│                          ↓                                  │
│ Extract:                                                    │
│ ├─ tool: Tool (MCP definition)                            │
│ ├─ handler: Function                                       │
│ └─ metadata: { category, tags, version }                 │
│                          │                                  │
│                          ↓                                  │
│ Execute: handler(prisma, params)                          │
│ ├─ Validate parameters                                     │
│ ├─ Check project exists                                   │
│ ├─ Check epic (if provided)                               │
│ ├─ Generate key                                            │
│ ├─ Create story (Prisma)                                  │
│ ├─ Format response                                         │
│ └─ Return StoryResponse                                   │
│                          │                                  │
│                          ↓                                  │
│ Return MCP Response                                        │
│ {                                                          │
│   content: [{                                             │
│     type: 'text',                                         │
│     text: JSON.stringify(result)                          │
│   }]                                                       │
│ }                                                          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Claude / Agent Client                                        │
│ Receives: Story object as JSON                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema Hierarchy

```
Project (Root Container)
│
├─── Epic [1..*] (organizational)
│    └─── Story [0..*] (feature/bug/chore/spike/defect)
│         ├─── Subtask [0..*] (frontend/backend/infra/test)
│         │    └─── Run [0..*] (agent execution)
│         ├─── Commit [0..*] (linked)
│         │    └─── CommitFile [1..*] (LOC, complexity, coverage)
│         ├─── TestExecution [0..*] (results)
│         │    └─── TestCase (reference)
│         ├─── Defect [0..1] (optional bug tracking)
│         └─── ReleaseItem (tracks release assignment)
│
├─── UseCase [0..*] (requirements, versioned)
│    ├─── UseCaseVersion [1..*] (with embeddings for semantic search)
│    ├─── StoryUseCaseLink [0..*] (many-to-many with stories)
│    └─── TestCase [0..*] (test coverage for use case)
│
├─── TestCase [0..*] (parameterized test specifications)
│    └─── TestExecution [0..*] (execution results)
│
├─── Commit [0..*] (git metadata)
│    └─── CommitFile [1..*] (files changed)
│
├─── Agent [0..*] (individual agents with config)
│
├─── AgentFramework [0..*] (multi-agent systems)
│    └─── Run [0..*] (framework-level executions)
│
├─── Run [0..*] (agent executions)
│    └─── Metadata (flexible JSON for context)
│
├─── Release [0..*] (release management)
│    └─── ReleaseItem [1..*] (stories in release)
│
└─── AuditLog [0..*] (activity tracking)
```

---

## 5. Data Flow: Story Creation

```
┌─ User Action: Create Story ──────────────────────────────┐
│                                                           │
│ Frontend: POST /api/stories                             │
│ Body: {                                                 │
│   projectId: uuid,                                      │
│   title: "User authentication",                         │
│   description: "Implement JWT login",                  │
│   type: "feature",                                      │
│   businessImpact: 4,                                    │
│   businessComplexity: 3,                                │
│   technicalComplexity: 5                               │
│ }                                                       │
└───────────────────────────────────────────────────────┬─┘
                                                        │
                          ┌─────────────────────────────┘
                          ↓
          ┌───────────────────────────────────────┐
          │ StoriesController.create()            │
          │ 1. Validate JWT token                │
          │ 2. Check RBAC (@Roles)               │
          │ 3. Validate DTO                      │
          │ 4. Call service                      │
          └───────────────────────────────────────┘
                          │
          ┌───────────────┴────────────────────────────┐
          ↓                                             ↓
┌────────────────────────┐              ┌─────────────────────────┐
│ StoriesService         │              │ WebSocketGateway        │
│ 1. Verify project ID   │              │ (async event emitter)   │
│ 2. Verify epic ID      │              └─────────────────────────┘
│ 3. Validate transition │                      ↑
│ 4. Generate story key  │                      │
│ 5. Create in Prisma    │                      │
│ 6. Format response     │                      │
│ 7. Emit WS event ─────┼──────────────────────┘
└────────────────────────┘
                          │
        ┌─────────────────┴────────────────┐
        ↓                                   ↓
┌────────────────────────┐      ┌─────────────────────┐
│ Database Transaction   │      │ Browser: Socket.IO  │
│                        │      │ Listeners receive:  │
│ 1. INSERT story        │      │ {                   │
│    - id: uuid          │      │   storyId,          │
│    - key: ST-1         │      │   projectId,        │
│    - status: planning  │      │   title,            │
│    - created_at: now   │      │   status: planning  │
│                        │      │ }                   │
│ 2. Transaction commit  │      │                     │
│                        │      │ UI updates in       │
│ 3. Indexes updated     │      │ real-time           │
│ (storyId, status)      │      └─────────────────────┘
│                        │
│ 4. Response sent       │
│    after commit        │
└────────────────────────┘
```

---

## 6. Progressive Disclosure Tool Discovery

```
Agent: "I need to create a story"
  │
  ├─ Call: search_tools(query='story', detail_level='names_only')
  │
  │  ┌─ ToolRegistry.searchTools()
  │  │  ├─ Filter tools by query
  │  │  ├─ Return NAMES ONLY
  │  │  └─ Size: ~100 bytes
  │  │
  │  Response: 
  │  {
  │    "tools": ["create_story", "list_stories", "get_story", ...]
  │  }
  │
  ├─ Call: search_tools(query='create_story', detail_level='with_descriptions')
  │
  │  ┌─ ToolRegistry.searchTools()
  │  │  ├─ Filter by query
  │  │  ├─ Return names + descriptions + categories
  │  │  └─ Size: ~500 bytes
  │  │
  │  Response:
  │  {
  │    "tools": [{
  │      "name": "create_story",
  │      "description": "Create a new story...",
  │      "category": "stories"
  │    }]
  │  }
  │
  └─ Call: search_tools(query='create_story', detail_level='full_schema')
  
     ┌─ ToolRegistry.searchTools()
     │  ├─ Filter by query
     │  ├─ Return complete tool definition
     │  │  (name, description, inputSchema, metadata)
     │  └─ Size: ~1KB
     │
     Response:
     {
       "tools": [{
         "name": "create_story",
         "description": "...",
         "category": "stories",
         "inputSchema": {
           "type": "object",
           "properties": {
             "projectId": { "type": "string" },
             "title": { "type": "string" },
             ...
           },
           "required": ["projectId", "title"]
         },
         "metadata": {
           "category": "stories",
           "tags": ["story", "create"],
           "version": "1.0.0",
           "since": "sprint-3"
         }
       }]
     }
```

---

## 7. Authentication & Authorization Flow

```
┌─────────────────────────────────────┐
│ User: POST /api/auth/login          │
│ Body: { email, password }           │
└─────────────────────────────────────┘
          │
          ↓
┌─────────────────────────────────────┐
│ AuthController.login()              │
│ 1. Validate credentials             │
│ 2. Hash check password              │
│ 3. Call AuthService.login()         │
└─────────────────────────────────────┘
          │
          ↓
┌─────────────────────────────────────┐
│ AuthService.login()                 │
│ 1. Generate JWT token               │
│    - Payload: {                     │
│      sub: userId,                   │
│      email,                          │
│      role: UserRole.admin,          │
│      iat, exp                       │
│    }                                │
│ 2. Sign with JWT_SECRET             │
│ 3. Generate refresh token           │
│ 4. Hash and store refresh token     │
│ 5. Return both tokens               │
└─────────────────────────────────────┘
          │
          ↓
Response: {
  accessToken: "eyJhbGc...",
  refreshToken: "eyJhbGc...",
  user: { id, name, email, role }
}

---

Subsequent Requests:

User: GET /api/stories
Headers: Authorization: Bearer eyJhbGc...
          │
          ↓
┌──────────────────────────────────────┐
│ JwtAuthGuard                         │
│ 1. Extract token from header         │
│ 2. Verify signature                  │
│ 3. Decode payload                    │
│ 4. Attach user to request            │
│ 5. Pass to next handler              │
└──────────────────────────────────────┘
          │
          ↓
┌──────────────────────────────────────┐
│ RolesGuard                           │
│ 1. Get @Roles() from handler         │
│ 2. Check user.role in required list  │
│ 3. Allow or deny access              │
└──────────────────────────────────────┘
          │
          ↓
┌──────────────────────────────────────┐
│ StoriesController.findAll()          │
│ @Roles(admin, pm, ba, dev, qa)      │
│ Only these roles can access          │
└──────────────────────────────────────┘
```

---

## 8. Service Dependencies Pattern

```
┌─────────────────────────────────────────────┐
│ StoriesService                              │
├─────────────────────────────────────────────┤
│ Dependencies (constructor injection):       │
│                                             │
│ constructor(                                │
│   private prisma: PrismaService,           │
│   private wsGateway: WebSocketGateway,     │
│ ) {}                                        │
└─────────────────────────────────────────────┘
        │                        │
        ↓                        ↓
┌──────────────────┐  ┌─────────────────────┐
│ PrismaService    │  │ WebSocketGateway    │
├──────────────────┤  ├─────────────────────┤
│ - $connect()     │  │ - server: Server    │
│ - story.create() │  │ - emit events       │
│ - story.findOne()│  │ - join rooms        │
│ - $transaction() │  │ - broadcast updates │
│ - $disconnect()  │  │                     │
└──────────────────┘  └─────────────────────┘
        │                        │
        ↓                        ↓
   Database              Socket.IO
   (PostgreSQL)          (WebSocket)
```

---

## 9. Error Handling Flow

```
Controller
    │
    ├─ Try to create story
    │
    ↓
Service.create() throws BadRequestException
    │
    "Invalid status transition"
    │
    ↓
┌─────────────────────────────────────┐
│ Exception not caught in controller  │
│ Bubbles up to global filter         │
└─────────────────────────────────────┘
    │
    ↓
┌─────────────────────────────────────┐
│ AllExceptionsFilter                 │
├─────────────────────────────────────┤
│ catch(exception, host)              │
│ 1. Determine HTTP status            │
│ 2. Format error response            │
│ 3. Log appropriately                │
│ 4. Send to client                   │
└─────────────────────────────────────┘
    │
    ↓
Response: {
  statusCode: 400,
  timestamp: "2024-11-11T10:30:45.123Z",
  path: "/api/stories",
  method: "POST",
  message: "Invalid status transition from planning to done"
}

Logging (Winston):
- 5xx errors → logger.error()
- 4xx errors → logger.warn()
- All requests → LoggingInterceptor
```

---

## 10. MCP Tool Implementation Structure

```
MCP Tool File: servers/stories/create_story.ts

┌────────────────────────────────────────────────────────┐
│ Exports:                                               │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 1. tool: Tool (MCP SDK definition)                    │
│    {                                                  │
│      name: 'create_story',                           │
│      description: '...',                             │
│      inputSchema: {                                  │
│        type: 'object',                               │
│        properties: {...},                            │
│        required: [...]                               │
│      }                                               │
│    }                                                 │
│                                                        │
│ 2. metadata: ToolMetadata (for discovery)             │
│    {                                                  │
│      category: 'stories',                            │
│      domain: 'project_management',                   │
│      tags: ['story', 'create'],                      │
│      version: '1.0.0',                               │
│      since: 'sprint-3'                               │
│    }                                                 │
│                                                        │
│ 3. handler(prisma, params)                           │
│    - Receive Prisma client (auto-injected)          │
│    - Receive tool parameters                         │
│    - Business logic                                  │
│    - Return formatted response                       │
│                                                        │
└────────────────────────────────────────────────────────┘
           │
           │ Tool Discovery
           ↓
┌────────────────────────────────────────────────────────┐
│ ToolLoader (core/loader.ts)                           │
├────────────────────────────────────────────────────────┤
│ 1. Scan servers/ directory at startup                 │
│ 2. For each .ts file (except index):                  │
│    - Dynamic import                                  │
│    - Extract tool, handler, metadata                 │
│    - Cache in Map<filePath, ToolModule>              │
│ 3. On-demand load via getToolByName()                │
│                                                        │
└────────────────────────────────────────────────────────┘
           │
           │ Tool Execution
           ↓
┌────────────────────────────────────────────────────────┐
│ ToolRegistry (core/registry.ts)                       │
├────────────────────────────────────────────────────────┤
│ 1. executeTool(name, params)                          │
│    - Get tool from loader                             │
│    - Call handler(prisma, params)                     │
│    - Handle errors                                    │
│ 2. listTools(category)                                │
│    - Return Tool[] for MCP ListTools                  │
│ 3. searchTools(query, category, detailLevel)         │
│    - Progressive disclosure support                   │
│                                                        │
└────────────────────────────────────────────────────────┘
           │
           ↓
    MCP Response
```

