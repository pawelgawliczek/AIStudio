# Workflow Monitor: Use TranscriptLine DB (ST-319)

## Problem
Frontend `MasterTranscriptPanel` only uses WebSocket streaming. It never queries the `TranscriptLine` database table that ST-319 added. This means:
- Completed workflows can't show transcripts if laptop agent is offline
- User must click "Play" and wait for streaming instead of seeing content immediately
- TranscriptLine data exists in DB but is unused by frontend

## Current Architecture Gap

```
Backend has: GET /projects/:projectId/workflow-runs/:runId/transcript-lines
             → Returns paginated TranscriptLine records from DB

Frontend MasterTranscriptPanel:
             → Only uses WebSocket events (master-transcript:lines)
             → Never calls the transcript-lines API
             → Can't show completed transcripts without laptop agent online
```

## Implementation Plan

### Task 1: Add Frontend Service Method
**File:** `frontend/src/services/transcripts.service.ts`

Add method to call the existing backend endpoint:
```typescript
async getTranscriptLines(
  runId: string,
  sessionIndex: number = 0,
  limit?: number,
  offset?: number
): Promise<TranscriptLinesResponse>
```

### Task 2: Update MasterTranscriptPanel to Use DB Only (No WebSocket)
**File:** `frontend/src/components/workflow-viz/MasterTranscriptPanel.tsx`

**Simplify to DB-only approach:**
1. **On mount/expand:** Fetch all transcript lines from DB API
2. **Display immediately** - no "click play" button needed
3. **For running workflows:** Poll DB every 2-3 seconds for new lines
4. **For completed workflows:** Just show full transcript, no polling

Logic flow:
```
Panel opens
  → Fetch TranscriptLines from DB API
  → Display immediately
  → If workflow status === 'running': start polling interval (2-3s)
  → When status changes to completed/failed:
      → Stop polling
      → Do one final DB fetch to get complete transcript
  → If already completed: just show transcript, no polling
```

**Remove:**
- WebSocket subscription logic (`master-transcript:subscribe`)
- WebSocket event listeners (`master-transcript:lines`, `master-transcript:batch`)
- "Play/Stop streaming" UI controls
- `isAgentOnline` prop dependency

### Task 3: Handle Agent Transcripts Similarly
**File:** `frontend/src/components/workflow-viz/TranscriptViewerModal.tsx`

Verify agent transcripts also use DB-first approach. Currently fetches via artifacts - check if this works correctly.

### Task 4: Delete Unused Legacy Component
**File to delete:** `frontend/src/components/execution/ArtifactViewer.tsx`

Orphaned component - no imports found. Replaced by `ArtifactViewerModal`.

### Task 5: Verify on Live Page
**URL:** https://vibestudio.example.com/team-runs/13c1da95-c365-4200-a88c-18706cad2a93/monitor

Verify:
1. Master transcript loads immediately from DB on click
2. Completed workflow transcripts display fully
3. Agent transcripts work correctly
4. Artifact links function properly

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/services/transcripts.service.ts` | Add `getTranscriptLines()` method |
| `frontend/src/components/workflow-viz/MasterTranscriptPanel.tsx` | Rewrite: DB fetch + polling, remove WebSocket |
| `frontend/src/components/execution/ArtifactViewer.tsx` | DELETE (unused) |

## Backend Endpoints (Already Exist - No Backend Changes Needed)
- `GET /projects/:projectId/workflow-runs/:runId/transcript-lines` - Returns TranscriptLine records

## Cleanup: Remove Dead WebSocket Code
The following WebSocket-related code in MasterTranscriptPanel can be removed:
- `master-transcript:subscribe` / `master-transcript:unsubscribe` emits
- `master-transcript:streaming_started` / `lines` / `batch` / `error` / `stopped` listeners
- `isAgentOnline`, `agentHostname` props
- Play/Stop streaming button UI
