import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { componentsService } from '../services/components.service';
import { Component } from '../types';
import { ComponentCard } from '../components/ComponentCard';
import { CreateComponentModal } from '../components/CreateComponentModal';
import { ComponentDetailModal } from '../components/ComponentDetailModal';
import { useProject } from '../context/ProjectContext';

export function ComponentLibraryView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';

  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);

  // Fetch components
  const { data: components = [], isLoading, refetch } = useQuery({
    queryKey: ['components', projectId, searchQuery, selectedActiveFilter, selectedTagFilter],
    queryFn: async () => {
      if (!projectId) return [];

      const activeFilter = selectedActiveFilter === 'all' ? undefined : selectedActiveFilter === 'active';

      return componentsService.getAll(projectId, {
        active: activeFilter,
        search: searchQuery || undefined,
      });
    },
    enabled: !!projectId,
  });

  // Get unique tags for filtering
  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    components.forEach(c => {
      c.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [components]);

  // Filter by tag on client side
  const filteredComponents = useMemo(() => {
    if (selectedTagFilter === 'all') return components;
    return components.filter(c => c.tags.includes(selectedTagFilter));
  }, [components, selectedTagFilter]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => componentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      if (selectedComponent && isDetailModalOpen) {
        setIsDetailModalOpen(false);
        setSelectedComponent(null);
      }
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? componentsService.deactivate(id) : componentsService.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });

  const handleComponentClick = (component: Component) => {
    setSelectedComponent(component);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setTimeout(() => setSelectedComponent(null), 200);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this component? This action cannot be undone.')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleToggleActive = async (component: Component) => {
    await toggleActiveMutation.mutateAsync({ id: component.id, active: component.active });
  };

  const handleEdit = (component: Component) => {
    setEditingComponent(component);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setTimeout(() => setEditingComponent(null), 200);
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please select a project to view components.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Component Library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Reusable building blocks configured via 3 instruction sets
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Component
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Active Filter */}
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

          {/* Tag Filter */}
          {tags.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Tag:</label>
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Tags</option>
                {tags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters */}
          {(searchQuery || selectedActiveFilter !== 'all' || selectedTagFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedActiveFilter('all');
                setSelectedTagFilter('all');
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
            Found {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
        )}
      </div>

      {/* Component Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredComponents.length === 0 ? (
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No components found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search query or filters.'
              : 'Get started by creating a new component.'}
          </p>
          {!searchQuery && (
            <div className="mt-6">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                + Create Component
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComponents.map(component => (
            <ComponentCard
              key={component.id}
              component={component}
              onClick={() => handleComponentClick(component)}
              onEdit={() => handleEdit(component)}
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
            handleEdit(selectedComponent);
            handleCloseDetailModal();
          }}
          onUpdate={() => refetch()}
        />
      )}

      {/* Create/Edit Modal */}
      <CreateComponentModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={() => {
          refetch();
          handleCloseCreateModal();
        }}
        projectId={projectId}
        editingComponent={editingComponent}
      />
    </div>
  );
}
