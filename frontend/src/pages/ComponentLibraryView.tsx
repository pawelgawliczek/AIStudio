import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { componentsService } from '../services/components.service';
import { versioningService } from '../services/versioning.service';
import { workflowsService } from '../services/workflows.service';
import { ComponentCard } from '../components/ComponentCard';
import { CreateComponentModal } from '../components/CreateComponentModal';
import { useProject } from '../context/ProjectContext';
import { useComponentFilters } from '../hooks/useComponentFilters';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '../components/EmptyState';

export function ComponentLibraryView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';
  const queryClient = useQueryClient();

  // Use extracted hooks
  const filters = useComponentFilters();

  // Local state for create modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch workflows for filtering
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return workflowsService.getAll(projectId);
    },
    enabled: !!projectId,
  });

  // Fetch components
  const {
    data: components = [],
    isLoading,
  } = useQuery({
    queryKey: [
      'components',
      projectId,
      filters.searchQuery,
      filters.selectedTagFilter,
    ],
    queryFn: async () => {
      if (!projectId) return [];
      return componentsService.getAll(projectId, {
        search: filters.searchQuery || undefined,
      });
    },
    enabled: !!projectId,
  });

  // Fetch version counts for all components
  const componentIds = useMemo(() => components.map((c) => c.id), [components]);
  const { data: versionCounts = {} } = useQuery({
    queryKey: ['componentVersionCounts', componentIds],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        componentIds.map(async (id) => {
          try {
            const versions = await versioningService.getComponentVersionHistory(id);
            counts[id] = versions.length || 1;
          } catch {
            counts[id] = 1;
          }
        })
      );
      return counts;
    },
    enabled: componentIds.length > 0,
  });

  // Get unique tags for filtering (exclude 'coordinator' tag)
  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    components.forEach((c) => {
      c.tags.forEach((tag) => {
        if (tag !== 'coordinator' && tag !== 'orchestrator') {
          tagSet.add(tag);
        }
      });
    });
    return Array.from(tagSet).sort();
  }, [components]);

  // Filter by tag and workflow on client side
  const filteredComponents = useMemo(() => {
    let filtered = components;

    // EXCLUDE COORDINATORS - they should only appear on /coordinators page
    filtered = filtered.filter((c) => !c.tags.includes('coordinator'));

    // Tag filter
    if (filters.selectedTagFilter !== 'all') {
      filtered = filtered.filter((c) => c.tags.includes(filters.selectedTagFilter));
    }

    // Workflow filter
    if (filters.selectedWorkflowFilter !== 'all') {
      const workflow = workflows.find((w) => w.id === filters.selectedWorkflowFilter);
      if (workflow?.coordinator?.componentIds) {
        filtered = filtered.filter((c) =>
          workflow.coordinator!.componentIds!.includes(c.id)
        );
      }
    }

    return filtered;
  }, [components, filters.selectedTagFilter, filters.selectedWorkflowFilter, workflows]);

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-fg">Please select a project to view components.</p>
      </div>
    );
  }

  // Empty state icon
  const emptyIcon = (
    <svg
      className="mx-auto h-12 w-12 text-fg"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );

  // Loading skeleton
  const loadingSkeleton = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-64 bg-bg-secondary animate-pulse rounded-lg" />
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-fg">Component Library</h1>
          <p className="mt-1 text-sm text-fg">
            Reusable building blocks configured via 3 instruction sets
          </p>
        </div>
        <button
          data-testid="create-component-button"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-accent text-accent-fg rounded-lg hover:bg-accent-dark transition-colors"
        >
          + Create Component
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchQuery={filters.searchQuery}
        onSearchChange={filters.setSearchQuery}
        searchPlaceholder="Search components..."
        filters={[
          {
            label: 'Tag',
            value: filters.selectedTagFilter,
            onChange: filters.setSelectedTagFilter,
            options: [
              { value: 'all', label: 'All Tags' },
              ...tags.map((tag) => ({ value: tag, label: tag })),
            ],
            visible: tags.length > 0,
          },
          {
            label: 'Workflow',
            value: filters.selectedWorkflowFilter,
            onChange: filters.setSelectedWorkflowFilter,
            options: [
              { value: 'all', label: 'All Workflows' },
              ...workflows.map((w) => ({ value: w.id, label: w.name })),
            ],
            visible: workflows.length > 0,
          },
        ]}
        hasActiveFilters={filters.hasActiveFilters}
        onClearFilters={filters.clearFilters}
      />

      {/* Results Count */}
      <div className="mb-4 text-sm text-fg">
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          <span>
            Found {filteredComponents.length} component
            {filteredComponents.length !== 1 ? 's' : ''}
            {filters.searchQuery && ` matching "${filters.searchQuery}"`}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        loadingSkeleton
      ) : filteredComponents.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title="No components found"
          description={
            filters.searchQuery
              ? 'Try adjusting your search query or filters.'
              : 'Get started by creating a new component.'
          }
          actionLabel={!filters.searchQuery ? '+ Create Component' : undefined}
          onAction={!filters.searchQuery ? () => setIsCreateModalOpen(true) : undefined}
          testId="create-component-empty-state"
        />
      ) : (
        <div data-testid="component-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComponents.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              versionsCount={versionCounts[component.id] || 1}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateComponentModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={async () => {
          await queryClient.invalidateQueries({
            queryKey: ['components'],
            refetchType: 'active',
          });
          handleCloseCreateModal();
        }}
        projectId={projectId}
      />
    </div>
  );
}
