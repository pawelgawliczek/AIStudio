/**
 * Analysis Refresh Button Component
 * Button with polling state and loading indicator
 */

import React from 'react';
import { AnalysisStatus } from '../../types/codeQualityTypes';
import { RefreshIcon, CheckCircleIcon, ErrorIcon } from './Icons';

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

  return (
    <button
      onClick={onRefresh}
      disabled={disabled || isAnalyzing}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all text-sm
        ${
          disabled || isAnalyzing
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-primary text-white hover:bg-primary/90 hover:shadow-md'
        }
      `}
    >
      {isAnalyzing ? (
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      ) : (
        <RefreshIcon />
      )}
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
    if (isFailed) return <ErrorIcon className="w-6 h-6" />;
    if (isSuccess) return <CheckCircleIcon className="w-6 h-6" />;
    return (
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"></div>
        <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
      </div>
    );
  };

  return (
    <div
      className={`
        flex items-center justify-between px-6 py-4 rounded-lg border-2 mb-6
        ${getBannerStyles()}
      `}
    >
      <div className="flex items-center gap-3">
        {getIcon()}
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
        className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
};
