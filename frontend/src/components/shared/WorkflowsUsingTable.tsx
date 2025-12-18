import { FunnelIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export interface WorkflowUsage {
  workflowId: string;
  workflowName: string;
  version: string;
  lastUsed: string;
  executionCount: number;
}

export interface WorkflowsUsingTableProps {
  workflows: WorkflowUsage[];
  allVersions: string[];
  versionFilter: string; // 'all' or specific version
  onVersionFilterChange: (version: string) => void;
  isLoading?: boolean;
}

export function WorkflowsUsingTable({
  workflows,
  allVersions,
  versionFilter,
  onVersionFilterChange,
  isLoading = false,
}: WorkflowsUsingTableProps) {
  const navigate = useNavigate();

  // Filter workflows by selected version
  const filteredWorkflows = versionFilter === 'all'
    ? workflows
    : workflows.filter(w => w.version === versionFilter);

  const handleWorkflowClick = (workflowId: string) => {
    navigate(`/workflows/${workflowId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-fg">Workflows Using This Component</h3>

        {allVersions.length > 0 && (
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-fg" />
            <select
              value={versionFilter}
              onChange={(e) => onVersionFilterChange(e.target.value)}
              className="text-sm border border-border rounded px-2 py-1 bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Versions</option>
              {allVersions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Empty state */}
      {filteredWorkflows.length === 0 ? (
        <div className="text-center py-8 bg-bg-secondary rounded-lg">
          <p className="text-fg">
            {versionFilter === 'all'
              ? 'No workflows are using this component'
              : `No workflows are using version ${versionFilter}`}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-bg-secondary">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">
                    Workflow
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">
                    Version
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">
                    Last Used
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-fg uppercase">
                    Executions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-bg divide-y divide-border">
                {filteredWorkflows.map((workflow) => (
                  <tr
                    key={workflow.workflowId}
                    className="hover:bg-bg-secondary cursor-pointer transition-colors"
                    onClick={() => handleWorkflowClick(workflow.workflowId)}
                  >
                    <td className="px-3 py-2 text-sm text-accent hover:underline font-medium">
                      {workflow.workflowName}
                    </td>
                    <td className="px-3 py-2 text-sm text-fg font-mono">
                      {workflow.version}
                    </td>
                    <td className="px-3 py-2 text-sm text-fg">
                      {formatDistanceToNow(new Date(workflow.lastUsed), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2 text-sm text-fg">
                      {workflow.executionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="text-sm text-fg pt-2 border-t border-border">
            Showing {filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? 's' : ''} ·
            Total: {filteredWorkflows.reduce((sum, w) => sum + w.executionCount, 0)} runs
          </div>
        </>
      )}
    </div>
  );
}
