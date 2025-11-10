import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon, ClockIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { Story, StoryStatus, StoryType, Subtask } from '../types';
import clsx from 'clsx';

interface StoryDetailDrawerProps {
  story: Story | null;
  open: boolean;
  onClose: () => void;
  commits?: any[];
  runs?: any[];
}

const statusColors: Record<StoryStatus, string> = {
  backlog: 'bg-gray-100 text-gray-800',
  planning: 'bg-blue-100 text-blue-800',
  analysis: 'bg-purple-100 text-purple-800',
  architecture: 'bg-indigo-100 text-indigo-800',
  design: 'bg-pink-100 text-pink-800',
  implementation: 'bg-yellow-100 text-yellow-800',
  review: 'bg-orange-100 text-orange-800',
  qa: 'bg-green-100 text-green-800',
  done: 'bg-gray-100 text-gray-800',
  blocked: 'bg-red-100 text-red-800',
};

export function StoryDetailDrawer({ story, open, onClose, commits = [], runs = [] }: StoryDetailDrawerProps) {
  if (!story) return null;

  const subtasksCompleted = story.subtasks?.filter(st => st.status === 'done').length || 0;
  const subtasksTotal = story.subtasks?.length || 0;

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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    {/* Header */}
                    <div className="bg-indigo-700 px-4 py-6 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-base font-semibold leading-6 text-white">
                          {story.key}: {story.title}
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="rounded-md bg-indigo-700 text-indigo-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                            onClick={onClose}
                          >
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm text-indigo-100">
                          {story.project?.name} {story.epic && `• ${story.epic.key}`}
                        </p>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="relative flex-1 px-4 py-6 sm:px-6">
                      <div className="space-y-6">
                        {/* Status, Priority, Type */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Status</label>
                            <span className={clsx(
                              'mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                              statusColors[story.status]
                            )}>
                              {story.status}
                            </span>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Priority</label>
                            <div className="mt-1 text-yellow-500 text-lg">
                              {'★'.repeat(Math.min(story.businessImpact || 3, 5))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Type</label>
                            <span className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                              {story.type}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {story.description || 'No description provided.'}
                          </p>
                        </div>

                        {/* Complexity Assessment */}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">Complexity Assessment</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm font-medium text-gray-700">Business Complexity</div>
                              <div className="mt-1 text-2xl font-bold text-indigo-600">
                                {story.businessComplexity || 'N/A'}
                              </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm font-medium text-gray-700">Technical Complexity</div>
                              <div className="mt-1 text-2xl font-bold text-purple-600">
                                {story.technicalComplexity || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Subtasks */}
                        {subtasksTotal > 0 && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              Subtasks ({subtasksCompleted}/{subtasksTotal} completed)
                            </h3>
                            <div className="space-y-2">
                              {story.subtasks?.map((subtask) => (
                                <div
                                  key={subtask.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex items-center space-x-3">
                                    {subtask.status === 'done' ? (
                                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                    ) : (
                                      <ClockIcon className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{subtask.title}</div>
                                      <div className="text-xs text-gray-500">
                                        {subtask.layer && `${subtask.layer} • `}
                                        {subtask.assigneeType || 'Unassigned'}
                                      </div>
                                    </div>
                                  </div>
                                  <span className={clsx(
                                    'px-2 py-1 text-xs rounded-full',
                                    subtask.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  )}>
                                    {subtask.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Commits */}
                        {commits.length > 0 && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              Commits ({commits.length})
                            </h3>
                            <div className="space-y-2">
                              {commits.slice(0, 5).map((commit: any) => (
                                <div key={commit.hash} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                                  <CodeBracketIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 font-mono">
                                      {commit.hash.substring(0, 7)}
                                    </div>
                                    <div className="text-sm text-gray-600 truncate">{commit.message}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {commit.author} • {new Date(commit.timestamp).toLocaleDateString()}
                                      {commit.filesChanged > 0 && ` • ${commit.filesChanged} files`}
                                      {commit.linesAdded > 0 && ` • +${commit.linesAdded} −${commit.linesDeleted}`}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Agent Executions */}
                        {runs.length > 0 && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              Agent Executions ({runs.length})
                            </h3>
                            <div className="space-y-2">
                              {runs.slice(0, 5).map((run: any) => (
                                <div key={run.id} className="p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-gray-900">
                                      {run.success ? '✓' : '✗'} Run {run.id.substring(0, 8)}
                                    </div>
                                    <span className={clsx(
                                      'px-2 py-1 text-xs rounded-full',
                                      run.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    )}>
                                      {run.success ? 'Success' : 'Failed'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Tokens: {run.tokensInput + run.tokensOutput} ({run.tokensInput} in, {run.tokensOutput} out)
                                    {run.iterations > 1 && ` • ${run.iterations} iterations`}
                                  </div>
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
