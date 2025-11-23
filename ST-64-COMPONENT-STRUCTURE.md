# ST-64 Component Architecture

## Component Hierarchy

```
CoordinatorLibraryView (Page)
│
├── Filter Controls (Search, Status, Domain, Workflow)
│
├── Coordinator Cards Grid
│   ├── Card 1 → Click "View Details"
│   ├── Card 2 → Click "View Details"
│   └── Card N → Click "View Details"
│
└── CoordinatorDetailModal ← **NEW COMPONENT**
    │
    ├── Header
    │   ├── Coordinator Name
    │   ├── Metadata Row (Version • Status • Strategy • Domain)
    │   └── Close Button
    │
    ├── Tab Navigation (7 Tabs)
    │   ├── [Overview]
    │   ├── [Version History]
    │   ├── [Components]
    │   ├── [Workflows]
    │   ├── [Execution Logs]
    │   ├── [Analytics]
    │   └── [Configuration]
    │
    ├── Tab Panels
    │   │
    │   ├── Overview Tab
    │   │   ├── Coordinator Instructions (readonly)
    │   │   ├── Metadata Section
    │   │   ├── Execution Configuration
    │   │   ├── MCP Tools List
    │   │   └── Usage Statistics Cards
    │   │
    │   ├── Version History Tab
    │   │   ├── Timeline (SVG nodes)
    │   │   ├── Version Cards (with checkboxes)
    │   │   └── Compare Button → VersionComparisonModal
    │   │
    │   ├── Components Tab
    │   │   └── Assigned Components Table
    │   │       ├── Component Name
    │   │       ├── Version
    │   │       ├── Active Status
    │   │       └── Tags
    │   │
    │   ├── Workflows Tab
    │   │   └── Workflows Using This Coordinator Table
    │   │       ├── Workflow Name
    │   │       ├── Version
    │   │       ├── Active Status
    │   │       └── Last Run
    │   │
    │   ├── Execution Logs Tab
    │   │   ├── Time Range Selector
    │   │   └── Execution History Table
    │   │       ├── Run ID
    │   │       ├── Workflow
    │   │       ├── Status (color-coded)
    │   │       ├── Started
    │   │       ├── Duration
    │   │       └── Cost
    │   │
    │   ├── Analytics Tab
    │   │   ├── Time Range Selector
    │   │   ├── Performance Metric Cards
    │   │   │   ├── Success Rate
    │   │   │   ├── Avg Duration
    │   │   │   └── Total Cost
    │   │   └── Export CSV Button
    │   │
    │   └── Configuration Tab
    │       ├── Edit Mode Toggle (top-right)
    │       ├── Configuration Form
    │       │   ├── Model (dropdown)
    │       │   ├── Temperature (number input)
    │       │   ├── Max Retries (dropdown)
    │       │   ├── Timeout (number input)
    │       │   ├── Cost Limit (number input)
    │       │   └── Tools (checkbox list)
    │       └── Save/Cancel Buttons (when edit mode ON)
    │
    └── Footer Actions
        ├── Close Button
        └── Edit Coordinator Button

```

## Data Flow

```
User Action → Component → Service → API
───────────────────────────────────────

1. Open Modal:
   CoordinatorLibraryView
   └→ setState(isDetailModalOpen=true)
      └→ CoordinatorDetailModal renders

2. Load Version History:
   CoordinatorDetailModal (Version History Tab)
   └→ useQuery(['coordinatorVersions', id])
      └→ versioningService.getCoordinatorVersionHistory(id)
         └→ GET /versioning/coordinators/:id/versions
            └→ Returns: CoordinatorVersion[]

3. Load Analytics:
   CoordinatorDetailModal (Analytics Tab)
   └→ useQuery(['coordinatorAnalytics', id, timeRange])
      └→ analyticsService.getCoordinatorAnalytics(id, versionId, timeRange)
         └→ GET /analytics/coordinators/:id?timeRange=30d
            └→ Returns: CoordinatorUsageAnalytics

4. Activate Version:
   CoordinatorDetailModal (Version History Tab)
   └→ useMutation(versioningService.activateCoordinatorVersion)
      └→ POST /versioning/coordinators/versions/:versionId/activate
         └→ Returns: CoordinatorVersion
            └→ invalidateQueries(['coordinatorVersions', 'coordinators'])

5. Compare Versions:
   CoordinatorDetailModal (Version History Tab)
   └→ Select 2 versions → Click "Compare"
      └→ Opens VersionComparisonModal
         └→ useQuery(versioningService.compareCoordinatorVersions)
            └→ GET /versioning/coordinators/versions/compare?versionId1=X&versionId2=Y
               └→ Returns: VersionComparison

6. Export CSV:
   CoordinatorDetailModal (Analytics Tab)
   └→ Click "Export CSV"
      └→ analyticsService.exportExecutionHistory('coordinator', id, 'csv', options)
         └→ GET /analytics/coordinators/:id/export?format=csv&timeRange=30d
            └→ Returns: Blob (CSV file)
               └→ Download via browser
```

## State Management

```typescript
// CoordinatorDetailModal Internal State
const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30d');
const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);
const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
const [isEditMode, setIsEditMode] = useState(false);

// React Query State (cached)
useQuery(['coordinatorVersions', coordinator.id])  // Version history
useQuery(['coordinatorAnalytics', coordinator.id, timeRange])  // Analytics

// Mutations
useMutation(versioningService.activateCoordinatorVersion)
useMutation(versioningService.deactivateCoordinatorVersion)
useMutation(versioningService.verifyCoordinatorChecksum)
```

## Styling System

```css
/* Dark Mode CSS Variables */
--bg: #0f172a              /* Background */
--bg-secondary: #1e293b    /* Secondary background */
--fg: #f1f5f9              /* Foreground text */
--muted: #94a3b8           /* Muted text */
--card: #1e293b            /* Card background */
--border: #334155          /* Borders */
--accent: #818cf8          /* Accent color (tabs, buttons) */
--accent-dark: #6366f1     /* Accent hover */

/* Status Colors */
--green-500: #10b981       /* Active/Success */
--red-500: #ef4444         /* Failed/Error */
--yellow-500: #f59e0b      /* Warning/Pending */
--blue-500: #3b82f6        /* Info */

/* Responsive Breakpoints */
Mobile:  ≤767px            /* Stacked layout, dropdown tabs */
Tablet:  768px - 1023px    /* 2-column grids, wrapped tabs */
Desktop: ≥1024px           /* Full layout, all tabs visible */
```

## Props Interface

```typescript
interface CoordinatorDetailModalProps {
  coordinator: CoordinatorAgent;   // Full coordinator object
  isOpen: boolean;                  // Modal visibility
  onClose: () => void;              // Close handler
  onEdit: () => void;               // Edit button handler
  onUpdate: () => void;             // Refetch data handler
}
```

## Integration Points

```
Pages:
├── CoordinatorLibraryView.tsx
│   ├── Imports: CoordinatorDetailModal
│   ├── State: selectedCoordinator, isDetailModalOpen
│   └── Renders: <CoordinatorDetailModal {...props} />
│
└── (Future) WorkflowManagementView.tsx
    └── Could show coordinator details from workflow

Services:
├── versioning.service.ts
│   ├── getCoordinatorVersionHistory()
│   ├── activateCoordinatorVersion()
│   ├── deactivateCoordinatorVersion()
│   ├── compareCoordinatorVersions()
│   └── verifyCoordinatorChecksum()
│
└── analytics.service.ts
    ├── getCoordinatorAnalytics()
    ├── getCoordinatorExecutionHistory()
    ├── getCoordinatorWorkflowsUsing()
    └── exportExecutionHistory()

Shared Components:
└── VersionComparisonModal.tsx
    └── Used by both ComponentDetailModal and CoordinatorDetailModal
```

## File Structure

```
frontend/src/
├── components/
│   ├── CoordinatorDetailModal.tsx         ← **NEW** (1,016 lines)
│   ├── ComponentDetailModal.tsx           (787 lines, existing)
│   └── VersionComparisonModal.tsx         (617 lines, existing)
│
├── pages/
│   ├── CoordinatorLibraryView.tsx         (Modified, +1 import, replaced modal)
│   ├── WorkflowManagementView.tsx         (No changes)
│   └── WorkflowDetailsPage.tsx            (Future enhancement)
│
├── services/
│   ├── versioning.service.ts              (Existing, all methods used)
│   ├── analytics.service.ts               (Existing, all methods used)
│   └── coordinators.service.ts            (Existing, CRUD operations)
│
└── types/
    └── index.ts                            (Existing, no changes needed)
```

---

**End of Architecture Documentation**
