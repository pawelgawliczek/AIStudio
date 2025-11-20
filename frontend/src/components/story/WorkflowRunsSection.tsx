import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon, PlayIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface ComponentRun {
  id: string;
  component: {
    id: string;
    name: string;
  };
  status: string;
  output?: string;
  tokensInput?: number;
  tokensOutput?: number;
}

interface WorkflowRun {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  totalTokens?: number;
  estimatedCost?: number;
  workflow: {
    id: string;
    name: string;
  };
  componentRuns: ComponentRun[];
}

interface WorkflowRunsSectionProps {
  workflowRuns?: WorkflowRun[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/10 text-green-600 border-green-500/20',
  running: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  failed: 'bg-red-500/10 text-red-600 border-red-500/20',
  pending: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

export function WorkflowRunsSection({ workflowRuns = [] }: WorkflowRunsSectionProps) {
  if (workflowRuns.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-2">
          <PlayIcon className="h-5 w-5 text-muted" />
          <h3 className="font-medium text-fg">Workflow Runs</h3>
        </div>
        <p className="text-sm text-muted italic">No workflow runs yet</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <PlayIcon className="h-5 w-5 text-muted" />
          <h3 className="font-medium text-fg">Workflow Runs ({workflowRuns.length})</h3>
        </div>
      </div>

      <div className="divide-y divide-border">
        {workflowRuns.map((run) => (
          <Disclosure key={run.id}>
            {({ open }) => (
              <>
                <Disclosure.Button className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-card/80 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                        STATUS_COLORS[run.status] || STATUS_COLORS.pending
                      }`}
                    >
                      {run.status}
                    </span>
                    <span className="text-sm font-medium text-fg">{run.workflow.name}</span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                    </span>
                    {run.durationSeconds && (
                      <span className="text-xs text-muted">
                        {Math.floor(run.durationSeconds / 60)}m {run.durationSeconds % 60}s
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {run.totalTokens && (
                      <span className="text-xs text-muted">{run.totalTokens.toLocaleString()} tokens</span>
                    )}
                    {run.estimatedCost && (
                      <span className="text-xs text-muted">${run.estimatedCost.toFixed(2)}</span>
                    )}
                    <ChevronDownIcon
                      className={`h-5 w-5 text-muted transition-transform duration-200 ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </Disclosure.Button>

                <Transition
                  enter="transition duration-200 ease-out"
                  enterFrom="opacity-0 -translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition duration-150 ease-in"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 -translate-y-1"
                >
                  <Disclosure.Panel className="px-4 pb-4 bg-card/50">
                    <div className="mt-2 space-y-2">
                      <h4 className="text-xs font-medium text-muted mb-2">
                        Components ({run.componentRuns.length})
                      </h4>
                      {run.componentRuns.map((componentRun) => (
                        <div
                          key={componentRun.id}
                          className="border border-border rounded p-2 bg-card"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-fg">
                              {componentRun.component.name}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                STATUS_COLORS[componentRun.status] || STATUS_COLORS.pending
                              }`}
                            >
                              {componentRun.status}
                            </span>
                          </div>
                          {(componentRun.tokensInput || componentRun.tokensOutput) && (
                            <div className="flex gap-3 mt-1 text-xs text-muted">
                              {componentRun.tokensInput && (
                                <span>In: {componentRun.tokensInput.toLocaleString()}</span>
                              )}
                              {componentRun.tokensOutput && (
                                <span>Out: {componentRun.tokensOutput.toLocaleString()}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Disclosure.Panel>
                </Transition>
              </>
            )}
          </Disclosure>
        ))}
      </div>
    </div>
  );
}
