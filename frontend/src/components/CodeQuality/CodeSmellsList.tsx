/**
 * Code Smells List Component
 * Filterable list of code issues with severity badges
 */

import React, { useState, useMemo } from 'react';
import { CodeIssue, FileIssue, IssueSeverity } from '../../types/codeQualityTypes';
import { getSeverityColor } from '../../utils/codeQuality/healthCalculations';
import { CheckCircleIcon, WarningIcon, ErrorIcon, InfoIcon, ChevronDownIcon } from './Icons';

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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
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
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredIssues.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <div className="text-green-500 mb-3 flex justify-center">
              <CheckCircleIcon className="w-12 h-12" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
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
                      <ChevronDownIcon className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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
                        <li key={fileIdx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <span className="text-gray-400">•</span>
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
