# ST-71 Manual Workflow Execution Plan

**Story:** ST-71 - Investigate Test Coverage +2% Display - May Be Hardcoded
**Epic:** EP-7 (Git Workflow Agent - Backend & MCP Tools)
**Workflow:** Standard Development Workflow (f2279312-e340-409a-b317-0d4886a868ea)
**Complexity:** Business=6, Technical=4 → **MEDIUM** workflow

---

## PHASE 0: Initialization (Coordinator/PM Session)

**You'll execute this in your separate Claude session:**

### Step 0.1: Start Workflow Run
```javascript
mcp__vibestudio__start_workflow_run({
  workflowId: "f2279312-e340-409a-b317-0d4886a868ea",
  triggeredBy: "pawel-manual",
  context: {
    storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
    storyKey: "ST-71",
    branch: "feature/ST-71-test-coverage-display"
  }
})
```

**Expected output:** Returns `runId` - save this for all subsequent steps!

### Step 0.2: Get Story Details
```javascript
mcp__vibestudio__get_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  includeSubtasks: true,
  includeUseCases: true
})
```

### Step 0.3: Initial Estimation
Based on story analysis, update complexity estimates:

```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  businessComplexity: 6,  // UI investigation + dynamic calculation
  technicalComplexity: 4,  // Frontend + backend API work
  estimatedTokenCost: 250000  // Medium complexity
})
```

**Classification:** Medium workflow (businessComplexity ≤7, technicalComplexity ≤7)

**Expected flow:** Explore → BA → Designer → Architect → Developer → QA

---

## PHASE 1: Context Exploration

### Step 1.1: Record Component Start
```javascript
mcp__vibestudio__record_component_start({
  runId: "[runId from step 0.1]",
  componentId: "89e6cc43-7bcb-41aa-9173-3dcd1c9cfa46",  // Context Explore
  input: {
    storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
    storyKey: "ST-71",
    storyTitle: "Investigate Test Coverage +2% Display - May Be Hardcoded"
  }
})
```

### Step 1.2: Execute Context Explore Agent

**Spawn a NEW Claude Code session** with this prompt:

---
**Context Explore Component Execution**

**INPUT INSTRUCTIONS:**
Read the story details from the workflow context including story ID, title, description, and current status. **IMPORTANT: Check ALL 4 specialized analysis fields and follow any existing guidance:**
- contextExploration: Review any previous context exploration findings
- baAnalysis: Consider business requirements already identified
- designerAnalysis: Note any UX/design constraints specified
- architectAnalysis: Follow any architectural decisions already made

Use the story information and any existing analysis to guide your exploration of the codebase.

**OPERATION INSTRUCTIONS:**
1. First, read and understand ALL existing analysis fields (contextExploration, baAnalysis, designerAnalysis, architectAnalysis) to avoid duplicate work and follow established direction
2. Use the Explore agent to understand the codebase structure relevant to the story
3. Search for existing patterns, similar implementations, and related code
4. Identify key files, modules, and dependencies that will be affected
5. Document the technical landscape and any constraints discovered
6. Integrate findings with any existing analysis fields
7. Provide actionable insights for subsequent agents

**OUTPUT INSTRUCTIONS:**
**MANDATORY DATABASE WRITE:**

After completing exploration, you MUST call:

```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  contextExploration: "[your markdown report]"
})
```

**IMPORTANT:**
- Your output is stored in Story.contextExploration field
- All subsequent agents (BA, Architect, Designer, Developer) will READ from this field
- This is the SINGLE SOURCE OF TRUTH for codebase context
- Be thorough - your analysis prevents redundant exploration by other agents

**SUCCESS CRITERIA:**
✅ Story.contextExploration field is populated with comprehensive markdown report
✅ Relevant files are identified and documented (frontend code quality page, backend APIs)
✅ Dependencies are mapped
✅ Technical constraints are noted

**STORY CONTEXT:**
- Story ID: e2708383-65b5-467b-9452-f36900f60c5e
- Story Key: ST-71
- Story Title: Investigate Test Coverage +2% Display - May Be Hardcoded
- Current Status: planning
- Complexity: Business=6, Technical=4

**DATABASE FIELDS TO ACCESS:**
- READ FROM: All 4 analysis fields (likely empty initially)
- WRITE TO: Story.contextExploration

**Available Tools:**
- All standard MCP tools
- mcp__vibestudio__get_story
- mcp__vibestudio__get_story_analysis
- mcp__vibestudio__update_story
- Task (for spawning Explore subagent)
- Grep, Glob, Read
---

**What to look for:**
1. Frontend: Code quality page components showing test coverage
2. Backend: API endpoints providing test coverage metrics
3. Search for hardcoded "+2%" values
4. Identify how test coverage trends should be calculated
5. Map data flow from backend to UI

### Step 1.3: Record Component Complete
```javascript
mcp__vibestudio__record_component_complete({
  runId: "[runId from step 0.1]",
  componentId: "89e6cc43-7bcb-41aa-9173-3dcd1c9cfa46",
  status: "completed",
  output: {
    summary: "Context exploration complete, findings saved to Story.contextExploration"
  }
})
```

---

## PHASE 2: Business Analysis

### Step 2.1: Record Component Start
```javascript
mcp__vibestudio__record_component_start({
  runId: "[runId from step 0.1]",
  componentId: "42d40d84-83e0-436d-a813-00bea87ff98b",  // Business Analyst
  input: {
    storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
    storyKey: "ST-71"
  }
})
```

### Step 2.2: Execute Business Analyst Agent

**Spawn a NEW Claude Code session** with this prompt:

---
**Business Analyst Component Execution**

**INPUT INSTRUCTIONS:**
**REQUIRED FIRST STEP: Use mcp__vibestudio__get_story_analysis to retrieve all 4 analysis fields:**
- contextExploration: Codebase insights (REQUIRED - must consider technical context)
- baAnalysis: Previous BA findings to build upon
- designerAnalysis: UX requirements already specified
- architectAnalysis: Architectural decisions to align with

After retrieving the analysis fields, read the story details and workflow context. Your analysis MUST be consistent with and build upon existing findings.

**OPERATION INSTRUCTIONS:**
1. FIRST: Read and analyze ALL existing fields (contextExploration, baAnalysis, designerAnalysis, architectAnalysis) thoroughly
2. Use contextExploration insights to understand technical feasibility and constraints
3. Break down the story into detailed business requirements and acceptance criteria
4. Identify stakeholders and their needs while respecting existing design/architecture decisions
5. Define clear success metrics aligned with any UX or architectural requirements
6. Document edge cases and business rules
7. Create test scenarios that validate business requirements

**OUTPUT INSTRUCTIONS:**
**MANDATORY DATABASE WRITES:**

After completing analysis, you MUST call update_story TWICE:

1. **Save your analysis:**
```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  baAnalysis: "[your markdown report]"
})
```

2. **Refine complexity score:**
```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  businessComplexity: [1-10 score]
})
```

**IMPORTANT:**
- Your output is stored in Story.baAnalysis field
- Designer and Developer agents will READ from this field
- Architect agent may also reference your analysis
- The businessComplexity score helps coordinator adjust workflow

**SUCCESS CRITERIA:**
✅ Story.baAnalysis field contains comprehensive analysis
✅ Story.businessComplexity is updated with justified score
✅ Acceptance criteria are clear and testable
✅ User flows align with codebase patterns from contextExploration

**STORY CONTEXT:**
- Story ID: e2708383-65b5-467b-9452-f36900f60c5e
- Story Key: ST-71
- Story Title: Investigate Test Coverage +2% Display - May Be Hardcoded
- Current Status: planning
- Complexity: Business=6, Technical=4

**DATABASE FIELDS TO ACCESS:**
- READ FROM: Story.contextExploration (REQUIRED - has codebase findings)
- WRITE TO: Story.baAnalysis, Story.businessComplexity

**Available Tools:**
- mcp__vibestudio__get_story
- mcp__vibestudio__get_story_analysis
- mcp__vibestudio__update_story
---

**What to deliver:**
1. Clear acceptance criteria for dynamic test coverage calculation
2. Business rules for how coverage trends should work
3. Edge cases (no previous data, identical coverage, etc.)
4. Success metrics (user can see real coverage trends)

### Step 2.3: Record Component Complete
```javascript
mcp__vibestudio__record_component_complete({
  runId: "[runId from step 0.1]",
  componentId: "42d40d84-83e0-436d-a813-00bea87ff98b",
  status: "completed"
})
```

---

## PHASE 3: UI/UX Design

### Step 3.1: Record Component Start
```javascript
mcp__vibestudio__record_component_start({
  runId: "[runId from step 0.1]",
  componentId: "1acb6fcd-815d-4b03-aeff-63b0b522133a",  // UI/UX Designer
  input: {
    storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
    storyKey: "ST-71"
  }
})
```

### Step 3.2: Execute UI/UX Designer Agent

**Spawn a NEW Claude Code session** with this prompt:

---
**UI/UX Designer Component Execution**

**INPUT INSTRUCTIONS:**
**REQUIRED FIRST STEP: Use mcp__vibestudio__get_story_analysis to retrieve all 4 analysis fields:**
- contextExploration: Codebase patterns to ensure design consistency
- baAnalysis: Business requirements to satisfy (REQUIRED)
- designerAnalysis: Previous design decisions to build upon
- architectAnalysis: Technical architecture constraints (REQUIRED)

After retrieving the analysis fields, read the story details and all available context. Your designs MUST implement the business requirements and respect architectural constraints.

**OPERATION INSTRUCTIONS:**
1. FIRST: Read and analyze ALL existing fields (contextExploration, baAnalysis, designerAnalysis, architectAnalysis) thoroughly
2. Study existing UI patterns from contextExploration to maintain consistency
3. Create UI/UX designs that implement ALL business requirements from baAnalysis
4. Ensure designs are technically feasible per architectAnalysis constraints
5. Design user flows that satisfy acceptance criteria from BA analysis
6. Create wireframes/mockups that respect both business logic and technical architecture
7. Specify component behavior, states, and interactions

**OUTPUT INSTRUCTIONS:**
**MANDATORY DATABASE WRITE:**

After completing design, you MUST call:

```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  designerAnalysis: "[your markdown report]"
})
```

**IMPORTANT:**
- Your output is stored in Story.designerAnalysis field
- Full-Stack Developer will READ this field for UI implementation guidance
- Your design must align with patterns found in contextExploration
- Your flows must satisfy acceptance criteria from baAnalysis

**SUCCESS CRITERIA:**
✅ Story.designerAnalysis field contains UI/UX specifications
✅ Components follow existing design patterns from contextExploration
✅ User flows satisfy acceptance criteria from baAnalysis
✅ Accessibility requirements are documented
✅ Responsive design is considered

**STORY CONTEXT:**
- Story ID: e2708383-65b5-467b-9452-f36900f60c5e
- Story Key: ST-71
- Current Status: planning

**DATABASE FIELDS TO ACCESS:**
- READ FROM: Story.contextExploration, Story.baAnalysis (REQUIRED)
- WRITE TO: Story.designerAnalysis

**Available Tools:**
- mcp__vibestudio__get_story
- mcp__vibestudio__get_story_analysis
- mcp__vibestudio__update_story
---

**What to deliver:**
1. UI specification for test coverage display component
2. How to show positive/negative/neutral trends (+2%, -1%, 0%)
3. Visual states (loading, error, no data, success)
4. Tooltip or hover states for additional context

### Step 3.3: Record Component Complete
```javascript
mcp__vibestudio__record_component_complete({
  runId: "[runId from step 0.1]",
  componentId: "1acb6fcd-815d-4b03-aeff-63b0b522133a",
  status: "completed"
})
```

---

## PHASE 4: Software Architecture

### Step 4.1: Record Component Start
```javascript
mcp__vibestudio__record_component_start({
  runId: "[runId from step 0.1]",
  componentId: "24661ab0-8fb8-4194-870c-40de12ea77b7",  // Software Architect
  input: {
    storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
    storyKey: "ST-71"
  }
})
```

### Step 4.2: Execute Software Architect Agent

**Spawn a NEW Claude Code session** with this prompt:

---
**Software Architect Component Execution**

**INPUT INSTRUCTIONS:**
**REQUIRED FIRST STEP: Use mcp__vibestudio__get_story_analysis to retrieve all 4 analysis fields:**
- contextExploration: Codebase insights for architectural decisions (REQUIRED)
- baAnalysis: Business requirements that architecture must support (REQUIRED)
- designerAnalysis: UI/UX that architecture must enable (REQUIRED)
- architectAnalysis: Previous architectural decisions to build upon

After retrieving the analysis fields, read the story details and technical context. Your architecture MUST enable implementation of business requirements AND UI/UX designs.

**OPERATION INSTRUCTIONS:**
1. FIRST: Read and analyze ALL existing fields (contextExploration, baAnalysis, designerAnalysis, architectAnalysis) thoroughly
2. Use contextExploration to understand existing patterns and make consistent decisions
3. Design architecture that supports ALL business requirements from baAnalysis
4. Ensure technical design enables the UI/UX specified in designerAnalysis
5. Define APIs, data models, and service boundaries that satisfy both business and UX needs
6. Select technologies and patterns consistent with codebase
7. Document data flow and component interactions

**OUTPUT INSTRUCTIONS:**
**MANDATORY DATABASE WRITES:**

After completing architecture design, you MUST call update_story TWICE:

1. **Save your analysis:**
```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  architectAnalysis: "[your markdown report]"
})
```

2. **Refine complexity score:**
```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  technicalComplexity: [1-10 score]
})
```

**IMPORTANT:**
- Your output is stored in Story.architectAnalysis field
- Full-Stack Developer will READ this field for implementation guidance
- DevOps agent will reference for infrastructure needs
- The technicalComplexity score helps coordinator adjust workflow

**SUCCESS CRITERIA:**
✅ Story.architectAnalysis field contains technical architecture
✅ Story.technicalComplexity is updated with justified score
✅ Data models are clearly defined
✅ Integration points align with dependencies from contextExploration
✅ Security and performance considerations documented

**STORY CONTEXT:**
- Story ID: e2708383-65b5-467b-9452-f36900f60c5e
- Story Key: ST-71
- Current Status: planning

**DATABASE FIELDS TO ACCESS:**
- READ FROM: Story.contextExploration, Story.baAnalysis, Story.designerAnalysis (ALL REQUIRED)
- WRITE TO: Story.architectAnalysis, Story.technicalComplexity

**Available Tools:**
- mcp__vibestudio__get_story
- mcp__vibestudio__get_story_analysis
- mcp__vibestudio__update_story
---

**What to deliver:**
1. Backend API endpoint design for test coverage metrics
2. Data model for historical coverage tracking
3. Frontend state management for coverage data
4. Calculation logic for coverage trends
5. Caching strategy (if needed)

### Step 4.3: Record Component Complete
```javascript
mcp__vibestudio__record_component_complete({
  runId: "[runId from step 0.1]",
  componentId: "24661ab0-8fb8-4194-870c-40de12ea77b7",
  status: "completed"
})
```

---

## PHASE 5: Full-Stack Development

### Step 5.1: Record Component Start
```javascript
mcp__vibestudio__record_component_start({
  runId: "[runId from step 0.1]",
  componentId: "b8734895-1ecb-4f22-bba4-b9d04d66222b",  // Full-Stack Developer
  input: {
    storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
    storyKey: "ST-71"
  }
})
```

### Step 5.2: Execute Full-Stack Developer Agent

**Spawn a NEW Claude Code session** with this prompt:

---
**Full-Stack Developer Component Execution**

**INPUT INSTRUCTIONS:**
Read the story details and ALL implementation guidance. **CRITICAL: You MUST read and follow ALL 4 specialized analysis fields:**
- contextExploration: Follow existing codebase patterns and conventions (REQUIRED)
- baAnalysis: Implement ALL business requirements and acceptance criteria (REQUIRED)
- designerAnalysis: Implement the exact UI/UX as designed (REQUIRED)
- architectAnalysis: Follow the technical architecture decisions exactly (REQUIRED)

You are NOT allowed to deviate from these specifications without explicit justification.

**OPERATION INSTRUCTIONS:**
1. FIRST: Read and analyze ALL 4 fields (contextExploration, baAnalysis, designerAnalysis, architectAnalysis) THOROUGHLY - this is mandatory
2. Create implementation plan that addresses EVERY requirement from baAnalysis
3. Follow the UI/UX specifications from designerAnalysis exactly
4. Implement according to the architecture defined in architectAnalysis
5. Use patterns and conventions identified in contextExploration
6. Write clean, well-documented code that satisfies all specifications
7. Implement comprehensive tests (unit, integration, E2E as appropriate)
8. Ensure all acceptance criteria from baAnalysis are testable and tested

**OUTPUT INSTRUCTIONS:**
**MANDATORY TRACKING OPERATIONS:**

After implementation, you MUST:

1. **Link commits to story:**
```javascript
mcp__vibestudio__link_commit({
  hash: "[commit_hash]",
  projectId: "345a29ee-d6ab-477d-8079-c5dda0844d77",
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  author: "[author]",
  timestamp: "[ISO timestamp]",
  message: "[commit message]",
  files: [{ filePath: "...", locAdded: X, locDeleted: Y }]
})
```

2. **Update file-to-usecase mappings (if applicable):**
```javascript
mcp__vibestudio__update_file_mappings({
  projectId: "345a29ee-d6ab-477d-8079-c5dda0844d77",
  filePath: "[modified_file]",
  useCaseKeys: ["UC-XXX-001"]
})
```

**IMPORTANT:**
- You consume ALL previous agents' database outputs
- Your implementation must satisfy acceptance criteria from baAnalysis
- Your code must follow patterns from contextExploration
- Your architecture must match architectAnalysis specifications
- Your UI must follow designerAnalysis guidelines

**SUCCESS CRITERIA:**
✅ All acceptance criteria from baAnalysis are met
✅ Code follows patterns from contextExploration
✅ Architecture matches architectAnalysis specifications
✅ UI matches designerAnalysis guidelines
✅ Commits are linked to story
✅ Comprehensive tests are written
✅ Files are mapped to use cases

**STORY CONTEXT:**
- Story ID: e2708383-65b5-467b-9452-f36900f60c5e
- Story Key: ST-71
- Project ID: 345a29ee-d6ab-477d-8079-c5dda0844d77
- Current Status: planning

**DATABASE FIELDS TO ACCESS:**
- READ FROM: ALL 4 fields (contextExploration, baAnalysis, designerAnalysis, architectAnalysis) - MANDATORY
- WRITE TO: None (but use link_commit, update_file_mappings)

**Available Tools:**
- All standard development tools
- mcp__vibestudio__get_story
- mcp__vibestudio__get_story_analysis
- mcp__vibestudio__link_commit
- mcp__vibestudio__update_file_mappings
- Git, Docker, npm commands
---

**What to implement:**
1. Remove hardcoded "+2%" from frontend
2. Backend API endpoint for test coverage trends
3. Frontend logic to fetch and display dynamic coverage trends
4. Unit tests for calculation logic
5. Integration tests for API endpoints
6. E2E tests for UI display

### Step 5.3: Record Component Complete
```javascript
mcp__vibestudio__record_component_complete({
  runId: "[runId from step 0.1]",
  componentId: "b8734895-1ecb-4f22-bba4-b9d04d66222b",
  status: "completed",
  output: {
    filesModified: ["list of files"],
    commitsLinked: ["commit hashes"]
  }
})
```

---

## PHASE 6: QA Automation

### Step 6.1: Record Component Start
```javascript
mcp__vibestudio__record_component_start({
  runId: "[runId from step 0.1]",
  componentId: "0e54a24e-5cc8-4bef-ace8-bb33be6f1679",  // QA Automation
  input: {
    storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
    storyKey: "ST-71"
  }
})
```

### Step 6.2: Execute QA Automation Agent

**Spawn a NEW Claude Code session** with this prompt:

---
**QA Automation Component Execution**

**INPUT INSTRUCTIONS:**
**REQUIRED FIRST STEP: Use mcp__vibestudio__get_story_analysis to retrieve all 4 analysis fields:**
- contextExploration: Existing test patterns and frameworks (REQUIRED)
- baAnalysis: Acceptance criteria to test (REQUIRED)
- designerAnalysis: UI/UX flows and interactions to test (REQUIRED)
- architectAnalysis: Architectural boundaries and integrations to test (REQUIRED)

After retrieving the analysis fields, read the story details and testing requirements. Your tests must provide complete coverage of all specifications.

**OPERATION INSTRUCTIONS:**
1. FIRST: Read and analyze ALL 4 fields (contextExploration, baAnalysis, designerAnalysis, architectAnalysis) THOROUGHLY
2. Create test plan that covers EVERY acceptance criterion from baAnalysis
3. Write unit tests for business logic as specified in baAnalysis
4. Create integration tests for architectural boundaries from architectAnalysis
5. Implement E2E tests for user flows defined in designerAnalysis
6. Follow existing test patterns discovered in contextExploration
7. Test edge cases explicitly mentioned in baAnalysis
8. Validate UI behavior against designerAnalysis specifications

**OUTPUT INSTRUCTIONS:**
**MANDATORY TRACKING:**

After completing QA, you MUST:

1. **Store test artifacts:**
```javascript
mcp__vibestudio__store_artifact({
  runId: "[runId from step 0.1]",
  componentId: "0e54a24e-5cc8-4bef-ace8-bb33be6f1679",
  artifactType: "test_results",
  data: { /* test results summary */ },
  metadata: { format: "json" }
})
```

2. **Update story status:**
```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  status: "qa"  // or "blocked" if critical bugs found
})
```

**IMPORTANT:**
- Your tests validate acceptance criteria from baAnalysis
- Your test patterns match conventions from contextExploration
- Your integration tests cover points from architectAnalysis
- ALL acceptance criteria must have corresponding tests

**SUCCESS CRITERIA:**
✅ Every acceptance criterion from baAnalysis has a test
✅ Test patterns follow conventions from contextExploration
✅ Edge cases from baAnalysis are tested
✅ Test coverage meets project standards
✅ All tests pass (or bugs are documented)

**STORY CONTEXT:**
- Story ID: e2708383-65b5-467b-9452-f36900f60c5e
- Story Key: ST-71
- Run ID: [runId from step 0.1]
- Current Status: planning

**DATABASE FIELDS TO ACCESS:**
- READ FROM: ALL 4 fields (contextExploration, baAnalysis, designerAnalysis, architectAnalysis)
- WRITE TO: Story.status (via update_story)

**Available Tools:**
- mcp__vibestudio__get_story
- mcp__vibestudio__get_story_analysis
- mcp__vibestudio__update_story
- mcp__vibestudio__store_artifact
- Test frameworks (Jest, Playwright, etc.)
---

**What to validate:**
1. All acceptance criteria have tests
2. No hardcoded values remain
3. Coverage trends calculate correctly
4. UI displays trends properly
5. Edge cases are handled (no data, zero change, etc.)

### Step 6.3: Record Component Complete
```javascript
mcp__vibestudio__record_component_complete({
  runId: "[runId from step 0.1]",
  componentId: "0e54a24e-5cc8-4bef-ace8-bb33be6f1679",
  status: "completed"
})
```

---

## PHASE 7: Finalization (Coordinator/PM Session)

### Step 7.1: Update Workflow Status to Completed
```javascript
mcp__vibestudio__update_workflow_status({
  runId: "[runId from step 0.1]",
  status: "completed",
  summary: "ST-71 successfully implemented: Test coverage display now dynamically calculated from real data. All acceptance criteria met."
})
```

### Step 7.2: Update Story Status
```javascript
mcp__vibestudio__update_story({
  storyId: "e2708383-65b5-467b-9452-f36900f60c5e",
  status: "done"
})
```

### Step 7.3: Verify Workflow Metrics
```javascript
mcp__vibestudio__get_workflow_run_results({
  runId: "[runId from step 0.1]",
  includeComponentDetails: true,
  includeArtifacts: true
})
```

---

## KEY POINTS FOR EXECUTION

### Database-Driven Communication (CRITICAL!)
- **NO temporary files** between components
- **ALL information exchange** via Story database fields:
  - `Story.contextExploration` ← Context Explore writes, all others read
  - `Story.baAnalysis` ← BA writes, Designer/Architect/Developer read
  - `Story.designerAnalysis` ← Designer writes, Developer reads
  - `Story.architectAnalysis` ← Architect writes, Developer reads

### Execution Pattern for Each Component
1. **BEFORE spawning:** Call `record_component_start`
2. **SPAWN agent** with exact component instructions + database field access info
3. **AGENT MUST:**
   - Read from assigned database fields using `get_story_analysis`
   - Execute component logic
   - Write results to assigned database field using `update_story`
4. **AFTER completion:** Call `record_component_complete`

### Component IDs Reference
- Context Explore: `89e6cc43-7bcb-41aa-9173-3dcd1c9cfa46`
- Business Analyst: `42d40d84-83e0-436d-a813-00bea87ff98b`
- Software Architect: `24661ab0-8fb8-4194-870c-40de12ea77b7`
- UI/UX Designer: `1acb6fcd-815d-4b03-aeff-63b0b522133a`
- Full-Stack Developer: `b8734895-1ecb-4f22-bba4-b9d04d66222b`
- QA Automation: `0e54a24e-5cc8-4bef-ace8-bb33be6f1679`
- DevOps Engineer: `cfab520b-7f26-417c-9cb9-be3e8b91ff0f` (not needed for this story)

### Workflow IDs Reference
- Workflow: `f2279312-e340-409a-b317-0d4886a868ea`
- Coordinator: `543cb8d3-ea63-47fb-b347-e36f1f574169`

### Story IDs Reference
- Story: `e2708383-65b5-467b-9452-f36900f60c5e`
- Project: `345a29ee-d6ab-477d-8079-c5dda0844d77`
- Epic: `9ecdbb94-28b7-4358-94f0-a7280f466227`

---

## MONITORING CHECKLIST (For You)

As each component completes, verify:

- [ ] Component called `record_component_start` BEFORE execution
- [ ] Component called `get_story_analysis` to read database fields
- [ ] Component called `update_story` to write its analysis
- [ ] Component called `record_component_complete` AFTER execution
- [ ] Database fields contain the expected markdown reports
- [ ] No temporary files were created for inter-agent communication
- [ ] Component followed the exact instructions from its definition

---

## Expected Outcome

After completing all phases:

1. ✅ ST-71 fully analyzed and implemented
2. ✅ Test coverage display is dynamically calculated (not hardcoded)
3. ✅ All 6 components tracked with metrics
4. ✅ All analysis stored in database fields
5. ✅ Workflow run has complete metrics and artifacts
6. ✅ Story status = "done"
7. ✅ You have validated each step for correctness

---

## Questions to Ask During Execution

As you monitor the separate Claude session:

1. **After Context Explore:** Did it find the hardcoded "+2%" value?
2. **After BA:** Are acceptance criteria clear about dynamic calculation?
3. **After Designer:** Is the UI design consistent with existing patterns?
4. **After Architect:** Is the API design RESTful and cacheable?
5. **After Developer:** Were commits linked? Are tests comprehensive?
6. **After QA:** Did all tests pass? Is coverage sufficient?
