# Workflow UX Improvements - Implementation Guide

## ✅ Completed (Backend)

### 1. Database Schema Changes
- Added `flowDiagram` field to `CoordinatorAgent` model
- Field stores compact text representation of workflow
- Schema pushed successfully to database

### 2. MCP Tool Updates
- Updated `create_coordinator` MCP tool to auto-generate flow diagrams
- Generates diagram based on:
  - Decision strategy (adaptive/sequential/parallel/conditional)
  - Component names and order
  - Coordinator instructions (detects complexity-based routing)
- Existing coordinator updated with flow diagram

### 3. Flow Diagram Format
```
PM → [Complexity Assessment]
  ├─ Trivial (BC≤3,TC≤3): Full-Stack Developer
  ├─ Simple (BC≤5,TC≤5): Full-Stack Developer → Software Architect
  ├─ Medium (BC≤7,TC≤7): Context Explore → Business Analyst → UI/UX Designer → Software Architect → Full-Stack Developer → QA Automation
  ├─ Complex (BC>7,TC>7): Context Explore → Business Analyst → UI/UX Designer → Software Architect → Full-Stack Developer → QA Automation → DevOps Engineer
  └─ Critical: Full Workflow + Validation
```

## 📋 TODO (Frontend)

### 1. Add Workflow Filter to ComponentLibraryView

**File:** `/opt/stack/AIStudio/frontend/src/pages/ComponentLibraryView.tsx`

**Implementation:**
```typescript
// Add state for workflow filter
const [selectedWorkflowFilter, setSelectedWorkflowFilter] = useState<string>('all');

// Fetch workflows for filter dropdown
const { data: workflows = [] } = useQuery({
  queryKey: ['workflows', projectId],
  queryFn: async () => {
    if (!projectId) return [];
    return workflowsService.getAll(projectId);
  },
  enabled: !!projectId,
});

// Filter components by workflow
const filteredComponents = useMemo(() => {
  let filtered = components;

  // Tag filter
  if (selectedTagFilter !== 'all') {
    filtered = filtered.filter(c => c.tags.includes(selectedTagFilter));
  }

  // Workflow filter
  if (selectedWorkflowFilter !== 'all') {
    const workflow = workflows.find(w => w.id === selectedWorkflowFilter);
    if (workflow && workflow.coordinator?.componentIds) {
      filtered = filtered.filter(c =>
        workflow.coordinator.componentIds.includes(c.id)
      );
    }
  }

  return filtered;
}, [components, selectedTagFilter, selectedWorkflowFilter, workflows]);

// Add workflow filter dropdown to UI
<select
  value={selectedWorkflowFilter}
  onChange={(e) => setSelectedWorkflowFilter(e.target.value)}
  className="filter-select"
>
  <option value="all">All Workflows</option>
  {workflows.map(workflow => (
    <option key={workflow.id} value={workflow.id}>
      {workflow.name}
    </option>
  ))}
</select>
```

### 2. Display Components in WorkflowManagementView

**File:** `/opt/stack/AIStudio/frontend/src/pages/WorkflowManagementView.tsx`

**Implementation:**
Add a section to display linked components:

```typescript
// In workflow detail view, show components
<div className="workflow-components">
  <h3>Components in this Workflow</h3>
  <div className="components-grid">
    {workflow.coordinator?.components?.map(component => (
      <ComponentCard
        key={component.id}
        component={component}
        onClick={() => navigateToComponent(component.id)}
      />
    ))}
  </div>
</div>
```

**API Changes Needed:**
- Update `workflows.service.ts` to include coordinator with components:
```typescript
export async function getWorkflow(id: string) {
  const response = await api.get(`/workflows/${id}`, {
    params: {
      includeCoordinator: true,
      includeComponents: true,
    }
  });
  return response.data;
}
```

- Backend: Update WorkflowsController to support these query params

### 3. Display Flow Diagram in CoordinatorLibraryView

**File:** `/opt/stack/AIStudio/frontend/src/pages/CoordinatorLibraryView.tsx`

**Implementation:**
Add flow diagram display in coordinator detail view:

```typescript
// In CoordinatorDetailModal or detail section
{coordinator.flowDiagram && (
  <div className="flow-diagram-section">
    <h4>Workflow Flow</h4>
    <pre className="flow-diagram">
      {coordinator.flowDiagram}
    </pre>
  </div>
)}
```

**Styling (add to CSS):**
```css
.flow-diagram-section {
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--color-bg-subtle);
  border-radius: 8px;
}

.flow-diagram {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
  padding: 1rem;
  background: var(--color-bg-primary);
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre;
}
```

### 4. Display Flow Diagram in WorkflowManagementView

**File:** `/opt/stack/AIStudio/frontend/src/pages/WorkflowManagementView.tsx`

**Implementation:**
Similar to coordinator view, show flow diagram in workflow details:

```typescript
// In workflow detail section
{workflow.coordinator?.flowDiagram && (
  <div className="workflow-flow-diagram">
    <h4>Execution Flow</h4>
    <pre className="flow-diagram">
      {workflow.coordinator.flowDiagram}
    </pre>
    <p className="text-sm text-muted">
      Components execute based on story complexity assessment
    </p>
  </div>
)}
```

### 5. Update TypeScript Types

**File:** `/opt/stack/AIStudio/frontend/src/types/index.ts` (or wherever types are defined)

```typescript
export interface CoordinatorAgent {
  id: string;
  projectId: string;
  name: string;
  description: string;
  domain: string;
  coordinatorInstructions: string;
  flowDiagram?: string | null;  // ADD THIS
  config: any;
  tools: string[];
  decisionStrategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
  componentIds: string[];
  components?: Component[];  // ADD THIS for expanded data
  active: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: string;
  projectId: string;
  coordinatorId: string;
  coordinator?: CoordinatorAgent;  // ADD THIS for expanded data
  name: string;
  description?: string;
  version: string;
  triggerConfig: any;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 6. Update API Services

**File:** `/opt/stack/AIStudio/frontend/src/services/coordinators.service.ts`

Ensure the service fetches the new `flowDiagram` field.

**File:** `/opt/stack/AIStudio/frontend/src/services/workflows.service.ts`

Add methods to fetch workflows with expanded coordinator and components:

```typescript
export const workflowsService = {
  // ... existing methods

  getWithDetails: async (id: string): Promise<Workflow> => {
    const response = await api.get(`/workflows/${id}`, {
      params: {
        includeCoordinator: true,
        includeComponents: true,
      }
    });
    return response.data;
  },

  getAllWithCoordinators: async (projectId: string): Promise<Workflow[]> => {
    const response = await api.get('/workflows', {
      params: {
        projectId,
        includeCoordinator: true,
      }
    });
    return response.data;
  },
};
```

## Backend API Changes Needed

### 1. WorkflowsController - Add Include Query Params

**File:** `/opt/stack/AIStudio/backend/src/workflows/workflows.controller.ts`

```typescript
@Get(':id')
async findOne(
  @Param('id') id: string,
  @Query('includeCoordinator') includeCoordinator?: string,
  @Query('includeComponents') includeComponents?: string,
) {
  const include: any = {};

  if (includeCoordinator === 'true') {
    include.coordinator = true;

    if (includeComponents === 'true') {
      include.coordinator = {
        include: {
          components: true,
        },
      };
    }
  }

  return this.workflowsService.findOne(id, include);
}
```

### 2. CoordinatorsController - Ensure flowDiagram is Returned

**File:** `/opt/stack/AIStudio/backend/src/coordinators/coordinators.controller.ts`

Ensure all GET endpoints return the `flowDiagram` field.

## Testing Checklist

- [ ] Create a new coordinator via MCP tool and verify flowDiagram is generated
- [ ] View coordinator in CoordinatorLibraryView and see flow diagram displayed
- [ ] View workflow in WorkflowManagementView and see:
  - [ ] Flow diagram from coordinator
  - [ ] List of linked components
- [ ] Filter components by workflow in ComponentLibraryView
- [ ] Verify flow diagram is compact and readable on mobile
- [ ] Test with different decision strategies (sequential, parallel, conditional, adaptive)

## UI/UX Considerations

1. **Space Efficiency**: Flow diagram uses compact text format with ASCII art
2. **Responsive Design**: Pre-formatted text should scroll horizontally on mobile
3. **Readability**: Monospace font with adequate line height
4. **Context**: Show flow diagram in both coordinator details and workflow details for convenience
5. **Performance**: Use lazy loading or expandable sections for large workflows

## Migration Notes

- Existing coordinators without flowDiagram will show null - can be regenerated manually or on update
- Flow diagram is auto-generated for new coordinators
- No breaking changes to existing APIs
