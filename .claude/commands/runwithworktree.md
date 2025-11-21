Act as an orchestrator and implement story {{arg1}} using the standard workflow with worktree isolation.

## Orchestrator Role

You are the orchestrator. You coordinate by spawning subagents using the Task tool for each phase of work. Do NOT do implementation work directly - delegate to specialized subagents.

## Get Workflow Context

First, use `mcp__vibestudio__execute_story_with_workflow` to start the workflow run, then use `mcp__vibestudio__get_workflow_context` with the returned runId to get:
- Coordinator instructions
- Component definitions and their instructions
- Previous component outputs
- Story context and requirements

Use this context to guide which subagents to spawn and what instructions to give them.

## Worktree-Aware Workflow

1. **Check/Create Worktree**: Use `mcp__vibestudio__git_get_worktree_status` to check if a worktree exists. If not, use `mcp__vibestudio__git_create_worktree` to create one.

2. **Change to Worktree Directory**: All subagents must work in the worktree path.

3. **Check for Conflicts**: Use `mcp__vibestudio__mcp__vibestudio__check_for_conflicts` to verify no merge conflicts with main.

4. **Spawn Subagents**: For each workflow component, spawn a Task subagent with the component's instructions from the workflow context.

5. **Validate & Build**: After implementation, run validation:
   - Build the project in the worktree
   - Run linting and type checks
   - Ensure all tests pass locally

6. **Create PR**: Use `mcp__vibestudio__create_pull_request` to create the PR.

7. **Prepare for One-Click Deploy**: After PR creation:
   - Use `mcp__vibestudio__mcp__vibestudio__deploy_to_test_env` to build and deploy to isolated test environment
   - Use `mcp__vibestudio__mcp__vibestudio__worktree_run_tests` to run full test suite
   - Add story to test queue with `mcp__vibestudio__mcp__vibestudio__test_queue_add` for tracking
   - Report test results and deployment status so user can approve/merge with one click

Record component starts/completions using `mcp__vibestudio__record_component_start` and `mcp__vibestudio__record_component_complete`.
