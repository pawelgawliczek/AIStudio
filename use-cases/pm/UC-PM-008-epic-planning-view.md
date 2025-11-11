# UC-PM-008: Epic Planning View - Manage and Prioritize Epics and Stories

## Actor
Project Manager (PM), Business Analyst (BA), Architect

## Preconditions
- User is authenticated
- Project exists
- User has permissions to view and manage epics/stories
- At least one epic or story exists in the project

## Main Flow

### 1. Access Epic Planning View
1. PM navigates to the project dashboard
2. PM clicks "Epic Planning" from the navigation menu
3. System displays Epic Planning View with:
   - Grouped view (default) showing all epics with nested stories
   - Filter and sort controls in the header
   - View mode toggle (Grouped/Flat)
   - Active filter indicators

### 2. View Hierarchical Structure (Grouped View)
4. System displays epics organized by priority (highest first)
5. Each epic card shows:
   - Epic title and key
   - Current priority number
   - Status (planning, in_progress, completed, on_hold)
   - Story count
   - Completion percentage (calculated by story count or estimates)
   - Progress bar visualization
   - Expand/collapse toggle
6. When epic is expanded, system shows nested stories:
   - Story cards with color-coded left border (blue=feature, red=bug, orange=defect)
   - Priority within epic
   - Current status
   - Subtask count (collapsed by default)
   - Business and technical complexity ratings (stars)
7. PM can expand individual stories to view subtasks:
   - Subtask list with layer icons (frontend, backend, test, infra)
   - Subtask status and assignee type
   - Tree-style indentation
8. System shows "Unassigned Items" section at bottom for stories without epics

### 3. Filter and Search Stories
9. PM clicks "Filters" button to open filter panel
10. PM selects filters from multiple dimensions:
    - **Status**: Multi-select checkboxes (backlog, planning, in_progress, done, etc.)
    - **Type**: Multi-select (feature, bug, defect, chore, spike)
    - **Epic**: Multi-select from list of all epics
    - **Layer/Component**: Multi-select (frontend, backend, infrastructure, test)
    - **Search**: Full-text search across story titles and descriptions
11. PM applies filters by selecting checkboxes
12. System updates URL with filter parameters (for persistence and sharing)
13. System displays active filter badges below header
14. Filtered results show only matching items in real-time
15. PM can clear individual filters or click "Clear All" to reset

### 4. Sort Stories and Epics
16. PM selects sorting option from dropdown:
    - Priority: High to Low (default)
    - Priority: Low to High
    - Created: Newest First
    - Created: Oldest First
    - Updated: Most Recent
    - Title: A-Z
    - Title: Z-A
17. System re-sorts items immediately (sorting is temporary, not in URL)
18. Sorting applies to both epics and stories within epics

### 5. Toggle View Modes
19. PM clicks "Flat View" toggle button
20. System switches to flat view showing:
    - All stories in a single sortable list
    - Epic name displayed as badge on each story card
    - No hierarchical nesting
    - Same filtering and sorting options apply
21. PM can toggle back to "Grouped by Epics" view anytime

### 6. Reorder Epic Priorities (Drag-and-Drop)
22. PM hovers over epic card, drag handle (⋮⋮) appears
23. PM clicks and drags epic to new position
24. System shows visual feedback:
    - Dragged epic becomes semi-transparent
    - Drag overlay follows cursor with slight rotation
    - Drop zones highlight when hovering
25. PM drops epic at new position
26. System updates epic priorities:
    - Swaps priorities between dragged and target epic
    - Immediately saves to backend
    - Broadcasts update via WebSocket
27. All connected users see updated epic order in real-time

### 7. Reorder Story Priorities Within Epic
28. PM hovers over story card, drag handle appears
29. PM drags story to new position within same epic
30. System updates story priorities within that epic
31. System saves changes and broadcasts update

### 8. Reassign Story to Different Epic
32. PM drags story from one epic
33. PM drops story onto a different epic card
34. System shows confirmation highlight on target epic
35. System reassigns story:
    - Moves story to new epic
    - Assigns new priority (highest priority + 1 in target epic)
    - Updates epicId in database
    - Broadcasts story update
36. Story disappears from source epic and appears in target epic
37. Both epic completion percentages update automatically

### 9. Move Story to Unassigned
38. PM drags story from an epic
39. PM drops onto "Unassigned Items" section
40. System removes epic assignment:
    - Sets epicId to null
    - Keeps story priority
41. Story moves to Unassigned section
42. Source epic updates its completion percentage

### 10. View Story Details
43. PM clicks on any story card (avoiding drag handle)
44. System opens StoryDetailDrawer with:
    - Full story details (title, description, status, priority)
    - Edit capabilities (inline editing)
    - Expanded subtask list
    - Activity/history timeline
    - Comments section
    - Quick actions (Delete, Clone, Move to Epic, etc.)
45. PM can edit story details in-place
46. PM closes drawer, changes are saved

### 11. Add New Story to Epic
47. PM clicks "+ Story" button next to epic header
48. System opens story creation form
49. PM fills in story details (title, description, type, etc.)
50. System creates story assigned to that epic
51. Story appears in epic's story list with default priority

## Postconditions
- Epic and story priorities are updated in database
- All reorderings and reassignments are persisted
- Filter selections are preserved in URL (can be bookmarked/shared)
- Real-time updates broadcast to all connected users
- Audit log records all priority and assignment changes
- Epic completion percentages reflect current state

## Alternative Flows

### 5a. No Epics Exist
- At step 5, if no epics exist:
- System displays "No epics found" message
- Shows "Create Epic" button
- PM can create first epic

### 9a. No Items Match Filters
- At step 14, if no items match filters:
- System displays "No items match the current filters"
- Shows "Clear All Filters" button
- PM can adjust filters or clear all

### 26a. Network Error During Drag-and-Drop
- At step 26, if network request fails:
- System reverts drag operation
- Shows error toast notification
- Epic returns to original position
- PM can retry operation

### 32a. Drop on Invalid Target
- At step 33, if PM drops story on invalid area:
- System cancels drag operation
- Story returns to original position
- No changes made

### 43a. View Epic Details
- At step 43, if PM clicks epic card:
- System could open epic detail view (future enhancement)
- Currently shows epic inline in grouped view

## Special Requirements

### Performance
- Page should load in < 2 seconds with 100+ stories
- Drag-and-drop should have < 100ms latency
- Real-time updates should arrive within 500ms
- Filter/sort operations should complete in < 200ms

### Usability
- Drag handles should be clearly visible on hover
- Drop zones should highlight to indicate valid targets
- Completion percentages should update immediately
- Filter selections should persist across page refreshes
- Mobile-responsive design (Phase 2)

### Accessibility
- Keyboard navigation for drag-and-drop
- ARIA labels for all interactive elements
- Screen reader support for status changes
- Focus indicators for all focusable elements

### Real-time Collaboration
- Multiple users can work simultaneously
- Changes broadcast instantly via WebSocket
- Optimistic UI updates with rollback on error
- No data conflicts or race conditions

## Business Rules

### Epic Completion Calculation
1. **By Story Count** (default, if no estimates):
   - Completion % = (Done Stories / Total Stories) × 100
2. **By Estimates** (if token estimates are set):
   - Completion % = (Sum of Done Story Tokens / Sum of All Story Tokens) × 100

### Priority Management
- Epic priorities are project-wide integers (1, 2, 3...)
- Story priorities are scoped within their epic (1, 2, 3...)
- When story is reassigned, it gets highest priority + 1 in target epic
- Unassigned stories maintain their priority for sorting

### Filter Persistence
- Filter selections persist in URL query parameters
- URL can be bookmarked or shared with team
- Sort selections do NOT persist (temporary per session)
- Search query persists in URL

### Real-time Updates
- All connected users in same project room receive updates
- Epic priority changes broadcast immediately
- Story reassignments trigger epic completion recalculation
- Websocket events: epic:updated, story:updated

## UI/UX Notes

### Color Scheme (JIRA-inspired)
- **Epic cards**: Light blue-grey background (#E3F2FD)
- **Feature stories**: White with blue left border (#2196F3)
- **Bug stories**: White with red left border (#F44336)
- **Defect stories**: White with orange left border (#FF9800)
- **Chore/Spike**: White with grey/purple borders

### Visual Feedback
- Drag handle (⋮⋮) appears on hover
- Dragged item opacity: 50%
- Drag overlay opacity: 90% with 3° rotation
- Drop zone highlight: 2px primary color border
- Progress bars animate on data change
- Toast notifications for errors

### Responsive Behavior (Future - Phase 2)
- **Desktop (1024px+)**: Full layout with side-by-side controls
- **Tablet (768-1023px)**: Stacked controls, full card width
- **Mobile (< 768px)**: Hamburger menu for filters, bottom sheet for sort

## Related Use Cases
- UC-PM-001: Create Epic
- UC-PM-002: Update Epic Status
- UC-BA-001: Create Story
- UC-BA-006: Link Story to Epic
- UC-DEV-003: View Story Backlog

## Acceptance Criteria
1. ✅ Grouped view displays all epics with nested stories by priority
2. ✅ Flat view displays all stories in single sortable list
3. ✅ Drag-and-drop reorders epic priorities
4. ✅ Drag-and-drop reorders story priorities within epic
5. ✅ Drag-and-drop reassigns stories between epics
6. ✅ Drag-and-drop moves stories to unassigned section
7. ✅ Multi-select filters work for status, type, epic, layer
8. ✅ Full-text search filters across story titles and descriptions
9. ✅ Filters persist in URL and can be bookmarked/shared
10. ✅ Sort options work correctly for all dimensions
11. ✅ Epic completion percentage calculated correctly
12. ✅ Subtasks collapsed by default, expandable on click
13. ✅ Real-time updates via WebSocket for all connected users
14. ✅ Story detail drawer opens on card click
15. ✅ "+ Story" button creates new story in epic
16. ✅ Visual drag feedback (handles, overlays, highlights)
17. ✅ Error handling with toast notifications
18. ✅ Page loads in < 2 seconds with 100+ stories
