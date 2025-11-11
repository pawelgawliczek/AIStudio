import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { storiesService } from '../services/stories.service';

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

interface LayerMetrics {
  layer: string;
  loc: number;
  locPercentage: number;
  healthScore: number;
  avgComplexity: number;
  churnLevel: 'low' | 'medium' | 'high';
  coverage: number;
  defectCount: number;
}

interface ComponentMetrics {
  name: string;
  layer: string;
  fileCount: number;
  healthScore: number;
  avgComplexity: number;
  churnLevel: 'low' | 'medium' | 'high';
  coverage: number;
  hotspotCount: number;
}

interface FileHotspot {
  filePath: string;
  component: string;
  layer: string;
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
  component: string;
  layer: string;
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

type DrillDownLevel = 'project' | 'layer' | 'component' | 'file';

const CodeQualityDashboard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics | null>(null);
  const [layerMetrics, setLayerMetrics] = useState<LayerMetrics[]>([]);
  const [componentMetrics, setComponentMetrics] = useState<ComponentMetrics[]>([]);
  const [hotspots, setHotspots] = useState<FileHotspot[]>([]);
  const [codeIssues, setCodeIssues] = useState<CodeIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel>('project');
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [filters, setFilters] = useState({
    timeRange: 30,
    layer: '',
    component: '',
  });

  // Story creation state
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [storyContext, setStoryContext] = useState<{
    type: 'component' | 'file' | 'issue';
    data: any;
  } | null>(null);
  const [storyTitle, setStoryTitle] = useState('');
  const [storyDescription, setStoryDescription] = useState('');
  const [creatingStory, setCreatingStory] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, [projectId, filters]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [projectRes, layersRes, componentsRes, hotspotsRes, issuesRes] = await Promise.all([
        axios.get(`/api/code-metrics/project/${projectId}?timeRangeDays=${filters.timeRange}`, config),
        axios.get(`/api/code-metrics/project/${projectId}/layers?timeRangeDays=${filters.timeRange}`, config),
        axios.get(`/api/code-metrics/project/${projectId}/components?timeRangeDays=${filters.timeRange}`, config),
        axios.get(`/api/code-metrics/project/${projectId}/hotspots?limit=10`, config),
        axios.get(`/api/code-metrics/project/${projectId}/issues`, config),
      ]);

      setProjectMetrics(projectRes.data);
      setLayerMetrics(layersRes.data);
      setComponentMetrics(componentsRes.data);
      setHotspots(hotspotsRes.data);
      setCodeIssues(issuesRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load code quality metrics');
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAnalysis = async () => {
    if (isAnalyzing) return; // Prevent double-clicks

    setIsAnalyzing(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        `/api/code-metrics/project/${projectId}/analyze`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert(`Analysis started! Job ID: ${response.data.jobId}\n${response.data.message}`);

      // Optionally refresh metrics after a delay to show updated data
      setTimeout(() => {
        fetchMetrics();
      }, 5000);

    } catch (error: any) {
      console.error('Failed to trigger analysis:', error);
      alert(`Failed to start analysis: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Drill-down handlers
  const handleLayerClick = (layerName: string) => {
    setSelectedLayer(layerName);
    setDrillDownLevel('layer');
    setSelectedComponent(null);
    setSelectedFile(null);
  };

  const handleComponentClick = (componentName: string) => {
    setSelectedComponent(componentName);
    setDrillDownLevel('component');
    setSelectedFile(null);
  };

  const handleFileClick = async (filePath: string) => {
    try {
      setLoadingDetail(true);
      const token = localStorage.getItem('accessToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.get(
        `/api/code-metrics/file/${projectId}?filePath=${encodeURIComponent(filePath)}`,
        config
      );

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
      setDrillDownLevel('component');
      setSelectedFile(null);
    } else if (drillDownLevel === 'component') {
      setDrillDownLevel('layer');
      setSelectedComponent(null);
    } else if (drillDownLevel === 'layer') {
      setDrillDownLevel('project');
      setSelectedLayer(null);
    }
  };

  // Story creation handlers
  const handleCreateStoryForComponent = (component: ComponentMetrics) => {
    const title = `Improve code quality in ${component.name} component`;
    const description = `## Component Health Issues\n\n` +
      `**Component:** ${component.name}\n` +
      `**Layer:** ${component.layer}\n` +
      `**Health Score:** ${component.healthScore}/100\n` +
      `**Complexity:** ${component.avgComplexity}\n` +
      `**Coverage:** ${component.coverage}%\n` +
      `**Hotspots:** ${component.hotspotCount}\n` +
      `**Files:** ${component.fileCount}\n\n` +
      `### Recommendations:\n` +
      `- ${component.avgComplexity > 15 ? '⚠️ Reduce complexity by refactoring complex functions' : '✓ Complexity is acceptable'}\n` +
      `- ${component.coverage < 70 ? '⚠️ Increase test coverage to at least 70%' : component.coverage < 80 ? '⚠️ Increase test coverage to 80%' : '✓ Test coverage is good'}\n` +
      `- ${component.hotspotCount > 0 ? `⚠️ Address ${component.hotspotCount} high-risk file(s)` : '✓ No high-risk files detected'}\n\n` +
      `### Acceptance Criteria:\n` +
      `- [ ] Health score improved to at least ${Math.min(component.healthScore + 20, 80)}/100\n` +
      `- [ ] All functions have complexity < 15\n` +
      `- [ ] Test coverage >= ${component.coverage < 70 ? '70' : '80'}%\n` +
      `- [ ] No high-risk hotspots remaining`;

    setStoryTitle(title);
    setStoryDescription(description);
    setStoryContext({ type: 'component', data: component });
    setIsStoryModalOpen(true);
  };

  const handleCreateStoryForFile = (file: FileHotspot) => {
    const title = `Refactor high-risk file: ${file.filePath.split('/').pop()}`;
    const description = `## File Hotspot Analysis\n\n` +
      `**File:** \`${file.filePath}\`\n` +
      `**Component:** ${file.component}\n` +
      `**Layer:** ${file.layer}\n` +
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
      `### Description:\n` +
      `${issue.type === 'Security Vulnerabilities' ? 'Security vulnerabilities have been detected that could expose the application to attacks.' : ''}` +
      `${issue.type === 'Bug Risks' ? 'Code patterns that are likely to cause bugs have been identified.' : ''}` +
      `${issue.type === 'Performance Issues' ? 'Performance bottlenecks have been detected that could impact user experience.' : ''}` +
      `${issue.type === 'Code Duplication' ? 'Duplicate code has been found that should be refactored into reusable components.' : ''}` +
      `${issue.type === 'Maintainability Issues' ? 'Code maintainability problems have been identified.' : ''}` +
      `${issue.type === 'Code Style Issues' ? 'Code style inconsistencies have been detected.' : ''}\n\n` +
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
      await storiesService.createStory({
        projectId: projectId!,
        title: storyTitle,
        description: storyDescription,
        type: 'chore', // Code quality improvements are chores
        status: 'planning',
      });

      alert('Story created successfully!');
      setIsStoryModalOpen(false);
      setStoryTitle('');
      setStoryDescription('');
      setStoryContext(null);

      // Optionally navigate to the story or refresh
      navigate(`/projects/${projectId}/planning`);
    } catch (error: any) {
      console.error('Failed to create story:', error);
      alert(`Failed to create story: ${error.message}`);
    } finally {
      setCreatingStory(false);
    }
  };

  // Get filtered data based on drill-down level
  const getFilteredComponents = () => {
    if (!selectedLayer) return componentMetrics;
    return componentMetrics.filter(c => c.layer === selectedLayer);
  };

  const getFilteredFiles = () => {
    if (!selectedComponent) return hotspots;
    return hotspots.filter(f => f.component === selectedComponent);
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

  const getChurnIcon = (level: string): string => {
    if (level === 'low') return '✓';
    if (level === 'medium') return '⚠️';
    return '🔴';
  };

  const getSeverityIcon = (severity: string): string => {
    if (severity === 'critical') return '🔴';
    if (severity === 'high') return '⚠️';
    if (severity === 'medium') return '⚠️';
    return 'ℹ️';
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
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
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

      {/* Breadcrumbs */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <button
          onClick={() => { setDrillDownLevel('project'); setSelectedLayer(null); setSelectedComponent(null); setSelectedFile(null); }}
          className={`hover:text-accent ${drillDownLevel === 'project' ? 'text-accent font-bold' : 'text-muted'}`}
        >
          Project
        </button>
        {selectedLayer && (
          <>
            <span className="text-muted">/</span>
            <button
              onClick={() => { setDrillDownLevel('layer'); setSelectedComponent(null); setSelectedFile(null); }}
              className={`hover:text-accent ${drillDownLevel === 'layer' ? 'text-accent font-bold' : 'text-muted'}`}
            >
              {selectedLayer}
            </button>
          </>
        )}
        {selectedComponent && (
          <>
            <span className="text-muted">/</span>
            <button
              onClick={() => { setDrillDownLevel('component'); setSelectedFile(null); }}
              className={`hover:text-accent ${drillDownLevel === 'component' ? 'text-accent font-bold' : 'text-muted'}`}
            >
              {selectedComponent}
            </button>
          </>
        )}
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

      {/* Layer Metrics */}
      {drillDownLevel === 'project' && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-fg mb-4">Layer-Level Metrics (Click to drill down)</h2>
          <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Layer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">LOC</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Health</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Complexity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Churn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Coverage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Defects</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {layerMetrics.map((layer) => (
                  <tr
                    key={layer.layer}
                    onClick={() => handleLayerClick(layer.layer)}
                    className="hover:bg-bg cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-accent hover:text-accent-dark">{layer.layer}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg">
                      {layer.loc.toLocaleString()} ({layer.locPercentage}%)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded text-sm ${getHealthColor(layer.healthScore)}`}>
                        {layer.healthScore}/100
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg">{layer.avgComplexity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg">
                      {getChurnIcon(layer.churnLevel)} {layer.churnLevel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg">{layer.coverage}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg">{layer.defectCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Component Metrics */}
      {drillDownLevel === 'layer' && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-fg mb-4">
            {selectedLayer ? `Components in ${selectedLayer} Layer` : 'Component-Level Metrics'} (Click to drill down)
          </h2>
          <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Component</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Health</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Complexity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Churn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Coverage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Hotspots</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {getFilteredComponents().slice(0, 20).map((component) => (
                  <tr
                    key={component.name}
                    className="hover:bg-bg transition-colors"
                  >
                    <td
                      className="px-6 py-4 whitespace-nowrap cursor-pointer"
                      onClick={() => handleComponentClick(component.name)}
                    >
                      <div className="font-medium text-accent hover:text-accent-dark">{component.name}</div>
                      <div className="text-sm text-muted">🏷️ {component.layer} • {component.fileCount} files</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => handleComponentClick(component.name)}>
                      <span className={`inline-block px-2 py-1 rounded text-sm ${getHealthColor(component.healthScore)}`}>
                        {component.healthScore}/100
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg cursor-pointer" onClick={() => handleComponentClick(component.name)}>{component.avgComplexity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg cursor-pointer" onClick={() => handleComponentClick(component.name)}>
                      {getChurnIcon(component.churnLevel)} {component.churnLevel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg cursor-pointer" onClick={() => handleComponentClick(component.name)}>{component.coverage}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-fg cursor-pointer" onClick={() => handleComponentClick(component.name)}>
                      {component.hotspotCount > 0 ? `🔥`.repeat(Math.min(component.hotspotCount, 3)) : '─'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateStoryForComponent(component);
                        }}
                        className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                      >
                        📝 Create Story
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hotspots / Files */}
      {(drillDownLevel === 'component' || drillDownLevel === 'project') && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-fg mb-4">
            {selectedComponent ? `Files in ${selectedComponent} Component` : 'File-Level Hotspots (Top 20 by Risk)'} (Click to view details)
          </h2>
          <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">File</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Risk</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Complex</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Churn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Cover</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {getFilteredFiles().slice(0, 20).map((hotspot, index) => (
                  <tr
                    key={hotspot.filePath}
                    onClick={() => handleFileClick(hotspot.filePath)}
                    className="hover:bg-bg cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-fg">
                      {hotspot.riskScore >= 80 ? '🔥' : '⚠️'} {index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-sm text-accent hover:text-accent-dark">{hotspot.filePath.split('/').pop()}</div>
                      <div className="text-xs text-muted">{hotspot.component}</div>
                      <div className="text-xs text-muted">
                        {hotspot.loc} LOC | Last: {hotspot.lastStoryKey || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded text-sm ${getHealthColor(100 - hotspot.riskScore)}`}>
                        {hotspot.riskScore}/100
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={hotspot.complexity > 15 ? 'text-red-600' : hotspot.complexity > 10 ? 'text-yellow-600' : 'text-green-600'}>
                        {hotspot.complexity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={hotspot.churnCount > 5 ? 'text-red-600' : hotspot.churnCount > 3 ? 'text-yellow-600' : 'text-green-600'}>
                        {hotspot.churnCount}×
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={hotspot.coverage < 70 ? 'text-red-600' : hotspot.coverage < 80 ? 'text-yellow-600' : 'text-green-600'}>
                        {hotspot.coverage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <span className="text-muted">Component:</span>
                <span className="ml-2 text-fg">{selectedFile.component}</span>
              </div>
              <div>
                <span className="text-muted">Layer:</span>
                <span className="ml-2 text-fg">{selectedFile.layer}</span>
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
              {codeIssues.map((issue, index) => (
                <tr key={index} className="hover:bg-bg">
                  <td className="px-6 py-4 whitespace-nowrap text-fg">
                    {getSeverityIcon(issue.severity)} {issue.severity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-fg">{issue.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-fg">{issue.count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-fg">{issue.filesAffected} files</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="text-accent hover:text-accent-dark text-sm font-medium mr-2">
                      View All
                    </button>
                    {issue.severity === 'critical' || issue.severity === 'high' ? (
                      <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                        Create Item
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
};

export default CodeQualityDashboard;
