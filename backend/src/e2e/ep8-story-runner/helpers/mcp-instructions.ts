/**
 * ST-161: MCP Instructions Templates
 *
 * Token-optimized instruction templates for MCP tool calls.
 * These templates produce minimal token usage while still being clear.
 *
 * Design goals:
 * - Minimal tokens (~20-50 tokens per instruction)
 * - Clear tool name and parameters
 * - No-fix constraints built in
 * - Direct result output
 */

/**
 * No-fix constraints (shared across all instructions)
 */
export const NO_FIX_CONSTRAINTS = `
CONSTRAINTS: Execute tool exactly. NO fixes. NO investigation. Return raw result.
CRITICAL: If you get "No such tool available" error, output EXACTLY: MCP_TOOL_NOT_FOUND: <tool_name>
`.trim();

/**
 * Build a minimal instruction for any MCP tool
 */
export function buildMinimalInstruction(toolName: string, params: object): string {
  const fullToolName = toolName.startsWith('mcp__') ? toolName : `mcp__vibestudio__${toolName}`;
  return `${NO_FIX_CONSTRAINTS}
Call ${fullToolName}(${JSON.stringify(params)}). Output result only.`;
}

/**
 * Build a detailed instruction (when more context is needed)
 */
export function buildDetailedInstruction(toolName: string, params: object): string {
  const fullToolName = toolName.startsWith('mcp__') ? toolName : `mcp__vibestudio__${toolName}`;
  return `
IMPORTANT TEST CONSTRAINTS:
- Execute ONLY the specified MCP tool with exact parameters
- Do NOT try to fix any errors or issues
- Do NOT reason about problems or suggest solutions
- Do NOT call additional tools to investigate
- Return the raw result (success or error) immediately
- If tool fails, return the error message as-is
- Maximum 1 tool call allowed

CRITICAL: If you get "No such tool available" error, output EXACTLY:
MCP_TOOL_NOT_FOUND: ${fullToolName}

Call ${fullToolName} with these exact params:
${JSON.stringify(params, null, 2)}

Return only the tool result. Do not add commentary.
`.trim();
}

/**
 * Pre-defined minimal instructions for common MCP tools
 * These are ultra-minimal (~20 tokens) for maximum efficiency
 */
export const MCP_INSTRUCTIONS = {
  // Projects
  create_project: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__create_project(${JSON.stringify(p)}). Return result.`,

  get_project: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__get_project(${JSON.stringify(p)}). Return result.`,

  list_projects: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__list_projects(${JSON.stringify(p)}). Return result.`,

  // Epics
  create_epic: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__create_epic(${JSON.stringify(p)}). Return result.`,

  list_epics: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__list_epics(${JSON.stringify(p)}). Return result.`,

  // Stories
  create_story: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__create_story(${JSON.stringify(p)}). Return result.`,

  get_story: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__get_story(${JSON.stringify(p)}). Return result.`,

  update_story: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__update_story(${JSON.stringify(p)}). Return result.`,

  list_stories: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__list_stories(${JSON.stringify(p)}). Return result.`,

  // Agents/Components
  create_agent: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__create_agent(${JSON.stringify(p)}). Return result.`,

  get_agent: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__get_agent(${JSON.stringify(p)}). Return result.`,

  update_agent: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__update_agent(${JSON.stringify(p)}). Return result.`,

  list_agents: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__list_agents(${JSON.stringify(p)}). Return result.`,

  // Teams/Workflows (Note: ST-164 removed coordinator/project manager tools)
  create_team: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__create_team(${JSON.stringify(p)}). Return result.`,

  list_teams: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__list_teams(${JSON.stringify(p)}). Return result.`,

  // Workflow States
  create_workflow_state: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__create_workflow_state(${JSON.stringify(p)}). Return result.`,

  update_workflow_state: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__update_workflow_state(${JSON.stringify(p)}). Return result.`,

  list_workflow_states: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__list_workflow_states(${JSON.stringify(p)}). Return result.`,

  // Execution
  start_team_run: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__start_team_run(${JSON.stringify(p)}). Return result.`,

  get_team_context: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__get_team_context(${JSON.stringify(p)}). Return result.`,

  record_agent_start: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__record_agent_start(${JSON.stringify(p)}). Return result.`,

  record_agent_complete: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__record_agent_complete(${JSON.stringify(p)}). Return result.`,

  update_team_status: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__update_team_status(${JSON.stringify(p)}). Return result.`,

  get_team_run_results: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__get_team_run_results(${JSON.stringify(p)}). Return result.`,

  // Artifacts
  create_artifact_definition: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__create_artifact_definition(${JSON.stringify(p)}). Return result.`,

  upload_artifact: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__upload_artifact(${JSON.stringify(p)}). Return result.`,

  get_artifact: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__get_artifact(${JSON.stringify(p)}). Return result.`,

  list_artifacts: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__list_artifacts(${JSON.stringify(p)}). Return result.`,

  set_artifact_access: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__set_artifact_access(${JSON.stringify(p)}). Return result.`,

  open_artifact_session: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__open_artifact_session(${JSON.stringify(p)}). Return result.`,

  save_artifact_changes: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__save_artifact_changes(${JSON.stringify(p)}). Return result.`,

  close_artifact_session: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__close_artifact_session(${JSON.stringify(p)}). Return result.`,

  // Git/Worktree
  git_create_worktree: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__git_create_worktree(${JSON.stringify(p)}). Return result.`,

  git_get_worktree_status: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__git_get_worktree_status(${JSON.stringify(p)}). Return result.`,

  git_delete_worktree: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__git_delete_worktree(${JSON.stringify(p)}). Return result.`,

  record_worktree_created: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__record_worktree_created(${JSON.stringify(p)}). Return result.`,

  // Remote Agent
  spawn_agent: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__spawn_agent(${JSON.stringify(p)}). Return result.`,

  get_online_agents: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__get_online_agents(${JSON.stringify(p)}). Return result.`,

  // Approval Gates
  get_pending_approvals: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__get_pending_approvals(${JSON.stringify(p)}). Return result.`,

  respond_to_approval: (p: object) =>
    `${NO_FIX_CONSTRAINTS}\nCall mcp__vibestudio__respond_to_approval(${JSON.stringify(p)}). Return result.`,

  // ST-165/ST-166: get_transcript_metrics was removed - telemetry auto-discovered via record_agent_complete
} as const;

/**
 * Get instruction for a tool, falling back to generic builder if not pre-defined
 */
export function getInstruction(toolName: string, params: object): string {
  const key = toolName.replace('mcp__vibestudio__', '') as keyof typeof MCP_INSTRUCTIONS;

  if (key in MCP_INSTRUCTIONS) {
    return MCP_INSTRUCTIONS[key](params);
  }

  return buildMinimalInstruction(toolName, params);
}
