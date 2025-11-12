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
    mutationFn: (id: string) => coordinatorsService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coordinators'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? coordinatorsService.deactivate(id) : coordinatorsService.activate(id),
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
            <div key={coordinator.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{coordinator.name}</h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    coordinator.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {coordinator.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{coordinator.description}</p>
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Domain:</span> {coordinator.domain}
                </div>
                <div>
                  <span className="font-medium">Strategy:</span> {coordinator.decisionStrategy}
                </div>
                <div>
                  <span className="font-medium">Components:</span> {coordinator.componentIds.length}
                </div>
              </div>
              {coordinator.usageStats && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">Total Runs</div>
                    <div className="font-semibold text-gray-900">{coordinator.usageStats.totalRuns}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Success Rate</div>
                    <div className="font-semibold text-gray-900">{coordinator.usageStats.successRate.toFixed(1)}%</div>
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                <button
                  onClick={() => toggleActiveMutation.mutate({ id: coordinator.id, active: coordinator.active })}
                  className="text-gray-600 hover:text-gray-900"
                >
                  {coordinator.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this coordinator? This action cannot be undone.')) {
                      deleteMutation.mutate(coordinator.id);
                    }
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
