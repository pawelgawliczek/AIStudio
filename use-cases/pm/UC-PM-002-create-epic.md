# UC-PM-002: Create Epic

## Actor
Project Manager (PM)

## Preconditions
- PM is authenticated
- At least one active project exists
- PM has access to the target project

## Main Flow
1. PM navigates to project backlog view
2. PM clicks "Create Epic" button
3. System displays epic creation form
4. PM enters epic details:
   - Epic key (auto-generated or custom, e.g., EP-1)
   - Title (required)
   - Description (rich text)
   - Priority (1-5, default 3)
   - Status (defaults to "planning")
5. PM optionally assigns epic owner
6. PM submits the form
7. System validates input
8. System creates epic with generated UUID
9. System links epic to project
10. System displays success message
11. System redirects to epic detail view

## Postconditions
- Epic is created and linked to project
- Epic appears in project backlog
- Audit log records epic creation
- Epic is available for story creation

## Alternative Flows

### 3a. Custom epic key conflict
- At step 7, system detects duplicate key within project
- System displays error and suggests next available key
- PM returns to step 4

### 6a. Cancel epic creation
- PM clicks "Cancel" at step 6
- System discards form data
- PM returns to backlog view

## Business Rules
- Epic keys must be unique within a project
- Epic key format: [PREFIX]-[NUMBER] (e.g., EP-1, EPIC-42)
- Priority range: 1 (lowest) to 5 (highest)
- Default status is "planning"

## Related Use Cases
- UC-PM-003: Create Story
- UC-PM-004: Set Epic Priority
- UC-PM-010: View Epic Roadmap

## Acceptance Criteria
- Epic is created with unique key within project
- Epic is immediately available for story assignment
- PM can view epic in backlog and roadmap views
- Audit trail records creation with timestamp and author
