# Epic Assignment Artifact Move E2E Test

## Overview

This E2E test verifies the complete flow of artifact directory movement when a story is assigned to or unassigned from an epic (ST-363).

## Test File

`src/__tests__/epic-artifact-move.e2e.test.ts`

## What It Tests

### Test 1: Epic Assignment
1. Creates a test epic using MCP `create_epic` tool
2. Creates a test story using MCP `create_story` tool
3. Creates an artifact file at `docs/ST-XXX/THE_PLAN.md`
4. Assigns the story to the epic via MCP `update_story` tool
5. Backend detects the epic assignment and sends `artifact:move-request` to laptop-agent
6. Laptop-agent receives the request and moves the directory:
   - From: `docs/ST-XXX/`
   - To: `docs/EP-YYY/ST-XXX/`
7. Verifies the file exists at the new location
8. Verifies the file no longer exists at the old location
9. Verifies the move completion event was emitted
10. Cleans up all test entities (story, epic, files)

### Test 2: Epic Unassignment
1. Creates a test epic and story (already assigned to epic)
2. Creates an artifact file at `docs/EP-YYY/ST-XXX/THE_PLAN.md`
3. Removes the epic assignment via MCP `update_story` (set epicId to null)
4. Backend sends `artifact:move-request` to laptop-agent
5. Laptop-agent moves the directory:
   - From: `docs/EP-YYY/ST-XXX/`
   - To: `docs/unassigned/ST-XXX/`
6. Verifies the file exists at the unassigned location
7. Verifies the file no longer exists at the epic location
8. Cleans up all test entities

## Prerequisites

### 1. Backend Running
The test requires the backend to be running and accessible at:
```
https://vibestudio.example.com
```

### 2. Laptop Agent Running
The laptop agent must be running locally and connected to the backend WebSocket.

Start the agent:
```bash
cd /Users/pawelgawliczek/projects/AIStudio/laptop-agent
npm run dev
```

Or if built:
```bash
npm start
```

### 3. Environment Variables
Set the `AGENT_SECRET` environment variable (or use the default in the test):

```bash
export AGENT_SECRET=48d8a63b17f8283d2ccc33abd1d1d68f9eb79284b1ca0edeb754115ccd4dd090
```

### 4. Dependencies
Install dependencies (including axios):
```bash
npm install
```

## Running the Test

### Run just this E2E test:
```bash
npm test -- epic-artifact-move.e2e
```

### Run with verbose output:
```bash
npm test -- epic-artifact-move.e2e --verbose
```

### Run all tests:
```bash
npm test
```

## Test Output

The test provides detailed console output showing each step:

```
🚀 Starting Epic Assignment Artifact Move E2E Test
======================================================================
✅ MCP Client initialized (https://vibestudio.example.com)
🔌 Connecting to production WebSocket...
  ✅ Connected to WebSocket
  📝 Registering as agent...
  ✅ Registered successfully (Agent ID: ...)
✅ Setup complete

🧪 Test: Artifact directory move on epic assignment
----------------------------------------------------------------------

📋 Step 1: Creating test epic...
  ✅ Epic created: EP-123 (ID: ...)

📝 Step 2: Creating test story...
  ✅ Story created: ST-456 (ID: ...)

📄 Step 3: Creating artifact file...
  ✅ Artifact created: /Users/.../docs/ST-456/THE_PLAN.md

🎧 Step 4: Setting up move event listeners...
  ✅ Event listeners registered

🔄 Step 5: Assigning story to epic...
  ✅ Story ST-456 assigned to epic EP-123

⏳ Step 6: Waiting for artifact move...
  ✅ Artifact moved to: /Users/.../docs/EP-123/ST-456/THE_PLAN.md

✅ Step 7: Verifying move completion event...
  ✅ Move completion event received

🔍 Step 8: Verifying file at new location...
  ✅ File exists at new location with correct content

🔍 Step 9: Verifying file removed from old location...
  ✅ Old directory removed

✅ Test passed: Epic assignment artifact move completed successfully!
======================================================================
```

## What Could Go Wrong

### 1. Backend Not Running
```
Error: Connection timeout
```
**Solution:** Ensure backend is running at `https://vibestudio.example.com`

### 2. Laptop Agent Not Running
```
Error: WebSocket connection timeout
```
**Solution:** Start the laptop agent:
```bash
cd /Users/pawelgawliczek/projects/AIStudio/laptop-agent
npm run dev
```

### 3. Invalid AGENT_SECRET
```
Error: Agent registration failed
```
**Solution:** Set the correct `AGENT_SECRET` environment variable

### 4. File Move Timeout
```
Error: expect(moved).toBe(true)
```
**Solution:**
- Check laptop agent logs for errors
- Verify the backend is sending `artifact:move-request` events
- Check file system permissions

### 5. Cleanup Errors
```
⚠️  Error cleaning up files: ...
```
**Note:** This is a warning and won't fail the test. It means some cleanup couldn't complete, but the test assertions passed.

## Test Isolation

The test is designed to be fully isolated and idempotent:

1. **Unique Test Entities:** Creates fresh epic and story for each test run
2. **Automatic Cleanup:** Deletes all created entities in `afterAll` hook
3. **No Dependencies:** Does not rely on existing database entities
4. **File Cleanup:** Removes all created files and directories

Even if a test fails, the cleanup will run and remove test entities.

## Architecture Integration

This test verifies the complete integration between:

1. **MCP Tools** → Backend API endpoints for story/epic management
2. **Backend Business Logic** → Epic assignment change detection
3. **WebSocket Events** → `artifact:move-request` sent from backend to laptop-agent
4. **Laptop Agent** → Receives request and calls `ArtifactMover` service
5. **File System** → Physical directory move operation
6. **Acknowledgment** → `artifact:move-complete` event sent back to backend

## Debugging

### Enable Verbose Logging
Set environment variable for detailed logs:
```bash
DEBUG=* npm test -- epic-artifact-move.e2e
```

### Check Laptop Agent Logs
```bash
tail -f ~/.vibestudio/logs/laptop-agent.log
```

### Check Backend Logs
```bash
# On the backend server
docker compose logs -f backend
```

### Manual Verification
After test runs, check if files were cleaned up:
```bash
ls -la /Users/pawelgawliczek/projects/AIStudio/docs/
```

You should NOT see any test epic or story directories remaining.

## Related Documentation

- ST-363: Epic Assignment Artifact Move Feature
- [Artifact Mover Service](/Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/artifact-mover.ts)
- [MCP Tools Documentation](/Users/pawelgawliczek/projects/AIStudio/docs/MCP_TOOLS.md)
- [WebSocket Events](/Users/pawelgawliczek/projects/AIStudio/docs/LIVE_STREAMING_ARCHITECTURE.md)

## Future Enhancements

Potential improvements to this test:

1. **Parallel Story Assignment:** Test moving multiple stories to same epic simultaneously
2. **Edge Cases:** Test with special characters in file names, large directories
3. **Error Recovery:** Test behavior when move operation fails mid-way
4. **Permission Errors:** Test with read-only directories
5. **Concurrent Moves:** Test moving same story while another move is in progress
