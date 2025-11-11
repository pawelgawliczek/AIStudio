import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { testCasesService } from '../services/test-cases.service';
import { testExecutionsService } from '../services/test-executions.service';
import type {
  UseCaseCoverage,
  TestCase,
  TestExecution,
  TestLevel,
  TestExecutionStatus,
  CoverageGap,
} from '../types';

export const TestCaseCoverageDashboard = () => {
  const { useCaseId } = useParams<{ useCaseId: string }>();
  const navigate = useNavigate();
  const [coverage, setCoverage] = useState<UseCaseCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (useCaseId) {
      loadCoverage();
    }
  }, [useCaseId]);

  const loadCoverage = async () => {
    if (!useCaseId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await testCasesService.getUseCaseCoverage(useCaseId);
      setCoverage(data);
    } catch (err: any) {
      console.error('Error loading coverage:', err);
      setError(err.response?.data?.message || 'Failed to load coverage data');
    } finally {
      setLoading(false);
    }
  };

  const toggleTestExpand = (testCaseId: string) => {
    setExpandedTests((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(testCaseId)) {
        newSet.delete(testCaseId);
      } else {
        newSet.add(testCaseId);
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

  const getStatusBadge = (status: TestExecutionStatus) => {
    const badges = {
      pass: 'bg-green-500/10 text-green-600 border border-green-500/20',
      fail: 'bg-red-500/10 text-red-600 border border-red-500/20',
      skip: 'bg-muted/10 text-fg border border-border',
      error: 'bg-red-500/10 text-red-600 border border-red-500/20',
    };
    return badges[status] || 'bg-muted/10 text-fg border border-border';
  };

  const getSeverityColor = (severity: CoverageGap['severity']) => {
    const colors = {
      critical: 'border-red-500 bg-red-50',
      high: 'border-orange-500 bg-orange-50',
      medium: 'border-yellow-500 bg-yellow-50',
      low: 'border-accent bg-accent/5',
    };
    return colors[severity];
  };

  const getSeverityIcon = (severity: CoverageGap['severity']) => {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: 'ℹ️',
    };
    return icons[severity];
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTestsByLevel = (level: TestLevel) => {
    return coverage?.testCases.filter((tc) => tc.testLevel === level) || [];
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
          onClick={loadCoverage}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!coverage) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 m-4">
        <p className="text-muted">No coverage data available</p>
      </div>
    );
  }

  const { useCase, coverage: stats, testCases, coverageGaps } = coverage;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-accent hover:text-accent-dark mb-4 flex items-center transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-fg">
          {useCase.key}: {useCase.title}
        </h1>
        <p className="text-muted mt-1">Test Coverage Dashboard</p>
      </div>

      {/* Overall Coverage Card */}
      <div className="bg-card border border-border rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-fg mb-4">Overall Coverage</h2>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold text-fg">
              {stats.overall.toFixed(1)}%
            </span>
            <span
              className={`font-semibold ${
                stats.overall >= 80 ? 'text-green-600' : 'text-yellow-600'
              }`}
            >
              {stats.overall >= 80 ? '✓ MEETS TARGET (80%)' : '⚠️ BELOW TARGET (80%)'}
            </span>
          </div>
          <div className="w-full bg-border rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${getCoverageBgColor(
                stats.overall
              )}`}
              style={{ width: `${Math.min(stats.overall, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-muted">
          <div>
            <span className="font-medium">Total Test Cases:</span>{' '}
            {stats.totalTests} ({stats.implementedTests} implemented,{' '}
            {stats.pendingTests} pending)
          </div>
          <div>
            <span className="font-medium">Implementation Rate:</span>{' '}
            {stats.implementationRate.toFixed(1)}%
          </div>
        </div>

        {/* Coverage by Level */}
        <div className="mt-6 space-y-3">
          <h3 className="font-semibold text-fg">Coverage by Level:</h3>

          {/* Unit Tests */}
          <div className="flex items-center space-x-3">
            <span className="w-32 text-sm font-medium text-fg">Unit Tests:</span>
            <div className="flex-1">
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getCoverageBgColor(
                    stats.byLevel.unit.coverage
                  )}`}
                  style={{
                    width: `${Math.min(stats.byLevel.unit.coverage, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
            <span
              className={`w-16 text-right font-semibold ${getCoverageColor(
                stats.byLevel.unit.coverage
              )}`}
            >
              {stats.byLevel.unit.coverage.toFixed(0)}%
            </span>
            <span className="text-sm text-muted">
              ({stats.byLevel.unit.testCount} tests)
            </span>
          </div>

          {/* Integration Tests */}
          <div className="flex items-center space-x-3">
            <span className="w-32 text-sm font-medium text-fg">Integration Tests:</span>
            <div className="flex-1">
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getCoverageBgColor(
                    stats.byLevel.integration.coverage
                  )}`}
                  style={{
                    width: `${Math.min(stats.byLevel.integration.coverage, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
            <span
              className={`w-16 text-right font-semibold ${getCoverageColor(
                stats.byLevel.integration.coverage
              )}`}
            >
              {stats.byLevel.integration.coverage.toFixed(0)}%
            </span>
            <span className="text-sm text-muted">
              ({stats.byLevel.integration.testCount} tests)
            </span>
          </div>

          {/* E2E Tests */}
          <div className="flex items-center space-x-3">
            <span className="w-32 text-sm font-medium text-fg">E2E Tests:</span>
            <div className="flex-1">
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getCoverageBgColor(
                    stats.byLevel.e2e.coverage
                  )}`}
                  style={{
                    width: `${Math.min(stats.byLevel.e2e.coverage, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
            <span
              className={`w-16 text-right font-semibold ${getCoverageColor(
                stats.byLevel.e2e.coverage
              )}`}
            >
              {stats.byLevel.e2e.coverage.toFixed(0)}%
            </span>
            <span className="text-sm text-muted">
              ({stats.byLevel.e2e.testCount} tests)
            </span>
          </div>
        </div>
      </div>

      {/* Test Cases by Level */}
      {(['unit', 'integration', 'e2e'] as TestLevel[]).map((level) => {
        const tests = getTestsByLevel(level);
        if (tests.length === 0) return null;

        const levelStats = stats.byLevel[level];

        return (
          <div key={level} className="mb-6">
            <div className="bg-card border border-border rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-fg capitalize">
                  {level === 'e2e' ? 'E2E' : level} Tests ({tests.length} tests)
                </h2>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-muted">Coverage:</span>
                  <span
                    className={`font-semibold ${getCoverageColor(
                      levelStats.coverage
                    )}`}
                  >
                    {levelStats.coverage.toFixed(0)}%
                  </span>
                  <div className="w-32 bg-border rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getCoverageBgColor(
                        levelStats.coverage
                      )}`}
                      style={{
                        width: `${Math.min(levelStats.coverage, 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {tests.map((testCase) => {
                  const isExpanded = expandedTests.has(testCase.id);
                  const latestExec = testCase.latestExecution;

                  return (
                    <div
                      key={testCase.id}
                      className="border border-border rounded-lg p-4 hover:border-accent transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-fg">
                              {testCase.key}: {testCase.title}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                testCase.status === 'automated'
                                  ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                  : testCase.status === 'implemented'
                                  ? 'bg-accent/10 text-accent border border-accent/20'
                                  : 'bg-muted/10 text-fg border border-border'
                              }`}
                            >
                              {testCase.status}
                            </span>
                            <span className="text-xs text-muted">
                              Priority: {testCase.priority}
                            </span>
                          </div>

                          {testCase.description && (
                            <p className="text-sm text-muted mb-2">
                              {testCase.description}
                            </p>
                          )}

                          {testCase.testFilePath && (
                            <p className="text-xs text-muted mb-2">
                              📄 {testCase.testFilePath}
                            </p>
                          )}

                          {latestExec && (
                            <div className="flex items-center space-x-4 text-sm">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(
                                  latestExec.status
                                )}`}
                              >
                                {latestExec.status === 'pass' && '✓ '}
                                {latestExec.status === 'fail' && '✗ '}
                                {latestExec.status.toUpperCase()}
                              </span>
                              <span className="text-muted">
                                Last run: {formatDate(latestExec.executedAt)}
                              </span>
                              {latestExec.coveragePercentage !== null && (
                                <span className="text-muted">
                                  Coverage: {latestExec.coveragePercentage.toFixed(1)}%
                                </span>
                              )}
                              {latestExec.durationMs && (
                                <span className="text-muted">
                                  Duration: {formatDuration(latestExec.durationMs)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => toggleTestExpand(testCase.id)}
                          className="text-accent hover:text-accent-dark text-sm ml-4 transition-colors"
                        >
                          {isExpanded ? '▲ Collapse' : '▼ Expand'}
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3">
                          {testCase.preconditions && (
                            <div>
                              <h4 className="text-sm font-semibold text-fg mb-1">
                                Preconditions:
                              </h4>
                              <p className="text-sm text-muted whitespace-pre-wrap">
                                {testCase.preconditions}
                              </p>
                            </div>
                          )}

                          {testCase.testSteps && (
                            <div>
                              <h4 className="text-sm font-semibold text-fg mb-1">
                                Test Steps:
                              </h4>
                              <p className="text-sm text-muted whitespace-pre-wrap">
                                {testCase.testSteps}
                              </p>
                            </div>
                          )}

                          {testCase.expectedResults && (
                            <div>
                              <h4 className="text-sm font-semibold text-fg mb-1">
                                Expected Results:
                              </h4>
                              <p className="text-sm text-muted whitespace-pre-wrap">
                                {testCase.expectedResults}
                              </p>
                            </div>
                          )}

                          {latestExec?.errorMessage && (
                            <div>
                              <h4 className="text-sm font-semibold text-red-700 mb-1">
                                Error Message:
                              </h4>
                              <pre className="text-sm text-red-600 bg-red-50 p-2 rounded overflow-x-auto">
                                {latestExec.errorMessage}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Coverage Gaps */}
      {coverageGaps && coverageGaps.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-fg mb-4">Coverage Gaps</h2>
          <p className="text-muted mb-4">
            ⚠️ Areas not fully covered by tests:
          </p>

          <div className="space-y-4">
            {coverageGaps.map((gap, index) => (
              <div
                key={index}
                className={`border-l-4 p-4 rounded-r ${getSeverityColor(
                  gap.severity
                )}`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">{getSeverityIcon(gap.severity)}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-fg mb-1">
                      {gap.description}
                      {gap.level && (
                        <span className="ml-2 text-sm font-normal text-muted">
                          ({gap.level} test)
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-muted mb-2">
                      <span className="font-medium">Recommended:</span>{' '}
                      {gap.recommendation}
                    </p>
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                        gap.severity === 'critical'
                          ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                          : gap.severity === 'high'
                          ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                          : gap.severity === 'medium'
                          ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                          : 'bg-accent/10 text-accent border border-accent/20'
                      }`}
                    >
                      {gap.severity.toUpperCase()} PRIORITY
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCaseCoverageDashboard;
