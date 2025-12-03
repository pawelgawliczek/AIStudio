import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workflowRunsService } from '../services/workflow-runs.service';
import { useProject } from '../context/ProjectContext';
import { ExecutionSummary } from '../components/workflow-results/ExecutionSummary';
import { ComponentTimeline } from '../components/workflow-results/ComponentTimeline';
import { ComponentBreakdown } from '../components/workflow-results/ComponentBreakdown';

type TabType = 'summary' | 'timeline' | 'breakdown' | 'decisions';

export function WorkflowResultsView() {
  const { runId } = useParams<{ runId: string }>();
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('summary');

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['workflow-run-results', projectId, runId],
    queryFn: async () => {
      if (!projectId || !runId) throw new Error('Missing projectId or runId');
      return workflowRunsService.getResults(projectId, runId);
    },
    enabled: !!projectId && !!runId,
  });

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted">Please select a project to view workflow results.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-muted">Loading workflow results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-100/50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Results</h2>
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Failed to load workflow run results'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { workflowRun, componentRuns } = results;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-accent hover:text-blue-800 mb-2 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-fg">
          {workflowRun.workflow?.name || 'Workflow Run'} Results
        </h1>
        {workflowRun.story && (
          <p className="mt-1 text-muted">
            Story: {workflowRun.story.key} - {workflowRun.story.title}
          </p>
        )}
        <p className="text-sm text-muted mt-1">
          Started: {new Date(workflowRun.startedAt).toLocaleString()}
          {workflowRun.finishedAt && (
            <> • Finished: {new Date(workflowRun.finishedAt).toLocaleString()}</>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'summary'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-fg hover:border-border'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'timeline'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-fg hover:border-border'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'breakdown'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-fg hover:border-border'
            }`}
          >
            Component Breakdown
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'summary' && <ExecutionSummary results={results} />}

        {activeTab === 'timeline' && <ComponentTimeline componentRuns={componentRuns} />}

        {activeTab === 'breakdown' && <ComponentBreakdown componentRuns={componentRuns} />}
      </div>

      {/* Export Actions */}
      <div className="mt-6 flex gap-3">
        <button
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          onClick={() => {
            const dataStr = JSON.stringify(results, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `workflow-run-${runId}-results.json`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export as JSON
        </button>
        <button
          className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-dark"
          onClick={() => {
            // Markdown export
            let markdown = `# Workflow Run Results: ${workflowRun.workflow?.name || 'Unknown'}\n\n`;
            markdown += `**Status**: ${workflowRun.status}\n`;
            markdown += `**Started**: ${new Date(workflowRun.startedAt).toLocaleString()}\n`;
            if (workflowRun.finishedAt) {
              markdown += `**Finished**: ${new Date(workflowRun.finishedAt).toLocaleString()}\n`;
            }
            markdown += `\n## Summary\n\n`;
            markdown += `- Total Tokens: ${results.summary.totalTokens?.toLocaleString() || 'N/A'}\n`;
            markdown += `- LOC Generated: ${results.summary.totalLoc?.toLocaleString() || 'N/A'}\n`;
            markdown += `- Component Runs: ${results.summary.totalComponentRuns}\n`;
            markdown += `- Successful: ${results.summary.successfulRuns}\n`;
            markdown += `- Failed: ${results.summary.failedRuns}\n`;
            markdown += `\n## Component Runs\n\n`;
            componentRuns.forEach((run, i) => {
              markdown += `### [${i + 1}] ${run.componentName}\n\n`;
              markdown += `- Duration: ${run.durationSeconds}s\n`;
              markdown += `- Tokens: ${run.totalTokens?.toLocaleString() || 'N/A'}\n`;
              markdown += `- LOC: ${run.locGenerated || 0}\n`;
              markdown += `- Status: ${run.status}\n\n`;
            });

            const dataBlob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `workflow-run-${runId}-results.md`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export as Markdown
        </button>
      </div>
    </div>
  );
}
