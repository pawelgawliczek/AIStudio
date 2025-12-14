/**
 * Test Level Breakdown Component (ST-132)
 * Displays test execution statistics broken down by test level (unit/integration/e2e)
 */

import React from 'react';
import {
  BeakerIcon,
  LinkIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { TestLevelStats } from '../../services/test-execution.service';

// Icon mapping for test levels
const TestLevelIcons: Record<string, React.FC<{ className?: string }>> = {
  science: ({ className }) => <BeakerIcon className={className} />,
  link: ({ className }) => <LinkIcon className={className} />,
  language: ({ className }) => <GlobeAltIcon className={className} />,
  check_circle: ({ className }) => <CheckCircleIcon className={className} />,
  cancel: ({ className }) => <XCircleIcon className={className} />,
  schedule: ({ className }) => <ClockIcon className={className} />,
  play_arrow: ({ className }) => <PlayIcon className={className} />,
};

interface TestLevelBreakdownProps {
  summary: {
    unit: TestLevelStats;
    integration: TestLevelStats;
    e2e: TestLevelStats;
  };
  onRunTests?: (level: 'unit' | 'integration' | 'e2e') => void;
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
};

export const TestLevelBreakdown: React.FC<TestLevelBreakdownProps> = ({
  summary,
  onRunTests,
}) => {
  const renderTestCard = (
    level: 'unit' | 'integration' | 'e2e',
    stats: TestLevelStats,
    icon: string,
    color: string,
    bgColor: string,
    title: string
  ) => {
    const passRate =
      stats.total > 0
        ? Math.round((stats.passing / stats.total) * 100)
        : 0;

    const IconComponent = TestLevelIcons[icon];

    return (
      <div
        key={level}
        className="bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-lg p-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {IconComponent && <IconComponent className={`w-5 h-5 ${color}`} />}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          </div>
          <span className={`px-2 py-1 rounded ${bgColor} text-sm font-medium`}>
            {stats.total} tests
          </span>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          {/* Pass/Fail Stats */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <CheckCircleIcon className="w-3 h-3 text-green-500" />
                Passing
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {stats.passing} ({passRate}%)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <XCircleIcon className="w-3 h-3 text-red-500" />
                Failing
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {stats.failing}
              </span>
            </div>
            {stats.skipped > 0 && (
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Skipped</span>
                <span>{stats.skipped}</span>
              </div>
            )}
          </div>

          {/* Coverage Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Coverage</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {stats.coverage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`${
                  stats.coverage >= 80
                    ? 'bg-green-500'
                    : stats.coverage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                } h-2 rounded-full transition-all duration-300`}
                style={{ width: `${stats.coverage}%` }}
              />
            </div>
          </div>

          {/* Avg Duration */}
          {stats.avgDuration > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Avg Duration</span>
              <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {formatDuration(stats.avgDuration)}
              </span>
            </div>
          )}

          {/* Run Button */}
          {onRunTests && (
            <button
              className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                text-sm font-medium text-gray-700 dark:text-gray-300
                hover:bg-gray-50 dark:hover:bg-gray-700
                transition-colors duration-200
                flex items-center justify-center gap-2"
              onClick={() => onRunTests(level)}
            >
              <PlayIcon className="w-4 h-4" />
              Run {title}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {renderTestCard(
        'unit',
        summary.unit,
        'science',
        'text-purple-500',
        'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
        'Unit Tests'
      )}
      {renderTestCard(
        'integration',
        summary.integration,
        'link',
        'text-blue-500',
        'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
        'Integration Tests'
      )}
      {renderTestCard(
        'e2e',
        summary.e2e,
        'language',
        'text-green-500',
        'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
        'E2E Tests'
      )}
    </div>
  );
};
