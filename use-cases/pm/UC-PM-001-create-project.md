# UC-PM-001: Create New Project

## Actor
Project Manager (PM)

## Preconditions
- PM is authenticated in the AI Studio web UI
- PM has necessary permissions to create projects

## Main Flow
1. PM navigates to Projects dashboard
2. PM clicks "Create New Project" button
3. System displays project creation form
4. PM enters project details:
   - Project name (required, unique)
   - Description
   - Initial status (defaults to "active")
5. PM submits the form
6. System validates the input
7. System creates the project record with generated UUID
8. System creates default epic and story templates
9. System displays success message with project ID
10. System redirects PM to the newly created project dashboard

## Postconditions
- New project exists in the database
- Project appears in PM's project list
- Audit log records project creation with PM as author
- Project is ready for epic and story creation

## Alternative Flows

### 3a. Duplicate project name
- At step 6, system detects duplicate name
- System displays error message
- PM returns to step 4 to modify name

## Business Rules
- Project names must be unique across the system
- Project ID is auto-generated UUID
- Default status is "active"
- Creation timestamp is automatically recorded

## Related Use Cases
- UC-PM-002: Configure Project Settings
- UC-PM-003: Create Epic
- UC-ADMIN-001: Archive Project

## Acceptance Criteria
- Project is created with unique ID
- All required fields are validated
- Audit trail is created
- PM can immediately start creating epics
