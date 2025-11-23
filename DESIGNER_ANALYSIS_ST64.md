# Designer Analysis: ST-64 Version Management Web UI

> **Story**: ST-64 - Version Management Web UI
> **Designer**: Claude (AI Designer Agent)
> **Date**: November 23, 2025
> **Status**: Design Complete - Awaiting Approval

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color Palette & Typography](#2-color-palette--typography)
3. [Component-by-Component UX Design](#3-component-by-component-ux-design)
   - [A. Component Version History Tab](#a-component-version-history-tab)
   - [B. Component Usage Analytics Tab](#b-component-usage-analytics-tab)
   - [C. Component Checksum Tab](#c-component-checksum-tab)
   - [D. Coordinator Detail Modal](#d-coordinator-detail-modal)
   - [E. Workflow Version History Tab](#e-workflow-version-history-tab)
   - [F. Version Comparison Modal](#f-version-comparison-modal)
4. [User Flows](#4-user-flows)
5. [Edge Cases & Empty States](#5-edge-cases--empty-states)
6. [Animation & Transitions](#6-animation--transitions)
7. [Accessibility Checklist](#7-accessibility-checklist)

---

## 1. Design Principles

Based on analysis of existing screens (Project Planning View, Code Quality View, Agent Performance View), the following design principles guide ST-64:

### Core Principles

1. **Information Clarity Over Decoration**
   - Maximize relevant data visibility without clutter
   - Use progressive disclosure (summary → detail → deep detail)
   - Clear visual hierarchy with typography and spacing

2. **Consistency Across Screens**
   - Reuse HeadlessUI Tab.Group pattern for all tabbed interfaces
   - Consistent modal sizes: `max-w-md` (small), `max-w-2xl` (medium), `max-w-4xl` (large)
   - Uniform spacing: `p-4`, `p-6`, `gap-4`, `gap-6`
   - Standard border radius: `rounded-lg`, `rounded-2xl` for modals

3. **Dark Mode First**
   - Design for dark mode, verify light mode compatibility
   - Use CSS variables for all colors (no hardcoded values)
   - Ensure 4.5:1 contrast ratio minimum (WCAG AA)

4. **Performance-Conscious Design**
   - Virtual scrolling for lists with 100+ items
   - Lazy load tabs (load content only when tab is active)
   - Debounced search (300ms delay)
   - Optimistic UI updates for mutations

5. **Accessibility By Default**
   - Full keyboard navigation support
   - Proper ARIA labels and roles
   - Focus indicators visible in all states
   - Screen reader announcements for dynamic content

---

## 2. Color Palette & Typography

### Color System (CSS Variables)

**Light Theme:**
```css
--bg: #ffffff;
--bg-secondary: #f8f9fa;
--fg: #1a1a1a;
--muted: #6b7280;
--card: #ffffff;
--border: #e5e7eb;
--accent: #667eea;
--accent-dark: #5568d3;
--accent-fg: #ffffff;
--ring: rgba(102, 126, 234, 0.5);
```

**Dark Theme:**
```css
--bg: #0f172a;
--bg-secondary: #1e293b;
--fg: #f1f5f9;
--muted: #94a3b8;
--card: #1e293b;
--border: #334155;
--accent: #818cf8;
--accent-dark: #6366f1;
--accent-fg: #ffffff;
--ring: rgba(129, 140, 248, 0.5);
```

### Semantic Colors

**Status Colors:**
- Success: `#10b981` (green-500)
- Warning: `#f59e0b` (amber-500)
- Error: `#ef4444` (red-500)
- Info: `#3b82f6` (blue-500)

**Version Badge Colors:**
- Active Version: `bg-accent text-accent-fg`
- Inactive Version: `bg-muted/20 text-muted`
- Latest Version: `bg-gradient-to-r from-accent to-accent-dark text-accent-fg`
- Major Version: `border-2 border-accent` (outline style)

### Typography

**Font Family:**
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Avenir, Helvetica, Arial, sans-serif;
```

**Type Scale:**
- Display (H1): `text-4xl font-bold` (36px)
- Heading (H2): `text-2xl font-bold` (24px)
- Subheading (H3): `text-xl font-semibold` (20px)
- Body: `text-base` (16px)
- Small: `text-sm` (14px)
- Caption: `text-xs` (12px)

**Monospace (Code/Checksums):**
```css
font-family: 'Monaco', 'Courier New', monospace;
```

---

## 3. Component-by-Component UX Design

### A. Component Version History Tab

**Purpose:** Visualize version lineage, compare versions, and understand version evolution.

#### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ Version History                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─── Version Timeline ───────────────────────────────────────┐ │
│ │                                                             │ │
│ │   v1.0 ─────○───── v1.1 ─────○───── v2.0 (Latest)          │ │
│ │       (Base)     (Minor)      (Major)                       │ │
│ │         │           │            │                          │ │
│ │     2 weeks    1 week ago      2 days ago                   │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─── Version Comparison Table ────────────────────────────────┐ │
│ │ Version │ Created      │ Status  │ Workflows │ Executions  │ │
│ ├─────────┼──────────────┼─────────┼───────────┼─────────────┤ │
│ │ v2.0 ✨ │ 2 days ago   │ Active  │ 3         │ 42          │ │
│ │ v1.1    │ 1 week ago   │ Inactive│ 0         │ 156         │ │
│ │ v1.0    │ 2 weeks ago  │ Inactive│ 0         │ 89          │ │
│ └─────────┴──────────────┴─────────┴───────────┴─────────────┘ │
│                                                                 │
│ [ Compare Selected Versions ]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Layout Wireframe

**Structure:**
1. **Tab Header** (HeadlessUI Tab.List)
   - Icon: Clock icon from heroicons
   - Label: "Version History"
   - Active state: `border-b-2 border-accent text-accent`

2. **Timeline Section** (Top 40% of tab content)
   - SVG-based interactive timeline
   - Horizontal layout with version nodes
   - Connecting lines showing lineage
   - Hover: tooltip with version details

3. **Version Table** (Bottom 60% of tab content)
   - Sticky header row
   - Checkbox column for version selection (max 2)
   - Badge column showing latest/active status
   - Sortable columns (click header to sort)
   - Row actions: View Details, Clone Version

4. **Compare Button** (Fixed bottom bar)
   - Disabled until 2 versions selected
   - Opens Version Comparison Modal

#### Interactive States

**Default State:**
- Timeline shows all versions chronologically
- Table shows all versions, sorted by created date (newest first)
- Compare button disabled
- No versions selected

**Hover States:**
- Timeline nodes: Scale up 110%, show tooltip with checksum
- Table rows: Background `bg-bg-secondary`, show action icons
- Compare button: Darken background when enabled

**Active State:**
- Selected versions: Checkbox checked, row highlighted `bg-accent/10`
- Compare button: `bg-accent text-accent-fg` when 2 versions selected

**Loading State:**
- Timeline skeleton: Gray circles with pulse animation
- Table skeleton: 3 rows of gray bars

**Error State:**
- Red banner at top: "Failed to load version history. [Retry]"
- Empty state fallback

**Empty State:**
- Icon: DocumentMagnifyingGlassIcon
- Message: "No version history available"
- Subtext: "This is the first version of this component"

#### Responsive Behavior

**Desktop (≥1024px):**
- Timeline: Full width, 200px height
- Table: 6 columns visible
- Compare button: Fixed bottom-right

**Tablet (768px - 1023px):**
- Timeline: Reduced to vertical dots (compact)
- Table: 4 columns (hide Workflows, Executions)
- Compare button: Full width at bottom

**Mobile (≤767px):**
- Timeline: Hide, show only latest version badge
- Table: Card view (stacked), 1 version per card
- Compare button: Sticky bottom sheet

#### Accessibility Considerations

- **Keyboard Navigation:**
  - Tab to focus timeline nodes
  - Arrow keys to navigate between nodes
  - Space to select version for comparison
  - Enter to view version details

- **ARIA Labels:**
  - Timeline: `role="region" aria-label="Version timeline"`
  - Table: `role="table" aria-label="Version history table"`
  - Checkbox: `aria-label="Select version {version} for comparison"`
  - Compare button: `aria-disabled="true"` when disabled

- **Screen Reader:**
  - Announce version count: "Showing 3 versions"
  - Announce selection: "Version 2.0 selected. 1 of 2 versions selected."
  - Announce comparison: "Comparing version 2.0 and version 1.1"

#### Dark Mode Considerations

- Timeline nodes: `border-accent` with `bg-card` fill
- Active node: `bg-accent` with `text-accent-fg` label
- Table borders: `border-border` (adapts to theme)
- Badge backgrounds: Use semantic status colors

---

### B. Component Usage Analytics Tab

**Purpose:** Show workflows, executions, and performance metrics for the selected component version.

#### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ Usage Analytics                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─── Performance Metrics (Cards) ──────────────────────────────┐ │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐                │ │
│ │ │ Success    │ │ Avg        │ │ Total Cost │                │ │
│ │ │ Rate       │ │ Duration   │ │            │                │ │
│ │ │            │ │            │ │            │                │ │
│ │ │  94.2%  ✓  │ │  2.3s      │ │  $4.52     │                │ │
│ │ └────────────┘ └────────────┘ └────────────┘                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─── Workflows Using This Version ────────────────────────────┐ │
│ │ Workflow Name          │ Last Run    │ Status   │ Actions   │ │
│ ├────────────────────────┼─────────────┼──────────┼───────────┤ │
│ │ Story Execution Flow   │ 2 hrs ago   │ ✓ Active │ View →    │ │
│ │ Epic Analysis Pipeline │ 1 day ago   │ ✓ Active │ View →    │ │
│ │ Code Review Workflow   │ 3 days ago  │ ⚠ Paused │ View →    │ │
│ └────────────────────────┴─────────────┴──────────┴───────────┘ │
│                                                                 │
│ ┌─── Execution History ────────────────────────────────────────┐ │
│ │ Time Range: [ Last 7 days ▼ ]                   📊 Export   │ │
│ │                                                             │ │
│ │ Run ID      │ Workflow   │ Started        │ Duration │ Cost│ │
│ ├─────────────┼────────────┼────────────────┼──────────┼─────┤ │
│ │ run-abc123  │ Story Exec │ 2 hrs ago      │ 2.1s  ✓  │ $0.12│ │
│ │ run-abc122  │ Epic Anal  │ 1 day ago      │ 3.8s  ✓  │ $0.23│ │
│ │ run-abc121  │ Code Rev   │ 3 days ago     │ 1.9s  ❌ │ $0.08│ │
│ │                                        [Load More]           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Layout Wireframe

**Structure:**
1. **Metric Cards Section** (Top 20%)
   - 3-column grid on desktop
   - Auto-layout cards with icons
   - Trend indicators (↑ ↓)

2. **Workflows Table** (Middle 30%)
   - Compact table (max 5 rows)
   - "View All Workflows" link if more than 5
   - Click row to navigate to workflow detail

3. **Execution History Table** (Bottom 50%)
   - Time range selector (dropdown)
   - Export button (CSV download)
   - Virtualized scrolling for 100+ executions
   - Pagination (20 items per page)

#### Interactive States

**Default State:**
- Metrics loaded and displayed
- Workflows table shows up to 5 rows
- Execution history shows last 20 runs
- Time range: "Last 7 days"

**Hover States:**
- Metric cards: Subtle shadow elevation
- Workflow rows: Background highlight, show "View →" button
- Execution rows: Highlight row, show tooltip with full timestamps

**Loading State:**
- Skeleton cards for metrics (3 pulse boxes)
- Table skeletons (3 rows of gray bars)
- Shimmer animation

**Error State:**
- Metric cards: Show "N/A" with info icon
- Tables: Red banner "Failed to load data. [Retry]"

**Empty State:**
- Metrics: Show "0" values with info tooltip
- Workflows: "No workflows using this version"
- Executions: "No execution history available"

#### Responsive Behavior

**Desktop (≥1024px):**
- 3-column metric grid
- Full tables with all columns
- Side-by-side layout

**Tablet (768px - 1023px):**
- 2-column metric grid
- Tables: Hide "Duration" column
- Stacked layout

**Mobile (≤767px):**
- 1-column metric grid (stacked cards)
- Tables: Card view (vertical stack)
- Swipe to load more

#### Accessibility Considerations

- **Keyboard Navigation:**
  - Tab through metric cards
  - Arrow keys in table rows
  - Enter to open workflow/execution details

- **ARIA Labels:**
  - Metric cards: `role="region" aria-label="Performance metric: Success rate"`
  - Time range selector: `aria-label="Select time range for execution history"`
  - Export button: `aria-label="Export execution history as CSV"`

- **Screen Reader:**
  - Announce metric updates: "Success rate: 94.2 percent, up 3 percent from last period"
  - Table row count: "Showing 20 of 156 executions"

#### Dark Mode Considerations

- Metric cards: `bg-card` with `border border-border`
- Success metrics: Green accent (`text-green-500`)
- Error metrics: Red accent (`text-red-500`)
- Table zebra stripes: `even:bg-bg-secondary`

---

### C. Component Checksum Tab

**Purpose:** Display checksum for version integrity verification and detect tampering.

#### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ Checksum & Integrity                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─── Current Checksum ─────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ SHA-256:                                                    │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7 │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                           [ 📋 Copy ]       │ │
│ │                                                             │ │
│ │ ✓ Verified 2 days ago                                       │ │
│ │                                                             │ │
│ │ ▼ Show Calculation Details                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─── Integrity Status ─────────────────────────────────────────┐ │
│ │ ✓ No integrity issues detected                              │ │
│ │                                                             │ │
│ │ Last verified: 2 days ago by System                         │ │
│ │ Next verification: In 5 days                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─── Recent Verifications ─────────────────────────────────────┐ │
│ │ Date            │ Result   │ Verified By │ Notes            │ │
│ ├─────────────────┼──────────┼─────────────┼──────────────────┤ │
│ │ 2 days ago      │ ✓ Pass   │ System      │ Automatic check  │ │
│ │ 1 week ago      │ ✓ Pass   │ System      │ Version created  │ │
│ │ 2 weeks ago     │ ⚠ Warn   │ Admin       │ Manual verify    │ │
│ └─────────────────┴──────────┴─────────────┴──────────────────┘ │
│                                                                 │
│ [ 🔄 Re-verify Checksum Now ]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Layout Wireframe

**Structure:**
1. **Checksum Display** (Top 30%)
   - Large monospace text box (readonly)
   - Copy button (copies to clipboard)
   - Verified badge with timestamp
   - Expandable "Calculation Details" section

2. **Integrity Status Card** (Middle 20%)
   - Status badge (Pass/Warn/Fail)
   - Last verified timestamp
   - Next scheduled verification

3. **Verification History Table** (Bottom 40%)
   - Chronological list (newest first)
   - Result badge column
   - Notes column (expandable)

4. **Action Button** (Bottom bar)
   - "Re-verify Checksum Now" button
   - Triggers manual verification

#### Interactive States

**Default State:**
- Checksum displayed in readonly input
- Calculation details collapsed
- Verification history shows last 10 entries
- Re-verify button enabled

**Hover States:**
- Copy button: Tooltip "Copy checksum to clipboard"
- Expand details: Cursor pointer, text underline
- Re-verify button: Darken background

**Active State:**
- Copy button: Green checkmark for 2 seconds after copy
- Re-verify button: Loading spinner, "Verifying..."

**Loading State:**
- Checksum: Skeleton text (monospace bars)
- Status card: Pulse animation
- Table: Skeleton rows

**Error State:**
- Checksum: Red border, "Failed to load checksum"
- Status card: Red background, "Integrity check failed"
- Re-verify button: Disabled with error message

**Empty State:**
- Verification history: "No verification history available"
- Subtext: "This version has not been verified yet"

#### Expandable Section: Calculation Details

**Collapsed State:**
```
▼ Show Calculation Details
```

**Expanded State:**
```
▲ Hide Calculation Details

Checksum includes:
- Input Instructions (hashed)
- Operation Instructions (hashed)
- Output Instructions (hashed)
- Configuration (modelId, temperature, etc.)
- Tools array

Algorithm: SHA-256
Last calculated: 2 days ago
```

#### Responsive Behavior

**Desktop (≥1024px):**
- Full checksum visible (no truncation)
- Table shows all columns
- Copy button on the right

**Tablet (768px - 1023px):**
- Checksum: Truncate middle with "..."
- Table: Hide "Notes" column (click row to expand)

**Mobile (≤767px):**
- Checksum: Scroll horizontally or wrap
- Table: Card view (vertical stack)
- Copy button: Full width

#### Accessibility Considerations

- **Keyboard Navigation:**
  - Tab to copy button, press Enter to copy
  - Tab to expand details, press Space to toggle
  - Tab to re-verify button, press Enter to execute

- **ARIA Labels:**
  - Checksum input: `aria-label="Component version checksum" aria-readonly="true"`
  - Copy button: `aria-label="Copy checksum to clipboard"`
  - Re-verify button: `aria-label="Re-verify component checksum now"`

- **Screen Reader:**
  - Copy action: Announce "Checksum copied to clipboard"
  - Expand details: Announce "Calculation details expanded/collapsed"
  - Re-verify: Announce "Checksum verification in progress..."

#### Dark Mode Considerations

- Checksum input: `bg-bg-secondary border border-border text-fg font-mono`
- Status badge (Pass): `bg-green-500/20 text-green-500`
- Status badge (Warn): `bg-amber-500/20 text-amber-500`
- Status badge (Fail): `bg-red-500/20 text-red-500`

---

### D. Coordinator Detail Modal

**Purpose:** Comprehensive view of a coordinator with 7 tabs (Overview, Version History, Components, Workflows, Execution Logs, Usage Analytics, Configuration).

#### Modal Layout

**Modal Size:** `max-w-6xl` (extra large for content-heavy tabs)

**Modal Structure:**
```
┌────────────────────────────────────────────────────────────────────┐
│ ✕                                                                  │
│                                                                    │
│ Coordinator: Story Execution Coordinator                           │
│ v2.0 • Active • Sequential Strategy • Software Development         │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ [Overview] [Version History] [Components] [Workflows] [Logs]       │
│ [Analytics] [Configuration]                                        │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ <Tab Content Here>                                                 │
│                                                                    │
│                                                                    │
│                                                                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

#### Tab 1: Overview

**Content:**
- Coordinator Instructions (markdown, readonly)
- Decision Strategy badge
- Domain badge
- Active/Inactive status toggle
- Created/Updated timestamps
- Description

**Layout:**
```
┌─── Coordinator Instructions ──────────────────────────────────────┐
│                                                                   │
│ This coordinator orchestrates story execution by spawning         │
│ component agents in sequential order: PM → BA → Architect →       │
│ Designer → Implementer → QA.                                      │
│                                                                   │
│ Key responsibilities:                                             │
│ - Validate story prerequisites                                    │
│ - Spawn component agents with context                             │
│ - Monitor component execution                                     │
│ - Handle failures and retries                                     │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─── Metadata ──────────────────────────────────────────────────────┐
│ Decision Strategy:  [Sequential]                                  │
│ Domain:            [Software Development]                         │
│ Status:            ● Active                                       │
│ Created:           2 weeks ago by System                          │
│ Last Updated:      2 days ago by Admin                            │
└───────────────────────────────────────────────────────────────────┘
```

#### Tab 2: Version History

**Same design as Component Version History Tab** (Section A above)

#### Tab 3: Components

**Purpose:** Show which components are assigned to this coordinator.

**Layout:**
```
┌─── Assigned Components ───────────────────────────────────────────┐
│ Component Name         │ Version │ Active │ Last Used  │ Actions │
├────────────────────────┼─────────┼────────┼────────────┼─────────┤
│ PM Estimator           │ v1.2    │ ✓      │ 2 hrs ago  │ View → │
│ BA Analyzer            │ v2.0    │ ✓      │ 1 day ago  │ View → │
│ Architect Assessor     │ v1.5    │ ✓      │ 3 days ago │ View → │
│ Designer UX            │ v1.1    │ ✓      │ 1 week ago │ View → │
│ Implementer Agent      │ v3.0    │ ✓      │ 2 hrs ago  │ View → │
│ QA Validator           │ v1.0    │ ✓      │ 5 hrs ago  │ View → │
└────────────────────────┴─────────┴────────┴────────────┴─────────┘

[ + Add Component ]
```

**Features:**
- Sortable columns
- Click row to open Component Detail Modal
- Add button opens component selector
- Remove button (trash icon) on hover

#### Tab 4: Workflows

**Purpose:** Show workflows that use this coordinator.

**Layout:**
```
┌─── Workflows Using This Coordinator ──────────────────────────────┐
│ Workflow Name          │ Version │ Active │ Last Run   │ Actions │
├────────────────────────┼─────────┼────────┼────────────┼─────────┤
│ Story Execution Flow   │ v2.1    │ ✓      │ 2 hrs ago  │ View → │
│ Epic Analysis Pipeline │ v1.8    │ ✓      │ 1 day ago  │ View → │
│ Sprint Planning Flow   │ v1.0    │ ⚠      │ 1 week ago │ View → │
└────────────────────────┴─────────┴────────┴────────────┴─────────┘

Total Workflows: 3
```

#### Tab 5: Execution Logs

**Purpose:** Show recent coordinator executions with logs.

**Layout:**
```
┌─── Recent Executions ─────────────────────────────────────────────┐
│ Time Range: [ Last 7 days ▼ ]                      🔍 Search Logs │
│                                                                   │
│ Run ID      │ Workflow   │ Started        │ Status │ View Logs  │
├─────────────┼────────────┼────────────────┼────────┼────────────┤
│ run-xyz789  │ Story Exec │ 2 hrs ago      │ ✓ Done │ [View] →   │
│ run-xyz788  │ Epic Anal  │ 1 day ago      │ ✓ Done │ [View] →   │
│ run-xyz787  │ Sprint Pl  │ 3 days ago     │ ❌ Fail│ [View] →   │
└─────────────┴────────────┴────────────────┴────────┴────────────┘

Click "View" to expand execution details and logs
```

**Expanded Row (Accordion Style):**
```
run-xyz789 Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Component Executions:
1. PM Estimator      ✓ 2.1s   $0.12
2. BA Analyzer       ✓ 3.8s   $0.23
3. Architect Assessor✓ 4.2s   $0.31
4. Designer UX       ✓ 1.9s   $0.08
5. Implementer Agent ✓ 8.5s   $0.62
6. QA Validator      ✓ 3.1s   $0.19

Total Duration: 23.6s
Total Cost: $1.55

[View Full Logs] [Export Logs]
```

#### Tab 6: Usage Analytics

**Same design as Component Usage Analytics Tab** (Section B above)

#### Tab 7: Configuration

**Purpose:** Edit coordinator configuration (model, temperature, tools, etc.)

**Layout:**
```
┌─── Configuration ─────────────────────────────────────────────────┐
│                                              [ Edit Mode: OFF ] ◻  │
│                                                                   │
│ Model:        [ claude-sonnet-4.5 ▼ ]                            │
│ Temperature:  [━━━●━━━━━━] 0.7                                    │
│ Max Retries:  [ 3 ▼ ]                                            │
│ Timeout:      [ 300 ] seconds                                     │
│                                                                   │
│ Tools:                                                            │
│ ☑ execute_story_with_workflow                                    │
│ ☑ record_component_start                                         │
│ ☑ record_component_complete                                      │
│ ☑ update_workflow_status                                         │
│ ☐ send_notification (optional)                                   │
│                                                                   │
│ Cost Limit:   [ $10.00 ] per execution                           │
│                                                                   │
│ On Failure:   ● Retry ○ Skip ○ Pause ○ Stop                       │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

When Edit Mode is ON:
[ Cancel ] [ Save Changes ]
```

**Edit Mode Toggle:**
- Toggle switch in top-right of tab content
- OFF: All fields disabled (readonly)
- ON: All fields editable, show Save/Cancel buttons

#### Modal Header

**Design:**
```
┌────────────────────────────────────────────────────────────────────┐
│ ✕                                                            Close │
│                                                                    │
│ Story Execution Coordinator                                        │
│ v2.0 • ● Active • Sequential • Software Development                │
│                                                                    │
│ [ Clone Version ▼ ] [ Deactivate ]                                │
└────────────────────────────────────────────────────────────────────┘
```

**Header Elements:**
- Close button (top-right)
- Coordinator name (large, bold)
- Version badge, status dot, strategy, domain (metadata row)
- Action buttons (Clone, Deactivate)

#### Interactive States

**Default State:**
- Modal opens to Overview tab
- Edit mode OFF
- All tabs lazy-loaded (only active tab fetches data)

**Hover States:**
- Tab buttons: Highlight background
- Table rows: Show action buttons
- Edit toggle: Darken knob

**Active State:**
- Selected tab: `border-b-2 border-accent`
- Edit mode ON: Fields editable, Save button enabled

**Loading State:**
- Tab content: Skeleton with shimmer
- Modal header: Load immediately (no skeleton)

**Error State:**
- Failed tab: Red banner "Failed to load {tab name}. [Retry]"
- Failed save: Toast notification "Failed to save configuration. {error message}"

#### Responsive Behavior

**Desktop (≥1024px):**
- Modal: `max-w-6xl` (large)
- Tabs: Single row, all visible
- Tables: All columns visible

**Tablet (768px - 1023px):**
- Modal: `max-w-4xl` (medium)
- Tabs: Wrap to 2 rows if needed
- Tables: Hide less important columns

**Mobile (≤767px):**
- Modal: Full screen (`inset-0`)
- Tabs: Dropdown selector (mobile pattern)
- Tables: Card view

#### Accessibility Considerations

- **Keyboard Navigation:**
  - Tab key to navigate between tabs
  - Arrow keys within tables
  - Enter to open details, Escape to close modal

- **ARIA Labels:**
  - Modal: `role="dialog" aria-labelledby="coordinator-title" aria-modal="true"`
  - Tabs: `role="tablist"` with `role="tab"` and `role="tabpanel"`
  - Edit toggle: `aria-label="Toggle edit mode" aria-pressed="false"`

- **Screen Reader:**
  - Tab change: Announce "Showing {tab name} tab"
  - Edit mode: Announce "Edit mode enabled/disabled"
  - Save success: Announce "Configuration saved successfully"

#### Dark Mode Considerations

- Modal background: `bg-card` (dark theme: `#1e293b`)
- Tab borders: `border-border` (dark theme: `#334155`)
- Active tab indicator: `border-accent` (dark theme: `#818cf8`)
- Edit toggle: `bg-accent` when ON, `bg-muted` when OFF

---

### E. Workflow Version History Tab

**Purpose:** Visualize workflow version evolution, showing coordinator and component version changes.

#### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ Workflow Version History                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─── Version Timeline (Interactive) ───────────────────────────┐ │
│ │                                                             │ │
│ │   v1.0 ───○─── v1.1 ───○─── v1.2 ───○─── v2.0 (Latest)     │ │
│ │     Base     Minor     Minor     Major                      │ │
│ │      │         │         │         │                        │ │
│ │   1 month  2 weeks   1 week   2 days ago                    │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─── Version Comparison ────────────────────────────────────────┐ │
│ │ Select versions to compare: [ v2.0 ▼ ] vs [ v1.2 ▼ ]        │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Component          │ v2.0        │ v1.2        │ Change │ │ │
│ │ ├────────────────────┼─────────────┼─────────────┼────────┤ │ │
│ │ │ Coordinator        │ v3.0 ↑      │ v2.1        │ Upgrade│ │ │
│ │ │ PM Estimator       │ v1.2        │ v1.2        │ Same   │ │ │
│ │ │ BA Analyzer        │ v2.1 ↑      │ v2.0        │ Upgrade│ │ │
│ │ │ Architect Assessor │ v1.5        │ v1.5        │ Same   │ │ │
│ │ │ Designer UX        │ v1.3 ↑      │ v1.1        │ Upgrade│ │ │
│ │ │ Implementer Agent  │ v3.0        │ v3.0        │ Same   │ │ │
│ │ │ QA Validator       │ v1.1 ↑      │ v1.0        │ Upgrade│ │ │
│ │ └────────────────────┴─────────────┴─────────────┴────────┘ │ │
│ │                                                             │ │
│ │ Legend: ↑ Upgraded  ↓ Downgraded  ─ Same  ✨ New  ❌ Removed │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─── Trigger Configuration Changes ────────────────────────────┐ │
│ │ v2.0:  Trigger: Manual, Filters: None                        │ │
│ │ v1.2:  Trigger: Manual, Filters: None                        │ │
│ │ Change: ✓ No changes to trigger config                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [ View Full Diff ] [ Clone Version ]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Layout Wireframe

**Structure:**
1. **Timeline Section** (Top 25%)
   - Interactive SVG timeline with version nodes
   - Click node to select for comparison
   - Hover shows tooltip with version details

2. **Version Selector** (Below timeline)
   - Two dropdown selectors (left vs right)
   - Auto-select latest and previous version on load

3. **Component Comparison Table** (Middle 50%)
   - Shows coordinator + all components
   - Version column for each selected version
   - Change indicator column (↑ ↓ ─ ✨ ❌)

4. **Trigger Config Section** (Bottom 15%)
   - Side-by-side comparison of trigger settings
   - Highlight changes with background color

5. **Action Buttons** (Footer)
   - "View Full Diff" → Opens Version Comparison Modal
   - "Clone Version" → Opens Create Version Modal

#### Interactive States

**Default State:**
- Timeline shows all workflow versions
- Comparison: v2.0 vs v1.2 (latest vs previous)
- Table shows all components with version differences highlighted

**Hover States:**
- Timeline nodes: Tooltip with "Version {v}, Created {date}, {n} changes"
- Table rows: Highlight row, show component detail link
- Change indicators: Tooltip explaining change type

**Active State:**
- Selected timeline nodes: Highlighted with accent border
- Version selectors: Show selected version

**Loading State:**
- Timeline: Skeleton circles with pulse
- Table: Skeleton rows

**Error State:**
- Timeline: "Failed to load version history. [Retry]"
- Table: Empty state with error message

**Empty State:**
- "No version history available. This is the first workflow version."

#### Responsive Behavior

**Desktop (≥1024px):**
- Timeline: Full width, horizontal
- Table: All columns visible
- Side-by-side trigger comparison

**Tablet (768px - 1023px):**
- Timeline: Compact horizontal
- Table: Hide "Change" column (use color coding)
- Stacked trigger comparison

**Mobile (≤767px):**
- Timeline: Vertical dots (compact)
- Table: Card view (1 version per card)
- Trigger config: Accordion (expand to compare)

#### Accessibility Considerations

- **Keyboard Navigation:**
  - Tab to focus timeline, arrow keys to select nodes
  - Tab through version selectors, Enter to open dropdown
  - Tab through table rows, Enter to view component details

- **ARIA Labels:**
  - Timeline: `aria-label="Workflow version timeline"`
  - Version selectors: `aria-label="Select workflow version for comparison"`
  - Change indicators: `aria-label="Component upgraded from v1.0 to v1.1"`

- **Screen Reader:**
  - Announce selected versions: "Comparing version 2.0 and version 1.2"
  - Announce changes: "4 components upgraded, 3 unchanged"

#### Dark Mode Considerations

- Timeline nodes: `bg-card border-accent`
- Change indicators:
  - Upgrade: `text-green-500`
  - Downgrade: `text-amber-500`
  - Same: `text-muted`
  - New: `text-blue-500`
  - Removed: `text-red-500`

---

### F. Version Comparison Modal

**Purpose:** Shared component for side-by-side version comparison with diff view (used by Components, Coordinators, Workflows).

#### Modal Layout

**Modal Size:** `max-w-6xl` (extra large for side-by-side content)

**Modal Structure:**
```
┌────────────────────────────────────────────────────────────────────┐
│ ✕                                                                  │
│                                                                    │
│ Comparing Component: PM Estimator                                  │
│ v2.0 (Latest) ↔ v1.2                                              │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ [Summary] [Instructions] [Configuration] [Metadata]                │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ <Diff Content Here>                                                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

#### Tab 1: Summary

**Purpose:** High-level comparison summary.

**Layout:**
```
┌─── Changes Summary ───────────────────────────────────────────────┐
│                                                                   │
│ Version v2.0 (Right) vs v1.2 (Left)                              │
│                                                                   │
│ ✓ 3 sections changed                                              │
│   • Input Instructions: Modified                                  │
│   • Operation Instructions: Modified                              │
│   • Configuration: 2 fields changed                               │
│                                                                   │
│ ⚠ Breaking changes detected:                                      │
│   • Model changed: claude-3.5-sonnet → claude-sonnet-4.5         │
│   • Tools added: execute_story_with_workflow                      │
│                                                                   │
│ Checksum:                                                         │
│   Old: a3f5b2c1d4e6...                                           │
│   New: x7y8z9a0b1c2...                                           │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─── Impact Analysis ───────────────────────────────────────────────┐
│                                                                   │
│ Workflows affected: 3                                             │
│ Active executions: 0 (safe to upgrade)                            │
│                                                                   │
│ Recommendation: ✓ Safe to deploy                                  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

[ Approve & Deploy ] [ Cancel ]
```

#### Tab 2: Instructions

**Purpose:** Side-by-side diff of instruction sections.

**Layout:**
```
┌─── Input Instructions ────────────────────────────────────────────┐
│ v1.2 (Left)                    │ v2.0 (Right)                     │
├────────────────────────────────┼──────────────────────────────────┤
│ Read story title and           │ Read story title and             │
│ description.                   │ description.                     │
│                                │                                  │
│ Extract business complexity.   │ Extract business complexity and  │
│                                │ ┃ technical complexity.          │ (Added line, green bg)
│                                │                                  │
│ Analyze requirements.          │ Analyze requirements using       │
│                                │ ┃ context7 library docs.         │ (Added line, green bg)
└────────────────────────────────┴──────────────────────────────────┘

┌─── Operation Instructions ────────────────────────────────────────┐
│ v1.2 (Left)                    │ v2.0 (Right)                     │
├────────────────────────────────┼──────────────────────────────────┤
│ Calculate effort estimate      │ Calculate effort estimate        │
│ using fibonacci scale.         │ ┃ using t-shirt sizing.          │ (Modified line, amber bg)
│                                │                                  │
│ Return estimate in hours.      │ Return estimate in hours.        │
└────────────────────────────────┴──────────────────────────────────┘

Legend:
┃ Green background = Added line
┃ Red background = Removed line
┃ Amber background = Modified line
```

**Diff Rendering:**
- Use syntax highlighting for code blocks
- Line-by-line comparison with alignment
- Color coding:
  - Added: `bg-green-500/20` (light theme), `bg-green-500/10` (dark theme)
  - Removed: `bg-red-500/20`, `bg-red-500/10`
  - Modified: `bg-amber-500/20`, `bg-amber-500/10`

#### Tab 3: Configuration

**Purpose:** Show configuration field changes.

**Layout:**
```
┌─── Configuration Changes ─────────────────────────────────────────┐
│ Field            │ v1.2 (Old)           │ v2.0 (New)            │
├──────────────────┼──────────────────────┼───────────────────────┤
│ Model            │ claude-3.5-sonnet    │ claude-sonnet-4.5  ↑  │ (Changed, arrow indicator)
│ Temperature      │ 0.7                  │ 0.7                   │ (Unchanged)
│ Max Retries      │ 3                    │ 3                     │ (Unchanged)
│ Timeout          │ 300s                 │ 600s               ↑  │ (Changed)
│ Cost Limit       │ $5.00                │ $10.00             ↑  │ (Changed)
│ Tools            │ 2 tools              │ 3 tools            ↑  │ (Changed, click to expand)
│ On Failure       │ Retry                │ Retry                 │ (Unchanged)
└──────────────────┴──────────────────────┴───────────────────────┘

Click "Tools" row to expand:
┌─── Tools Diff ────────────────────────────────────────────────────┐
│ v1.2 (Old)                     │ v2.0 (New)                       │
├────────────────────────────────┼──────────────────────────────────┤
│ ☑ record_component_start       │ ☑ record_component_start         │
│ ☑ record_component_complete    │ ☑ record_component_complete      │
│                                │ ┃ ☑ execute_story_with_workflow  │ (Added tool, green)
└────────────────────────────────┴──────────────────────────────────┘
```

#### Tab 4: Metadata

**Purpose:** Show metadata differences (version, timestamps, active status).

**Layout:**
```
┌─── Metadata Comparison ───────────────────────────────────────────┐
│ Field            │ v1.2                 │ v2.0                  │
├──────────────────┼──────────────────────┼───────────────────────┤
│ Version          │ v1.2 (Minor)         │ v2.0 (Major)       ↑  │
│ Active           │ ✓ Yes                │ ✓ Yes                 │
│ Created          │ 2 weeks ago          │ 2 days ago            │
│ Created By       │ System               │ Admin                 │
│ Checksum         │ a3f5b2c1...          │ x7y8z9a0...           │
│ Workflows Using  │ 0                    │ 3                  ↑  │
│ Executions       │ 156                  │ 42                    │
└──────────────────┴──────────────────────┴───────────────────────┘
```

#### Interactive States

**Default State:**
- Modal opens to Summary tab
- All tabs lazy-loaded
- Left version: Older, Right version: Newer

**Hover States:**
- Tab buttons: Background highlight
- Diff lines: Show line numbers
- Changed fields: Tooltip with details

**Active State:**
- Selected tab: `border-b-2 border-accent`
- Expanded rows: Show nested diff

**Loading State:**
- Tab content: Skeleton with shimmer
- Diff view: Loading spinner

**Error State:**
- Failed diff: "Failed to compare versions. [Retry]"
- Partial failure: Show available tabs, disable failed tabs

#### Responsive Behavior

**Desktop (≥1024px):**
- Side-by-side layout (50/50 split)
- All tabs visible
- Full diff content

**Tablet (768px - 1023px):**
- Side-by-side layout (slightly narrower)
- Tabs wrap to 2 rows if needed
- Truncate long lines

**Mobile (≤767px):**
- Stacked layout (vertical, not side-by-side)
- Tabs as dropdown selector
- Swipe between versions

#### Accessibility Considerations

- **Keyboard Navigation:**
  - Tab to navigate between tabs
  - Arrow keys to scroll diff content
  - Enter to expand/collapse rows

- **ARIA Labels:**
  - Modal: `role="dialog" aria-labelledby="comparison-title"`
  - Diff regions: `role="region" aria-label="Version comparison: {section}"`
  - Change indicators: `aria-label="Field changed from {old} to {new}"`

- **Screen Reader:**
  - Announce tab change: "Showing {tab name} comparison"
  - Announce changes: "{n} fields changed, {m} fields unchanged"

#### Dark Mode Considerations

- Diff backgrounds:
  - Added: `bg-green-500/10 border-l-4 border-green-500`
  - Removed: `bg-red-500/10 border-l-4 border-red-500`
  - Modified: `bg-amber-500/10 border-l-4 border-amber-500`
- Modal background: `bg-card`
- Tab borders: `border-border`

---

## 4. User Flows

### Flow 1: View Component Version History

**Actor:** Developer / PM / Architect

**Steps:**
1. Navigate to Component Library List View
2. Click on a component card → Opens Component Detail Modal
3. Click "Version History" tab
4. View timeline and version table
5. (Optional) Select 2 versions for comparison
6. Click "Compare Selected Versions" button
7. Version Comparison Modal opens
8. Review changes in Summary, Instructions, Configuration tabs
9. Close modal

**Expected Outcome:** User understands version evolution and differences.

**Success Metrics:**
- Time to view version history: < 3 seconds
- Time to compare versions: < 5 seconds
- Modal load time: < 1 second

---

### Flow 2: Create New Component Version

**Actor:** Admin / Architect

**Steps:**
1. Open Component Detail Modal
2. Click "Clone Version" button (dropdown)
3. Select "Create Minor Version" or "Create Major Version"
4. Create Version Modal opens
5. Fill in change description (optional)
6. Review preview of new version number
7. Click "Create Version"
8. Backend creates new version (API call)
9. Success toast notification appears
10. Modal closes, Version History tab refreshes
11. New version appears in timeline

**Expected Outcome:** New version created successfully, visible in history.

**Success Metrics:**
- Version creation time: < 2 seconds
- Success rate: > 99%
- Zero data loss

---

### Flow 3: Deactivate Component Version

**Actor:** Admin

**Steps:**
1. Open Component Detail Modal (showing active version)
2. Click "Deactivate" button
3. Deactivate Modal opens with warning:
   - "This will affect {n} workflows"
   - List workflows using this version
4. User confirms deactivation
5. Backend deactivates version (API call)
6. Success toast notification
7. Modal refreshes, status badge changes to "Inactive"
8. Workflows using this version show warning banner

**Expected Outcome:** Version deactivated, workflows warned.

**Success Metrics:**
- Deactivation time: < 2 seconds
- Zero accidental deactivations (clear warnings)

---

### Flow 4: View Workflow Version Changes

**Actor:** PM / Admin

**Steps:**
1. Navigate to Workflow Management View
2. Click on a workflow → Opens Workflow Detail Modal
3. Click "Version History" tab
4. View timeline showing workflow versions
5. Select two versions for comparison (e.g., v2.0 vs v1.2)
6. View component version changes table
7. Identify upgraded components (green arrows)
8. Click "View Full Diff" button
9. Version Comparison Modal opens
10. Review Summary tab showing breaking changes
11. Review Instructions tab showing coordinator changes
12. Close modal

**Expected Outcome:** User understands workflow version differences.

**Success Metrics:**
- Time to view workflow history: < 3 seconds
- Time to identify breaking changes: < 10 seconds

---

### Flow 5: Verify Component Checksum

**Actor:** Security Admin / DevOps

**Steps:**
1. Open Component Detail Modal
2. Click "Checksum" tab
3. View current checksum
4. Click "Copy" button (copies to clipboard)
5. Paste checksum into verification tool
6. (Optional) Click "Show Calculation Details" to expand
7. View checksum algorithm, included fields
8. Check "Integrity Status" card (Pass/Warn/Fail)
9. Review "Recent Verifications" table
10. (Optional) Click "Re-verify Checksum Now" button
11. Wait for verification (loading spinner)
12. See updated verification result

**Expected Outcome:** Checksum verified, integrity confirmed.

**Success Metrics:**
- Checksum copy time: < 1 second
- Re-verification time: < 3 seconds

---

## 5. Edge Cases & Empty States

### Edge Case 1: No Version History

**Scenario:** Component has only 1 version (no history).

**Empty State Design:**
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                   📜 No Version History                       │
│                                                               │
│          This is the first version of this component.         │
│                                                               │
│          Future versions will appear here.                    │
│                                                               │
│                   [ Create New Version ]                      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Actions:**
- Show timeline with single node (current version)
- Disable "Compare Versions" button
- Show informative empty state message

---

### Edge Case 2: No Workflows Using Version

**Scenario:** Component version is not used by any workflow.

**Empty State Design:**
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│              🔗 No Workflows Using This Version               │
│                                                               │
│     This component version is not assigned to any workflow.   │
│                                                               │
│     Assign it to a workflow to start tracking usage.          │
│                                                               │
│                   [ Browse Workflows ]                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Actions:**
- Show empty workflows table
- Provide link to Workflow Management View
- Show "Add to Workflow" button (if applicable)

---

### Edge Case 3: No Execution History

**Scenario:** Component version has never been executed.

**Empty State Design:**
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                 ⏱️ No Execution History                        │
│                                                               │
│    This component version has not been executed yet.          │
│                                                               │
│    Executions will appear here once workflows run.            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Actions:**
- Show empty execution table
- Show zero metrics (0% success rate, $0.00 cost)
- Provide context about why no executions

---

### Edge Case 4: Version Comparison with No Changes

**Scenario:** User selects same version twice, or identical versions.

**Behavior:**
- Prevent selection: Disable dropdown option if same version already selected
- If somehow selected: Show message "Selected versions are identical. No changes to display."
- Disable "Compare" button

---

### Edge Case 5: Checksum Verification Failed

**Scenario:** Checksum verification detects tampering.

**Error State Design:**
```
┌───────────────────────────────────────────────────────────────┐
│ ⚠️ Integrity Check Failed                                     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Current Checksum:  x7y8z9a0b1c2d3e4f5g6h7i8j9k0...          │
│ Expected Checksum: a3f5b2c1d4e6f7g8h9i0j1k2l3m4...          │
│                                                               │
│ ❌ Checksums do not match. This version may have been         │
│    modified outside the versioning system.                    │
│                                                               │
│ Recommended actions:                                          │
│ • Review recent changes in audit log                          │
│ • Contact security team                                       │
│ • Do not use this version in production                       │
│                                                               │
│ [ View Audit Log ] [ Report Issue ] [ Re-verify ]             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Actions:**
- Show red alert banner
- Display both checksums for manual comparison
- Provide actionable next steps
- Disable version activation if checksum fails

---

### Edge Case 6: Large Version History (100+ Versions)

**Scenario:** Component has accumulated many versions over time.

**Optimization:**
- **Timeline:** Show only major versions + last 5 minor versions, with "Show All" toggle
- **Table:** Virtual scrolling (render only visible rows)
- **Pagination:** Load 20 versions at a time, infinite scroll
- **Search:** Add search input to filter versions by date range or version number

**Performance Target:**
- Initial render: < 2 seconds
- Scroll performance: 60 FPS
- Search response: < 300ms

---

### Edge Case 7: Coordinator with 20+ Components

**Scenario:** Coordinator has many assigned components.

**Optimization:**
- **Table:** Virtual scrolling for component list
- **Grouping:** Group by component type or domain
- **Search:** Filter components by name
- **Pagination:** Load 20 components at a time

---

## 6. Animation & Transitions

### Transition Durations

**Global Standards:**
- Modal open/close: `300ms ease-out`
- Tab switch: `200ms ease-in-out`
- Hover effects: `150ms ease-in-out`
- Loading skeletons: `1.5s infinite pulse`
- Toast notifications: `200ms slide-in`, `3s delay`, `200ms fade-out`

### Modal Animations

**Open Animation (HeadlessUI Transition):**
```tsx
<Transition.Child
  enter="ease-out duration-300"
  enterFrom="opacity-0 scale-95"
  enterTo="opacity-100 scale-100"
  leave="ease-in duration-200"
  leaveFrom="opacity-100 scale-100"
  leaveTo="opacity-0 scale-95"
>
```

**Effect:**
- Modal fades in (0 → 100% opacity)
- Modal scales up (95% → 100%)
- Backdrop fades in (0 → 25% opacity)

---

### Tab Switch Animations

**HeadlessUI Tab Transition:**
```tsx
<Tab.Panel
  className="transition-opacity duration-200"
>
```

**Effect:**
- Old tab fades out (100% → 0% opacity)
- New tab fades in (0 → 100% opacity)
- Smooth crossfade, no jarring jumps

---

### Timeline Node Interactions

**Hover Animation:**
```css
.timeline-node:hover {
  transform: scale(1.1);
  transition: transform 150ms ease-in-out;
}
```

**Click Animation:**
```css
.timeline-node:active {
  transform: scale(0.95);
  transition: transform 100ms ease-in-out;
}
```

**Effect:**
- Node grows on hover (visual feedback)
- Node shrinks on click (button press effect)

---

### Table Row Hover

**Animation:**
```css
.table-row {
  transition: background-color 150ms ease-in-out;
}

.table-row:hover {
  background-color: var(--bg-secondary);
}
```

**Effect:**
- Smooth background color transition
- Subtle highlight (not jarring)

---

### Loading Skeleton Pulse

**Animation:**
```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.skeleton {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

**Effect:**
- Smooth pulsing (breathing) animation
- Indicates loading state
- Non-distracting

---

### Toast Notification Slide-In

**Animation:**
```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast {
  animation: slide-in-right 200ms ease-out;
}
```

**Effect:**
- Toast slides in from right edge
- Fades in simultaneously
- Auto-dismiss after 3 seconds with fade-out

---

### Accordion Expand/Collapse

**Animation:**
```css
.accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 300ms ease-in-out;
}

.accordion-content.expanded {
  max-height: 500px; /* Adjust based on content */
}
```

**Effect:**
- Smooth height transition
- Content doesn't jump
- Feels natural and responsive

---

### Button Press Effect

**Animation:**
```css
button:active {
  transform: scale(0.98);
  transition: transform 100ms ease-in-out;
}
```

**Effect:**
- Button slightly shrinks on click
- Tactile feedback for users
- Confirms interaction

---

## 7. Accessibility Checklist

### WCAG 2.1 AA Compliance

#### 1. Perceivable

- [ ] **Color Contrast Ratio** (1.4.3)
  - All text: Minimum 4.5:1 ratio (normal text)
  - Large text (18pt+): Minimum 3:1 ratio
  - Tested with contrast checker for light and dark modes
  - Status colors (success/warning/error) meet contrast requirements

- [ ] **Non-Text Content** (1.1.1)
  - All icons have `aria-label` or adjacent text labels
  - Timeline nodes have tooltips with text descriptions
  - Status badges have text labels, not just colors

- [ ] **Info and Relationships** (1.3.1)
  - Tables use proper semantic markup (`<table>`, `<th>`, `<td>`)
  - Headings use proper hierarchy (`<h1>`, `<h2>`, `<h3>`)
  - Form labels associated with inputs (`<label for="...">`)

- [ ] **Meaningful Sequence** (1.3.2)
  - Reading order makes sense (top to bottom, left to right)
  - Tab order follows visual order
  - No layout-only tables (CSS Grid/Flexbox used instead)

- [ ] **Sensory Characteristics** (1.3.3)
  - Instructions don't rely solely on color ("click the green button")
  - Use text labels with icons ("✓ Active" not just "✓")
  - Shape and position used with text labels

- [ ] **Resize Text** (1.4.4)
  - Text can be resized to 200% without loss of functionality
  - No horizontal scrolling at 200% zoom
  - Tested with browser zoom at 200%

- [ ] **Images of Text** (1.4.5)
  - No images of text (use actual text with CSS styling)
  - Checksums use monospace font, not images

#### 2. Operable

- [ ] **Keyboard Accessible** (2.1.1)
  - All interactive elements accessible via keyboard
  - Tab key navigates through all controls
  - Enter/Space activates buttons and links
  - Escape closes modals

- [ ] **No Keyboard Trap** (2.1.2)
  - Users can navigate in and out of all components
  - Modal focus trap allows Escape to exit
  - Tab navigation cycles correctly within modals

- [ ] **Focus Visible** (2.4.7)
  - All focusable elements have visible focus indicator
  - Focus ring: `ring-2 ring-accent` (clear and distinct)
  - Focus indicator meets 3:1 contrast ratio

- [ ] **Focus Order** (2.4.3)
  - Tab order is logical and intuitive
  - Follows visual layout (left to right, top to bottom)
  - No unexpected focus jumps

- [ ] **Link Purpose** (2.4.4)
  - Link text describes destination ("View Component Details")
  - No generic "Click here" links
  - `aria-label` used when link text insufficient

- [ ] **Multiple Ways** (2.4.5)
  - Multiple ways to find content (search, navigation, breadcrumbs)
  - Version timeline + table provides two ways to browse versions

- [ ] **Headings and Labels** (2.4.6)
  - Descriptive headings for all sections
  - Form labels describe purpose
  - Section headings use semantic HTML (`<h2>`, `<h3>`)

- [ ] **Bypass Blocks** (2.4.1)
  - "Skip to main content" link at top of page
  - Keyboard users can skip navigation

#### 3. Understandable

- [ ] **Language of Page** (3.1.1)
  - `<html lang="en">` attribute set
  - Screen readers use correct pronunciation

- [ ] **On Focus** (3.2.1)
  - No unexpected context changes on focus
  - Dropdowns don't auto-submit on focus

- [ ] **On Input** (3.2.2)
  - No unexpected context changes on input
  - Forms don't auto-submit while typing

- [ ] **Consistent Navigation** (3.2.3)
  - Navigation menu consistent across pages
  - Breadcrumbs always in same location

- [ ] **Consistent Identification** (3.2.4)
  - Icons used consistently (same icon for same function)
  - Button labels consistent across views

- [ ] **Error Identification** (3.3.1)
  - Form errors clearly identified with text messages
  - Red border + error message below field

- [ ] **Labels or Instructions** (3.3.2)
  - All form fields have labels
  - Required fields marked with `*` and text "(required)"

- [ ] **Error Suggestion** (3.3.3)
  - Error messages suggest corrections
  - Example: "Version name must start with 'v' (e.g., v1.0)"

#### 4. Robust

- [ ] **Parsing** (4.1.1)
  - Valid HTML (no duplicate IDs, proper nesting)
  - Tested with W3C validator

- [ ] **Name, Role, Value** (4.1.2)
  - All UI components have accessible names
  - ARIA roles used correctly (`role="dialog"`, `role="tablist"`)
  - States communicated (`aria-expanded`, `aria-selected`)

- [ ] **Status Messages** (4.1.3)
  - Toast notifications use `role="status"` or `role="alert"`
  - Screen readers announce dynamic content changes
  - Loading states announced ("Loading version history...")

---

### Keyboard Shortcuts

**Global Shortcuts:**
- `Esc`: Close modal or cancel action
- `Tab`: Navigate forward through interactive elements
- `Shift + Tab`: Navigate backward
- `Enter`: Activate button or link
- `Space`: Toggle checkbox or button

**Tab Navigation:**
- `Arrow Left/Right`: Navigate between tabs (when tab has focus)
- `Home`: Jump to first tab
- `End`: Jump to last tab

**Table Navigation:**
- `Arrow Up/Down`: Navigate between table rows
- `Enter`: Open row details
- `Space`: Select row (checkbox)

**Timeline Navigation:**
- `Arrow Left/Right`: Navigate between timeline nodes
- `Space`: Select node for comparison
- `Enter`: View node details

---

### Screen Reader Testing

**Recommended Tools:**
- NVDA (Windows, free)
- JAWS (Windows, commercial)
- VoiceOver (macOS/iOS, built-in)
- TalkBack (Android, built-in)

**Testing Scenarios:**
1. Navigate through Component Detail Modal using only keyboard + screen reader
2. Compare two versions using only screen reader announcements
3. Verify all tables are navigable with screen reader table navigation
4. Ensure toast notifications are announced
5. Verify modal focus trap works correctly

---

### Mobile Accessibility

- [ ] **Touch Target Size** (2.5.5)
  - All interactive elements minimum 44x44 pixels
  - Buttons and links have adequate spacing

- [ ] **Label in Name** (2.5.3)
  - Visible label matches accessible name
  - "Save Changes" button has `aria-label="Save Changes"`

- [ ] **Motion Actuation** (2.5.4)
  - No shake-to-undo or tilt gestures (not applicable)

---

## Appendix: Design System References

### Component Library

**Reusable Components:**
1. `VersionBadge` - Displays version number with color coding
2. `StatusDot` - Active/Inactive status indicator
3. `VersionTimeline` - Interactive SVG timeline
4. `DiffViewer` - Side-by-side comparison component
5. `MetricCard` - Performance metric display
6. `ExecutionTable` - Execution history table
7. `ChecksumDisplay` - Monospace checksum with copy button
8. `EditModeToggle` - Toggle switch for edit mode

### Icon Set (Heroicons v2)

**Tab Icons:**
- Overview: `InformationCircleIcon`
- Version History: `ClockIcon`
- Components: `CubeIcon`
- Workflows: `Squares2X2Icon`
- Execution Logs: `DocumentTextIcon`
- Analytics: `ChartBarIcon`
- Configuration: `Cog6ToothIcon`
- Checksum: `ShieldCheckIcon`

**Action Icons:**
- Edit: `PencilIcon`
- Delete: `TrashIcon`
- Copy: `ClipboardDocumentIcon`
- View: `EyeIcon`
- Compare: `ArrowsRightLeftIcon`
- Clone: `DocumentDuplicateIcon`
- Activate: `CheckCircleIcon`
- Deactivate: `XCircleIcon`

---

## Conclusion

This Designer Analysis document provides comprehensive UX design specifications for ST-64 Version Management Web UI. All designs follow established patterns from existing screens, ensure accessibility compliance, and prioritize user experience across desktop, tablet, and mobile devices.

**Next Steps:**
1. **User Approval:** Review designs with stakeholders
2. **Prototype (Optional):** Create clickable Figma prototypes for user testing
3. **Implementation:** Begin frontend development using these specifications
4. **Accessibility Audit:** Test with screen readers and keyboard navigation
5. **Responsive Testing:** Verify designs on multiple devices and screen sizes

**Design Approved By:** _[Awaiting Approval]_
**Date:** _[To be filled after approval]_

---

**End of Designer Analysis**
