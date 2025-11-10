# UC-PM-007: JIRA-like Planning View with Drag-and-Drop

## Overview
A modern, intuitive planning interface that mimics JIRA's task manager with drag-and-drop, subtask management, inline editing, and comprehensive story views.

**Key Requirement**: Planning view should be convenient, mimicking JIRA task manager with drag-and-drop and subtasks.

## Actor
PM, BA, Architect, Developer, Team Member

## Preconditions
- User is authenticated
- Project exists with stories

## Main Flow

### View Mode Selection

1. User navigates to Project → Planning
2. System displays view mode selector:
   ```
   Views: [Board] [List] [Timeline] [Sprint]

   Filters: ⚙️
   • Epic: [All Epics ▼]
   • Status: [All Statuses ▼]
   • Component: [All Components ▼]
   • Assignee: [All ▼]
   • Priority: [All ▼]

   Quick Filters:
   [My Stories] [Blocked] [No Component] [High Priority]

   Group by: [Status ▼]  Sort: [Priority ▼]
   ```

### Board View (Kanban-style)

3. System displays JIRA-like board with columns:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Backlog       Planning      Analysis      Architecture    Impl    │
│   (12)          (8)           (5)             (3)         (15)     │
├─────────────┬──────────────┬──────────────┬──────────────┬─────────┤
│             │              │              │              │         │
│ ┌─────────┐ │ ┌─────────┐  │ ┌─────────┐  │ ┌─────────┐  │┌──────┐│
│ │ ST-42   │ │ │ ST-45   │  │ │ ST-48   │  │ │ ST-50   │  ││ST-52││
│ │Priority:│ │ │Priority:│  │ │Priority:│  │ │Priority:│  ││Prio:││
│ │  ★★★★★ │ │ │  ★★★★  │  │ │  ★★★★  │  │ │  ★★★★★ │  ││★★★ ││
│ │         │ │ │         │  │ │         │  │ │         │  ││     ││
│ │Reset pwd│ │ │2FA auth │  │ │User prof│  │ │Email    │  ││API  ││
│ │         │ │ │         │  │ │edit     │  │ │template │  ││endpt││
│ │🏷️Auth   │ │ │🏷️Auth   │  │ │🏷️User   │  │ │🏷️Email  │  ││🏷️A...││
│ │         │ │ │Mgmt     │  │ │Mgmt     │  │ │Service  │  ││     ││
│ │👤 Alice │ │ │👤 Bob   │  │ │👤 BA-Agt│  ││👤 Arch  │  ││👤Dev││
│ │         │ │ │         │  │ │         │  │ │Agent    │  ││Agent││
│ │📋 4/6   │ │ │📋 0/3   │  │ │⚠️ Block│  │ │         │  ││     ││
│ │subtasks │ │ │subtasks │  │ │         │  │ │         │  ││     ││
│ └─────────┘ │ └─────────┘  │ └─────────┘  │ └─────────┘  │└──────┘│
│             │              │              │              │         │
│ ┌─────────┐ │              │              │              │         │
│ │ ST-43   │ │              │              │              │         │
│ │Priority:│ │              │              │              │         │
│ │  ★★★   │ │              │              │              │         │
│ │...      │ │              │              │              │         │
│ └─────────┘ │              │              │              │         │
│             │              │              │              │         │
│ [+ Create]  │              │              │              │         │
└─────────────┴──────────────┴──────────────┴──────────────┴─────────┘

              Review          QA            Done
                (7)           (4)           (28)
             ┬──────────────┬──────────────┬─────────────┐
             │              │              │             │
             │ ┌─────────┐  │              │             │
             │ │ ST-55   │  │              │             │
             │ │...      │  │              │             │
```

Each card shows:
- Story key and title
- Priority (1-5 stars)
- Component tags
- Assignee (human or agent)
- Subtask progress (4/6)
- Blocked indicator (if blocked)

### Drag-and-Drop Functionality

4. User can drag story card between columns:
   - Grabs story ST-42 card from "Backlog"
   - Drags to "Planning" column
   - System shows drop target highlight
   - Releases card

5. System:
   - Updates story status: backlog → planning
   - Calls MCP: `update_story({ story_id: "ST-42", status: "planning" })`
   - Logs audit event
   - Updates card position with smooth animation
   - Triggers workflow validation:
     - If moving to "analysis", checks: has components?
     - If moving to "architecture", checks: BA analysis complete?
     - If moving to "impl", checks: architecture complete?

6. If validation fails:
   ```
   ⚠️ Cannot move to "Analysis"

   Story is missing required fields:
   • No components assigned
   • Business complexity not set

   [Fix Now] [Cancel]
   ```

### Story Card Details (Click to Expand)

7. User clicks story card ST-42
8. System opens **Story Detail Modal** (right-side drawer):

```
┌──────────────────────────────────────────────────────────────┐
│ ST-42: Implement password reset flow                    [✕] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Status: [Planning ▼]    Priority: [★★★★★]    Type: Feature │
│                                                              │
│ Epic: EP-3 User Authentication                              │
│ Components: 🏷️ Authentication  🏷️ Email Service              │
│ Layers: Backend/API, Frontend                               │
│                                                              │
│ ─────────── DESCRIPTION ───────────                         │
│ Users should be able to reset their password via email...  │
│ [Edit]                                                      │
│                                                              │
│ ─────────── COMPLEXITY ASSESSMENT ───────────               │
│ Business Complexity (BA):    [3 ▼] - Moderate              │
│ Architect Complexity (Arch): [3 ▼] - Moderate              │
│ Estimated Tokens (PM):       [50000              ]          │
│                                                              │
│ ─────────── BA ANALYSIS ───────────                         │
│ Status: ✓ Complete (by BA Agent on Nov 10, 09:25)          │
│ Analysis:                                           [View]  │
│ • Linked use cases: UC-AUTH-003, UC-EMAIL-001               │
│ • Business rules documented                                 │
│ • Acceptance criteria refined                               │
│                                              [Edit Analysis]│
│                                                              │
│ ─────────── ARCHITECT ANALYSIS ───────────                  │
│ Status: ⏳ Pending                                          │
│ (Will be filled by Architect agent)           [Start Now]  │
│                                                              │
│ ─────────── DESIGNS ───────────                             │
│ 📎 wireframe-password-reset.fig                             │
│ 📎 api-sequence-diagram.png                                 │
│ [+ Upload Design]                                           │
│                                                              │
│ ─────────── SUBTASKS (4/6 completed) ───────────            │
│ ☑ Backend API endpoint         ✓ Done      [ST-42-1]       │
│ ☑ Email template creation       ✓ Done      [ST-42-2]       │
│ ☐ Frontend form                 Todo        [ST-42-3]       │
│ ☐ Unit tests                    Todo        [ST-42-4]       │
│ ☐ Integration tests              Todo        [ST-42-5]       │
│ ☐ E2E tests                     Todo        [ST-42-6]       │
│ [+ Add Subtask]                                             │
│                                                              │
│ ─────────── LINKED USE CASES ───────────                    │
│ • UC-AUTH-003: Password Reset Flow          [View]          │
│ • UC-EMAIL-001: Email Notification System   [View]          │
│ [+ Link Use Case]                                           │
│                                                              │
│ ─────────── COMMITS (3) ───────────                         │
│ • abc123 - Add password reset API (+285 LOC)                │
│ • def456 - Add email template (+42 LOC)                     │
│ • ghi789 - Update auth middleware (+18 LOC)                 │
│                                                              │
│ ─────────── AGENT EXECUTIONS (4) ───────────                │
│ 1. BA Agent - Requirements Analysis (9K tokens, 25 min)    │
│ 2. Architect Agent #1 - Tech Assessment (6.6K tokens)       │
│ 3. Developer Agent - Backend Impl (23.5K tokens, 285 LOC)  │
│ 4. Developer Agent - Frontend Impl (19.2K tokens, 198 LOC) │
│                                              [View Details] │
│                                                              │
│ ─────────── ACTIVITY LOG ───────────                        │
│ • Nov 10, 09:00 - Created by PM (Alice)                    │
│ • Nov 10, 09:15 - Components assigned                       │
│ • Nov 10, 09:00 - BA Agent completed analysis              │
│ • Nov 10, 10:45 - Developer Agent completed backend        │
│                                                     [More] │
│                                                              │
│ ────────────────────────────────────────────────────────    │
│ [Delete Story]          [Clone]     [Save]    [Close]      │
└──────────────────────────────────────────────────────────────┘
```

### Subtask Management

9. User clicks "[+ Add Subtask]" in detail modal
10. System shows subtask creation form:
    ```
    Add Subtask to ST-42

    Title: [Create password reset form component    ]

    Layer:     [Frontend ▼]
    Component: [Authentication ▼]

    Assignee: [Developer Agent ▼]

    Estimated Effort: [Small] [Medium] [Large]

    [Cancel] [Add Subtask]
    ```

11. Subtask created and appears in list
12. User can:
    - Check/uncheck subtask to mark done
    - Drag subtasks to reorder
    - Click subtask to see details
    - Delete subtask

### Inline Editing

13. User can edit story fields inline:
    - Click on story title → edit inline
    - Click on priority stars → change priority
    - Click on component tags → add/remove components
    - Click on assignee → change assignee
    - All changes auto-save after 1-second debounce

### Bulk Operations

14. User selects multiple stories (checkboxes appear on hover)
15. Bulk action menu appears:
    ```
    3 stories selected

    [Change Status ▼] [Set Priority ▼] [Assign ▼] [Add Component ▼]
    [Move to Epic ▼] [Delete] [Export]
    ```

16. User can perform bulk operations on selected stories

### List View

17. User switches to "List" view
18. System displays table view:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Key    │ Title              │P│Components    │Assignee│Status   │Subtasks│ ... │
├────────┼────────────────────┼─┼──────────────┼────────┼─────────┼────────┼─────┤
│ ST-42  │Reset password flow │5│Auth, Email   │Alice   │Planning │ 4/6    │ >   │
│ ST-43  │Add 2FA support     │4│Auth          │Bob     │Analysis │ 0/3    │ >   │
│ ST-44  │User profile edit   │3│User Mgmt     │BA-Agt  │Impl     │ 8/8    │ >   │
│ ...    │                    │ │              │        │         │        │     │
└────────┴────────────────────┴─┴──────────────┴────────┴─────────┴────────┴─────┘
```

- Sortable columns
- Inline editing
- Expandable rows (click ">" to see details)

### Sprint View

19. User switches to "Sprint" view
20. System shows sprint planning interface:
    ```
    Sprint 5 (Nov 11 - Nov 25)
    Capacity: 500K tokens | Used: 342K tokens (68%)

    Stories in Sprint (18):
    [List of stories with estimated tokens]

    Backlog:
    [Drag stories here to add to sprint]
    ```

## Postconditions
- User has intuitive planning interface
- Stories can be moved via drag-and-drop
- Subtasks are managed efficiently
- All story details accessible in one view
- Workflow validations prevent invalid transitions
- Inline editing speeds up planning

## Business Rules
- Drag-and-drop triggers workflow validation
- Cannot move story to status if prerequisites not met
- Subtasks can only be created for stories (not epics)
- Subtask completion updates parent story progress
- All edits are auto-saved with debounce
- Audit log records all changes

## Technical Implementation

### Frontend
- React or Vue with drag-and-drop library (react-beautiful-dnd, Vue.Draggable)
- Optimistic UI updates (instant feedback, sync to server async)
- WebSocket for real-time updates when other users make changes
- Virtual scrolling for large story lists

### Backend
- MCP tools for all operations
- WebSocket server for live updates
- Validation rules enforced server-side
- Debounced auto-save (1 second)

## Related Use Cases
- UC-PM-003: Create Story (story structure with all fields)
- UC-ADMIN-003: Manage Layers and Components (component selection)
- UC-BA-001: Analyze Story Requirements (BA analysis field)
- UC-ARCH-001: Assess Technical Complexity (Architect analysis field)
- UC-METRICS-002: View Project Tracker (similar but different focus)

## Acceptance Criteria
- ✓ Board view mimics JIRA with drag-and-drop
- ✓ Stories can be dragged between status columns
- ✓ Workflow validation prevents invalid moves
- ✓ Story detail modal shows all required fields:
  - Business complexity (filled by BA)
  - Architect complexity (filled by Architect)
  - Estimated tokens (filled by PM)
  - BA analysis with linked use cases
  - Architect analysis
  - Design document uploads
- ✓ Subtasks can be created, edited, and checked off
- ✓ Inline editing works for all editable fields
- ✓ Bulk operations work correctly
- ✓ List and Sprint views available
- ✓ Real-time updates via WebSocket
- ✓ Performance is good even with 500+ stories
- ✓ Mobile responsive
- ✓ Keyboard shortcuts work for power users
