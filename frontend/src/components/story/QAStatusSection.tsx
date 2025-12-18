import { Disclosure, Transition } from '@headlessui/react';
import {
  ChevronDownIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React, { useState } from 'react';

export type QAStatus = 'not_started' | 'in_progress' | 'signed_off' | 'blocked';

interface TestCoverage {
  unit: number;
  integration: number;
  e2e: number;
}

interface CoverageGap {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
}

interface QAChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  required: boolean;
}

interface QAStatusSectionProps {
  status: QAStatus;
  assignedTo?: string;
  signedOffAt?: string;
  notes?: string;
  testCoverage?: TestCoverage;
  coverageGaps?: CoverageGap[];
  checklistItems?: QAChecklistItem[];
  onStatusChange?: (status: QAStatus) => void;
  onNotesChange?: (notes: string) => void;
  onChecklistToggle?: (itemId: string, completed: boolean) => void;
}

const STATUS_CONFIG: Record<QAStatus, { icon: React.ElementType; label: string; colors: string }> = {
  not_started: {
    icon: ClockIcon,
    label: 'Not Started',
    colors: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  },
  in_progress: {
    icon: ClockIcon,
    label: 'In Progress',
    colors: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  },
  signed_off: {
    icon: CheckCircleIcon,
    label: 'Signed Off',
    colors: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  blocked: {
    icon: XCircleIcon,
    label: 'Blocked',
    colors: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
};

const SEVERITY_CONFIG: Record<string, { icon: string; colors: string }> = {
  critical: { icon: '\uD83D\uDD34', colors: 'border-l-4 border-l-red-500 bg-red-500/5' },
  high: { icon: '\uD83D\uDFE0', colors: 'border-l-4 border-l-orange-500 bg-orange-500/5' },
  medium: { icon: '\uD83D\uDFE1', colors: 'border-l-4 border-l-yellow-500 bg-yellow-500/5' },
  low: { icon: '\uD83D\uDFE2', colors: 'border-l-4 border-l-green-500 bg-green-500/5' },
};

function CoverageBar({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted w-24">{label}:</span>
      <div className="flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className={clsx('text-sm font-medium w-12 text-right',
        value >= 80 ? 'text-green-600' : value >= 50 ? 'text-yellow-600' : 'text-red-600'
      )}>
        {value}%
      </span>
    </div>
  );
}

export function QAStatusSection({
  status,
  assignedTo,
  signedOffAt,
  notes = '',
  testCoverage,
  coverageGaps = [],
  checklistItems = [],
  onStatusChange,
  onNotesChange,
  onChecklistToggle,
}: QAStatusSectionProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);

  const StatusIcon = STATUS_CONFIG[status].icon;
  const overallCoverage = testCoverage
    ? Math.round((testCoverage.unit + testCoverage.integration + testCoverage.e2e) / 3)
    : null;

  const handleSaveNotes = () => {
    onNotesChange?.(localNotes);
    setIsEditingNotes(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-md">
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex justify-between items-center w-full p-6 text-left">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-fg">QA Status & Sign-Off</h2>
                <span className={clsx(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border',
                  STATUS_CONFIG[status].colors
                )}>
                  <StatusIcon className="h-4 w-4" />
                  {STATUS_CONFIG[status].label}
                </span>
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
                {/* Sign-Off Info */}
                <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg">
                  <div>
                    <p className="text-sm text-muted">Assigned To</p>
                    <p className="text-fg font-medium">{assignedTo || 'Not assigned'}</p>
                  </div>
                  {signedOffAt && (
                    <div className="text-right">
                      <p className="text-sm text-muted">Signed Off</p>
                      <p className="text-fg font-medium">
                        {new Date(signedOffAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {onStatusChange && (
                    <select
                      value={status}
                      onChange={(e) => onStatusChange(e.target.value as QAStatus)}
                      className="ml-4 px-3 py-2 bg-card border border-border rounded-lg text-sm text-fg focus:border-accent focus:ring-1 focus:ring-accent"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="signed_off">Signed Off</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  )}
                </div>

                {/* QA Notes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-fg">QA Notes</h3>
                    {!isEditingNotes && onNotesChange && (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="text-xs text-accent hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        placeholder="Add QA notes (markdown supported)..."
                        className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-1 focus:ring-accent"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNotes}
                          className="px-4 py-2 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent-dark"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setLocalNotes(notes);
                            setIsEditingNotes(false);
                          }}
                          className="px-4 py-2 bg-bg-secondary text-fg rounded-lg text-sm font-medium hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-bg-secondary rounded-lg min-h-[80px]">
                      {notes ? (
                        <p className="text-sm text-fg whitespace-pre-wrap">{notes}</p>
                      ) : (
                        <p className="text-sm text-muted italic">No QA notes added yet</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Test Coverage */}
                {testCoverage && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-fg">Test Coverage</h3>
                      <span className={clsx(
                        'text-sm font-bold',
                        overallCoverage && overallCoverage >= 70 ? 'text-green-600' : 'text-red-600'
                      )}>
                        Overall: {overallCoverage}%
                      </span>
                    </div>
                    <div className="space-y-3 p-4 bg-bg-secondary rounded-lg">
                      <CoverageBar value={testCoverage.unit} label="Unit Tests" />
                      <CoverageBar value={testCoverage.integration} label="Integration" />
                      <CoverageBar value={testCoverage.e2e} label="E2E Tests" />
                    </div>
                  </div>
                )}

                {/* Coverage Gaps */}
                {coverageGaps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-fg mb-3">
                      Coverage Gaps ({coverageGaps.length})
                    </h3>
                    <div className="space-y-2">
                      {coverageGaps.map((gap) => (
                        <div
                          key={gap.id}
                          className={clsx('p-4 rounded-lg', SEVERITY_CONFIG[gap.severity].colors)}
                        >
                          <div className="flex items-start gap-2">
                            <span>{SEVERITY_CONFIG[gap.severity].icon}</span>
                            <div>
                              <p className="text-sm font-medium text-fg">
                                {gap.severity.toUpperCase()}: {gap.message}
                              </p>
                              <p className="text-xs text-muted mt-1">
                                Suggestion: {gap.suggestion}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* QA Checklist */}
                {checklistItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-fg mb-3">QA Checklist</h3>
                    <div className="space-y-2">
                      {checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => onChecklistToggle?.(item.id, !item.completed)}
                              className={clsx(
                                'w-5 h-5 rounded border-2 flex items-center justify-center',
                                item.completed
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-border hover:border-accent'
                              )}
                            >
                              {item.completed && <CheckCircleIcon className="h-3 w-3" />}
                            </button>
                            <span className={clsx(
                              'text-sm',
                              item.completed ? 'text-muted line-through' : 'text-fg'
                            )}>
                              {item.label}
                              {item.required && <span className="text-red-500 ml-1">*</span>}
                            </span>
                          </div>
                          {item.completedAt && (
                            <span className="text-xs text-muted">
                              {new Date(item.completedAt).toLocaleString()}
                            </span>
                          )}
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
