import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coordinatorsService } from '../services/coordinators.service';
import { CoordinatorAgent } from '../types';
import { useProject } from '../context/ProjectContext';

export function CoordinatorLibraryView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all');
  const [selectedCoordinator, setSelectedCoordinator] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { data: coordinators = [], isLoading } = useQuery({
    queryKey: ['coordinators', projectId, searchQuery, selectedActiveFilter, selectedDomainFilter],
    queryFn: async () => {
      if (!projectId) return [];
      const activeFilter = selectedActiveFilter === 'all' ? undefined : selectedActiveFilter === 'active';
      return coordinatorsService.getAll(projectId, {
        active: activeFilter,
        domain: selectedDomainFilter !== 'all' ? selectedDomainFilter : undefined,
        search: searchQuery || undefined,
      });
    },
    enabled: !!projectId,
  });

  const domains = useMemo(() => {
    const domainSet = new Set<string>();
    coordinators.forEach(c => domainSet.add(c.domain));
    return Array.from(domainSet).sort();
  }, [coordinators]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coordinatorsService.delete(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coordinators'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? coordinatorsService.deactivate(projectId, id) : coordinatorsService.activate(projectId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coordinators'] }),
  });

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please select a project to view coordinators.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coordinator Library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Intelligent orchestrators that decide workflow execution
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coordinators..."
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
          {domains.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Domain:</label>
              <select
                value={selectedDomainFilter}
                onChange={(e) => setSelectedDomainFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Domains</option>
                {domains.map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            </div>
          )}
          {(searchQuery || selectedActiveFilter !== 'all' || selectedDomainFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedActiveFilter('all');
                setSelectedDomainFilter('all');
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
            Found {coordinators.length} coordinator{coordinators.length !== 1 ? 's' : ''}
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
      ) : coordinators.length === 0 ? (
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No coordinators found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search query or filters.'
              : 'Get started by creating a new coordinator.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coordinators.map(coordinator => (
            <div key={coordinator.id} className="bg-card rounded-lg shadow hover:shadow-md transition-shadow border border-border p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-fg">{coordinator.name}</h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    coordinator.active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                  }`}
                >
                  {coordinator.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-muted mb-3 line-clamp-2">{coordinator.description}</p>
              <div className="space-y-2 text-sm text-muted">
                <div>
                  <span className="font-medium text-fg">Domain:</span> {coordinator.domain}
                </div>
                <div>
                  <span className="font-medium text-fg">Strategy:</span> {coordinator.decisionStrategy}
                </div>
                <div>
                  <span className="font-medium text-fg">Components:</span> {coordinator.componentIds.length}
                </div>
              </div>
              {coordinator.usageStats && (
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted">Total Runs</div>
                    <div className="font-semibold text-fg">{coordinator.usageStats.totalRuns}</div>
                  </div>
                  <div>
                    <div className="text-muted">Success Rate</div>
                    <div className="font-semibold text-fg">{coordinator.usageStats.successRate.toFixed(1)}%</div>
                  </div>
                </div>
              )}
              {coordinator.flowDiagram && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs font-semibold text-fg mb-2">Workflow Flow</div>
                  <pre className="text-xs font-mono leading-relaxed text-fg bg-gray-50 dark:bg-gray-900 overflow-x-auto rounded p-3 whitespace-pre border border-border">
                    {coordinator.flowDiagram}
                  </pre>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                <button
                  onClick={() => {
                    setSelectedCoordinator(coordinator);
                    setIsDetailModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors font-medium"
                >
                  View Details
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: coordinator.id, active: coordinator.active })}
                    className="text-muted hover:text-fg transition-colors"
                  >
                    {coordinator.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this coordinator? This action cannot be undone.')) {
                        deleteMutation.mutate(coordinator.id);
                      }
                    }}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coordinator Details Modal */}
      {isDetailModalOpen && selectedCoordinator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsDetailModalOpen(false)}>
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-fg">{selectedCoordinator.name}</h2>
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
                  selectedCoordinator.active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                }`}>
                  {selectedCoordinator.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-fg mb-2">Description</h3>
                <p className="text-sm text-muted">{selectedCoordinator.description}</p>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-1">Domain</h3>
                  <p className="text-sm text-muted">{selectedCoordinator.domain}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-1">Decision Strategy</h3>
                  <p className="text-sm text-muted capitalize">{selectedCoordinator.decisionStrategy}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-1">Version</h3>
                  <p className="text-sm text-muted">{selectedCoordinator.version}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-1">Components</h3>
                  <p className="text-sm text-muted">{selectedCoordinator.componentIds.length}</p>
                </div>
              </div>

              {/* Flow Diagram */}
              {selectedCoordinator.flowDiagram && (
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-2">Workflow Flow</h3>
                  <pre className="text-xs font-mono leading-relaxed text-fg bg-gray-50 dark:bg-gray-900 overflow-x-auto rounded p-3 whitespace-pre border border-border">
                    {selectedCoordinator.flowDiagram}
                  </pre>
                </div>
              )}

              {/* Tools */}
              <div>
                <h3 className="text-sm font-semibold text-fg mb-2">MCP Tools ({selectedCoordinator.tools.length})</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCoordinator.tools.map((tool: string) => (
                    <span key={tool} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              {/* Configuration */}
              <div>
                <h3 className="text-sm font-semibold text-fg mb-2">Configuration</h3>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 border border-border">
                  <pre className="text-xs font-mono text-fg overflow-x-auto">
                    {JSON.stringify(selectedCoordinator.config, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Usage Stats */}
              {selectedCoordinator.usageStats && (
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-2">Usage Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted">Total Runs</div>
                      <div className="text-lg font-semibold text-fg">{selectedCoordinator.usageStats.totalRuns}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Success Rate</div>
                      <div className="text-lg font-semibold text-fg">{selectedCoordinator.usageStats.successRate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Avg Runtime</div>
                      <div className="text-lg font-semibold text-fg">{selectedCoordinator.usageStats.avgRuntime.toFixed(1)}s</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Avg Cost</div>
                      <div className="text-lg font-semibold text-fg">${selectedCoordinator.usageStats.avgCost.toFixed(4)}</div>
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
