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

  // Calculate aggregate metrics
  const totalDuration = runs.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
  const totalTokens = runs.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
  const totalCost = runs.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

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
          <span className="font-medium">{totalRuns}</span>
          <span className="text-xs ml-1">({completedRuns}✓ {failedRuns}✗)</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <RunStatusBadge status={latestRun.status} />
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
          {formatDuration(totalDuration)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
          {totalTokens.toLocaleString()}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
          {formatCost(totalCost)}
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
            <span className="font-medium">Run #{totalRuns - index}</span>
            <span className="text-xs ml-2 text-muted">{run.workflow?.name || ''}</span>
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-sm text-muted">
            {/* Empty - runs count column */}
          </td>
          <td className="px-6 py-3 whitespace-nowrap">
            <RunStatusBadge status={run.status} />
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
          <td className="px-6 py-3 whitespace-nowrap text-sm text-muted">
            {formatDate(run.startedAt)}
          </td>
        </tr>
      ))}
    </>
  );
}
