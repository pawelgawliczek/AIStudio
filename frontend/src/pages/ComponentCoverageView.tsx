import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { testCasesService } from '../services/test-cases.service';
import type { ComponentCoverage } from '../types';

export const ComponentCoverageView = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [componentCoverages, setComponentCoverages] = useState<ComponentCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string>('');
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projectId) {
      loadComponentCoverage();
    }
  }, [projectId]);

  const loadComponentCoverage = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await testCasesService.getComponentCoverage(projectId);
      // Handle both array and wrapped response formats
      const coverages = Array.isArray(data) ? data : ((data as any)?.data || []);
      setComponentCoverages(coverages);
    } catch (err: any) {
      console.error('Error loading component coverage:', err);
      setError(err.response?.data?.message || 'Failed to load component coverage');
    } finally {
      setLoading(false);
    }
  };

  const toggleComponentExpand = (component: string) => {
    setExpandedComponents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(component)) {
        newSet.delete(component);
      } else {
        newSet.add(component);
      }
      return newSet;
    });
  };

  const getCoverageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getCoverageBgColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-green-600';
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusBadge = (
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor' | 'not_covered'
  ) => {
    const badges = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-green-100 text-green-700',
      needs_improvement: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-orange-100 text-orange-800',
      not_covered: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-secondary text-muted';
  };

  const getStatusLabel = (
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor' | 'not_covered'
  ) => {
    const labels = {
      excellent: '✓ Excellent',
      good: '✓ Good',
      needs_improvement: '⚠ Needs Improvement',
      poor: '⚠ Poor',
      not_covered: '✗ Not Covered',
    };
    return labels[status];
  };

  const calculateOverallStats = () => {
    if (componentCoverages.length === 0) return null;

    let fullyCovered = 0;
    let partiallyCovered = 0;
    let poorlyCovered = 0;
    let notCovered = 0;
    let totalOverall = 0;

    componentCoverages.forEach((comp) => {
      totalOverall += comp.coverage.overall;
      comp.useCases.forEach((uc) => {
        if (uc.status === 'excellent' || uc.status === 'good') {
          fullyCovered++;
        } else if (uc.status === 'needs_improvement') {
          partiallyCovered++;
        } else if (uc.status === 'poor') {
          poorlyCovered++;
        } else {
          notCovered++;
        }
      });
    });

    const avgOverall = totalOverall / componentCoverages.length;

    return {
      fullyCovered,
      partiallyCovered,
      poorlyCovered,
      notCovered,
      avgOverall,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Coverage</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadComponentCoverage}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const overallStats = calculateOverallStats();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-accent hover:text-accent-dark mb-4 flex items-center"
        >
          ← Back to Project
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-fg">Component Test Coverage</h1>
        <p className="text-muted mt-1">Coverage breakdown by component</p>
      </div>

      {/* Overall Summary */}
      {overallStats && (
        <div className="bg-card border border-border rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-fg mb-4">Project Summary</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {overallStats.fullyCovered}
              </div>
              <div className="text-sm text-muted">Fully Covered</div>
              <div className="text-xs text-muted">(&gt;80%)</div>
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">
                {overallStats.partiallyCovered}
              </div>
              <div className="text-sm text-muted">Needs Work</div>
              <div className="text-xs text-muted">(50-80%)</div>
            </div>

            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">
                {overallStats.poorlyCovered}
              </div>
              <div className="text-sm text-muted">Poorly Covered</div>
              <div className="text-xs text-muted">(&lt;50%)</div>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">
                {overallStats.notCovered}
              </div>
              <div className="text-sm text-muted">Not Covered</div>
              <div className="text-xs text-muted">(0%)</div>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold text-fg">
                Overall Project Coverage
              </span>
              <span
                className={`text-2xl font-bold ${getCoverageColor(
                  overallStats.avgOverall
                )}`}
              >
                {overallStats.avgOverall.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getCoverageBgColor(
                  overallStats.avgOverall
                )}`}
                style={{ width: `${Math.min(overallStats.avgOverall, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Components List */}
      <div className="space-y-4">
        {componentCoverages.map((componentCov) => {
          const isExpanded = expandedComponents.has(componentCov.component);
          const { component, coverage, useCases } = componentCov;

          return (
            <div
              key={component}
              className="bg-card border border-border rounded-lg shadow-md overflow-hidden"
            >
              {/* Component Header */}
              <div
                className="p-6 cursor-pointer hover:bg-secondary transition-colors"
                onClick={() => toggleComponentExpand(component)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-fg mb-2">
                      {component}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-muted">
                      <span>
                        {useCases.length} use case{useCases.length !== 1 ? 's' : ''}
                      </span>
                      <span>
                        {coverage.totalTests} test{coverage.totalTests !== 1 ? 's' : ''}
                      </span>
                      <span>
                        {coverage.implementedTests}/{coverage.totalTests} implemented
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div
                        className={`text-3xl font-bold ${getCoverageColor(
                          coverage.overall
                        )}`}
                      >
                        {coverage.overall.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted">Overall Coverage</div>
                    </div>

                    <button className="text-muted hover:text-fg">
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Coverage Bars */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center space-x-3">
                    <span className="w-24 text-xs text-muted">Unit:</span>
                    <div className="flex-1">
                      <div className="w-full bg-border rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getCoverageBgColor(
                            coverage.byLevel.unit.coverage
                          )}`}
                          style={{
                            width: `${Math.min(coverage.byLevel.unit.coverage, 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <span
                      className={`w-12 text-right text-xs font-semibold ${getCoverageColor(
                        coverage.byLevel.unit.coverage
                      )}`}
                    >
                      {coverage.byLevel.unit.coverage.toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="w-24 text-xs text-muted">Integration:</span>
                    <div className="flex-1">
                      <div className="w-full bg-border rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getCoverageBgColor(
                            coverage.byLevel.integration.coverage
                          )}`}
                          style={{
                            width: `${Math.min(
                              coverage.byLevel.integration.coverage,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <span
                      className={`w-12 text-right text-xs font-semibold ${getCoverageColor(
                        coverage.byLevel.integration.coverage
                      )}`}
                    >
                      {coverage.byLevel.integration.coverage.toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="w-24 text-xs text-muted">E2E:</span>
                    <div className="flex-1">
                      <div className="w-full bg-border rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getCoverageBgColor(
                            coverage.byLevel.e2e.coverage
                          )}`}
                          style={{
                            width: `${Math.min(coverage.byLevel.e2e.coverage, 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <span
                      className={`w-12 text-right text-xs font-semibold ${getCoverageColor(
                        coverage.byLevel.e2e.coverage
                      )}`}
                    >
                      {coverage.byLevel.e2e.coverage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Use Cases Details */}
              {isExpanded && (
                <div className="border-t border-border p-6">
                  <h4 className="font-semibold text-fg mb-4">
                    Use Case Coverage Breakdown
                  </h4>

                  <div className="space-y-3">
                    {useCases.map((ucCov) => (
                      <div
                        key={ucCov.useCase.id}
                        className="flex items-center justify-between p-3 border border-border rounded hover:border-accent cursor-pointer transition-colors"
                        onClick={() =>
                          navigate(`/test-coverage/use-case/${ucCov.useCase.id}`)
                        }
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <span className="font-medium text-fg">
                              {ucCov.useCase.key}
                            </span>
                            <span className="text-sm text-muted">
                              {ucCov.useCase.title}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-muted">
                            <span>
                              Unit: {ucCov.coverage.byLevel.unit.coverage.toFixed(0)}%
                            </span>
                            <span>
                              Integration:{' '}
                              {ucCov.coverage.byLevel.integration.coverage.toFixed(0)}%
                            </span>
                            <span>
                              E2E: {ucCov.coverage.byLevel.e2e.coverage.toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div
                              className={`text-lg font-bold ${getCoverageColor(
                                ucCov.coverage.overall
                              )}`}
                            >
                              {ucCov.coverage.overall.toFixed(0)}%
                            </div>
                            <div className="w-24 bg-border rounded-full h-2 mt-1">
                              <div
                                className={`h-2 rounded-full ${getCoverageBgColor(
                                  ucCov.coverage.overall
                                )}`}
                                style={{
                                  width: `${Math.min(ucCov.coverage.overall, 100)}%`,
                                }}
                              ></div>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center px-3 py-1 text-xs rounded-full font-medium ${getStatusBadge(
                              ucCov.status
                            )}`}
                          >
                            {getStatusLabel(ucCov.status)}
                          </span>

                          <span className="text-accent hover:text-accent-dark">→</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {componentCoverages.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted text-center">
              No component coverage data available for this project.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComponentCoverageView;
