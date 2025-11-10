# UC-ARCH-001: Assess Technical Complexity

## Actor
Architect

## Preconditions
- Architect is authenticated
- Story exists with status "analysis_complete"
- BA analysis is complete with use case links
- Business complexity and business impact are set

## Main Flow
1. Architect navigates to stories pending architecture review
2. Architect selects story requiring technical assessment
3. System displays Architecture Assessment panel with:
   - Story description and acceptance criteria
   - BA analysis with linked use cases
   - Business complexity and impact scores
   - Related stories and dependencies
   - Current codebase context (affected components)

4. Architect reviews and analyzes:
   - Code areas to be modified
   - New components needed
   - Integration points
   - Technical risks
   - Architectural patterns required

5. Architect accesses MCP tool: `get_architect_insights({ project_id })`
6. System returns current code metrics for potentially affected areas:
   - File-level complexity scores
   - Hotspot analysis (complexity × churn)
   - Code coverage percentages
   - Technical debt indicators
   - Component dependency graph

7. Architect uses insights to fill Architecture Assessment form:
   - **Technical Complexity:** 1-5 scale
     - 1: Simple change, single component, no new patterns
     - 3: Moderate, multiple components, some new patterns
     - 5: Complex, architectural changes, cross-cutting concerns
   - **Affected Components:**
     - List components/layers (frontend, backend, database, etc.)
   - **Architectural Approach:**
     - Design patterns to use
     - New abstractions needed
     - Integration strategy
   - **Technical Risks:**
     - Performance concerns
     - Scalability issues
     - Security considerations
     - Migration complexity
   - **Dependencies:**
     - Link dependent stories
     - External dependencies
     - Library/framework requirements

8. Architect determines if story needs decomposition:
   - If complexity > 4, consider splitting into subtasks
   - If multiple unrelated components, suggest story split
   - If shared dependencies found, propose grouping stories

9. Architect saves assessment
10. System validates required fields
11. System updates story with:
    - technical_complexity score
    - Architecture assessment details
    - Component tags
12. System updates story status to "architecture_complete"
13. System triggers notification to PM and assigned framework
14. Story is ready for implementation

## Postconditions
- Story has technical complexity assessment
- Architecture guidance is documented
- Components and risks are identified
- Story is ready for agent/developer assignment
- Audit log records architectural assessment
- Metrics system can now use technical_complexity for tracking

## Alternative Flows

### 8a. Story requires decomposition
- At step 8, Architect determines story is too complex
- Architect clicks "Decompose into Subtasks"
- System opens subtask creation wizard
- Architect creates multiple subtasks:
  - Each with layer (frontend/backend/database/test)
  - Each with component assignment
  - Each with estimated complexity
- System links subtasks to parent story
- Architect proceeds to step 9

### 8b. Suggest story merge
- At step 8, Architect identifies multiple stories with shared dependencies
- Architect uses MCP tool: `suggest_story_grouping({ story_ids })`
- System analyzes dependencies and proposes merge or sequence
- Architect documents recommendation for PM
- Proceeds to step 9

### 8c. Architecture spike needed
- At step 7, Architect identifies unknowns requiring investigation
- Architect clicks "Create Architecture Spike"
- System creates new story of type "spike"
- Architect documents investigation questions
- Original story blocked until spike complete

### 10a. Incomplete assessment
- At step 10, required fields missing
- System highlights missing sections
- Architect returns to step 7

## Business Rules
- Technical complexity required before story can be assigned to agent
- Complexity scale: 1 (trivial) to 5 (architectural change)
- Stories with complexity >= 4 should be reviewed for decomposition
- Architecture insights must reference current code metrics
- Component tags used for tracking metrics per layer

## Related Use Cases
- UC-BA-001: Analyze Story Requirements
- UC-ARCH-002: View Code Quality Dashboard
- UC-ARCH-003: Recommend Refactoring
- UC-DEV-001: Implement Story
- UC-PM-004: Assign Story to Framework

## Acceptance Criteria
- Technical complexity score is accurate and justified
- Affected components are clearly identified
- Architectural approach is documented
- Risks are highlighted with mitigation strategies
- Story decomposition recommendations are actionable
- Assessment uses current code metrics from MCP tools
- Notification triggers work correctly
