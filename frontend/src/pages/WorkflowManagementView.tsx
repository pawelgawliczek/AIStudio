import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsService } from '../services/workflows.service';
import { Workflow } from '../types';
import { useProject } from '../context/ProjectContext';
import { ActiveWorkflowBanner } from '../components/ActiveWorkflowBanner';
import { WorkflowActivationButton } from '../components/WorkflowActivationButton';
import { WorkflowRunsHistory } from '../components/WorkflowRunsHistory';
import { WorkflowRunsTable } from '../components/WorkflowRunsTable';

export function WorkflowManagementView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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
        <p className="text-muted">Please select a project to view workflows.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-fg">Workflow Management</h1>
          <p className="mt-1 text-sm text-muted">
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
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-fg">Status:</label>
            <select
              value={selectedActiveFilter}
              onChange={(e) => setSelectedActiveFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent"
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
              className="text-sm text-muted hover:text-fg underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-muted">
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
          <h3 className="mt-2 text-sm font-medium text-fg">No workflows found</h3>
          <p className="mt-1 text-sm text-muted">
            {searchQuery
              ? 'Try adjusting your search query or filters.'
              : 'Get started by creating a new workflow.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map(workflow => (
            <div key={workflow.id} className="bg-card rounded-lg shadow hover:shadow-md transition-shadow border border-border p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-fg">{workflow.name}</h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    workflow.active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                  }`}
                >
                  {workflow.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {workflow.description && (
                <p className="text-sm text-muted mb-3 line-clamp-2">{workflow.description}</p>
              )}
              <div className="space-y-2 text-sm text-muted mb-3">
                {workflow.coordinator && (
                  <div>
                    <span className="font-medium text-fg">Coordinator:</span> {workflow.coordinator.name}
                  </div>
                )}
                <div>
                  <span className="font-medium text-fg">Trigger:</span> {workflow.triggerConfig.type}
                </div>
                <div>
                  <span className="font-medium text-fg">Version:</span> {workflow.version}
                </div>
              </div>

              {/* Flow Diagram - Prominently displayed */}
              {workflow.coordinator?.flowDiagram && (
                <div className="mb-3 pb-3 border-b border-border">
                  <div className="text-xs font-semibold text-fg mb-2">Execution Flow</div>
                  <pre className="text-xs font-mono leading-relaxed text-fg bg-gray-50 dark:bg-gray-900 overflow-x-auto rounded p-3 whitespace-pre border border-border">
                    {workflow.coordinator.flowDiagram}
                  </pre>
                </div>
              )}

              {/* Components - Prominently displayed */}
              {workflow.coordinator?.componentIds && workflow.coordinator.componentIds.length > 0 && (
                <div className="mb-3 pb-3 border-b border-border">
                  <div className="text-xs font-semibold text-fg mb-2">
                    Connected Agents ({workflow.coordinator.componentIds.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {workflow.coordinator.components && workflow.coordinator.components.length > 0 ? (
                      workflow.coordinator.components.map(comp => (
                        <span key={comp.id} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium">
                          {comp.name}
                        </span>
                      ))
                    ) : (
                      workflow.coordinator.componentIds.map((id, idx) => (
                        <span key={id} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium">
                          Agent {idx + 1}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {workflow.activationStatus?.isActivated && (
                <div className="mb-3 pb-3 border-b border-border">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full font-medium">
                      Deployed to Claude Code
                    </span>
                  </div>
                </div>
              )}

              {workflow.usageStats && (
                <div className="mb-3 pb-3 border-b border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted">Total Runs</div>
                    <div className="font-semibold text-fg">{workflow.usageStats.totalRuns}</div>
                  </div>
                  <div>
                    <div className="text-muted">Success Rate</div>
                    <div className="font-semibold text-fg">{workflow.usageStats.successRate.toFixed(1)}%</div>
                  </div>
                </div>
              )}

              {/* Workflow Run History */}
              <div className="mb-3">
                <WorkflowRunsHistory workflowId={workflow.id} projectId={projectId} />
              </div>

              <div className="mt-3 space-y-2">
                <WorkflowActivationButton
                  workflowId={workflow.id}
                  workflowName={workflow.name}
                  disabled={!workflow.active}
                />
                <div className="flex items-center justify-between gap-2 text-sm">
                  <button
                    onClick={() => {
                      setSelectedWorkflow(workflow);
                      setIsDetailModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors font-medium"
                  >
                    View Details
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: workflow.id, active: workflow.active })}
                      className="text-muted hover:text-fg transition-colors"
                    >
                      {workflow.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
                          deleteMutation.mutate(workflow.id);
                        }
                      }}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Workflow Runs Table */}
      <WorkflowRunsTable
        projectId={projectId}
        workflows={workflows.map(w => ({ id: w.id, name: w.name }))}
      />

      {/* Workflow Details Modal */}
      {isDetailModalOpen && selectedWorkflow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsDetailModalOpen(false)}>
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-fg">{selectedWorkflow.name}</h2>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-muted hover:text-fg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  selectedWorkflow.active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                }`}>
                  {selectedWorkflow.active ? 'Active' : 'Inactive'}
                </span>
                {selectedWorkflow.activationStatus?.isActivated && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                    Deployed to Claude Code
                  </span>
                )}
              </div>

              {/* Description */}
              {selectedWorkflow.description && (
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-2">Description</h3>
                  <p className="text-sm text-muted">{selectedWorkflow.description}</p>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-1">Coordinator</h3>
                  <p className="text-sm text-muted">{selectedWorkflow.coordinator?.name || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-1">Trigger Type</h3>
                  <p className="text-sm text-muted capitalize">{selectedWorkflow.triggerConfig.type}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-1">Version</h3>
                  <p className="text-sm text-muted">{selectedWorkflow.version}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-1">Connected Agents</h3>
                  <p className="text-sm text-muted">{selectedWorkflow.coordinator?.componentIds?.length || 0}</p>
                </div>
              </div>

              {/* Flow Diagram */}
              {selectedWorkflow.coordinator?.flowDiagram && (
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-2">Execution Flow</h3>
                  <pre className="text-xs font-mono leading-relaxed text-fg bg-gray-50 dark:bg-gray-900 overflow-x-auto rounded p-3 whitespace-pre border border-border">
                    {selectedWorkflow.coordinator.flowDiagram}
                  </pre>
                </div>
              )}

              {/* Connected Agents */}
              {selectedWorkflow.coordinator?.componentIds && selectedWorkflow.coordinator.componentIds.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-2">Connected Agents ({selectedWorkflow.coordinator.componentIds.length})</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWorkflow.coordinator.components && selectedWorkflow.coordinator.components.length > 0 ? (
                      selectedWorkflow.coordinator.components.map((comp: any) => (
                        <a
                          key={comp.id}
                          href={`/components?projectId=${projectId}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setIsDetailModalOpen(false);
                            window.location.href = `/components?projectId=${projectId}`;
                          }}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer transition-colors"
                        >
                          {comp.name}
                        </a>
                      ))
                    ) : (
                      selectedWorkflow.coordinator.componentIds.map((id: string, idx: number) => (
                        <span key={id} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium">
                          Agent {idx + 1}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Trigger Configuration */}
              <div>
                <h3 className="text-sm font-semibold text-fg mb-2">Trigger Configuration</h3>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 border border-border">
                  <pre className="text-xs font-mono text-fg overflow-x-auto">
                    {JSON.stringify(selectedWorkflow.triggerConfig, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Usage Stats */}
              {selectedWorkflow.usageStats && (
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-2">Usage Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted">Total Runs</div>
                      <div className="text-lg font-semibold text-fg">{selectedWorkflow.usageStats.totalRuns}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Success Rate</div>
                      <div className="text-lg font-semibold text-fg">{selectedWorkflow.usageStats.successRate.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
