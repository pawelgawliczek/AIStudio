import { Dialog, Transition, Tab } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { versioningService, type VersionComparison } from '../services/versioning.service';

interface VersionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'component' | 'workflow';
  versionId1: string;
  versionId2: string;
  version1Label?: string;
  version2Label?: string;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function VersionComparisonModal({
  isOpen,
  onClose,
  entityType,
  versionId1,
  versionId2,
  version1Label,
  version2Label,
}: VersionComparisonModalProps) {
  // Fetch comparison data
  const { data: comparison, isLoading } = useQuery({
    queryKey: ['versionComparison', entityType, versionId1, versionId2],
    queryFn: async () => {
      if (entityType === 'component') {
        return versioningService.compareComponentVersions(versionId1, versionId2);
      } else {
        return versioningService.compareWorkflowVersions(versionId1, versionId2);
      }
    },
    enabled: isOpen && !!versionId1 && !!versionId2,
  });

  const renderChangeIndicator = (changeType: 'added' | 'removed' | 'modified') => {
    if (changeType === 'added') {
      return <span className="text-green-600 dark:text-green-400 font-medium">+</span>;
    } else if (changeType === 'removed') {
      return <span className="text-red-600 dark:text-red-400 font-medium">-</span>;
    } else {
      return <span className="text-amber-600 dark:text-amber-400 font-medium">~</span>;
    }
  };

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const renderSummaryTab = (comparison: VersionComparison) => (
    <div className="space-y-6">
      {/* Change Summary */}
      <div>
        <h3 className="text-lg font-semibold text-fg mb-4">Change Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {comparison.diff.summary.fieldsAdded}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 mt-1">Fields Added</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {comparison.diff.summary.fieldsModified}
            </div>
            <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">Fields Modified</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {comparison.diff.summary.fieldsRemoved}
            </div>
            <div className="text-sm text-red-700 dark:text-red-300 mt-1">Fields Removed</div>
          </div>
        </div>
      </div>

      {/* Impact Analysis */}
      {comparison.diff.impactAnalysis && (
        <div className={classNames(
          'p-4 rounded-lg border',
          comparison.diff.impactAnalysis.breakingChanges
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        )}>
          <h3 className="text-lg font-semibold text-fg mb-2">Impact Analysis</h3>

          {comparison.diff.impactAnalysis.breakingChanges && (
            <div className="mb-3 flex items-center gap-2 text-red-700 dark:text-red-300">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Breaking Changes Detected</span>
            </div>
          )}

          {comparison.diff.impactAnalysis.affectedWorkflows !== undefined && (
            <div className="text-sm text-fg mb-2">
              <span className="font-medium">Affected Workflows:</span> {comparison.diff.impactAnalysis.affectedWorkflows}
            </div>
          )}

          <div className="text-sm text-fg">
            <span className="font-medium">Recommendation:</span>{' '}
            {comparison.diff.impactAnalysis.recommendation}
          </div>
        </div>
      )}

      {/* Change List */}
      <div>
        <h3 className="text-lg font-semibold text-fg mb-4">Changes</h3>
        <div className="space-y-2">
          {comparison.diff.changes.map((change, index) => (
            <div
              key={index}
              className={classNames(
                'p-3 rounded border',
                change.changeType === 'added'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : change.changeType === 'removed'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              )}
            >
              <div className="flex items-start gap-2">
                {renderChangeIndicator(change.changeType)}
                <div className="flex-1">
                  <div className="font-medium text-fg">{change.field}</div>
                  <div className="text-sm text-fg mt-1">{change.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderInstructionsTab = (comparison: VersionComparison) => {
    const v1 = comparison.version1 as any;
    const v2 = comparison.version2 as any;

    if (entityType === 'component') {
      return (
        <div className="space-y-6">
          {/* Input Instructions */}
          <div>
            <h3 className="text-sm font-semibold text-fg mb-2">Input Instructions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-fg mb-1">{version1Label || 'Version 1'}</div>
                <pre className="text-xs text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
                  {v1.inputInstructions}
                </pre>
              </div>
              <div>
                <div className="text-xs text-fg mb-1">{version2Label || 'Version 2'}</div>
                <pre className="text-xs text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
                  {v2.inputInstructions}
                </pre>
              </div>
            </div>
          </div>

          {/* Operation Instructions */}
          <div>
            <h3 className="text-sm font-semibold text-fg mb-2">Operation Instructions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-fg mb-1">{version1Label || 'Version 1'}</div>
                <pre className="text-xs text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
                  {v1.operationInstructions}
                </pre>
              </div>
              <div>
                <div className="text-xs text-fg mb-1">{version2Label || 'Version 2'}</div>
                <pre className="text-xs text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
                  {v2.operationInstructions}
                </pre>
              </div>
            </div>
          </div>

          {/* Output Instructions */}
          <div>
            <h3 className="text-sm font-semibold text-fg mb-2">Output Instructions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-fg mb-1">{version1Label || 'Version 1'}</div>
                <pre className="text-xs text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
                  {v1.outputInstructions}
                </pre>
              </div>
              <div>
                <div className="text-xs text-fg mb-1">{version2Label || 'Version 2'}</div>
                <pre className="text-xs text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
                  {v2.outputInstructions}
                </pre>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center text-fg py-8">
        No instructions to compare for workflows
      </div>
    );
  };

  const renderConfigurationTab = (comparison: VersionComparison) => {
    const v1 = comparison.version1 as any;
    const v2 = comparison.version2 as any;

    return (
      <div className="space-y-6">
        {/* Model Configuration */}
        <div>
          <h3 className="text-sm font-semibold text-fg mb-4">Model Configuration</h3>
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase tracking-wider">
                  Field
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase tracking-wider">
                  {version1Label || 'Version 1'}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase tracking-wider">
                  {version2Label || 'Version 2'}
                </th>
              </tr>
            </thead>
            <tbody className="bg-bg divide-y divide-border">
              <tr>
                <td className="px-3 py-2 text-sm text-fg font-medium">Model ID</td>
                <td className="px-3 py-2 text-sm text-fg font-mono">{v1.config?.modelId}</td>
                <td className="px-3 py-2 text-sm text-fg font-mono">{v2.config?.modelId}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-sm text-fg font-medium">Temperature</td>
                <td className="px-3 py-2 text-sm text-fg">{v1.config?.temperature}</td>
                <td className="px-3 py-2 text-sm text-fg">{v2.config?.temperature}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-sm text-fg font-medium">Max Input Tokens</td>
                <td className="px-3 py-2 text-sm text-fg">{v1.config?.maxInputTokens || 'Default'}</td>
                <td className="px-3 py-2 text-sm text-fg">{v2.config?.maxInputTokens || 'Default'}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-sm text-fg font-medium">Max Output Tokens</td>
                <td className="px-3 py-2 text-sm text-fg">{v1.config?.maxOutputTokens || 'Default'}</td>
                <td className="px-3 py-2 text-sm text-fg">{v2.config?.maxOutputTokens || 'Default'}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-sm text-fg font-medium">Timeout</td>
                <td className="px-3 py-2 text-sm text-fg">{v1.config?.timeout || 'Default'}s</td>
                <td className="px-3 py-2 text-sm text-fg">{v2.config?.timeout || 'Default'}s</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-sm text-fg font-medium">Max Retries</td>
                <td className="px-3 py-2 text-sm text-fg">{v1.config?.maxRetries || 'Default'}</td>
                <td className="px-3 py-2 text-sm text-fg">{v2.config?.maxRetries || 'Default'}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-sm text-fg font-medium">Cost Limit</td>
                <td className="px-3 py-2 text-sm text-fg">${v1.config?.costLimit || 'No limit'}</td>
                <td className="px-3 py-2 text-sm text-fg">${v2.config?.costLimit || 'No limit'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tools Comparison */}
        {v1.tools && v2.tools && (
          <div>
            <h3 className="text-sm font-semibold text-fg mb-4">MCP Tools</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-fg mb-2">{version1Label || 'Version 1'} ({v1.tools.length})</div>
                <div className="flex flex-wrap gap-2">
                  {v1.tools.map((tool: string) => (
                    <span
                      key={tool}
                      className={classNames(
                        'px-2 py-1 text-xs rounded',
                        !v2.tools.includes(tool)
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                          : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      )}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-fg mb-2">{version2Label || 'Version 2'} ({v2.tools.length})</div>
                <div className="flex flex-wrap gap-2">
                  {v2.tools.map((tool: string) => (
                    <span
                      key={tool}
                      className={classNames(
                        'px-2 py-1 text-xs rounded',
                        !v1.tools.includes(tool)
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                          : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      )}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trigger Config (Workflow only) */}
        {entityType === 'workflow' && (
          <div>
            <h3 className="text-sm font-semibold text-fg mb-4">Trigger Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-fg mb-2">{version1Label || 'Version 1'}</div>
                <pre className="text-xs text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
                  {JSON.stringify(v1.triggerConfig, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs text-fg mb-2">{version2Label || 'Version 2'}</div>
                <pre className="text-xs text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border">
                  {JSON.stringify(v2.triggerConfig, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMetadataTab = (comparison: VersionComparison) => {
    const v1 = comparison.version1 as any;
    const v2 = comparison.version2 as any;

    return (
      <div className="space-y-6">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase tracking-wider">
                Field
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase tracking-wider">
                {version1Label || 'Version 1'}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase tracking-wider">
                {version2Label || 'Version 2'}
              </th>
            </tr>
          </thead>
          <tbody className="bg-bg divide-y divide-border">
            <tr>
              <td className="px-3 py-2 text-sm text-fg font-medium">Version</td>
              <td className="px-3 py-2 text-sm text-fg font-mono">{v1.version}</td>
              <td className="px-3 py-2 text-sm text-fg font-mono">{v2.version}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-sm text-fg font-medium">Active</td>
              <td className="px-3 py-2 text-sm">
                <span
                  className={classNames(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    v1.active
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300'
                  )}
                >
                  {v1.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-3 py-2 text-sm">
                <span
                  className={classNames(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    v2.active
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300'
                  )}
                >
                  {v2.active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-sm text-fg font-medium">Checksum</td>
              <td className="px-3 py-2 text-xs text-fg font-mono">{v1.checksum || 'N/A'}</td>
              <td className="px-3 py-2 text-xs text-fg font-mono">{v2.checksum || 'N/A'}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-sm text-fg font-medium">Created At</td>
              <td className="px-3 py-2 text-sm text-fg">
                {new Date(v1.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-sm text-fg">
                {new Date(v2.createdAt).toLocaleString()}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-sm text-fg font-medium">Created By</td>
              <td className="px-3 py-2 text-sm text-fg">{v1.createdBy || 'System'}</td>
              <td className="px-3 py-2 text-sm text-fg">{v2.createdBy || 'System'}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-sm text-fg font-medium">Change Description</td>
              <td className="px-3 py-2 text-sm text-fg">{v1.changeDescription || 'N/A'}</td>
              <td className="px-3 py-2 text-sm text-fg">{v2.changeDescription || 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

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
                  <Dialog.Title as="h3" className="text-2xl font-bold text-fg">
                    Version Comparison
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-fg hover:text-accent"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                  </div>
                ) : comparison ? (
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
                        Summary
                      </Tab>
                      {entityType !== 'workflow' && (
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
                          Instructions
                        </Tab>
                      )}
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
                        Configuration
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
                        Metadata
                      </Tab>
                    </Tab.List>
                    <Tab.Panels className="mt-2">
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
                        {renderSummaryTab(comparison)}
                      </Tab.Panel>
                      {entityType !== 'workflow' && (
                        <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
                          {renderInstructionsTab(comparison)}
                        </Tab.Panel>
                      )}
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
                        {renderConfigurationTab(comparison)}
                      </Tab.Panel>
                      <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
                        {renderMetadataTab(comparison)}
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                ) : (
                  <div className="text-center text-fg py-12">
                    Failed to load comparison data
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-fg hover:text-accent"
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
  );
}
