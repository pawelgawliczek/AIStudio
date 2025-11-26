import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { workflowsService } from '../services/workflows.service';
import { useProject } from '../context/ProjectContext';
import { useWorkflowFilters } from '../hooks/useWorkflowFilters';
import { useWorkflowActions } from '../hooks/useWorkflowActions';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '../components/EmptyState';
import { TeamCard } from '../components/TeamCard';
import { ActiveWorkflowBanner } from '../components/ActiveWorkflowBanner';
import { WorkflowRunsTable } from '../components/WorkflowRunsTable';
import { WorkflowDetailModal } from '../components/WorkflowDetailModal';
import { WorkflowCreationWizard } from '../components/workflow-wizard/WorkflowCreationWizard';
import { terminology } from '../utils/terminology';

export function TeamManagementView() {
  const [searchParams] = useSearchParams();
  const { selectedProject, projects } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';
  const queryClient = useQueryClient();

  // Use extracted hooks
  const filters = useWorkflowFilters();
  const { handleDelete, handleToggleActive } = useWorkflowActions(projectId);

  // Local state for modals
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Fetch workflows
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows', projectId, filters.searchQuery, filters.selectedActiveFilter],
    queryFn: async () => {
      if (!projectId) return [];
      const activeFilter =
        filters.selectedActiveFilter === 'all'
          ? undefined
          : filters.selectedActiveFilter === 'active';
      return workflowsService.getAll(projectId, {
        active: activeFilter,
        search: filters.searchQuery || undefined,
      });
    },
    enabled: !!projectId,
  });

  const handleWizardSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['workflows'] });
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted">Please select a project to view {terminology.workflows.toLowerCase()}.</p>
      </div>
    );
  }

  // Empty state icon
  const emptyIcon = (
    <svg
      className="mx-auto h-12 w-12 text-muted"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
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
          <h1 className="text-3xl font-bold text-fg">{terminology.workflows} Management</h1>
          <p className="mt-1 text-sm text-muted">
            {terminology.workflowDescription}
          </p>
        </div>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsWizardOpen(true)}
          disabled={!projectId}
        >
          {terminology.createWorkflow}
        </Button>
      </div>

      <ActiveWorkflowBanner />

      {/* Filter Bar */}
      <FilterBar
        searchQuery={filters.searchQuery}
        onSearchChange={filters.setSearchQuery}
        searchPlaceholder="Search workflows..."
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
        ]}
        hasActiveFilters={filters.hasActiveFilters}
        onClearFilters={filters.clearFilters}
      />

      {/* Results Count */}
      <div className="mb-4 text-sm text-muted">
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          <span>
            Found {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
            {filters.searchQuery && ` matching "${filters.searchQuery}"`}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        loadingSkeleton
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={`No ${terminology.workflows.toLowerCase()} found`}
          description={
            filters.searchQuery
              ? 'Try adjusting your search query or filters.'
              : `Get started by creating a new ${terminology.workflow.toLowerCase()}.`
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <TeamCard
              key={workflow.id}
              workflow={workflow}
              projectId={projectId}
              onClick={() => {
                setSelectedWorkflow(workflow);
                setIsDetailModalOpen(true);
              }}
              onToggleActive={() => handleToggleActive(workflow.id, workflow.active)}
              onDelete={() => handleDelete(workflow.id)}
            />
          ))}
        </div>
      )}

      {/* All Workflow Runs Table */}
      <WorkflowRunsTable
        projectId={projectId}
        workflows={workflows.map((w) => ({ id: w.id, name: w.name }))}
      />

      {/* Modals */}
      {isDetailModalOpen && selectedWorkflow && (
        <WorkflowDetailModal
          workflow={selectedWorkflow}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['workflows'] })}
        />
      )}

      <WorkflowCreationWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        projectId={projectId}
        projects={projects}
        onSuccess={handleWizardSuccess}
      />
    </div>
  );
}
