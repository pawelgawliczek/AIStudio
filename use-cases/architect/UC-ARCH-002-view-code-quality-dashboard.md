# UC-ARCH-002: View Code Quality Dashboard

## Actor
Architect

## Preconditions
- Architect is authenticated
- Project exists with committed code
- Background metrics collection is enabled
- Code analysis workers have processed repository

## Main Flow
1. Architect navigates to Code Quality Dashboard for project
2. System displays multi-level quality overview:

   **Project-Level Metrics:**
   - Overall code health score (0-100)
   - Total lines of code by language
   - Test coverage percentage
   - Technical debt ratio
   - Trend charts (week/month/quarter)

   **Layer-Level Metrics:**
   (Layers: frontend, backend, infrastructure, tests)
   - LOC per layer
   - Complexity score per layer
   - Churn rate per layer
   - Coverage per layer
   - Defect count per layer

   **Component-Level Metrics:**
   (Components: auth, billing, API gateway, search, etc.)
   - Per-component health score
   - Ownership (most active contributors)
   - Hotspot indicator (high complexity + high churn)
   - Dependency map

   **File-Level Hotspots:**
   - Top 20 files by risk score
   - Risk = complexity × churn × (1 - coverage)
   - Sorting options: complexity, churn, coverage, risk

   **Code Smells & Issues:**
   - Duplication percentage
   - Security vulnerabilities (from static analysis)
   - Maintainability issues
   - Grouped by severity (critical/high/medium/low)

3. Architect can filter dashboard by:
   - Time range
   - Layer
   - Component
   - Language
   - Epic or story

4. Architect can drill down:
   - Click layer → see all components in that layer
   - Click component → see all files in component
   - Click file → see detailed metrics and recent commits
   - Click metric → see historical trend

5. Architect can perform actions:
   - Export quality report as PDF
   - Create refactoring story for hotspot
   - Set quality gates for component
   - Subscribe to alerts for quality degradation

6. System provides AI-powered insights:
   - "Component X has 3× higher churn this month"
   - "Test coverage dropped 5% in backend layer"
   - "5 files have critical security issues"
   - "Authentication module is a hotspot - consider refactoring"

## Postconditions
- Architect has current view of code quality
- Quality trends are visible
- Hotspots and risks are identified
- Actions can be taken based on insights

## Alternative Flows

### 4a. Drill down to file details
- At step 4, Architect clicks specific file
- System displays file quality panel:
  - Full file path and LOC
  - Cyclomatic complexity
  - Cognitive complexity
  - Maintainability index
  - Code coverage %
  - Duplication instances
  - Last 10 commits affecting this file
  - Stories/subtasks that touched this file
  - Related defects
- Architect can view file source with metrics highlighted
- Architect can create refactoring story from this view

### 5a. Create refactoring story from hotspot
- At step 5, Architect clicks "Create Refactoring Story" for hotspot
- System pre-fills story with:
  - Type: "refactor"
  - Title: "Refactor [component/file]"
  - Description with current metrics and target metrics
  - Linked files and components
  - Technical complexity estimate based on current metrics
- Architect reviews and submits
- Story created and appears in backlog

### 5b. Set quality gates
- At step 5, Architect clicks "Set Quality Gate" for component
- System shows quality gate configuration:
  - Max complexity threshold
  - Min coverage threshold
  - Max duplication percentage
  - Block commits/PRs if violated (yes/no)
- Architect configures and saves
- Gate applied to CI/CD pipeline

### 6a. View comparative analysis
- At step 6, Architect clicks "Compare Periods"
- System shows side-by-side comparison of two time periods
- Delta metrics highlighted (improvements/regressions)
- Can compare:
  - Before/after major refactoring
  - Sprint-over-sprint
  - Before/after framework change

## Business Rules
- Metrics update every 6 hours via background workers
- Complexity calculated using standard algorithms (cyclomatic, cognitive)
- Churn = number of times file modified in rolling 90-day window
- Hotspot score = (complexity / 10) × churn × (1 - coverage)
- Access control: Architect sees all, Devs see assigned components
- Historical data retained for 12 months

## Technical Implementation Notes
- Background workers process:
  - Git diffs per commit
  - Static analysis via tools (SonarQube, ESLint, Pylint, etc.)
  - Test coverage from CI reports
  - Complexity via language-specific parsers
- Data stored per file, aggregated to component/layer/project
- MCP tool `get_architect_insights({ project_id, level, limit })` exposes this data

## Related Use Cases
- UC-ARCH-001: Assess Technical Complexity
- UC-ARCH-003: Recommend Refactoring
- UC-PM-003: Create Story
- UC-DEV-003: Link Commit to Story
- UC-METRICS-004: View Code Quality Trends

## Acceptance Criteria
- Dashboard loads within 3 seconds
- All metrics are accurate based on latest code
- Drill-down navigation is smooth
- Hotspot identification is actionable
- Trend charts show meaningful patterns
- AI insights are relevant and helpful
- Export functionality produces useful reports
- Quality gates can be enforced in CI/CD
