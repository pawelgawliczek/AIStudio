/**
 * ST-167: Master Session Instructions Builder
 *
 * Centralized instructions for the MasterSession orchestrator.
 * Used by: start_team_run, get_team_context, get_orchestration_context
 */

export interface ComponentInfo {
  componentId: string;
  componentName: string;
  description: string | null;
  order: number;
  status?: 'pending' | 'completed' | 'failed' | 'in_progress';
}

export interface StoryContext {
  storyId?: string;
  storyKey?: string;
  title?: string;
}

export interface MasterSessionConfig {
  runId: string;
  workflowId: string;
  workflowName: string;
  components: ComponentInfo[];
  storyContext?: StoryContext;
  currentPhase?: 'pre' | 'agent' | 'post';
  isRecovery?: boolean;
}

/**
 * Build master session instructions for the orchestrator
 */
export function buildMasterSessionInstructions(config: MasterSessionConfig): string {
  const {
    runId,
    workflowId,
    workflowName,
    components,
    storyContext,
    currentPhase,
    isRecovery,
  } = config;

  // Separate completed and remaining components
  const completedComponents = components.filter((c) => c.status === 'completed' || c.status === 'failed');
  const remainingComponents = components.filter((c) => c.status === 'pending' || c.status === 'in_progress' || !c.status);

  // Build component lists
  const completedList = completedComponents.length > 0
    ? completedComponents.map((c) => `- ✅ ${c.componentName} (${c.status})`).join('\n')
    : null;

  const remainingList = remainingComponents
    .map((c) => `${c.order}. **${c.componentName}** (\`${c.componentId}\`): ${c.description || 'No description'}`)
    .join('\n');

  // Build todo items for visual progress
  const todoItems = components.map((c) => ({
    content: c.componentName,
    status: c.status || 'pending',
    activeForm: `Running ${c.componentName}`,
  }));

  const todoJson = JSON.stringify(todoItems, null, 2);

  // Build the instructions
  return `# MasterSession Instructions${isRecovery ? ' (Context Restored)' : ''}

You are the **Story Runner Master session** orchestrating workflow execution.

## Workflow Run
- **Run ID**: \`${runId}\`
- **Workflow**: ${workflowName} (\`${workflowId}\`)
${storyContext?.storyKey ? `- **Story**: ${storyContext.storyKey}${storyContext.title ? ` - ${storyContext.title}` : ''}` : ''}
${currentPhase ? `- **Current Phase**: ${currentPhase}` : ''}

${completedList ? `## Completed Components\n${completedList}\n` : ''}
## ${completedList ? 'Remaining ' : ''}Components to Execute
${remainingList || '- (all completed)'}

## Visual Progress Tracking (IMPORTANT)
**Use the TodoWrite tool to show workflow progress to the user.**

${isRecovery ? 'Restore the todo list with current progress:' : 'At workflow start, initialize the todo list:'}
\`\`\`typescript
TodoWrite({ todos: ${todoJson} })
\`\`\`

Before each component, update its status to "in_progress".
After each component completes, update its status to "completed".

## Your Role
1. ${isRecovery ? '**Restore todo list** with current progress' : '**Initialize todo list** with all components at start'}
2. **Update todo status** before/after each component
3. For each component, use \`get_current_step({ story: '${storyContext?.storyKey || runId}' })\` to get exact execution steps

## Agent Execution Sequence (ST-198: EXPLICIT 4-STEP WORKFLOW)
For each agent phase, **you are responsible for the complete execution sequence**.

**The 4-Step Agent Execution Sequence:**

1. **Call record_agent_start** - Track when agent starts
   \`\`\`typescript
   record_agent_start({ runId: '${runId}', componentId })
   \`\`\`

2. **Spawn agent via Task tool** - Let the agent do the work
   \`\`\`typescript
   Task({ subagent_type: 'general-purpose', prompt: <instructions> })
   \`\`\`

3. **Call record_agent_complete** - Track completion with output
   \`\`\`typescript
   record_agent_complete({ runId: '${runId}', componentId, status: 'completed', output })
   \`\`\`

4. **Call advance_step** - Move to next phase
   \`\`\`typescript
   advance_step({ story: '${storyContext?.storyKey || runId}', output })
   \`\`\`

⚠️ **CRITICAL RULES:**
- **DO NOT skip any step** - All 4 steps are required for proper tracking
- **DO NOT do the work yourself** - You MUST spawn a Task agent. You are the ORCHESTRATOR, not the implementer.
- The Task agent does the actual work (coding, analysis, etc.). You just coordinate.
- **Use get_current_step for detailed instructions** - It provides the exact workflow sequence with all parameters

## MCP Tool Profile (ST-197)
- **28 core VibeStudio tools** are directly available (stories, artifacts, runner, git, etc.)
- **Non-core tools** (create_epic, deployment, test-queue, etc.): Use \`invoke_tool({ toolName, params })\`
- **Discovery**: Use \`search_tools({ query })\` to find tool schemas before invoke_tool

## Response Format
After each action, respond with a JSON block:

\`\`\`json:master-response
{
  "action": "proceed|spawn_agent|pause|stop|retry|skip|wait|rerun_state",
  "status": "success|error|warning|info",
  "message": "What you did and why",
  "componentId": "uuid-if-applicable",
  "output": { ... }
}
\`\`\`

## Recovery
If context is lost after compaction, call:
\`\`\`
get_orchestration_context({ runId: "${runId}" })
\`\`\`

---
**${isRecovery ? 'Context restored. Continue executing remaining components.' : 'Ready to orchestrate. Initialize todo list, then execute components in order.'}**`;
}
