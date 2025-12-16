import { useState } from 'react';
import { WorkflowRun } from '../../services/workflow-runs.service';
import { StoryRunRow } from './StoryRunRow';

interface StoryRunsTableProps {
  runs: WorkflowRun[];
  isLoading: boolean;
}

export function StoryRunsTable({ runs, isLoading }: StoryRunsTableProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Group runs by story
  const groupedByStory = runs.reduce((acc, run) => {
    const key = run.story?.key || 'NO_STORY';
    if (!acc[key]) {
      acc[key] = {
        storyKey: run.story?.key || 'No Story',
        storyTitle: run.story?.title || 'Unlinked runs',
        runs: [],
      };
    }
    acc[key].runs.push(run);
    return acc;
  }, {} as Record<string, { storyKey: string; storyTitle: string; runs: WorkflowRun[] }>);

  const stories = Object.values(groupedByStory);

  // Sort each story's runs by date (newest first)
  stories.forEach(story => {
    story.runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  });

  // Sort stories by latest run date
  stories.sort((a, b) => {
    const aLatest = new Date(a.runs[0].startedAt).getTime();
    const bLatest = new Date(b.runs[0].startedAt).getTime();
    return bLatest - aLatest;
  });

  // Pagination
  const totalPages = Math.ceil(stories.length / rowsPerPage);
  const paginatedStories = stories.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fg"></div>
        </div>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        <div className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-fg">No team runs found</h3>
          <p className="mt-1 text-sm text-muted">
            Try adjusting your filters or run a workflow to see results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-bg-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-12">
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Story
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Runs
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Latest Run
              </th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {paginatedStories.map((story) => (
              <StoryRunRow
                key={story.storyKey}
                storyKey={story.storyKey}
                storyTitle={story.storyTitle}
                runs={story.runs}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-card px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-fg bg-card hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-fg bg-card hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted">
                Showing <span className="font-medium">{page * rowsPerPage + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min((page + 1) * rowsPerPage, stories.length)}
                </span>{' '}
                of <span className="font-medium">{stories.length}</span> stories
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">Rows per page:</label>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  className="px-2 py-1 border border-border rounded-md text-sm bg-card text-fg"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-card text-sm font-medium text-muted hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-border bg-card text-sm font-medium text-fg">
                  Page {page + 1} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-card text-sm font-medium text-muted hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
