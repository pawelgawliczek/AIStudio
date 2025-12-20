# ST-378: Workflow Monitor Use TranscriptLine DB - Implementation Summary

## Overview
Converted `MasterTranscriptPanel` from WebSocket-only streaming to DB-first approach using the TranscriptLine database table added in ST-319.

## Changes Made

### 1. Frontend Service Layer
**File:** `frontend/src/services/transcripts.service.ts`

Added new method and types:
```typescript
async getTranscriptLines(
  projectId: string,
  runId: string,
  sessionIndex = 0,
  limit?: number,
  offset?: number
): Promise<TranscriptLinesResponse>
```

New types:
- `TranscriptLineItem`: Single line from DB
- `TranscriptLinesResponse`: API response structure

### 2. MasterTranscriptPanel Component Rewrite
**File:** `frontend/src/components/workflow-viz/MasterTranscriptPanel.tsx`

**Removed:**
- All WebSocket subscription logic (`master-transcript:subscribe/unsubscribe`)
- All WebSocket event listeners (`streaming_started`, `lines`, `batch`, `error`, `stopped`)
- "Play/Stop streaming" button UI
- `socket`, `isAgentOnline`, `agentHostname` props
- `isConnecting`, `isStreaming` state

**Added:**
- `projectId` prop (required for API calls)
- `workflowStatus` prop (to control polling)
- DB fetch on panel expand (immediate display)
- Polling for running workflows (2.5 second interval)
- Final fetch when workflow completes
- Manual refresh button
- `isLoading` state per session

**Architecture:**
```
Panel opens → Fetch from DB → Display immediately
  ↓
If status === 'running':
  → Poll DB every 2.5s for new lines
  ↓
When status changes to completed/failed:
  → Stop polling
  → Do final DB fetch
```

### 3. Parent Component Updates
**File:** `frontend/src/pages/WorkflowExecutionMonitor.tsx`

Updated both `MasterTranscriptPanel` usages to pass:
- `projectId={projectId}` (from localStorage)
- `workflowStatus={workflowRun.status}` (for polling control)

Removed:
- `socket` prop
- `isAgentOnline` prop
- `agentHostname` prop

### 4. Cleanup
**Deleted:** `frontend/src/components/execution/ArtifactViewer.tsx`
- Orphaned component with no imports
- Replaced by `ArtifactViewerModal`

## Backend Integration

Uses existing endpoint (no backend changes needed):
```
GET /api/projects/:projectId/workflow-runs/:runId/transcript-lines
Query params: sessionIndex, limit, offset
```

Returns:
```typescript
{
  workflowRunId: string;
  sessionIndex: number;
  lines: Array<{
    id: string;
    lineNumber: number;
    content: string;
    createdAt: string;
  }>;
  totalLines: number;
}
```

## Benefits

1. **Works Offline**: Completed workflows display transcripts even when laptop agent is offline
2. **Immediate Display**: No need to click "Play" and wait for streaming
3. **Simpler Architecture**: Removed complex WebSocket state management
4. **DB as Source of Truth**: TranscriptLine data is now actually used by frontend
5. **Better UX**: Manual refresh button for on-demand updates

## Testing

- ✅ TypeScript compilation: PASSED
- ✅ ESLint: No errors in modified files
- ⏳ Manual verification: Pending deployment to production

## Next Steps

1. Deploy to production
2. Verify on live page: https://vibestudio.example.com/team-runs/[runId]/monitor
3. Test scenarios:
   - Completed workflow transcript loads immediately
   - Running workflow polls and updates
   - Multiple sessions (compaction) work correctly
   - Agent transcripts continue to work (TranscriptViewerModal)
