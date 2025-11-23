import { useState, Fragment } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CoordinatorAgent, Component } from '../types';
import { versioningService, type CoordinatorVersion } from '../services/versioning.service';
import { analyticsService, type TimeRange } from '../services/analytics.service';
import {
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  CubeIcon,
  Squares2X2Icon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { VersionComparisonModal } from './VersionComparisonModal';
import { formatDistanceToNow } from 'date-fns';

interface CoordinatorDetailModalProps {
  coordinator: CoordinatorAgent;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onUpdate: () => void;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function CoordinatorDetailModal({
  coordinator,
  isOpen,
  onClose,
  onEdit,
  onUpdate
}: CoordinatorDetailModalProps) {
  const queryClient = useQueryClient();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30d');
  const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
  const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch version history
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['coordinatorVersions', coordinator.id],
    queryFn: () => versioningService.getCoordinatorVersionHistory(coordinator.id),
    enabled: isOpen,
  });

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['coordinatorAnalytics', coordinator.id, selectedTimeRange],
    queryFn: () => analyticsService.getCoordinatorAnalytics(coordinator.id, undefined, selectedTimeRange),
    enabled: isOpen,
  });

  // Activate version mutation
  const activateMutation = useMutation({
    mutationFn: (versionId: string) => versioningService.activateCoordinatorVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinatorVersions', coordinator.id] });
      queryClient.invalidateQueries({ queryKey: ['coordinators'] });
      onUpdate();
    },
  });

  // Deactivate version mutation
  const deactivateMutation = useMutation({
    mutationFn: (versionId: string) => versioningService.deactivateCoordinatorVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinatorVersions', coordinator.id] });
      queryClient.invalidateQueries({ queryKey: ['coordinators'] });
      onUpdate();
    },
  });

  // Verify checksum mutation
  const verifyChecksumMutation = useMutation({
    mutationFn: (versionId: string) => versioningService.verifyCoordinatorChecksum(versionId),
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
        'coordinator',
        coordinator.id,
        'csv',
        { timeRange: selectedTimeRange }
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coordinator-${coordinator.name}-execution-history-${selectedTimeRange}.csv`;
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
      {/* Coordinator Instructions */}
      <div>
        <h3 className="text-sm font-semibold text-fg mb-2">Coordinator Instructions</h3>
        <p className="text-sm text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
          {coordinator.coordinatorInstructions}
        </p>
      </div>

      {/* Metadata */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Metadata</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-fg">Decision Strategy</div>
            <div className="font-medium text-fg capitalize">{coordinator.decisionStrategy}</div>
          </div>
          <div>
            <div className="text-fg">Domain</div>
            <div className="font-medium text-fg">{coordinator.domain}</div>
          </div>
          <div>
            <div className="text-fg">Status</div>
            <div className="font-medium text-fg">
              <span className={classNames(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                coordinator.active
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                  : 'bg-bg-secondary text-fg'
              )}>
                {coordinator.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div>
            <div className="text-fg">Created</div>
            <div className="font-medium text-fg">
              {formatDistanceToNow(new Date(coordinator.createdAt), { addSuffix: true })}
            </div>
          </div>
          <div>
            <div className="text-fg">Last Updated</div>
            <div className="font-medium text-fg">
              {formatDistanceToNow(new Date(coordinator.updatedAt), { addSuffix: true })}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Execution Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-fg">Model ID</div>
            <div className="font-medium text-fg">{coordinator.config.modelId}</div>
          </div>
          <div>
            <div className="text-fg">Temperature</div>
            <div className="font-medium text-fg">{coordinator.config.temperature}</div>
          </div>
          <div>
            <div className="text-fg">Max Tokens (In/Out)</div>
            <div className="font-medium text-fg">
              {coordinator.config.maxInputTokens || 'Default'} / {coordinator.config.maxOutputTokens || 'Default'}
            </div>
          </div>
          <div>
            <div className="text-fg">Timeout</div>
            <div className="font-medium text-fg">{coordinator.config.timeout || 'Default'}s</div>
          </div>
          <div>
            <div className="text-fg">Cost Limit</div>
            <div className="font-medium text-fg">${coordinator.config.costLimit || 'No limit'}</div>
          </div>
          <div>
            <div className="text-fg">Max Retries</div>
            <div className="font-medium text-fg">{coordinator.config.maxRetries || 'Default'}</div>
          </div>
        </div>
      </div>

      {/* Tools */}
      {coordinator.tools.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-fg mb-2">MCP Tools</h3>
          <div className="flex flex-wrap gap-2">
            {coordinator.tools.map(tool => (
              <span key={tool} className="px-3 py-1 text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Usage Stats */}
      {coordinator.usageStats && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-fg mb-4">Usage Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-bg-secondary rounded">
              <div className="text-2xl font-bold text-fg">{coordinator.usageStats.totalRuns}</div>
              <div className="text-sm text-fg">Total Runs</div>
            </div>
            <div className="text-center p-3 bg-bg-secondary rounded">
              <div className="text-2xl font-bold text-fg">
                {coordinator.usageStats.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-fg">Success Rate</div>
            </div>
            <div className="text-center p-3 bg-bg-secondary rounded">
              <div className="text-2xl font-bold text-fg">
                {coordinator.usageStats.avgRuntime.toFixed(0)}s
              </div>
              <div className="text-sm text-fg">Avg Runtime</div>
            </div>
            <div className="text-center p-3 bg-bg-secondary rounded">
              <div className="text-2xl font-bold text-fg">
                ${coordinator.usageStats.avgCost.toFixed(2)}
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
          <p className="text-sm text-fg">This coordinator has no version history yet.</p>
        </div>
      ) : (
        <>
          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
            <div className="space-y-4">
              {versions.map((version) => (
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
                        <div className="text-fg">Strategy</div>
                        <div className="font-medium text-fg capitalize">{version.decisionStrategy}</div>
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

  const renderComponentsTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-fg mb-4">Assigned Components</h3>

      {!coordinator.components || coordinator.components.length === 0 ? (
        <div className="text-center py-12 bg-bg-secondary rounded-lg">
          <CubeIcon className="w-12 h-12 text-fg mx-auto mb-3" />
          <p className="text-fg mb-2">No components assigned</p>
          <p className="text-sm text-fg">This coordinator has no assigned components.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-bg-secondary">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Component Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Version</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Active</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Tags</th>
              </tr>
            </thead>
            <tbody className="bg-bg divide-y divide-border">
              {coordinator.components.map((component) => (
                <tr key={component.id} className="hover:bg-bg-secondary transition-colors">
                  <td className="px-3 py-2 text-sm text-fg">{component.name}</td>
                  <td className="px-3 py-2 text-sm text-fg font-mono">{component.version}</td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={classNames(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        component.active
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                          : 'bg-bg-secondary text-fg'
                      )}
                    >
                      {component.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-fg">
                    <div className="flex flex-wrap gap-1">
                      {component.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderWorkflowsTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-fg mb-4">Workflows Using This Coordinator</h3>

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : !analytics?.workflowsUsing || analytics.workflowsUsing.length === 0 ? (
        <div className="text-center py-12 bg-bg-secondary rounded-lg">
          <Squares2X2Icon className="w-12 h-12 text-fg mx-auto mb-3" />
          <p className="text-fg mb-2">No workflows using this coordinator</p>
          <p className="text-sm text-fg">This coordinator is not currently used by any workflows.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-bg-secondary">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Workflow Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Version</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Active</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Last Run</th>
              </tr>
            </thead>
            <tbody className="bg-bg divide-y divide-border">
              {analytics.workflowsUsing.map((workflow) => (
                <tr key={workflow.workflowId} className="hover:bg-bg-secondary transition-colors">
                  <td className="px-3 py-2 text-sm text-fg">{workflow.workflowName}</td>
                  <td className="px-3 py-2 text-sm text-fg font-mono">{workflow.version}</td>
                  <td className="px-3 py-2 text-sm">
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-full">
                      Active
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-fg">
                    {formatDistanceToNow(new Date(workflow.lastUsed), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderExecutionLogsTab = () => (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-fg">Recent Executions</h3>
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

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : !analytics?.executionHistory || analytics.executionHistory.length === 0 ? (
        <div className="text-center py-12 bg-bg-secondary rounded-lg">
          <DocumentTextIcon className="w-12 h-12 text-fg mx-auto mb-3" />
          <p className="text-fg mb-2">No execution history</p>
          <p className="text-sm text-fg">No executions found for the selected time range.</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-bg-secondary sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Run ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Workflow</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Started</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Duration</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">Cost</th>
              </tr>
            </thead>
            <tbody className="bg-bg divide-y divide-border">
              {analytics.executionHistory.slice(0, 100).map((execution) => (
                <tr key={execution.id} className="hover:bg-bg-secondary transition-colors">
                  <td className="px-3 py-2 text-sm font-mono text-fg">{execution.id.substring(0, 8)}...</td>
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

          {/* Export Button */}
          <div className="flex justify-end">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 text-sm bg-bg-secondary text-fg rounded hover:bg-bg-secondary/[0.6]"
            >
              Export CSV
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderConfigurationTab = () => (
    <div className="space-y-6">
      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm font-medium text-fg">Edit Mode</span>
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={classNames(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              isEditMode ? 'bg-accent' : 'bg-gray-200 dark:bg-gray-700'
            )}
          >
            <span
              className={classNames(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                isEditMode ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </label>
      </div>

      {/* Configuration Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg mb-1">Model</label>
            <select
              disabled={!isEditMode}
              value={coordinator.config.modelId}
              className="w-full px-3 py-2 border border-border rounded bg-bg text-fg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="claude-sonnet-4.5">claude-sonnet-4.5</option>
              <option value="claude-3.5-sonnet">claude-3.5-sonnet</option>
              <option value="claude-3-opus">claude-3-opus</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-1">Temperature</label>
            <input
              type="number"
              disabled={!isEditMode}
              value={coordinator.config.temperature}
              step="0.1"
              min="0"
              max="1"
              className="w-full px-3 py-2 border border-border rounded bg-bg text-fg disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-1">Max Retries</label>
            <select
              disabled={!isEditMode}
              value={coordinator.config.maxRetries || 3}
              className="w-full px-3 py-2 border border-border rounded bg-bg text-fg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-1">Timeout (seconds)</label>
            <input
              type="number"
              disabled={!isEditMode}
              value={coordinator.config.timeout || 300}
              className="w-full px-3 py-2 border border-border rounded bg-bg text-fg disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-1">Cost Limit ($)</label>
            <input
              type="number"
              disabled={!isEditMode}
              value={coordinator.config.costLimit || 10}
              step="0.01"
              className="w-full px-3 py-2 border border-border rounded bg-bg text-fg disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Tools */}
        <div>
          <label className="block text-sm font-medium text-fg mb-2">Tools</label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded p-3 bg-bg">
            {coordinator.tools.map((tool) => (
              <label key={tool} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={!isEditMode}
                  className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-fg">{tool}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Save/Cancel Buttons */}
      {isEditMode && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            onClick={() => setIsEditMode(false)}
            className="px-4 py-2 text-fg hover:text-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // TODO: Implement save logic
              setIsEditMode(false);
            }}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );

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
                        {coordinator.name}
                      </Dialog.Title>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm font-mono text-fg">{coordinator.version}</span>
                        <span className="text-sm text-fg">•</span>
                        <span
                          className={classNames(
                            'px-2 py-0.5 text-xs font-medium rounded-full',
                            coordinator.active
                              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                              : 'bg-bg-secondary text-fg'
                          )}
                        >
                          {coordinator.active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-sm text-fg">•</span>
                        <span className="text-sm text-fg capitalize">{coordinator.decisionStrategy}</span>
                        <span className="text-sm text-fg">•</span>
                        <span className="text-sm text-fg">{coordinator.domain}</span>
                      </div>
                      {coordinator.description && (
                        <p className="mt-2 text-fg">{coordinator.description}</p>
                      )}
                    </div>
                    <button
                      onClick={onClose}
                      className="text-fg hover:text-accent"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <Tab.Group>
                    <Tab.List className="flex space-x-1 rounded-xl bg-bg-secondary p-1 mb-6 overflow-x-auto">
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <InformationCircleIcon className="w-4 h-4" />
                          <span>Overview</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-4 h-4" />
                          <span>Version History</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <CubeIcon className="w-4 h-4" />
                          <span>Components</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Squares2X2Icon className="w-4 h-4" />
                          <span>Workflows</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <DocumentTextIcon className="w-4 h-4" />
                          <span>Execution Logs</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <ChartBarIcon className="w-4 h-4" />
                          <span>Analytics</span>
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-5',
                            'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                            selected
                              ? 'bg-accent text-white shadow'
                              : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent'
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Cog6ToothIcon className="w-4 h-4" />
                          <span>Configuration</span>
                        </div>
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
                        {renderComponentsTab()}
                      </Tab.Panel>
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none max-h-[60vh] overflow-y-auto">
                        {renderWorkflowsTab()}
                      </Tab.Panel>
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none max-h-[60vh] overflow-y-auto">
                        {renderExecutionLogsTab()}
                      </Tab.Panel>
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none max-h-[60vh] overflow-y-auto">
                        {renderUsageAnalyticsTab()}
                      </Tab.Panel>
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none max-h-[60vh] overflow-y-auto">
                        {renderConfigurationTab()}
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
                      Edit Coordinator
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
          entityType="coordinator"
          versionId1={selectedVersion1}
          versionId2={selectedVersion2}
          version1Label={versions.find(v => v.id === selectedVersion1)?.version}
          version2Label={versions.find(v => v.id === selectedVersion2)?.version}
        />
      )}
    </>
  );
}
