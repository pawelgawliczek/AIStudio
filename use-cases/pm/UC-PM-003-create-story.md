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
3. System displays story creation form with tabs: Basic Info, Organization, Complexity, Assignment
4. **Basic Info tab:**
   - Story key (auto-generated, e.g., ST-1)
   - Type (feature, bug, defect, chore, spike)
   - Title (required)
   - Description (required, rich text with markdown support)
   - Epic (dropdown, optional)
   - Status (defaults to "planning")
5. **Organization tab:**
   - Layers (multi-select: Frontend, Backend, Database, etc.) - required
   - Components (multi-select: Authentication, Billing, etc.) - required
   - System auto-suggests based on title/description keywords
6. **Complexity tab:**
   - Business Impact (1-5, set by PM initially)
   - Business Complexity (1-5, **filled by BA agent** during analysis phase)
   - Architect Complexity (1-5, **filled by Architect agent** during architecture phase)
   - Estimated Token Cost (**filled by PM agent**, numeric or XS/S/M/L/XL)
7. **Analysis & Design tab** (populated later by agents):
   - BA Analysis (rich text, **filled by BA agent**)
   - Architect Analysis (rich text, **filled by Architect agent**)
   - Design Documents (file uploads: wireframes, diagrams, etc.)
8. **Assignment tab:**
   - Owner (human or agent, optional)
   - Framework (which agentic framework can work on this)
9. PM saves story as draft or submits for planning
10. System validates required fields based on status
11. System creates story with UUID
12. System links story to project, epic, layers, and components
13. System displays success message
14. System redirects to story detail view

## Postconditions
- Story is created and linked to project
- Story appears in backlog and relevant epic
- Audit log records story creation
- Story is ready for BA analysis (if complexity fields are set)

## Alternative Flows

### 9a. Save as draft
- PM selects "Save as Draft" at step 9
- System skips validation (allows missing layer/component)
- Story is created with status "draft"
- PM can return to edit later

### 10a. Missing required layer/component fields
- At step 10, if story is not draft, system checks layer/component
- If no layers or components selected, system shows error
- PM returns to Organization tab to select at least one of each

### 10b. Missing complexity fields for later phases
- At step 10, if status is "analysis" or beyond, system checks BA complexity
- If BA complexity missing, shows error
- Similarly for Architect complexity when moving to "architecture" status

### 9b. Story creation from template
- At step 2, PM selects "Create from Template"
- System pre-fills fields from selected template including layer/component
- PM proceeds from step 4 with pre-filled data

### 5a. Auto-suggest components
- At step 5, system analyzes title and description
- Suggests components based on keywords (e.g., "password" → Authentication)
- PM can accept suggestions or manually select

## Business Rules
- Story keys are unique within project
- Stories without epics are allowed (orphan stories)
- **Layer and Component required** for non-draft stories (at least one of each)
- Complexity fields have specific ownership:
  - **business_impact**: Set by PM initially
  - **business_complexity**: Filled by BA agent during analysis phase
  - **architect_complexity**: Filled by Architect agent during architecture phase
  - **estimated_tokens**: Filled by PM agent
- Field requirements by status:
  - "planning" status: requires layers + components
  - "analysis" status: requires BA complexity (filled by BA)
  - "architecture" status: requires Architect complexity (filled by Architect)
  - "impl" status: requires all complexity fields + framework assignment
- **BA Analysis** and **Architect Analysis** fields filled by respective agents
- **Design documents** can be uploaded at any time

## Related Use Cases
- UC-ADMIN-003: Manage Layers and Components (layer/component selection)
- UC-PM-004: Assign Story Priority
- UC-PM-007: JIRA-like Planning View (drag-and-drop interface)
- UC-BA-001: Analyze Story Requirements (fills BA complexity and analysis)
- UC-ARCH-001: Assess Technical Complexity (fills Architect complexity and analysis)
- UC-DEV-001: Implement Story

## Acceptance Criteria
- Story is created with all required fields including layers and components
- Auto-suggestion helps select relevant components
- Complexity fields clearly indicate which agent fills them
- BA Analysis and Architect Analysis tabs exist (populated later by agents)
- Design document upload works correctly
- Validation enforces layer/component requirement for non-draft stories
- Story appears in correct epic and project views
- Story appears in component-filtered views
- Story can be assigned to agents or humans
- Audit trail captures creation details
