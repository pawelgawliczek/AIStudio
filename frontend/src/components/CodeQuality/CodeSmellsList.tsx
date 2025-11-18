/**
 * Code Smells List Component
 * Filterable list of code issues with severity badges
 */

import React, { useState, useMemo } from 'react';
import { CodeIssue, FileIssue, IssueSeverity } from '../../types/codeQualityTypes';
import { getSeverityColor } from '../../utils/codeQuality/healthCalculations';

interface CodeSmellsListProps {
  issues: CodeIssue[];
  fileIssues?: FileIssue[];
  onCreateStory?: (issue: CodeIssue) => void;
  compact?: boolean;
}

export const CodeSmellsList: React.FC<CodeSmellsListProps> = ({
  issues,
  fileIssues,
  onCreateStory,
  compact = false,
}) => {
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const filteredIssues = useMemo(() => {
    return severityFilter === 'all'
      ? issues
      : issues.filter((issue) => issue.severity === severityFilter);
  }, [issues, severityFilter]);

  const toggleExpanded = (issueId: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  if (compact && fileIssues) {
    return (
      <div className="space-y-2">
        {fileIssues.map((issue, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
          >
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
              {issue.severity.toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{issue.type}</p>
              {issue.line && (
                <p className="text-xs text-gray-500 dark:text-[#9da6b9] mt-1">
                  Line {issue.line}
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-[#9da6b9] mt-1">{issue.message}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 dark:border-[#3b4354]">
        <span className="material-symbols-outlined text-gray-500 text-xl">filter_alt</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
          Filter by severity:
        </span>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((severity) => (
          <button
            key={severity}
            onClick={() => setSeverityFilter(severity)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              severityFilter === severity
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {severity === 'all' ? 'All' : severity.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Issues List */}
      <div className="divide-y divide-gray-200 dark:divide-[#3b4354]">
        {filteredIssues.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <span className="material-symbols-outlined text-gray-400 text-4xl mb-2 block">
              check_circle
            </span>
            <p className="text-gray-500 dark:text-[#9da6b9]">
              No issues found with selected filter
            </p>
          </div>
        ) : (
          filteredIssues.map((issue, idx) => {
            const issueId = `${issue.type}-${idx}`;
            const isExpanded = expandedIssues.has(issueId);

            return (
              <div key={issueId} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                        {issue.type}
                      </h4>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-[#9da6b9]">
                        <span>{issue.count} occurrences</span>
                        <span>{issue.filesAffected} files affected</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onCreateStory && (
                      <button
                        onClick={() => onCreateStory(issue)}
                        className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        Create Story
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpanded(issueId)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors"
                      aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                      <span className="material-symbols-outlined text-gray-500 text-xl">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && issue.sampleFiles.length > 0 && (
                  <div className="mt-3 pl-12">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sample Files:
                    </p>
                    <ul className="space-y-1">
                      {issue.sampleFiles.map((file, fileIdx) => (
                        <li key={fileIdx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-[#9da6b9]">
                          <span className="material-symbols-outlined text-gray-400 text-sm">
                            description
                          </span>
                          <code className="font-mono">{file}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
