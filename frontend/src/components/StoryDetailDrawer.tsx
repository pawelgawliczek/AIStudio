import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon, ClockIcon, CodeBracketIcon, PencilIcon } from '@heroicons/react/24/outline';
import { Story, StoryStatus, StoryType, Subtask } from '../types';
import { WorkflowAnalysisDisplay } from './workflow/WorkflowAnalysisDisplay';
import { StoryTraceabilityTabs } from './story/StoryTraceabilityTabs';
import { storiesService } from '../services/stories.service';
import clsx from 'clsx';

interface StoryDetailDrawerProps {
  story: Story | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (story: Story) => void;
  commits?: any[];
  runs?: any[];
}

const statusColors: Record<StoryStatus, string> = {
  backlog: 'bg-muted text-fg border border-border',
  planning: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
  analysis: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
  architecture: 'bg-accent/10 text-accent-dark border border-accent/20',
  design: 'bg-pink-500/10 text-pink-600 border border-pink-500/20',
  implementation: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
  review: 'bg-orange-500/10 text-orange-600 border border-orange-500/20',
  qa: 'bg-green-500/10 text-green-600 border border-green-500/20',
  done: 'bg-muted text-fg border border-border',
  blocked: 'bg-red-500/10 text-red-600 border border-red-500/20',
};

export function StoryDetailDrawer({ story, open, onClose, onEdit, commits = [], runs = [] }: StoryDetailDrawerProps) {
  const [fullStory, setFullStory] = useState<Story | null>(story);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Fetch full story details when drawer opens
  useEffect(() => {
    if (open && story?.id) {
      setIsLoadingDetails(true);
      storiesService.getById(story.id)
        .then(data => {
          setFullStory(data);
        })
        .catch(error => {
          console.error('Failed to load full story details:', error);
          setFullStory(story);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    } else {
      setFullStory(story);
    }
  }, [open, story?.id]);

  if (!fullStory) return null;

  const subtasksCompleted = fullStory.subtasks?.filter(st => st.status === 'done').length || 0;
  const subtasksTotal = fullStory.subtasks?.length || 0;

  const handleEdit = () => {
    if (onEdit && fullStory) {
      onEdit(fullStory);
    }
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                  <div className="flex h-full flex-col overflow-y-scroll bg-card border border-border shadow-xl">
                    {/* Header */}
                    <div className="bg-accent px-4 py-6 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-base font-semibold leading-6 text-white">
                          {fullStory.key}: {fullStory.title}
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center gap-2">
                          {onEdit && (
                            <button
                              type="button"
                              className="rounded-md bg-accent text-accent-fg hover:text-white focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                              onClick={handleEdit}
                              title="Edit Story"
                            >
                              <span className="sr-only">Edit story</span>
                              <PencilIcon className="h-6 w-6" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="rounded-md bg-accent text-accent-fg hover:text-white focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            onClick={onClose}
                          >
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm text-accent-fg">
                          {fullStory.project?.name} {fullStory.epic && `• ${fullStory.epic.key}`}
                        </p>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="relative flex-1 px-4 py-6 sm:px-6">
                      {isLoadingDetails && (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                        </div>
                      )}
                      <div className="space-y-6">
                        {/* Status, Priority, Type */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-muted">Status</label>
                            <span className={clsx(
                              'mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                              statusColors[fullStory.status]
                            )}>
                              {fullStory.status}
                            </span>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-muted">Priority</label>
                            <div className="mt-1 text-yellow-500 text-lg">
                              {'★'.repeat(Math.min(fullStory.businessImpact || 3, 5))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-muted">Type</label>
                            <span className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              {fullStory.type}
                            </span>
                          </div>
                        </div>

                        {/* 1. Traceability Tabs */}
                        {!isLoadingDetails && (
                          <div>
                            <h3 className="text-lg font-medium text-fg mb-3">Story Traceability</h3>
                            <StoryTraceabilityTabs
                              workflowRuns={(fullStory as any).workflowRuns}
                              useCaseLinks={(fullStory as any).useCaseLinks}
                              commits={(fullStory as any).commits}
                            />
                          </div>
                        )}

                        {/* 2. Complexity Assessment */}
                        <div>
                          <h3 className="text-lg font-medium text-fg mb-2">Complexity Assessment</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-secondary p-3 rounded-lg">
                              <div className="text-sm font-medium text-muted">Business Complexity</div>
                              <div className="mt-1 text-2xl font-bold text-accent-dark">
                                {fullStory.businessComplexity || 'N/A'}
                              </div>
                            </div>
                            <div className="bg-secondary p-3 rounded-lg">
                              <div className="text-sm font-medium text-muted">Technical Complexity</div>
                              <div className="mt-1 text-2xl font-bold text-purple-600">
                                {fullStory.technicalComplexity || 'N/A'}
                              </div>
                            </div>
                            {/* Token metrics now available in dedicated TokenMetricsPanel */}
                          </div>
                        </div>

                        {/* 3. Workflow Analysis Fields */}
                        {(fullStory.contextExploration || fullStory.baAnalysis || fullStory.architectAnalysis || fullStory.designerAnalysis) && (
                          <div className="space-y-3">
                            {fullStory.contextExploration && (
                              <div className="bg-secondary p-4 rounded-lg">
                                <h4 className="text-sm font-semibold text-fg mb-2 flex items-center">
                                  <span className="mr-2">🔍</span> Context Exploration
                                </h4>
                                <div className="text-sm text-muted whitespace-pre-wrap">
                                  {fullStory.contextExploration}
                                </div>
                              </div>
                            )}

                            {fullStory.baAnalysis && (
                              <div className="bg-secondary p-4 rounded-lg">
                                <h4 className="text-sm font-semibold text-fg mb-2 flex items-center">
                                  <span className="mr-2">📋</span> Business Analysis
                                </h4>
                                <div className="text-sm text-muted whitespace-pre-wrap">
                                  {fullStory.baAnalysis}
                                </div>
                              </div>
                            )}

                            {fullStory.architectAnalysis && (
                              <div className="bg-secondary p-4 rounded-lg">
                                <h4 className="text-sm font-semibold text-fg mb-2 flex items-center">
                                  <span className="mr-2">🏗️</span> Architecture Design
                                </h4>
                                <div className="text-sm text-muted whitespace-pre-wrap">
                                  {fullStory.architectAnalysis}
                                </div>
                              </div>
                            )}

                            {fullStory.designerAnalysis && (
                              <div className="bg-secondary p-4 rounded-lg">
                                <h4 className="text-sm font-semibold text-fg mb-2 flex items-center">
                                  <span className="mr-2">🎨</span> UI/UX Design
                                </h4>
                                <div className="text-sm text-muted whitespace-pre-wrap">
                                  {fullStory.designerAnalysis}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. Description */}
                        <div>
                          <h3 className="text-lg font-medium text-fg mb-2">Description</h3>
                          <p className="text-sm text-muted whitespace-pre-wrap">
                            {fullStory.description || 'No description provided.'}
                          </p>
                        </div>

                        {/* Layers & Components */}
                        {((fullStory.layers && fullStory.layers.length > 0) || (fullStory.components && fullStory.components.length > 0)) && (
                          <div>
                            <h3 className="text-lg font-medium text-fg mb-2">Architecture</h3>
                            <div className="space-y-3">
                              {fullStory.layers && fullStory.layers.length > 0 && (
                                <div>
                                  <div className="text-sm font-medium text-muted mb-2">Layers</div>
                                  <div className="flex flex-wrap gap-2">
                                    {fullStory.layers.map((sl) => (
                                      <span
                                        key={sl.layer.id}
                                        className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium"
                                        style={{
                                          backgroundColor: `${sl.layer.color}15`,
                                          color: sl.layer.color || '#6366F1',
                                          borderWidth: '1px',
                                          borderColor: `${sl.layer.color}30`,
                                        }}
                                      >
                                        <span className="mr-1.5">{sl.layer.icon}</span>
                                        {sl.layer.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {fullStory.components && fullStory.components.length > 0 && (
                                <div>
                                  <div className="text-sm font-medium text-muted mb-2">Components</div>
                                  <div className="flex flex-wrap gap-2">
                                    {fullStory.components.map((sc) => (
                                      <span
                                        key={sc.component.id}
                                        className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium"
                                        style={{
                                          backgroundColor: `${sc.component.color}15`,
                                          color: sc.component.color || '#10B981',
                                          borderWidth: '1px',
                                          borderColor: `${sc.component.color}30`,
                                        }}
                                      >
                                        <span className="mr-1.5">{sc.component.icon}</span>
                                        {sc.component.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Subtasks */}
                        {subtasksTotal > 0 && (
                          <div>
                            <h3 className="text-lg font-medium text-fg mb-2">
                              Subtasks ({subtasksCompleted}/{subtasksTotal} completed)
                            </h3>
                            <div className="space-y-2">
                              {fullStory.subtasks?.map((subtask) => (
                                <div
                                  key={subtask.id}
                                  className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                                >
                                  <div className="flex items-center space-x-3">
                                    {subtask.status === 'done' ? (
                                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                    ) : (
                                      <ClockIcon className="w-5 h-5 text-muted" />
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-fg">{subtask.title}</div>
                                      <div className="text-xs text-muted">
                                        {subtask.layer && `${subtask.layer} • `}
                                        {subtask.assigneeType || 'Unassigned'}
                                      </div>
                                    </div>
                                  </div>
                                  <span className={clsx(
                                    'px-2 py-1 text-xs rounded-full',
                                    subtask.status === 'done' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-muted text-fg border border-border'
                                  )}>
                                    {subtask.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
