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
2. Execute components in order using the **Task tool** to spawn agents
3. **Update todo status** before/after each component
4. Before spawning each agent, call \`get_agent_instructions({ componentId })\` for full instructions
5. **CRITICAL**: After spawning an agent, check the Task tool response for hook output with \`agentSpawned\` data:
   - Extract \`agentId\` and \`transcriptPath\` from the hook output
   - Immediately call \`add_transcript({ type: 'agent', runId: '${runId}', componentId: '<component-id>', agentId: '<agent-id>', transcriptPath: '<path>' })\`
   - This registers the transcript so metrics can be captured later
6. After each agent completes, call \`record_agent_complete({ runId, componentId, status, output, componentSummary })\` to record metrics

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
