/**
 * Code Quality Dashboard - Refactored
 * Main orchestration component for code quality metrics and analysis
 * Phase 3: Reduced from 1,900 LOC to ~200 LOC using custom hooks and components
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useCodeQualityMetrics } from '../hooks/useCodeQualityMetrics';
import { useAnalysisPolling } from '../hooks/useAnalysisPolling';
import { useFileTree } from '../hooks/useFileTree';
import { useStoryCreation } from '../hooks/useStoryCreation';
import { MetricsSummaryCard } from '../components/CodeQuality/MetricsSummaryCard';
import { FileTreeView } from '../components/CodeQuality/FileTreeView';
import { FileDetailsPanel } from '../components/CodeQuality/FileDetailsPanel';
import { AnalysisRefreshButton, AnalysisStatusBanner } from '../components/CodeQuality/AnalysisRefreshButton';
import { StoryCreationDialog } from '../components/CodeQuality/StoryCreationDialog';
import { CodeSmellsList } from '../components/CodeQuality/CodeSmellsList';
import { CodeQualityFilters } from '../types/codeQualityTypes';

const CodeQualityDashboard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'coverage' | 'issues' | 'hotspots'>('overview');
  const [filters, setFilters] = useState<CodeQualityFilters & { timeRange: number }>({
    severityFilter: 'all',
    typeFilter: 'all',
    showOnlyHighRisk: false,
    timeRange: 30,
  });

  // Custom Hooks
  const metrics = useCodeQualityMetrics(projectId, filters);
  const polling = useAnalysisPolling(projectId, metrics.refetch);
  const fileTree = useFileTree(projectId);
  const storyCreation = useStoryCreation(projectId);

  if (metrics.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-6xl text-primary mb-4 block">
            progress_activity
          </span>
          <p className="text-gray-600 dark:text-gray-400">Loading code quality metrics...</p>
        </div>
      </div>
    );
  }

  if (metrics.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4 block">error</span>
          <p className="text-red-600 dark:text-red-400 mb-4">{metrics.error}</p>
          <button
            onClick={metrics.refetch}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const healthScore = metrics.projectMetrics?.healthScore.overallScore || 0;
  const coverage = metrics.projectMetrics?.healthScore.coverage || 0;
  const complexity = metrics.projectMetrics?.healthScore.complexity || 0;
  const techDebt = metrics.projectMetrics?.healthScore.techDebtRatio || 0;

  return (
    <>
      <Toaster position="top-right" />
      <div className="flex min-h-screen bg-[#f6f6f8] dark:bg-[#101622]">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden md:block w-64 bg-[#111318] text-white fixed left-0 top-0 h-screen flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-black tracking-tight">Code Quality</h1>
        </div>
        <nav className="flex-1 py-4">
          {[
            { id: 'overview', label: 'Overview', icon: 'dashboard' },
            { id: 'files', label: 'Files & Folders', icon: 'folder_open' },
            { id: 'coverage', label: 'Test Coverage', icon: 'verified' },
            { id: 'issues', label: 'Code Issues', icon: 'bug_report' },
            { id: 'hotspots', label: 'Hotspots', icon: 'local_fire_department' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-6 py-3 transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary/20 text-white border-r-4 border-primary'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined ${activeTab === tab.id ? 'text-primary' : ''}`}>
                {tab.icon}
              </span>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content - No margin on mobile */}
      <div className="md:ml-64 flex-1">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                {activeTab === 'overview' && 'Code Quality Overview'}
                {activeTab === 'files' && 'Files & Folders'}
                {activeTab === 'coverage' && 'Test Coverage'}
                {activeTab === 'issues' && 'Code Issues'}
                {activeTab === 'hotspots' && 'Hotspots Analysis'}
              </h2>
            </div>
            <AnalysisRefreshButton
              isAnalyzing={polling.isAnalyzing}
              analysisStatus={polling.analysisStatus}
              onRefresh={polling.startAnalysis}
            />
          </div>

          {/* Analysis Status Banner */}
          {(polling.isAnalyzing || polling.showAnalysisNotification) && (
            <AnalysisStatusBanner
              isAnalyzing={polling.isAnalyzing}
              analysisStatus={polling.analysisStatus}
              onDismiss={polling.dismissNotification}
            />
          )}

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Cards - Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricsSummaryCard
                  title="Health Score"
                  value={healthScore.toFixed(0)}
                  icon="favorite"
                  healthScore={healthScore}
                  trend={{
                    direction: metrics.projectMetrics?.healthScore.trend || 'stable',
                    value: metrics.projectMetrics?.healthScore.weeklyChange || 0,
                  }}
                />
                <MetricsSummaryCard
                  title="Test Coverage"
                  value={`${coverage.toFixed(1)}%`}
                  icon="verified"
                  healthScore={coverage}
                />
                <MetricsSummaryCard
                  title="Avg Complexity"
                  value={complexity.toFixed(1)}
                  icon="psychology"
                  healthScore={100 - complexity * 10}
                />
                <MetricsSummaryCard
                  title="Tech Debt"
                  value={`${techDebt.toFixed(1)}%`}
                  icon="build"
                  healthScore={100 - techDebt}
                />
              </div>

              {/* Hotspots Table */}
              <div className="bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3b4354]">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Hotspots</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/30">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          File
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Risk
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Complexity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Coverage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-[#3b4354]">
                      {metrics.hotspots.slice(0, 10).map((hotspot) => (
                        <tr
                          key={hotspot.filePath}
                          className="hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">
                            {hotspot.filePath}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-red-600">
                            {hotspot.riskScore.toFixed(0)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {hotspot.complexity}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {hotspot.coverage.toFixed(1)}%
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => storyCreation.createStoryForFile(hotspot)}
                              className="text-xs text-primary hover:underline"
                            >
                              Create Story
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {metrics.folderHierarchy && (
                  <FileTreeView
                    tree={metrics.folderHierarchy.children || [metrics.folderHierarchy]}
                    expandedFolders={fileTree.expandedFolders}
                    selectedFile={fileTree.selectedFile}
                    onToggleFolder={fileTree.toggleFolder}
                    onSelectFile={fileTree.selectFile}
                  />
                )}
              </div>
              <div className="lg:sticky lg:top-8">
                <FileDetailsPanel file={fileTree.selectedFile} loading={fileTree.loadingDetail} />
              </div>
            </div>
          )}

          {activeTab === 'coverage' && (
            <div className="bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Coverage Gaps
              </h3>
              {metrics.coverageGaps.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No coverage gaps found</p>
              ) : (
                <div className="space-y-3">
                  {metrics.coverageGaps.map((gap) => (
                    <div
                      key={gap.filePath}
                      className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm text-gray-900 dark:text-white">
                          {gap.filePath}
                        </span>
                        <span className="text-xs text-red-600 font-bold">
                          Priority: {gap.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{gap.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'issues' && (
            <CodeSmellsList
              issues={metrics.codeIssues}
              onCreateStory={storyCreation.createStoryForIssue}
            />
          )}

          {activeTab === 'hotspots' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Risk Distribution
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-3xl font-bold text-red-600">
                      {metrics.hotspots.filter((h) => h.riskScore > 70).length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Critical Risk
                    </div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="text-3xl font-bold text-yellow-600">
                      {metrics.hotspots.filter((h) => h.riskScore > 40 && h.riskScore <= 70).length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Medium Risk
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">
                      {metrics.hotspots.filter((h) => h.riskScore <= 40).length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Low Risk</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Story Creation Dialog */}
      <StoryCreationDialog
        isOpen={storyCreation.isStoryModalOpen}
        title={storyCreation.storyTitle}
        description={storyCreation.storyDescription}
        context={storyCreation.storyContext}
        isCreating={storyCreation.creatingStory}
        onTitleChange={storyCreation.setStoryTitle}
        onDescriptionChange={storyCreation.setStoryDescription}
        onSave={storyCreation.saveStory}
        onClose={storyCreation.closeModal}
      />
      </div>
    </>
  );
};

export default CodeQualityDashboard;
