import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCasesService } from '../services/use-cases.service';
import { UseCase } from '../types';
import { UseCaseSearchBar } from '../components/UseCaseSearchBar';
import { UseCaseCard } from '../components/UseCaseCard';
import { UseCaseDetailModal } from '../components/UseCaseDetailModal';
import { useProject } from '../context/ProjectContext';

export function UseCaseLibraryView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';

  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [searchMode, setSearchMode] = useState<'text' | 'semantic' | 'component'>('text');
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch use cases
  const { data: rawUseCases = [], isLoading, refetch } = useQuery({
    queryKey: ['useCases', projectId, searchQuery, selectedArea, searchMode],
    queryFn: async () => {
      if (!projectId) return [];

      if (searchQuery) {
        // Use search endpoint
        return useCasesService.search({
          projectId,
          query: searchQuery,
          mode: searchMode,
        });
      } else {
        // Use list endpoint with filters
        return useCasesService.getAll({
          projectId,
          area: selectedArea !== 'all' ? selectedArea : undefined,
        });
      }
    },
    enabled: !!projectId,
  });

  // Use raw use cases directly (no layer/component filtering)
  const useCases = rawUseCases;

  // Get unique areas for filtering
  const areas = useMemo(() => {
    const areaSet = new Set<string>();
    useCases.forEach(uc => {
      if (uc.area) areaSet.add(uc.area);
    });
    return Array.from(areaSet).sort();
  }, [useCases]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => useCasesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['useCases'] });
      if (selectedUseCase && isDetailModalOpen) {
        setIsDetailModalOpen(false);
        setSelectedUseCase(null);
      }
    },
  });

  const handleUseCaseClick = (useCase: UseCase) => {
    setSelectedUseCase(useCase);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    // Small delay before clearing to allow modal to close smoothly
    setTimeout(() => setSelectedUseCase(null), 200);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this use case? This action cannot be undone.')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSearch = (query: string, mode: 'text' | 'semantic' | 'component') => {
    setSearchQuery(query);
    setSearchMode(mode);
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please select a project to view use cases.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Use Case Library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse, search, and manage use cases for your project
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Use Case
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <UseCaseSearchBar
          onSearch={handleSearch}
          initialMode={searchMode}
        />

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Area:</label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Areas</option>
              {areas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          {(searchQuery || selectedArea !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedArea('all');
              }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          <span>
            Found {useCases.length} use case{useCases.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
        )}
      </div>

      {/* Use Case Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : useCases.length === 0 ? (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No use cases found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search query or filters.'
              : 'Get started by creating a new use case.'}
          </p>
          {!searchQuery && (
            <div className="mt-6">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                + Create Use Case
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {useCases.map(useCase => (
            <UseCaseCard
              key={useCase.id}
              useCase={useCase}
              onClick={() => handleUseCaseClick(useCase)}
              onDelete={() => handleDelete(useCase.id)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedUseCase && (
        <UseCaseDetailModal
          useCase={selectedUseCase}
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetailModal}
          onUpdate={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
