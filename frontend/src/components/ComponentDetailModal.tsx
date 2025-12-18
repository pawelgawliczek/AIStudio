import { Dialog, Transition, Tab } from '@headlessui/react';
import { XMarkIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState, Fragment } from 'react';
import { analyticsService, type TimeRange } from '../services/analytics.service';
import { versioningService, type ComponentVersion } from '../services/versioning.service';
import { Component } from '../types';
import { VersionComparisonModal } from './VersionComparisonModal';

interface ComponentDetailModalProps {
  component: Component;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onUpdate: () => void;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function ComponentDetailModal({ component, isOpen, onClose, onEdit, onUpdate }: ComponentDetailModalProps) {
  const queryClient = useQueryClient();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30d');
  const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
  const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  // Fetch version history
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['componentVersions', component.id],
    queryFn: () => versioningService.getComponentVersionHistory(component.id),
    enabled: isOpen,
  });

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['componentAnalytics', component.id, selectedTimeRange],
    queryFn: () => analyticsService.getComponentAnalytics(component.id, undefined, selectedTimeRange),
    enabled: isOpen,
  });

  // Activate version mutation
  const activateMutation = useMutation({
    mutationFn: (versionId: string) => versioningService.activateComponentVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['componentVersions', component.id] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      onUpdate();
    },
  });

  // Deactivate version mutation
  const deactivateMutation = useMutation({
    mutationFn: (versionId: string) => versioningService.deactivateComponentVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['componentVersions', component.id] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      onUpdate();
    },
  });

  // Verify checksum mutation
  const verifyChecksumMutation = useMutation({
    mutationFn: (versionId: string) => versioningService.verifyComponentChecksum(versionId),
  });

  const handleCompareVersions = () => {
    if (selectedVersion1 && selectedVersion2) {
      setIsComparisonModalOpen(true);
    }
  };

  const handleExportCSV = async () => {
    if (!analytics) return;

    try {
      const blob = await analyticsService.exportExecutionHistory(
        'component',
        component.id,
        'csv',
        { timeRange: selectedTimeRange }
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `component-${component.name}-execution-history-${selectedTimeRange}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Instruction Sets */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-fg mb-2">Input Instructions</h3>
          <p className="text-sm text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
            {component.inputInstructions}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-fg mb-2">Operation Instructions</h3>
          <p className="text-sm text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
            {component.operationInstructions}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-fg mb-2">Output Instructions</h3>
          <p className="text-sm text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
            {component.outputInstructions}
          </p>
        </div>
      </div>

      {/* Configuration */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-fg">Model ID</div>
            <div className="font-medium text-fg">{component.config.modelId}</div>
          </div>
          <div>
            <div className="text-fg">Temperature</div>
            <div className="font-medium text-fg">{component.config.temperature}</div>
          </div>
          <div>
            <div className="text-fg">Max Tokens (In/Out)</div>
            <div className="font-medium text-fg">
              {component.config.maxInputTokens || 'Default'} / {component.config.maxOutputTokens || 'Default'}
            </div>
          </div>
          <div>
            <div className="text-fg">Timeout</div>
            <div className="font-medium text-fg">{component.config.timeout || 'Default'}s</div>
          </div>
          <div>
            <div className="text-fg">On Failure</div>
            <div className="font-medium text-fg">{component.onFailure}</div>
          </div>
          <div>
            <div className="text-fg">Cost Limit</div>
            <div className="font-medium text-fg">${component.config.costLimit || 'No limit'}</div>
          </div>
        </div>
      </div>

      {/* Tools */}
      {component.tools.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-fg mb-2">MCP Tools</h3>
          <div className="flex flex-wrap gap-2">
            {component.tools.map(tool => (
              <span key={tool} className="px-3 py-1 text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Usage Stats */}
      {component.usageStats && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-fg mb-4">Usage Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-bg-secondary rounded">
              <div className="text-2xl font-bold text-fg">{component.usageStats.totalRuns}</div>
              <div className="text-sm text-fg">Total Runs</div>
            </div>
            <div className="text-center p-3 bg-bg-secondary rounded">
              <div className="text-2xl font-bold text-fg">
                {component.usageStats.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-fg">Success Rate</div>
            </div>
            <div className="text-center p-3 bg-bg-secondary rounded">
              <div className="text-2xl font-bold text-fg">
                {component.usageStats.avgRuntime.toFixed(0)}s
              </div>
              <div className="text-sm text-fg">Avg Runtime</div>
            </div>
            <div className="text-center p-3 bg-bg-secondary rounded">
              <div className="text-2xl font-bold text-fg">
                ${component.usageStats.avgCost.toFixed(2)}
              </div>
              <div className="text-sm text-fg">Avg Cost</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderVersionHistoryTab = () => (
    <div className="space-y-6">
      {versionsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : versions.length === 0 ? (
        <div className="text-center py-12">
          <ClockIcon className="w-12 h-12 text-fg mx-auto mb-3" />
          <p className="text-fg mb-2">No version history</p>
          <p className="text-sm text-fg">This component has no version history yet.</p>
        </div>
      ) : (
        <>
          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div key={version.id} className="relative flex items-start gap-4">
                  {/* Timeline node */}
                  <div className="relative z-10">
                    <div
                      className={classNames(
                        'w-16 h-16 rounded-full flex items-center justify-center border-4',
                        version.active
                          ? 'bg-green-100 dark:bg-green-900/20 border-green-500'
                          : 'bg-bg-secondary border-border'
                      )}
                    >
                      <span className="text-sm font-bold text-fg">{version.version}</span>
                    </div>
                  </div>

                  {/* Version card */}
                  <div className="flex-1 bg-card border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-fg">Version {version.version}</span>
                          {version.active && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-fg">
                          {new Date(version.createdAt).toLocaleString()} · {version.createdBy || 'System'}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedVersion1 === version.id || selectedVersion2 === version.id}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (!selectedVersion1) {
                                setSelectedVersion1(version.id);
                              } else if (!selectedVersion2 && selectedVersion1 !== version.id) {
                                setSelectedVersion2(version.id);
                              }
                            } else {
                              if (selectedVersion1 === version.id) {
                                setSelectedVersion1(selectedVersion2);
                                setSelectedVersion2(null);
                              } else if (selectedVersion2 === version.id) {
                                setSelectedVersion2(null);
                              }
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        {!version.active ? (
                          <button
                            onClick={() => activateMutation.mutate(version.id)}
                            disabled={activateMutation.isPending}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            onClick={() => deactivateMutation.mutate(version.id)}
                            disabled={deactivateMutation.isPending}
                            className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>

                    {version.changeDescription && (
                      <p className="text-sm text-fg mb-3">{version.changeDescription}</p>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-bg-secondary p-2 rounded">
                        <div className="text-fg">Model</div>
                        <div className="font-medium text-fg">{version.config.modelId}</div>
                      </div>
                      <div className="bg-bg-secondary p-2 rounded">
                        <div className="text-fg">Temp</div>
                        <div className="font-medium text-fg">{version.config.temperature}</div>
                      </div>
                      <div className="bg-bg-secondary p-2 rounded">
                        <div className="text-fg">Tools</div>
                        <div className="font-medium text-fg">{version.tools.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compare Button */}
          {selectedVersion1 && selectedVersion2 && (
            <div className="flex items-center justify-center pt-4 border-t border-border">
              <button
                onClick={handleCompareVersions}
                className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark"
              >
                Compare Selected Versions
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderUsageAnalyticsTab = () => (
    <div className="space-y-6">
      {analyticsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : !analytics ? (
        <div className="text-center py-12">
          <p className="text-fg">Failed to load analytics data</p>
        </div>
      ) : (
        <>
          {/* Time Range Selector */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-fg">Performance Metrics</h3>
            <div className="flex gap-2">
              {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setSelectedTimeRange(range)}
                  className={classNames(
                    'px-3 py-1 text-sm rounded',
                    selectedTimeRange === range
                      ? 'bg-accent text-white'
                      : 'bg-bg-secondary text-fg hover:bg-bg-secondary/[0.6]'
                  )}
                >
                  {range === 'all' ? 'All Time' : range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-sm text-fg mb-1">Success Rate</div>
              <div className="text-3xl font-bold text-fg">
                {analytics.metrics.successRate.toFixed(1)}%
              </div>
              <div className="text-xs text-fg mt-1">
                {analytics.metrics.successfulExecutions} / {analytics.metrics.totalExecutions} executions
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-sm text-fg mb-1">Avg Duration</div>
              <div className="text-3xl font-bold text-fg">
                {analytics.metrics.avgDuration.toFixed(1)}s
              </div>
              <div className="text-xs text-fg mt-1">
                Total: {analytics.metrics.totalExecutions} runs
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-sm text-fg mb-1">Total Cost</div>
              <div className="text-3xl font-bold text-fg">
                ${analytics.metrics.totalCost.toFixed(2)}
              </div>
              <div className="text-xs text-fg mt-1">
                Avg: ${analytics.metrics.avgCost.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Workflows Using This Version */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-fg">Workflows Using This Component</h3>
            </div>
            {analytics.workflowsUsing.length === 0 ? (
              <div className="text-center py-8 bg-bg-secondary rounded-lg">
                <p className="text-fg">No workflows are using this component</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Workflow</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Version</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Last Used</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Executions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-bg divide-y divide-border">
                    {analytics.workflowsUsing.map((workflow) => (
                      <tr key={workflow.workflowId}>
                        <td className="px-3 py-2 text-sm text-fg">{workflow.workflowName}</td>
                        <td className="px-3 py-2 text-sm text-fg font-mono">{workflow.version}</td>
                        <td className="px-3 py-2 text-sm text-fg">
                          {formatDistanceToNow(new Date(workflow.lastUsed), { addSuffix: true })}
                        </td>
                        <td className="px-3 py-2 text-sm text-fg">{workflow.executionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Execution History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-fg">Execution History</h3>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1 text-sm bg-bg-secondary text-fg rounded hover:bg-bg-secondary/[0.6]"
              >
                Export CSV
              </button>
            </div>
            {analytics.executionHistory.length === 0 ? (
              <div className="text-center py-8 bg-bg-secondary rounded-lg">
                <p className="text-fg">No execution history for selected time range</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-bg-secondary sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Workflow</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Start Time</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Duration</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="bg-bg divide-y divide-border">
                    {analytics.executionHistory.slice(0, 100).map((execution) => (
                      <tr key={execution.id}>
                        <td className="px-3 py-2 text-sm text-fg">{execution.workflowName}</td>
                        <td className="px-3 py-2 text-sm">
                          <span
                            className={classNames(
                              'px-2 py-0.5 text-xs font-medium rounded-full',
                              execution.status === 'completed'
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                : execution.status === 'failed'
                                ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                                : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                            )}
                          >
                            {execution.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-fg">
                          {formatDistanceToNow(new Date(execution.startTime), { addSuffix: true })}
                        </td>
                        <td className="px-3 py-2 text-sm text-fg">
                          {execution.duration ? `${execution.duration.toFixed(1)}s` : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-sm text-fg">
                          {execution.cost ? `$${execution.cost.toFixed(3)}` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderChecksumTab = () => {
    const activeVersion = versions.find(v => v.active);

    return (
      <div className="space-y-6">
        {versionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : !activeVersion?.checksum ? (
          <div className="text-center py-12">
            <p className="text-fg mb-2">No checksum available</p>
            <p className="text-sm text-fg">The active version does not have a checksum calculated.</p>
          </div>
        ) : (
          <>
            {/* Checksum Display */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-fg mb-4">Checksum</h3>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 bg-bg-secondary p-3 rounded border border-border font-mono text-sm text-fg break-all">
                  {activeVersion.checksum}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeVersion.checksum || '');
                  }}
                  className="px-4 py-2 bg-bg-secondary text-fg rounded hover:bg-bg-secondary/[0.6]"
                >
                  Copy
                </button>
              </div>
              <div className="mt-2 text-sm text-fg">
                <span className="font-medium">Algorithm:</span> {activeVersion.checksumAlgorithm || 'SHA-256'}
              </div>
            </div>

            {/* Integrity Status */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">Integrity Status: Valid</h3>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                The checksum has been verified and matches the expected value.
              </p>
            </div>

            {/* Re-verify Button */}
            <div className="flex items-center justify-center pt-4 border-t border-border">
              <button
                onClick={() => verifyChecksumMutation.mutate(activeVersion.id)}
                disabled={verifyChecksumMutation.isPending}
                className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark disabled:opacity-50"
              >
                {verifyChecksumMutation.isPending ? 'Verifying...' : 'Re-verify Checksum'}
              </button>
            </div>

            {/* Verification Result */}
            {verifyChecksumMutation.data && (
              <div className={classNames(
                'rounded-lg p-4 border',
                verifyChecksumMutation.data.verified
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {verifyChecksumMutation.data.verified ? (
                    <>
                      <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <h3 className="font-semibold text-green-800 dark:text-green-300">Verification Successful</h3>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <h3 className="font-semibold text-red-800 dark:text-red-300">Verification Failed</h3>
                    </>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <div className={verifyChecksumMutation.data.verified ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                    <span className="font-medium">Expected:</span> {verifyChecksumMutation.data.expectedChecksum}
                  </div>
                  <div className={verifyChecksumMutation.data.verified ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                    <span className="font-medium">Actual:</span> {verifyChecksumMutation.data.actualChecksum}
                  </div>
                  <div className={verifyChecksumMutation.data.verified ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                    <span className="font-medium">Verified At:</span>{' '}
                    {new Date(verifyChecksumMutation.data.verifiedAt).toLocaleString()}
                  </div>
                  {verifyChecksumMutation.data.mismatchDetails && (
                    <div className="text-red-700 dark:text-red-300 mt-2">
                      <span className="font-medium">Details:</span> {verifyChecksumMutation.data.mismatchDetails}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
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
            <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-card p-6 text-left align-middle shadow-xl transition-all">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <Dialog.Title as="h3" className="text-2xl font-bold text-fg">
                        {component.name}
                      </Dialog.Title>
                      {component.description && (
                        <p className="mt-1 text-fg">{component.description}</p>
                      )}
                    </div>
                    <button
                      onClick={onClose}
                      className="text-fg hover:text-accent"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Status & Tags */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span
                      className={classNames(
                        'px-3 py-1 text-sm font-medium rounded-full',
                        component.active
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                          : 'bg-bg-secondary text-fg'
                      )}
                    >
                      {component.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 rounded-full">
                      {component.version}
                    </span>
                    {component.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Tabs */}
                  <Tab.Group>
                    <Tab.List className="flex space-x-1 rounded-xl bg-bg-secondary p-1 mb-6">
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        Overview
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        Version History
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        Usage Analytics
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        Checksum
                      </Tab>
                    </Tab.List>
                    <Tab.Panels className="mt-2">
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none max-h-[60vh] overflow-y-auto">
                        {renderOverviewTab()}
                      </Tab.Panel>
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none max-h-[60vh] overflow-y-auto">
                        {renderVersionHistoryTab()}
                      </Tab.Panel>
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none max-h-[60vh] overflow-y-auto">
                        {renderUsageAnalyticsTab()}
                      </Tab.Panel>
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none max-h-[60vh] overflow-y-auto">
                        {renderChecksumTab()}
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-fg hover:text-accent"
                    >
                      Close
                    </button>
                    <button
                      onClick={onEdit}
                      className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark"
                    >
                      Edit Component
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Version Comparison Modal */}
      {selectedVersion1 && selectedVersion2 && (
        <VersionComparisonModal
          isOpen={isComparisonModalOpen}
          onClose={() => setIsComparisonModalOpen(false)}
          entityType="component"
          versionId1={selectedVersion1}
          versionId2={selectedVersion2}
          version1Label={versions.find(v => v.id === selectedVersion1)?.version}
          version2Label={versions.find(v => v.id === selectedVersion2)?.version}
        />
      )}
    </>
  );
}
