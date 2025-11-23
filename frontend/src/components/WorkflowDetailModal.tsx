import { useState, Fragment } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workflow } from '../types';
import { versioningService, type WorkflowVersion } from '../services/versioning.service';
import { analyticsService, type TimeRange } from '../services/analytics.service';
import { VersionComparisonModal } from './VersionComparisonModal';
import { XMarkIcon, ClockIcon, ChartBarIcon, Cog6ToothIcon, PlayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface WorkflowDetailModalProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function WorkflowDetailModal({ workflow, isOpen, onClose, onUpdate }: WorkflowDetailModalProps) {
  const queryClient = useQueryClient();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30d');
  const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
  const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  // Fetch version history
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['workflowVersions', workflow.id],
    queryFn: () => versioningService.getWorkflowVersionHistory(workflow.id),
    enabled: isOpen,
  });

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['workflowAnalytics', workflow.id, selectedTimeRange],
    queryFn: () => analyticsService.getWorkflowAnalytics(workflow.id, undefined, selectedTimeRange),
    enabled: isOpen,
  });

  // Activate/deactivate mutations
  const activateMutation = useMutation({
    mutationFn: (versionId: string) => versioningService.activateWorkflowVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowVersions', workflow.id] });
      onUpdate();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (versionId: string) => versioningService.deactivateWorkflowVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowVersions', workflow.id] });
      onUpdate();
    },
  });

  const handleVersionClick = (versionId: string) => {
    if (!selectedVersion1) {
      setSelectedVersion1(versionId);
    } else if (!selectedVersion2 && versionId !== selectedVersion1) {
      setSelectedVersion2(versionId);
    } else {
      setSelectedVersion1(versionId);
      setSelectedVersion2(null);
    }
  };

  const handleCompare = () => {
    if (selectedVersion1 && selectedVersion2) {
      setIsComparisonModalOpen(true);
    }
  };

  const handleExportAnalytics = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const blob = await analyticsService.exportExecutionHistory(
        'workflow',
        workflow.id,
        format,
        { timeRange: selectedTimeRange }
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workflow-${workflow.name}-analytics.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  return (
    <>
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
                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-2xl font-bold leading-6 text-gray-900 dark:text-white"
                      >
                        {workflow.name}
                      </Dialog.Title>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium">{workflow.version}</span>
                        <span>•</span>
                        <span className={workflow.active ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                          {workflow.active ? 'Active' : 'Inactive'}
                        </span>
                        <span>•</span>
                        <span>{workflow.triggerConfig.type}</span>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <XMarkIcon className="h-6 w-6 text-gray-500" />
                    </button>
                  </div>

                  <Tab.Group>
                    <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-900/20 p-1">
                      <Tab
                        className={({ selected }) =>
                          `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                           ${
                             selected
                               ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow'
                               : 'text-gray-700 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-gray-200'
                           }`
                        }
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Cog6ToothIcon className="h-5 w-5" />
                          <span>Overview</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                           ${
                             selected
                               ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow'
                               : 'text-gray-700 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-gray-200'
                           }`
                        }
                      >
                        <div className="flex items-center justify-center gap-2">
                          <ClockIcon className="h-5 w-5" />
                          <span>Version History</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                           ${
                             selected
                               ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow'
                               : 'text-gray-700 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-gray-200'
                           }`
                        }
                      >
                        <div className="flex items-center justify-center gap-2">
                          <PlayIcon className="h-5 w-5" />
                          <span>Executions</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                           ${
                             selected
                               ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow'
                               : 'text-gray-700 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-gray-200'
                           }`
                        }
                      >
                        <div className="flex items-center justify-center gap-2">
                          <ChartBarIcon className="h-5 w-5" />
                          <span>Analytics</span>
                        </div>
                      </Tab>
                    </Tab.List>
                    <Tab.Panels className="mt-4">
                      {/* Overview Tab */}
                      <Tab.Panel className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {workflow.description || 'No description provided'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Coordinator</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {(workflow as any).coordinator?.name || 'Not assigned'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Trigger Type</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                              {workflow.triggerConfig.type}
                            </p>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Trigger Configuration</h4>
                          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                              {JSON.stringify(workflow.triggerConfig, null, 2)}
                            </pre>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Created</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {new Date((workflow as any).createdAt || workflow.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Last Updated</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {new Date((workflow as any).updatedAt || workflow.updatedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </Tab.Panel>

                      {/* Version History Tab */}
                      <Tab.Panel className="space-y-4">
                        {versionsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          </div>
                        ) : versions.length === 0 ? (
                          <div className="text-center py-12">
                            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No version history</p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              This workflow has no version history yet.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Interactive Timeline */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                                Version Timeline
                              </h4>

                              <div className="flex items-center overflow-x-auto pb-4 space-x-4">
                                {versions.map((version, index) => (
                                  <div key={version.id} className="flex items-center">
                                    <button
                                      onClick={() => handleVersionClick(version.id)}
                                      className={`flex flex-col items-center group relative cursor-pointer outline-none focus:outline-none ${
                                        selectedVersion1 === version.id || selectedVersion2 === version.id
                                          ? 'scale-110'
                                          : ''
                                      }`}
                                      title={`Select ${version.version}`}
                                    >
                                      <span
                                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                          version.active
                                            ? 'bg-blue-600 text-white border-2 border-blue-600'
                                            : selectedVersion1 === version.id || selectedVersion2 === version.id
                                            ? 'bg-blue-500 text-white border-2 border-blue-500'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                      >
                                        {version.version}
                                      </span>
                                      <span className="absolute -bottom-6 text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        {new Date(version.createdAt).toLocaleDateString()}
                                      </span>
                                    </button>
                                    {index < versions.length - 1 && (
                                      <div className="w-12 h-px bg-gray-300 dark:bg-gray-700"></div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {selectedVersion1 && selectedVersion2 && (
                                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <button
                                    onClick={handleCompare}
                                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                  >
                                    Compare Selected Versions
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Version List */}
                            <div className="space-y-3">
                              {versions.map((version) => (
                                <div
                                  key={version.id}
                                  className={`p-4 rounded-lg border ${
                                    version.active
                                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                          {version.version}
                                        </span>
                                        {version.active && (
                                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full">
                                            Active
                                          </span>
                                        )}
                                      </div>
                                      {version.changeDescription && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                          {version.changeDescription}
                                        </p>
                                      )}
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Created: {new Date(version.createdAt).toLocaleString()}
                                        {version.createdBy && ` • By: ${version.createdBy}`}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      {!version.active && (
                                        <button
                                          onClick={() => activateMutation.mutate(version.id)}
                                          disabled={activateMutation.isPending}
                                          className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-md transition-colors disabled:opacity-50"
                                        >
                                          Activate
                                        </button>
                                      )}
                                      {version.active && (
                                        <button
                                          onClick={() => deactivateMutation.mutate(version.id)}
                                          disabled={deactivateMutation.isPending}
                                          className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
                                        >
                                          Deactivate
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </Tab.Panel>

                      {/* Executions Tab */}
                      <Tab.Panel className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Executions</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedTimeRange('7d')}
                              className={`px-3 py-1 text-xs rounded ${
                                selectedTimeRange === '7d'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              7D
                            </button>
                            <button
                              onClick={() => setSelectedTimeRange('30d')}
                              className={`px-3 py-1 text-xs rounded ${
                                selectedTimeRange === '30d'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              30D
                            </button>
                            <button
                              onClick={() => setSelectedTimeRange('90d')}
                              className={`px-3 py-1 text-xs rounded ${
                                selectedTimeRange === '90d'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              90D
                            </button>
                            <button
                              onClick={() => setSelectedTimeRange('all')}
                              className={`px-3 py-1 text-xs rounded ${
                                selectedTimeRange === 'all'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              All Time
                            </button>
                          </div>
                        </div>

                        {analytics?.executionHistory && analytics.executionHistory.length > 0 ? (
                          <div className="space-y-2">
                            {analytics.executionHistory.map((execution: any) => (
                              <div
                                key={execution.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex items-center gap-3">
                                  {execution.status === 'completed' ? (
                                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      Run #{execution.runNumber || 'N/A'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {new Date(execution.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Duration: {execution.duration || 'N/A'}
                                  </p>
                                  {execution.cost && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Cost: ${execution.cost.toFixed(4)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <PlayIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No execution history</p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              No executions found for the selected time range.
                            </p>
                          </div>
                        )}
                      </Tab.Panel>

                      {/* Analytics Tab */}
                      <Tab.Panel className="space-y-4">
                        {analyticsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          </div>
                        ) : analytics ? (
                          <>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Usage Metrics</h4>
                              <button
                                onClick={() => handleExportAnalytics('csv')}
                                className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors"
                              >
                                Export CSV
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Executions</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                  {analytics.metrics?.totalExecutions || 0}
                                </p>
                              </div>
                              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Success Rate</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                  {analytics.metrics?.successRate?.toFixed(1) || 0}%
                                </p>
                              </div>
                              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Duration</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                  {analytics.metrics?.avgDuration?.toFixed(1) || 0}s
                                </p>
                              </div>
                              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Cost</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                  ${analytics.metrics?.totalCost?.toFixed(2) || 0}
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-sm text-red-600 dark:text-red-400">Failed to load analytics data</p>
                          </div>
                        )}
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Version Comparison Modal */}
      {isComparisonModalOpen && selectedVersion1 && selectedVersion2 && (
        <VersionComparisonModal
          isOpen={isComparisonModalOpen}
          onClose={() => setIsComparisonModalOpen(false)}
          entityType="workflow"
          versionId1={selectedVersion1}
          versionId2={selectedVersion2}
          version1Label={versions.find(v => v.id === selectedVersion1)?.version || ''}
          version2Label={versions.find(v => v.id === selectedVersion2)?.version || ''}
        />
      )}
    </>
  );
}
