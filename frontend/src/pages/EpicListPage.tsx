import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { epicsApi } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { CreateEpicModal } from '../components/CreateEpicModal';
import type { Epic } from '../types';
import { PlusIcon } from '@heroicons/react/24/outline';

export function EpicListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject } = useProject();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch epics
  const { data: epics = [], isLoading } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => epicsApi.getAll(projectId!).then(res => {
      return Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []);
    }),
    enabled: !!projectId,
  });

  // Create epic mutation
  const createEpicMutation = useMutation({
    mutationFn: (data: { title: string; description: string; priority?: number }) =>
      epicsApi.create({ ...data, projectId: projectId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      setCreateModalOpen(false);
    },
  });

  return (
    <div>
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { name: 'Epics', testId: 'breadcrumb-epics' },
          ]}
        />
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Epics</h1>
        <button
          data-testid="create-epic"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          onClick={() => setCreateModalOpen(true)}
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Epic
        </button>
      </div>

      {/* Epic List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : epics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No epics found</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="epic-list">
          {epics.map((epic: Epic) => (
            <div
              key={epic.id}
              data-testid={`epic-${epic.id}`}
              className="block bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-gray-500">{epic.key}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Epic
                    </span>
                  </div>
                  <h3 data-testid="epic-title" className="text-lg font-medium text-gray-900 mb-2">
                    {epic.title}
                  </h3>
                  {epic.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{epic.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    {epic._count && (
                      <span>{epic._count.stories || 0} stories</span>
                    )}
                    {epic.priority && (
                      <span>Priority: {epic.priority}/5</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Epic Modal */}
      <CreateEpicModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={(data) => createEpicMutation.mutate(data)}
        isLoading={createEpicMutation.isPending}
      />
    </div>
  );
}
