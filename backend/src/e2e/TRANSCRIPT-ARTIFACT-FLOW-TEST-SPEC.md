# E2E Test Specification: Transcript and Artifact Flow (ST-329, ST-330, EP-14)

## Overview
This document specifies the comprehensive E2E tests needed to validate the complete transcript and artifact upload flow, which is the **last backend story for the MVP** of the new artifact storing system.

## Test File Location
`backend/src/e2e/transcript-artifact-flow.e2e.test.ts`

## Base Template
Use `backend/src/remote-agent/__tests__/artifact-upload-e2e.test.ts` as the starting template.

## Test Setup

### Database Connection
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

### Test Data Creation
1. Find or create test project: "E2E Test Project Transcript Artifact"
2. Create test story with unique timestamp key
3. Create test workflow
4. Create artifact definition with key "E2E_TEST_ARTIFACT"
5. Create workflow run in "running" status
6. Get JWT token for REST API calls (optional)

### Test Data Cleanup
Clean up ALL created data in reverse order of dependencies:
1. Delete TranscriptLine records
2. Delete Artifact records
3. Delete WorkflowRun
4. Delete ArtifactDefinition
5. Delete Workflow
6. Delete Story
7. Keep Project (reusable)

## Test 1: Transcript Line Flow

###Purpose
Validate complete flow: WebSocket upload → DB persistence → REST API retrieval

### Test Steps

#### 1.1 WebSocket Upload
```typescript
socket.emit('transcript:lines', {
  runId: context.workflowRunId,
  sessionIndex: 0,
  lines: [
    { line: 'Line 1: User prompt goes here', sequenceNumber: 1 },
    { line: 'Line 2: Assistant response starts', sequenceNumber: 2 },
    { line: 'Line 3: Tool call executed', sequenceNumber: 3 },
  ],
  isHistorical: false,
  timestamp: new Date().toISOString(),
});
```

#### 1.2 Database Verification
Query `TranscriptLine` table:
- Verify 3 lines persisted
- Verify content matches exactly
- Verify line numbers are correct (1, 2, 3)
- Verify session index is 0
- Store line IDs for cleanup

#### 1.3 REST API Retrieval
```
GET /api/projects/:projectId/workflow-runs/:runId/transcript-lines?sessionIndex=0
```

Verify response:
- Status: 200
- `lines` array length: 3
- `totalLines`: 3
- Line content matches

#### 1.4 Pagination Testing
```
GET /api/projects/:projectId/workflow-runs/:runId/transcript-lines?sessionIndex=0&limit=2&offset=1
```

Verify:
- Returns 2 lines (limit works)
- First line has lineNumber=2 (offset works)

#### 1.5 Duplicate Detection
Send same lines again via WebSocket.
Verify:
- Count remains 3 (skip Duplicates working)
- No duplicate TranscriptLine records created

### Expected Results
✅ All 5 sub-tests pass
✅ skipDuplicates prevents duplicate inserts
✅ REST API pagination works correctly

## Test 2: Artifact Flow

### Purpose
Validate artifact upload, version incrementing, duplicate detection

### Test Steps

#### 2.1 Initial Upload
```typescript
socket.emit('artifact:upload', {
  agentId: agentId,
  items: [{
    queueId: 9001,
    storyKey: context.storyKey,
    artifactKey: 'E2E_TEST_ARTIFACT',
    filePath: `/test/e2e/artifact-${Date.now()}.md`,
    content: '# E2E Test Artifact\n\nTest content',
    contentType: 'text/markdown',
    timestamp: Date.now(),
  }],
});
```

Listen for ACK:
```typescript
socket.on('upload:ack:item', (data) => {
  // Verify: data.success === true
  // Verify: data.id === 9001
});
```

#### 2.2 Database Verification
Query `Artifact` table:
- Verify artifact created
- Verify content matches
- Verify contentType === 'text/markdown'
- Verify currentVersion === 1
- Verify contentHash populated
- Store artifact ID

#### 2.3 Update (Version Increment)
Upload same artifact key with different content:
```typescript
{
  queueId: 9002,
  storyKey: context.storyKey,
  artifactKey: 'E2E_TEST_ARTIFACT', // Same key
  content: '# E2E Test Artifact (Updated)\n\nUpdated content',
  contentType: 'text/markdown',
}
```

Verify:
- Same artifact ID (updated, not created)
- currentVersion === 2
- Content updated to new value
- contentHash updated

#### 2.4 Duplicate Detection (ContentHash)
Upload same content again:
```typescript
{
  queueId: 9003,
  storyKey: context.storyKey,
  artifactKey: 'E2E_TEST_ARTIFACT',
  content: '# E2E Test Artifact (Updated)\n\nUpdated content', // Same as previous
}
```

Verify ACK:
- `data.success === true`
- `data.isDuplicate === true`

Verify database:
- currentVersion still === 2 (not incremented)
- Content unchanged

### Expected Results
✅ Initial upload creates artifact with version 1
✅ Update increments version to 2
✅ Duplicate content detected via contentHash
✅ ACK protocol works correctly

## Test 3: Combined Flow (Optional)

### Purpose
Verify both transcript lines and artifacts can be uploaded in same session

### Test Steps
1. Upload transcript lines
2. Upload artifact
3. Verify both persisted correctly
4. Verify frontend broadcast events fired (if monitored)
5. Clean up all data

## Running the Tests

### Prerequisites
1. Production database accessible at `DATABASE_URL`
2. Backend running at `https://vibestudio.example.com`
3. Valid `AGENT_SECRET` in environment
4. Test user credentials available (for JWT)

### Execution
```bash
npx tsx backend/src/e2e/transcript-artifact-flow.e2e.test.ts
```

### Expected Output
```
══════════════════════════════════════════════════════════════════════
  E2E Tests: Complete Transcript and Artifact Flow
  (ST-329, ST-330, EP-14 - MVP Validation)
══════════════════════════════════════════════════════════════════════

📝 Setting up test data...
  ✅ Project: <id>
  ✅ Story: ST-E2E-TA-<timestamp>
  ✅ Workflow: <id>
  ✅ Artifact Definition: E2E_TEST_ARTIFACT
  ✅ Workflow Run: <id>
  ✅ JWT token obtained

══════════════════════════════════════════════════════════════════════
TEST 1: TRANSCRIPT LINE FLOW
══════════════════════════════════════════════════════════════════════
  ✅ Connected to WebSocket
  ✅ Registered successfully

📤 Sending transcript lines...
  ✅ Transcript lines sent

🔍 Verifying transcript line persistence...

🔍 Testing REST API retrieval...

══════════════════════════════════════════════════════════════════════
📊 TRANSCRIPT LINE FLOW RESULTS
══════════════════════════════════════════════════════════════════════
✅ Database persistence: PASS (3 lines found)
✅ Line content verification: PASS
✅ Line number verification: PASS
✅ REST API retrieval: PASS
✅ REST API line count: PASS
✅ REST API total count: PASS
✅ Pagination (limit): PASS
✅ Pagination (offset): PASS
══════════════════════════════════════════════════════════════════════
🎉 ALL TESTS PASSED
══════════════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════════════
TEST 2: ARTIFACT FLOW
══════════════════════════════════════════════════════════════════════
... (similar output for artifact tests)

══════════════════════════════════════════════════════════════════════
📊 TEST SUITE SUMMARY
══════════════════════════════════════════════════════════════════════
Test 1 (Transcript Lines): ✅ PASS
Test 2 (Artifacts): ✅ PASS
══════════════════════════════════════════════════════════════════════
Duration: 12.34s
══════════════════════════════════════════════════════════════════════
🎉 ALL E2E TESTS PASSED
✅ Transcript and artifact upload flows are working correctly!
✅ MVP for EP-14 is validated!
══════════════════════════════════════════════════════════════════════

🧹 Cleaning up test data...
  ✅ Cleanup complete
```

## Success Criteria

### All tests must pass:
- [x] Transcript lines persist to database
- [x] Transcript lines retrievable via REST API
- [x] Pagination works correctly
- [x] Duplicate transcript lines are skipped
- [x] Artifacts persist to database
- [x] ACK protocol works
- [x] Artifact versions increment on update
- [x] Duplicate artifacts detected via contentHash
- [x] All test data cleaned up properly

### MVP Validation:
This test validates the **complete backend MVP** for EP-14 (File-Based Architecture & Guaranteed Delivery), ensuring:
1. Laptop agent can queue and upload transcript lines
2. Backend persists to TranscriptLine table (ST-329)
3. Frontend can fetch transcript lines via REST API
4. Artifact upload flow works end-to-end
5. Duplicate detection prevents data bloat

## Implementation Notes

1. **Use Production Database**: Tests connect to real production DB, not mocks
2. **Proper Cleanup**: Essential to delete all test data after completion
3. **Timeouts**: WebSocket operations need proper timeouts (3-5 seconds)
4. **Error Handling**: Catch and log all errors clearly
5. **ACK Protocol**: Verify `upload:ack:item` events received
6. **Unique Keys**: Use timestamps in story keys to avoid collisions

## Reference Files
- `/Users/pawelgawliczek/projects/AIStudio/backend/src/remote-agent/__tests__/artifact-upload-e2e.test.ts` - Template
- `/Users/pawelgawliczek/projects/AIStudio/backend/src/remote-agent/handlers/artifact.handler.ts` - Artifact handler
- `/Users/pawelgawliczek/projects/AIStudio/backend/src/remote-agent/handlers/transcript.handler.ts` - Transcript handler  
- `/Users/pawelgawliczek/projects/AIStudio/backend/src/workflow-runs/workflow-runs.controller.ts` - REST endpoints
