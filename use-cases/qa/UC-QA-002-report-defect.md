# UC-QA-002: Report and Track Defect

## Actor
QA Tester, Developer, PM, or any stakeholder

## Preconditions
- User is authenticated
- A defect has been discovered
- Original story exists (the story that introduced the defect)

## Main Flow
1. User discovers a defect during:
   - QA testing (discovery_stage: "qa")
   - UAT (discovery_stage: "uat")
   - Production (discovery_stage: "production")
   - Development (discovery_stage: "unit_test" or "integration_test")

2. User clicks "Report Defect" from story view or creates new story with type "defect"
3. System displays Defect Report form:

   **Basic Info:**
   - Title (required) - concise description
   - Description (required) - detailed steps to reproduce
   - Type: "defect" (auto-set)

   **Defect Classification:**
   - Origin story ID (which story introduced this defect?)
   - Origin stage (enum: dev, arch, ba, unknown)
   - Discovery stage (enum: unit_test, integration_test, qa, uat, production)
   - Severity (enum: low, medium, high, critical)
   - Impact (1-5, business impact)

   **Technical Details:**
   - Violated use cases (select from list)
   - Affected components/files
   - Environment (dev, staging, prod)
   - Browser/OS (if applicable)

   **Evidence:**
   - Steps to reproduce (numbered list)
   - Expected behavior
   - Actual behavior
   - Screenshots, logs, recordings
   - Test data used

4. User fills in all required fields:
   - Links to origin story (if known)
   - Selects violated use cases
   - Sets severity based on impact:
     - **Critical:** System down, data loss, security breach
     - **High:** Major feature broken, affects many users
     - **Medium:** Feature partially broken, workaround exists
     - **Low:** Minor issue, cosmetic, rare edge case

5. User submits defect
6. System validates required fields
7. System calls MCP: `report_defect({ story_id, origin_story_id, origin_stage, discovery_stage, severity, violated_use_cases })`
8. System creates defect record:
   - Creates story with type="defect"
   - Links to origin story and epic
   - Links to violated use cases
   - Stores discovery and origin stage for leakage tracking
   - Auto-calculates priority based on severity + impact

9. System updates metrics:
   - Increments defect count for origin story
   - Updates defect leakage for origin framework
   - Links defect to framework that produced origin story
   - Updates use case quality metrics

10. System triggers notifications:
    - If critical/high: immediate notification to PM, Architect, origin developer
    - If medium/low: standard notification to origin developer
    - If production: escalation to on-call team

11. System displays defect ID and tracking URL
12. Defect appears in:
    - Origin story's defect list
    - Project defect backlog
    - Framework's quality metrics
    - Use case impact view

## Postconditions
- Defect is created and tracked
- Defect is linked to origin story and use cases
- Metrics updated for defect leakage tracking
- Responsible parties notified
- Defect appears in relevant dashboards
- Audit log records defect creation

## Alternative Flows

### 4a. Origin story unknown
- At step 4, user doesn't know which story caused the defect
- User selects "Unknown origin"
- System sets origin_stage: "unknown"
- Architect or PM can investigate and link later
- System uses file history to suggest likely origin stories

### 4b. Auto-suggest violated use cases
- At step 4, user clicks "Auto-suggest use cases"
- If affected files are known:
  - System queries: file → commits → stories → use cases
  - Suggests likely violated use cases
- User reviews and confirms

### 9a. Duplicate defect detection
- At step 9, system detects similar existing defect
- Uses text similarity on title/description
- Displays: "⚠️  Similar defect found: DEFECT-42. Is this a duplicate?"
- User can:
  - Link as duplicate → increment vote/priority on existing
  - Proceed with new defect

### 10a. Production defect escalation
- At step 10, discovery_stage = "production"
- System triggers high-priority workflow:
  - Creates incident record
  - Notifies on-call team via configured channels (Slack, PagerDuty)
  - Auto-sets priority to highest
  - Suggests rollback if recent deployment

### 7a. Defect for missing functionality (not a bug)
- At step 7, user realizes this is not a defect but missing feature
- User changes type from "defect" to "feature"
- No origin story linkage
- Proceeds as feature request

## Business Rules
- Defects are special story type with additional fields
- Defect leakage = defects found in later stage ÷ total defects
  - Example: Found in QA (good), Found in Production (leaked)
- Origin_stage vs Discovery_stage determines leakage:
  - origin_stage: "dev", discovery_stage: "qa" → no leakage (caught early)
  - origin_stage: "dev", discovery_stage: "production" → leakage (escaped to prod)
- Severity determines priority and urgency:
  - Critical: fix immediately, block deployment
  - High: fix in current sprint
  - Medium: fix in next sprint
  - Low: backlog
- Production defects always trigger escalation
- Defects count against origin framework's quality metrics

## Metrics Impact
This use case directly feeds into:
- **Defect leakage rate:** (production + uat defects) ÷ total defects
- **Framework quality:** defects per story by framework
- **Stage effectiveness:** defects caught at each stage
- **Use case quality:** defects per use case
- **Component quality:** defects per component

## Related Use Cases
- UC-QA-001: Test Story Implementation
- UC-BA-003: View Use Case Impact Analysis
- UC-METRICS-002: View Defect Leakage Report
- UC-DEV-002: Implement Story
- UC-PM-003: Create Story

## Acceptance Criteria
- Defect is created with all required metadata
- Origin story linkage works correctly
- Violated use cases are properly linked
- Severity is accurately classified
- Discovery and origin stages are recorded
- Metrics update correctly for defect leakage tracking
- Notifications trigger based on severity and discovery stage
- Production defects escalate immediately
- Duplicate detection prevents redundant reports
- Evidence (screenshots, logs) is properly attached
- Defect appears in all relevant views
