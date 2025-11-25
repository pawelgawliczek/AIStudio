# ST-100: Refactoring Plan for High-Complexity View Components

## Overview
Refactor 3 critical-risk view components to reduce complexity from 30-56 to <15, improve maintainability to >40.

## Current State Analysis

### ComponentLibraryView.tsx (355 lines, complexity ~36)
**Complexity Sources:**
- 7 useState hooks (searchQuery, selectedActiveFilter, selectedTagFilter, selectedWorkflowFilter, selectedComponent, isDetailModalOpen, isCreateModalOpen, editingComponent)
- 2 useQuery hooks (workflows, components)
- 2 useMutation hooks (delete, toggleActive)
- 3 useMemo hooks (tags, filteredComponents)
- 8 event handlers
- Large JSX structure with 4 conditional rendering paths
- Inline filtering logic

**Responsibilities:**
- State management (7 pieces of state)
- API calls (fetch workflows, fetch components, delete, toggle active)
- Filtering logic (search, active, tag, workflow)
- UI rendering (header, filters, grid, empty state)
- Modal management (detail modal, create/edit modal)

### CoordinatorLibraryView.tsx (316 lines, complexity ~33)
**Complexity Sources:**
- 6 useState hooks
- 2 useQuery hooks
- 2 useMutation hooks
- 2 useMemo hooks
- Large inline card component in JSX (87 lines, lines 206-290)
- Inline filtering logic

**Responsibilities:**
- State management (6 pieces of state)
- API calls (fetch workflows, fetch coordinators, delete, toggle active)
- Filtering logic (search, active, domain, workflow)
- UI rendering (header, filters, grid, empty state)
- Modal management (detail modal)

### WorkflowManagementView.tsx (359 lines, complexity ~56) **HIGHEST PRIORITY**
**Complexity Sources:**
- 6 useState hooks
- 1 useQuery hook
- 2 useMutation hooks
- Very large inline card component in JSX (165 lines, lines 164-328)
- Deeply nested conditional rendering (flow diagram, components, activation status, usage stats)
- Multiple sub-components embedded (WorkflowRunsHistory, WorkflowActivationButton, WorkflowRunsTable)

**Responsibilities:**
- State management (6 pieces of state)
- API calls (fetch workflows, delete, toggle active)
- Filtering logic (search, active)
- UI rendering (header, filters, grid, empty state, complex cards)
- Modal management (detail modal, wizard modal)
- Workflow activation management

---

## Refactoring Strategy

### Phase 1: Extract Custom Hooks (Reduce State Management Complexity)

#### 1.1. useComponentFilters() Hook
```typescript
// frontend/src/hooks/useComponentFilters.ts
export function useComponentFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedWorkflowFilter, setSelectedWorkflowFilter] = useState<string>('all');

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedActiveFilter('all');
    setSelectedTagFilter('all');
    setSelectedWorkflowFilter('all');
  };

  const hasActiveFilters = searchQuery || selectedActiveFilter !== 'all' || selectedTagFilter !== 'all' || selectedWorkflowFilter !== 'all';

  return {
    searchQuery,
    setSearchQuery,
    selectedActiveFilter,
    setSelectedActiveFilter,
    selectedTagFilter,
    setSelectedTagFilter,
    selectedWorkflowFilter,
    setSelectedWorkflowFilter,
    clearFilters,
    hasActiveFilters,
  };
}
```

#### 1.2. useComponentActions() Hook
```typescript
// frontend/src/hooks/useComponentActions.ts
export function useComponentActions(projectId: string, onDeleteSuccess?: () => void) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => componentsService.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      onDeleteSuccess?.();
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? componentsService.deactivate(projectId, id) : componentsService.activate(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this component? This action cannot be undone.')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await toggleActiveMutation.mutateAsync({ id, active });
  };

  return {
    handleDelete,
    handleToggleActive,
    isDeleting: deleteMutation.isPending,
    isTogglingActive: toggleActiveMutation.isPending,
  };
}
```

#### 1.3. useCoordinatorFilters() Hook
```typescript
// frontend/src/hooks/useCoordinatorFilters.ts
export function useCoordinatorFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all');
  const [selectedWorkflowFilter, setSelectedWorkflowFilter] = useState<string>('all');

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedActiveFilter('all');
    setSelectedDomainFilter('all');
    setSelectedWorkflowFilter('all');
  };

  const hasActiveFilters = searchQuery || selectedActiveFilter !== 'all' || selectedDomainFilter !== 'all' || selectedWorkflowFilter !== 'all';

  return {
    searchQuery,
    setSearchQuery,
    selectedActiveFilter,
    setSelectedActiveFilter,
    selectedDomainFilter,
    setSelectedDomainFilter,
    selectedWorkflowFilter,
    setSelectedWorkflowFilter,
    clearFilters,
    hasActiveFilters,
  };
}
```

#### 1.4. useCoordinatorActions() Hook
Similar structure to useComponentActions

#### 1.5. useWorkflowFilters() Hook
```typescript
// frontend/src/hooks/useWorkflowFilters.ts
export function useWorkflowFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedActiveFilter('all');
  };

  const hasActiveFilters = searchQuery || selectedActiveFilter !== 'all';

  return {
    searchQuery,
    setSearchQuery,
    selectedActiveFilter,
    setSelectedActiveFilter,
    clearFilters,
    hasActiveFilters,
  };
}
```

#### 1.6. useWorkflowActions() Hook
Similar structure to useComponentActions

### Phase 2: Extract Child Components (Reduce JSX Complexity)

#### 2.1. FilterBar Component
```typescript
// frontend/src/components/FilterBar.tsx
interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: Array<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }>;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}
```

#### 2.2. EmptyState Component
```typescript
// frontend/src/components/EmptyState.tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}
```

#### 2.3. ComponentCard Component (Already exists - verify it's optimized)
Review `/frontend/src/components/ComponentCard.tsx`

#### 2.4. CoordinatorCard Component
```typescript
// frontend/src/components/CoordinatorCard.tsx
interface CoordinatorCardProps {
  coordinator: CoordinatorAgent;
  onClick: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}
```

Extract the large inline card from CoordinatorLibraryView.tsx (lines 206-290)

#### 2.5. WorkflowCard Component
```typescript
// frontend/src/components/WorkflowCard.tsx
interface WorkflowCardProps {
  workflow: Workflow;
  projectId: string;
  onClick: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}
```

Extract the large inline card from WorkflowManagementView.tsx (lines 164-328)

### Phase 3: Refactor Parent Components

After extracting hooks and components, parent components should be reduced to:

**ComponentLibraryView.tsx Target:** <150 lines, complexity <15
- Use useComponentFilters()
- Use useComponentActions()
- Use FilterBar component
- Use EmptyState component
- Use ComponentCard component (already exists)

**CoordinatorLibraryView.tsx Target:** <150 lines, complexity <15
- Use useCoordinatorFilters()
- Use useCoordinatorActions()
- Use FilterBar component
- Use EmptyState component
- Use CoordinatorCard component

**WorkflowManagementView.tsx Target:** <150 lines, complexity <15
- Use useWorkflowFilters()
- Use useWorkflowActions()
- Use FilterBar component
- Use EmptyState component
- Use WorkflowCard component

---

## Implementation Order

### Priority 1: WorkflowManagementView.tsx (Highest Complexity: 56)
1. Create useWorkflowFilters hook
2. Create useWorkflowActions hook
3. Create WorkflowCard component (extract lines 164-328)
4. Create FilterBar component (reusable)
5. Create EmptyState component (reusable)
6. Refactor WorkflowManagementView to use extracted pieces

### Priority 2: ComponentLibraryView.tsx (Complexity: 36)
1. Create useComponentFilters hook
2. Create useComponentActions hook
3. Verify ComponentCard component is optimized
4. Refactor ComponentLibraryView to use extracted pieces

### Priority 3: CoordinatorLibraryView.tsx (Complexity: 33)
1. Create useCoordinatorFilters hook
2. Create useCoordinatorActions hook
3. Create CoordinatorCard component (extract lines 206-290)
4. Refactor CoordinatorLibraryView to use extracted pieces

---

## File Structure

```
frontend/src/
├── hooks/
│   ├── useComponentFilters.ts      (NEW)
│   ├── useComponentActions.ts      (NEW)
│   ├── useCoordinatorFilters.ts    (NEW)
│   ├── useCoordinatorActions.ts    (NEW)
│   ├── useWorkflowFilters.ts       (NEW)
│   └── useWorkflowActions.ts       (NEW)
├── components/
│   ├── FilterBar.tsx               (NEW, reusable)
│   ├── EmptyState.tsx              (NEW, reusable)
│   ├── ComponentCard.tsx           (EXISTS, verify optimization)
│   ├── CoordinatorCard.tsx         (NEW)
│   └── WorkflowCard.tsx            (NEW)
└── pages/
    ├── ComponentLibraryView.tsx    (REFACTOR to <150 lines)
    ├── CoordinatorLibraryView.tsx  (REFACTOR to <150 lines)
    └── WorkflowManagementView.tsx  (REFACTOR to <150 lines)
```

---

## Complexity Reduction Targets

| Component | Before (Lines) | After (Lines) | Before (Complexity) | After (Complexity) | Maintainability |
|-----------|---------------|--------------|---------------------|-------------------|----------------|
| ComponentLibraryView.tsx | 355 | <150 | 36 | <15 | >40 |
| CoordinatorLibraryView.tsx | 316 | <150 | 33 | <15 | >40 |
| WorkflowManagementView.tsx | 359 | <150 | 56 | <15 | >40 |

---

## Testing Strategy

1. **Unit Tests**: Test extracted hooks in isolation
   - useComponentFilters: filter state management
   - useComponentActions: mutation behavior
   - etc.

2. **Component Tests**: Test extracted components in isolation
   - FilterBar: renders all filters correctly
   - EmptyState: renders icon, title, description, action button
   - WorkflowCard: renders all workflow details
   - CoordinatorCard: renders all coordinator details

3. **Integration Tests**: Ensure refactored views maintain existing functionality
   - All existing e2e tests must pass (100% pass rate)
   - No new TypeScript errors introduced

4. **Visual Regression**: Compare before/after screenshots
   - No visual changes expected (pure refactor)

---

## Acceptance Criteria

- [ ] All 3 files refactored with complexity <15
- [ ] Maintainability index >40 for all files
- [ ] All existing tests pass (100% pass rate)
- [ ] No new TypeScript errors introduced
- [ ] Code follows existing patterns and conventions
- [ ] No visual changes (pure refactor)

---

## Estimated Effort

- **WorkflowManagementView refactoring**: 3.5 hours
- **ComponentLibraryView refactoring**: 3 hours
- **CoordinatorLibraryView refactoring**: 3 hours
- **Total**: 9.5 hours

---

## Notes

- All hooks should be placed in `frontend/src/hooks/`
- All components should be placed in `frontend/src/components/`
- Maintain existing className patterns for dark mode compatibility
- Preserve all existing functionality (no behavioral changes)
- Use TypeScript strictly (no `any` types unless unavoidable)
