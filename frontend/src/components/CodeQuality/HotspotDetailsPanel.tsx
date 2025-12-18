/**
 * Hotspot Details Panel Component
 * Slide-out panel showing detailed information about a file hotspot
 */

import {
  XMarkIcon,
  FireIcon,
  CubeTransparentIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../lib/axios';
import { FileHotspot, FileDetail } from '../../types/codeQualityTypes';
import { TrendChart } from './TrendChart';

interface HotspotDetailsPanelProps {
  hotspot: FileHotspot | null;
  isOpen: boolean;
  onClose: () => void;
}

export const HotspotDetailsPanel: React.FC<HotspotDetailsPanelProps> = ({
  hotspot,
  isOpen,
  onClose,
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const [fileDetails, setFileDetails] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!hotspot || !projectId || !isOpen) return;

      try {
        setLoading(true);
        const response = await axios.get(
          `/code-metrics/file/${projectId}?filePath=${encodeURIComponent(hotspot.filePath)}`
        );
        setFileDetails(response.data);
      } catch (error) {
        console.error('Failed to fetch file details:', error);
        setFileDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFileDetails();
  }, [hotspot, projectId, isOpen]);

  if (!hotspot) return null;

  const getMaintainabilityGrade = (maintainabilityIndex: number): string => {
    if (maintainabilityIndex >= 80) return 'A';
    if (maintainabilityIndex >= 60) return 'B';
    if (maintainabilityIndex >= 40) return 'C';
    return 'D';
  };

  const getChurnLevel = (churnCount: number): string => {
    if (churnCount > 60) return 'High';
    if (churnCount > 30) return 'Medium';
    return 'Low';
  };

  // Generate churn trend data from recent changes
  const churnTrendData = fileDetails?.recentChanges
    ? fileDetails.recentChanges.map(change => ({
        date: new Date(change.date).toISOString().split('T')[0],
        value: change.linesChanged,
      })).reverse()
    : [];

  const dependencies = fileDetails?.imports || [];
  const dependents = fileDetails?.importedBy || [];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-out Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-2xl transform transition-transform duration-300 ease-in-out bg-gray-50 dark:bg-[#1A202C] shadow-lg border-l border-gray-200 dark:border-[#3b4354] flex flex-col z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <header className="sticky top-0 bg-gray-50 dark:bg-[#1A202C] px-6 pt-6 pb-4 border-b border-gray-200 dark:border-[#3b4354] z-10">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2
                className="text-lg font-bold text-gray-900 dark:text-white truncate"
                title={hotspot.filePath}
              >
                {hotspot.filePath}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span>LOC: {hotspot.loc}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  Last Analyzed:{' '}
                  {new Date(hotspot.lastModified).toLocaleDateString()}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white flex-shrink-0"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Risk Factors Breakdown */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Risk Factors Breakdown
            </h3>
            <div className="space-y-3">
              {hotspot.churnCount > 30 && (
                <div className="flex items-start gap-3 p-4 bg-white dark:bg-[#282e39] rounded-lg border border-gray-200 dark:border-[#3b4354]">
                  <FireIcon className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      High Churn Rate
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      This file has been modified in {hotspot.churnCount} commits
                      over the last 6 months, indicating it's a volatile part of
                      the codebase.
                    </p>
                  </div>
                </div>
              )}

              {hotspot.complexity > 20 && (
                <div className="flex items-start gap-3 p-4 bg-white dark:bg-[#282e39] rounded-lg border border-gray-200 dark:border-[#3b4354]">
                  <CubeTransparentIcon className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      High Complexity
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      With a cyclomatic complexity of {hotspot.complexity}, this
                      file is difficult to understand, test, and maintain.
                    </p>
                  </div>
                </div>
              )}

              {fileDetails && fileDetails.maintainabilityIndex < 60 && (
                <div className="flex items-start gap-3 p-4 bg-white dark:bg-[#282e39] rounded-lg border border-gray-200 dark:border-[#3b4354]">
                  <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Low Maintainability
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      A maintainability grade of '{getMaintainabilityGrade(fileDetails.maintainabilityIndex)}' (index: {fileDetails.maintainabilityIndex.toFixed(0)}) suggests significant technical debt and refactoring challenges.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Metrics Grid */}
          <section className="mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#282e39] p-4 rounded-lg border border-gray-200 dark:border-[#3b4354]">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Risk Score
                </p>
                <p className="text-2xl font-bold text-red-500 mt-1">
                  {hotspot.riskScore.toFixed(1)}
                </p>
              </div>
              <div className="bg-white dark:bg-[#282e39] p-4 rounded-lg border border-gray-200 dark:border-[#3b4354]">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Complexity
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {hotspot.complexity}
                </p>
              </div>
              <div className="bg-white dark:bg-[#282e39] p-4 rounded-lg border border-gray-200 dark:border-[#3b4354]">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Churn Rate
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {hotspot.churnCount}
                </p>
              </div>
              <div className="bg-white dark:bg-[#282e39] p-4 rounded-lg border border-gray-200 dark:border-[#3b4354]">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Maintainability
                </p>
                <p className="text-2xl font-bold text-red-500 mt-1">
                  {fileDetails ? getMaintainabilityGrade(fileDetails.maintainabilityIndex) : '-'}
                </p>
              </div>
            </div>
          </section>

          {/* Historical Churn */}
          {churnTrendData.length > 0 && (
            <section className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Recent Changes (Lines Modified)
              </h3>
              <div className="h-48 bg-white dark:bg-[#282e39] rounded-lg p-4 border border-gray-200 dark:border-[#3b4354]">
                <TrendChart
                  title=""
                  subtitle=""
                  data={churnTrendData}
                  dataKey="value"
                  height={150}
                  color="#ef4444"
                />
              </div>
            </section>
          )}

          {/* Loading State */}
          {loading && (
            <section className="mb-8">
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </section>
          )}

          {/* AI-Generated Recommendations */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              AI-Generated Recommendations
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-white dark:bg-[#282e39] rounded-lg border border-gray-200 dark:border-primary/50">
                <SparklesIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Consider breaking down large functions in this file. Extract
                  validation, business logic, and side effects into separate
                  modules to reduce complexity from {hotspot.complexity} to a more
                  manageable level.
                </p>
              </div>
              {hotspot.churnCount > 30 && (
                <div className="flex items-start gap-3 p-4 bg-white dark:bg-[#282e39] rounded-lg border border-gray-200 dark:border-primary/50">
                  <SparklesIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    High churn rate indicates this file is frequently modified.
                    Consider introducing design patterns (Strategy, Factory) to
                    decouple core logic from specific implementations, improving
                    flexibility and maintainability.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Related Files & Dependencies */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Related Files & Dependencies
            </h3>

            {/* Dependencies (Imports) */}
            {dependencies.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  This file imports ({dependencies.length}):
                </h4>
                <div className="space-y-2">
                  {dependencies.slice(0, 10).map((dep, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white dark:bg-[#282e39] rounded-lg border border-gray-200 dark:border-[#3b4354]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ArrowRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate" title={dep}>
                          {dep}
                        </p>
                      </div>
                      <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                        Import
                      </span>
                    </div>
                  ))}
                </div>
                {dependencies.length > 10 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    ... and {dependencies.length - 10} more
                  </p>
                )}
              </div>
            )}

            {/* Dependents (Imported By) */}
            {dependents.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Imported by ({dependents.length}):
                </h4>
                <div className="space-y-2">
                  {dependents.slice(0, 10).map((dep, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white dark:bg-[#282e39] rounded-lg border border-gray-200 dark:border-[#3b4354]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ArrowLeftIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate" title={dep}>
                          {dep}
                        </p>
                      </div>
                      <span className="text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                        Dependent
                      </span>
                    </div>
                  ))}
                </div>
                {dependents.length > 10 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    ... and {dependents.length - 10} more
                  </p>
                )}
              </div>
            )}

            {dependencies.length === 0 && dependents.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No dependencies found
              </p>
            )}
          </section>
        </div>
      </aside>
    </>
  );
};
