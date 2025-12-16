import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkflowRun } from '../../services/workflow-runs.service';
import { RunStatusBadge } from './RunStatusBadge';

interface StoryRunRowProps {
  storyKey: string;
  storyTitle: string;
  runs: WorkflowRun[];
}

export function StoryRunRow({ storyKey, storyTitle, runs }: StoryRunRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatCost = (cost?: number) => {
    if (cost === null || cost === undefined) return '-';
    return `$${cost.toFixed(4)}`;
  };

  // Calculate summary stats for the story
  const totalRuns = runs.length;
  const completedRuns = runs.filter(r => r.status === 'COMPLETED').length;
  const failedRuns = runs.filter(r => r.status === 'FAILED').length;
  const latestRun = runs[0]; // Assuming runs are sorted by date

  return (
    <>
      {/* Story Header Row */}
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className="hover:bg-bg-secondary cursor-pointer transition-colors border-b border-border"
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <button
            className="text-muted hover:text-fg transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-fg">{storyKey}</span>
            <span className="text-xs text-muted">{storyTitle}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
          {totalRuns}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
          {completedRuns}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
          {failedRuns}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <RunStatusBadge status={latestRun.status} />
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
          {formatDate(latestRun.startedAt)}
        </td>
      </tr>

      {/* Expanded Runs */}
      {isExpanded && runs.map((run, index) => (
        <tr
          key={run.id}
          onClick={() => navigate(`/team-runs/${run.id}/monitor`)}
          className="hover:bg-bg-secondary cursor-pointer transition-colors bg-bg/50"
        >
          <td className="px-6 py-3"></td>
          <td className="px-6 py-3 text-sm text-muted pl-12">
            Run #{totalRuns - index}
          </td>
          <td className="px-6 py-3 whitespace-nowrap">
            <RunStatusBadge status={run.status} />
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-sm text-muted">
            {run.workflow?.name || '-'}
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-sm text-muted">
            {formatDate(run.startedAt)}
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-sm text-muted">
            {formatDuration(run.durationSeconds)}
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-sm text-muted">
            {run.totalTokens?.toLocaleString() || '-'}
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-sm text-muted">
            {formatCost(run.estimatedCost)}
          </td>
        </tr>
      ))}
    </>
  );
}
