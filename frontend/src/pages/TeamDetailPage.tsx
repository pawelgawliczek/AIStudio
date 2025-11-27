import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tab } from '@headlessui/react';
import { ArrowLeftIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

import { workflowsService } from '../services/workflows.service';
import { versioningService } from '../services/versioning.service';
import { analyticsService } from '../services/analytics.service';
import { useProject } from '../context/ProjectContext';
import { Workflow } from '../types';

import { VersionBadge } from '../components/VersionBadge';
import { VersionBumpModal } from '../components/VersionBumpModal';
import { VersionHistoryTimeline } from '../components/shared';
import { WorkflowRunsTable } from '../components/WorkflowRunsTable';
import { TeamFlowDiagram } from '../components/TeamFlowDiagram';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';

  // Version modal state
  const [showVersionBumpModal, setShowVersionBumpModal] = useState(false);

  // Version comparison state
  const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
  const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);

  // Workflow runs version filter
  const [workflowVersionFilter, setWorkflowVersionFilter] = useState<string>('latest');

  // Fetch workflow/team
  const {
    data: workflow,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['workflow', projectId, id],
    queryFn: () => workflowsService.getById(projectId, id!),
    enabled: !!projectId && !!id,
  });

  // Fetch version history
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['workflowVersions', id],
    queryFn: () => versioningService.getWorkflowVersionHistory(id!),
    enabled: !!id,
  });

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['workflowAnalytics', id],
    queryFn: () => analyticsService.getWorkflowAnalytics(id!),
    enabled: !!id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => workflowsService.delete(projectId, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate('/teams');
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: (active: boolean) =>
      workflowsService.update(projectId, id!, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', projectId, id] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  // Handle edit - opens version bump modal (AC8-AC9)
  const handleEdit = () => {
    // For now, open version bump modal directly
    // Full wizard edit with pre-population can be added later as enhancement
    setShowVersionBumpModal(true);
  };

  // Handle delete
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete team "${workflow?.name}"?`)) {
      deleteMutation.mutate();
    }
  };

  // Handle toggle active
  const handleToggleActive = () => {
    if (workflow) {
      toggleActiveMutation.mutate(!workflow.active);
    }
  };

  // Handle version selection for comparison
  const handleVersionSelect = (versionId: string, checked: boolean) => {
    if (checked) {
      if (!selectedVersion1) {
        setSelectedVersion1(versionId);
      } else if (!selectedVersion2 && selectedVersion1 !== versionId) {
        setSelectedVersion2(versionId);
      }
    } else {
      if (selectedVersion1 === versionId) {
        setSelectedVersion1(selectedVersion2);
        setSelectedVersion2(null);
      } else if (selectedVersion2 === versionId) {
        setSelectedVersion2(null);
      }
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  // Error state
  if (error || !workflow) {
    return (
      <div className="text-center py-12">
        <p className="text-fg text-lg">Team not found</p>
        <Link to="/teams" className="text-accent hover:underline mt-2 inline-block">
          Back to Teams
        </Link>
      </div>
    );
  }

  const avgDuration = workflow.usageStats?.avgRuntime || 0;
  const avgCost = workflow.usageStats?.avgCost || 0;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Back link */}
      <Link
        to="/teams"
        className="inline-flex items-center gap-2 text-fg hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Teams
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-fg">{workflow.name}</h1>
            <VersionBadge version={workflow.version} status="current" size="lg" />
          </div>
          {workflow.description && (
            <p className="mt-2 text-fg max-w-3xl">{workflow.description}</p>
          )}
        </div>

        {/* Usage stats */}
        {workflow.usageStats && (
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-fg">{workflow.usageStats.totalRuns}</div>
              <div className="text-fg">Total Runs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-fg">
                {(avgDuration / 60000).toFixed(1)}min
              </div>
              <div className="text-fg">Avg Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-fg">
                ${avgCost.toFixed(2)}
              </div>
              <div className="text-fg">Avg Cost</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-bg-secondary p-1 mb-6">
          <Tab
            className={({ selected }) =>
              classNames(
                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                selected
                  ? 'bg-accent text-white shadow'
                  : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
              )
            }
          >
            Overview
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                selected
                  ? 'bg-accent text-white shadow'
                  : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
              )
            }
          >
            Version History
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                selected
                  ? 'bg-accent text-white shadow'
                  : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
              )
            }
          >
            Executions
          </Tab>
        </Tab.List>

        <Tab.Panels>
          {/* Overview Tab */}
          <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
            <TeamFlowDiagram workflow={workflow} />
          </Tab.Panel>

          {/* Version History Tab */}
          <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
            <VersionHistoryTimeline
              versions={versions}
              entityType="workflow"
              selectedVersions={[selectedVersion1, selectedVersion2]}
              onVersionSelect={handleVersionSelect}
              onCompare={() => {}}
              isLoading={versionsLoading}
            />
          </Tab.Panel>

          {/* Executions Tab */}
          <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
            <div className="mb-4">
              <label htmlFor="version-filter" className="block text-sm font-medium text-fg mb-2">
                Filter by Version
              </label>
              <select
                id="version-filter"
                value={workflowVersionFilter}
                onChange={(e) => setWorkflowVersionFilter(e.target.value)}
                className="px-3 py-2 bg-bg-secondary text-fg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="latest">Latest Version Only</option>
                <option value="all">All Versions</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>
                    {v.version}
                  </option>
                ))}
              </select>
            </div>
            <WorkflowRunsTable
              projectId={projectId}
              workflows={[{ id: workflow.id, name: workflow.name }]}
              versionFilter={workflowVersionFilter}
            />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Action buttons */}
      <div className="mt-6 pt-4 border-t border-border flex items-center justify-end gap-3">
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
        >
          <TrashIcon className="w-5 h-5" />
          Delete
        </button>
        <button
          onClick={handleToggleActive}
          disabled={toggleActiveMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 text-fg hover:text-accent transition-colors disabled:opacity-50"
        >
          {workflow.active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={handleEdit}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
        >
          <PencilIcon className="w-5 h-5" />
          Edit
        </button>
      </div>

      {/* Version Bump Modal */}
      {workflow && (
        <VersionBumpModal
          isOpen={showVersionBumpModal}
          onClose={() => setShowVersionBumpModal(false)}
          entityType="workflow"
          entityId={workflow.id}
          entityName={workflow.name}
          currentVersion={workflow.version}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['workflow', projectId, id] });
            queryClient.invalidateQueries({ queryKey: ['workflowVersions', id] });
            setShowVersionBumpModal(false);
          }}
        />
      )}
    </div>
  );
}
