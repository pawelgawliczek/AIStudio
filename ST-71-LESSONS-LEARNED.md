# ST-71 Manual EP-7 Workflow - Lessons Learned

## Issue 1: Developer Component Scope Confusion

**Problem:**
The Full-Stack Developer component tried to build and test in the worktree:
- Attempted `docker compose build backend --no-cache`
- Suggested running tests
- This is OUTSIDE the Developer component's responsibility in EP-7

**Root Cause:**
Developer component instructions don't explicitly state EP-7 separation of concerns.

**Fix Required:**
Update Developer component `operationInstructions` to add:

```markdown
## EP-7 WORKFLOW INTEGRATION (CRITICAL)

**When working in a git worktree (EP-7 workflow), your role is CODE ONLY:**

✅ YOUR RESPONSIBILITIES:
- Write code changes in the worktree
- Run local syntax checks (linting)
- Commit changes with proper messages
- Link commits using mcp__vibestudio__link_commit
- Verify files are in worktree (pwd check)

❌ NOT YOUR RESPONSIBILITY (EP-7 tools handle this):
- Docker builds (deploy_to_test_env does this)
- Running tests (run_tests tool does this)
- Deployment (deploy_to_test_env does this)
- Test queue management (separate tools)

**Why?**
EP-7 workflow deploys to a shared test environment by:
1. Checking out your branch in MAIN worktree
2. Building containers there
3. Running tests in isolated environment
4. Capturing results

Building in your worktree would:
- Pollute the worktree with build artifacts
- Waste time (tests run in different environment anyway)
- Break the EP-7 isolation model

**After your commits are done and linked, your work is COMPLETE.**
The QA component and EP-7 tools take over from there.
```

**Component to Update:**
- Component ID: `b8734895-1ecb-4f22-bba4-b9d04d66222b` (Full-Stack Developer)
- Field: `operationInstructions`

---

## Issue 2: Developer Component Should Not Suggest Next Steps

**Problem:**
Developer component output said:
> "Next Steps for Deployment:
> 1. Build (from main repo): docker compose build...
> 2. Start: docker compose up -d
> 3. Create PR: Push branch and create pull request..."

**Root Cause:**
Developer component doesn't know about EP-7 orchestration flow.

**Fix Required:**
Update Developer component `outputInstructions` to clarify:

```markdown
**FINAL STEP:**

After linking all commits, your component work is COMPLETE. Do NOT:
- Suggest next steps (the Coordinator decides)
- Attempt to build or test
- Create PRs (that's a separate tool: create_pull_request)

Simply report:
- Files modified
- Commits created and linked
- Summary of implementation

The workflow orchestrator (PM coordinator) will spawn the next component or invoke EP-7 tools.
```

---

## Correct EP-7 Flow Validated

**What Worked:**
1. ✅ Worktree isolation (code changes separate from main)
2. ✅ Developer stayed in worktree directory
3. ✅ Commits properly linked with `link_commit`
4. ✅ Implementation complete without building

**What's Next (EP-7 Tools):**
1. `check_for_conflicts` - Verify no merge conflicts
2. `test_queue_add` - Add story to test queue
3. `deploy_to_test_env` - Build & deploy in main worktree
4. `run_tests` - Execute all tests
5. `create_pull_request` - Auto-generate PR
6. `merge_pull_request` - Merge if tests pass
7. `cleanup_story_artifacts` - Remove worktree

---

## Action Items

**Immediate (for ST-71):**
- [x] Developer implementation complete
- [ ] Record component completion
- [ ] Deploy using EP-7 tools
- [ ] Run tests using EP-7 tools
- [ ] Create PR using EP-7 tools
- [ ] Merge PR
- [ ] Cleanup worktree

**Future (Component Updates):**
- [ ] Update Developer component instructions (add EP-7 section)
- [ ] Update Developer output instructions (remove "next steps")
- [ ] Add EP-7 awareness to ALL component instructions
- [ ] Consider adding `workflowMode` context (standalone vs ep7) to components

---

## Metrics from ST-71

**Developer Component Performance:**
- Duration: 12m 20s
- Tokens: 106.1k
- Tool Calls: 38
- Files Modified: 6
- LOC Added: 938
- LOC Removed: 18
- Commits: 2 (both linked)

**Issues Encountered:**
- Attempted Docker build (caught and corrected)
- Suggested manual deployment steps (unnecessary in EP-7)

**Overall Assessment:**
✅ Implementation quality: Excellent (all 8 AC met)
⚠️ Workflow understanding: Needs improvement (tried to build/test)

---

## Notes for Future Workflows

When using EP-7 git workflow:
1. **Coordinator spawns Developer with EP-7 context flag**
2. **Developer does code only** (no build/test/deploy)
3. **Coordinator invokes EP-7 deployment tools**
4. **QA component reviews test results** (from EP-7 run_tests output)
5. **Coordinator invokes PR tools**

This maintains clean separation of concerns and enables parallel development across multiple worktrees.
