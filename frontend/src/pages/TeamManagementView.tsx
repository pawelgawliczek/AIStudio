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
import { WorkflowDetailModal } from '../components/WorkflowDetailModal';
import { WorkflowCreationWizard } from '../components/workflow-wizard/WorkflowCreationWizard';
import { terminology } from '../utils/terminology';

export function TeamManagementView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedProject, projects } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';
  const editTeamId = searchParams.get('edit'); // AC8: Handle ?edit=${id} param
  const queryClient = useQueryClient();

  // Use extracted hooks
  const filters = useWorkflowFilters();

  // Local state for modals
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(!!editTeamId); // AC8: Open wizard if edit param present

  // Fetch workflows - always show all workflows (latest versions)
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows', projectId, filters.searchQuery],
    queryFn: async () => {
      if (!projectId) return [];
      return workflowsService.getAll(projectId, {
        search: filters.searchQuery || undefined,
      });
    },
    enabled: !!projectId,
  });

  const handleWizardSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['workflows'] });
  };

  // AC8: Handle wizard close to clear edit param
  const handleWizardClose = () => {
    setIsWizardOpen(false);
    if (editTeamId) {
      // Remove edit param from URL
      searchParams.delete('edit');
      setSearchParams(searchParams);
    }
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
        searchPlaceholder="Search teams..."
        filters={[]}
        hasActiveFilters={filters.hasActiveFilters}
        onClearFilters={filters.clearFilters}
      />

      {/* Results Count */}
      <div className="mb-4 text-sm text-muted">
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          <span>
            Found {workflows.length} team{workflows.length !== 1 ? 's' : ''}
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
            />
          ))}
        </div>
      )}

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
        onClose={handleWizardClose}
        projectId={projectId}
        projects={projects}
        onSuccess={handleWizardSuccess}
        editMode={!!editTeamId}
        teamId={editTeamId || undefined}
      />
    </div>
  );
}
