import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../../services/websocket.service';
import type { Story } from '../../types';
import { ConcernsGapsPanel } from './ConcernsGapsPanel';
import { ImplementationSummaryCard } from './ImplementationSummaryCard';
import { QAStatusSection, QAStatus } from './QAStatusSection';
import { ScreenshotGallery, ScreenshotCategory } from './ScreenshotGallery';

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
  onQAStatusChange?: (status: QAStatus) => Promise<void>;
}

export function ReviewDashboard({
  story,
  commits = [],
  onQAStatusChange,
}: ReviewDashboardProps) {
  // QA state from story metadata
  const storyMetadata = (story as any).metadata;
  const qaMetadata = storyMetadata?.qaStatus;
  const concernsAnalysis = storyMetadata?.concernsAnalysis;

  // Screenshots from artifacts (mock data for now)
  const [screenshots, setScreenshots] = useState<Array<{
    id: string;
    url: string;
    category: ScreenshotCategory;
    description?: string;
    uploadedBy?: string;
    uploadedAt: string;
  }>>([]);

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

        {/* Right Column - Concerns */}
        <div className="space-y-6">
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
export { ConcernsGapsPanel } from './ConcernsGapsPanel';
export { ScreenshotGallery } from './ScreenshotGallery';
export type { ScreenshotCategory } from './ScreenshotGallery';
