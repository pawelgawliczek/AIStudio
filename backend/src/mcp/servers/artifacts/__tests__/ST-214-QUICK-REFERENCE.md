# ST-214 Test Quick Reference

## File Information
- **Test File:** `story_scoped_artifacts.test.ts`
- **Lines of Code:** 1,232
- **Test Cases:** 27 tests in 10 describe blocks
- **Summary:** `ST-214-TEST-SUMMARY.md`

## Test Structure

```
Story-Scoped Artifacts (ST-214)
├── Schema/Model (3 tests)
│   ├── Create artifact with storyId
│   ├── Enforce unique constraint
│   └── Create ArtifactVersion
│
├── upload_artifact - Story-Scoped (5 tests)
│   ├── Create with storyId directly
│   ├── Derive storyId from workflowRunId
│   ├── Skip version bump for same hash
│   ├── Create new version for different content
│   └── Reject cross-project upload
│
├── get_artifact - Story-Scoped (4 tests)
│   ├── Get by storyId + definitionKey
│   ├── Get by workflowRunId (compat)
│   ├── Get specific version
│   └── Reject cross-project access
│
├── list_artifacts - Story-Scoped (3 tests)
│   ├── List all for story
│   ├── Filter by definitionKey
│   └── Include version history
│
├── Migration (3 tests)
│   ├── Populate storyId from runs
│   ├── Handle orphaned artifacts
│   └── Ensure unique constraint
│
└── Security (9 tests)
    ├── Authorization (3 tests)
    ├── Hash Validation (2 tests)
    ├── Quota Enforcement (2 tests)
    └── Race Conditions (2 tests)
```

## Running Tests

```bash
# Run all ST-214 tests
npm test -- story_scoped_artifacts.test.ts

# Run specific category
npm test -- story_scoped_artifacts.test.ts -t "upload_artifact"
npm test -- story_scoped_artifacts.test.ts -t "Security"

# Run in watch mode
npm test -- story_scoped_artifacts.test.ts --watch

# Run with coverage
npm test -- story_scoped_artifacts.test.ts --coverage
```

## Key Test Patterns

### 1. Story-Scoped Upload
```typescript
await uploadArtifact(mockPrisma, {
  storyId: 'story-uuid',
  definitionKey: 'ARCH_DOC',
  content: '# Architecture',
});
```

### 2. Backward Compatible Upload
```typescript
await uploadArtifact(mockPrisma, {
  workflowRunId: 'run-uuid', // Derives storyId automatically
  definitionKey: 'ARCH_DOC',
  content: '# Architecture',
});
```

### 3. Version History Retrieval
```typescript
await getArtifact(mockPrisma, {
  storyId: 'story-uuid',
  definitionKey: 'ARCH_DOC',
  version: 2, // Get specific version
});
```

### 4. List with Version History
```typescript
await listArtifacts(mockPrisma, {
  storyId: 'story-uuid',
  includeVersionHistory: true,
});
```

## Mock Setup Example

```typescript
beforeEach(() => {
  jest.clearAllMocks();

  // Mock story lookup
  (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue({
    id: 'story-uuid',
    key: 'ST-214',
    projectId: 'project-uuid',
  });

  // Mock definition lookup
  (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue({
    id: 'def-uuid',
    workflowId: 'workflow-uuid',
    key: 'ARCH_DOC',
    workflow: { projectId: 'project-uuid' },
  });

  // Mock artifact creation
  (mockPrisma.artifact.create as jest.Mock).mockResolvedValue({
    id: 'artifact-uuid',
    storyId: 'story-uuid',
    version: 1,
  });
});
```

## Common Assertions

### Verify Story-Scoped Creation
```typescript
expect(result.storyId).toBe('story-uuid');
expect(mockPrisma.artifact.create).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      storyId: 'story-uuid',
    }),
  })
);
```

### Verify Version Bump
```typescript
expect(result.version).toBe(2);
expect(mockPrisma.artifactVersion.create).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      version: 2,
      contentHash: expect.any(String),
    }),
  })
);
```

### Verify Hash Deduplication
```typescript
const content = '# Same Content';
const hash = crypto.createHash('sha256').update(content).digest('hex');

// Upload twice with same content
await uploadArtifact(mockPrisma, { storyId, content });
await uploadArtifact(mockPrisma, { storyId, content });

// Version should not increment
expect(result.version).toBe(1);
expect(mockPrisma.artifactVersion.create).not.toHaveBeenCalled();
```

### Verify Authorization
```typescript
await expect(
  uploadArtifact(mockPrisma, {
    storyId: 'story-in-project-A',
    definitionKey: 'artifact-from-project-B',
    content: 'data',
  })
).rejects.toThrow('must belong to the same project');
```

## Security Test Checklist

When adding new artifact features, ensure:

- [ ] Cross-project access denied (story.projectId vs definition.workflow.projectId)
- [ ] Story existence validated before operations
- [ ] Content hash computed using SHA256
- [ ] Quota enforcement (50MB per story default)
- [ ] Version creation wrapped in transaction
- [ ] Optimistic concurrency for version numbers

## TypeScript Errors (Expected)

Until implementation is complete, expect these errors:

```
storyId does not exist in type 'UploadArtifactParams'
artifactVersion does not exist on PrismaClient
versionCount does not exist on response type
```

These indicate features to implement. As each feature is added, corresponding errors will disappear.

## Next Steps for Implementer

1. **Schema Migration**
   - Add `Artifact.storyId` field
   - Create `ArtifactVersion` model
   - Run: `npx prisma migrate dev --name story_scoped_artifacts`

2. **Type Definitions** (`types.ts`)
   - Update `UploadArtifactParams` with `storyId?`
   - Update `GetArtifactParams` with `storyId?` and `version?`
   - Update `ListArtifactsParams` with `storyId?` and `includeVersionHistory?`
   - Update `ArtifactResponse` with `storyId`, `versionCount?`, `versionHistory?`

3. **Tool Implementation**
   - Modify `upload_artifact.ts` handler
   - Modify `get_artifact.ts` handler
   - Modify `list_artifacts.ts` handler

4. **Run Tests**
   - `npm test -- story_scoped_artifacts.test.ts`
   - All 27 tests should pass

5. **Migration Script**
   - Backfill `storyId` from workflow runs
   - Handle orphaned artifacts
   - Merge duplicates if any

## Test Maintenance

- Add new tests when adding features
- Update mocks if Prisma schema changes significantly
- Keep this reference updated with new patterns
- Document any breaking changes

## Questions?

See full documentation:
- Implementation plan: (to be created in docs/stories/ST-214/)
- Security review: (referenced in story requirements)
- Test summary: `ST-214-TEST-SUMMARY.md`
