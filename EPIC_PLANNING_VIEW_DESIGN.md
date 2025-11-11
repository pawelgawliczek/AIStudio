# Epic Planning View - Design Specification

## Overview
A JIRA-like planning interface that provides a comprehensive view of all epics, stories, bugs, and subtasks with drag-and-drop priority management.

## Key Features

### 1. View Modes
- **Grouped by Epics**: Hierarchical view showing epics with their stories/bugs nested underneath
- **Flat View**: All items in a single list, sortable and filterable

### 2. Visual Hierarchy
```
Epic #1 [Priority 1]
  ├─ Story #1 [Priority 1]
  │   ├─ Subtask #1
  │   └─ Subtask #2
  ├─ Bug #2 [Priority 2]
  └─ Story #3 [Priority 3]

Epic #2 [Priority 2]
  ├─ Story #4 [Priority 1]
  └─ Bug #5 [Priority 2]

Unassigned Items
  ├─ Story #5 [Priority 1]
  └─ Bug #6 [Priority 2]
```

### 3. Drag-and-Drop Behavior

#### Priority Reordering
- **Epic Level**: Drag epics to reorder epic priorities (1, 2, 3...)
- **Story/Bug Level**: Drag within an epic to reorder story priorities within that epic
- **Cross-Epic**: Drag stories/bugs between epics to reassign AND update priority
- **Persistent**: All priority changes are saved immediately to backend

#### Visual Feedback
- Drag handle icon on hover
- Semi-transparent overlay while dragging
- Drop zone highlighting
- Smooth animations on reorder

### 4. Filtering & Sorting

#### Filters (Persistent in URL)
- **Status**: Multi-select (Backlog, Planning, In Progress, Done, etc.)
- **Type**: Multi-select (Feature, Bug, Defect, Chore, Spike)
- **Epic**: Multi-select epic names
- **Layer/Component**: Multi-select (Frontend, Backend, Infrastructure, Test)
- **Assignee**: Multi-select (Agent, Human, Unassigned)
- **Priority Range**: Slider (1-10+)
- **Search**: Full-text search across title and description

#### Sorting (Temporary, per view)
- **Priority**: Low to High / High to Low
- **Created Date**: Newest / Oldest
- **Updated Date**: Most recent / Least recent
- **Title**: A-Z / Z-A
- **Status**: By workflow order

### 5. Item Display

#### Epic Card
```
┌─────────────────────────────────────────┐
│ ⋮⋮ Epic: Authentication System   [▼]  │
│ Priority: 1 | Status: In Progress      │
│ 5 Stories | 2 Bugs | Complete: 45%     │
│ (by story count OR by estimates if set)│
└─────────────────────────────────────────┘
```

**Completion Calculation:**
- **No estimates**: Done stories / Total stories × 100%
- **With estimates**: Sum(done story tokens) / Sum(all story tokens) × 100%

#### Story/Bug Card
```
┌─────────────────────────────────────────┐
│ ⋮⋮ [FEATURE] User Login Flow            │
│ Priority: 2 | Status: Planning          │
│ Epic: Authentication System             │
│ 3 Subtasks | Business: ⭐⭐⭐⭐ | Tech: ⭐⭐⭐│
└─────────────────────────────────────────┘
```

#### Subtask Display (Indented, Collapsed by Default)
```
  [▶ 3 Subtasks]  ← Click to expand

  When expanded:
  ├─ [Frontend] Build login form
  ├─ [Backend] Implement JWT auth
  └─ [Test] E2E login tests
```

### 6. UI Layout

```
┌────────────────────────────────────────────────────────────┐
│ Epic Planning                                              │
├────────────────────────────────────────────────────────────┤
│ [Grouped by Epics ▼] [Filter ⚙] [Sort ⬍] [+ Epic]        │
├────────────────────────────────────────────────────────────┤
│ Filters Applied: Status: Backlog, Planning | Type: All    │
│ [Clear All]                                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Epic Cards (Collapsible)                      [+ Story]   │  ← Compact button
│  ├─ Story Cards (collapsed subtasks by default)           │
│  ├─ Bug Cards (collapsed subtasks by default)             │
│  └─ ...                                                    │
│                                                            │
│  Unassigned Items                              [+ Story]   │
│  ├─ Story Cards                                            │
│  └─ Bug Cards                                              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 7. Detail Modal/Popup

**When clicking on any card**, open a modal/drawer with:
- Full details (title, description, status, priority, etc.)
- Edit capabilities (inline editing)
- Subtask list (expanded view)
- Activity/history
- Comments section
- Quick actions (Delete, Clone, Move to Epic, etc.)

## Technical Implementation

### Components
1. **EpicPlanningView.tsx** - Main container with state management
2. **EpicGroup.tsx** - Collapsible epic container with nested items
3. **PlanningItemCard.tsx** - Unified card for epics/stories/bugs
4. **PlanningFilters.tsx** - Filter panel
5. **PlanningSort.tsx** - Sort controls
6. **DraggablePlanningItem.tsx** - Drag-and-drop wrapper

### State Management
- React Query for data fetching
- Local state for view mode (grouped/flat)
- URL params for filters (persistent)
- Local state for sorting (temporary)
- Optimistic updates for drag-and-drop

### API Endpoints
- `GET /api/planning/overview` - Fetch all epics with nested items
- `PATCH /api/epics/:id/priority` - Update epic priority
- `PATCH /api/stories/:id/priority` - Update story priority
- `PATCH /api/stories/:id/epic` - Move story to different epic

### Drag-and-Drop Library
- Continue using @dnd-kit
- DndContext with multi-type draggables (epic, story, bug)
- Droppable zones for epic groups
- Priority recalculation on drop

### Priority Management Logic
When an item is dropped:
1. Determine new position (index in list)
2. Calculate new priority based on surrounding items
3. Update backend with new priority
4. Optionally update epic assignment if cross-epic drag
5. Trigger refetch or optimistic update

### Styling
- JIRA-inspired color scheme:
  - Epic cards: Blue-grey background (#E3F2FD)
  - Story cards: White with blue left border (#2196F3)
  - Bug cards: White with red left border (#F44336)
  - Defect cards: White with orange left border (#FF9800)
- Indentation: 24px per level
- Card spacing: 8px vertical gap
- Hover effects: Light shadow and scale(1.01)
- Drag state: opacity(0.5) for original, opacity(0.9) for overlay

## User Experience

### Interactions
1. **Click epic header** → Toggle expand/collapse
2. **Click card** → Open detail modal
3. **Drag handle** → Reorder priority
4. **Right-click** → Context menu (edit, delete, etc.)
5. **Filter dropdown** → Multi-select with checkboxes
6. **Sort dropdown** → Radio buttons

### Loading States
- Skeleton loaders for cards
- Inline spinner for priority updates
- Toast notifications for errors

### Empty States
- "No epics found" with CTA to create first epic
- "No items match filters" with CTA to clear filters

## Accessibility
- Keyboard navigation for drag-and-drop
- ARIA labels for all interactive elements
- Focus indicators
- Screen reader announcements for state changes

## Performance Considerations
- Virtualized list for 100+ items
- Debounced search input
- Memoized filter/sort functions
- Lazy loading for subtask details
- Request deduplication with React Query

## Mobile Responsiveness
- **Desktop (1024px+)**: Full layout with side-by-side controls
- **Tablet (768px-1023px)**: Stacked controls, full card width
- **Mobile (< 768px)**:
  - Hamburger menu for filters
  - Bottom sheet for sort options
  - Compact cards (hide non-essential info)
  - Touch-optimized drag handles
  - Swipe gestures for quick actions
  - Modal detail view takes full screen

## Future Enhancements (Phase 2)
- Batch selection with checkboxes
- Bulk operations (move, delete, update priority)
- Export to CSV/Excel
- Saved filter presets
- Custom views
- Keyboard shortcuts
