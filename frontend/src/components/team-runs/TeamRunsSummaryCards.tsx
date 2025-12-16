import { WorkflowRun, RunStatus } from '../../services/workflow-runs.service';

interface TeamRunsSummaryCardsProps {
  runs: WorkflowRun[];
}

export function TeamRunsSummaryCards({ runs }: TeamRunsSummaryCardsProps) {
  const totalRuns = runs.length;
  const completedRuns = runs.filter(r => r.status === RunStatus.COMPLETED).length;
  const inProgressRuns = runs.filter(r => r.status === RunStatus.RUNNING).length;
  const failedRuns = runs.filter(r => r.status === RunStatus.FAILED).length;

  const cards = [
    {
      label: 'Total Runs',
      value: totalRuns,
      icon: '📊',
      className: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    },
    {
      label: 'Completed',
      value: completedRuns,
      icon: '✓',
      className: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    },
    {
      label: 'In Progress',
      value: inProgressRuns,
      icon: '⏸',
      className: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    },
    {
      label: 'Failed',
      value: failedRuns,
      icon: '✗',
      className: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg border ${card.className} transition-all hover:shadow-md`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">{card.label}</p>
              <p className="text-2xl font-bold text-fg mt-1">{card.value}</p>
            </div>
            <div className="text-3xl opacity-60">{card.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
