/**
 * Test Execution History Page - Placeholder
 * TODO: Implement full test execution history view
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';

interface TestExecution {
  id: string;
  storyKey: string;
  storyTitle: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  testType: 'unit' | 'integration' | 'e2e' | 'all';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  passedCount?: number;
  failedCount?: number;
  skippedCount?: number;
}

export function TestExecutionHistoryPage() {
  const { currentProject } = useProject();
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder - in future, fetch from API
    setLoading(false);
    setExecutions([]);
  }, [currentProject]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      passed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      running: 'bg-blue-100 text-blue-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Test Execution History</h1>
        <p className="text-gray-500 mt-1">View test execution results for stories</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : executions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No test executions yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Test executions will appear here when stories are tested.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Story
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Results
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {executions.map((execution) => (
                <tr key={execution.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/test-executions/${execution.id}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <span className="font-medium">{execution.storyKey}</span>
                      <span className="text-gray-500 ml-2">{execution.storyTitle}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(execution.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {execution.testType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="text-green-600">{execution.passedCount || 0} passed</span>
                    {execution.failedCount ? (
                      <span className="text-red-600 ml-2">{execution.failedCount} failed</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {execution.duration ? `${execution.duration}s` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(execution.startedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
