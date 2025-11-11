# Story List View - Design Specification

**Page:** `/projects/:projectId/stories`
**Purpose:** Browse, filter, and search stories for a project
**Last Updated:** 2025-11-10

---

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Breadcrumbs: Stories                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Stories                                    [+ Create Story]    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔽 Filters                              [Clear all filters]   │
│                                                                 │
│  ┌─────────────────┬──────────┬──────────┬───────────┬────────┐│
│  │ Search Stories  │  Status  │  Epic    │ Complexity│ Sort   ││
│  │ [🔍 Search...  ]│ [v All ]│  [v All] │ [v Any]   │[v New] ││
│  │         [Search]│          │          │           │        ││
│  └─────────────────┴──────────┴──────────┴───────────┴────────┘│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ST-1  ● planning  🟣 EP-1: Phase 0 - Remote Host Deploy │  │
│  │                                                          │  │
│  │ Sprint 1: Foundation Setup                               │  │
│  │ Monorepo structure, Docker Compose, database...          │  │
│  │                                                          │  │
│  │ Tech: 7/5  Impact: 10/5  5 subtasks  3 commits          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ST-2  ● analysis  🟣 EP-2: Phase 1 - Foundation         │  │
│  │                                                          │  │
│  │ Sprint 2: Authentication & Basic API                     │  │
│  │ JWT authentication, RBAC, NestJS modules...              │  │
│  │                                                          │  │
│  │ Tech: 8/5  Impact: 10/5  8 subtasks  12 commits         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [More stories...]                                              │
│                                                                 │
│  Showing 1 to 20 of 45 results    [Previous]  [Next]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Page Header
```
┌─────────────────────────────────────────────┐
│ Stories                    [+ Create Story] │
└─────────────────────────────────────────────┘
```

**Styling:**
- Title: `text-2xl font-bold text-gray-900`
- Button: Indigo 600 with white text, shadow-sm
- Spacing: `mb-6` between sections

---

### 2. Filter Panel (Enhanced)

```
┌──────────────────────────────────────────────────────────┐
│ 🔽 Filters (h-6, indigo-600)  [Clear all filters button]│
│                                                          │
│ Grid Layout (Responsive):                                │
│ - Mobile: 1 column                                       │
│ - Tablet: 2 columns                                      │
│ - Desktop: 3 columns                                     │
│ - Large: 6 columns                                       │
│                                                          │
│ ┌─────────────────┐ ┌──────────┐ ┌──────────┐          │
│ │ Search Stories  │ │  Status  │ │   Epic   │ ...      │
│ │                 │ │          │ │          │          │
│ │ Label (mb-2)    │ │ Label    │ │ Label    │          │
│ │ [Input py-2.5]  │ │[Select]  │ │[Select]  │          │
│ └─────────────────┘ └──────────┘ └──────────┘          │
└──────────────────────────────────────────────────────────┘
```

**Visual Hierarchy:**
1. **Panel:** White bg, shadow, rounded-lg, p-6
2. **Header:** Bold title with indigo icon
3. **Inputs:** All py-2.5 for consistent height
4. **Labels:** text-sm font-medium mb-2
5. **Clear Button:** Border with hover state

**Colors:**
- Background: White (`bg-white`)
- Border: Gray 300 (`border-gray-300`)
- Focus: Indigo 500 ring
- Icon: Indigo 600
- Labels: Gray 700

---

### 3. Story Card

```
┌───────────────────────────────────────────────────────────┐
│ Header Row:                                               │
│ ST-1 (gray-500) ● planning 🟣 EP-1: Epic Title           │
│                  (status badge)  (epic badge - purple)    │
│                                                           │
│ Title Row (lg font-medium):                               │
│ Sprint 1: Foundation Setup                                │
│                                                           │
│ Description (sm text-gray-600, line-clamp-2):             │
│ Monorepo structure, Docker Compose, database schema...    │
│                                                           │
│ Metadata Row (xs text-gray-500):                          │
│ Tech: 7/5 | Impact: 10/5 | 5 subtasks | 3 commits        │
└───────────────────────────────────────────────────────────┘
```

**Badge Design:**

**Status Badge:**
```
● planning
```
- Rounded-full
- px-2.5 py-0.5
- text-xs font-medium
- Color varies by status (gray, blue, purple, pink, yellow, orange, indigo, green)

**Epic Badge (NEW):**
```
🟣 EP-1: Phase 0 - Remote Host Deployment
```
- Rounded-full
- px-2.5 py-0.5
- text-xs font-medium
- bg-purple-100 text-purple-800
- Tooltip shows full title

**Spacing:**
- Card: p-6 mb-4
- Between badges: gap-3
- Card hover: shadow-md transition

---

## Color Palette

### Status Colors
```css
planning:      bg-gray-100    text-gray-800
analysis:      bg-blue-100    text-blue-800
architecture:  bg-purple-100  text-purple-800
design:        bg-pink-100    text-pink-800
implementation: bg-yellow-100 text-yellow-800
review:        bg-orange-100  text-orange-800
qa:            bg-indigo-100  text-indigo-800
done:          bg-green-100   text-green-800
```

### Epic Colors
```css
Epic Badge: bg-purple-100 text-purple-800
```

### Interactive Elements
```css
Primary Button:   bg-indigo-600  hover:bg-indigo-700
Secondary Button: bg-gray-100    hover:bg-gray-200
Focus Ring:       ring-indigo-500
```

---

## Responsive Behavior

### Mobile (< 768px)
- 1 column filter grid
- Search takes full width
- Filters stack vertically
- Story cards full width

### Tablet (768px - 1024px)
- 2 column filter grid
- Search spans 2 columns
- Story cards full width

### Desktop (1024px - 1280px)
- 3 column filter grid
- Search spans 3 columns
- Story cards maintain width

### Large (1280px+)
- 6 column filter grid
- Search spans 2 columns
- Each filter gets 1 column
- Optimal reading width for story cards

---

## Typography

```css
Page Title:       text-2xl font-bold text-gray-900
Section Title:    text-lg font-semibold text-gray-900
Story Title:      text-lg font-medium text-gray-900
Story Description: text-sm text-gray-600
Labels:           text-sm font-medium text-gray-700
Metadata:         text-xs text-gray-500
Badge Text:       text-xs font-medium
```

---

## Interaction States

### Filter Inputs
```css
Default:  border-gray-300
Hover:    (no change for inputs)
Focus:    ring-1 ring-indigo-500 border-indigo-500
```

### Buttons
```css
Primary:
  Default:  bg-indigo-600
  Hover:    bg-indigo-700
  Focus:    ring-2 ring-offset-2 ring-indigo-500

Secondary:
  Default:  bg-gray-100
  Hover:    bg-gray-200
  Focus:    ring-2 ring-offset-2 ring-gray-500
```

### Story Cards
```css
Default:  shadow
Hover:    shadow-md transition-shadow
Active:   (navigates to detail)
```

---

## Accessibility

### Focus Indicators
- All interactive elements have visible focus rings
- Focus ring: 2px indigo-500 with 2px offset

### ARIA Labels
- Search input: `aria-label="Search stories"`
- Filter selects: Proper label associations
- Clear button: `aria-label="Clear all filters"`

### Keyboard Navigation
- Tab order: Search → Filters → Story cards
- Enter: Activates buttons, submits search
- Cards are clickable links

---

## Visual Examples

### Filter Panel States

**Empty State:**
```
🔽 Filters
[All filters at default values]
[No "Clear all" button shown]
```

**With Active Filters:**
```
🔽 Filters                   [Clear all filters]
[Some filters have values]
[Clear button appears when any filter is active]
```

### Story Card Variations

**With Epic:**
```
ST-1 ● planning 🟣 EP-1: Phase 0 - Remote Host Deployment
```

**Without Epic:**
```
ST-1 ● planning
```

**Long Epic Title (truncated with tooltip):**
```
ST-5 ● implementation 🟣 EP-4: Phase 3 - Use Case Library & Telemetry
                      (hover shows full title in tooltip)
```

---

## Implementation Notes

### Grid System
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
  {/* Search - spans 2 cols on xl */}
  <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-2">

  {/* Each filter - 1 col */}
  <div className="col-span-1">
</div>
```

### Input Heights
All inputs use `py-2.5` for consistent height:
```jsx
className="... py-2.5 ..."
```

### Badge Consistency
Epic badges match status badge styling:
```jsx
className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
```

---

## Design Decisions

### Why Purple for Epics?
- Distinct from status colors
- Purple = "bigger picture" / strategic
- High contrast with white background
- Accessible color combination

### Why Larger Filters?
- Better touch targets (mobile-friendly)
- Easier to read labels
- More professional appearance
- Matches modern UI patterns

### Why Responsive Grid?
- Adapts to screen size
- Prevents horizontal scrolling
- Maintains readability
- Efficient use of space

---

## Future Enhancements

### Potential Additions:
1. **Collapsible Filters** - Hide/show filter panel
2. **Saved Filters** - Save common filter combinations
3. **Bulk Actions** - Select multiple stories
4. **Quick Filters** - Preset filter buttons (My Stories, This Week, etc.)
5. **View Toggle** - List vs. Grid vs. Compact view
6. **Export** - Export filtered results to CSV/Excel

### Animation Opportunities:
- Smooth filter panel collapse/expand
- Story card entrance animations
- Skeleton loading states
- Filter chip animations

---

**Design Status:** ✅ Implemented
**Last Updated:** 2025-11-10
**Next Review:** When adding bulk actions or view toggles
