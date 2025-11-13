import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCasesService } from '../services/use-cases.service';
import { UseCase, UseCaseVersion } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

interface UseCaseDetailModalProps {
  useCase: UseCase;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function UseCaseDetailModal({
  useCase,
  isOpen,
  onClose,
  onUpdate,
}: UseCaseDetailModalProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: useCase.title,
    area: useCase.area || '',
    summary: useCase.latestVersion?.summary || '',
    content: useCase.latestVersion?.content || '',
  });

  // Fetch version history
  const { data: versions = [] } = useQuery({
    queryKey: ['useCaseVersions', useCase.id],
    queryFn: () => useCasesService.getVersionHistory(useCase.id),
    enabled: isOpen,
  });

  // Fetch related use cases
  const { data: relatedUseCases = [] } = useQuery({
    queryKey: ['relatedUseCases', useCase.id],
    queryFn: () => useCasesService.findRelated(useCase.id, 5),
    enabled: isOpen,
  });

  // Reset form when useCase changes
  useEffect(() => {
    setEditForm({
      title: useCase.title,
      area: useCase.area || '',
      summary: useCase.latestVersion?.summary || '',
      content: useCase.latestVersion?.content || '',
    });
    setIsEditing(false);
  }, [useCase]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: typeof editForm) =>
      useCasesService.update(useCase.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['useCases'] });
      queryClient.invalidateQueries({ queryKey: ['useCaseVersions', useCase.id] });
      setIsEditing(false);
      onUpdate();
    },
  });

  const handleSave = async () => {
    await updateMutation.mutateAsync(editForm);
  };

  const handleCancel = () => {
    setEditForm({
      title: useCase.title,
      area: useCase.area || '',
      summary: useCase.latestVersion?.summary || '',
      content: useCase.latestVersion?.content || '',
    });
    setIsEditing(false);
  };

  const latestVersion = useCase.latestVersion || versions[0];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-card text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-200">
                  <div className="flex-1">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="text-2xl font-bold text-fg border-b-2 border-accent focus:outline-none w-full"
                      />
                    ) : (
                      <Dialog.Title
                        as="h3"
                        className="text-2xl font-bold leading-6 text-fg"
                      >
                        {useCase.title}
                      </Dialog.Title>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-sm text-muted">
                      <span className="font-mono">{useCase.key}</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.area}
                          onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                          placeholder="Area (optional)"
                          className="px-2 py-1 border border-border rounded"
                        />
                      ) : (
                        useCase.area && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            🏷️ {useCase.area}
                          </span>
                        )
                      )}
                      {latestVersion && (
                        <span>Version {latestVersion.version}</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSave}
                          disabled={updateMutation.isPending}
                          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark disabled:opacity-50"
                        >
                          {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 bg-bg-secondary text-fg rounded-lg hover:bg-accent hover:text-accent-fg"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="p-2 text-muted hover:text-fg rounded-lg hover:bg-bg-secondary"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <Tab.Group>
                  <Tab.List className="flex space-x-1 bg-bg-secondary p-1">
                    <Tab
                      className={({ selected }) =>
                        `w-full py-2.5 text-sm font-medium leading-5 transition-colors
                        ${selected
                          ? 'bg-card text-accent shadow'
                          : 'text-fg hover:bg-card/[0.12] hover:text-accent'
                        }`
                      }
                    >
                      Content
                    </Tab>
                    <Tab
                      className={({ selected }) =>
                        `w-full py-2.5 text-sm font-medium leading-5 transition-colors
                        ${selected
                          ? 'bg-card text-accent shadow'
                          : 'text-fg hover:bg-card/[0.12] hover:text-accent'
                        }`
                      }
                    >
                      Version History ({versions.length})
                    </Tab>
                    <Tab
                      className={({ selected }) =>
                        `w-full py-2.5 text-sm font-medium leading-5 transition-colors
                        ${selected
                          ? 'bg-card text-accent shadow'
                          : 'text-fg hover:bg-card/[0.12] hover:text-accent'
                        }`
                      }
                    >
                      Linked Stories ({useCase.storyLinks?.length || 0})
                    </Tab>
                    <Tab
                      className={({ selected }) =>
                        `w-full py-2.5 text-sm font-medium leading-5 transition-colors
                        ${selected
                          ? 'bg-card text-accent shadow'
                          : 'text-fg hover:bg-card/[0.12] hover:text-accent'
                        }`
                      }
                    >
                      Related ({relatedUseCases.length})
                    </Tab>
                  </Tab.List>

                  <Tab.Panels className="p-6 max-h-[60vh] overflow-y-auto">
                    {/* Content Tab */}
                    <Tab.Panel>
                      {isEditing ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-fg mb-1">
                              Summary
                            </label>
                            <textarea
                              value={editForm.summary}
                              onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Brief summary of the use case..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-fg mb-1">
                              Content (Markdown)
                            </label>
                            <textarea
                              value={editForm.content}
                              onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                              rows={15}
                              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                              placeholder="Use case content in markdown format..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none">
                          {latestVersion?.summary && (
                            <div className="mb-4 p-4 bg-accent/10 rounded-lg">
                              <p className="text-sm text-fg">{latestVersion.summary}</p>
                            </div>
                          )}
                          {latestVersion?.content ? (
                            <ReactMarkdown>{latestVersion.content}</ReactMarkdown>
                          ) : (
                            <p className="text-muted italic">No content available</p>
                          )}
                        </div>
                      )}
                    </Tab.Panel>

                    {/* Version History Tab */}
                    <Tab.Panel>
                      <div className="space-y-4">
                        {versions.length === 0 ? (
                          <p className="text-muted text-center py-8">No versions found</p>
                        ) : (
                          versions.map((version: UseCaseVersion) => (
                            <div
                              key={version.id}
                              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="text-sm font-semibold text-fg">
                                    Version {version.version}
                                    {version.version === latestVersion?.version && (
                                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                        Latest
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-muted mt-1">
                                    by {version.createdBy.name} •{' '}
                                    {format(new Date(version.createdAt), 'PPpp')}
                                  </p>
                                </div>
                              </div>
                              {version.summary && (
                                <p className="text-sm text-fg mt-2">{version.summary}</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </Tab.Panel>

                    {/* Linked Stories Tab */}
                    <Tab.Panel>
                      <div className="space-y-2">
                        {!useCase.storyLinks || useCase.storyLinks.length === 0 ? (
                          <p className="text-muted text-center py-8">No linked stories</p>
                        ) : (
                          useCase.storyLinks.map((link) => (
                            <div
                              key={link.storyId}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              <div>
                                <span className="font-mono text-sm text-gray-600">{link.story.key}</span>
                                <h4 className="text-sm font-medium text-fg mt-1">
                                  {link.story.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    link.story.status === 'done'
                                      ? 'bg-green-100 text-green-800'
                                      : link.story.status === 'blocked'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-bg-secondary text-gray-800'
                                  }`}>
                                    {link.story.status}
                                  </span>
                                  {link.relation && (
                                    <span className="text-xs text-muted">
                                      ({link.relation})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => window.open(`/stories/${link.storyId}`, '_blank')}
                                className="text-accent hover:text-accent"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </Tab.Panel>

                    {/* Related Use Cases Tab */}
                    <Tab.Panel>
                      <div className="space-y-2">
                        {relatedUseCases.length === 0 ? (
                          <p className="text-muted text-center py-8">No related use cases found</p>
                        ) : (
                          relatedUseCases.map((related: UseCase) => (
                            <div
                              key={related.id}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                              onClick={() => window.open(`/use-cases?id=${related.id}`, '_blank')}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm text-gray-600">{related.key}</span>
                                  {related.similarity !== undefined && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                      {Math.round(related.similarity * 100)}% similar
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-medium text-fg mt-1">
                                  {related.title}
                                </h4>
                                {related.area && (
                                  <span className="text-xs text-muted mt-1">
                                    🏷️ {related.area}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
