import React, { useState, useEffect } from 'react';
import {
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Disclosure, Transition } from '@headlessui/react';
import clsx from 'clsx';

export type DeploymentStatus = 'idle' | 'queued' | 'deploying' | 'success' | 'failed';

interface DeploymentStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
}

interface DeploymentResult {
  testUrl?: string;
  duration: number;
  testsPassed?: number;
  testsFailed?: number;
  testsSkipped?: number;
  errorMessage?: string;
}

interface DeploymentHistoryItem {
  id: string;
  timestamp: string;
  status: 'success' | 'failed';
  duration: number;
  testsPassed?: number;
  testsFailed?: number;
  errorMessage?: string;
}

interface DeployToTestControlProps {
  storyId: string;
  status: DeploymentStatus;
  queuePosition?: { position: number; total: number; estimatedWaitMinutes?: number };
  deploymentProgress?: { currentStep: number; steps: DeploymentStep[] };
  deploymentResult?: DeploymentResult;
  deploymentHistory?: DeploymentHistoryItem[];
  disabledReason?: string;
  onDeploy: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

const DEPLOYMENT_STEPS = [
  'Schema Detection',
  'Dependencies',
  'Docker Build',
  'Migration',
  'Health Check',
  'Test Init',
];

export function DeployToTestControl({
  storyId,
  status,
  queuePosition,
  deploymentProgress,
  deploymentResult,
  deploymentHistory = [],
  disabledReason,
  onDeploy,
  onCancel,
  onRetry,
}: DeployToTestControlProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const copyTestUrl = async () => {
    if (deploymentResult?.testUrl) {
      await navigator.clipboard.writeText(deploymentResult.testUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const isDisabled = status === 'queued' || status === 'deploying' || !!disabledReason;

  return (
    <div className="bg-card border border-border rounded-lg shadow-md p-6 space-y-6">
      <h2 className="text-lg font-bold text-fg">Deployment Control</h2>

      {/* Primary Deploy Button */}
      <div className="relative">
        <button
          onClick={onDeploy}
          disabled={isDisabled}
          className={clsx(
            'w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg text-lg font-semibold transition-all',
            isDisabled
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-accent text-accent-fg hover:bg-accent-dark shadow-md hover:shadow-lg'
          )}
          title={disabledReason || ''}
        >
          {status === 'queued' || status === 'deploying' ? (
            <ArrowPathIcon className="h-6 w-6 animate-spin" />
          ) : (
            <PlayIcon className="h-6 w-6" />
          )}
          {status === 'queued'
            ? 'In Queue...'
            : status === 'deploying'
            ? 'Deploying...'
            : 'DEPLOY TO TEST ENVIRONMENT'}
        </button>
        {disabledReason && status === 'idle' && (
          <p className="text-xs text-red-500 mt-2 text-center">{disabledReason}</p>
        )}
      </div>

      {/* Queue Status */}
      {status === 'queued' && queuePosition && (
        <div className="p-4 bg-bg-secondary rounded-lg border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-fg">Queue Status</h3>
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <StopIcon className="h-3 w-3" />
                Cancel
              </button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Position:</span>
              <span className="text-sm font-bold text-red-600">
                {queuePosition.position} of {queuePosition.total}
              </span>
            </div>
            {queuePosition.estimatedWaitMinutes !== undefined && (
              <div className="flex justify-between">
                <span className="text-sm text-muted">Estimated Wait:</span>
                <span className="text-sm font-medium text-fg">
                  {queuePosition.estimatedWaitMinutes} min
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deployment Progress */}
      {status === 'deploying' && deploymentProgress && (
        <div className="p-4 bg-bg-secondary rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-fg">Deployment Progress</h3>
            <span className="text-xs text-muted">
              Step {deploymentProgress.currentStep + 1} of {deploymentProgress.steps.length}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{
                width: `${((deploymentProgress.currentStep + 1) / deploymentProgress.steps.length) * 100}%`,
              }}
            />
          </div>

          {/* Step List */}
          <div className="space-y-2">
            {deploymentProgress.steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {step.status === 'completed' && (
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                )}
                {step.status === 'running' && (
                  <ArrowPathIcon className="h-4 w-4 text-accent animate-spin" />
                )}
                {step.status === 'pending' && (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
                {step.status === 'failed' && (
                  <XCircleIcon className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={clsx(
                    'text-sm',
                    step.status === 'completed' && 'text-green-600',
                    step.status === 'running' && 'text-accent font-medium',
                    step.status === 'pending' && 'text-muted',
                    step.status === 'failed' && 'text-red-500'
                  )}
                >
                  {step.name}
                </span>
                {step.duration !== undefined && (
                  <span className="text-xs text-muted ml-auto">{step.duration}s</span>
                )}
              </div>
            ))}
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              className="mt-4 w-full py-2 text-sm text-red-500 border border-red-500 rounded-lg hover:bg-red-500/10"
            >
              Cancel Deployment
            </button>
          )}
        </div>
      )}

      {/* Deployment Result */}
      {(status === 'success' || status === 'failed') && deploymentResult && (
        <div
          className={clsx(
            'p-4 rounded-lg border',
            status === 'success'
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            {status === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-500" />
            )}
            <h3 className="text-sm font-semibold text-fg">
              {status === 'success' ? 'Deployment Successful' : 'Deployment Failed'}
            </h3>
            <span className="text-xs text-muted ml-auto">
              {Math.floor(deploymentResult.duration / 60)}m {deploymentResult.duration % 60}s
            </span>
          </div>

          {status === 'success' && deploymentResult.testUrl && (
            <div className="mb-3">
              <p className="text-xs text-muted mb-1">Test Environment:</p>
              <div className="flex items-center gap-2">
                <a
                  href={deploymentResult.testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:underline flex items-center gap-1"
                >
                  {deploymentResult.testUrl}
                  <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                </a>
                <button
                  onClick={copyTestUrl}
                  className="p-1 hover:bg-bg-secondary rounded"
                  title="Copy URL"
                >
                  <ClipboardIcon className="h-4 w-4 text-muted" />
                </button>
                {copiedUrl && <span className="text-xs text-green-500">Copied!</span>}
              </div>
            </div>
          )}

          {deploymentResult.testsPassed !== undefined && (
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">
                {deploymentResult.testsPassed} passed
              </span>
              {deploymentResult.testsFailed !== undefined && deploymentResult.testsFailed > 0 && (
                <span className="text-red-600">{deploymentResult.testsFailed} failed</span>
              )}
              {deploymentResult.testsSkipped !== undefined && deploymentResult.testsSkipped > 0 && (
                <span className="text-muted">{deploymentResult.testsSkipped} skipped</span>
              )}
            </div>
          )}

          {status === 'failed' && deploymentResult.errorMessage && (
            <div className="mt-3 p-3 bg-red-500/5 rounded text-sm text-red-600 font-mono">
              {deploymentResult.errorMessage}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 py-2 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent-dark"
              >
                {status === 'success' ? 'Deploy Again' : 'Retry'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Deployment History */}
      {deploymentHistory.length > 0 && (
        <Disclosure>
          {({ open }) => (
            <>
              <Disclosure.Button className="flex items-center justify-between w-full text-sm text-muted hover:text-fg">
                <span>Previous Deployments ({deploymentHistory.length})</span>
                <ChevronDownIcon
                  className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')}
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
                <Disclosure.Panel className="mt-3 space-y-2">
                  {deploymentHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {item.status === 'success' ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-muted">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-muted">
                        {Math.floor(item.duration / 60)}m {item.duration % 60}s
                      </span>
                    </div>
                  ))}
                </Disclosure.Panel>
              </Transition>
            </>
          )}
        </Disclosure>
      )}
    </div>
  );
}
