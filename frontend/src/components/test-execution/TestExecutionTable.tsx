import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export interface TestExecution {
  id: string;
  testCaseKey: string;
  testCaseTitle: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  durationMs: number;
  executedAt: string;
  testLevel?: string;
  coveragePercentage?: number;
}

interface TestExecutionTableProps {
  executions: TestExecution[];
  isLoading: boolean;
  emptyMessage?: string;
}

export function TestExecutionTable({
  executions,
  isLoading,
  emptyMessage = 'No test executions found',
}: TestExecutionTableProps) {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    const badges = {
      pass: '✅ Pass',
      fail: '❌ Fail',
      skip: '⏭️ Skip',
      error: '⚠️ Error',
    };
    return badges[status as keyof typeof badges] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pass: 'text-green-600 bg-green-50',
      fail: 'text-red-600 bg-red-50',
      skip: 'text-yellow-600 bg-yellow-50',
      error: 'text-orange-600 bg-orange-50',
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow border border-border p-8 text-center">
        <p className="text-muted">Loading test executions...</p>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow border border-border p-8 text-center">
        <p className="text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-bg-secondary">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
              Test Key
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
              Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
              Executed
            </th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {executions.map((execution) => (
            <tr
              key={execution.id}
              onClick={() => navigate(`/test-executions/${execution.id}`)}
              className="hover:bg-bg-secondary cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-fg">
                  {execution.testCaseKey}
                </div>
                {execution.testLevel && (
                  <div className="text-xs text-muted">
                    {execution.testLevel.toUpperCase()}
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-fg max-w-md truncate">
                  {execution.testCaseTitle}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                    execution.status
                  )}`}
                >
                  {getStatusBadge(execution.status)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                {(execution.durationMs / 1000).toFixed(2)}s
                {execution.coveragePercentage && (
                  <span className="ml-2 text-xs text-muted">
                    ({execution.coveragePercentage.toFixed(1)}% cov)
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                {formatDistanceToNow(new Date(execution.executedAt), {
                  addSuffix: true,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
