# Phase 7: Claude Code Integration - Design Document

**Status**: In Progress
**Created**: 2025-11-12
**Updated**: 2025-11-12

---

## Overview

Enable users to activate workflows in Claude Code via MCP (Model Context Protocol). When activated, workflows generate coordinator agent files, component agent files, and workflow skill files that Claude Code can use to execute agent-based workflows.

---

## Goals

1. **Activate workflows** from the web UI into Claude Code
2. **Generate agent files** (coordinator + components) automatically
3. **Validate** generated files for correctness
4. **Track versions** and sync when workflows are updated
5. **Handle conflicts** gracefully with backups
6. **One workflow at a time** per project

---

## Architecture

### MCP Server Structure

```
backend/src/mcp/
├── servers/
│   ├── workflow-activation.server.ts   # MCP server for workflow activation
│   └── workflow-tools.ts                # Tool implementations
├── generators/
│   ├── coordinator-agent-generator.ts   # Generate .claude/agents/coordinator.md
│   ├── component-agent-generator.ts     # Generate .claude/agents/component-*.md
│   └── workflow-skill-generator.ts      # Generate .claude/skills/workflow-*.md
├── validators/
│   ├── agent-file-validator.ts          # Validate agent file structure
│   ├── mcp-tool-validator.ts            # Validate MCP tool references
│   └── workflow-metadata-validator.ts   # Validate workflow metadata
└── services/
    ├── activation.service.ts            # Activation business logic
    └── version-tracker.service.ts       # Track active workflow versions
```

---

## MCP Tools

### 1. `activate_workflow`
**Description**: Activate a workflow in Claude Code by generating agent files

**Input**:
```typescript
{
  workflowId: string;      // UUID of workflow to activate
  projectId: string;       // Project context
  options?: {
    forceOverwrite?: boolean;  // Skip conflict resolution
    skipBackup?: boolean;      // Don't backup old files
  }
}
```

**Output**:
```typescript
{
  success: boolean;
  filesGenerated: string[];  // Paths of generated files
  conflicts?: string[];      // Files that existed before
  backupLocation?: string;   // Where old files were backed up
  activationId: string;      // Track this activation
  version: string;           // Workflow version activated
}
```

**Process**:
1. Check if another workflow is active → deactivate if needed
2. Fetch workflow + coordinator + components from database
3. Validate workflow is complete and active
4. Check for existing files → backup if conflicts
5. Generate coordinator agent file
6. Generate component agent files (one per component)
7. Generate workflow skill file
8. Save to `.claude/` directory
9. Create ActiveWorkflow database record
10. Return success with file paths

---

### 2. `deactivate_workflow`
**Description**: Deactivate the current workflow and remove generated files

**Input**:
```typescript
{
  projectId: string;
  options?: {
    keepFiles?: boolean;  // Keep files but mark inactive
  }
}
```

**Output**:
```typescript
{
  success: boolean;
  filesRemoved: string[];
  workflowId: string;
  deactivatedAt: string;
}
```

**Process**:
1. Fetch active workflow from database
2. Delete or archive generated files
3. Update ActiveWorkflow status to 'deactivated'
4. Return success

---

### 3. `sync_workflow`
**Description**: Sync the active workflow to the latest version from the web UI

**Input**:
```typescript
{
  projectId: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  updated: boolean;           // Was update needed?
  previousVersion: string;
  newVersion: string;
  filesUpdated: string[];
  changes: string[];          // Summary of changes
}
```

**Process**:
1. Fetch active workflow from database
2. Compare version with workflow definition
3. If versions match → no-op
4. If different → backup old files and regenerate
5. Update ActiveWorkflow version
6. Return summary of changes

---

### 4. `list_active_workflows`
**Description**: Get currently active workflow (if any)

**Input**:
```typescript
{
  projectId: string;
}
```

**Output**:
```typescript
{
  activeWorkflow?: {
    workflowId: string;
    workflowName: string;
    version: string;
    activatedAt: string;
    filesGenerated: string[];
    autoSync: boolean;
  };
}
```

---

### 5. `validate_workflow_files`
**Description**: Validate that generated workflow files are correct

**Input**:
```typescript
{
  projectId: string;
}
```

**Output**:
```typescript
{
  valid: boolean;
  errors: Array<{
    file: string;
    error: string;
    severity: 'error' | 'warning';
  }>;
}
```

**Process**:
1. Find all `.claude/agents/` and `.claude/skills/` files
2. Validate agent file structure (frontmatter + content)
3. Validate MCP tool references exist
4. Validate workflow metadata
5. Return validation results

---

## File Generation

### Coordinator Agent File

**Location**: `.claude/agents/coordinator-{workflowName}.md`

**Structure**:
```markdown
---
name: {coordinatorName}
description: {coordinatorDescription}
domain: {domain}
tools:
  - invoke_component
  - get_workflow_state
  - create_subtask
---

# Coordinator: {coordinatorName}

## Overview
{coordinatorDescription}

## Decision Strategy
{decisionStrategy}

## Available Components
{list of components with descriptions}

## Instructions
{coordinatorInstructions}

## Component Configuration
{JSON config for each component}
```

---

### Component Agent File

**Location**: `.claude/agents/component-{componentName}.md`

**Structure**:
```markdown
---
name: {componentName}
description: {componentDescription}
tags: [{tags}]
tools:
  {list of tool names}
---

# Component: {componentName}

## Input Instructions
{inputInstructions}

## Operation Instructions
{operationInstructions}

## Output Instructions
{outputInstructions}

## Configuration
{JSON config}

## On Failure
{onFailure strategy}
```

---

### Workflow Skill File

**Location**: `.claude/skills/workflow-{workflowName}.md`

**Structure**:
```markdown
---
name: {workflowName}
description: {workflowDescription}
trigger: {triggerConfig}
---

# Workflow: {workflowName}

## Description
{workflowDescription}

## Coordinator
Uses: {coordinatorName}

## Components
- {component1Name}
- {component2Name}
- ...

## Trigger Configuration
{JSON triggerConfig}

## Usage
This workflow is triggered when: {human-readable trigger description}

To manually invoke:
1. Use the coordinator: `{coordinatorName}`
2. The coordinator will invoke components as needed
3. Results will be tracked in the workflow run

## Metadata
- Workflow ID: {workflowId}
- Version: {version}
- Activated: {activatedAt}
```

---

## Database Schema (ActiveWorkflow)

Already defined in Phase 1:

```prisma
model ActiveWorkflow {
  id              String   @id @default(uuid())
  projectId       String
  workflowId      String
  version         String
  activatedAt     DateTime @default(now())
  activatedBy     String
  filesGenerated  String[]
  status          String   // 'active' | 'deactivated' | 'error'
  autoSync        Boolean  @default(false)

  project         Project  @relation(fields: [projectId], references: [id])
  workflow        Workflow @relation(fields: [workflowId], references: [id])

  @@unique([projectId])  // Only one active workflow per project
  @@index([workflowId])
}
```

---

## Validation System

### Agent File Structure Validator
- Validate YAML frontmatter exists
- Validate required fields: name, description
- Validate markdown structure
- Validate no syntax errors

### MCP Tool Reference Validator
- Check all tool names in `tools:` array exist
- Warn if deprecated tools are used
- Suggest alternatives for unknown tools

### Workflow Metadata Validator
- Validate workflow ID matches database
- Validate version string format
- Validate all component references exist
- Validate coordinator reference exists

---

## Version Tracking & Auto-Sync

### Version Format
`v{major}.{minor}` (e.g., `v1.0`, `v1.1`, `v2.0`)

### Version Changes
- **Minor version** (v1.0 → v1.1): Instruction changes, config tweaks
- **Major version** (v1.x → v2.0): Component changes, workflow restructure

### Auto-Sync (Future)
When enabled, periodically check for updates:
1. Every time Claude Code starts
2. Before executing a workflow
3. Show notification: "Workflow {name} has updates (v1.0 → v1.1). Sync now?"

---

## Conflict Resolution

When activating a workflow and files already exist:

### Option 1: Backup (Default)
1. Create `.claude/backups/{timestamp}/` directory
2. Move existing files to backup
3. Generate new files
4. Show user backup location

### Option 2: Skip (User Choice)
1. Show conflict warning
2. List conflicting files
3. Ask user: "Overwrite?" or "Cancel"
4. If overwrite → proceed, if cancel → abort

### Option 3: Force (CLI Flag)
1. Skip all checks
2. Overwrite immediately
3. No backup (dangerous)

---

## Frontend UI Changes

### Workflow Management Page

Add "Activate in Claude Code" button to each workflow card:

```typescript
<Button
  onClick={() => activateWorkflow(workflow.id)}
  variant="primary"
  disabled={isAnotherWorkflowActive}
>
  Activate in Claude Code
</Button>
```

### Activation Status Banner

Show at top of page when a workflow is active:

```
[Active] Workflow "Code Review Agent" (v1.2) is active in Claude Code
[Sync] [Deactivate]
```

### Activation Modal

Show progress during activation:

```
Activating Workflow: Code Review Agent

✓ Validated workflow
✓ Backed up existing files
✓ Generated coordinator agent
✓ Generated component agents (3/3)
✓ Generated workflow skill
✓ Created activation record

Success! Files generated:
- .claude/agents/coordinator-code-review.md
- .claude/agents/component-linter.md
- .claude/agents/component-security-check.md
- .claude/agents/component-test-coverage.md
- .claude/skills/workflow-code-review.md

You can now use this workflow in Claude Code.
```

---

## API Endpoints (Backend)

### POST `/api/workflows/:id/activate`
Activate a workflow for Claude Code

**Body**:
```json
{
  "options": {
    "forceOverwrite": false,
    "skipBackup": false
  }
}
```

**Response**:
```json
{
  "success": true,
  "activationId": "uuid",
  "version": "v1.2",
  "filesGenerated": ["..."],
  "conflicts": [],
  "backupLocation": ".claude/backups/2025-11-12-1530/"
}
```

---

### POST `/api/workflows/:id/deactivate`
Deactivate the active workflow

**Response**:
```json
{
  "success": true,
  "workflowId": "uuid",
  "filesRemoved": ["..."],
  "deactivatedAt": "2025-11-12T15:30:00Z"
}
```

---

### POST `/api/workflows/:id/sync`
Sync workflow to latest version

**Response**:
```json
{
  "success": true,
  "updated": true,
  "previousVersion": "v1.1",
  "newVersion": "v1.2",
  "filesUpdated": ["..."],
  "changes": [
    "Updated coordinator instructions",
    "Added new component: Security Check"
  ]
}
```

---

### GET `/api/workflows/active`
Get currently active workflow

**Response**:
```json
{
  "activeWorkflow": {
    "workflowId": "uuid",
    "workflowName": "Code Review Agent",
    "version": "v1.2",
    "activatedAt": "2025-11-12T14:00:00Z",
    "filesGenerated": ["..."],
    "autoSync": false
  }
}
```

---

## Testing Strategy

### Unit Tests
- [ ] Test coordinator agent file generation
- [ ] Test component agent file generation
- [ ] Test workflow skill file generation
- [ ] Test agent file structure validation
- [ ] Test MCP tool reference validation
- [ ] Test version tracking logic
- [ ] Test conflict resolution logic

### Integration Tests
- [ ] Test activate workflow end-to-end
- [ ] Test deactivate workflow
- [ ] Test sync workflow with version changes
- [ ] Test conflict resolution with backups
- [ ] Test one-active-workflow constraint

### E2E Tests
- [ ] Create workflow in UI → Activate → Verify files in Claude Code
- [ ] Activate workflow A → Try to activate workflow B → Verify A is deactivated
- [ ] Update workflow in UI → Sync → Verify files updated
- [ ] Deactivate workflow → Verify files removed

---

## Success Criteria

- [ ] Users can activate workflows from the web UI
- [ ] Generated agent files are syntactically valid
- [ ] Claude Code can parse and use generated agents
- [ ] Version tracking works correctly
- [ ] Sync updates files when workflow changes
- [ ] Only one workflow can be active at a time
- [ ] Conflicts are handled with backups
- [ ] Deactivation cleans up files properly

---

## Next Steps

1. ✅ Create this design document
2. ⏭️ Set up MCP server structure
3. ⏭️ Implement file generators
4. ⏭️ Implement validation system
5. ⏭️ Implement MCP tools
6. ⏭️ Create backend API endpoints
7. ⏭️ Add frontend UI components
8. ⏭️ Write tests
9. ⏭️ Test end-to-end workflow

---

## Notes

- **MCP Protocol**: Uses Model Context Protocol for Claude Code integration
- **File Format**: Markdown with YAML frontmatter (standard for Claude Code agents)
- **Storage**: Local `.claude/` directory in project root
- **Security**: Validate all inputs, sanitize file names, prevent path traversal
- **Error Handling**: Graceful failures with rollback on error
