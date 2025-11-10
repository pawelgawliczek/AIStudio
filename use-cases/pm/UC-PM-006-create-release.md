# UC-PM-006: Create and Manage Release

## Actor
Project Manager (PM)

## Preconditions
- PM is authenticated
- Project exists with completed or in-progress stories
- PM has release management permissions

## Main Flow
1. PM navigates to Releases view in project
2. PM clicks "Create Release" button
3. System displays release creation form
4. PM enters release details:
   - Release name (e.g., "v1.2.0", "Sprint 5")
   - Description
   - Start date
   - Target release date
   - Status (defaults to "planned")
5. PM selects stories/epics to include:
   - System shows filterable list of stories
   - PM can filter by epic, status, priority, complexity
   - PM selects stories via checkboxes or drag-and-drop
6. System calculates release estimates:
   - Total stories: feature/bug/chore breakdown
   - Estimated token cost (sum of story estimates)
   - Estimated completion date based on velocity
   - Risk assessment based on complexity distribution
7. PM reviews estimates and adjusts scope if needed
8. PM submits release
9. System creates release record
10. System links selected stories to release
11. System displays release roadmap view
12. System creates release dashboard

## Postconditions
- Release is created and visible in release list
- Stories are linked to release
- Release dashboard is accessible
- Audit log records release creation
- Release appears in project roadmap

## Alternative Flows

### 5a. Auto-suggest stories for release
- At step 5, PM clicks "Auto-suggest"
- System shows stories based on:
  - Priority (highest first)
  - Dependencies
  - Estimated capacity
- PM reviews and adjusts selection

### 6a. Capacity warning
- At step 6, system detects estimated cost exceeds typical capacity
- System displays warning with recommendation
- PM can:
  - Reduce scope
  - Extend release date
  - Proceed with warning acknowledged

### 10a. Story already in another active release
- At step 9, system detects story conflict
- System displays warning with conflicting release
- PM chooses to:
  - Remove from other release
  - Skip this story
  - Cancel operation

## Business Rules
- Release names should be unique within project
- Stories can belong to maximum one active release
- Completed stories can be added to releases retroactively
- Release dates can be adjusted until status = "released"
- Token estimates aggregate from story-level estimates

## Related Use Cases
- UC-PM-003: Create Story
- UC-PM-007: Track Release Progress
- UC-PM-008: Close Release
- UC-METRICS-003: View Release Metrics

## Acceptance Criteria
- Release is created with accurate estimates
- Story selection interface is intuitive
- Capacity warnings prevent over-commitment
- Release dashboard shows real-time progress
- Dependencies between stories are visualized
