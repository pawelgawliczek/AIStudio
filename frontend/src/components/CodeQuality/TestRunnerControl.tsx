/**
 * Test Runner Control Component (ST-132)
 * Dropdown menu to trigger test runs at different levels
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface TestRunnerControlProps {
  onRunTests?: (level: 'all' | 'unit' | 'integration' | 'e2e') => void;
  disabled?: boolean;
}

export const TestRunnerControl: React.FC<TestRunnerControlProps> = ({
  onRunTests,
  disabled = false,
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleRunTests = (level: 'all' | 'unit' | 'integration' | 'e2e') => {
    setIsOpen(false);
    if (onRunTests) {
      onRunTests(level);
    } else {
      // Default behavior: show console log
      console.log(`Running ${level} tests...`);
      // TODO: Integrate with test queue API
    }
  };

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md
          hover:bg-blue-700 dark:hover:bg-blue-600
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
          flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">science</span>
        Run Tests
        <span className="material-symbols-outlined text-sm">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 z-20 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="py-1">
              <button
                onClick={() => handleRunTests('all')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                Run All Tests
              </button>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

              <button
                onClick={() => handleRunTests('unit')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">science</span>
                Run Unit Tests
              </button>

              <button
                onClick={() => handleRunTests('integration')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">link</span>
                Run Integration Tests
              </button>

              <button
                onClick={() => handleRunTests('e2e')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">language</span>
                Run E2E Tests
              </button>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/test-executions');
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">bar_chart</span>
                View Test History
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
