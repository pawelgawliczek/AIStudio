# UC-ADMIN-001: Bootstrap Project (One-Command Setup)

## Actor
Developer, Team Lead, Admin

## Preconditions
- AI Studio MCP server is running and accessible
- User has a Git repository (local or remote)
- User is in repository root directory
- User has `ai-studio` CLI installed or Claude Code with MCP configured

## Main Flow

### Option A: Via CLI

1. User opens terminal in repository root
2. User runs: `ai-studio init`
3. CLI detects environment:
   - Git repository (gets remote URL, current branch)
   - Tech stack (detects from package.json, requirements.txt, etc.)
   - Existing project structure
4. CLI prompts for project details:
   ```
   🚀 AI Studio Project Bootstrap

   Project name: [auto-detected from repo name]
   Description: [user enters]
   Tech stack: [auto-detected: Node.js, React, TypeScript]
   Default framework: [Dev-only | BA+Dev | BA+Arch+Dev+QA | Custom]
   ```
5. User confirms or modifies details
6. CLI calls MCP tool: `bootstrap_project({ repo_url, project_name, tech_stack, framework_preset })`
7. MCP server:
   - Creates project record in database
   - Generates unique `project_id`
   - Creates default epic and story templates
   - Activates selected framework
   - Returns file plan:
     ```json
     {
       "project_id": "uuid-123",
       "files": [
         {
           "path": ".ai-studio/config.json",
           "content": "{ \"project_id\": \"uuid-123\", ... }"
         },
         {
           "path": ".claude/skills/ai-studio-sync.md",
           "content": "# AI Studio Sync\n\nUse this skill to sync project context..."
         },
         {
           "path": ".claude/context/README.md",
           "content": "This folder contains auto-generated project context..."
         },
         {
           "path": ".githooks/commit-msg",
           "content": "#!/bin/bash\n# Story ID validation hook"
         }
       ],
       "actions": [
         "git config core.hooksPath .githooks",
         "chmod +x .githooks/*"
       ]
     }
     ```
8. CLI writes all files to repository:
   - `.ai-studio/config.json` (project configuration)
   - `.ai-studio/sync-cursor.json` (for delta sync)
   - `.claude/skills/` (Claude Code skills)
   - `.claude/context/` (project context files)
   - `.githooks/` (Git hooks for commit linking)
   - `.ai-studio/README.md` (setup documentation)
9. CLI executes safe post-actions:
   - Configures Git to use `.githooks/`
   - Makes hooks executable
   - Optionally adds `.ai-studio/` to `.gitignore` (except config.json)
10. CLI displays success message:
    ```
    ✅ Project bootstrapped successfully!

    Project ID: uuid-123
    MCP Server: http://localhost:8765
    Web UI: http://localhost:8080/projects/uuid-123

    Next steps:
    1. Configure MCP in Claude Code (see .ai-studio/README.md)
    2. Create your first story in Web UI
    3. Use Claude Code to implement: "Show my assigned work"

    For help: ai-studio --help
    ```

### Option B: Via Claude Code

1. User opens repository in Claude Code
2. User asks: "Initialize AI Studio for this repo"
3. Claude Code skill activates `ai-studio-bootstrap` skill
4. Skill prompts user for project details (via chat)
5. Skill calls MCP tool: `bootstrap_project({ ... })`
6. Skill receives file plan and actions
7. Skill writes files using Claude Code's file tools
8. Skill executes post-actions via Bash tool
9. Skill confirms completion and displays next steps

## Postconditions
- Project is registered in AI Studio database
- Repository is wired to control plane
- MCP tools are available for this project
- Git hooks enforce commit → story linking
- Claude Code skills are installed
- Metrics tracking is active from first commit
- User can immediately create stories and start work
- Project appears in Web UI

## Alternative Flows

### 6a. Project already bootstrapped
- At step 6, MCP detects repository already has project_id
- MCP returns existing project details
- CLI asks: "Project already exists. Re-initialize? (y/n)"
- If yes: updates configuration, regenerates files
- If no: exits with message "Use 'ai-studio sync' to update"

### 6b. Custom framework configuration
- At step 4, user selects "Custom" framework
- CLI opens interactive framework builder:
  ```
  Select roles to include:
  [x] Business Analyst
  [x] Architect
  [x] Developer (required)
  [ ] QA Tester

  Agent configuration:
  - BA prompt: [edit]
  - Architect tools: [select tools]
  - ...
  ```
- CLI sends custom configuration to MCP
- MCP creates custom framework for this project

### 8a. Git hooks conflict
- At step 8, existing Git hooks detected
- CLI asks: "Existing hooks found. Merge or overwrite?"
- If merge: appends AI Studio hooks to existing
- If overwrite: backs up existing, installs new

### 6c. No Git repository
- At step 3, CLI detects no Git repository
- CLI displays error: "AI Studio requires a Git repository"
- CLI offers: "Initialize Git now? (y/n)"
- If yes: runs `git init`, proceeds
- If no: exits

### 9a. MCP server not reachable
- At step 6, CLI cannot connect to MCP server
- CLI displays error with troubleshooting:
  ```
  ❌ Cannot connect to MCP server at http://localhost:8765

  Troubleshooting:
  1. Is the MCP server running? (docker compose ps)
  2. Check firewall settings
  3. Verify MCP_SERVER_URL in ~/.ai-studio/config

  Start server: cd ai-studio-mcp && docker compose up -d
  ```

## Business Rules
- One repository = one project (1:1 mapping)
- Project ID stored in `.ai-studio/config.json`
- Git hooks are optional but strongly recommended
- Bootstrap is idempotent (can run multiple times safely)
- Files generated based on `clientInfo` (Claude Code vs Codex vs other)
- `.ai-studio/sync-cursor.json` not committed (in .gitignore)

## Technical Implementation

### CLI Command Structure
```bash
ai-studio init [options]
  --name <name>           Project name
  --framework <preset>    Framework preset
  --mcp-url <url>         MCP server URL
  --no-hooks              Skip Git hooks installation
  --force                 Overwrite existing configuration
```

### MCP Tool: `bootstrap_project`
```typescript
{
  name: "bootstrap_project",
  parameters: {
    repo_url?: string,
    project_name?: string,
    tech_stack?: string[],
    framework_preset?: "dev-only" | "full" | "custom",
    client_type?: "claude-code" | "codex" | "cli"
  },
  handler: async (params) => {
    // 1. Create project in DB
    // 2. Create default framework
    // 3. Generate file plan based on client_type
    // 4. Return project_id + files + actions
  }
}
```

### Generated Files

**`.ai-studio/config.json`:**
```json
{
  "project_id": "uuid-123",
  "project_name": "My App",
  "mcp_server_url": "http://localhost:8765",
  "framework_id": "uuid-456",
  "tech_stack": ["typescript", "react", "node"],
  "created_at": "2025-11-10T10:00:00Z"
}
```

**`.claude/skills/ai-studio-sync.md`:**
Markdown file with embedded instructions for Claude Code to call MCP sync tools

**`.githooks/commit-msg`:**
Bash script that validates story ID in commit message

## Related Use Cases
- UC-DEV-001: Pull Assigned Stories
- UC-ADMIN-002: Configure MCP Server
- UC-PM-001: Create Project
- UC-DEV-003: Link Commit to Story

## Acceptance Criteria
- Bootstrap completes in under 10 seconds
- All required files are generated
- Git hooks work correctly
- MCP connection is validated
- Project appears in Web UI immediately
- Skills work in Claude Code after bootstrap
- Documentation is clear and helpful
- Error messages are actionable
- Bootstrap is idempotent (safe to re-run)
- Works on macOS, Linux, and Windows (WSL2)
- Tech stack detection is accurate for common stacks
