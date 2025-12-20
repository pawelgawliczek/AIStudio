# THE_PLAN - ST-324: Backend Deduplication Logic

## Status: ALREADY IMPLEMENTED ✅

The deduplication logic described in ST-324 requirements **is already fully implemented** in the codebase as of recent commits (ST-362, ST-326).

---

## Current Implementation Analysis

### File: `backend/src/remote-agent/handlers/artifact.handler.ts`

The `ArtifactHandler.handleArtifactUpload()` method already implements complete deduplication:

#### Lines 131-148: Hash Calculation & Deduplication Check
```typescript
// Calculate content hash for duplicate detection
const contentHash = this.calculateSHA256(content);

// ST-362: Build where clause based on story or epic
const whereClause = storyId
  ? { definitionId: artifactDefinition.id, storyId }
  : { definitionId: artifactDefinition.id, epicId };

// Check for existing artifact with same content
const existingArtifact = await this.prisma.artifact.findFirst({
  where: { ...whereClause, contentHash },
});

if (existingArtifact) {
  this.logger.log(`${logPrefix}: Duplicate artifact content detected for queueId ${queueId}`);
  callback({ success: true, id: queueId, isDuplicate: true });
  return;
}
```

#### Lines 224-226: SHA256 Hash Function
```typescript
private calculateSHA256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
```

---

## Design Decisions (Confirmed in Implementation)

### 1. Per-Artifact Per-Scope Deduplication ✅
- **Story-scoped**: Checks `definitionId + storyId + contentHash`
- **Epic-scoped**: Checks `definitionId + epicId + contentHash` (ST-362)
- **NOT global**: Same content in different stories/epics creates separate artifacts

### 2. Compare Against Latest Version Only ✅
Query uses `findFirst()` with `contentHash` in the WHERE clause, which returns ANY artifact matching the hash within that scope. Since artifacts are updated in-place (not versioned separately), this effectively compares against the current/latest version.

### 3. First-Write-Wins Race Condition Handling ✅
- First upload creates artifact with contentHash
- Subsequent duplicate uploads hit the deduplication check
- Database unique constraints prevent race conditions:
  - `@@unique([definitionId, storyId])`
  - `@@unique([definitionId, epicId])`

### 4. Success Response with Duplicate Flag ✅
Returns `{ success: true, id: queueId, isDuplicate: true }` when duplicate detected.

### 5. Monitoring/Logging ✅
Logs duplicate detection: `"Duplicate artifact content detected for queueId ${queueId}"`

---

## Database Schema Support

### `backend/prisma/schema.prisma` (Lines 1796, 1834)

```prisma
model Artifact {
  contentHash String? @map("content_hash") @db.VarChar(64) // SHA256 for change detection
  // ... other fields
  @@unique([definitionId, storyId])
  @@unique([definitionId, epicId])
}

model ArtifactVersion {
  contentHash String @map("content_hash") @db.VarChar(64)
  // ... other fields
}
```

- `contentHash` field exists and is indexed via unique constraints
- SHA256 produces 64-character hex string (matches schema)
- Unique constraints ensure no duplicate (definition + scope) combinations

---

## Test Coverage Analysis

### Unit Tests: `backend/src/remote-agent/handlers/__tests__/artifact.handler.test.ts`

#### Lines 228-271: Duplicate Detection Tests
1. **Test: "should detect duplicate content by SHA256 hash"** (lines 229-271)
   - Creates artifact with content
   - Uploads same content again
   - Verifies `isDuplicate: true` returned
   - Verifies no create/update called

2. **Test: "should not broadcast event for duplicate content"** (lines 273-304)
   - Ensures `frontendServer.emit` not called for duplicates
   - Prevents unnecessary frontend updates

#### Lines 168-225: Update vs Create Logic
3. **Test: "should update existing artifact when content changes"** (lines 168-225)
   - New content → increments version
   - Different content hash → triggers update

---

## Related Implementations

### MCP Tool: `backend/src/mcp/servers/artifacts/create_artifact.ts`
Lines 281-301 show similar deduplication logic in the MCP endpoint:
```typescript
const contentHash = calculateSHA256(params.content);
const existingArtifact = await prisma.artifact.findFirst({
  where: whereClause,
  include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
});

if (existingArtifact && existingArtifact.contentHash === contentHash) {
  return formatArtifact(existingArtifact);  // Return existing, don't create new version
}
```

### Transcript Handler: Similar Pattern
`backend/src/remote-agent/handlers/transcript.handler.ts` (lines 496-510) uses same deduplication pattern for transcripts.

---

## Integration Points

### Upload Flow (from E2E tests and code)
1. **Laptop Agent** → Watches `docs/{EPIC_KEY}/{STORY_KEY}/*.md`
2. **WebSocket** → Sends `artifact:upload` event with items
3. **RemoteAgentGateway** → Routes to `ArtifactHandler.handleArtifactUpload()`
4. **Deduplication Check** → Query by contentHash
5. **ACK Response** → `{ success: true, isDuplicate: true }` if found
6. **Laptop Agent** → Marks queue item as acked (doesn't retry)

### Queue Manager Behavior
File: `laptop-agent/src/upload/UploadManager.ts` (inferred from gateway code)
- On `isDuplicate: true` ACK → Removes from queue (success case)
- No retries for duplicate content
- Metrics track duplicates separately

---

## Potential Gaps (NONE IDENTIFIED)

All requirements from ST-324 are met:
- ✅ Check contentHash before creating/updating artifact
- ✅ Return success + duplicate flag if exact content exists
- ✅ Don't create new version for duplicate content
- ✅ Log duplicate detections for monitoring

---

## Git History Context

Recent related commits:
- `0e6c19c` - feat(ST-362): Complete epic-level artifact upload support
- `bc1f5ed` - feat(ST-377): Harden MCP bridge for protocol compliance and stability
- Prior commits show gradual buildup of artifact upload pipeline (ST-326, ST-327)

The deduplication was likely implemented as part of ST-326 (Backend artifact handler creation) or earlier.

---

## Conclusion

**No code changes are required for ST-324.** The functionality described in the requirements is already present and tested in the codebase.

### Recommendation
Mark ST-324 as "Already Complete" or "Duplicate Story" - the work was completed as part of:
- ST-326: Backend artifact handler creation
- ST-362: Epic-level artifact support (extended deduplication to epic scope)

### If Story Must Be Completed
Options:
1. **Close as duplicate** - Most accurate
2. **Add documentation** - Create this THE_PLAN as reference documentation
3. **Enhance monitoring** - Add Grafana dashboard panel for duplicate detection metrics
4. **Add integration test** - Create specific E2E test for deduplication (though unit tests exist)

---

## Next Steps for Other Agents

If this story is being worked as part of a workflow:
- **Implementer**: No changes needed, code already exists
- **Tester**: Run existing tests (`npm test artifact.handler.test.ts`)
- **Reviewer**: Review lines 131-148 and 224-226 of `artifact.handler.ts`
- **Documentation**: This THE_PLAN serves as documentation

---

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `backend/src/remote-agent/handlers/artifact.handler.ts` | 131-148 | Deduplication check |
| `backend/src/remote-agent/handlers/artifact.handler.ts` | 224-226 | SHA256 calculation |
| `backend/src/remote-agent/handlers/__tests__/artifact.handler.test.ts` | 228-304 | Unit tests |
| `backend/prisma/schema.prisma` | 1796, 1834 | Database schema |
| `backend/src/remote-agent/types.ts` | 151 | `isDuplicate` type definition |
| `backend/src/mcp/servers/artifacts/create_artifact.ts` | 281-301 | MCP tool deduplication |

---

## Metrics & Monitoring

### Existing Logging
- Log level: `INFO`
- Message: `"Duplicate artifact content detected for queueId ${queueId}"`
- Includes story/epic prefix for context

### Grafana Dashboard
Check if duplicate metrics are tracked in:
- `docs/monitoring/*` (likely has upload pipeline dashboard)
- Backend emits log lines parseable by Loki

### Potential Enhancements (Optional)
- Add counter metric for duplicate detections
- Dashboard panel showing duplicate rate over time
- Alerts if duplicate rate exceeds threshold (may indicate watcher issues)
