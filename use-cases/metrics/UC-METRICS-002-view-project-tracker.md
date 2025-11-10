# UC-METRICS-002: View Project Tracker Dashboard

## Actor
PM, Stakeholder, Team Member

## Preconditions
- User is authenticated
- Project exists with epics and stories
- Some stories have been worked on or completed

## Main Flow
1. User navigates to "Tracker" tab in web UI (https://studio.example.com/)
2. System displays Project Tracker Dashboard with sections:

   **A. Project Overview (Top Panel)**
   - Project name and description
   - Status: Active/On Hold/Archived
   - Date range selector (current sprint, current month, all time)
   - Quick stats cards:
     - Total epics: 12 (8 active, 4 done)
     - Total stories: 156 (42 done, 38 in progress, 76 backlog)
     - Velocity: 12 stories/week
     - Health score: 85/100 (based on velocity, quality, blockers)

   **B. Epic Progress View**
   (Interactive board/table view toggle)

   **Board View:**
   - Columns: Planning | In Progress | Review | Done
   - Each column shows epic cards with:
     - Epic key and title
     - Progress bar (stories done / total stories)
     - Story breakdown by status (mini chart)
     - Priority indicator
     - Owner avatar
     - Blocked indicator (if any story blocked)

   **Table View:**
   | Epic | Priority | Stories | Progress | Status | Owner | Est. Completion |
   |------|----------|---------|----------|--------|-------|----------------|
   | EP-1: User Auth | 5 | 8/12 done | ████░░ 67% | In Progress | Alice | Nov 15 |
   | EP-2: Payment | 4 | 0/8 done | ░░░░░░ 0% | Planning | Bob | Nov 30 |
   | EP-3: Dashboard | 3 | 15/15 done | ██████ 100% | Done | Charlie | Nov 1 |

   **C. Story Board** (Detailed Task View)
   - Kanban board or list view
   - Columns: Backlog | Planning | Analysis | Architecture | Implementation | Review | QA | Done
   - Each card shows:
     - Story key and title
     - Type icon (feature/bug/defect/chore)
     - Priority (1-5 stars)
     - Complexity badges (Business: 3, Technical: 4)
     - Assignee (framework or human)
     - Time in current status
     - Blocked indicator with reason
     - Linked defects count (if any)

   - Filters:
     - Epic
     - Status
     - Assignee (framework/human)
     - Priority
     - Type
     - Has blockers
     - Complexity range

   - Sorting:
     - Priority (high to low)
     - Age (oldest first)
     - Complexity (simple to complex)
     - Time in status (stuck items first)

   **D. Timeline/Gantt View** (Optional)
   - Visual timeline of epics and major stories
   - Dependencies shown as arrows
   - Current date marker
   - Milestones/releases
   - Blocked items highlighted in red

   **E. Active Work Panel**
   - "Currently Running" section showing live agent executions:
     - Story ID and title
     - Agent/Framework working on it
     - Started time
     - Current status (e.g., "Implementing", "Testing")
     - Token usage so far
     - Estimated completion (if available)
   - WebSocket or long-polling for real-time updates

   **F. Blockers & Issues**
   - List of blocked stories with:
     - Story key and title
     - Blocking reason
     - Blocking duration
     - Owner/responsible party
     - Action required
   - Sorted by priority and duration

   **G. Metrics Summary**
   - Burndown chart (for current sprint/release)
   - Velocity trend (stories completed per week)
   - Cycle time distribution (time from start to done)
   - Lead time distribution (time from creation to done)
   - Quality indicators:
     - Open defects by severity
     - Test coverage trend
     - Code quality score

3. User can interact with tracker:
   - Drag-and-drop stories between statuses (if permitted)
   - Click story card to view details
   - Filter and search stories
   - Toggle between board/table/timeline views
   - Expand epic to see all child stories

4. User performs actions:
   - Click story → opens story detail modal with:
     - Full description and acceptance criteria
     - Complexity assessments
     - Linked use cases
     - Commits and code changes
     - Test results
     - Defects (if any)
     - Activity timeline
     - Quick actions: Edit, Assign, Block, Comment

   - Click "Create Story" → quick-create dialog
   - Click "Create Epic" → epic creation dialog
   - Click blocked item → see blocker details and resolution actions
   - Export current view as CSV or PDF

5. Live updates:
   - When agent starts working: story card shows "In Progress" badge
   - When commit linked: story card shows commit count
   - When QA approves: story moves to "Done" column
   - Notifications appear for key events

## Postconditions
- User has real-time view of project status
- User can identify blockers and bottlenecks
- User can track individual story progress
- User can see active agent work
- User can take actions on stories as needed

## Alternative Flows

### 3a. Drill down into epic
- At step 3, user clicks epic card
- System displays epic detail view:
  - Epic description and goals
  - All stories in epic (filtered view)
  - Epic-level metrics:
    - Total token usage
    - Total cost
    - Stories by status
    - Defect count
    - Average complexity
  - Epic timeline
  - Dependencies with other epics

### 3b. View blocked stories
- At step 3, user clicks "Blockers" panel
- System shows all blocked stories grouped by blocker type:
  - Waiting for dependency story
  - Waiting for external input
  - Technical blocker
  - Requirements unclear
- User can click to resolve or reassign

### 3c. View live agent execution
- At step 3, user sees agent actively working on ST-42
- User clicks "View Live" button
- System shows:
  - Real-time token usage ticker
  - Current iteration count
  - Files being modified
  - Estimated time remaining
  - Option to "Cancel execution" (with confirmation)

### 4a. Quick edit story from tracker
- At step 4, user clicks edit icon on story card
- Inline editing modal opens
- User can change:
  - Priority
  - Status
  - Assignee
  - Description
  - Complexity
- Changes saved via MCP: `update_story({ story_id, patch })`
- Card updates immediately

### 4b. Bulk operations
- At step 3, user selects multiple stories (checkboxes)
- Bulk action menu appears:
  - Change priority
  - Assign to framework
  - Move to epic
  - Add tags
  - Export selection
- User confirms bulk action
- System updates all selected stories

## Business Rules
- Only users with write permissions can drag-and-drop or edit
- Stories cannot be moved to "done" without QA approval (unless QA skipped)
- Blocked stories appear in red
- Stories exceeding expected duration appear in yellow (warning)
- Critical defects attached to stories show red badge
- Real-time updates have max 5-second latency

## UI/UX Requirements
The user mentioned:
> "for the project management part view is also created in https://studio.example.com/ -> Tracker. It already has all required field but i dont like how this is implemented."

The new implementation should focus on:
- **Clean, modern design:** Use better spacing, typography, colors
- **Performance:** Fast load times, smooth animations
- **Intuitive navigation:** Easy to switch between views
- **Mobile responsive:** Works on tablets and mobile
- **Real-time feel:** Live updates without page refresh
- **Visual hierarchy:** Important info stands out
- **Keyboard shortcuts:** Power users can navigate quickly
- **Customization:** Users can save view preferences

## Technical Implementation
- Frontend: React or Vue with real-time updates via WebSocket
- State management: Redux/Vuex for complex state
- Backend: MCP tools for data + WebSocket server for live updates
- Caching: Redis for fast dashboard loads
- Optimistic updates: UI updates immediately, syncs to server async
- Pagination/virtualization for large story lists

## Related Use Cases
- UC-PM-003: Create Story
- UC-PM-004: Assign Story to Framework
- UC-PM-005: View Project Dashboard
- UC-METRICS-001: View Framework Effectiveness
- UC-DEV-001: Pull Assigned Stories

## Acceptance Criteria
- Tracker loads within 2 seconds for projects with 500+ stories
- Real-time updates appear within 5 seconds of event
- All required fields from old implementation are present
- UI is significantly improved over old implementation
- Drag-and-drop works smoothly
- Filters and search are fast and accurate
- Live agent execution view updates in real-time
- Mobile responsive design works well
- Export functionality works for all views
- Users can customize their view preferences
- Blocked stories are clearly highlighted
- No data loss during live updates
- Keyboard navigation works for power users
