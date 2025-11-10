# AIStudio MCP Control Plane - High-Level Architecture

**Version:** 1.0
**Date:** 2025-11-10
**Status:** Architecture Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architectural Principles](#architectural-principles)
3. [Layered Architecture](#layered-architecture)
4. [Component Model](#component-model)
5. [Data Flow & Integration](#data-flow--integration)
6. [Technology Stack](#technology-stack)
7. [Use Case to Component Mapping](#use-case-to-component-mapping)
8. [Non-Functional Requirements](#non-functional-requirements)
9. [Deployment Architecture](#deployment-architecture)
10. [Security Architecture](#security-architecture)
11. [Future Considerations](#future-considerations)

---

## 1. Executive Summary

AIStudio is a unified MCP (Model Context Protocol) control plane designed to manage AI agentic frameworks across development tools. The system serves as a single source of truth for projects, workflows, agents, and metrics, enabling comparison of different agentic framework configurations.

**Key Capabilities:**
- Project and story management with JIRA-like interface
- Automatic telemetry collection from AI agents
- Multi-framework effectiveness comparison
- Code quality monitoring and analysis
- Living documentation with full traceability
- Use case library with semantic search
- Test coverage tracking (unit/integration/E2E)

**Target Users:** Project Managers, Business Analysts, Architects, Developers, QA Engineers, System Administrators

---

## 2. Architectural Principles

### 2.1 Core Principles

1. **Separation of Concerns**
   - Clear layer boundaries (Presentation, Application, Domain, Infrastructure)
   - Each component has a single, well-defined responsibility

2. **Zero Manual Telemetry**
   - Automatic data collection via MCP protocol and git hooks
   - No developer interruption for metrics recording

3. **Event-Driven Architecture**
   - Real-time updates via WebSocket
   - Asynchronous background processing for code analysis
   - Event sourcing for audit trails

4. **API-First Design**
   - RESTful API for CRUD operations
   - MCP Server for tool integration
   - WebSocket for real-time updates
   - GraphQL for complex queries (optional)

5. **Microservices-Ready**
   - Modular design allows future decomposition
   - Service boundaries aligned with bounded contexts

6. **Data-Driven Decision Making**
   - All metrics stored for analysis
   - Semantic search capabilities
   - Machine learning ready (embeddings for use cases)

7. **Extensibility**
   - Plugin architecture for new agentic frameworks
   - Configurable workflows
   - Custom metric definitions

---

## 3. Layered Architecture

The system follows a 4-tier layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Web UI     │  │  MCP Server  │  │   CLI Tool   │         │
│  │  (React/Vue) │  │   (Tools)    │  │  (Bootstrap) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  REST API    │  │  WebSocket   │  │ Background   │         │
│  │   Services   │  │   Gateway    │  │   Workers    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Project  │ │  Agent   │ │ Quality  │ │ Use Case │          │
│  │ Management│ │Telemetry│ │ Analysis │ │  Library │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │PostgreSQL│ │  Redis   │ │   Git    │ │ External │          │
│  │ (+vector)│ │  Cache   │ │  Hooks   │ │   APIs   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Layer Responsibilities

#### **Presentation Layer**
- User interface rendering and interaction
- API gateway and routing
- Authentication and authorization
- Input validation and sanitization
- Response formatting

#### **Application Layer**
- Use case orchestration
- Business workflow coordination
- Transaction management
- Event publishing and subscription
- Background job scheduling

#### **Domain Layer**
- Core business logic
- Domain models and entities
- Business rules and validations
- Domain events
- Repository interfaces

#### **Infrastructure Layer**
- Data persistence
- External service integration
- Caching
- Message queuing
- Logging and monitoring

---

## 4. Component Model

### 4.1 Presentation Layer Components

#### **4.1.1 Web UI (React/Vue + TailwindCSS)**

**Components:**

1. **Project Planning Module**
   - `KanbanBoard`: Drag-and-drop story board
   - `StoryCard`: Story display with metadata
   - `StoryEditor`: Inline editing with layer/component selection
   - `SprintPlanner`: Sprint planning view
   - `BulkOperations`: Multi-story operations

2. **Code Quality Module**
   - `QualityDashboard`: Multi-level health view
   - `LayerBreakdown`: Layer-level metrics
   - `ComponentHeatmap`: Hotspot visualization
   - `FileDetail`: File-level code metrics
   - `FunctionAnalyzer`: Function complexity view
   - `TrendCharts`: Historical quality trends

3. **Agent Performance Module**
   - `FrameworkComparison`: Side-by-side framework metrics
   - `ExecutionTimeline`: Per-story agent runs
   - `AgentMetrics`: Per-agent efficiency (tokens/LOC, LOC/prompt)
   - `CostAnalysis`: ROI calculator
   - `ComplexityNormalizer`: Fair comparison across complexity bands

4. **Use Case Module**
   - `UseCaseLibrary`: Multi-mode search interface
   - `ComponentFilter`: Component-based filtering
   - `SemanticSearch`: Vector similarity search
   - `UseCaseDetail`: Version history and impact
   - `TestCoverage`: Coverage visualization
   - `BatchLinker`: Link use cases to stories

5. **Test Case Module**
   - `CoverageMatrix`: Unit/Integration/E2E view
   - `TestGenerator`: AI-powered test creation
   - `GapAnalyzer`: Coverage recommendations
   - `TestRunner`: CI/CD integration display
   - `ArtifactViewer`: Test results and logs

6. **Shared Components**
   - `NavigationBar`: Global navigation
   - `NotificationCenter`: Real-time alerts
   - `SearchBar`: Global search
   - `UserProfile`: User settings
   - `ThemeManager`: UI customization

#### **4.1.2 MCP Server (Tool API)**

**Tools Exposed:**

1. **Project Management Tools**
   - `create_project`: Initialize new project
   - `create_epic`: Create epic
   - `create_story`: Create story with layers/components
   - `update_story_status`: Move story through workflow
   - `assign_story_to_framework`: Assign framework

2. **Use Case Tools**
   - `create_use_case`: Create use case
   - `search_use_cases`: Semantic search
   - `link_use_case_to_story`: Create traceability
   - `get_use_case_impact`: Analyze dependencies

3. **Telemetry Tools**
   - `record_agent_execution`: Log agent run
   - `link_commit_to_story`: Track code changes
   - `record_test_results`: Log test execution

4. **Query Tools**
   - `get_assigned_stories`: Pull stories for dev
   - `get_project_metrics`: Real-time tracker
   - `get_code_health`: Component-level quality
   - `get_framework_comparison`: Compare effectiveness

#### **4.1.3 CLI Tool (Bootstrap)**

**Commands:**

1. `aistudio init <project-name>`: One-command project setup
2. `aistudio config`: Configure MCP connection
3. `aistudio sync`: Sync with remote server
4. `aistudio status`: Show project status

---

### 4.2 Application Layer Components

#### **4.2.1 REST API Services**

**Service Modules:**

1. **ProjectService**
   - `ProjectController`: CRUD for projects
   - `EpicController`: Epic management
   - `StoryController`: Story management
   - `ReleaseController`: Release planning
   - `SprintController`: Sprint management

2. **UseCaseService**
   - `UseCaseController`: Use case CRUD
   - `SearchController`: Multi-mode search
   - `ImpactController`: Dependency analysis
   - `VersionController`: Version history

3. **TelemetryService**
   - `AgentController`: Agent execution logging
   - `MetricsController`: Metrics aggregation
   - `FrameworkController`: Framework comparison
   - `CommitController`: Commit linking

4. **QualityService**
   - `AnalysisController`: Code analysis endpoints
   - `HealthController`: Health metrics
   - `TrendController`: Historical trends

5. **TestService**
   - `TestCaseController`: Test case management
   - `CoverageController`: Coverage tracking
   - `ExecutionController`: Test run results

6. **AdminService**
   - `FrameworkController`: Framework configuration
   - `LayerController`: Layer/component management
   - `UserController`: User management

#### **4.2.2 WebSocket Gateway**

**Channels:**

1. `project:*`: Project updates
2. `story:*`: Story status changes
3. `metrics:*`: Real-time metrics
4. `quality:*`: Code analysis results
5. `notifications:*`: User notifications

#### **4.2.3 Background Workers**

**Job Types:**

1. **CodeAnalysisWorker**
   - Parse git commits
   - Calculate complexity metrics
   - Detect code smells
   - Update quality dashboard

2. **EmbeddingWorker**
   - Generate use case embeddings
   - Update vector store
   - Reindex on changes

3. **MetricsAggregator**
   - Roll up agent metrics
   - Calculate framework comparisons
   - Generate reports

4. **NotificationWorker**
   - Send email alerts
   - Push WebSocket updates
   - Create in-app notifications

5. **TestAnalyzer**
   - Parse test results from CI/CD
   - Calculate coverage
   - Identify gaps

---

### 4.3 Domain Layer Components

#### **4.3.1 Project Management Domain**

**Entities:**

1. **Project**
   - `id`, `name`, `description`, `repository_url`
   - `created_at`, `updated_at`
   - Relationships: `epics`, `stories`, `releases`

2. **Epic**
   - `id`, `project_id`, `title`, `description`
   - `status`, `priority`, `assigned_framework`
   - Relationships: `stories`

3. **Story**
   - `id`, `epic_id`, `title`, `description`, `status`
   - `priority`, `complexity_score`, `assigned_framework`
   - `layers[]`, `components[]`
   - Relationships: `subtasks`, `commits`, `use_cases`, `test_cases`

4. **Subtask**
   - `id`, `story_id`, `description`, `status`
   - `agent_type` (e.g., "BA", "Architect", "Developer")

5. **Release**
   - `id`, `project_id`, `version`, `release_date`
   - `status`, `notes`
   - Relationships: `stories`

6. **Sprint**
   - `id`, `project_id`, `name`, `start_date`, `end_date`
   - `goal`, `capacity`
   - Relationships: `stories`

**Value Objects:**

- `Priority`: Enum (Critical, High, Medium, Low)
- `Status`: Enum (Backlog, Planning, Analysis, Architecture, Implementation, Review, QA, Done)
- `Layer`: Enum (Frontend, Backend, Infrastructure, Tests, Documentation)
- `Component`: String (e.g., "Auth", "API Gateway", "Database")

**Domain Services:**

- `StoryComplexityCalculator`: Calculate complexity scores
- `StoryAssignmentService`: Assign stories to frameworks
- `ReleaseValidator`: Validate release criteria

#### **4.3.2 Agent Telemetry Domain**

**Entities:**

1. **AgentExecution**
   - `id`, `story_id`, `subtask_id`, `agent_type`
   - `framework_config`, `start_time`, `end_time`
   - `tokens_used`, `cost`, `status`
   - `model_name`, `prompt_tokens`, `completion_tokens`

2. **CodeChange**
   - `id`, `story_id`, `commit_hash`, `timestamp`
   - `files_changed`, `lines_added`, `lines_deleted`
   - `author`, `message`

3. **Framework**
   - `id`, `name`, `description`
   - `agent_sequence[]` (e.g., ["BA", "Architect", "Developer", "QA"])
   - `config_json`

**Aggregates:**

- `StoryMetrics`: Aggregated metrics per story
  - Total tokens, total cost, total runtime
  - LOC generated, tokens/LOC, LOC/prompt
  - Complexity band, framework used

- `FrameworkMetrics`: Aggregated metrics per framework
  - Average tokens/LOC, LOC/prompt, runtime/LOC
  - Success rate, story count
  - Normalized by complexity

**Domain Services:**

- `MetricsCalculator`: Calculate efficiency metrics
- `FrameworkComparator`: Compare framework effectiveness
- `ComplexityNormalizer`: Normalize metrics by complexity

#### **4.3.3 Quality Analysis Domain**

**Entities:**

1. **QualitySnapshot**
   - `id`, `project_id`, `timestamp`
   - `overall_health_score`
   - Relationships: `layer_metrics`, `component_metrics`

2. **LayerMetrics**
   - `id`, `snapshot_id`, `layer`
   - `health_score`, `complexity_avg`, `test_coverage`
   - `hotspot_count`

3. **ComponentMetrics**
   - `id`, `snapshot_id`, `component`
   - `health_score`, `file_count`, `loc`
   - `complexity_avg`, `duplication_pct`

4. **FileMetrics**
   - `id`, `component_id`, `file_path`
   - `loc`, `complexity`, `test_coverage`
   - `last_modified`, `change_frequency`

5. **FunctionMetrics**
   - `id`, `file_id`, `function_name`, `line_start`, `line_end`
   - `complexity`, `parameters`, `nesting_depth`
   - `suggestions[]`

**Value Objects:**

- `HealthScore`: 0-100 scale with thresholds (Good: 80+, Fair: 60-79, Poor: <60)
- `ComplexityLevel`: Enum (Low, Medium, High, Very High)
- `RefactoringSuggestion`: Type + description

**Domain Services:**

- `CodeAnalyzer`: Parse and analyze code
- `HealthScoreCalculator`: Calculate health scores
- `HotspotDetector`: Identify problem areas

#### **4.3.4 Use Case Library Domain**

**Entities:**

1. **UseCase**
   - `id`, `code` (e.g., "UC-PM-001"), `title`, `description`
   - `role`, `preconditions`, `postconditions`
   - `main_flow[]`, `alternative_flows[]`, `exception_flows[]`
   - `components[]`, `embedding_vector`
   - `version`, `status`

2. **UseCaseVersion**
   - `id`, `use_case_id`, `version`, `timestamp`
   - `changes`, `author`
   - `snapshot` (full use case content)

3. **UseCaseLink**
   - `id`, `use_case_id`, `story_id`
   - `link_type` (Implements, Tests, References)
   - `created_at`

4. **ImpactAnalysis**
   - `use_case_id`, `affected_components[]`
   - `affected_stories[]`, `risk_level`

**Value Objects:**

- `Role`: Enum (PM, BA, Architect, Developer, QA, Admin)
- `UseCaseStatus`: Enum (Draft, Active, Deprecated)

**Domain Services:**

- `SemanticSearchService`: Vector similarity search
- `ImpactAnalyzer`: Analyze use case dependencies
- `UseCaseVersioner`: Manage versioning

#### **4.3.5 Test Management Domain**

**Entities:**

1. **TestCase**
   - `id`, `use_case_id`, `story_id`, `title`
   - `type` (Unit, Integration, E2E)
   - `status`, `priority`, `automated`
   - `steps[]`, `expected_results[]`

2. **TestExecution**
   - `id`, `test_case_id`, `execution_date`
   - `status` (Passed, Failed, Skipped)
   - `runtime`, `error_message`
   - `artifacts[]` (logs, screenshots)

3. **CoverageReport**
   - `id`, `project_id`, `component`, `timestamp`
   - `unit_coverage`, `integration_coverage`, `e2e_coverage`
   - `gaps[]`

**Value Objects:**

- `TestType`: Enum (Unit, Integration, E2E)
- `TestStatus`: Enum (Passed, Failed, Skipped, Blocked)

**Domain Services:**

- `CoverageCalculator`: Calculate coverage percentages
- `GapAnalyzer`: Identify coverage gaps
- `TestGenerator`: AI-powered test generation

---

### 4.4 Infrastructure Layer Components

#### **4.4.1 Data Persistence**

**Repositories (Interface in Domain, Implementation in Infrastructure):**

1. `ProjectRepository`: CRUD for projects
2. `StoryRepository`: CRUD for stories with filtering
3. `AgentExecutionRepository`: Telemetry storage
4. `UseCaseRepository`: Use case library + vector search
5. `QualityRepository`: Quality metrics storage
6. `TestCaseRepository`: Test management

**Database Schema (PostgreSQL):**

- **Projects Table**: Core project data
- **Stories Table**: Stories with JSON fields for layers/components
- **Agent_Executions Table**: Telemetry data
- **Use_Cases Table**: Use case library with vector column
- **Quality_Snapshots Table**: Time-series quality data
- **Test_Cases Table**: Test definitions
- **Test_Executions Table**: Test results

**Vector Store (pgvector extension):**

- Use case embeddings for semantic search
- Similarity search using cosine distance

#### **4.4.2 Caching (Redis)**

**Cache Strategies:**

1. **Project Dashboard**: Cache aggregated metrics (TTL: 5 min)
2. **Framework Comparison**: Cache calculations (TTL: 15 min)
3. **Quality Dashboard**: Cache latest snapshot (TTL: 10 min)
4. **Search Results**: Cache frequent queries (TTL: 30 min)

**Cache Keys:**

- `project:{id}:dashboard`
- `framework:{id}:metrics`
- `quality:{project_id}:latest`
- `search:{query_hash}`

#### **4.4.3 Git Integration**

**Git Hooks:**

1. **post-commit Hook**: Auto-link commits to stories
   - Parse commit message for story ID
   - Call MCP tool to record code change
   - Calculate lines changed

2. **pre-push Hook**: Validate story links
   - Ensure all commits linked to stories
   - Warn if unlinked commits

**Repository Analysis:**

- Clone/pull repository for analysis
- Parse file tree to calculate metrics
- Track file change frequency

#### **4.4.4 External Integrations**

**Planned Integrations:**

1. **CI/CD Systems** (Jenkins, GitHub Actions)
   - Webhook receivers for test results
   - Parse coverage reports
   - Update test execution status

2. **Version Control** (GitHub, GitLab)
   - OAuth authentication
   - Repository access
   - Webhook for commits

3. **Embedding API** (OpenAI, Cohere)
   - Generate use case embeddings
   - Semantic search

4. **Code Analysis Tools** (SonarQube, ESLint)
   - Import quality metrics
   - Sync defect data

---

## 5. Data Flow & Integration

### 5.1 Key Data Flows

#### **Flow 1: Story Creation to Implementation**

```
1. PM creates story via Web UI
   → StoryController.create()
   → StoryService.createStory()
   → StoryRepository.save()
   → WebSocket: broadcast story created

2. PM assigns to framework (e.g., "BA+Arch+Dev+QA")
   → StoryController.assignFramework()
   → StoryService.assignFramework()
   → Create subtasks for each agent in sequence

3. Developer pulls story via Claude Code (MCP)
   → MCP Tool: get_assigned_stories()
   → StoryService.getAssignedStories()
   → Return stories with details

4. Developer asks Claude to implement
   → Claude Code executes, auto-logs telemetry
   → MCP Tool: record_agent_execution()
   → AgentExecutionRepository.save()

5. Developer commits code
   → Git post-commit hook triggered
   → MCP Tool: link_commit_to_story()
   → CodeChangeRepository.save()
   → Background worker: analyze code changes

6. Metrics displayed in dashboard
   → MetricsController.getStoryMetrics()
   → MetricsService.calculateMetrics()
   → WebSocket: broadcast metrics update
```

#### **Flow 2: Code Quality Analysis**

```
1. Code change committed
   → Git hook: link_commit_to_story()
   → Queue background job: analyze_code

2. CodeAnalysisWorker executes
   → Parse file changes
   → Calculate complexity metrics
   → Detect code smells
   → Update quality snapshot

3. Quality metrics stored
   → QualityRepository.saveSnapshot()
   → WebSocket: broadcast quality update

4. Architect views dashboard
   → QualityController.getDashboard()
   → Multi-level aggregation (project → layer → component → file → function)
   → Return metrics with trends
```

#### **Flow 3: Use Case to Test Coverage**

```
1. BA creates use case
   → UseCaseController.create()
   → Generate embedding via API
   → UseCaseRepository.save()

2. BA links use case to story
   → UseCaseLinkRepository.save()
   → Traceability established

3. QA generates test cases from use case
   → TestController.generateFromUseCase()
   → AI analyzes use case flows
   → Create test cases (unit/integration/E2E)

4. Tests executed in CI/CD
   → Webhook receives results
   → TestExecutionRepository.save()
   → CoverageCalculator updates coverage

5. QA views coverage gaps
   → TestController.getCoverage()
   → GapAnalyzer identifies missing tests
   → Recommendations generated
```

#### **Flow 4: Framework Comparison**

```
1. Multiple stories completed with different frameworks
   → Agent executions logged automatically

2. PM views framework comparison
   → MetricsController.compareFrameworks()
   → Load all agent executions
   → Group by framework + complexity band
   → Calculate: tokens/LOC, LOC/prompt, runtime/LOC, cost/story

3. Display side-by-side comparison
   → Normalize by complexity
   → Show ROI calculations
   → Trend charts over time
```

### 5.2 Integration Points

#### **External Systems:**

1. **Claude Code CLI**
   - Protocol: MCP
   - Integration: MCP Server tools
   - Data: Stories, telemetry, use cases

2. **Git Repositories**
   - Protocol: Git hooks + API
   - Integration: Post-commit hooks, repository cloning
   - Data: Commits, file changes, code metrics

3. **CI/CD Pipelines**
   - Protocol: Webhooks
   - Integration: Test result receivers
   - Data: Test executions, coverage reports

4. **Embedding Services**
   - Protocol: REST API
   - Integration: Background workers
   - Data: Use case embeddings

#### **Internal Systems:**

1. **Web UI ↔ REST API**
   - Protocol: HTTPS + WebSocket
   - Authentication: JWT tokens
   - Real-time: WebSocket channels

2. **REST API ↔ Background Workers**
   - Protocol: Message queue (Redis/Bull or RabbitMQ)
   - Job types: Code analysis, embeddings, metrics aggregation

3. **Background Workers ↔ Database**
   - Protocol: PostgreSQL connection pool
   - Transactions for data consistency

---

## 6. Technology Stack

### 6.1 Backend

**Primary Option: Node.js + TypeScript**

- **Framework**: Express.js or NestJS (recommended for structure)
- **ORM**: Prisma or TypeORM
- **Validation**: Zod or Joi
- **Authentication**: Passport.js with JWT
- **WebSocket**: Socket.io
- **Background Jobs**: Bull (Redis-based queue)
- **Testing**: Jest + Supertest

**Alternative: Python + FastAPI**

- **Framework**: FastAPI
- **ORM**: SQLAlchemy or Prisma (Python client)
- **Validation**: Pydantic
- **Authentication**: FastAPI Security + JWT
- **WebSocket**: FastAPI WebSocket
- **Background Jobs**: Celery + Redis
- **Testing**: Pytest

**Recommendation**: Node.js/TypeScript with NestJS
- Better MCP integration (existing Node.js ecosystem)
- Type safety across frontend/backend
- Mature ecosystem for WebSocket and real-time features

### 6.2 Frontend

**Framework**: React with TypeScript

- **State Management**: Zustand or Redux Toolkit
- **UI Library**: TailwindCSS + Headless UI
- **Drag-and-Drop**: dnd-kit or react-beautiful-dnd
- **Charts**: Recharts or Chart.js
- **Forms**: React Hook Form + Zod
- **API Client**: TanStack Query (React Query)
- **WebSocket**: Socket.io client
- **Testing**: Vitest + React Testing Library

**Build Tool**: Vite

### 6.3 Database

**Primary Database**: PostgreSQL 15+

- **Extensions**:
  - `pgvector`: Vector similarity search for use cases
  - `pg_trgm`: Trigram-based text search
  - `timescaledb` (optional): Time-series optimization for metrics

**Schema Design**:
- Normalized tables for entities
- JSON columns for flexible metadata (layers, components)
- Vector column for embeddings
- Indexes on foreign keys, status, timestamps

### 6.4 Caching & Message Queue

**Redis**: Multi-purpose
- Cache layer (dashboard metrics, search results)
- Message queue (Bull job queue)
- WebSocket pub/sub
- Session store

### 6.5 MCP Server

**Implementation**: Node.js/TypeScript

- **Framework**: Custom MCP server using `@modelcontextprotocol/sdk`
- **Tools**: 15+ tools for project management, telemetry, queries
- **Transport**: Stdio or SSE
- **Security**: API key authentication

### 6.6 CLI Tool

**Implementation**: Node.js with Commander.js

- **Commands**: init, config, sync, status
- **Features**:
  - One-command project bootstrap
  - Interactive prompts (inquirer.js)
  - Progress bars (ora, chalk)
  - Configuration management

### 6.7 Background Workers

**Implementation**: Bull (Node.js) or Celery (Python)

- **Workers**:
  - Code analysis (parse commits, calculate metrics)
  - Embedding generation (use case vectors)
  - Metrics aggregation (roll-up calculations)
  - Notifications (email, WebSocket)
  - Test analysis (CI/CD webhook processing)

**Scheduler**: Node-cron or Bull repeatable jobs

### 6.8 DevOps & Infrastructure

**Containerization**: Docker + Docker Compose

**Deployment Options**:
1. **Self-hosted**: Docker Compose on VPS
2. **Cloud**: AWS (ECS/RDS), Google Cloud, or Azure
3. **Kubernetes**: For enterprise scale

**CI/CD**: GitHub Actions

**Monitoring**:
- Logging: Winston (Node.js) or Structlog (Python)
- Metrics: Prometheus + Grafana
- Error tracking: Sentry
- APM: New Relic or Datadog (optional)

**Backup**: Automated PostgreSQL backups (daily)

### 6.9 Security

**Authentication**: JWT with refresh tokens

**Authorization**: Role-based access control (RBAC)
- Roles: Admin, PM, BA, Architect, Developer, QA

**API Security**:
- Rate limiting (express-rate-limit)
- CORS configuration
- Input validation and sanitization
- SQL injection prevention (ORM parameterized queries)
- XSS prevention (Content Security Policy)

**Data Encryption**:
- TLS/HTTPS for all traffic
- Encrypted database connections
- Secure storage for API keys (environment variables)

---

## 7. Use Case to Component Mapping

### 7.1 Project Manager Use Cases

| Use Case | Primary Components | Data Flow |
|----------|-------------------|-----------|
| UC-PM-001: Create New Project | ProjectController, ProjectService, ProjectRepository | Web UI → REST API → DB |
| UC-PM-002: Create Epic | EpicController, EpicService, EpicRepository | Web UI → REST API → DB |
| UC-PM-003: Create Story | StoryController, StoryService, StoryRepository | Web UI → REST API → DB → WebSocket |
| UC-PM-004: Assign Story to Framework | StoryService, FrameworkService, SubtaskService | Web UI → REST API → DB (create subtasks) |
| UC-PM-005: View Project Dashboard | MetricsController, MetricsService, Cache | Web UI → REST API → Cache/DB → Aggregation |
| UC-PM-006: Create Release | ReleaseController, ReleaseService, ReleaseRepository | Web UI → REST API → DB |
| UC-PM-007: JIRA-like Planning View | StoryController, WebSocket, KanbanBoard (UI) | Web UI → REST API → WebSocket (real-time) |

### 7.2 Business Analyst Use Cases

| Use Case | Primary Components | Data Flow |
|----------|-------------------|-----------|
| UC-BA-001: Analyze Story Requirements | StoryController, UseCaseService | Web UI → REST API → DB (story + linked use cases) |
| UC-BA-002: Create Use Case | UseCaseController, EmbeddingWorker | Web UI → REST API → DB → Queue (embedding job) |
| UC-BA-003: View Use Case Impact Analysis | ImpactController, ImpactAnalyzer | Web UI → REST API → Domain Service → DB |
| UC-BA-004: Search Use Case Library | SearchController, SemanticSearchService, pgvector | Web UI → REST API → Vector search |
| UC-BA-005: Advanced Use Case Search | SearchController, ComponentFilter (UI) | Web UI → REST API → DB (component filtering) |
| UC-BA-006: Maintain Layers and Components | LayerController, ComponentService | Web UI → REST API → DB (metadata update) |
| UC-BA-007: Use Case Versioning | VersionController, UseCaseVersioner | Web UI → REST API → DB (version snapshot) |

### 7.3 Architect Use Cases

| Use Case | Primary Components | Data Flow |
|----------|-------------------|-----------|
| UC-ARCH-001: Assess Technical Complexity | StoryController, StoryComplexityCalculator | Web UI → REST API → Domain Service (calculate) |
| UC-ARCH-002: View Code Quality Dashboard | QualityController, QualityDashboard (UI) | Web UI → REST API → Cache/DB (multi-level metrics) |
| UC-ARCH-003: Analyze Story Dependencies | StoryService, DependencyAnalyzer | Web UI → REST API → Domain Service → DB |
| UC-ARCH-004: Query Code Health by Component | QualityController, ComponentMetrics | Web UI → REST API → DB (drill-down: component → file → function) |

### 7.4 Developer Use Cases

| Use Case | Primary Components | Data Flow |
|----------|-------------------|-----------|
| UC-DEV-001: Pull Assigned Stories | MCP Server (get_assigned_stories), StoryService | Claude Code → MCP → REST API → DB |
| UC-DEV-002: Implement Story | MCP Server (record_agent_execution), AgentExecutionRepository | Claude Code → MCP → REST API → DB (auto-telemetry) |
| UC-DEV-003: Link Commit to Story | Git Hook, MCP Server (link_commit_to_story), CodeChangeRepository | Git commit → Hook → MCP → REST API → DB → Queue (analysis) |

### 7.5 QA/Tester Use Cases

| Use Case | Primary Components | Data Flow |
|----------|-------------------|-----------|
| UC-QA-001: Test Story Implementation | TestExecutionController, TestExecutionRepository | Web UI → REST API → DB |
| UC-QA-002: Report Defect | DefectController (part of StoryService), DefectRepository | Web UI → REST API → DB (link to story) |
| UC-QA-003: Manage Test Case Coverage | TestController, CoverageCalculator, TestGenerator | Web UI → REST API → Domain Service → DB |

### 7.6 Metrics & Analytics Use Cases

| Use Case | Primary Components | Data Flow |
|----------|-------------------|-----------|
| UC-METRICS-001: View Framework Effectiveness | FrameworkController, FrameworkComparator | Web UI → REST API → Domain Service → Cache/DB |
| UC-METRICS-002: View Project Tracker | MetricsController, MetricsAggregator | Web UI → REST API → Cache → WebSocket (real-time) |
| UC-METRICS-003: View Agent Execution Details | AgentController, ExecutionTimeline (UI) | Web UI → REST API → DB (per-agent metrics) |
| UC-METRICS-004: Framework Weekly Comparison | FrameworkController, TrendCharts (UI) | Web UI → REST API → DB (time-series aggregation) |

### 7.7 System Administration Use Cases

| Use Case | Primary Components | Data Flow |
|----------|-------------------|-----------|
| UC-ADMIN-001: Bootstrap Project | CLI Tool (aistudio init), ProjectService, MCP Server | CLI → REST API → DB (create project structure) |
| UC-ADMIN-002: Manage Agentic Frameworks | FrameworkController, FrameworkRepository | Web UI → REST API → DB |
| UC-ADMIN-003: Manage Layers and Components | LayerController, ComponentRepository | Web UI → REST API → DB |

### 7.8 Integration Use Cases

| Use Case | Primary Components | Data Flow |
|----------|-------------------|-----------|
| UC-INT-001: End-to-End Story Workflow | All components (orchestration) | Web UI → MCP → Git Hook → Background Workers → WebSocket |

---

## 8. Non-Functional Requirements

### 8.1 Performance

1. **API Response Time**
   - Simple queries: < 100ms (p95)
   - Complex aggregations: < 500ms (p95)
   - Dashboard load: < 1s (p95)

2. **WebSocket Latency**
   - Real-time updates: < 200ms

3. **Background Jobs**
   - Code analysis: < 5 min per commit
   - Embedding generation: < 10s per use case
   - Metrics aggregation: < 1 min (scheduled)

4. **Database**
   - Connection pooling: 20-50 connections
   - Indexes on all foreign keys and frequently queried columns
   - Partitioning for time-series data (quality snapshots)

5. **Caching**
   - Cache hit ratio: > 80% for dashboards
   - Redis latency: < 10ms

### 8.2 Scalability

1. **Horizontal Scaling**
   - Stateless API servers (load balancer)
   - Multiple background workers
   - Redis cluster for high availability

2. **Database Scaling**
   - Read replicas for analytics queries
   - Connection pooling
   - Eventual migration to TimescaleDB for time-series

3. **Capacity Planning**
   - Support 100 concurrent users initially
   - 1000+ projects, 10,000+ stories
   - 100,000+ agent executions

### 8.3 Reliability

1. **Availability**
   - Target: 99.5% uptime
   - Graceful degradation (read-only mode if DB issues)

2. **Data Integrity**
   - Transactions for critical operations
   - Foreign key constraints
   - Backup and restore procedures

3. **Error Handling**
   - Centralized error logging
   - Retry logic for external APIs
   - Circuit breakers for third-party services

4. **Monitoring**
   - Health check endpoints
   - Alerting on critical errors
   - Performance metrics

### 8.4 Security

1. **Authentication**
   - JWT with 15-min access tokens
   - 7-day refresh tokens
   - Secure password hashing (bcrypt)

2. **Authorization**
   - Role-based access control
   - Resource-level permissions

3. **Data Protection**
   - HTTPS only
   - Encrypted database connections
   - Secure API key storage

4. **Compliance**
   - GDPR-ready (data export/deletion)
   - Audit logs for sensitive operations

### 8.5 Maintainability

1. **Code Quality**
   - TypeScript for type safety
   - Linting (ESLint) and formatting (Prettier)
   - Code coverage > 80%

2. **Documentation**
   - API documentation (OpenAPI/Swagger)
   - Component documentation (JSDoc/TSDoc)
   - Architecture decision records (ADRs)

3. **Testing**
   - Unit tests for domain logic
   - Integration tests for API endpoints
   - E2E tests for critical workflows

4. **Observability**
   - Structured logging
   - Distributed tracing (optional)
   - Performance profiling

---

## 9. Deployment Architecture

### 9.1 Development Environment

```
Docker Compose Stack:
┌─────────────────────────────────────────────┐
│  Development Environment                    │
│                                             │
│  ┌──────────────┐    ┌──────────────┐     │
│  │   Frontend   │    │   Backend    │     │
│  │ (Vite dev)   │    │  (Node.js)   │     │
│  │  Port 5173   │    │  Port 3000   │     │
│  └──────────────┘    └──────────────┘     │
│                                             │
│  ┌──────────────┐    ┌──────────────┐     │
│  │  PostgreSQL  │    │    Redis     │     │
│  │  Port 5432   │    │  Port 6379   │     │
│  └──────────────┘    └──────────────┘     │
│                                             │
│  ┌──────────────┐                          │
│  │ MCP Server   │                          │
│  │  (stdio)     │                          │
│  └──────────────┘                          │
└─────────────────────────────────────────────┘
```

### 9.2 Production Environment (Self-Hosted)

```
Server Architecture:
┌─────────────────────────────────────────────────────────┐
│  Load Balancer (nginx)                                  │
│  HTTPS (SSL Termination)                                │
└────────────┬────────────────────────────────────────────┘
             │
   ┌─────────┴──────────┐
   │                    │
┌──▼──────────┐   ┌────▼─────────┐
│  API Server │   │  API Server  │  (Horizontal scaling)
│  (Node.js)  │   │  (Node.js)   │
└──┬──────────┘   └────┬─────────┘
   │                   │
   └─────────┬─────────┘
             │
   ┌─────────┴──────────────────────────────┐
   │                                        │
┌──▼────────────┐  ┌──────────────┐  ┌────▼──────────┐
│  PostgreSQL   │  │    Redis     │  │  Background   │
│  (Primary)    │  │   (Cache/    │  │   Workers     │
│               │  │    Queue)    │  │  (Bull/Node)  │
└───────────────┘  └──────────────┘  └───────────────┘
```

### 9.3 Cloud Deployment (AWS Example)

```
AWS Architecture:
┌─────────────────────────────────────────────────────────┐
│  Route 53 (DNS)                                         │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│  CloudFront (CDN) + S3 (Static frontend)                │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│  ALB (Application Load Balancer)                        │
└────────────┬────────────────────────────────────────────┘
             │
   ┌─────────┴──────────┐
   │                    │
┌──▼──────────┐   ┌────▼─────────┐
│  ECS Task   │   │  ECS Task    │  (Auto-scaling)
│  (Backend)  │   │  (Workers)   │
└──┬──────────┘   └────┬─────────┘
   │                   │
   └─────────┬─────────┘
             │
   ┌─────────┴──────────────────────┐
   │                                │
┌──▼────────────┐  ┌───────────────▼─┐
│  RDS          │  │  ElastiCache    │
│  (PostgreSQL) │  │  (Redis)        │
│  Multi-AZ     │  │                 │
└───────────────┘  └─────────────────┘
```

### 9.4 Container Structure

**Docker Images:**

1. **Backend (Node.js)**
   - Base: `node:20-alpine`
   - Includes: API server + MCP server
   - Health check endpoint

2. **Frontend (React)**
   - Build: `node:20-alpine`
   - Serve: `nginx:alpine`
   - Optimized static assets

3. **Background Workers**
   - Base: `node:20-alpine`
   - Bull workers + schedulers

**Docker Compose Services:**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  backend:
    build: ./backend
    depends_on: [postgres, redis]
    environment:
      - DATABASE_URL
      - REDIS_URL

  workers:
    build: ./backend
    command: npm run workers
    depends_on: [postgres, redis]

  frontend:
    build: ./frontend
    depends_on: [backend]
```

---

## 10. Security Architecture

### 10.1 Authentication Flow

```
1. User Login
   → Frontend: POST /auth/login {email, password}
   → Backend: Validate credentials
   → Generate JWT access token (15 min) + refresh token (7 days)
   → Return tokens + user profile

2. API Request
   → Frontend: Include Authorization: Bearer <access_token>
   → Backend: Validate JWT signature + expiry
   → Extract user ID + roles
   → Process request with user context

3. Token Refresh
   → Frontend: POST /auth/refresh {refresh_token}
   → Backend: Validate refresh token
   → Generate new access token
   → Return new access token

4. Logout
   → Frontend: POST /auth/logout
   → Backend: Invalidate refresh token (store in blacklist)
```

### 10.2 Authorization Model

**Roles:**

1. **Admin**: Full system access
2. **PM**: Project management, story creation, dashboard viewing
3. **BA**: Use case management, story analysis
4. **Architect**: Code quality, complexity assessment
5. **Developer**: Story implementation, commit linking
6. **QA**: Test management, defect reporting

**Permissions Matrix:**

| Resource | Admin | PM | BA | Architect | Developer | QA |
|----------|-------|----|----|-----------|-----------|-----|
| Create Project | ✓ | ✓ | - | - | - | - |
| Create Story | ✓ | ✓ | - | - | - | - |
| Create Use Case | ✓ | ✓ | ✓ | - | - | - |
| View Code Quality | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Record Telemetry | ✓ | - | - | - | ✓ | ✓ |
| Manage Frameworks | ✓ | - | - | - | - | - |
| Create Test Cases | ✓ | - | - | - | - | ✓ |

**Implementation:**

```typescript
@RequireRole(['Admin', 'PM'])
@Post('/projects')
async createProject() { ... }

@RequirePermission('view_code_quality')
@Get('/quality/:projectId')
async getCodeQuality() { ... }
```

### 10.3 Data Security

1. **Sensitive Data**
   - Passwords: bcrypt hashing (12 rounds)
   - API keys: Encrypted at rest (AES-256)
   - Tokens: Signed with secret key

2. **Database Security**
   - Connection pooling with SSL
   - Parameterized queries (SQL injection prevention)
   - Row-level security (future enhancement)

3. **API Security**
   - Rate limiting: 100 requests/min per IP
   - CORS: Whitelist allowed origins
   - Content Security Policy headers
   - Input validation (Zod schemas)

4. **MCP Server Security**
   - API key authentication
   - Request signing (HMAC)
   - IP whitelisting (optional)

### 10.4 Audit Logging

**Logged Events:**

- User login/logout
- Project/story creation
- Framework assignment
- Use case modifications
- Configuration changes

**Audit Log Format:**

```json
{
  "timestamp": "2025-11-10T12:34:56Z",
  "user_id": "user-123",
  "action": "create_story",
  "resource_type": "story",
  "resource_id": "story-456",
  "details": {"title": "New feature", "status": "backlog"},
  "ip_address": "192.168.1.1"
}
```

---

## 11. Future Considerations

### 11.1 Phase 2 Enhancements

1. **Advanced AI Features**
   - Story auto-completion from use cases
   - Complexity prediction using ML
   - Anomaly detection in metrics (outlier identification)
   - Intelligent test case generation

2. **Collaboration Features**
   - Real-time collaborative editing
   - Comments and mentions
   - Activity feeds
   - Slack/Teams integration

3. **Advanced Analytics**
   - Predictive analytics (story completion time)
   - Trend forecasting
   - Custom dashboards
   - Data export to BI tools

4. **Integration Expansion**
   - Jira bidirectional sync
   - GitHub Issues integration
   - Confluence for documentation
   - Tableau/PowerBI connectors

### 11.2 Scalability Improvements

1. **Microservices Architecture**
   - Split into bounded contexts: ProjectService, MetricsService, QualityService
   - Event-driven communication (Kafka/RabbitMQ)
   - API Gateway (Kong, AWS API Gateway)

2. **Database Optimization**
   - Sharding for multi-tenancy
   - Read replicas for analytics
   - TimescaleDB for time-series
   - Elasticsearch for advanced search

3. **Caching Strategy**
   - Multi-tier caching (L1: in-memory, L2: Redis)
   - Cache warming strategies
   - CDN for static assets

### 11.3 Enterprise Features

1. **Multi-Tenancy**
   - Tenant isolation
   - Per-tenant customization
   - Usage metering
   - Billing integration

2. **SSO Integration**
   - SAML 2.0
   - OAuth2 (Google, GitHub)
   - LDAP/Active Directory

3. **Compliance**
   - SOC 2 compliance
   - GDPR data protection
   - HIPAA (if needed)
   - Audit trail retention

4. **High Availability**
   - Multi-region deployment
   - Automatic failover
   - Disaster recovery plan
   - 99.9% SLA

### 11.4 Developer Experience

1. **API SDK**
   - JavaScript/TypeScript SDK
   - Python SDK
   - CLI improvements

2. **Webhooks**
   - Outbound webhooks for events
   - Custom integrations

3. **Plugin System**
   - Custom agent types
   - Custom metrics
   - Custom dashboards

---

## Summary

This architecture provides a solid foundation for the AIStudio MCP Control Plane:

✅ **Layered Architecture** with clear separation of concerns
✅ **36 Use Cases** mapped to specific components
✅ **5 Screen Designs** aligned with UI components
✅ **Event-Driven** with real-time updates via WebSocket
✅ **Automatic Telemetry** via MCP integration and git hooks
✅ **Scalable** with background workers and caching
✅ **Extensible** with plugin architecture
✅ **Secure** with JWT auth, RBAC, and audit logging

**Next Steps:**
1. Review and approve architecture
2. Set up development environment (Docker Compose)
3. Implement database schema (PostgreSQL + pgvector)
4. Build MCP server with core tools
5. Develop REST API (NestJS)
6. Create Web UI (React + TailwindCSS)
7. Implement background workers
8. Deploy and iterate

---

**Document Status:** Ready for Review
**Approval Required:** Project Stakeholders
**Next Review:** After implementation begins
