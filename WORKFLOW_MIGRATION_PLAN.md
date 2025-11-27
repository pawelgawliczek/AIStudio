# Production Workflow Migration Plan

## Current vs New Schema Comparison

### ✅ Components Already Present

| Component | Current Name | Status | Notes |
|-----------|-------------|--------|-------|
| Project Manager | Software Development PM | ✓ Active | Coordinator component |
| Explore Agent | Context Explore | ✓ Active | - |
| Business Analyst | Business Analyst | ✓ Active | - |
| Software Architect | Software Architect | ✓ Active | - |
| Designer | UI/UX Designer | ✓ Active | - |
| Full-Stack Developer | Full-Stack Developer | ✓ Active | - |
| QA Agent | QA Automation | ✓ Active | - |
| DevOps Engineer | DevOps Engineer | ✓ Active | - |

### ❌ Missing Components (Need to Create)

1. **Security Auditor**
   - Purpose: Identifies vulnerabilities for security-critical tasks
   - Used in: Complex and Security-Critical workflows
   - Runs: Parallel with Full-Stack Developer

2. **Technical Writer**
   - Purpose: Updates documentation and cleans up TEMP files
   - Used in: All Medium+ workflows
   - Runs: Final stage (Stage 7)

---

## 🔄 Key Architecture Changes

### 1. Communication Method: Database Fields → TEMP Files

**Current System (Database-Driven):**
```
Story.contextExploration → Explore writes
Story.baAnalysis → BA writes
Story.architectAnalysis → Architect writes
Story.designerAnalysis → Designer writes
```

**New System (TEMP File Handoff):**
```
TEMP_context.md → Explore writes, all read
TEMP_requirements.md → BA writes
TEMP_design.md → Architect writes
TEMP_security_findings.md → Security writes
```

**Rationale:** Token efficiency - 77% reduction (750K → 175K tokens) by creating 5KB summaries instead of 150K re-investigations.

**Migration Strategy:**
- Keep database fields as backup/audit trail
- Add TEMP file creation/reading to all components
- Technical Writer deletes TEMP files after updating permanent docs

---

### 2. Complexity Classification Matrix

**Current:**
- Trivial: businessComplexity ≤3 AND technicalComplexity ≤3
- Simple: businessComplexity ≤5 AND technicalComplexity ≤5
- Medium: businessComplexity ≤7 OR technicalComplexity ≤7
- Complex: businessComplexity >7 OR technicalComplexity >7
- Critical: DB schema OR metrics OR core system

**New (Refine to Match):**
- ⚡ Trivial: <10 lines, zero logic (1 agent, 5-10 min)
- 🏃 Simple: <50 lines, single file (2 agents, 20-30 min)
- 🚶 Medium: Multi-file, no DB (5 agents, 1-2 hrs)
- 🏋️ Complex: API/DB changes (7-8 agents, 2-4 hrs)
- 🔒 Security-Critical: Auth/payment/admin (8 agents, 3-5 hrs)

**Action:** Update PM coordinator to use new classification criteria.

---

### 3. Workflow Stages (New Schema)

**Stage 1: Classification & Planning**
- PM analyzes complexity
- Determines team composition
- Creates TodoWrite tracking plan

**Stage 2: Context Gathering (Medium+ Only)**
- Explore investigates codebase
- Generates TEMP_context.md
- All downstream agents read this artifact

**Stage 3: Requirements & Design (Parallel)**
- BA writes TEMP_requirements.md
- Architect writes TEMP_design.md
- **Run simultaneously** (no dependency)

**Stage 4: Implementation & Security (Parallel)**
- Full-Stack implements + tests
- Security audits (for security-critical)
- Full-Stack incorporates findings

**Stage 5: Quality Assurance**
- QA validates Playwright E2E tests only
- Reviews test coverage

**Stage 6: Deployment & Verification**
- DevOps deploys changes
- Verifies containers, smoke tests

**Stage 7: Documentation & Cleanup**
- Technical Writer updates docs
- Deletes all TEMP_*.md files

---

### 4. Parallelization Strategy

**Current:** Sequential execution
**New:** Parallel where possible

**Parallel Patterns:**

1. **BA + Architect** (Stage 3)
   - Zero dependency between them
   - Spawn both simultaneously
   - Wait for both to complete before Stage 4

2. **Full-Stack + Security** (Stage 4)
   - Security reviews design while implementation begins
   - Full-Stack incorporates findings during coding

3. **QA + DevOps** (Stage 5-6)
   - QA validates tests
   - DevOps prepares deployment

**Implementation:** Use Task tool with multiple parallel agents

---

### 5. Testing Ownership Framework

**Full-Stack Developer Owns:**
- Unit tests (tests/unit/)
- Integration tests (api/tests/test_*_integration.py)
- Python E2E tests (api/tests/test_*_e2e.py)
- Frontend tests (web/src/**/*.test.jsx)
- **TDD Flow:** Write failing tests → implement → refactor

**QA Agent Owns:**
- Playwright browser automation only
- Multi-user flows
- Complex browser scenarios

**Action:** Update component instructions to clarify ownership

---

### 6. Skip Decision Logic

**Trivial:**
- Skip: BA, Architect, QA, Security, Writer
- Run: Full-Stack only

**Simple:**
- Skip: BA (PM writes 2-line requirement), QA, Writer
- Run: Full-Stack + Architect spot-check

**Medium:**
- Skip: Security (unless auth/data-sensitive)
- Run: Explore → BA → Designer → Architect → Full-Stack → QA → Writer

**Complex:**
- No skips
- Run: Full workflow (7-8 agents)

**Security-Critical:**
- No skips + double security review
- Run: Full workflow + Security (8 agents)

---

## 📋 Implementation Checklist

### Phase 1: Create Missing Components
- [ ] Create Security Auditor component
  - Input: TEMP_design.md, story details
  - Operation: Identify vulnerabilities (OWASP Top 10, auth issues, etc.)
  - Output: TEMP_security_findings.md

- [ ] Create Technical Writer component
  - Input: All TEMP files, implementation results
  - Operation: Update DOCUMENTATION.md, test-strategy.md
  - Output: Updated docs, deleted TEMP files

### Phase 2: Update Coordinator (PM)
- [ ] Add TEMP file handoff logic
- [ ] Update complexity classification criteria
- [ ] Implement parallelization (BA + Architect, Full-Stack + Security)
- [ ] Update skip decision logic

### Phase 3: Update Existing Components
- [ ] Context Explore: Write to TEMP_context.md
- [ ] Business Analyst: Read TEMP_context.md, write TEMP_requirements.md
- [ ] Software Architect: Read TEMP_context.md, write TEMP_design.md
- [ ] Full-Stack Developer: Read all TEMP files, clarify testing ownership
- [ ] QA Automation: Clarify Playwright-only focus
- [ ] DevOps: Add container verification steps

### Phase 4: Update Workflow
- [ ] Update workflow definition to reference new schema
- [ ] Update trigger configuration if needed

### Phase 5: Testing
- [ ] Test Trivial workflow (Full-Stack only)
- [ ] Test Simple workflow (Full-Stack + Architect)
- [ ] Test Medium workflow (5 agents, parallel BA+Architect)
- [ ] Test Complex workflow (7-8 agents, parallel Full-Stack+Security)
- [ ] Test Security-Critical workflow (8 agents, double security review)

---

## 🎯 Success Metrics (from New Schema)

**Velocity:**
- Target: 7x faster than baseline
- Baseline: 5-7 days → Target: 0.6 days

**Quality Metrics:**
- Static analysis issues: 0
- Test coverage: 100%
- Bugs found in review: 0
- Post-deployment incidents: 0

**Interaction Efficiency:**
- User prompts: ≤2 per feature
- Lines of code per prompt: ~500
- Token efficiency: 60-80% reduction

**Completion Checklist:**
- ✅ User acceptance of deliverable
- ✅ All tests passing
- ✅ Code deployed successfully
- ✅ Documentation updated
- ✅ No regression bugs

---

## 🚀 Rollout Strategy

1. **Create new components** (Security, Writer) - No disruption
2. **Test TEMP file system** in parallel with database fields
3. **Update coordinator** to support both systems
4. **Gradual migration** - Start with new stories, leave old ones on database system
5. **Monitor metrics** - Compare token usage, velocity, quality
6. **Full cutover** after 2-week validation period
