# UC-BA-008: Epic Planning View - Filter and Search Stories

## Actor
Business Analyst (BA), Project Manager (PM)

## Preconditions
- BA is authenticated
- Project has epics and stories
- BA has permissions to view planning data

## Main Flow

### 1. Access and Apply Filters
1. BA navigates to Epic Planning View
2. BA clicks "Filters" button in header
3. System displays filter panel with 5 filter categories:
   - Status (multi-select checkboxes)
   - Type (multi-select checkboxes)
   - Epic (multi-select from project epics)
   - Layer/Component (frontend, backend, test, infra)
   - Search (full-text input)
4. BA selects desired filters:
   - Example: Status = "Planning, In Progress"
   - Example: Type = "Feature, Bug"
   - Example: Layer = "Frontend"
5. System applies filters in real-time
6. System updates URL with filter parameters
7. System displays active filter badges below header
8. Only stories matching ALL selected filters are displayed

### 2. Search Stories by Text
9. BA enters search query in filter panel
10. BA clicks "Go" or presses Enter
11. System searches across:
    - Story keys (e.g., "ST-101")
    - Story titles
    - Story descriptions
12. System highlights matching stories
13. Non-matching stories are hidden

### 3. Filter by Layer/Component (Subtask-based)
14. BA selects "Frontend" from Layer filter
15. System shows only stories that have at least one frontend subtask
16. BA can combine with other filters
17. Example: "Status=Planning + Layer=Frontend" shows only planning stories with frontend work

### 4. Filter by Epic
18. BA selects one or more epics from Epic filter
19. System shows only stories assigned to selected epics
20. Unassigned stories are hidden when epic filter is active
21. BA can select multiple epics to see stories across them

### 5. Clear Filters
22. BA reviews active filter badges
23. BA clicks "Clear All" button
24. System removes all filters
25. System updates URL to remove filter parameters
26. All epics and stories are displayed again

### 6. Share Filtered View
27. BA copies current page URL (includes filter parameters)
28. BA shares URL with PM via email/slack
29. PM opens URL
30. System applies same filters from URL parameters
31. PM sees identical filtered view as BA

## Postconditions
- Filter selections persist in URL
- Filtered view can be bookmarked
- URL can be shared with team members
- Filters remain active until manually cleared

## Alternative Flows

### 4a. No Results Match Filters
- At step 8, if no items match filters:
- System displays "No items match the current filters"
- Shows filter summary
- Suggests "Clear All Filters"

### 9a. Empty Search Query
- At step 10, if search is empty:
- System treats as no search filter
- All items matching other filters are shown

### 22a. Clear Individual Filter
- At step 23, BA clicks X on individual filter badge:
- System removes only that filter
- Other filters remain active
- Results update immediately

## Business Rules

### Filter Combination Logic
- Multiple filters within same category use OR logic
  - Example: Status = "Planning OR In Progress"
- Filters across categories use AND logic
  - Example: (Status = Planning) AND (Type = Feature) AND (Layer = Frontend)

### Layer/Component Filtering
- Filters at subtask level
- Story is included if ANY subtask matches selected layer
- Empty layer subtasks are ignored

### Search Behavior
- Case-insensitive matching
- Partial string matching
- Searches across key, title, and description fields
- Does not search within subtasks

### URL Persistence
- Format: `?status=planning,in_progress&type=feature&search=login`
- URL parameters are validated on page load
- Invalid parameters are silently ignored
- Filters can be modified without losing other parameters

## Acceptance Criteria
1. ✅ Multi-select filters work for all categories
2. ✅ Filter combinations use correct AND/OR logic
3. ✅ Search filters across key, title, description
4. ✅ Layer filter checks subtask layers
5. ✅ Filters persist in URL parameters
6. ✅ Shared URLs apply same filters
7. ✅ "Clear All" removes all filters
8. ✅ Individual filter badges can be removed
9. ✅ Filter panel shows selected count
10. ✅ Empty results show helpful message
11. ✅ Filters apply in real-time (< 200ms)
12. ✅ URL can be bookmarked and reopened with filters

## Related Use Cases
- UC-PM-008: Epic Planning View - Manage and Prioritize
- UC-BA-005: Advanced Use Case Search
- UC-PM-002: View Sprint Backlog

## UI/UX Notes

### Filter Panel Layout
```
┌─────────────────────────────────┐
│ 🔍 Filters                  [3] │  ← Badge shows active count
├─────────────────────────────────┤
│ Search                          │
│ [login flow____________] [Go]   │
├─────────────────────────────────┤
│ Status                      [▼] │
│   ☑ Planning                    │
│   ☑ In Progress                 │
│   ☐ Done                        │
├─────────────────────────────────┤
│ Type                        [▼] │
│   ☑ Feature                     │
│   ☐ Bug                         │
├─────────────────────────────────┤
│ Layer/Component             [▼] │
│   ☑ Frontend                    │
│   ☐ Backend                     │
│   ☐ Test                        │
│   ☐ Infrastructure              │
├─────────────────────────────────┤
│ [Clear All] [Apply Filters]     │
└─────────────────────────────────┘
```

### Active Filter Badges
```
Filters: [Status: planning, in_progress] [Type: feature] [Layer: frontend] [Clear All]
```
