/**
 * File Details Panel Component
 * Sticky right panel showing detailed metrics for selected file
 */

import React from 'react';
import { FileDetail } from '../../types/codeQualityTypes';
import { getHealthColor, getSeverityColor } from '../../utils/codeQuality/healthCalculations';

interface FileDetailsPanelProps {
  file: FileDetail | null;
  loading?: boolean;
}

export const FileDetailsPanel: React.FC<FileDetailsPanelProps> = ({ file, loading }) => {
  if (loading) {
    return (
      <div className="lg:sticky lg:top-8 bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="lg:sticky lg:top-8 bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl p-6">
        <div className="text-center text-gray-500 dark:text-[#9da6b9]">
          <span className="material-symbols-outlined text-4xl mb-2 block">description</span>
          <p>Select a file to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:sticky lg:top-8 bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl p-6">
      {/* File Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-gray-400">description</span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {file.filePath.split('/').pop()}
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-[#9da6b9] truncate">{file.filePath}</p>
      </div>

      {/* Metrics Grid - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-[#9da6b9] mb-1">Risk Score</div>
          <div className={`text-2xl font-bold ${getHealthColor(100 - file.riskScore)}`}>
            {file.riskScore.toFixed(0)}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-[#9da6b9] mb-1">Complexity</div>
          <div className={`text-2xl font-bold ${getHealthColor(100 - file.complexity * 10)}`}>
            {file.complexity}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-[#9da6b9] mb-1">Coverage</div>
          <div className={`text-2xl font-bold ${getHealthColor(file.coverage)}`}>
            {file.coverage.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-[#9da6b9] mb-1">Maintainability</div>
          <div className={`text-2xl font-bold ${getHealthColor(file.maintainabilityIndex)}`}>
            {file.maintainabilityIndex.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="mb-6 border-t border-gray-200 dark:border-[#3b4354] pt-4">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Detailed Breakdown</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9da6b9]">Lines of Code</span>
            <span className="font-medium text-gray-900 dark:text-white">{file.loc}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9da6b9]">Cognitive Complexity</span>
            <span className="font-medium text-gray-900 dark:text-white">{file.cognitiveComplexity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9da6b9]">Churn Count</span>
            <span className="font-medium text-gray-900 dark:text-white">{file.churnCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-[#9da6b9]">Coupling</span>
            <span className={`font-medium ${file.couplingScore === 'high' ? 'text-red-600' : file.couplingScore === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
              {file.couplingScore.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Changes */}
      {file.recentChanges && file.recentChanges.length > 0 && (
        <div className="mb-6 border-t border-gray-200 dark:border-[#3b4354] pt-4">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Recent Changes</h4>
          <div className="space-y-3">
            {file.recentChanges.slice(0, 3).map((change, idx) => {
              // Determine icon and color based on change type
              const getChangeIcon = () => {
                if (change.linesChanged > 50) return { icon: 'add', color: 'green' };
                if (change.linesChanged < 0) return { icon: 'remove', color: 'red' };
                if (Math.abs(change.linesChanged) < 10) return { icon: 'style', color: 'gray' };
                return { icon: 'build', color: 'blue' };
              };
              const { icon, color } = getChangeIcon();

              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`bg-${color}-500/10 p-2 rounded-full flex-shrink-0`}>
                    <span className={`material-symbols-outlined text-${color}-500 text-base`}>
                      {icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {change.storyKey || 'Code change'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {change.linesChanged > 0 ? '+' : ''}{change.linesChanged} lines - {new Date(change.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Issues */}
      {file.issues && file.issues.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Issues</h4>
          <div className="space-y-2">
            {file.issues.slice(0, 3).map((issue, idx) => (
              <div key={idx} className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                    {issue.severity.toUpperCase()}
                  </span>
                  {issue.line && (
                    <span className="text-gray-500 dark:text-[#9da6b9] text-xs">
                      Line {issue.line}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-[#9da6b9] text-xs">{issue.message}</p>
              </div>
            ))}
            {file.issues.length > 3 && (
              <p className="text-xs text-gray-500 dark:text-[#9da6b9] mt-2">
                +{file.issues.length - 3} more issues
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
