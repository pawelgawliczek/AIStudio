/**
 * SlowTestsPanel Component
 * Displays slow test analytics with formatted durations
 */

import React, { useEffect, useState } from 'react';
import { testExecutionService, SlowTest } from '../services/test-execution.service';

interface SlowTestsPanelProps {
  projectId: string;
  limit?: number;
}

export const SlowTestsPanel: React.FC<SlowTestsPanelProps> = ({
  projectId,
  limit = 10,
}) => {
  const [slowTests, setSlowTests] = useState<SlowTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlowTests = async () => {
      if (!projectId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await testExecutionService.getSlowTests(projectId, limit);
        setSlowTests(data);
      } catch (err) {
        console.error('Failed to fetch slow tests:', err);
        setError('Failed to load slow tests');
      } finally {
        setLoading(false);
      }
    };

    fetchSlowTests();
  }, [projectId, limit]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    }
    const seconds = ms / 1000;
    return `${seconds.toFixed(2)}s`;
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

  const getDurationColor = (ms: number): string => {
    if (ms > 10000) return 'text-red-600 dark:text-red-400';
    if (ms > 5000) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-900 dark:text-gray-100';
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

  if (slowTests.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-gray-500 mb-2 block">
          speed
        </span>
        <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">No Slow Tests Detected</p>
        <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
          All tests are running efficiently.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Slowest Tests (Top {limit})
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tests with the longest average execution times
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rank
              </th>
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
                Avg Duration
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Max Duration
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Run Count
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {slowTests.map((test, index) => (
              <tr key={test.testKey} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-300">
                    {index + 1}
                  </span>
                </td>
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
                  <span className={`text-sm font-medium ${getDurationColor(test.avgDurationMs)}`}>
                    {formatDuration(test.avgDurationMs)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <span className={`text-sm ${getDurationColor(test.maxDurationMs)}`}>
                    {formatDuration(test.maxDurationMs)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {test.runCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
            info
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Performance Tips
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Tests over 10s are highlighted in red and should be optimized</li>
              <li>Consider splitting large E2E tests into smaller integration tests</li>
              <li>Use test fixtures and mocks to reduce database/API calls</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
