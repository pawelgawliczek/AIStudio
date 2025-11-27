/**
 * Test Execution Detail Page - Placeholder
 * TODO: Implement full test execution detail view
 */

import { useParams, Link } from 'react-router-dom';

export function TestExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/test-executions" className="text-indigo-600 hover:text-indigo-900 text-sm">
          &larr; Back to Test Executions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Test Execution Details</h1>
        <p className="text-gray-500 mt-1">Execution ID: {id}</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-12">
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">Test Execution Detail View</h3>
          <p className="mt-1 text-sm text-gray-500">
            Detailed test execution results will be displayed here.
          </p>
        </div>
      </div>
    </div>
  );
}
