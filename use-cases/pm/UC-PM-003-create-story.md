# UC-PM-003: Create Story

## Actor
Project Manager (PM)

## Preconditions
- PM is authenticated
- Target project exists
- At least one epic exists (optional - stories can be created without epics)

## Main Flow
1. PM navigates to project backlog or epic view
2. PM clicks "Create Story" button
3. System displays story creation form with tabs: Basic Info, Complexity, Assignment
4. **Basic Info tab:**
   - Story key (auto-generated, e.g., ST-1)
   - Type (feature, bug, defect, chore, spike)
   - Title (required)
   - Description (required, rich text with markdown support)
   - Epic (dropdown, optional)
   - Status (defaults to "planning")
5. **Complexity tab:**
   - Business Impact (1-5, required before BA phase)
   - Business Complexity (1-5, required before BA phase)
   - Technical Complexity (1-5, required before Architect phase)
   - Estimated Token Cost (XS/S/M/L/XL or numeric)
6. **Assignment tab:**
   - Owner (human or agent, optional)
   - Framework (which agentic framework can work on this)
7. PM saves story as draft or submits for planning
8. System validates required fields based on status
9. System creates story with UUID
10. System links story to project and epic (if specified)
11. System displays success message
12. System redirects to story detail view

## Postconditions
- Story is created and linked to project
- Story appears in backlog and relevant epic
- Audit log records story creation
- Story is ready for BA analysis (if complexity fields are set)

## Alternative Flows

### 7a. Save as draft
- PM selects "Save as Draft" at step 7
- System skips complexity validation
- Story is created with status "draft"
- PM can return to edit later

### 7b. Missing required complexity fields
- At step 8, if status is "planning" or beyond, system checks complexity fields
- If business_impact or business_complexity missing, system shows error
- PM returns to Complexity tab to complete

### 9a. Story creation from template
- At step 2, PM selects "Create from Template"
- System pre-fills fields from selected template
- PM proceeds from step 4 with pre-filled data

## Business Rules
- Story keys are unique within project
- Stories without epics are allowed (orphan stories)
- Complexity fields mandatory before moving to BA phase:
  - business_impact required before "analysis" status
  - business_complexity required before "analysis" status
  - technical_complexity required before "architecture" status
- Estimated token cost required before agent assignment

## Related Use Cases
- UC-PM-004: Assign Story Priority
- UC-BA-001: Analyze Story Requirements
- UC-ARCH-001: Assess Technical Complexity
- UC-DEV-001: Implement Story

## Acceptance Criteria
- Story is created with all required fields
- Complexity validation enforces data quality
- Story appears in correct epic and project views
- Story can be assigned to agents or humans
- Audit trail captures creation details
