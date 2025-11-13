import { ComponentRunDetails, RunStatus } from '../../services/workflow-runs.service';

interface ComponentBreakdownProps {
  componentRuns: ComponentRunDetails[];
}

export function ComponentBreakdown({ componentRuns }: ComponentBreakdownProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}min`;
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString();
  };

  // Group by component name and count runs
  const componentGroups = componentRuns.reduce((acc, run) => {
    if (!acc[run.componentName]) {
      acc[run.componentName] = {
        name: run.componentName,
        runs: 0,
        totalTokens: 0,
        totalDuration: 0,
        totalLoc: 0,
        successCount: 0,
      };
    }
    acc[run.componentName].runs++;
    acc[run.componentName].totalTokens += run.totalTokens || 0;
    acc[run.componentName].totalDuration += run.durationSeconds || 0;
    acc[run.componentName].totalLoc += run.locGenerated || 0;
    if (run.success) acc[run.componentName].successCount++;
    return acc;
  }, {} as Record<string, any>);

  const groupedData = Object.values(componentGroups);

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-fg mb-4">Component Breakdown</h2>

      {/* Summary Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Component
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                Runs
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                Runtime
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                LOC Gen
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">
                Success Rate
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-gray-200">
            {groupedData.map((group) => (
              <tr key={group.name} className="hover:bg-bg-secondary">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-fg">{group.name}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="text-sm text-fg">{group.runs}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="text-sm text-fg">{formatNumber(group.totalTokens)}</div>
                  <div className="text-xs text-muted">
                    {group.runs > 0 ? `${formatNumber(Math.round(group.totalTokens / group.runs))} avg` : ''}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="text-sm text-fg">{formatDuration(group.totalDuration)}</div>
                  <div className="text-xs text-muted">
                    {group.runs > 0 ? `${formatDuration(Math.round(group.totalDuration / group.runs))} avg` : ''}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="text-sm text-fg">{formatNumber(group.totalLoc)}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  <div className="inline-flex items-center">
                    <span className={`text-sm font-medium ${
                      group.successCount === group.runs ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {group.successCount}/{group.runs}
                    </span>
                    <span className="ml-2 text-xs text-muted">
                      ({Math.round((group.successCount / group.runs) * 100)}%)
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-bg-secondary font-semibold">
            <tr>
              <td className="px-4 py-3 text-sm text-fg">Total</td>
              <td className="px-4 py-3 text-right text-sm text-fg">
                {componentRuns.length}
              </td>
              <td className="px-4 py-3 text-right text-sm text-fg">
                {formatNumber(groupedData.reduce((sum, g) => sum + g.totalTokens, 0))}
              </td>
              <td className="px-4 py-3 text-right text-sm text-fg">
                {formatDuration(groupedData.reduce((sum, g) => sum + g.totalDuration, 0))}
              </td>
              <td className="px-4 py-3 text-right text-sm text-fg">
                {formatNumber(groupedData.reduce((sum, g) => sum + g.totalLoc, 0))}
              </td>
              <td className="px-4 py-3 text-center text-sm text-fg">
                {groupedData.reduce((sum, g) => sum + g.successCount, 0)}/
                {componentRuns.length}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {componentRuns.length === 0 && (
        <div className="text-center py-8 text-muted">
          No component runs to display.
        </div>
      )}
    </div>
  );
}
