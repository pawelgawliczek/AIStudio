import { Tab } from '@headlessui/react';
import { PlayIcon, DocumentTextIcon, BeakerIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';
import { CommitsSection } from './CommitsSection';
import { UseCasesSection } from './UseCasesSection';
import { WorkflowRunsSection } from './WorkflowRunsSection';

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

interface TestCase {
  id: string;
  key: string;
  title: string;
  testLevel: string;
  status: string;
  testFilePath?: string;
}

interface UseCase {
  id: string;
  key: string;
  title: string;
  area?: string;
  testCases?: TestCase[];
}

interface UseCaseLink {
  id: string;
  relation: 'implements' | 'modifies' | 'deprecates';
  useCase: UseCase;
}

interface CommitFile {
  id: string;
  filePath: string;
  locAdded: number;
  locDeleted: number;
  complexityBefore?: number;
  complexityAfter?: number;
  coverageBefore?: number;
  coverageAfter?: number;
}

interface Commit {
  hash: string;
  author: string;
  timestamp: string;
  message: string;
  files?: CommitFile[];
}

interface StoryTraceabilityTabsProps {
  workflowRuns?: WorkflowRun[];
  useCaseLinks?: UseCaseLink[];
  commits?: Commit[];
}

const TEST_STATUS_COLORS: Record<string, string> = {
  implemented: 'bg-green-500/10 text-green-600',
  pending: 'bg-gray-500/10 text-gray-600',
  in_progress: 'bg-yellow-500/10 text-yellow-600',
};

export function StoryTraceabilityTabs({
  workflowRuns = [],
  useCaseLinks = [],
  commits = [],
}: StoryTraceabilityTabsProps) {
  // Collect all test cases from all use cases
  const allTestCases = useCaseLinks.flatMap((link) => {
    const testCases = link.useCase.testCases || [];
    return testCases.map((tc) => ({
      ...tc,
      useCaseKey: link.useCase.key,
      useCaseTitle: link.useCase.title,
    }));
  });

  return (
    <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
      {/* Title */}
      <div className="border-b border-border p-4 bg-bg-secondary">
        <h2 className="text-lg font-semibold text-fg">Story Traceability</h2>
      </div>

      <Tab.Group>
        <Tab.List className="flex border-b border-border bg-bg-secondary">
          <Tab as={Fragment}>
            {({ selected }) => (
              <button
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none ${
                  selected
                    ? 'border-b-2 border-accent text-accent bg-card'
                    : 'text-muted hover:text-fg hover:bg-card/50'
                }`}
              >
                <PlayIcon className="h-4 w-4" />
                Workflow Runs
              </button>
            )}
          </Tab>
          <Tab as={Fragment}>
            {({ selected }) => (
              <button
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none ${
                  selected
                    ? 'border-b-2 border-accent text-accent bg-card'
                    : 'text-muted hover:text-fg hover:bg-card/50'
                }`}
              >
                <DocumentTextIcon className="h-4 w-4" />
                Use Cases
              </button>
            )}
          </Tab>
          <Tab as={Fragment}>
            {({ selected }) => (
              <button
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none ${
                  selected
                    ? 'border-b-2 border-accent text-accent bg-card'
                    : 'text-muted hover:text-fg hover:bg-card/50'
                }`}
              >
                <BeakerIcon className="h-4 w-4" />
                Test Cases
              </button>
            )}
          </Tab>
          <Tab as={Fragment}>
            {({ selected }) => (
              <button
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none ${
                  selected
                    ? 'border-b-2 border-accent text-accent bg-card'
                    : 'text-muted hover:text-fg hover:bg-card/50'
                }`}
              >
                <CodeBracketIcon className="h-4 w-4" />
                Git Commits
              </button>
            )}
          </Tab>
        </Tab.List>

        <Tab.Panels className="p-4">
          {/* Workflow Runs Panel */}
          <Tab.Panel className="focus:outline-none">
            <WorkflowRunsSection workflowRuns={workflowRuns} />
          </Tab.Panel>

          {/* Use Cases Panel */}
          <Tab.Panel className="focus:outline-none">
            <UseCasesSection useCaseLinks={useCaseLinks} />
          </Tab.Panel>

          {/* Test Cases Panel */}
          <Tab.Panel className="focus:outline-none">
            {allTestCases.length === 0 ? (
              <div className="text-center py-8">
                <BeakerIcon className="h-12 w-12 text-muted mx-auto mb-3" />
                <p className="text-sm text-muted italic">No test cases yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allTestCases.map((testCase) => (
                  <div
                    key={testCase.id}
                    className="border border-border rounded-lg p-3 bg-card hover:bg-card/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-mono text-muted">{testCase.key}</span>
                        <span className="text-sm text-fg">{testCase.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted uppercase">
                          {testCase.testLevel}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            TEST_STATUS_COLORS[testCase.status] || TEST_STATUS_COLORS.pending
                          }`}
                        >
                          {testCase.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      <span>from {testCase.useCaseKey}:</span>
                      <span>{testCase.useCaseTitle}</span>
                    </div>
                    {testCase.testFilePath && (
                      <p className="text-xs text-muted mt-1 font-mono">{testCase.testFilePath}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Tab.Panel>

          {/* Git Commits Panel */}
          <Tab.Panel className="focus:outline-none">
            <CommitsSection commits={commits} />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
