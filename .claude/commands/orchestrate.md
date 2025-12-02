Restore MasterSession context for workflow run.

**Usage:** `/orchestrate [runId]`

If no runId is provided, automatically detects from `.claude/running-workflows.json`.

## Purpose

Use this command after context compaction to restore your understanding of:
- Your role as MasterSession
- Current workflow run state
- Response format requirements
- Story context

## Execution

First, determine the run ID:

```bash
# Get runId from argument or detect from tracker
RUN_ID="{{arg1}}"
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "{{arg1}}" ]; then
  RUN_ID=$(.claude/hooks/workflow-tracker.sh get-current 2>/dev/null)
fi
echo "Restoring context for: $RUN_ID"
```

Then call the MCP tool:

```typescript
mcp__vibestudio__get_orchestration_context({
  runId: "<RUN_ID from above>"
})
```

## What This Returns

1. **Role reminder** - You are the Story Runner Master session
2. **Response format** - JSON block format for communicating with Runner
3. **Current state** - Which state you're executing, what phase (pre/agent/post)
4. **Story context** - The story being implemented
5. **Progress** - How many states completed

## After Calling This

Read the `reinitPrompt` field from the response. This contains your re-initialization
instructions. Acknowledge receipt and continue executing the current state's instructions.

## When to Use

- After context compaction (auto or manual)
- When you're unsure of your role or response format
- To check current workflow progress

## Recovery Note

If no workflow is detected:
1. Run `.claude/hooks/workflow-tracker.sh list` to see registered workflows
2. Manually specify: `/orchestrate <runId>`
