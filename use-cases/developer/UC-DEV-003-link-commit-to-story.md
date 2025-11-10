# UC-DEV-003: Link Commit to Story

## Actor
Developer Agent or Human Developer (automatic via Git hooks, manual via MCP)

## Preconditions
- Code changes exist locally
- Story exists in project
- Repository has AI Studio integration enabled

## Main Flow - Automatic Linking (Recommended)

1. Developer creates commit with story ID in message:
   ```
   git commit -m "[ST-42] Add password reset API endpoint

   - Implemented POST /api/auth/reset-password
   - Added email validation
   - Created reset token generation logic
   - Added unit tests"
   ```

2. Git commit-msg hook activates
3. Hook script:
   - Parses commit message for story ID pattern `[ST-XXX]` or `ST-XXX`
   - Validates story ID format
   - Optionally queries MCP to verify story exists
4. If story ID found and valid:
   - Commit proceeds
   - Hook adds metadata to commit (git notes or tags)
5. Post-commit hook triggers (or CI on push)
6. Post-commit script calls MCP: `link_commit({ commit_hash, story_id, author, timestamp, message })`
7. MCP server:
   - Records commit linkage
   - Analyzes commit diff to extract:
     - Files modified (paths)
     - LOC added/removed per file
     - Optionally: complexity delta
     - Optionally: affected use cases (via file-to-use-case mapping)
8. MCP updates database:
   ```sql
   INSERT INTO commits (hash, project_id, story_id, epic_id, author, timestamp, message)
   INSERT INTO commit_files (commit_hash, file_path, loc_added, loc_deleted, ...)
   ```
9. System links commit to story's epic automatically
10. Commit appears in story's commit history
11. Code metrics update for affected components

## Main Flow - Manual Linking (Fallback)

1. Developer forgot story ID in commit message or needs to link retroactively
2. Developer uses CLI: `ai-studio link-commit <commit-hash> <story-id>`
   or
   Developer/Agent uses MCP tool directly in Claude Code: "Link commit abc123 to story ST-42"
3. CLI/MCP calls: `link_commit({ commit_hash, story_id })`
4. System validates:
   - Commit exists in repository
   - Story exists and is active
   - Commit not already linked to different story
5. System proceeds with steps 7-11 from automatic flow
6. Confirmation displayed

## Postconditions
- Commit is linked to story and epic
- Commit appears in story's commit timeline
- File changes are recorded in database
- Code metrics update for story
- Use cases are automatically linked if files map to use cases
- Audit trail includes commit linkage

## Alternative Flows

### 3a. Story ID not found in commit message
- At step 3, hook finds no story ID
- Hook displays warning: "⚠️  No story ID found in commit message"
- Hook checks project configuration:
  - If `strict_mode: true` → reject commit with error
  - If `strict_mode: false` → allow commit with warning
- Developer can amend commit or link manually later

### 3b. Invalid story ID format
- At step 3, story ID doesn't match pattern
- Hook displays: "❌ Invalid story ID format. Use [ST-123] or ST-123"
- Commit rejected
- Developer fixes message and retries

### 3c. Story ID not found in project
- At step 3, hook queries MCP and story doesn't exist
- Hook displays: "❌ Story ST-999 not found in project"
- Commit rejected
- Developer verifies correct story ID

### Manual Flow 4a. Commit already linked
- At step 4 of manual flow, commit already linked to another story
- System displays: "⚠️  Commit abc123 already linked to ST-40. Override? (y/n)"
- If yes: updates linkage, logs audit event
- If no: aborts

### 6a. Bulk link multiple commits
- Developer uses: `ai-studio link-commits ST-42`
- System finds all commits in current branch not yet linked
- Displays list of commits to link
- Developer confirms
- System links all commits to story

## Business Rules
- Commit message format: `[ST-XXX] Title` or `ST-XXX: Title` (configurable)
- Alternative: Branch name format: `feature/ST-XXX-description`
- One commit can link to only one story (primary story)
- Story ID must exist in project
- Commits automatically link to story's parent epic
- Strict mode (optional): reject commits without story ID
- Hook can be bypassed for non-feature commits (docs, config) if configured

## Technical Implementation

### Git Hook Setup (`hooks/commit-msg`)
```bash
#!/bin/bash
# Extract story ID from commit message
STORY_ID=$(grep -oE '(ST-[0-9]+)|\[ST-[0-9]+\]' "$1" | head -1 | tr -d '[]')

if [ -z "$STORY_ID" ]; then
  if [ "$AI_STUDIO_STRICT" = "true" ]; then
    echo "ERROR: Commit must reference a story ID"
    exit 1
  fi
fi

# Optionally validate story exists via MCP
# ai-studio validate-story $STORY_ID
```

### Post-commit Hook (`hooks/post-commit`)
```bash
#!/bin/bash
COMMIT_HASH=$(git rev-parse HEAD)
STORY_ID=$(git log -1 --pretty=%B | grep -oE 'ST-[0-9]+' | head -1)

if [ -n "$STORY_ID" ]; then
  ai-studio link-commit $COMMIT_HASH $STORY_ID
fi
```

### MCP Tool Implementation
```typescript
{
  name: "link_commit",
  parameters: {
    commit_hash: string,
    story_id: string,
    author?: string,      // auto-detected from git if not provided
    timestamp?: string,   // auto-detected from git if not provided
    message?: string      // auto-detected from git if not provided
  },
  handler: async (params) => {
    // 1. Validate story exists
    // 2. Get commit details from git
    // 3. Analyze diff for LOC changes
    // 4. Insert into commits table
    // 5. Insert into commit_files table
    // 6. Update story metrics
    // 7. Link to epic
    // 8. Return success
  }
}
```

## Related Use Cases
- UC-DEV-002: Implement Story
- UC-INTEGRATION-001: Bootstrap Project
- UC-METRICS-001: View Framework Effectiveness
- UC-BA-003: View Use Case Impact Analysis
- UC-ARCH-002: View Code Quality Dashboard

## Acceptance Criteria
- Automatic linking works for all valid commit message formats
- Manual linking is available as fallback
- Hook validation prevents invalid commits (if strict mode enabled)
- LOC changes are accurately captured
- File paths are correctly recorded
- Commit appears in story timeline within 1 minute
- Code metrics update correctly
- Hooks are installed automatically during project bootstrap
- Hook can be bypassed for special commits (with flag)
- Bulk linking works for branch merges
