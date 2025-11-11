# AI Studio Backend Architecture Analysis

## Executive Summary

The AI Studio backend is a sophisticated NestJS-based REST API with an integrated MCP (Model Context Protocol) server. It implements a comprehensive project management system with agent frameworks, automated testing, and advanced metrics collection. The architecture emphasizes separation of concerns, progressive disclosure for tool discovery, and real-time communication through WebSockets.

**Key Statistics:**
- **15 Domain Modules** across auth, projects, stories, epics, test cases, use cases, and more
- **9 MCP Tool Categories** with dynamic filesystem-based tool discovery
- **Database Layer:** PostgreSQL with Prisma ORM, pgvector support for semantic search
- **Real-time Communication:** Socket.IO for WebSocket events
- **Authentication:** JWT-based with role-based access control (RBAC)

---

## 1. BACKEND STRUCTURE & NESTJS ORGANIZATION

### 1.1 Module Architecture

The application follows NestJS's modular pattern with 15 distinct modules organized by domain:

```
Backend Modules:
├── AppModule (Root)
├── AuthModule
├── PrismaModule (Global)
├── UsersModule
├── ProjectsModule
├── StoriesModule
├── EpicsModule
├── SubtasksModule
├── UseCasesModule
├── RunsModule
├── CommitsModule
├── TestCasesModule
├── TestExecutionsModule
├── CodeMetricsModule
├── AgentMetricsModule
└── WebSocketModule
```

### 1.2 Module Dependencies

**AppModule** (`/src/app.module.ts`):
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,           // Global database access
    AuthModule,
    ProjectsModule,
    UsersModule,
    StoriesModule,
    EpicsModule,
    SubtasksModule,
    WebSocketModule,
    UseCasesModule,
    RunsModule,
    CommitsModule,
    CodeMetricsModule,
    AgentMetricsModule,
    TestCasesModule,
    TestExecutionsModule,
  ],
  controllers: [HealthController],
})
```

### 1.3 Module Pattern (e.g., StoriesModule)

Each module follows a consistent pattern:

```
stories/
├── stories.module.ts      # Module definition (imports, providers, exports)
├── stories.controller.ts  # HTTP endpoint handlers
├── stories.service.ts     # Business logic
└── dto/
    ├── create-story.dto.ts
    ├── update-story.dto.ts
    ├── filter-story.dto.ts
    └── index.ts
```

**Module Structure:**
```typescript
@Module({
  imports: [PrismaModule, WebSocketModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],  // Available to other modules
})
export class StoriesModule {}
```

### 1.4 Controller Pattern

Controllers use NestJS decorators for route definition and authorization:

```typescript
@ApiTags('stories')
@Controller('stories')
@UseGuards(AuthGuard('jwt'), RolesGuard)  // JWT + Role-based access control
@ApiBearerAuth()
export class StoriesController {
  @Get()
  @ApiOperation({ summary: 'Get all stories with filters' })
  @ApiResponse({ status: 200 })
  findAll(@Query() filterDto: FilterStoryDto) {
    return this.storiesService.findAll(filterDto);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba)  // Permission-based
  @ApiOperation({ summary: 'Create a new story' })
  create(@Body() createStoryDto: CreateStoryDto, @Request() req: any) {
    return this.storiesService.create(createStoryDto, req.user.id);
  }
}
```

---

## 2. DATA LAYER - PRISMA SCHEMA & DATABASE DESIGN

### 2.1 Database Stack

**Technology:**
- PostgreSQL with pgvector extension for semantic search
- Prisma ORM as query builder and migration tool
- Extensions: uuid-ossp, vector (pgvector), pg_trgm (full-text search)

**Connection Configuration:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [
    uuidOssp(map: "uuid-ossp"),
    vector,
    pgTrgm(map: "pg_trgm")
  ]
}
```

### 2.2 Core Data Models

**A. Project Management Hierarchy**

```
Project (Root)
├── Epic (epics)
│   └── Story (stories)
│       ├── Subtask (subtasks)
│       ├── Commit (linked)
│       └── TestExecution (linked)
└── UseCase (use_cases)
    ├── UseCaseVersion (versions with embeddings)
    └── TestCase (test_cases)
```

**Key Models:**

1. **User**
   - Supports roles: admin, pm, ba, architect, dev, qa, viewer
   - Password hashing with bcrypt
   - JWT refresh token storage

2. **Project**
   - Container for all project artifacts
   - Relationships: epics, stories, useCases, commits, testCases, agents, frameworks, runs
   - Audit logging support

3. **Story** (Core concept)
   - Fields: title, description, status, type (feature/bug/defect/chore/spike)
   - Workflow states: planning → analysis → architecture → design → implementation → review → qa → done
   - Complexity metrics: businessImpact, businessComplexity, technicalComplexity
   - Estimated token cost for agent execution
   - Assignment to framework

4. **Subtask** (Story decomposition)
   - Layer-based: frontend, backend, infra, test, other
   - Assignee: human or agent
   - Status tracking

5. **UseCase** (Requirements)
   - Versioned content with embeddings (pgvector)
   - Semantic search capability via OpenAI embeddings
   - Markdown or JSON content
   - Relationships to stories (StoryUseCaseLink)

### 2.3 Advanced Data Models

**A. Testing Infrastructure**

```prisma
TestCase {
  projectId, useCaseId, key
  title, description
  testLevel: unit | integration | e2e
  priority: low | medium | high | critical
  preconditions, testSteps, expectedResults
  testData (JSON)
  status: pending | implemented | automated | deprecated
  assignedTo, createdBy
}

TestExecution {
  testCaseId, storyId, commitHash
  executedAt, status: pass | fail | skip | error
  durationMs
  coveragePercentage, linesCovered, linesTotal
  ciRunId, environment
}
```

**B. Agent Execution (Run Tracking)**

```prisma
Agent {
  projectId, name, role
  config (JSON) - system prompt, tools, limits
  active boolean
}

AgentFramework {
  projectId, name, description
  config (JSON) - agent composition, routing rules
  active boolean
  Stories can be assigned to frameworks
}

Run {
  projectId, storyId, subtaskId
  agentId, frameworkId
  origin: mcp | cli | ci | ui
  tokensInput, tokensOutput
  startedAt, finishedAt
  success, errorType
  iterations, metadata (JSON)
}
```

**C. Code Quality Tracking**

```prisma
Commit {
  hash (PK), projectId
  author, timestamp, message
  storyId, epicId (linkage)
  files[] (CommitFile with LOC changes, complexity, coverage)
}

CommitFile {
  filePath
  locAdded, locDeleted
  complexityBefore/After
  coverageBefore/After
}
```

**D. Defects & Issues**

```prisma
Defect {
  storyId (PK) - one-to-one with Story
  originStoryId (where it was introduced)
  originStage: dev | arch | ba | unknown
  discoveryStage: unit_test | integration_test | qa | uat | production
  severity: low | medium | high | critical
}
```

### 2.4 Schema Relationships

**Cascade Rules:**
- Project deletion cascades to: epics, stories, useCases, commits, testCases, agents, frameworks, runs
- Story deletion cascades to: subtasks, useCaseLinks, testExecutions
- UseCase deletion cascades to: versions, storyLinks, testCases

**Unique Constraints:**
- `[projectId, key]` for Epic, Story, UseCase, TestCase (per-project sequential IDs)
- `[useCaseId, version]` for UseCaseVersion

**Indexes:**
- `[projectId, status]` on Epic, Story (filtering by status)
- `[projectId, startedAt]` on Run (time-series queries)
- `[filePath]` on CommitFile (file tracking)
- `[entityType, entityId]` on AuditLog (audit trail)

### 2.5 Vector Database Integration

**Use Case Embeddings (pgvector):**
```prisma
UseCaseVersion {
  embedding: Unsupported("vector(1536)")?  // OpenAI embedding dimension
  // Generated via UseCasesService.generateEmbedding()
}
```

**Implementation:**
```typescript
// In use-cases.service.ts
if (this.openai) {
  embedding = await this.generateEmbedding(dto.content);
  // Embedding used for semantic similarity search
}
```

---

## 3. SERVICE LAYER - BUSINESS LOGIC & PATTERNS

### 3.1 Service Organization

**15 Services** (`*.service.ts` files across all modules):
- AuthService
- UsersService
- ProjectsService
- StoriesService
- EpicsService
- SubtasksService
- UseCasesService
- RunsService
- CommitsService
- TestCasesService
- TestExecutionsService
- CodeMetricsService
- AgentMetricsService
- WebSocketGateway (real-time service)

### 3.2 Service Patterns

**A. Dependency Injection Pattern**

Services use constructor-based dependency injection:

```typescript
@Injectable()
export class StoriesService {
  constructor(
    private prisma: PrismaService,      // Database access
    private wsGateway: WebSocketGateway, // Real-time updates
  ) {}
}
```

**B. Error Handling Patterns**

Custom exceptions for specific scenarios:
```typescript
throw new NotFoundException(`Project with ID ${id} not found`);
throw new BadRequestException(`Invalid status transition from ${current} to ${next}`);
throw new ConflictException(`Story with key ${key} already exists`);
throw new ForbiddenException('Insufficient permissions');
```

**C. State Machine Pattern (StoriesService)**

Enforces valid workflow transitions:

```typescript
const STORY_WORKFLOW: Record<StoryStatus, StoryStatus[]> = {
  planning: [StoryStatus.analysis],
  analysis: [StoryStatus.planning, StoryStatus.architecture],
  architecture: [StoryStatus.analysis, StoryStatus.design],
  design: [StoryStatus.architecture, StoryStatus.implementation],
  implementation: [StoryStatus.design, StoryStatus.review],
  review: [StoryStatus.implementation, StoryStatus.qa],
  qa: [StoryStatus.review, StoryStatus.done, StoryStatus.implementation],
  done: [], // Terminal state
};

private validateStatusTransition(currentStatus, newStatus, isAdmin = false) {
  if (!isAdmin && !validNextStates.includes(newStatus)) {
    throw new BadRequestException(`Invalid transition...`);
  }
}
```

### 3.3 Complex Service Example: AgentMetricsService

Demonstrates advanced business logic:

```typescript
@Injectable()
export class AgentMetricsService {
  private readonly TOKEN_COST_PER_1K = 0.01;

  async getFrameworkComparison(dto: GetFrameworkMetricsDto) {
    // 1. Validate project exists
    // 2. Calculate date range and complexity filters
    // 3. For each framework:
    //    - Aggregate run metrics (tokens, success rate, execution time)
    //    - Normalize by complexity band
    //    - Calculate efficiency (stories per token)
    //    - Analyze quality metrics (test coverage, defect rate)
    //    - Compute cost metrics
    // 4. Calculate overhead analysis for multi-agent frameworks
    // 5. Generate trend data points
  }

  // Filters and aggregations for complex analytics
  private getComplexityFilter(complexityBand): Prisma.StoryWhereInput
  private calculateFrameworkMetrics(): FrameworkComparisonResultDto
  private calculateOverheadAnalysis(): OverheadAnalysisDto
}
```

### 3.4 Data Transformation & Validation

**DTOs (Data Transfer Objects)** - Located in `dto/` subdirectories:

```typescript
// Example: CreateStoryDto
@ApiProperty({ description: 'Project ID' })
@IsUUID()
@IsNotEmpty()
projectId: string;

@ApiPropertyOptional({ description: 'Business impact (1-5)' })
@IsInt()
@Min(1)
@Max(5)
@IsOptional()
businessImpact?: number;

// Decorators provide:
// - API documentation (Swagger)
// - Validation rules (class-validator)
// - Type safety (TypeScript)
```

**Validation Pipeline:**
```typescript
// Global pipe in main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip unknown properties
    forbidNonWhitelisted: true,   // Reject unknown properties
    transform: true,              // Auto-transform to DTO class
  }),
);
```

**Response Formatting:**
Services return formatted responses (consistent with MCP types):
```typescript
formatStory(story, includeRelations = false): StoryResponse {
  return {
    id, projectId, epicId, key, type, title, description, status,
    businessImpact, businessComplexity, technicalComplexity,
    estimatedTokenCost, assignedFrameworkId,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  };
}
```

### 3.5 Transaction Management

**Atomic Operations:**
```typescript
const useCase = await this.prisma.$transaction(async (tx) => {
  // Create use case
  const newUseCase = await tx.useCase.create({ data: {...} });
  
  // Create initial version
  await tx.useCaseVersion.create({
    data: {
      useCaseId: newUseCase.id,
      version: 1,
      content: dto.content,
      embedding: embedding,
      createdById,
    },
  });
  
  return newUseCase;
});
```

---

## 4. MCP SERVER IMPLEMENTATION

### 4.1 MCP Architecture Overview

**File Structure:**
```
mcp/
├── server.ts                    # Main MCP server entry point
├── types.ts                     # Type definitions for all tools
├── utils.ts                     # Utility functions for formatting/validation
├── core/
│   ├── registry.ts             # Tool registry and discovery
│   ├── loader.ts               # Dynamic tool loader
│   └── index.ts
├── servers/                     # Tool implementations (9 categories)
│   ├── meta/                    # Progressive disclosure, search_tools
│   ├── projects/                # Project management tools
│   ├── epics/                   # Epic CRUD tools
│   ├── stories/                 # Story CRUD tools
│   ├── use-cases/               # Use case management
│   ├── telemetry/               # Run tracking, commit linking
│   ├── test-coverage/           # Test coverage analytics
│   ├── code-quality/            # Code metrics
│   └── tools/                   # Legacy tool specs
└── README.md
```

### 4.2 Progressive Disclosure Implementation

**Goal:** Agents discover tools gradually, reducing token usage.

**Three Detail Levels:**

1. **names_only** (~100 bytes per tool)
   ```json
   { "tools": ["create_story", "list_stories", "get_story"] }
   ```

2. **with_descriptions** (~500 bytes per tool)
   ```json
   {
     "tools": [
       {
         "name": "create_story",
         "description": "Create a new story within a project",
         "category": "stories"
       }
     ]
   }
   ```

3. **full_schema** (~1KB per tool)
   ```json
   {
     "tools": [
       {
         "name": "create_story",
         "description": "...",
         "category": "stories",
         "inputSchema": {
           "type": "object",
           "properties": {...},
           "required": [...]
         },
         "metadata": {...}
       }
     ]
   }
   ```

**Discovery Tool:**
```typescript
// search_tools meta tool enables progressive discovery
export async function handler(
  registry: ToolRegistry,
  params: {
    query?: string;           // Keyword search
    category?: string;        // Filter by category
    detail_level?: string;    // names_only | with_descriptions | full_schema
  }
): Promise<any> {
  return registry.searchTools(query, category, detailLevel);
}
```

### 4.3 Tool Registry & Loader

**ToolRegistry** (Sprints 4.5):
```typescript
export class ToolRegistry {
  private loader: ToolLoader;
  private prisma: PrismaClient;

  async discoverTools(category: string = 'all'): Promise<ToolModule[]>
  async listTools(category?: string): Promise<Tool[]>
  async executeTool(name: string, params: any): Promise<any>
  async searchTools(query, category, detailLevel): Promise<any>
}
```

**ToolLoader** (Dynamic Loading):
```typescript
export class ToolLoader {
  private cache: Map<string, ToolModule> = new Map();

  async discoverTools(category: string = 'all'): Promise<ToolModule[]> {
    // 1. Read category directories from servers/
    // 2. For each .ts/.js file (except index):
    //    - Import module dynamically
    //    - Extract: tool, handler, metadata
    //    - Cache in memory
  }

  async loadToolModule(filePath: string): Promise<ToolModule | null> {
    // Dynamic import with caching
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);
    
    if (!module.tool || !module.handler) return null;
    
    return {
      tool: module.tool,
      handler: module.handler,
      metadata: module.metadata,
    };
  }
}
```

**Benefits:**
- Tools are discovered from filesystem at startup
- No hardcoded tool list
- New tools can be added by creating files in servers/
- Metadata enables categorization and filtering

### 4.4 MCP Server Initialization

**server.ts** (Bootstrap):
```typescript
// 1. Initialize Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 2. Initialize registry with servers path
const registry = new ToolRegistry(path.join(__dirname, 'servers'), prisma);

// 3. Create MCP server
const server = new Server(
  {
    name: 'aistudio-mcp-server',
    version: '0.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 4. Request handlers
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  // Returns meta tools only by default (encourages progressive disclosure)
  const tools = await registry.listTools('meta');
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Special handling for search_tools
  if (name === 'search_tools') {
    const toolModule = await registry.discoverTools('meta');
    const searchTool = toolModule.find((t) => t.tool.name === 'search_tools');
    result = await searchTool.handler(registry, args);  // Pass registry
  } else {
    // Execute via registry (passes prisma automatically)
    result = await registry.executeTool(name, args);
  }
});

// 5. Startup
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 4.5 Tool Structure Pattern

**Example: create_story.ts**

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

// 1. Tool definition (MCP SDK format)
export const tool: Tool = {
  name: 'create_story',
  description: 'Create a new story within a project and optionally an epic',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Project UUID' },
      title: { type: 'string', description: 'Story title' },
      // ... other properties
    },
    required: ['projectId', 'title'],
  },
};

// 2. Metadata for discovery
export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'create'],
  version: '1.0.0',
  since: 'sprint-3',
};

// 3. Handler (receives Prisma client, parameters)
export async function handler(
  prisma: PrismaClient,
  params: CreateStoryParams,
): Promise<StoryResponse> {
  // Validation
  validateRequired(params, ['projectId', 'title']);

  // Verification
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
  });
  if (!project) {
    throw new NotFoundError('Project', params.projectId);
  }

  // Get system user ID
  const systemUserId = await getSystemUserId(prisma);

  // Generate key
  const key = await generateNextKey(prisma, 'story', params.projectId);

  // Create
  const story = await prisma.story.create({
    data: {
      projectId: params.projectId,
      key,
      type: params.type || 'feature',
      title: params.title,
      description: params.description,
      status: 'planning',
      businessImpact: params.businessImpact,
      businessComplexity: params.businessComplexity,
      technicalComplexity: params.technicalComplexity,
      assignedFrameworkId: params.assignedFrameworkId,
      createdById: systemUserId,
    },
  });

  return formatStory(story);
}
```

### 4.6 MCP Tool Categories

**9 Categories with tools:**

1. **meta/** - System tools
   - `search_tools` - Progressive discovery

2. **projects/** - Project management
   - `create_project`, `list_projects`, `get_project`

3. **epics/** - Epic management
   - `create_epic`, `list_epics`, `get_epic`

4. **stories/** - Story CRUD
   - `create_story`, `get_story`, `list_stories`, `get_story_summary`, `update_story`

5. **use-cases/** - Requirements
   - `create_use_case`, `search_use_cases`, `find_related_use_cases`, `link_use_case_to_story`

6. **telemetry/** - Tracking & linking
   - `get_assigned_stories`, `log_run`, `link_commit`

7. **test-coverage/** - Test analytics
   - `get_use_case_coverage`, `get_component_test_coverage`

8. **code-quality/** - Code metrics
   - Code complexity, coverage analysis

9. **tools/** - Legacy tool specs (from tools/ directory)

### 4.7 Type Definitions (types.ts)

Standardized type interfaces for all MCP operations:

```typescript
// Pagination (Sprint 4.5)
export interface PaginationParams {
  page?: number;      // Default: 1
  pageSize?: number;  // Default: 20, Max: 100
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page, pageSize, total, totalPages, hasNext, hasPrev
  };
}

// Tool-specific types
export interface CreateStoryParams {
  projectId: string;
  epicId?: string;
  title: string;
  description?: string;
  type?: 'feature' | 'bug' | 'defect' | 'chore' | 'spike';
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
  assignedFrameworkId?: string;
}

// Response types
export interface StoryResponse {
  id: string;
  projectId: string;
  epicId?: string;
  key: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  // ... metrics and relationships
}

// Error types
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) { ... }
}
export class NotFoundError extends MCPError { ... }
export class ValidationError extends MCPError { ... }
export class DatabaseError extends MCPError { ... }
```

---

## 5. COMMON INFRASTRUCTURE & CROSS-CUTTING CONCERNS

### 5.1 Global Middleware & Filters

**Exception Handling** (`common/filters/http-exception.filter.ts`):
```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: message,
    };

    // Log 5xx errors, warn on 4xx
    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception);
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${JSON.stringify(errorResponse)}`);
    }

    response.status(status).json(errorResponse);
  }
}
```

**Logging Interceptor** (`common/interceptors/logging.interceptor.ts`):
```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context, next) {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(`${method} ${url} - ${duration}ms`);
      }),
    );
  }
}
```

**Winston Logger Service** (`common/logger/logger.service.ts`):
```typescript
@Injectable()
export class WinstonLoggerService implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console({...}),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });
  }
}
```

### 5.2 Authentication & Authorization

**Auth Module** (`auth/`):
- **Strategies:** JWT, Local (username/password), Refresh Token
- **Guards:** JWT Auth, Roles-based access control
- **Decorators:** @Roles(), @CurrentUser(), @Public()

**JWT Strategy:**
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
```

**Roles Guard:**
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const reflector = new Reflector();
    const requiredRoles = reflector.get<UserRole[]>('roles', context.getHandler());
    
    if (!requiredRoles) {
      return true;  // No role requirement
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}
```

### 5.3 Prisma Service (Global)

**PrismaModule:**
```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**PrismaService:**
```typescript
@Injectable()
export class PrismaService extends PrismaClient 
  implements OnModuleInit, OnModuleDestroy {
  
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    // Development helper: delete all records
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    const models = Reflect.ownKeys(this)...;
    return Promise.all(models.map((modelKey) => this[modelKey].deleteMany()));
  }
}
```

---

## 6. REAL-TIME COMMUNICATION

### 6.1 WebSocket Gateway

**WebSocketGateway** (`websocket/websocket.gateway.ts`):

```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class WebSocketGateway 
  implements OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer()
  server: Server;

  private activeUsers = new Map<string, Set<string>>();

  // Connection lifecycle
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Remove from all rooms and notify others
    this.activeUsers.forEach((users, room) => {
      users.delete(client.id);
      this.server.to(room).emit('active-users-updated', {
        room, count: users.size
      });
    });
  }

  // Join project/story room
  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, data: { room: string; userId?: string }) {
    client.join(data.room);
    // Track and notify
    if (!this.activeUsers.has(data.room)) {
      this.activeUsers.set(data.room, new Set());
    }
    this.activeUsers.get(data.room)!.add(client.id);
    
    client.to(data.room).emit('user-joined', {
      userId: data.userId,
      socketId: client.id,
    });
  }

  // Leave room
  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, data: { room: string }) {
    client.leave(data.room);
    // Remove from tracking
  }

  // Broadcast story update
  broadcastStoryUpdate(projectId: string, storyId: string, update: any) {
    this.server.to(projectId).emit('story-updated', {
      storyId, update,
    });
  }
}
```

**Real-time Events:**
- `user-joined` - When user joins a room
- `user-left` - When user leaves
- `active-users-updated` - Active user count/list
- `story-updated` - Story changes
- `comment-added` - Collaborative comments
- Custom domain events

---

## 7. API DESIGN PATTERNS

### 7.1 RESTful Conventions

**Standard CRUD Operations:**
```
GET    /api/stories              # List with filters
GET    /api/stories/:id          # Get single
POST   /api/stories              # Create
PATCH  /api/stories/:id          # Update
DELETE /api/stories/:id          # Delete
```

**Custom Endpoints:**
```
PATCH  /api/stories/:id/status   # Status transition (workflow)
GET    /api/projects/:id         # Includes counts and summary
GET    /api/use-cases/search     # Semantic search
GET    /api/metrics/framework    # Analytics
```

### 7.2 API Documentation (Swagger)

**Configuration:**
```typescript
const config = new DocumentBuilder()
  .setTitle('AI Studio API')
  .setDescription('MCP Control Plane API for managing AI agentic frameworks')
  .setVersion('0.1.0')
  .addTag('auth', 'Authentication and authorization endpoints')
  .addTag('users', 'User management endpoints')
  .addTag('projects', 'Project management endpoints')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'JWT-auth',
  )
  .build();
```

**Endpoint Decoration:**
```typescript
@Get()
@ApiOperation({ summary: 'Get all stories with filters' })
@ApiResponse({ status: 200, description: 'Return filtered stories' })
@ApiQuery({ name: 'projectId', required: false })
@ApiQuery({ name: 'status', required: false })
findAll(@Query() filterDto: FilterStoryDto) { ... }
```

### 7.3 Error Response Format

**Consistent Error Structure:**
```json
{
  "statusCode": 400,
  "timestamp": "2024-11-11T10:30:45.123Z",
  "path": "/api/stories",
  "method": "POST",
  "message": "Invalid status transition from planning to done"
}
```

---

## 8. TECHNOLOGY STACK

### Core Framework
- **NestJS 10.3** - Enterprise Node.js framework
- **TypeScript 5** - Type-safe development
- **Express** - Underlying HTTP server

### Database & ORM
- **PostgreSQL 14+** - Relational database
- **Prisma 5.9** - ORM and migrations
- **pgvector** - Vector database for embeddings
- **pg_trgm** - Full-text search extension

### Authentication & Security
- **Passport.js** - Authentication middleware
- **JWT** - Token-based authentication
- **bcrypt** - Password hashing

### Real-time Communication
- **Socket.IO 4.8** - WebSocket abstraction
- **NestJS WebSockets** - Gateway integration

### API Documentation
- **Swagger/OpenAPI** - API documentation

### Validation & Transformation
- **class-validator** - DTO validation
- **class-transformer** - Object transformation

### External Services
- **OpenAI SDK** - Embedding generation, semantic search
- **Bull 4.12** - Job queue (configured but not shown in core)
- **IORedis** - Redis client

### Development & Testing
- **Jest** - Unit testing framework
- **ts-jest** - TypeScript support
- **Supertest** - HTTP assertion library
- **ESLint** - Code linting
- **Prettier** - Code formatting

### Logging & Monitoring
- **Winston 3.11** - Structured logging
- **Node.js built-in utilities** - Reflection, path resolution

---

## 9. KEY ARCHITECTURAL PRINCIPLES

### 9.1 Separation of Concerns
- **Controllers:** HTTP routing and request validation
- **Services:** Business logic and orchestration
- **Data Layer:** Prisma for persistence
- **MCP Layer:** Separate server for agent access

### 9.2 Progressive Disclosure
- **Default:** Only meta tools in ListTools response
- **Discovery:** Use `search_tools` for progressive detail levels
- **Benefits:** Reduces token usage for agents, improves discoverability

### 9.3 Type Safety
- **TypeScript end-to-end** - Compile-time type checking
- **DTOs with decorators** - Runtime validation
- **Prisma types** - Database schema as TypeScript types

### 9.4 Scalability
- **Modular architecture** - Modules can be independently scaled
- **Database indexing** - Strategic indexes on common queries
- **Pagination support** - Large result set handling
- **Vector database** - Efficient semantic search

### 9.5 Security
- **Role-based access control** - Granular permissions
- **JWT authentication** - Stateless auth
- **Input validation** - All DTOs validated
- **Error handling** - No sensitive data in responses

### 9.6 Observability
- **Structured logging** - Winston with contexts
- **Request logging** - Via interceptors
- **Error tracking** - Comprehensive exception handling
- **Audit logging** - Via AuditLog model

---

## 10. DEVELOPMENT & DEPLOYMENT

### 10.1 Scripts

```json
{
  "start": "nest start",
  "dev": "nest start --watch",
  "build": "nest build",
  "start:prod": "node dist/main",
  "test": "jest",
  "test:cov": "jest --coverage",
  "db:migrate:dev": "prisma migrate dev",
  "db:migrate:deploy": "prisma migrate deploy",
  "db:seed": "ts-node prisma/seed.ts",
  "db:seed:demo": "ts-node prisma/seed-demo.ts",
  "mcp:dev": "ts-node src/mcp/server.ts"
}
```

### 10.2 Environment Configuration

**Required Variables:**
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Token signing key
- `JWT_EXPIRES_IN` - Token expiration (default: 15m)
- `FRONTEND_URL` - CORS origin (default: http://localhost:5173)
- `OPENAI_API_KEY` - Embedding generation (optional)
- `NODE_ENV` - Development or production
- `LOG_LEVEL` - Winston logging level

### 10.3 Docker Support

```dockerfile
# Build stage
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
CMD ["node", "dist/main"]
```

---

## 11. SUMMARY & ARCHITECTURAL STRENGTHS

### Strengths
1. **Modular Design** - 15 domain modules with clear separation
2. **Type Safety** - Full TypeScript implementation with Prisma types
3. **Progressive Disclosure** - Efficient tool discovery for agents
4. **Real-time Capability** - WebSocket support for live collaboration
5. **Comprehensive Testing** - Test infrastructure with test cases, executions, coverage
6. **Metrics & Analytics** - Built-in agent and code quality metrics
7. **Secure Authentication** - JWT + RBAC with role-based decorators
8. **Scalable Database** - PostgreSQL with indexes, transactions, vector search
9. **Well-Documented API** - Swagger/OpenAPI with Nest decorators
10. **Observable** - Winston logging, request interceptors, error filters

### Areas for Enhancement
1. **Caching Layer** - Redis for frequently accessed data
2. **Event-Driven Architecture** - Bull job queue integration
3. **Rate Limiting** - API throttling for public endpoints
4. **Multi-tenancy** - Currently single-tenant; could extend
5. **GraphQL** - Alternative to REST API
6. **Background Jobs** - Async processing for heavy operations
7. **API Versioning** - Support v1, v2 endpoints
8. **Circuit Breakers** - Resilience for external service calls

---

