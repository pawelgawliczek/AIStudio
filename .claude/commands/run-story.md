# Run Story with Story Runner

Execute a story using the Story Runner Docker container with sequential state execution.

## Usage

```
/run-story <story-id-or-key>
```

## What it does

1. **Validates Story**: Checks story exists and has a workflow assigned
2. **Creates WorkflowRun**: Initializes execution record
3. **Launches Runner**: Starts Docker container
4. **Monitors Progress**: Reports status updates

## Prerequisites

- Story must have a workflow/team assigned
- Workflow must have states defined
- Docker must be running

## Example

```
/run-story ST-145
```

## Instructions

When the user invokes this command:

1. First, search for the story using `search_stories` MCP tool with the provided ID or key
2. Verify the story has `assignedWorkflowId` set. If not, list available teams and ask user to assign one
3. Get the workflow details using `get_runner_status` to check if a run already exists
4. If no active run exists:
   - Create a new workflow run using `start_team_run` with:
     - `cwd`: Your current working directory (CRITICAL for transcript tracking on remote MCP server)
     - `context`: Include storyId, storyKey, and any relevant context
   - Launch the Story Runner using `start_runner`
5. Report the status and provide the run ID
6. Suggest using `get_runner_status` to monitor progress

## Status Monitoring

After starting, use:
```
get_runner_status({ runId: "<run-id>" })
```

## Recovery

If the run fails or pauses:
```
resume_runner({ runId: "<run-id>" })
```

## Cancellation

To stop execution:
```
cancel_runner({ runId: "<run-id>" })
```
