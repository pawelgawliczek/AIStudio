/**
 * Custom hook for fetching and managing code quality metrics
 * Handles data fetching, state management, and error handling
 */

import { useState, useEffect, useCallback } from 'react';
import axios from '../lib/axios';
import {
  ProjectMetrics,
  FileHotspot,
  FolderNode,
  CoverageGap,
  CodeIssue,
  AnalysisComparison,
  TestSummary,
  FileChangesData,
  CodeQualityFilters,
  TrendDataPoint,
  RecentAnalysis,
} from '../types/codeQualityTypes';

interface UseCodeQualityMetricsReturn {
  projectMetrics: ProjectMetrics | null;
  hotspots: FileHotspot[];
  folderHierarchy: FolderNode | null;
  folderStats: any[]; // Add folderStats property
  coverageGaps: CoverageGap[];
  codeIssues: CodeIssue[];
  analysisComparison: AnalysisComparison | null;
  testSummary: TestSummary | null;
  fileChanges: FileChangesData | null;
  trendData: TrendDataPoint[];
  recentAnalyses: RecentAnalysis[];
  recentAnalysesLoading: boolean;
  recentAnalysesError: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refetchRecentAnalyses: () => Promise<void>;
}

export function useCodeQualityMetrics(
  projectId: string | undefined,
  filters: CodeQualityFilters & { timeRange: number }
): UseCodeQualityMetricsReturn {
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics | null>(null);
  const [hotspots, setHotspots] = useState<FileHotspot[]>([]);
  const [folderHierarchy, setFolderHierarchy] = useState<FolderNode | null>(null);
  const [folderStats, setFolderStats] = useState<any[]>([]);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);
  const [codeIssues, setCodeIssues] = useState<CodeIssue[]>([]);
  const [analysisComparison, setAnalysisComparison] = useState<AnalysisComparison | null>(null);
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null);
  const [fileChanges, setFileChanges] = useState<FileChangesData | null>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [recentAnalysesLoading, setRecentAnalysesLoading] = useState(false);
  const [recentAnalysesError, setRecentAnalysesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMainMetrics = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);

      // BR-1 (Real-Time Data Refresh): Add cache-busting timestamp parameter
      // to ensure fresh data after analysis (ST-16 Issue #1 fix per architect_analysis)
      const cacheBuster = Date.now();

      const [projectRes, hotspotsRes, hierarchyRes, coverageGapsRes, issuesRes, trendsRes] =
        await Promise.all([
          axios.get(`/code-metrics/project/${projectId}?timeRangeDays=${filters.timeRange}&_t=${cacheBuster}`),
          axios.get(`/code-metrics/project/${projectId}/hotspots?limit=50&_t=${cacheBuster}`),
          axios.get(`/code-metrics/project/${projectId}/hierarchy?_t=${cacheBuster}`),
          axios.get(`/code-metrics/project/${projectId}/coverage-gaps?limit=20&_t=${cacheBuster}`),
          axios.get(`/code-metrics/project/${projectId}/issues?_t=${cacheBuster}`),
          axios.get(`/code-metrics/project/${projectId}/trends?days=${filters.timeRange}&_t=${cacheBuster}`),
        ]);

      setProjectMetrics(projectRes.data);
      setHotspots(hotspotsRes.data);
      setFolderHierarchy(hierarchyRes.data);
      setCoverageGaps(coverageGapsRes.data);
      setCodeIssues(issuesRes.data);
      setTrendData(trendsRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load code quality metrics');
    } finally {
      setLoading(false);
    }
  }, [projectId, filters.timeRange]);

  const fetchComparisonAndTests = useCallback(async () => {
    if (!projectId) return;

    try {
      // BR-1 (Real-Time Data Refresh): Add cache-busting timestamp parameter
      const cacheBuster = Date.now();

      const [comparisonRes, testSummaryRes, fileChangesRes] = await Promise.all([
        axios.get(`/code-metrics/project/${projectId}/comparison?_t=${cacheBuster}`),
        axios.get(`/code-metrics/project/${projectId}/test-summary?_t=${cacheBuster}`),
        axios.get(`/code-metrics/project/${projectId}/file-changes?_t=${cacheBuster}`),
      ]);
      setAnalysisComparison(comparisonRes.data);
      setTestSummary(testSummaryRes.data);
      setFileChanges(fileChangesRes.data);
    } catch (err: any) {
      // Silently fail for supplementary data
    }
  }, [projectId]);

  const fetchRecentAnalyses = useCallback(async () => {
    if (!projectId) return;

    try {
      setRecentAnalysesLoading(true);
      const cacheBuster = Date.now();

      const response = await axios.get(
        `/code-metrics/project/${projectId}/recent-analyses?limit=7&_t=${cacheBuster}`
      );

      setRecentAnalyses(response.data.analyses || []);
      setRecentAnalysesError(null);
    } catch (err: any) {
      console.error('Failed to fetch recent analyses:', err);
      setRecentAnalysesError(err.response?.data?.message || 'Failed to load recent analyses');
      // Keep existing data on error (graceful degradation)
    } finally {
      setRecentAnalysesLoading(false);
    }
  }, [projectId]);

  const refetch = useCallback(async () => {
    await fetchMainMetrics();
    await fetchComparisonAndTests();
    await fetchRecentAnalyses();
  }, [fetchMainMetrics, fetchComparisonAndTests, fetchRecentAnalyses]);

  useEffect(() => {
    fetchMainMetrics();
    fetchComparisonAndTests();
    fetchRecentAnalyses();
  }, [fetchMainMetrics, fetchComparisonAndTests, fetchRecentAnalyses]);

  return {
    projectMetrics,
    hotspots,
    folderHierarchy,
    folderStats,
    coverageGaps,
    codeIssues,
    analysisComparison,
    testSummary,
    fileChanges,
    trendData,
    recentAnalyses,
    recentAnalysesLoading,
    recentAnalysesError,
    loading,
    error,
    refetch,
    refetchRecentAnalyses: fetchRecentAnalyses,
  };
}
