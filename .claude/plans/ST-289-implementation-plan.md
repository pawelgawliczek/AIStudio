# ST-289: Enhanced Task Spawning Instructions - Implementation Plan

## Story Overview
Modify `get_current_step` and `advance_step` MCP tools to return exact Task tool invocation instructions based on versioned component definitions.

## Implementation Approach

### Phase 1: Testing (COMPLETED ✓)
**Objective:** Write comprehensive tests before implementation (TDD approach)

**Deliverables:**
- ✓ Test file created: `backend/src/mcp/shared/__tests__/task-prompt-builder.test.ts`
- ✓ 40+ test cases covering all functions and edge cases
- ✓ Test plan documentation: `task-prompt-builder.TEST_PLAN.md`
- ✓ Tests are FAILING (expected - no implementation yet)

**Test Coverage:**
1. `deriveSubagentType()` - 7 test cases
2. `formatPreviousOutputs()` - 8 test cases
3. `formatArtifactInstructions()` - 8 test cases
4. `buildTaskPrompt()` - 15 test cases
5. Integration tests - 2 scenarios

**Command to Run Tests:**
```bash
npm test -- --testPathPattern="task-prompt-builder"
```

**Expected Result:** All tests FAIL with "Cannot find module '../task-prompt-builder'"

---

### Phase 2: Implementation (NEXT)
**Objective:** Create the task-prompt-builder module to make all tests pass

**File to Create:**
`backend/src/mcp/shared/task-prompt-builder.ts`

**Required Functions:**

1. **deriveSubagentType(executionType: string): string**
   - Maps Component.executionType to Task subagent type
   - native_explore → "Explore"
   - native_plan → "Plan"
   - native_general, custom, or unknown → "general-purpose"

2. **formatPreviousOutputs(componentRuns): string**
   - Takes array of previous ComponentRun records
   - Parses componentSummary (JSON or text)
   - Formats as markdown sections
   - Returns empty string if no runs

3. **formatArtifactInstructions(prisma, stateId, storyId): Promise<string>**
   - Queries ArtifactAccess for the state
   - Groups by accessType (required, read, write)
   - Includes MCP tool examples (get_artifact, upload_artifact)
   - Returns empty string if no access rules

4. **buildTaskPrompt(prisma, state, runId, storyId): Promise<string>**
   - Orchestrates all above functions
   - Builds complete prompt with sections:
     1. Context (pre-execution instructions)
     2. Input (component.inputInstructions)
     3. Task (component.operationInstructions)
     4. Output (component.outputInstructions)
     5. Previous Component Outputs
     6. Artifact Instructions

**Dependencies:**
- @prisma/client
- ../../../types/component-summary.types (already exists)

**Success Criteria:**
- All 40+ tests pass
- No TypeScript errors
- Follows existing code patterns in codebase

---

### Phase 3: Integration (FINAL)
**Objective:** Update get_current_step and advance_step to use the new module

**Files to Modify:**

1. **backend/src/mcp/servers/runner/get_current_step.ts**
   - Import `buildTaskPrompt` and `deriveSubagentType`
   - Replace existing prompt building logic in agent phase (lines ~404-408)
   - Use new function to generate agentConfig.prompt
   - Update subagent_type derivation

2. **backend/src/mcp/servers/runner/advance_step.ts**
   - Similar changes for agent phase instructions
   - Ensure consistency with get_current_step

**Testing:**
- Run existing get_current_step tests
- Run existing advance_step tests
- Manual testing with real workflow run

---

## Technical Details

### Component.executionType Values
(from schema.prisma line 623)
- `custom` - Default, uses general-purpose subagent
- `native_explore` - Uses Explore subagent
- `native_plan` - Uses Plan subagent
- `native_general` - Uses general-purpose subagent

### ArtifactAccess.accessType Values
(from schema.prisma line 1846)
- `read` - Component can read the artifact
- `write` - Component can create/update the artifact
- `required` - Component MUST read this artifact (CRITICAL)

### ComponentSummary Format
(from component-summary.types.ts)
```typescript
{
  version: "1.0",
  status: "success" | "partial" | "blocked" | "failed",
  summary: string, // max 200 chars
  keyOutputs?: string[], // max 5
  nextAgentHints?: string[], // max 3
  artifactsProduced?: string[],
  errors?: string[] // max 3
}
```

---

## Testing Strategy

### Unit Tests (Phase 1)
- Test each function in isolation
- Mock Prisma client
- Cover edge cases (null, empty, invalid JSON)
- Test markdown formatting

### Integration Tests (Phase 3)
- Use existing test infrastructure
- Test with real workflow scenarios
- Verify Task prompts are complete and accurate

### Manual Testing
1. Start a workflow run
2. Call get_current_step at agent phase
3. Verify workflowSequence.agentConfig.prompt contains all required sections
4. Spawn Task agent with the prompt
5. Verify agent has proper context

---

## Implementation Notes

### Prompt Structure
The generated prompt should be comprehensive and self-contained:
- Agent should know what to read (previous outputs + artifacts)
- Agent should know what to do (component instructions)
- Agent should know what to produce (output format + artifacts to write)

### Error Handling
- Handle missing/null component instructions gracefully
- Handle invalid JSON in componentSummary (fallback to text)
- Handle missing artifact definitions
- Handle database query failures

### Performance Considerations
- Minimize database queries (use includes)
- Cache artifact lookups if same artifact appears multiple times
- Keep formatted output concise (don't duplicate content)

---

## Success Metrics

### Phase 1 (Testing) ✓
- ✓ 40+ test cases written
- ✓ All edge cases covered
- ✓ Tests fail predictably (no implementation)

### Phase 2 (Implementation)
- [ ] All tests pass
- [ ] 100% function coverage
- [ ] >95% branch coverage
- [ ] No TypeScript errors

### Phase 3 (Integration)
- [ ] get_current_step tests pass
- [ ] advance_step tests pass
- [ ] Manual workflow execution succeeds
- [ ] Task agents receive complete context

---

## Risks & Mitigations

**Risk:** Existing code in get_current_step/advance_step is complex
**Mitigation:** Keep changes minimal, only replace prompt building logic

**Risk:** Tests might not cover all real-world scenarios
**Mitigation:** Add integration tests with actual workflow data

**Risk:** Performance impact from additional database queries
**Mitigation:** Use Prisma includes to minimize queries, add indexes if needed

---

## Timeline Estimate

- Phase 1 (Testing): COMPLETED (1-2 hours)
- Phase 2 (Implementation): 2-3 hours
- Phase 3 (Integration): 1-2 hours
- **Total:** 4-7 hours

---

## Next Action

**For Implementer Agent:**
1. Read this plan
2. Read the test file to understand requirements
3. Create `backend/src/mcp/shared/task-prompt-builder.ts`
4. Implement the four functions
5. Run tests iteratively until all pass
6. Document any deviations from the plan
