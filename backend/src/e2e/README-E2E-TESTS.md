# E2E Tests for Transcript & Artifact Flow

## Quick Start

### 1. Review Test Specification
```bash
cat backend/src/e2e/TRANSCRIPT-ARTIFACT-FLOW-TEST-SPEC.md
```

Complete specification of what needs to be tested for ST-329, ST-330, and EP-14 MVP validation.

### 2. Implement Tests
```bash
# Edit the test file (currently has base template)
code backend/src/e2e/transcript-artifact-flow.e2e.test.ts

# Follow the specification to add:
# - testTranscriptLineFlow()
# - testArtifactFlow()  
# - main() runner
```

### 3. Run Tests
```bash
# Ensure database is running
docker-compose up -d postgres

# Run the E2E test
npx tsx backend/src/e2e/transcript-artifact-flow.e2e.test.ts
```

## What This Tests

### Complete Flow Validation
```
Laptop Agent → File Upload → WebSocket → Backend DB → REST API → Frontend
```

### Test 1: Transcript Lines
- ✅ WebSocket upload (transcript:lines event)
- ✅ DB persistence (TranscriptLine table)
- ✅ REST API retrieval
- ✅ Pagination (limit, offset)
- ✅ Duplicate detection (skipDuplicates)

### Test 2: Artifacts  
- ✅ WebSocket upload (artifact:upload event)
- ✅ DB persistence (Artifact table)
- ✅ ACK protocol
- ✅ Version incrementing
- ✅ Content hash deduplication

## Files

| File | Purpose |
|------|---------|
| `transcript-artifact-flow.e2e.test.ts` | Main test implementation (template ready) |
| `TRANSCRIPT-ARTIFACT-FLOW-TEST-SPEC.md` | Detailed test specification |
| `E2E-TEST-IMPLEMENTATION-SUMMARY.md` | Implementation guide & summary |

## MVP Validation

This is the **last backend story for EP-14 MVP**. When tests pass:

✅ ST-329: Backend saves transcript lines to DB
✅ ST-330: TranscriptTailer queues lines via UploadManager
✅ EP-14: File-Based Architecture & Guaranteed Delivery (MVP Complete)

## Expected Output

```
══════════════════════════════════════════════
📊 TEST SUITE SUMMARY
══════════════════════════════════════════════
Test 1 (Transcript Lines): ✅ PASS
Test 2 (Artifacts): ✅ PASS  
══════════════════════════════════════════════
Duration: 12.34s
══════════════════════════════════════════════
🎉 ALL E2E TESTS PASSED
✅ MVP for EP-14 is validated!
══════════════════════════════════════════════
```

## Reference

Based on existing patterns:
- `backend/src/remote-agent/__tests__/artifact-upload-e2e.test.ts`
- `backend/src/e2e/ep8-story-runner/*`

For questions, see the detailed specification document.
