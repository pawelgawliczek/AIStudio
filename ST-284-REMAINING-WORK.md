# ST-284: Remaining Refactoring Work

## Current Status

### Completed
- ✅ Task 1: Helper integration in component-summary.types.ts
- ✅ Task 2: advance_step.ts reduced from 843 → 536 lines (64% done, need 36 more lines)

### Remaining Tasks

## TASK 2 (Final): Reduce advance_step.ts from 536 → <500 lines

**File:** `backend/src/mcp/servers/runner/advance_step.ts`

**Action:** Extract `buildAdvanceResponse()` function (144 lines) to `advance_step.utils.ts`

**Steps:**
1. Move `buildAdvanceResponse()` and `WorkflowRunData` interface to utils
2. Export from utils
3. Update advance_step.ts to import and use it
4. **Result:** 536 - 144 = 392 lines (well under 500)

---

## TASK 3: Split remote-agent.gateway.ts (1,956 → <500 each)

**File:** `backend/src/remote-agent/remote-agent.gateway.ts`

**Strategy:** Extract handler methods to separate service files while keeping gateway as coordinator.

### 3.1: Create ClaudeCodeJobHandler Service

**File:** `backend/src/remote-agent/handlers/claude-code-job.handler.ts`

**Extract these methods:**
- `handleClaudeProgress()` - ~160 lines
- `handleClaudeComplete()` - ~165 lines
- `handleClaudePaused()` - ~70 lines
- `handleResumeAvailable()` - ~137 lines
- `handleAgentResult()` - ~199 lines

**Total:** ~731 lines extracted

**Dependencies to inject:**
```typescript
@Injectable()
export class ClaudeCodeJobHandler {
  constructor(
    private prisma: PrismaService,
    private telemetry: TelemetryService,
    private streamEvent: StreamEventService,
    private transcriptRegistration: TranscriptRegistrationService,
    private appGateway: AppWebSocketGateway,
  ) {}

  async handleProgress(
    client: Socket,
    data: ClaudeCodeProgressEvent,
    server: Server
  ): Promise<void> {
    // Move handleClaudeProgress logic here
  }

  async handleComplete(
    client: Socket,
    data: ClaudeCodeCompleteEvent,
    server: Server
  ): Promise<void> {
    // Move handleClaudeComplete logic here
  }

  async handlePaused(
    client: Socket,
    data: ClaudeCodePausedEvent,
    server: Server
  ): Promise<void> {
    // Move handleClaudePaused logic here
  }

  async handleResumeAvailable(
    client: Socket,
    data: unknown,
    server: Server
  ): Promise<void> {
    // Move handleResumeAvailable logic here
  }

  async handleResult(
    client: Socket,
    data: AgentJob,
    server: Server
  ): Promise<void> {
    // Move handleAgentResult logic here
  }
}
```

**Gateway changes:**
```typescript
@SubscribeMessage('agent:claude_progress')
async handleClaudeProgress(@ConnectedSocket() client: Socket, @MessageBody() data: ClaudeCodeProgressEvent) {
  return this.claudeCodeJobHandler.handleProgress(client, data, this.server);
}
```

### 3.2: Create GitJobHandler Service

**File:** `backend/src/remote-agent/handlers/git-job.handler.ts`

**Extract:**
- `handleGitResult()` - ~86 lines

**Dependencies:**
```typescript
@Injectable()
export class GitJobHandler {
  constructor(
    private prisma: PrismaService,
    private logger: Logger,
  ) {}

  async handleResult(
    client: Socket,
    data: Record<string, unknown>
  ): Promise<void> {
    // Move handleGitResult logic here
  }
}
```

### 3.3: Create TranscriptStreamHandler Service

**File:** `backend/src/remote-agent/handlers/transcript-stream.handler.ts`

**Extract:**
- `handleTranscriptDetected()` - ~78 lines
- `handleMasterTranscriptSubscribe()` - ~59 lines
- `handleMasterTranscriptUnsubscribe()` - ~44 lines
- `handleTranscriptStreamingStarted()` - ~23 lines
- `handleTranscriptLines()` - ~21 lines
- `handleTranscriptBatch()` - ~23 lines
- `handleTranscriptError()` - ~22 lines
- `handleTranscriptStreamingStopped()` - ~23 lines

**Total:** ~293 lines extracted

**Dependencies:**
```typescript
@Injectable()
export class TranscriptStreamHandler {
  constructor(
    private prisma: PrismaService,
    private transcriptRegistration: TranscriptRegistrationService,
    private appGateway: AppWebSocketGateway,
    private logger: Logger,
  ) {}

  // Methods here...
}
```

### 3.4: Update RemoteAgentModule

**File:** `backend/src/remote-agent/remote-agent.module.ts`

Add new providers:
```typescript
@Module({
  imports: [PrismaModule, TelemetryModule, WebsocketModule],
  providers: [
    RemoteAgentGateway,
    StreamEventService,
    TranscriptRegistrationService,
    // NEW:
    ClaudeCodeJobHandler,
    GitJobHandler,
    TranscriptStreamHandler,
  ],
  exports: [StreamEventService, TranscriptRegistrationService],
})
export class RemoteAgentModule {}
```

### 3.5: Expected File Sizes After Split

- `remote-agent.gateway.ts`: ~400 lines (coordinator only)
- `handlers/claude-code-job.handler.ts`: ~731 lines (still needs sub-splitting)
- `handlers/git-job.handler.ts`: ~86 lines ✅
- `handlers/transcript-stream.handler.ts`: ~293 lines ✅

**Note:** claude-code-job.handler.ts will still be >500 lines and may need further splitting into:
- `claude-code-progress.handler.ts`
- `claude-code-lifecycle.handler.ts`

---

## TASK 4: Split code-metrics.service.ts (1,220 → <500 each)

**File:** `backend/src/code-metrics/code-metrics.service.ts`

### 4.1: Create ProjectMetricsService

**File:** `backend/src/code-metrics/services/project-metrics.service.ts`

**Extract:**
- `getProjectMetrics()` - calculates overall project metrics
- `getTrendData()` - trend analysis over time
- `calculateMetrics()` - metric calculation logic

**Expected:** ~300 lines

### 4.2: Create FileAnalysisService

**File:** `backend/src/code-metrics/services/file-analysis.service.ts`

**Extract:**
- `getFileHotspots()` - identifies problematic files
- `getFileDetail()` - detailed file analysis
- File parsing and complexity analysis helpers

**Expected:** ~250 lines

### 4.3: Create TestCoverageService

**File:** `backend/src/code-metrics/services/test-coverage.service.ts`

**Extract:**
- `getTestSummary()` - CONSOLIDATE DUPLICATES (there are multiple!)
- Test coverage calculation methods

**Expected:** ~200 lines

**IMPORTANT:** Search for duplicate `getTestSummary` methods and consolidate!

### 4.4: Update CodeMetricsService

Keep as facade that coordinates the sub-services:

```typescript
@Injectable()
export class CodeMetricsService {
  constructor(
    private projectMetrics: ProjectMetricsService,
    private fileAnalysis: FileAnalysisService,
    private testCoverage: TestCoverageService,
  ) {}

  // Delegate to sub-services
  getProjectMetrics(projectId: string) {
    return this.projectMetrics.getMetrics(projectId);
  }
}
```

**Expected:** ~200 lines

### 4.5: Update CodeMetricsModule

```typescript
@Module({
  imports: [PrismaModule],
  providers: [
    CodeMetricsService,
    ProjectMetricsService,
    FileAnalysisService,
    TestCoverageService,
  ],
  exports: [CodeMetricsService],
})
export class CodeMetricsModule {}
```

---

## TASK 5: Split use-cases.service.ts (1,211 → <500 each)

**File:** `backend/src/use-cases/use-cases.service.ts`

### 5.1: Create UseCasesCrudService

**File:** `backend/src/use-cases/use-cases-crud.service.ts`

**Extract:**
- `create()`
- `findAll()`
- `findOne()`
- `update()`
- `remove()`

**Expected:** ~300 lines

### 5.2: Create UseCasesSearchService

**File:** `backend/src/use-cases/use-cases-search.service.ts`

**Extract:**
- `search()` - main search method
- `searchSemantic()` - vector search
- `searchText()` - text search
- Search ranking and scoring logic

**Expected:** ~400 lines

### 5.3: Update UseCasesService

Keep as facade:

```typescript
@Injectable()
export class UseCasesService {
  constructor(
    private crud: UseCasesCrudService,
    private search: UseCasesSearchService,
  ) {}

  // Delegate methods
  create(data) { return this.crud.create(data); }
  search(query) { return this.search.search(query); }
}
```

**Expected:** ~200 lines

### 5.4: Update UseCasesModule

```typescript
@Module({
  imports: [PrismaModule],
  providers: [
    UseCasesService,
    UseCasesCrudService,
    UseCasesSearchService,
  ],
  controllers: [UseCasesController],
  exports: [UseCasesService],
})
export class UseCasesModule {}
```

---

## VERIFICATION STEPS (After All Refactoring)

Run these commands to verify all ACs pass:

```bash
# 1. File sizes - ALL must be <500
find backend/src -name "*.ts" -type f -exec wc -l {} + | awk '$1 > 500 {print}'

# 2. Circular dependencies
npx madge --circular backend/src

# 3. Tests
npm test

# 4. TypeScript
npm run typecheck

# 5. ESLint
npm run lint
```

---

## Acceptance Criteria Checklist

- [ ] No circular dependencies (already passing)
- [ ] No files >500 lines (4 files still failing)
- [ ] Function complexity <15 (helpers created, need to verify)
- [ ] Code duplication <3% (need to address getTestSummary duplicates)
- [ ] All tests pass
- [ ] TypeScript 0 errors
- [ ] ESLint 0 errors

---

## Notes

- Use NestJS dependency injection for all new services
- Update imports in all affected files
- Run tests after each major refactoring step
- Commit after each completed task
- Check for and fix any breaking changes

---

## Priority Order

1. Complete advance_step.ts (easiest - just move 1 function)
2. Split code-metrics.service.ts (medium complexity, clear boundaries)
3. Split use-cases.service.ts (medium complexity, clear boundaries)
4. Split remote-agent.gateway.ts (highest complexity, requires careful coordination)
