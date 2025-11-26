import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coordinatorsService } from '../services/coordinators.service';
import { versioningService } from '../services/versioning.service';
import { workflowsService } from '../services/workflows.service';
import { useProject } from '../context/ProjectContext';
import { useCoordinatorFilters } from '../hooks/useCoordinatorFilters';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '../components/EmptyState';
import { CoordinatorCard } from '../components/CoordinatorCard';

export function CoordinatorLibraryView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';

  // Use extracted hooks
  const filters = useCoordinatorFilters();

  // Fetch workflows for filtering
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return workflowsService.getAll(projectId);
    },
    enabled: !!projectId,
  });

  // Fetch coordinators
  const { data: coordinators = [], isLoading } = useQuery({
    queryKey: [
      'coordinators',
      projectId,
      filters.searchQuery,
      filters.selectedDomainFilter,
    ],
    queryFn: async () => {
      if (!projectId) return [];
      return coordinatorsService.getAll(projectId, {
        domain: filters.selectedDomainFilter !== 'all' ? filters.selectedDomainFilter : undefined,
        search: filters.searchQuery || undefined,
      });
    },
    enabled: !!projectId,
  });

  // Fetch version counts for all coordinators
  const coordinatorIds = useMemo(() => coordinators.map((c) => c.id), [coordinators]);
  const { data: versionCounts = {} } = useQuery({
    queryKey: ['coordinatorVersionCounts', coordinatorIds],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        coordinatorIds.map(async (id) => {
          try {
            const versions = await versioningService.getCoordinatorVersionHistory(id);
            counts[id] = versions.length || 1;
          } catch {
            counts[id] = 1;
          }
        })
      );
      return counts;
    },
    enabled: coordinatorIds.length > 0,
  });

  // Get unique domains
  const domains = useMemo(() => {
    const domainSet = new Set<string>();
    coordinators.forEach((c) => domainSet.add(c.domain));
    return Array.from(domainSet).sort();
  }, [coordinators]);

  // Filter coordinators by workflow
  const filteredCoordinators = useMemo(() => {
    if (filters.selectedWorkflowFilter === 'all') {
      return coordinators;
    }
    const workflow = workflows.find((w) => w.id === filters.selectedWorkflowFilter);
    if (workflow?.coordinator?.id) {
      return coordinators.filter((c) => c.id === workflow.coordinator!.id);
    }
    return coordinators;
  }, [coordinators, filters.selectedWorkflowFilter, workflows]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please select a project to view coordinators.</p>
      </div>
    );
  }

  // Empty state icon
  const emptyIcon = (
    <svg
      className="mx-auto h-12 w-12 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );

  // Loading skeleton
  const loadingSkeleton = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-lg" />
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coordinator Library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Intelligent orchestrators that decide workflow execution
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchQuery={filters.searchQuery}
        onSearchChange={filters.setSearchQuery}
        searchPlaceholder="Search coordinators..."
        filters={[
          {
            label: 'Domain',
            value: filters.selectedDomainFilter,
            onChange: filters.setSelectedDomainFilter,
            options: [
              { value: 'all', label: 'All Domains' },
              ...domains.map((domain) => ({ value: domain, label: domain })),
            ],
            visible: domains.length > 0,
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
      <div className="mb-4 text-sm text-gray-600">
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          <span>
            Found {filteredCoordinators.length} coordinator
            {filteredCoordinators.length !== 1 ? 's' : ''}
            {filters.searchQuery && ` matching "${filters.searchQuery}"`}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        loadingSkeleton
      ) : filteredCoordinators.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title="No coordinators found"
          description={
            filters.searchQuery
              ? 'Try adjusting your search query or filters.'
              : 'Get started by creating a new coordinator.'
          }
        />
      ) : (
        <div
          data-testid="coordinator-list"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredCoordinators.map((coordinator) => (
            <CoordinatorCard
              key={coordinator.id}
              coordinator={coordinator}
              versionsCount={versionCounts[coordinator.id] || 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
