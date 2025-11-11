import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

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

  const [filters, setFilters] = useState({
    timeRange: 30,
    layer: '',
    component: '',
  });

  useEffect(() => {
    fetchMetrics();
  }, [projectId, filters]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-fg">Code Quality Dashboard</h1>
        <p className="text-muted mt-2">
          Last updated: {new Date(projectMetrics.lastUpdate).toLocaleString()}
        </p>
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

      {/* Layer Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-fg mb-4">Layer-Level Metrics</h2>
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
                <tr key={layer.layer} className="hover:bg-bg">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-fg">{layer.layer}</td>
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

      {/* Component Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-fg mb-4">Component-Level Metrics</h2>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {componentMetrics.slice(0, 10).map((component) => (
                <tr key={component.name} className="hover:bg-bg">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-fg">{component.name}</div>
                    <div className="text-sm text-muted">🏷️ {component.layer} • {component.fileCount} files</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-block px-2 py-1 rounded text-sm ${getHealthColor(component.healthScore)}`}>
                      {component.healthScore}/100
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-fg">{component.avgComplexity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-fg">
                    {getChurnIcon(component.churnLevel)} {component.churnLevel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-fg">{component.coverage}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-fg">
                    {component.hotspotCount > 0 ? `🔥`.repeat(Math.min(component.hotspotCount, 3)) : '─'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="text-accent hover:text-accent-dark text-sm font-medium">
                      Drill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hotspots */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-fg mb-4">File-Level Hotspots (Top 10 by Risk)</h2>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {hotspots.slice(0, 10).map((hotspot, index) => (
                <tr key={hotspot.filePath} className="hover:bg-bg">
                  <td className="px-6 py-4 whitespace-nowrap text-fg">
                    {hotspot.riskScore >= 80 ? '🔥' : '⚠️'} {index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm text-fg">{hotspot.filePath.split('/').pop()}</div>
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
                  <td className="px-6 py-4 whitespace-nowrap space-x-2">
                    <button className="text-accent hover:text-accent-dark text-sm font-medium">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Issues */}
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
                        Create Story
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CodeQualityDashboard;
