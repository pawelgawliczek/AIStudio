import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../lib/axios';
import { storiesService } from '../services/stories.service';
import { StoryType } from '../types';

interface HealthScore {
  overallScore: number;
  coverage: number;
  complexity: number;
  techDebtRatio: number;
  trend: 'improving' | 'stable' | 'declining';
  weeklyChange: number;
}

interface ProjectMetrics {
  healthScore: HealthScore;
  totalLoc: number;
  locByLanguage: Record<string, number>;
  securityIssues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastUpdate: Date;
}

interface FileHotspot {
  filePath: string;
  riskScore: number;
  complexity: number;
  churnCount: number;
  coverage: number;
  loc: number;
  lastModified: Date;
  lastStoryKey?: string;
  criticalIssues: number;
}

interface CodeIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  count: number;
  filesAffected: number;
  sampleFiles: string[];
}

interface FileDetail {
  filePath: string;
  language: string;
  riskScore: number;
  loc: number;
  complexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  coverage: number;
  churnCount: number;
  linesChanged: number;
  churnRate: number;
  lastModified: Date;
  recentChanges: Array<{
    storyKey: string;
    date: Date;
    linesChanged: number;
  }>;
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    line?: number;
    message: string;
  }>;
  importedBy: string[];
  imports: string[];
  couplingScore: 'low' | 'medium' | 'high';
}

interface FolderMetrics {
  fileCount: number;
  totalLoc: number;
  avgComplexity: number;
  avgCognitiveComplexity: number;
  avgMaintainability: number;
  avgCoverage: number;
  avgRiskScore: number;
  uncoveredFiles: number;
  criticalIssues: number;
  healthScore: number;
}

interface FolderNode {
  path: string;
  name: string;
  type: 'folder' | 'file';
  metrics: FolderMetrics;
  children?: FolderNode[];
}

interface CoverageGap {
  filePath: string;
  loc: number;
  complexity: number;
  riskScore: number;
  coverage: number;
  priority: number;
  reason: string;
}

interface AnalysisStatus {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface AnalysisComparison {
  healthScoreChange: number;
  newTests: number;
  coverageChange: number;
  complexityChange: number;
  newFiles: number;
  deletedFiles: number;
  qualityImprovement: boolean;
  lastAnalysis?: Date;
}

interface TestSummary {
  totalTests: number;
  passing: number;
  failing: number;
  skipped: number;
  lastExecution?: Date;
}

type DrillDownLevel = 'project' | 'file';

const CodeQualityDashboard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics | null>(null);
  const [hotspots, setHotspots] = useState<FileHotspot[]>([]);
  const [folderHierarchy, setFolderHierarchy] = useState<FolderNode | null>(null);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [codeIssues, setCodeIssues] = useState<CodeIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel>('project');
  const [selectedFile, setSelectedFile] = useState<FileDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());

  // Story modal state
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [storyModalData, setStoryModalData] = useState<{
    title: string;
    description: string;
    type: StoryType;
    technicalComplexity: number;
    businessComplexity: number;
  } | null>(null);

  const [filters, setFilters] = useState({
    timeRange: 30,
  });

  // New state for analysis status, comparison, and test summary
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [analysisComparison, setAnalysisComparison] = useState<AnalysisComparison | null>(null);
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null);
  const [showAnalysisNotification, setShowAnalysisNotification] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);

  // Story creation state
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [storyContext, setStoryContext] = useState<{
    type: 'file' | 'issue';
    data: any;
  } | null>(null);
  const [storyTitle, setStoryTitle] = useState('');
  const [storyDescription, setStoryDescription] = useState('');
  const [creatingStory, setCreatingStory] = useState(false);

  useEffect(() => {
    fetchMetrics();
    fetchComparisonAndTests();
  }, [projectId, filters]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      const [projectRes, hotspotsRes, hierarchyRes, coverageGapsRes, issuesRes] = await Promise.all([
        axios.get(`/code-metrics/project/${projectId}?timeRangeDays=${filters.timeRange}`),
        axios.get(`/code-metrics/project/${projectId}/hotspots?limit=50`),
        axios.get(`/code-metrics/project/${projectId}/hierarchy`),
        axios.get(`/code-metrics/project/${projectId}/coverage-gaps?limit=20`),
        axios.get(`/code-metrics/project/${projectId}/issues`),
      ]);

      setProjectMetrics(projectRes.data);
      setHotspots(hotspotsRes.data);
      setFolderHierarchy(hierarchyRes.data);
      setCoverageGaps(coverageGapsRes.data);
      setCodeIssues(issuesRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load code quality metrics');
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComparisonAndTests = async () => {
    try {
      const [comparisonRes, testSummaryRes] = await Promise.all([
        axios.get(`/code-metrics/project/${projectId}/comparison`),
        axios.get(`/code-metrics/project/${projectId}/test-summary`),
      ]);
      setAnalysisComparison(comparisonRes.data);
      setTestSummary(testSummaryRes.data);
    } catch (err: any) {
      console.error('Failed to fetch comparison/test data:', err);
    }
  };

  const pollAnalysisStatus = async () => {
    try {
      const response = await axios.get(`/code-metrics/project/${projectId}/analysis-status`);
      setAnalysisStatus(response.data);

      if (response.data.status === 'completed') {
        setShowAnalysisNotification(true);
        setIsAnalyzing(false);
        // Fetch updated metrics and comparison
        await fetchMetrics();
        await fetchComparisonAndTests();
        return true; // Stop polling
      } else if (response.data.status === 'failed') {
        setShowAnalysisNotification(true);
        setIsAnalyzing(false);
        return true; // Stop polling
      }
      return false; // Continue polling
    } catch (error: any) {
      console.error('Failed to check analysis status:', error);
      return false;
    }
  };

  const handleRefreshAnalysis = async () => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setShowAnalysisNotification(false);

    try {
      const response = await axios.post(`/code-metrics/project/${projectId}/analyze`, {});
      setAnalysisJobId(response.data.jobId);

      setAnalysisStatus({
        status: 'running',
        message: 'Code analysis started...',
      });

      // Start polling for status every 3 seconds
      const pollInterval = setInterval(async () => {
        const shouldStop = await pollAnalysisStatus();
        if (shouldStop) {
          clearInterval(pollInterval);
        }
      }, 3000);

      // Stop polling after 5 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isAnalyzing) {
          setIsAnalyzing(false);
          setAnalysisStatus({
            status: 'failed',
            message: 'Analysis timed out',
          });
          setShowAnalysisNotification(true);
        }
      }, 5 * 60 * 1000);

    } catch (error: any) {
      console.error('Failed to trigger analysis:', error);
      setIsAnalyzing(false);
      setAnalysisStatus({
        status: 'failed',
        message: error.response?.data?.message || error.message,
      });
      setShowAnalysisNotification(true);
    }
  };

  const handleFileClick = async (filePath: string) => {
    try {
      setLoadingDetail(true);

      const response = await axios.get(`/code-metrics/file/${projectId}?filePath=${encodeURIComponent(filePath)}`);

      setSelectedFile(response.data);
      setDrillDownLevel('file');
    } catch (err: any) {
      console.error('Failed to fetch file detail:', err);
      alert('Failed to load file details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleBackClick = () => {
    if (drillDownLevel === 'file') {
      setDrillDownLevel('project');
      setSelectedFile(null);
    }
  };

  const handleCreateStoryForFile = (file: FileHotspot) => {
    const title = `Refactor high-risk file: ${file.filePath.split('/').pop()}`;
    const description = `## File Hotspot Analysis\n\n` +
      `**File:** \`${file.filePath}\`\n` +
      `**Risk Score:** ${file.riskScore}/100\n` +
      `**Complexity:** ${file.complexity}\n` +
      `**Churn Count:** ${file.churnCount}\n` +
      `**Coverage:** ${file.coverage}%\n` +
      `**LOC:** ${file.loc}\n` +
      `**Critical Issues:** ${file.criticalIssues}\n\n` +
      `### Identified Problems:\n` +
      `- ${file.complexity > 20 ? '🔴 Very high complexity - needs significant refactoring' : file.complexity > 10 ? '⚠️ High complexity - consider breaking into smaller functions' : '✓ Complexity is acceptable'}\n` +
      `- ${file.churnCount > 5 ? '🔴 Very high churn rate - unstable code' : file.churnCount > 3 ? '⚠️ High churn rate - needs stabilization' : '✓ Churn rate is acceptable'}\n` +
      `- ${file.coverage < 50 ? '🔴 Critical: Very low test coverage' : file.coverage < 70 ? '⚠️ Low test coverage' : '✓ Test coverage is acceptable'}\n\n` +
      `### Refactoring Goals:\n` +
      `- [ ] Reduce complexity to < 10\n` +
      `- [ ] Add comprehensive unit tests (target: ${file.coverage < 50 ? '70' : '80'}%+ coverage)\n` +
      `- [ ] ${file.criticalIssues > 0 ? `Fix ${file.criticalIssues} critical issue(s)` : 'No critical issues'}\n` +
      `- [ ] Reduce risk score to < 50`;

    setStoryTitle(title);
    setStoryDescription(description);
    setStoryContext({ type: 'file', data: file });
    setIsStoryModalOpen(true);
  };

  const handleCreateStoryForIssue = (issue: CodeIssue) => {
    const title = `Fix ${issue.severity} ${issue.type.toLowerCase()}`;
    const description = `## Code Issue Report\n\n` +
      `**Severity:** ${issue.severity.toUpperCase()}\n` +
      `**Issue Type:** ${issue.type}\n` +
      `**Occurrences:** ${issue.count}\n` +
      `**Files Affected:** ${issue.filesAffected}\n\n` +
      `${issue.sampleFiles.length > 0 ? `### Sample Files:\n${issue.sampleFiles.map(f => `- \`${f}\``).join('\n')}\n\n` : ''}` +
      `### Tasks:\n` +
      `- [ ] Review all affected files\n` +
      `- [ ] Fix or refactor the ${issue.count} occurrence(s)\n` +
      `- [ ] Add tests to prevent regression\n` +
      `- [ ] Update documentation if needed\n\n` +
      `### Acceptance Criteria:\n` +
      `- [ ] All occurrences resolved\n` +
      `- [ ] No new issues introduced\n` +
      `- [ ] Tests passing`;

    setStoryTitle(title);
    setStoryDescription(description);
    setStoryContext({ type: 'issue', data: issue });
    setIsStoryModalOpen(true);
  };

  const handleSaveStory = async () => {
    if (!storyTitle.trim()) {
      alert('Please enter a story title');
      return;
    }

    try {
      setCreatingStory(true);
      await storiesService.create({
        projectId: projectId!,
        title: storyTitle,
        description: storyDescription,
        type: StoryType.CHORE,
      });

      alert('Story created successfully!');
      setIsStoryModalOpen(false);
      setStoryTitle('');
      setStoryDescription('');
      setStoryContext(null);

      navigate(`/projects/${projectId}/planning`);
    } catch (error: any) {
      console.error('Failed to create story:', error);
      alert(`Failed to create story: ${error.message}`);
    } finally {
      setCreatingStory(false);
    }
  };

  const getHealthColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getHealthIcon = (score: number): string => {
    if (score >= 80) return '✓';
    if (score >= 60) return '⚠️';
    return '🔴';
  };

  const getSeverityIcon = (severity: string): string => {
    if (severity === 'critical') return '🔴';
    if (severity === 'high') return '⚠️';
    if (severity === 'medium') return '⚠️';
    return 'ℹ️';
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  // Extract all files from hierarchy
  const getAllFiles = (node: FolderNode): FolderNode[] => {
    const files: FolderNode[] = [];

    if (node.type === 'file') {
      files.push(node);
    } else if (node.children) {
      for (const child of node.children) {
        files.push(...getAllFiles(child));
      }
    }

    return files;
  };

  // Get files without any coverage
  const getFilesWithoutCoverage = (): FolderNode[] => {
    if (!folderHierarchy) return [];
    const allFiles = getAllFiles(folderHierarchy);
    return allFiles.filter(file => file.metrics.avgCoverage === 0);
  };

  // Get files with low coverage (>0% but <80%)
  const getFilesWithCoverageGaps = (): FolderNode[] => {
    if (!folderHierarchy) return [];
    const allFiles = getAllFiles(folderHierarchy);
    return allFiles
      .filter(file => file.metrics.avgCoverage > 0 && file.metrics.avgCoverage < 80)
      .sort((a, b) => a.metrics.avgCoverage - b.metrics.avgCoverage);
  };

  const handleCreateStoryForFolder = (node: FolderNode) => {
    const isFile = node.type === 'file';
    const title = isFile
      ? `Refactor: ${node.name}`
      : `Improve code quality in ${node.path || 'root'}`;

    const description = isFile
      ? `## File Analysis\n\n` +
        `**File:** \`${node.path}\`\n` +
        `**Lines of Code:** ${node.metrics.totalLoc.toLocaleString()}\n` +
        `**Complexity:** ${node.metrics.avgComplexity.toFixed(1)}\n` +
        `**Coverage:** ${node.metrics.avgCoverage.toFixed(1)}%\n` +
        `**Health Score:** ${node.metrics.healthScore}/100\n\n` +
        `### Issues to Address\n` +
        (node.metrics.avgCoverage < 70 ? `- Low test coverage (${node.metrics.avgCoverage.toFixed(1)}%)\n` : '') +
        (node.metrics.avgComplexity > 10 ? `- High complexity (${node.metrics.avgComplexity.toFixed(1)})\n` : '') +
        (node.metrics.healthScore < 70 ? `- Poor health score (${node.metrics.healthScore}/100)\n` : '')
      : `## Folder Analysis\n\n` +
        `**Path:** \`${node.path || 'root'}\`\n` +
        `**Total Files:** ${node.metrics.fileCount}\n` +
        `**Total Lines of Code:** ${node.metrics.totalLoc.toLocaleString()}\n` +
        `**Average Complexity:** ${node.metrics.avgComplexity.toFixed(1)}\n` +
        `**Average Coverage:** ${node.metrics.avgCoverage.toFixed(1)}%\n` +
        `**Uncovered Files:** ${node.metrics.uncoveredFiles}\n` +
        `**Health Score:** ${node.metrics.healthScore}/100\n\n` +
        `### Recommended Actions\n` +
        (node.metrics.uncoveredFiles > 0 ? `- Add tests for ${node.metrics.uncoveredFiles} uncovered files\n` : '') +
        (node.metrics.avgComplexity > 10 ? `- Refactor complex code (avg complexity: ${node.metrics.avgComplexity.toFixed(1)})\n` : '') +
        (node.metrics.healthScore < 70 ? `- Improve overall code quality (health score: ${node.metrics.healthScore}/100)\n` : '');

    setStoryModalData({
      title,
      description,
      type: StoryType.CHORE,
      technicalComplexity: Math.min(Math.ceil(node.metrics.avgComplexity / 3), 5),
      businessComplexity: 3,
    });
    setShowStoryModal(true);
  };

  const renderFolderTree = (node: FolderNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const isFile = node.type === 'file';
    const hasChildren = node.children && node.children.length > 0;

    const healthColor = node.metrics.healthScore >= 70 ? 'text-green-600' :
                       node.metrics.healthScore >= 40 ? 'text-yellow-600' : 'text-red-600';

    return (
      <div key={node.path} className="border-l border-border">
        <div
          className={`flex items-center gap-4 py-2 px-3 hover:bg-bg-secondary ${isFile ? 'font-normal' : 'font-medium'}`}
        >
          {/* Expand/Collapse icon + Name */}
          <div
            className="flex items-center gap-2 flex-1 cursor-pointer"
            style={{ paddingLeft: `${depth * 20}px` }}
            onClick={() => isFile ? handleFileClick(node.path) : toggleFolder(node.path)}
          >
            {!isFile && hasChildren && (
              <span className="text-muted w-4">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {!isFile && !hasChildren && <span className="w-4"></span>}
            {isFile && <span className="text-muted w-4">📄</span>}

            <span className={`${isFile ? 'text-accent hover:text-accent-dark' : 'text-fg'}`}>
              {!isFile && '📁 '}{node.name}
            </span>
          </div>

          {/* Metrics with fixed widths matching header */}
          <div className="flex items-center gap-4 text-sm">
            <span className={`w-16 text-center ${healthColor}`} title="Health Score">
              {node.metrics.healthScore}
            </span>
            <span className="w-20 text-center text-muted" title="File Count">
              {node.metrics.fileCount}
            </span>
            <span className="w-24 text-center text-muted" title="Lines of Code">
              {node.metrics.totalLoc.toLocaleString()}
            </span>
            <span className={`w-20 text-center ${node.metrics.avgComplexity > 15 ? 'text-red-600' : node.metrics.avgComplexity > 10 ? 'text-yellow-600' : 'text-green-600'}`} title="Complexity">
              {node.metrics.avgComplexity.toFixed(1)}
            </span>
            <span className={`w-20 text-center ${node.metrics.avgCoverage < 50 ? 'text-red-600' : node.metrics.avgCoverage < 70 ? 'text-yellow-600' : 'text-green-600'}`} title="Coverage">
              {node.metrics.avgCoverage.toFixed(1)}%
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateStoryForFolder(node);
              }}
              className="w-16 text-center px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
              title="Create story for this item"
            >
              + Story
            </button>
          </div>
        </div>

        {/* Render children if expanded */}
        {!isFile && isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderFolderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading && !projectMetrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-muted">Loading metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  if (!projectMetrics) return null;

  return (
    <div className="min-h-screen bg-bg p-6">
      {/* Analysis Status Notification */}
      {(isAnalyzing || showAnalysisNotification) && analysisStatus && (
        <div className={`mb-6 p-4 rounded-lg border ${
          analysisStatus.status === 'completed' ? 'bg-green-50 border-green-200' :
          analysisStatus.status === 'failed' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isAnalyzing && <span className="inline-block animate-spin text-xl">⟳</span>}
              {analysisStatus.status === 'completed' && <span className="text-xl">✓</span>}
              {analysisStatus.status === 'failed' && <span className="text-xl">✗</span>}
              <div>
                <div className="font-medium">
                  {analysisStatus.status === 'completed' ? 'Analysis Completed' :
                   analysisStatus.status === 'failed' ? 'Analysis Failed' :
                   'Analysis Running...'}
                </div>
                <div className="text-sm text-muted">{analysisStatus.message}</div>
              </div>
            </div>
            {showAnalysisNotification && (
              <button
                onClick={() => setShowAnalysisNotification(false)}
                className="text-muted hover:text-fg"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-fg">Code Quality Dashboard</h1>
          <p className="text-muted mt-2">
            Last updated: {new Date(projectMetrics.lastUpdate).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleRefreshAnalysis}
          disabled={isAnalyzing}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent ${
            isAnalyzing
              ? 'bg-gray-400 text-fg cursor-not-allowed'
              : 'bg-accent text-white hover:bg-accent-dark'
          }`}
        >
          {isAnalyzing ? (
            <>
              <span className="inline-block animate-spin mr-2">⟳</span>
              Analyzing...
            </>
          ) : (
            <>🔄 Refresh Analysis</>
          )}
        </button>
      </div>

      {/* Analysis Comparison (Changes Since Last Analysis) */}
      {analysisComparison && analysisComparison.lastAnalysis && (
        <div className="mb-6 bg-card border border-border rounded-lg shadow-md p-4">
          <h3 className="text-sm font-medium text-fg mb-3">Changes Since Last Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${analysisComparison.healthScoreChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analysisComparison.healthScoreChange >= 0 ? '+' : ''}{analysisComparison.healthScoreChange}
              </div>
              <div className="text-xs text-muted">Health Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{analysisComparison.newTests > 0 ? '+' : ''}{analysisComparison.newTests}</div>
              <div className="text-xs text-muted">New Tests</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${analysisComparison.coverageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analysisComparison.coverageChange >= 0 ? '+' : ''}{analysisComparison.coverageChange}%
              </div>
              <div className="text-xs text-muted">Coverage</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${analysisComparison.complexityChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analysisComparison.complexityChange >= 0 ? '+' : ''}{analysisComparison.complexityChange}
              </div>
              <div className="text-xs text-muted">Complexity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{analysisComparison.newFiles > 0 ? '+' : ''}{analysisComparison.newFiles}</div>
              <div className="text-xs text-muted">New Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{analysisComparison.deletedFiles > 0 ? '-' : ''}{analysisComparison.deletedFiles}</div>
              <div className="text-xs text-muted">Deleted Files</div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <button
          onClick={() => { setDrillDownLevel('project'); setSelectedFile(null); }}
          className={`hover:text-accent ${drillDownLevel === 'project' ? 'text-accent font-bold' : 'text-muted'}`}
        >
          Project
        </button>
        {selectedFile && (
          <>
            <span className="text-muted">/</span>
            <span className="text-accent font-bold">{selectedFile.filePath.split('/').pop()}</span>
          </>
        )}
        {drillDownLevel !== 'project' && (
          <button
            onClick={handleBackClick}
            className="ml-4 text-accent hover:text-accent-dark text-sm font-medium"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-fg mb-1">Time Range</label>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters({ ...filters, timeRange: Number(e.target.value) })}
              className="border border-border rounded-md px-3 py-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Project-Level Metrics */}
      {drillDownLevel === 'project' && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-fg mb-4">Project-Level Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Health */}
          <div className="bg-card border border-border rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-muted mb-2">OVERALL CODE HEALTH</h3>
            <div className="text-4xl font-bold text-fg mb-2">
              {projectMetrics.healthScore.overallScore}/100
            </div>
            <div className="w-full bg-bg-secondary rounded-full h-2 mb-2">
              <div
                className="bg-accent h-2 rounded-full"
                style={{ width: `${projectMetrics.healthScore.overallScore}%` }}
              />
            </div>
            <div className={`inline-block px-2 py-1 rounded text-sm font-medium ${getHealthColor(projectMetrics.healthScore.overallScore)}`}>
              {getHealthIcon(projectMetrics.healthScore.overallScore)} {projectMetrics.healthScore.overallScore >= 80 ? 'GOOD' : projectMetrics.healthScore.overallScore >= 60 ? 'MODERATE' : 'POOR'}
            </div>
            <div className="mt-2 text-sm text-green-600">
              ↑ +{projectMetrics.healthScore.weeklyChange} (this week)
            </div>
          </div>

          {/* Total LOC */}
          <div className="bg-card border border-border rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-muted mb-2">TOTAL LINES OF CODE</h3>
            <div className="text-4xl font-bold text-fg mb-4">
              {projectMetrics.totalLoc.toLocaleString()} LOC
            </div>
            <div className="space-y-1">
              {Object.entries(projectMetrics.locByLanguage).map(([lang, loc]) => (
                <div key={lang} className="text-sm text-muted">
                  {lang}: {loc.toLocaleString()}
                </div>
              ))}
            </div>
          </div>

          {/* Test Coverage */}
          <div className="bg-card border border-border rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-muted mb-2">TEST COVERAGE</h3>
            <div className="text-4xl font-bold text-fg mb-2">
              {projectMetrics.healthScore.coverage}%
            </div>
            <div className="w-full bg-bg-secondary rounded-full h-2 mb-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${projectMetrics.healthScore.coverage}%` }}
              />
            </div>
            <div className={`inline-block px-2 py-1 rounded text-sm font-medium ${getHealthColor(projectMetrics.healthScore.coverage)}`}>
              {getHealthIcon(projectMetrics.healthScore.coverage)} {projectMetrics.healthScore.coverage >= 80 ? 'GOOD' : 'NEEDS IMPROVEMENT'}
            </div>
          </div>

          {/* Tech Debt */}
          <div className="bg-card border border-border rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-muted mb-2">TECHNICAL DEBT RATIO</h3>
            <div className="text-4xl font-bold text-fg mb-2">
              {projectMetrics.healthScore.techDebtRatio}%
            </div>
            <div className="w-full bg-bg-secondary rounded-full h-2 mb-2">
              <div
                className="bg-yellow-600 h-2 rounded-full"
                style={{ width: `${projectMetrics.healthScore.techDebtRatio}%` }}
              />
            </div>
            <div className="text-sm text-muted">
              {projectMetrics.healthScore.techDebtRatio < 10 ? 'ACCEPTABLE' : 'NEEDS ATTENTION'}
            </div>
          </div>

          {/* Complexity */}
          <div className="bg-card border border-border rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-muted mb-2">CODE COMPLEXITY</h3>
            <div className="text-4xl font-bold text-fg mb-2">
              Avg: {projectMetrics.healthScore.complexity}
            </div>
            <div className="text-sm text-muted">
              {projectMetrics.healthScore.complexity < 10 ? 'MODERATE' : 'HIGH'}
            </div>
          </div>

          {/* Security Issues */}
          <div className="bg-card border border-border rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-muted mb-2">SECURITY ISSUES</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-fg">
                <span>🔴 Critical:</span>
                <span className="font-bold">{projectMetrics.securityIssues.critical}</span>
              </div>
              <div className="flex justify-between text-sm text-fg">
                <span>⚠️ High:</span>
                <span className="font-bold">{projectMetrics.securityIssues.high}</span>
              </div>
              <div className="flex justify-between text-sm text-fg">
                <span>⚠️ Medium:</span>
                <span className="font-bold">{projectMetrics.securityIssues.medium}</span>
              </div>
              <div className="flex justify-between text-sm text-fg">
                <span>ℹ️ Low:</span>
                <span className="font-bold">{projectMetrics.securityIssues.low}</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Hierarchical Folder View */}
      {drillDownLevel === 'project' && folderHierarchy && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-fg mb-4">
            Code Structure & Metrics (Hierarchical View)
          </h2>
          <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="bg-bg-secondary px-3 py-3 flex items-center gap-4 text-xs font-medium text-muted uppercase">
              <span className="flex-1">Path</span>
              <span className="w-16 text-center">Health</span>
              <span className="w-20 text-center">Files</span>
              <span className="w-24 text-center">LOC</span>
              <span className="w-20 text-center">Complex</span>
              <span className="w-20 text-center">Cover</span>
              <span className="w-16 text-center">Actions</span>
            </div>
            {/* Tree */}
            <div className="max-h-[600px] overflow-y-auto">
              {folderHierarchy.children && folderHierarchy.children.map(child => renderFolderTree(child, 0))}
            </div>
          </div>
        </div>
      )}

      {/* Test Coverage Management */}
      {drillDownLevel === 'project' && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-fg mb-4">
            Test Coverage Management
          </h2>

          {/* Coverage Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg shadow-sm p-4">
              <div className="text-sm text-muted mb-1">Overall Coverage</div>
              <div className={`text-3xl font-bold ${(folderHierarchy?.metrics.avgCoverage || 0) >= 80 ? 'text-green-600' : (folderHierarchy?.metrics.avgCoverage || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {(folderHierarchy?.metrics.avgCoverage || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-muted mt-1">
                Target: 80%
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-sm p-4">
              <div className="text-sm text-muted mb-1">Files Without Tests</div>
              <div className="text-3xl font-bold text-red-600">
                {folderHierarchy?.metrics.uncoveredFiles || 0}
              </div>
              <div className="text-xs text-muted mt-1">
                {folderHierarchy && folderHierarchy.metrics.fileCount > 0 ? Math.round((folderHierarchy.metrics.uncoveredFiles / folderHierarchy.metrics.fileCount) * 100) : 0}% of total files
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-sm p-4">
              <div className="text-sm text-muted mb-1">Coverage Gaps</div>
              <div className="text-3xl font-bold text-yellow-600">
                {coverageGaps.length}
              </div>
              <div className="text-xs text-muted mt-1">
                Files needing attention
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-sm p-4">
              <div className="text-sm text-muted mb-1">Well Tested</div>
              <div className="text-3xl font-bold text-green-600">
                {folderHierarchy ? Math.max(0, folderHierarchy.metrics.fileCount - folderHierarchy.metrics.uncoveredFiles - coverageGaps.length) : 0}
              </div>
              <div className="text-xs text-muted mt-1">
                Files with good coverage
              </div>
            </div>
          </div>

          {/* Test Execution Summary */}
          {testSummary && (
            <div className="bg-card border border-border rounded-lg shadow-md p-4 mb-6">
              <h3 className="text-sm font-medium text-fg mb-3">Test Execution Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-accent">{testSummary.totalTests}</div>
                  <div className="text-xs text-muted">Total Tests</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{testSummary.passing}</div>
                  <div className="text-xs text-muted">Passing</div>
                  <div className="text-xs text-green-600 mt-1">
                    {testSummary.totalTests > 0 ? Math.round((testSummary.passing / testSummary.totalTests) * 100) : 0}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{testSummary.failing}</div>
                  <div className="text-xs text-muted">Failing</div>
                  <div className="text-xs text-red-600 mt-1">
                    {testSummary.totalTests > 0 ? Math.round((testSummary.failing / testSummary.totalTests) * 100) : 0}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">{testSummary.skipped}</div>
                  <div className="text-xs text-muted">Skipped</div>
                  <div className="text-xs text-yellow-600 mt-1">
                    {testSummary.totalTests > 0 ? Math.round((testSummary.skipped / testSummary.totalTests) * 100) : 0}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted mb-1">Last Execution</div>
                  <div className="text-xs text-fg">
                    {testSummary.lastExecution ? new Date(testSummary.lastExecution).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Coverage Gaps Table */}
          {coverageGaps.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-fg mb-3">
                Priority Files Needing Tests
              </h3>
              <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Priority</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">File</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Risk</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Complex</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">LOC</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Coverage</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {coverageGaps.map((gap, index) => (
                      <tr
                        key={gap.filePath}
                        className="hover:bg-bg transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-1 rounded text-sm font-bold ${gap.priority >= 90 ? 'bg-red-100 text-red-700' : gap.priority >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-accent'}`}>
                            {gap.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 cursor-pointer" onClick={() => handleFileClick(gap.filePath)}>
                          <div className="font-medium text-sm text-accent hover:text-accent-dark">{gap.filePath.split('/').pop()}</div>
                          <div className="text-xs text-muted truncate max-w-xs">{gap.filePath}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={gap.riskScore >= 70 ? 'text-red-600' : gap.riskScore >= 50 ? 'text-yellow-600' : 'text-green-600'}>
                            {gap.riskScore}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={gap.complexity > 15 ? 'text-red-600' : gap.complexity > 10 ? 'text-yellow-600' : 'text-green-600'}>
                            {gap.complexity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted">
                          {gap.loc.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={gap.coverage < 30 ? 'text-red-600' : gap.coverage < 50 ? 'text-yellow-600' : 'text-green-600'}>
                            {gap.coverage}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">
                          {gap.reason}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStoryModalData({
                                title: `Add tests for ${gap.filePath.split('/').pop()}`,
                                description: `## Test Coverage Gap\n\n` +
                                  `**File:** \`${gap.filePath}\`\n` +
                                  `**Current Coverage:** ${gap.coverage}%\n` +
                                  `**Lines of Code:** ${gap.loc.toLocaleString()}\n` +
                                  `**Complexity:** ${gap.complexity}\n` +
                                  `**Risk Score:** ${gap.riskScore}/100\n` +
                                  `**Priority:** ${gap.priority}/100\n\n` +
                                  `### Why This Needs Tests\n${gap.reason}\n\n` +
                                  `### Testing Strategy\n` +
                                  `- Write unit tests for core functionality\n` +
                                  (gap.complexity > 10 ? `- Add tests for complex logic paths\n` : '') +
                                  (gap.riskScore > 70 ? `- Prioritize critical/high-risk code paths\n` : '') +
                                  `- Aim for at least 80% coverage\n` +
                                  `- Test edge cases and error handling`,
                                type: StoryType.CHORE,
                                technicalComplexity: Math.min(Math.ceil(gap.complexity / 4), 5),
                                businessComplexity: Math.min(Math.ceil(gap.riskScore / 25), 5),
                              });
                              setShowStoryModal(true);
                            }}
                            className="px-3 py-1 text-xs font-medium text-white bg-accent hover:bg-accent-dark rounded transition-colors"
                          >
                            📝 Create Test Story
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Coverage by Folder */}
          {folderHierarchy && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-fg mb-3">
                Coverage by Folder
              </h3>
              <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Folder</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Files</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Coverage</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Untested Files</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Health</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {folderHierarchy.children?.map((folder) => (
                      <tr key={folder.path} className="hover:bg-bg transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span>📁</span>
                            <div>
                              <div className="font-medium text-sm text-fg">{folder.name}</div>
                              <div className="text-xs text-muted">{folder.path}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted">
                          {folder.metrics.fileCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-bg-secondary rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${folder.metrics.avgCoverage >= 80 ? 'bg-green-600' : folder.metrics.avgCoverage >= 60 ? 'bg-yellow-600' : 'bg-red-600'}`}
                                style={{ width: `${folder.metrics.avgCoverage}%` }}
                              ></div>
                            </div>
                            <span className={`font-medium ${folder.metrics.avgCoverage >= 80 ? 'text-green-600' : folder.metrics.avgCoverage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {folder.metrics.avgCoverage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={folder.metrics.uncoveredFiles > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                            {folder.metrics.uncoveredFiles}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-medium ${folder.metrics.healthScore >= 70 ? 'text-green-600' : folder.metrics.healthScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {folder.metrics.healthScore}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {folder.metrics.avgCoverage >= 80 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Good
                            </span>
                          ) : folder.metrics.avgCoverage >= 60 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              ⚠ Needs Work
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ✗ Critical
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Files Without Coverage (0%) */}
          {folderHierarchy && getFilesWithoutCoverage().length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-fg mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                  {getFilesWithoutCoverage().length}
                </span>
                Files Without Any Tests (0% Coverage)
              </h3>
              <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">File</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">LOC</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Complexity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Health</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {getFilesWithoutCoverage().map((file) => (
                      <tr key={file.path} className="hover:bg-bg transition-colors">
                        <td className="px-6 py-4 cursor-pointer" onClick={() => handleFileClick(file.path)}>
                          <div className="flex items-center gap-2">
                            <span>📄</span>
                            <div>
                              <div className="font-medium text-sm text-accent hover:text-accent-dark">{file.name}</div>
                              <div className="text-xs text-muted truncate max-w-md">{file.path}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted">
                          {file.metrics.totalLoc.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={file.metrics.avgComplexity > 15 ? 'text-red-600' : file.metrics.avgComplexity > 10 ? 'text-yellow-600' : 'text-green-600'}>
                            {file.metrics.avgComplexity.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-medium ${file.metrics.healthScore >= 70 ? 'text-green-600' : file.metrics.healthScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {file.metrics.healthScore}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateStoryForFolder(file);
                            }}
                            className="px-3 py-1 text-xs font-medium text-white bg-accent hover:bg-accent-dark rounded transition-colors"
                          >
                            📝 Add Tests
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Files With Coverage Gaps (>0% but <80%) */}
          {folderHierarchy && getFilesWithCoverageGaps().length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-fg mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 text-xs font-bold">
                  {getFilesWithCoverageGaps().length}
                </span>
                Files With Coverage Gaps (0% - 80% Coverage)
              </h3>
              <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">File</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Coverage</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">LOC</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Complexity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Health</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {getFilesWithCoverageGaps().map((file) => (
                      <tr key={file.path} className="hover:bg-bg transition-colors">
                        <td className="px-6 py-4 cursor-pointer" onClick={() => handleFileClick(file.path)}>
                          <div className="flex items-center gap-2">
                            <span>📄</span>
                            <div>
                              <div className="font-medium text-sm text-accent hover:text-accent-dark">{file.name}</div>
                              <div className="text-xs text-muted truncate max-w-md">{file.path}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-bg-secondary rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${file.metrics.avgCoverage >= 60 ? 'bg-yellow-600' : 'bg-red-600'}`}
                                style={{ width: `${file.metrics.avgCoverage}%` }}
                              ></div>
                            </div>
                            <span className={`font-medium ${file.metrics.avgCoverage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {file.metrics.avgCoverage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted">
                          {file.metrics.totalLoc.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={file.metrics.avgComplexity > 15 ? 'text-red-600' : file.metrics.avgComplexity > 10 ? 'text-yellow-600' : 'text-green-600'}>
                            {file.metrics.avgComplexity.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-medium ${file.metrics.healthScore >= 70 ? 'text-green-600' : file.metrics.healthScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {file.metrics.healthScore}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateStoryForFolder(file);
                            }}
                            className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                          >
                            📝 Improve Coverage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Detail View */}
      {drillDownLevel === 'file' && selectedFile && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-fg mb-4">File Details</h2>

          {/* File Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg shadow-md p-4">
              <h3 className="text-sm font-medium text-muted mb-2">RISK SCORE</h3>
              <div className="text-2xl font-bold text-fg">{selectedFile.riskScore}/100</div>
              <div className={`text-sm ${selectedFile.riskScore >= 70 ? 'text-red-600' : selectedFile.riskScore >= 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                {selectedFile.riskScore >= 70 ? 'HIGH RISK' : selectedFile.riskScore >= 50 ? 'MEDIUM RISK' : 'LOW RISK'}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-md p-4">
              <h3 className="text-sm font-medium text-muted mb-2">COMPLEXITY</h3>
              <div className="text-2xl font-bold text-fg">{selectedFile.complexity}</div>
              <div className="text-sm text-muted">Cognitive: {selectedFile.cognitiveComplexity}</div>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-md p-4">
              <h3 className="text-sm font-medium text-muted mb-2">COVERAGE</h3>
              <div className="text-2xl font-bold text-fg">{selectedFile.coverage}%</div>
              <div className={`text-sm ${selectedFile.coverage < 70 ? 'text-red-600' : 'text-green-600'}`}>
                {selectedFile.coverage < 70 ? 'NEEDS IMPROVEMENT' : 'GOOD'}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-md p-4">
              <h3 className="text-sm font-medium text-muted mb-2">CHURN RATE</h3>
              <div className="text-2xl font-bold text-fg">{selectedFile.churnRate}%</div>
              <div className="text-sm text-muted">{selectedFile.churnCount} changes</div>
            </div>
          </div>

          {/* File Info */}
          <div className="bg-card border border-border rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-md font-bold text-fg mb-4">File Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted">Path:</span>
                <span className="ml-2 text-fg font-mono text-sm">{selectedFile.filePath}</span>
              </div>
              <div>
                <span className="text-muted">Language:</span>
                <span className="ml-2 text-fg">{selectedFile.language}</span>
              </div>
              <div>
                <span className="text-muted">Lines of Code:</span>
                <span className="ml-2 text-fg">{selectedFile.loc.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted">Maintainability Index:</span>
                <span className="ml-2 text-fg">{selectedFile.maintainabilityIndex}/100</span>
              </div>
              <div>
                <span className="text-muted">Coupling:</span>
                <span className={`ml-2 ${selectedFile.couplingScore === 'high' ? 'text-red-600' : selectedFile.couplingScore === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                  {selectedFile.couplingScore.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-muted">Last Modified:</span>
                <span className="ml-2 text-fg">{new Date(selectedFile.lastModified).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Recent Changes */}
          {selectedFile.recentChanges && selectedFile.recentChanges.length > 0 && (
            <div className="bg-card border border-border rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-md font-bold text-fg mb-4">Recent Changes</h3>
              <div className="space-y-2">
                {selectedFile.recentChanges.map((change, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-fg">{change.storyKey}</span>
                    <span className="text-muted">{new Date(change.date).toLocaleDateString()}</span>
                    <span className="text-fg">{change.linesChanged} lines changed</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code Issues */}
          {selectedFile.issues && selectedFile.issues.length > 0 && (
            <div className="bg-card border border-border rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-md font-bold text-fg mb-4">Code Issues</h3>
              <div className="space-y-3">
                {selectedFile.issues.map((issue, idx) => (
                  <div key={idx} className="border-l-4 border-red-500 pl-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${issue.severity === 'critical' ? 'text-red-600' : issue.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="text-sm text-muted">{issue.type}</span>
                      {issue.line && <span className="text-xs text-muted">Line {issue.line}</span>}
                    </div>
                    <p className="text-sm text-fg mt-1">{issue.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-card border border-border rounded-lg shadow-md p-6">
              <h3 className="text-md font-bold text-fg mb-4">Imports ({selectedFile.imports.length})</h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {selectedFile.imports.slice(0, 10).map((imp, idx) => (
                  <div key={idx} className="text-sm text-muted font-mono">{imp}</div>
                ))}
                {selectedFile.imports.length > 10 && (
                  <div className="text-sm text-muted italic">... and {selectedFile.imports.length - 10} more</div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-md p-6">
              <h3 className="text-md font-bold text-fg mb-4">Imported By ({selectedFile.importedBy.length})</h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {selectedFile.importedBy.slice(0, 10).map((imp, idx) => (
                  <div key={idx} className="text-sm text-muted font-mono">{imp}</div>
                ))}
                {selectedFile.importedBy.length > 10 && (
                  <div className="text-sm text-muted italic">... and {selectedFile.importedBy.length - 10} more</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Issues */}
      {drillDownLevel === 'project' && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-fg mb-4">Code Smells & Issues</h2>
        <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-bg-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Files Affected</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {codeIssues.map((issue, index) => {
                const isExpanded = expandedIssues.has(index);
                return (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-bg cursor-pointer" onClick={() => {
                      const newExpanded = new Set(expandedIssues);
                      if (isExpanded) {
                        newExpanded.delete(index);
                      } else {
                        newExpanded.add(index);
                      }
                      setExpandedIssues(newExpanded);
                    }}>
                      <td className="px-6 py-4 whitespace-nowrap text-fg">
                        {getSeverityIcon(issue.severity)} {issue.severity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-fg">
                        <span className="flex items-center gap-2">
                          {isExpanded ? '▼' : '▶'}
                          {issue.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-fg">{issue.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-fg">{issue.filesAffected} files</td>
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleCreateStoryForIssue(issue)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          Create Story
                        </button>
                      </td>
                    </tr>
                    {isExpanded && issue.sampleFiles.length > 0 && (
                      <tr className="bg-bg-secondary">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-medium text-fg mb-2">Affected Files (showing {issue.sampleFiles.length} sample{issue.sampleFiles.length > 1 ? 's' : ''}):</p>
                            <ul className="list-disc list-inside space-y-1 text-muted">
                              {issue.sampleFiles.map((file, fileIndex) => (
                                <li key={fileIndex} className="font-mono text-xs">{file}</li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Story Creation Modal */}
      {isStoryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-fg mb-4">Create Story from Code Quality Issue</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-fg mb-2">Title</label>
              <input
                type="text"
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-fg bg-bg"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-fg mb-2">Description</label>
              <textarea
                value={storyDescription}
                onChange={(e) => setStoryDescription(e.target.value)}
                rows={15}
                className="w-full border border-border rounded-md px-3 py-2 text-fg bg-bg font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsStoryModalOpen(false);
                  setStoryTitle('');
                  setStoryDescription('');
                  setStoryContext(null);
                }}
                className="px-4 py-2 border border-border rounded-md text-fg hover:bg-muted"
                disabled={creatingStory}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStory}
                className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-dark"
                disabled={creatingStory}
              >
                {creatingStory ? 'Creating...' : 'Create Story'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeQualityDashboard;
