import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

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

interface CommitsSectionProps {
  commits?: Commit[];
}

export function CommitsSection({ commits = [] }: CommitsSectionProps) {
  if (commits.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-2">
          <CodeBracketIcon className="h-5 w-5 text-muted" />
          <h3 className="font-medium text-fg">Git Commits</h3>
        </div>
        <p className="text-sm text-muted italic">No commits linked yet</p>
      </div>
    );
  }

  // Calculate total changes
  const totalFiles = commits.reduce((sum, commit) => sum + (commit.files?.length || 0), 0);
  const totalAdded = commits.reduce(
    (sum, commit) =>
      sum + (commit.files?.reduce((s, f) => s + f.locAdded, 0) || 0),
    0
  );
  const totalDeleted = commits.reduce(
    (sum, commit) =>
      sum + (commit.files?.reduce((s, f) => s + f.locDeleted, 0) || 0),
    0
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CodeBracketIcon className="h-5 w-5 text-muted" />
            <h3 className="font-medium text-fg">Git Commits ({commits.length})</h3>
          </div>
          {totalFiles > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{totalFiles} files</span>
              <span className="text-green-600">+{totalAdded}</span>
              <span className="text-red-600">-{totalDeleted}</span>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {commits.map((commit) => {
          const filesChanged = commit.files?.length || 0;
          const linesAdded = commit.files?.reduce((sum, f) => sum + f.locAdded, 0) || 0;
          const linesDeleted = commit.files?.reduce((sum, f) => sum + f.locDeleted, 0) || 0;

          return (
            <Disclosure key={commit.hash}>
              {({ open }) => (
                <>
                  <Disclosure.Button className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-card/80 transition-colors">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted">{commit.hash.substring(0, 7)}</span>
                        <span className="text-sm text-fg truncate">{commit.message}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>{commit.author.split('<')[0].trim()}</span>
                        <span>{formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {filesChanged > 0 && (
                        <>
                          <span className="text-xs text-muted">{filesChanged} files</span>
                          {linesAdded > 0 && (
                            <span className="text-xs text-green-600">+{linesAdded}</span>
                          )}
                          {linesDeleted > 0 && (
                            <span className="text-xs text-red-600">-{linesDeleted}</span>
                          )}
                        </>
                      )}
                      <ChevronDownIcon
                        className={`h-5 w-5 text-muted transition-transform duration-200 ${
                          open ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </Disclosure.Button>

                  {commit.files && commit.files.length > 0 && (
                    <Transition
                      enter="transition duration-200 ease-out"
                      enterFrom="opacity-0 -translate-y-1"
                      enterTo="opacity-100 translate-y-0"
                      leave="transition duration-150 ease-in"
                      leaveFrom="opacity-100 translate-y-0"
                      leaveTo="opacity-0 -translate-y-1"
                    >
                      <Disclosure.Panel className="px-4 pb-4 bg-card/50">
                        <div className="mt-2 space-y-1">
                          <h4 className="text-xs font-medium text-muted mb-2">
                            Files Changed ({commit.files.length})
                          </h4>
                          {commit.files.map((file) => (
                            <div
                              key={file.id}
                              className="border border-border rounded p-2 bg-card"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-fg truncate flex-1">
                                  {file.filePath}
                                </span>
                                <div className="flex items-center gap-2 ml-4">
                                  {file.locAdded > 0 && (
                                    <span className="text-xs text-green-600">+{file.locAdded}</span>
                                  )}
                                  {file.locDeleted > 0 && (
                                    <span className="text-xs text-red-600">-{file.locDeleted}</span>
                                  )}
                                </div>
                              </div>
                              {(file.complexityAfter !== undefined || file.coverageAfter !== undefined) && (
                                <div className="flex gap-3 mt-1 text-xs text-muted">
                                  {file.complexityBefore !== undefined && file.complexityAfter !== undefined && (
                                    <span>
                                      Complexity: {file.complexityBefore} → {file.complexityAfter}
                                    </span>
                                  )}
                                  {file.coverageBefore !== undefined && file.coverageAfter !== undefined && (
                                    <span>
                                      Coverage: {file.coverageBefore}% → {file.coverageAfter}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </Disclosure.Panel>
                    </Transition>
                  )}
                </>
              )}
            </Disclosure>
          );
        })}
      </div>
    </div>
  );
}
