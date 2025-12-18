import { Disclosure, Transition } from '@headlessui/react';
import {
  ChevronDownIcon,
  CodeBracketIcon,
  DocumentIcon,
  Cog6ToothIcon,
  PlusIcon,
  MinusIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React, { useState } from 'react';
import type { Story } from '../../types';

// Commit type based on backend schema
interface Commit {
  id: string;
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  files?: Array<{
    filePath: string;
    locAdded: number;
    locDeleted: number;
  }>;
}

interface FileChange {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  locAdded: number;
  locDeleted: number;
  complexity?: 'low' | 'medium' | 'high';
}

interface AcceptanceCriterion {
  id: string;
  text: string;
  satisfied: boolean;
  notes?: string;
}

interface ImplementationSummaryCardProps {
  story: Story;
  commits?: Commit[];
  fileChanges?: FileChange[];
  acceptanceCriteria?: AcceptanceCriterion[];
  onCriteriaToggle?: (criterionId: string, satisfied: boolean) => void;
  onCriteriaNoteChange?: (criterionId: string, notes: string) => void;
}

function getFileIcon(filePath: string) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    return <CodeBracketIcon className="h-4 w-4 text-blue-500" />;
  }
  if (filePath.endsWith('.json') || filePath.endsWith('.yaml') || filePath.endsWith('.yml') || filePath.endsWith('.env')) {
    return <Cog6ToothIcon className="h-4 w-4 text-gray-500" />;
  }
  return <DocumentIcon className="h-4 w-4 text-muted" />;
}

function getChangeTypeBadge(changeType: 'added' | 'modified' | 'deleted') {
  const styles = {
    added: 'bg-green-500/10 text-green-600 border-green-500/20',
    modified: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    deleted: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  const icons = {
    added: <PlusIcon className="h-3 w-3" />,
    modified: <span className="text-xs">~</span>,
    deleted: <MinusIcon className="h-3 w-3" />,
  };
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', styles[changeType])}>
      {icons[changeType]}
      {changeType}
    </span>
  );
}

function getComplexityBadge(complexity?: 'low' | 'medium' | 'high') {
  if (!complexity) return null;
  const styles = {
    low: 'bg-green-500/10 text-green-600',
    medium: 'bg-yellow-500/10 text-yellow-600',
    high: 'bg-red-500/10 text-red-600',
  };
  const arrows = { low: '\u2193', medium: '\u2192', high: '\u2191' };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs', styles[complexity])}>
      {arrows[complexity]} {complexity}
    </span>
  );
}

function parseAcceptanceCriteria(description?: string): AcceptanceCriterion[] {
  if (!description) return [];
  const checklistRegex = /^[-*]\s+\[(.)]\s+(.+?)$/gm;
  const matches = [...description.matchAll(checklistRegex)];
  return matches.map((match, index) => ({
    id: `criteria-${index}`,
    text: match[2].trim(),
    satisfied: match[1].toLowerCase() === 'x',
    notes: '',
  }));
}

export function ImplementationSummaryCard({
  story,
  commits = [],
  fileChanges = [],
  acceptanceCriteria,
  onCriteriaToggle,
  onCriteriaNoteChange,
}: ImplementationSummaryCardProps) {
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>(null);

  // Parse acceptance criteria from story description if not provided
  const criteria = acceptanceCriteria || parseAcceptanceCriteria(story.description);

  // Aggregate file changes from commits if not provided directly
  const files: FileChange[] = fileChanges.length > 0 ? fileChanges :
    commits.flatMap(c => (c.files || []).map(f => ({
      filePath: f.filePath,
      changeType: f.locAdded > 0 && f.locDeleted === 0 ? 'added' as const :
                  f.locDeleted > 0 && f.locAdded === 0 ? 'deleted' as const : 'modified' as const,
      locAdded: f.locAdded,
      locDeleted: f.locDeleted,
    }))).reduce((acc, file) => {
      const existing = acc.find(f => f.filePath === file.filePath);
      if (existing) {
        existing.locAdded += file.locAdded;
        existing.locDeleted += file.locDeleted;
      } else {
        acc.push(file);
      }
      return acc;
    }, [] as FileChange[]);

  const totalLocAdded = files.reduce((sum, f) => sum + f.locAdded, 0);
  const totalLocDeleted = files.reduce((sum, f) => sum + f.locDeleted, 0);
  const satisfiedCount = criteria.filter(c => c.satisfied).length;

  return (
    <div className="bg-card border border-border rounded-lg shadow-md">
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex justify-between items-center w-full p-6 text-left">
              <div>
                <h2 className="text-lg font-bold text-fg">Implementation Summary</h2>
                <p className="text-sm text-muted mt-1">
                  {files.length} files, +{totalLocAdded} -{totalLocDeleted} LOC, {commits.length} commits
                </p>
              </div>
              <ChevronDownIcon
                className={clsx('h-5 w-5 text-muted transition-transform', open && 'rotate-180')}
              />
            </Disclosure.Button>

            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <Disclosure.Panel className="px-6 pb-6 space-y-6">
                {/* Files Modified */}
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-3">
                    Files Modified ({files.length} files)
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {files.length === 0 ? (
                      <p className="text-sm text-muted italic">No file changes detected</p>
                    ) : (
                      files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getFileIcon(file.filePath)}
                            <span className="text-sm text-fg truncate font-mono">
                              {file.filePath}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            {getChangeTypeBadge(file.changeType)}
                            <span className="text-xs text-muted whitespace-nowrap">
                              <span className="text-green-600">+{file.locAdded}</span>
                              {' / '}
                              <span className="text-red-600">-{file.locDeleted}</span>
                            </span>
                            {getComplexityBadge(file.complexity)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Commits */}
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-3">
                    Commits ({commits.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {commits.length === 0 ? (
                      <p className="text-sm text-muted italic">No commits yet</p>
                    ) : (
                      commits.slice(0, 10).map((commit) => (
                        <div
                          key={commit.id}
                          className="flex items-start gap-3 p-3 bg-bg-secondary rounded-lg"
                        >
                          <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted">
                                {commit.hash.slice(0, 7)}
                              </span>
                              <span className="text-sm font-medium text-fg truncate">
                                {commit.message}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted">
                              <span>{commit.author}</span>
                              <span>{new Date(commit.timestamp).toLocaleDateString()}</span>
                              {commit.files && (
                                <span>
                                  {commit.files.length} files |{' '}
                                  <span className="text-green-600">
                                    +{commit.files.reduce((s, f) => s + f.locAdded, 0)}
                                  </span>
                                  {' '}
                                  <span className="text-red-600">
                                    -{commit.files.reduce((s, f) => s + f.locDeleted, 0)}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Acceptance Criteria */}
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-3">
                    Acceptance Criteria ({satisfiedCount}/{criteria.length} satisfied)
                  </h3>
                  <div className="space-y-2">
                    {criteria.length === 0 ? (
                      <p className="text-sm text-muted italic">
                        No acceptance criteria found. Add checklist items to the story description.
                      </p>
                    ) : (
                      criteria.map((criterion) => (
                        <div
                          key={criterion.id}
                          className="p-3 bg-bg-secondary rounded-lg"
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => onCriteriaToggle?.(criterion.id, !criterion.satisfied)}
                              className={clsx(
                                'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5',
                                criterion.satisfied
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-border hover:border-accent'
                              )}
                            >
                              {criterion.satisfied && <CheckIcon className="h-3 w-3" />}
                            </button>
                            <div className="flex-1">
                              <p className={clsx(
                                'text-sm',
                                criterion.satisfied ? 'text-muted' : 'text-fg font-medium'
                              )}>
                                {criterion.text}
                              </p>
                              {expandedCriteria === criterion.id && (
                                <textarea
                                  placeholder="Add notes..."
                                  value={criterion.notes || ''}
                                  onChange={(e) => onCriteriaNoteChange?.(criterion.id, e.target.value)}
                                  className="mt-2 w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-fg focus:border-accent focus:ring-1 focus:ring-accent"
                                  rows={2}
                                />
                              )}
                            </div>
                            <button
                              onClick={() => setExpandedCriteria(
                                expandedCriteria === criterion.id ? null : criterion.id
                              )}
                              className="text-xs text-accent hover:underline"
                            >
                              {expandedCriteria === criterion.id ? 'Hide' : 'Notes'}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Disclosure.Panel>
            </Transition>
          </>
        )}
      </Disclosure>
    </div>
  );
}
