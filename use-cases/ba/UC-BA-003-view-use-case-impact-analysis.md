# UC-BA-003: View Use Case Impact Analysis

## Actor
Business Analyst (BA)

## Preconditions
- BA is authenticated
- Use cases exist in project
- Some use cases are linked to stories and commits

## Main Flow
1. BA navigates to Use Case Library
2. BA selects a specific use case
3. System displays Use Case Impact Dashboard with panels:

   **Use Case Details:**
   - Current version with full content
   - Status and metadata
   - Version history

   **Impact Map:**
   - Visual dependency graph showing:
     - Related use cases
     - Linked stories (with relationship type)
     - Affected code files
     - Linked commits
     - Related defects

   **Change History:**
   - Timeline of all versions
   - Who changed what and when
   - Linked stories that triggered changes
   - Diff view between versions

   **Code Linkage:**
   - Files implementing this use case
   - Commits that modified functionality
   - Test cases covering this use case
   - Code coverage percentage

   **Quality Metrics:**
   - Number of defects related to this use case
   - Defect severity breakdown
   - Time in each status
   - Rework frequency

4. BA can filter impact view by:
   - Date range
   - Change type (new, modified, deprecated)
   - Story status
   - Defect severity

5. BA can perform actions:
   - View detailed diff between any two versions
   - Navigate to linked stories
   - Jump to related code files
   - Export impact report as PDF
   - Create new story to update use case

## Postconditions
- BA has complete visibility into use case lifecycle
- Impact analysis data is available for decision making
- Navigation to related items is seamless

## Alternative Flows

### 3a. Use case never implemented
- At step 3, system shows use case has no linked stories/commits
- System displays "Not Yet Implemented" indicator
- System shows option to "Create Implementation Story"

### 3b. Multiple active stories affecting same use case
- At step 3, system detects concurrent modifications
- System highlights potential conflicts
- BA can view all active stories
- BA can coordinate with PMs to resolve conflicts

### 5a. Create story from use case analysis
- At step 5, BA clicks "Create Story to Update"
- System opens story creation with:
  - Pre-linked use case
  - Auto-populated description referencing use case
  - Suggested title based on needed changes
- BA completes story creation
- System returns to impact view

### 4a. View regression risk
- At step 4, BA clicks "Show Regression Risk"
- System highlights:
  - Use cases with recent defects
  - Use cases with high code churn
  - Use cases with low test coverage
  - Use cases modified by multiple concurrent stories
- Risk score displayed for each

## Business Rules
- Impact analysis updates in real-time as commits/stories are linked
- Version diffs show both structural and content changes
- Code linkage is automatic based on commit messages with story IDs
- Test coverage data comes from CI integration
- Access control applies - BA sees only permitted use cases

## Related Use Cases
- UC-BA-002: Create Use Case
- UC-BA-004: Update Use Case Version
- UC-BA-001: Analyze Story Requirements
- UC-DEV-003: Link Commit to Story
- UC-QA-002: Map Tests to Use Cases

## Acceptance Criteria
- Impact map accurately shows all relationships
- Version history is complete and browseable
- Code linkage is automatic and accurate
- Diff views clearly show changes
- Regression risk indicators are helpful
- Navigation to related items works seamlessly
- Export functionality produces useful reports
