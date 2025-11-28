/**
 * FlakyTestsPanel Component
 * Displays flaky test analytics with color-coded fail rates
 */

import React, { useEffect, useState } from 'react';
import { testExecutionService, FlakyTest } from '../services/test-execution.service';

interface FlakyTestsPanelProps {
  projectId: string;
  days?: number;
  threshold?: number;
}

export const FlakyTestsPanel: React.FC<FlakyTestsPanelProps> = ({
  projectId,
  days = 30,
  threshold = 0.1,
}) => {
  const [flakyTests, setFlakyTests] = useState<FlakyTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlakyTests = async () => {
      if (!projectId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await testExecutionService.getFlakyTests(projectId, days, threshold);
        setFlakyTests(data);
      } catch (err) {
        console.error('Failed to fetch flaky tests:', err);
        setError('Failed to load flaky tests');
      } finally {
        setLoading(false);
      }
    };

    fetchFlakyTests();
  }, [projectId, days, threshold]);

  const getFailRateColor = (failRate: number): string => {
    if (failRate > 0.3) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    if (failRate > 0.1) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
  };

  const getTestLevelBadge = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'unit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'integration':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'e2e':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (flakyTests.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-gray-500 mb-2 block">
          check_circle
        </span>
        <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">No Flaky Tests Detected</p>
        <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
          All tests have consistent pass/fail results over the last {days} days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Flaky Tests ({flakyTests.length})
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tests with inconsistent results over the last {days} days
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Test Key
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Title
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Level
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Runs
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pass Rate
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Fail Rate
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Failed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {flakyTests.map((test) => (
              <tr key={test.testKey} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                    {test.testKey}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {test.title}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTestLevelBadge(test.testLevel)}`}>
                    {test.testLevel}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {test.totalRuns}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {(test.passRate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getFailRateColor(test.failRate)}`}>
                    {(test.failRate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(test.lastFailedAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
