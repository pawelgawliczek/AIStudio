import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsService } from '../services/workflows.service';
import { Workflow } from '../types';
import { useProject } from '../context/ProjectContext';
import { ActiveWorkflowBanner } from '../components/ActiveWorkflowBanner';
import { WorkflowActivationButton } from '../components/WorkflowActivationButton';

export function WorkflowManagementView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows', projectId, searchQuery, selectedActiveFilter],
    queryFn: async () => {
      if (!projectId) return [];
      const activeFilter = selectedActiveFilter === 'all' ? undefined : selectedActiveFilter === 'active';
      return workflowsService.getAll(projectId, {
        active: activeFilter,
        search: searchQuery || undefined,
      });
    },
    enabled: !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? workflowsService.deactivate(id) : workflowsService.activate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please select a project to view workflows.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflow Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage workflows that link coordinators with trigger configurations
          </p>
        </div>
      </div>

      <ActiveWorkflowBanner />

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={selectedActiveFilter}
              onChange={(e) => setSelectedActiveFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {(searchQuery || selectedActiveFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedActiveFilter('all');
              }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600">
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          <span>
            Found {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-12">
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No workflows found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search query or filters.'
              : 'Get started by creating a new workflow.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map(workflow => (
            <div key={workflow.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    workflow.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {workflow.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {workflow.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{workflow.description}</p>
              )}
              <div className="space-y-2 text-sm text-gray-600">
                {workflow.coordinator && (
                  <div>
                    <span className="font-medium">Coordinator:</span> {workflow.coordinator.name}
                  </div>
                )}
                <div>
                  <span className="font-medium">Trigger:</span> {workflow.triggerConfig.type}
                </div>
                <div>
                  <span className="font-medium">Version:</span> {workflow.version}
                </div>
              </div>
              {workflow.activationStatus?.isActivated && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
                      Deployed to Claude Code
                    </span>
                  </div>
                </div>
              )}
              {workflow.usageStats && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">Total Runs</div>
                    <div className="font-semibold text-gray-900">{workflow.usageStats.totalRuns}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Success Rate</div>
                    <div className="font-semibold text-gray-900">{workflow.usageStats.successRate.toFixed(1)}%</div>
                  </div>
                </div>
              )}
              <div className="mt-3 space-y-2">
                <WorkflowActivationButton
                  workflowId={workflow.id}
                  workflowName={workflow.name}
                  disabled={!workflow.active}
                />
                <div className="flex items-center justify-end gap-2 text-sm">
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: workflow.id, active: workflow.active })}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {workflow.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
                        deleteMutation.mutate(workflow.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
