# AI Studio MCP Server

The AI Studio MCP (Model Context Protocol) Server provides tools for managing projects, epics, and stories through Claude Code CLI or any MCP-compatible client.

## Overview

This MCP server exposes 10 tools for Sprint 3:

### Project Management (4 tools)
- `bootstrap_project` - Create a project with default structure
- `create_project` - Create a basic project
- `list_projects` - List all projects
- `get_project` - Get project details

### Epic Management (2 tools)
- `create_epic` - Create an epic
- `list_epics` - List epics for a project

### Story Management (4 tools)
- `create_story` - Create a story
- `list_stories` - List stories with filters
- `get_story` - Get story details with related data
- `update_story` - Update story fields

## Setup

### 1. Build the Backend

```bash
cd backend
npm run build
```

### 2. Configure Claude Code

Add the MCP server to your Claude Code configuration:

**For Development (using ts-node):**
```json
{
  "mcpServers": {
    "aistudio": {
      "command": "npx",
      "args": ["ts-node", "--esm", "backend/src/mcp/server.ts"],
      "cwd": "/home/user/AIStudio",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/aistudio?schema=public",
        "NODE_ENV": "development"
      }
    }
  }
}
```

**For Production (using built files):**
```json
{
  "mcpServers": {
    "aistudio": {
      "command": "node",
      "args": ["backend/dist/mcp/server.js"],
      "cwd": "/home/user/AIStudio",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/aistudio?schema=public"
      }
    }
  }
}
```

### 3. Start the Database

```bash
docker compose up -d postgres
```

### 4. Run Migrations

```bash
cd backend
npm run db:migrate:deploy
```

## Tool Documentation

### bootstrap_project

Bootstrap a new project with default structure (recommended for new projects).

**Parameters:**
- `name` (required): Project name (must be unique)
- `description` (optional): Project description
- `repositoryUrl` (optional): Git repository URL
- `defaultFramework` (optional): Name for default framework (default: "Single Agent")

**Example:**
```json
{
  "name": "MyApp",
  "description": "A new application",
  "repositoryUrl": "https://github.com/user/myapp",
  "defaultFramework": "Full Stack"
}
```

**Returns:**
```json
{
  "project": {
    "id": "uuid",
    "name": "MyApp",
    "description": "A new application",
    "status": "active",
    "createdAt": "2025-11-10T...",
    "epicCount": 1,
    "storyCount": 0
  },
  "defaultEpic": {
    "id": "uuid",
    "key": "EP-1",
    "title": "Initial Development"
  },
  "defaultFramework": {
    "id": "uuid",
    "name": "Full Stack"
  },
  "message": "Project \"MyApp\" bootstrapped successfully..."
}
```

---

### create_project

Create a new project without default structure.

**Parameters:**
- `name` (required): Project name
- `description` (optional): Project description
- `repositoryUrl` (optional): Git repository URL

**Example:**
```json
{
  "name": "BasicProject",
  "description": "A basic project"
}
```

---

### list_projects

List all projects with optional status filter.

**Parameters:**
- `status` (optional): Filter by status (`active` or `archived`)

**Example:**
```json
{
  "status": "active"
}
```

**Returns:**
```json
[
  {
    "id": "uuid",
    "name": "Project 1",
    "description": "...",
    "status": "active",
    "epicCount": 3,
    "storyCount": 15,
    "createdAt": "2025-11-10T...",
    "updatedAt": "2025-11-10T..."
  }
]
```

---

### get_project

Get details for a specific project.

**Parameters:**
- `projectId` (required): Project UUID

**Example:**
```json
{
  "projectId": "123e4567-e89b-12d3-a456-426614174000"
}
```

---

### create_epic

Create a new epic within a project.

**Parameters:**
- `projectId` (required): Project UUID
- `title` (required): Epic title
- `description` (optional): Epic description
- `priority` (optional): Priority number (higher = more important)

**Example:**
```json
{
  "projectId": "uuid",
  "title": "User Authentication",
  "description": "Implement complete auth system",
  "priority": 10
}
```

**Returns:**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "key": "EP-2",
  "title": "User Authentication",
  "description": "Implement complete auth system",
  "status": "planning",
  "priority": 10,
  "storyCount": 0,
  "createdAt": "2025-11-10T...",
  "updatedAt": "2025-11-10T..."
}
```

---

### list_epics

List all epics for a project.

**Parameters:**
- `projectId` (required): Project UUID
- `status` (optional): Filter by status (`planning`, `in_progress`, `done`, `archived`)

**Example:**
```json
{
  "projectId": "uuid",
  "status": "in_progress"
}
```

---

### create_story

Create a new story.

**Parameters:**
- `projectId` (required): Project UUID
- `epicId` (optional): Epic UUID
- `title` (required): Story title
- `description` (optional): Story description
- `type` (optional): Story type (`feature`, `bug`, `defect`, `chore`, `spike`)
- `businessImpact` (optional): Business impact score (1-10)
- `businessComplexity` (optional): Business complexity score (1-10)
- `technicalComplexity` (optional): Technical complexity score (1-10)
- `assignedFrameworkId` (optional): Framework UUID

**Example:**
```json
{
  "projectId": "uuid",
  "epicId": "uuid",
  "title": "Implement login page",
  "description": "Create React login page with validation",
  "type": "feature",
  "technicalComplexity": 5
}
```

**Returns:**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "epicId": "uuid",
  "key": "ST-1",
  "type": "feature",
  "title": "Implement login page",
  "description": "Create React login page with validation",
  "status": "planning",
  "technicalComplexity": 5,
  "createdAt": "2025-11-10T...",
  "updatedAt": "2025-11-10T..."
}
```

---

### list_stories

List stories with optional filters.

**Parameters:**
- `projectId` (optional): Filter by project UUID
- `epicId` (optional): Filter by epic UUID
- `status` (optional): Filter by status (`planning`, `analysis`, `architecture`, `design`, `impl`, `review`, `qa`, `done`)
- `type` (optional): Filter by type (`feature`, `bug`, `defect`, `chore`, `spike`)

**Example:**
```json
{
  "projectId": "uuid",
  "status": "impl"
}
```

---

### get_story

Get detailed story information.

**Parameters:**
- `storyId` (required): Story UUID
- `includeSubtasks` (optional): Include subtasks (boolean)
- `includeUseCases` (optional): Include linked use cases (boolean)
- `includeCommits` (optional): Include linked commits (boolean, last 10)

**Example:**
```json
{
  "storyId": "uuid",
  "includeSubtasks": true,
  "includeCommits": true
}
```

**Returns:**
```json
{
  "id": "uuid",
  "key": "ST-1",
  "title": "...",
  "status": "impl",
  "subtasks": [
    {
      "id": "uuid",
      "title": "Create login form",
      "status": "done"
    }
  ],
  "commits": [
    {
      "hash": "abc123",
      "author": "developer",
      "message": "Add login form",
      "timestamp": "2025-11-10T...",
      "files": [
        {
          "filePath": "src/components/Login.tsx",
          "locAdded": 120,
          "locDeleted": 0
        }
      ]
    }
  ]
}
```

---

### update_story

Update an existing story.

**Parameters:**
- `storyId` (required): Story UUID
- `title` (optional): New title
- `description` (optional): New description
- `status` (optional): New status (`planning`, `analysis`, `architecture`, `design`, `impl`, `review`, `qa`, `done`)
- `businessImpact` (optional): Business impact score (1-10)
- `businessComplexity` (optional): Business complexity score (1-10)
- `technicalComplexity` (optional): Technical complexity score (1-10)
- `assignedFrameworkId` (optional): Framework UUID

**Example:**
```json
{
  "storyId": "uuid",
  "status": "impl",
  "technicalComplexity": 7
}
```

## Usage Examples

### Creating a New Project Workflow

1. **Bootstrap a project:**
```
Use the bootstrap_project tool with name "MyApp"
```

2. **Create additional epics:**
```
Use create_epic with projectId from step 1, title "Backend API"
```

3. **Create stories:**
```
Use create_story with projectId and epicId, title "User authentication endpoint"
```

4. **Update story as you progress:**
```
Use update_story with storyId, status "impl"
```

### Querying Stories

1. **List all stories for a project:**
```
Use list_stories with projectId
```

2. **Get detailed story information:**
```
Use get_story with storyId, includeSubtasks: true, includeCommits: true
```

## Error Handling

All tools return errors in a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

**Common Error Codes:**
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid parameters
- `DATABASE_ERROR` (500): Database operation failed
- `INTERNAL_ERROR` (500): Unexpected error

## Development

### Running Tests

```bash
cd backend
npm test src/mcp
```

### Running MCP Server Standalone

```bash
cd backend
npm run mcp:dev
```

The server listens on stdio for MCP protocol messages.

### Adding New Tools

1. Create tool implementation in `src/mcp/tools/[domain].tools.ts`
2. Add types to `src/mcp/types.ts`
3. Export from `src/mcp/tools/index.ts`
4. Add tool definition and handler in `src/mcp/server.ts`
5. Write tests in `src/mcp/tools/[domain].tools.spec.ts`
6. Update this README

## Troubleshooting

### MCP Server Won't Start

1. Check database is running: `docker compose ps`
2. Check DATABASE_URL environment variable
3. Check migrations are up to date: `npm run db:migrate:deploy`
4. Check logs in Claude Code

### Tools Return Errors

1. Verify database connection
2. Check tool parameters match schema
3. Verify referenced resources exist (e.g., projectId exists)
4. Check backend logs

### Database Connection Issues

1. Ensure PostgreSQL is running
2. Verify DATABASE_URL format
3. Check Prisma schema is generated: `npm run db:generate`
4. Test connection: `npm run db:studio`

## Future Enhancements (Sprint 4+)

- Use case management tools
- Telemetry collection tools
- Test case management tools
- Metrics and analytics tools
- Real-time updates via WebSocket

## Support

For issues or questions:
1. Check this README
2. Review tool schemas in `server.ts`
3. Check test files for usage examples
4. Review architecture.md for system design
