import React, { useState } from 'react';
import { Disclosure, Transition } from '@headlessui/react';
import {
  ChevronDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface RiskFactor {
  name: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  weight: number;
}

interface Issue {
  id: string;
  category: 'coverage' | 'complexity' | 'performance' | 'security' | 'completeness';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  dismissed?: boolean;
}

interface BreakingChange {
  type: 'schema' | 'api' | 'dependency' | 'config';
  description: string;
  migration?: string;
}

interface PerformanceImpact {
  metric: string;
  before: string;
  after: string;
  delta: string;
  status: 'improved' | 'acceptable' | 'warning' | 'critical';
}

interface ConcernsGapsPanelProps {
  riskScore: number;
  riskFactors?: RiskFactor[];
  issues?: Issue[];
  implementationCoverage?: number;
  uncoveredCriteria?: string[];
  breakingChanges?: BreakingChange[];
  performanceImpacts?: PerformanceImpact[];
  onDismissIssue?: (issueId: string) => void;
}

function getRiskLevel(score: number): { label: string; color: string } {
  if (score <= 30) return { label: 'LOW', color: 'text-green-600' };
  if (score <= 60) return { label: 'MEDIUM', color: 'text-yellow-600' };
  if (score <= 80) return { label: 'HIGH', color: 'text-orange-600' };
  return { label: 'CRITICAL', color: 'text-red-600' };
}

function RiskGauge({ score }: { score: number }) {
  const risk = getRiskLevel(score);
  const gradientColors = 'from-green-500 via-yellow-500 via-orange-500 to-red-500';

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={clsx('h-full bg-gradient-to-r rounded-full transition-all', gradientColors)}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <span className={clsx('text-2xl font-bold', risk.color)}>{score}</span>
        <span className="text-sm text-muted">/100</span>
        <p className={clsx('text-xs font-medium', risk.color)}>{risk.label}</p>
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <ArrowTrendingUpIcon className="h-4 w-4 text-red-500" />;
  if (trend === 'down') return <ArrowTrendingDownIcon className="h-4 w-4 text-green-500" />;
  return <MinusIcon className="h-4 w-4 text-gray-400" />;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  critical: { bg: 'bg-red-500/10', border: 'border-l-4 border-l-red-500', icon: '\uD83D\uDD34' },
  high: { bg: 'bg-orange-500/10', border: 'border-l-4 border-l-orange-500', icon: '\uD83D\uDFE0' },
  medium: { bg: 'bg-yellow-500/10', border: 'border-l-4 border-l-yellow-500', icon: '\uD83D\uDFE1' },
  low: { bg: 'bg-green-500/10', border: 'border-l-4 border-l-green-500', icon: '\uD83D\uDFE2' },
};

const CATEGORY_LABELS: Record<string, string> = {
  coverage: 'Coverage Gap',
  complexity: 'Complexity',
  performance: 'Performance',
  security: 'Security',
  completeness: 'Completeness',
};

export function ConcernsGapsPanel({
  riskScore,
  riskFactors = [],
  issues = [],
  implementationCoverage,
  uncoveredCriteria = [],
  breakingChanges = [],
  performanceImpacts = [],
  onDismissIssue,
}: ConcernsGapsPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const activeIssues = issues.filter((i) => !i.dismissed && !dismissedIds.has(i.id));
  const criticalCount = activeIssues.filter((i) => i.severity === 'critical').length;

  const handleDismiss = (issueId: string) => {
    setDismissedIds((prev) => new Set([...prev, issueId]));
    onDismissIssue?.(issueId);
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-md">
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex justify-between items-center w-full p-6 text-left">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-fg">Concerns & Gaps</h2>
                {criticalCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/20">
                    <ExclamationTriangleIcon className="h-3 w-3" />
                    {criticalCount} critical
                  </span>
                )}
              </div>
              <ChevronDownIcon
                className={clsx('h-5 w-5 text-muted transition-transform', open && 'rotate-180')}
              />
            </Disclosure.Button>

            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <Disclosure.Panel className="px-6 pb-6 space-y-6">
                {/* Risk Score */}
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-3">Risk Score</h3>
                  <RiskGauge score={riskScore} />
                </div>

                {/* Risk Factors Breakdown */}
                {riskFactors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-fg mb-3">Risk Breakdown</h3>
                    <div className="space-y-2">
                      {riskFactors.map((factor, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-bg-secondary rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-fg">{factor.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-fg">{factor.score}/100</span>
                            <TrendIcon trend={factor.trend} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issues & Suggestions */}
                {activeIssues.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-fg mb-3">
                      Issues & Suggestions ({activeIssues.length})
                    </h3>
                    <div className="space-y-3">
                      {activeIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className={clsx(
                            'p-4 rounded-lg',
                            SEVERITY_STYLES[issue.severity].bg,
                            SEVERITY_STYLES[issue.severity].border
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <span>{SEVERITY_STYLES[issue.severity].icon}</span>
                              <div>
                                <p className="text-sm font-medium text-fg">
                                  <span className="uppercase text-xs text-muted">
                                    {CATEGORY_LABELS[issue.category]}:
                                  </span>{' '}
                                  {issue.message}
                                </p>
                                <p className="text-xs text-muted mt-1">
                                  Suggestion: {issue.suggestion}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDismiss(issue.id)}
                              className="p-1 text-muted hover:text-fg rounded"
                              title="Dismiss"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Implementation Coverage */}
                {implementationCoverage !== undefined && (
                  <div>
                    <h3 className="text-sm font-semibold text-fg mb-3">
                      Implementation Coverage: {implementationCoverage}%
                    </h3>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                      <div
                        className={clsx(
                          'h-full rounded-full',
                          implementationCoverage >= 80 ? 'bg-green-500' :
                          implementationCoverage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${implementationCoverage}%` }}
                      />
                    </div>
                    {uncoveredCriteria.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted">Uncovered Criteria:</p>
                        {uncoveredCriteria.map((criteria, idx) => (
                          <p key={idx} className="text-sm text-fg pl-4">
                            - {criteria}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Breaking Changes */}
                <div>
                  <h3 className="text-sm font-semibold text-fg mb-3">Breaking Changes</h3>
                  {breakingChanges.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-green-600">No breaking changes detected</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {breakingChanges.map((change, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-red-500/10 border-l-4 border-l-red-500 rounded-lg"
                        >
                          <p className="text-sm font-medium text-fg">
                            <span className="uppercase text-xs text-muted">{change.type}:</span>{' '}
                            {change.description}
                          </p>
                          {change.migration && (
                            <p className="text-xs text-muted mt-1">
                              Migration: {change.migration}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Performance Impact */}
                {performanceImpacts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-fg mb-3">Performance Impact</h3>
                    <div className="space-y-2">
                      {performanceImpacts.map((impact, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg"
                        >
                          <span className="text-sm text-fg">{impact.metric}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted">
                              {impact.before} → {impact.after}
                            </span>
                            <span
                              className={clsx(
                                'text-xs font-medium px-2 py-0.5 rounded',
                                impact.status === 'improved' && 'bg-green-500/10 text-green-600',
                                impact.status === 'acceptable' && 'bg-blue-500/10 text-blue-600',
                                impact.status === 'warning' && 'bg-yellow-500/10 text-yellow-600',
                                impact.status === 'critical' && 'bg-red-500/10 text-red-600'
                              )}
                            >
                              {impact.delta}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Disclosure.Panel>
            </Transition>
          </>
        )}
      </Disclosure>
    </div>
  );
}
