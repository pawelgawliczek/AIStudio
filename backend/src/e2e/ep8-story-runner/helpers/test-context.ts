/**
 * EP-8 Story Runner E2E Test Context
 * Shared state and IDs across test phases
 */

/**
 * Test context storing all created entity IDs
 * Populated during Phase 1 (Setup) and used throughout tests
 */
export interface TestContext {
  // Backup
  backupFile?: string;

  // Phase 1: Setup
  projectId?: string;
  epicId?: string;
  storyId?: string;
  agentComponentId?: string;
  coordinatorComponentId?: string;

  // Phase 2: Workflow & Team
  workflowId?: string;
  workflowStateIds?: string[];

  // Phase 3: Execution
  workflowRunId?: string;
  componentRunId?: string;

  // Phase 4: Artifacts
  artifactDefinitionId?: string;
  artifactId?: string;

  // Phase 7: Full Path (Laptop)
  spawnedAgentJobId?: string;

  // ST-153: Worktree Tests
  worktreeId?: string;
  worktreePath?: string;
  branchName?: string;

  // ST-158: MCP-Orchestrated Worktree Tests
  agentId?: string;
  agentHostname?: string;
  agentProjectPath?: string;
  agentWorktreeRoot?: string;
  mcpOrchestrated?: boolean;

  // ST-160: Native Subagent Tests
  nativeExploreComponentId?: string;
  nativePlanComponentId?: string;
  nativeGeneralComponentId?: string;
  sessionId?: string;
  questionId?: string;
}

/**
 * Create empty test context
 */
export function createTestContext(): TestContext {
  return {
    workflowStateIds: [],
  };
}

/**
 * Check if context has all required Phase 1 entities
 */
export function hasPhase1Entities(ctx: TestContext): boolean {
  return !!(
    ctx.projectId &&
    ctx.epicId &&
    ctx.storyId &&
    ctx.agentComponentId &&
    ctx.coordinatorComponentId
  );
}

/**
 * Check if context has workflow ready for execution
 */
export function hasWorkflowReady(ctx: TestContext): boolean {
  return !!(
    ctx.workflowId &&
    ctx.workflowStateIds &&
    ctx.workflowStateIds.length > 0
  );
}
