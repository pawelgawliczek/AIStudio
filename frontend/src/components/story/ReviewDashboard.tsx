import React, { useState, useEffect, useCallback } from 'react';
import { ImplementationSummaryCard } from './ImplementationSummaryCard';
import { QAStatusSection, QAStatus } from './QAStatusSection';
import { DeployToTestControl, DeploymentStatus } from './DeployToTestControl';
import { ConcernsGapsPanel } from './ConcernsGapsPanel';
import { ScreenshotGallery, ScreenshotCategory } from './ScreenshotGallery';
import { useWebSocket } from '../../services/websocket.service';
import type { Story } from '../../types';

// Commit type based on backend schema
interface Commit {
  id: string;
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  files?: Array<{
    filePath: string;
    locAdded: number;
    locDeleted: number;
  }>;
}

interface ReviewDashboardProps {
  story: Story;
  commits?: Commit[];
  onDeployToTest?: () => Promise<void>;
  onQAStatusChange?: (status: QAStatus) => Promise<void>;
}

interface DeploymentProgress {
  currentStep: number;
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    duration?: number;
  }>;
}

interface QueuePosition {
  position: number;
  total: number;
  estimatedWaitMinutes?: number;
}

export function ReviewDashboard({
  story,
  commits = [],
  onDeployToTest,
  onQAStatusChange,
}: ReviewDashboardProps) {
  // Deployment state
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>('idle');
  const [queuePosition, setQueuePosition] = useState<QueuePosition | undefined>();
  const [deploymentProgress, setDeploymentProgress] = useState<DeploymentProgress | undefined>();
  const [deploymentResult, setDeploymentResult] = useState<{
    testUrl?: string;
    duration: number;
    testsPassed?: number;
    testsFailed?: number;
    errorMessage?: string;
  } | undefined>();

  // QA state from story metadata
  const storyMetadata = (story as any).metadata;
  const qaMetadata = storyMetadata?.qaStatus;
  const concernsAnalysis = storyMetadata?.concernsAnalysis;
  const deploymentMetadata = storyMetadata?.deployment;

  // Screenshots from artifacts (mock data for now)
  const [screenshots, setScreenshots] = useState<Array<{
    id: string;
    url: string;
    category: ScreenshotCategory;
    description?: string;
    uploadedBy?: string;
    uploadedAt: string;
  }>>([]);

  // WebSocket listeners for real-time updates
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    const handleQueuePositionUpdate = (event: any) => {
      if (event.storyId === story.id) {
        setQueuePosition({
          position: event.position,
          total: event.queueLength,
          estimatedWaitMinutes: event.estimatedWaitMinutes,
        });
      }
    };

    const handleDeploymentProgress = (event: any) => {
      if (event.storyId === story.id) {
        setDeploymentStatus('deploying');
        setDeploymentProgress({
          currentStep: event.stepIndex,
          steps: event.steps || [
            { name: 'Schema Detection', status: event.stepIndex > 0 ? 'completed' : event.stepIndex === 0 ? 'running' : 'pending' },
            { name: 'Dependencies', status: event.stepIndex > 1 ? 'completed' : event.stepIndex === 1 ? 'running' : 'pending' },
            { name: 'Docker Build', status: event.stepIndex > 2 ? 'completed' : event.stepIndex === 2 ? 'running' : 'pending' },
            { name: 'Migration', status: event.stepIndex > 3 ? 'completed' : event.stepIndex === 3 ? 'running' : 'pending' },
            { name: 'Health Check', status: event.stepIndex > 4 ? 'completed' : event.stepIndex === 4 ? 'running' : 'pending' },
            { name: 'Test Init', status: event.stepIndex > 5 ? 'completed' : event.stepIndex === 5 ? 'running' : 'pending' },
          ],
        });
      }
    };

    const handleDeploymentCompleted = (event: any) => {
      if (event.storyId === story.id) {
        setDeploymentStatus(event.success ? 'success' : 'failed');
        setDeploymentResult({
          testUrl: event.testUrl,
          duration: event.duration,
          testsPassed: event.testResults?.passed,
          testsFailed: event.testResults?.failed,
          errorMessage: event.errorMessage,
        });
        setQueuePosition(undefined);
        setDeploymentProgress(undefined);
      }
    };

    socket.on('story:queue:position-updated', handleQueuePositionUpdate);
    socket.on('story:deployment:progress', handleDeploymentProgress);
    socket.on('story:deployment:completed', handleDeploymentCompleted);

    return () => {
      socket.off('story:queue:position-updated', handleQueuePositionUpdate);
      socket.off('story:deployment:progress', handleDeploymentProgress);
      socket.off('story:deployment:completed', handleDeploymentCompleted);
    };
  }, [socket, story.id]);

  // Initialize from story metadata
  useEffect(() => {
    if (deploymentMetadata?.lastDeployment) {
      const last = deploymentMetadata.lastDeployment;
      if (last.status === 'success' || last.status === 'failed') {
        setDeploymentStatus(last.status);
        setDeploymentResult({
          testUrl: last.testUrl,
          duration: last.duration,
          testsPassed: last.testsPassed,
          testsFailed: last.testsFailed,
          errorMessage: last.errorMessage,
        });
      }
    }
  }, [deploymentMetadata]);

  const handleDeploy = useCallback(async () => {
    setDeploymentStatus('queued');
    setQueuePosition({ position: 1, total: 1, estimatedWaitMinutes: 5 });
    try {
      await onDeployToTest?.();
    } catch (error) {
      setDeploymentStatus('failed');
      setDeploymentResult({
        duration: 0,
        errorMessage: error instanceof Error ? error.message : 'Deployment failed',
      });
    }
  }, [onDeployToTest]);

  const handleCancel = useCallback(() => {
    setDeploymentStatus('idle');
    setQueuePosition(undefined);
    setDeploymentProgress(undefined);
  }, []);

  const handleRetry = useCallback(() => {
    setDeploymentStatus('idle');
    setDeploymentResult(undefined);
    handleDeploy();
  }, [handleDeploy]);

  // Determine disabled reason for deploy button
  const getDisabledReason = (): string | undefined => {
    if (commits.length === 0) return 'No commits yet - push changes first';
    // Add more checks as needed
    return undefined;
  };

  return (
    <div className="space-y-6">
      {/* Review & Deploy Header */}
      <div className="bg-card border border-border rounded-lg shadow-md p-4">
        <h2 className="text-xl font-bold text-fg">Review & Deploy</h2>
        <p className="text-sm text-muted mt-1">
          Review implementation, assess quality, and deploy to test environment
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Implementation & QA */}
        <div className="lg:col-span-2 space-y-6">
          <ImplementationSummaryCard
            story={story}
            commits={commits}
          />

          <QAStatusSection
            status={(qaMetadata?.status as QAStatus) || 'not_started'}
            assignedTo={qaMetadata?.assignedTo}
            signedOffAt={qaMetadata?.signedOffAt}
            notes={qaMetadata?.notes}
            testCoverage={qaMetadata?.testCoverage}
            coverageGaps={qaMetadata?.coverageGaps}
            checklistItems={qaMetadata?.checklistItems}
            onStatusChange={onQAStatusChange}
            onNotesChange={async (notes) => {
              // Handle notes update
              console.log('QA notes updated:', notes);
            }}
          />

          <ScreenshotGallery
            screenshots={screenshots}
            onUpload={(files) => {
              console.log('Uploading screenshots:', files);
              // Handle upload
            }}
          />
        </div>

        {/* Right Column - Deploy & Concerns */}
        <div className="space-y-6">
          <DeployToTestControl
            storyId={story.id}
            status={deploymentStatus}
            queuePosition={queuePosition}
            deploymentProgress={deploymentProgress}
            deploymentResult={deploymentResult}
            deploymentHistory={deploymentMetadata?.deploymentHistory || []}
            disabledReason={getDisabledReason()}
            onDeploy={handleDeploy}
            onCancel={handleCancel}
            onRetry={handleRetry}
          />

          <ConcernsGapsPanel
            riskScore={concernsAnalysis?.riskScore || 0}
            riskFactors={concernsAnalysis?.factors}
            issues={concernsAnalysis?.issues}
            implementationCoverage={concernsAnalysis?.implementationCoverage}
            uncoveredCriteria={concernsAnalysis?.uncoveredCriteria}
            breakingChanges={[]}
            performanceImpacts={[]}
            onDismissIssue={(issueId) => {
              console.log('Dismissed issue:', issueId);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export { ImplementationSummaryCard } from './ImplementationSummaryCard';
export { QAStatusSection } from './QAStatusSection';
export type { QAStatus } from './QAStatusSection';
export { DeployToTestControl } from './DeployToTestControl';
export type { DeploymentStatus } from './DeployToTestControl';
export { ConcernsGapsPanel } from './ConcernsGapsPanel';
export { ScreenshotGallery } from './ScreenshotGallery';
export type { ScreenshotCategory } from './ScreenshotGallery';
