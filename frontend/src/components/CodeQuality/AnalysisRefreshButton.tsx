/**
 * Analysis Refresh Button Component
 * Button with polling state and loading indicator
 */

import React from 'react';
import { AnalysisStatus } from '../../types/codeQualityTypes';

interface AnalysisRefreshButtonProps {
  isAnalyzing: boolean;
  analysisStatus: AnalysisStatus | null;
  onRefresh: () => void;
  disabled?: boolean;
}

export const AnalysisRefreshButton: React.FC<AnalysisRefreshButtonProps> = ({
  isAnalyzing,
  analysisStatus,
  onRefresh,
  disabled,
}) => {
  const getButtonText = () => {
    if (isAnalyzing) {
      return analysisStatus?.progress
        ? `Analyzing... ${analysisStatus.progress}%`
        : 'Analyzing...';
    }
    return 'Refresh Analysis';
  };

  const getStatusIcon = () => {
    if (isAnalyzing) {
      return (
        <span className="material-symbols-outlined animate-spin text-xl">
          progress_activity
        </span>
      );
    }
    return <span className="material-symbols-outlined text-xl">refresh</span>;
  };

  return (
    <button
      onClick={onRefresh}
      disabled={disabled || isAnalyzing}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
        ${
          disabled || isAnalyzing
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-primary text-white hover:bg-primary/90 hover:shadow-lg'
        }
      `}
    >
      {getStatusIcon()}
      <span>{getButtonText()}</span>
    </button>
  );
};

interface AnalysisStatusBannerProps {
  isAnalyzing: boolean;
  analysisStatus: AnalysisStatus | null;
  onDismiss: () => void;
}

export const AnalysisStatusBanner: React.FC<AnalysisStatusBannerProps> = ({
  isAnalyzing,
  analysisStatus,
  onDismiss,
}) => {
  if (!isAnalyzing && !analysisStatus) return null;

  const isSuccess = analysisStatus?.status === 'completed';
  const isFailed = analysisStatus?.status === 'failed';

  const getBannerStyles = () => {
    if (isFailed) {
      return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400';
    }
    if (isSuccess) {
      return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400';
    }
    return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
  };

  const getIcon = () => {
    if (isFailed) return 'error';
    if (isSuccess) return 'check_circle';
    return 'hourglass_top';
  };

  return (
    <div
      className={`
        flex items-center justify-between px-6 py-4 rounded-lg border-2 mb-6
        ${getBannerStyles()}
      `}
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-2xl">
          {getIcon()}
        </span>
        <div>
          <p className="font-bold">
            {isFailed
              ? 'Analysis Failed'
              : isSuccess
              ? 'Analysis Complete'
              : 'Analysis in Progress'}
          </p>
          {analysisStatus?.message && (
            <p className="text-sm mt-1">{analysisStatus.message}</p>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
};
