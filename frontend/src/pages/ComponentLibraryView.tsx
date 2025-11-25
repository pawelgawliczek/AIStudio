import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { componentsService } from '../services/components.service';
import { workflowsService } from '../services/workflows.service';
import { Component } from '../types';
import { ComponentCard } from '../components/ComponentCard';
import { CreateComponentModal } from '../components/CreateComponentModal';
import { ComponentDetailModal } from '../components/ComponentDetailModal';
import { useProject } from '../context/ProjectContext';
import { useComponentFilters } from '../hooks/useComponentFilters';
import { useComponentActions } from '../hooks/useComponentActions';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '../components/EmptyState';

export function ComponentLibraryView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';
  const queryClient = useQueryClient();

  // Use extracted hooks
  const filters = useComponentFilters();

  // Local state for modals and editing
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);

  const { handleDelete, handleToggleActive, handleEdit } = useComponentActions(
    projectId,
    () => {
      if (selectedComponent && isDetailModalOpen) {
        setIsDetailModalOpen(false);
        setSelectedComponent(null);
      }
    }
  );

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
    refetch,
  } = useQuery({
    queryKey: [
      'components',
      projectId,
      filters.searchQuery,
      filters.selectedActiveFilter,
      filters.selectedTagFilter,
    ],
    queryFn: async () => {
      if (!projectId) return [];
      const activeFilter =
        filters.selectedActiveFilter === 'all'
          ? undefined
          : filters.selectedActiveFilter === 'active';
      return componentsService.getAll(projectId, {
        active: activeFilter,
        search: filters.searchQuery || undefined,
      });
    },
    enabled: !!projectId,
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

  const handleComponentClick = (component: Component) => {
    setSelectedComponent(component);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setTimeout(() => setSelectedComponent(null), 200);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setTimeout(() => setEditingComponent(null), 200);
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
            label: 'Status',
            value: filters.selectedActiveFilter,
            onChange: filters.setSelectedActiveFilter,
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
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
              onClick={() => handleComponentClick(component)}
              onEdit={() =>
                handleEdit(component, (comp) => {
                  setEditingComponent(comp);
                  setIsCreateModalOpen(true);
                })
              }
              onDelete={() => handleDelete(component.id)}
              onToggleActive={() => handleToggleActive(component)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedComponent && (
        <ComponentDetailModal
          component={selectedComponent}
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetailModal}
          onEdit={() => {
            handleEdit(selectedComponent, (comp) => {
              setEditingComponent(comp);
              setIsCreateModalOpen(true);
            });
            handleCloseDetailModal();
          }}
          onUpdate={() => refetch()}
        />
      )}

      {/* Create/Edit Modal */}
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
        editingComponent={editingComponent}
      />
    </div>
  );
}
