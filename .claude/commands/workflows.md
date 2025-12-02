List all tracked workflow runs.

**Usage:** `/workflows`

## Purpose

Shows all workflow runs registered in the local tracking system, including:
- Currently active workflow (for context recovery)
- All running sessions with their run IDs, workflow IDs, and story IDs
- Start timestamps

## Execution

```bash
.claude/hooks/workflow-tracker.sh list
```

## Output Example

```
=== Running Workflows ===
Current: abc-123-run-id

Session: session-uuid-1
  Run ID: abc-123-run-id
  Workflow: workflow-456
  Story: ST-164
  Started: 2025-12-02T18:00:00Z

Session: session-uuid-2
  Run ID: def-789-run-id
  Workflow: workflow-123
  Story: ST-165
  Started: 2025-12-02T18:05:00Z
```

## See Also

- `/workflow-start` - Register a new workflow
- `/workflow-stop` - Unregister a completed workflow
- `/orchestrate` - Restore context for current workflow
