Create a git worktree locally for story {{arg1}}.

## Purpose

This slash command creates a git worktree on your LOCAL machine when the MCP server runs remotely.
It mirrors the functionality of `mcp__vibestudio__git_create_worktree` but executes git commands locally.

## Prerequisites

- Story must exist in the database
- No existing active worktree for this story
- Local repo path: `/Users/pawelgawliczek/projects/AIStudio`
- Worktree location: `../worktrees/` (relative to repo)

## Steps

1. **Query story details via MCP:**
   ```typescript
   mcp__vibestudio__get_story({ storyId: "{{arg1}}" })
   ```

2. **Generate branch name** from story key and title:
   ```
   {story.key.toLowerCase()}-{sanitizedTitle}
   ```

3. **Execute git commands locally:**
   ```bash
   cd /Users/pawelgawliczek/projects/AIStudio
   git fetch origin main
   git branch {branchName} origin/main
   git worktree add ../worktrees/{branchName} {branchName}
   ```

4. **Symlink node_modules** (optional, saves disk space):
   ```bash
   ln -s /Users/pawelgawliczek/projects/AIStudio/node_modules ../worktrees/{branchName}/node_modules
   ```

5. **Record worktree in database:**
   ```typescript
   mcp__vibestudio__record_worktree_created({
     storyId: "{{arg1}}",
     branchName: "{branchName}",
     worktreePath: "/Users/pawelgawliczek/projects/worktrees/{branchName}",
     baseBranch: "main"
   })
   ```

## Output

Report the created worktree path so user can `cd` into it:
```
Worktree created at: /Users/pawelgawliczek/projects/worktrees/{branchName}
```
