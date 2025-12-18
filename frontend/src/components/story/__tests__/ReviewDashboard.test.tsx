import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ConcernsGapsPanel } from '../ConcernsGapsPanel';
// import { DeployToTestControl } from '../DeployToTestControl'; // Component not yet implemented
import { ImplementationSummaryCard } from '../ImplementationSummaryCard';
import { QAStatusSection } from '../QAStatusSection';
import { ScreenshotGallery } from '../ScreenshotGallery';

// Mock Story data
const mockStory = {
  id: 'test-story-id',
  key: 'ST-79',
  title: 'Test Story',
  description: '- [ ] First criterion\n- [x] Second criterion\n- [ ] Third criterion',
  status: 'implementation',
  type: 'feature',
};

const mockCommits = [
  {
    id: 'commit-1',
    hash: 'abc1234567890',
    message: 'feat: Add implementation summary component',
    author: 'Test User',
    timestamp: '2025-11-21T10:00:00Z',
    files: [
      { filePath: 'src/components/Summary.tsx', locAdded: 150, locDeleted: 0 },
      { filePath: 'src/types/index.ts', locAdded: 20, locDeleted: 5 },
    ],
  },
  {
    id: 'commit-2',
    hash: 'def7890123456',
    message: 'refactor: Code cleanup',
    author: 'Test User',
    timestamp: '2025-11-21T09:00:00Z',
    files: [{ filePath: 'src/utils/helpers.ts', locAdded: 10, locDeleted: 20 }],
  },
];

describe('ImplementationSummaryCard', () => {
  it('renders story information correctly', () => {
    render(<ImplementationSummaryCard story={mockStory as any} commits={mockCommits as any} />);

    expect(screen.getByText('Implementation Summary')).toBeInTheDocument();
    expect(screen.getByText(/2 commits/)).toBeInTheDocument();
  });

  it('displays files modified from commits', () => {
    render(<ImplementationSummaryCard story={mockStory as any} commits={mockCommits as any} />);

    expect(screen.getByText('src/components/Summary.tsx')).toBeInTheDocument();
    expect(screen.getByText('src/types/index.ts')).toBeInTheDocument();
  });

  it('displays commits in the list', () => {
    render(<ImplementationSummaryCard story={mockStory as any} commits={mockCommits as any} />);

    expect(screen.getByText('feat: Add implementation summary component')).toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
  });

  it('parses acceptance criteria from description', () => {
    render(<ImplementationSummaryCard story={mockStory as any} commits={mockCommits as any} />);

    expect(screen.getByText('First criterion')).toBeInTheDocument();
    expect(screen.getByText('Second criterion')).toBeInTheDocument();
    expect(screen.getByText(/1\/3 satisfied/)).toBeInTheDocument();
  });
});

describe('QAStatusSection', () => {
  it('renders QA status badge correctly', () => {
    render(
      <QAStatusSection
        status="in_progress"
        assignedTo="QA Engineer"
        notes="Testing in progress"
      />
    );

    expect(screen.getByText('QA Status & Sign-Off')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('QA Engineer')).toBeInTheDocument();
  });

  it('shows signed off status with timestamp', () => {
    const signedOffAt = '2025-11-21T11:00:00Z';
    render(
      <QAStatusSection
        status="signed_off"
        assignedTo="QA Engineer"
        signedOffAt={signedOffAt}
      />
    );

    expect(screen.getByText('Signed Off')).toBeInTheDocument();
  });

  it('displays test coverage metrics', () => {
    render(
      <QAStatusSection
        status="in_progress"
        testCoverage={{ unit: 82, integration: 60, e2e: 75 }}
      />
    );

    expect(screen.getByText('Test Coverage')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows coverage gaps with severity', () => {
    render(
      <QAStatusSection
        status="in_progress"
        coverageGaps={[
          {
            id: 'gap-1',
            severity: 'critical',
            message: 'Missing E2E tests for payment flow',
            suggestion: 'Add 5 E2E tests',
          },
        ]}
      />
    );

    expect(screen.getByText('Coverage Gaps (1)')).toBeInTheDocument();
    expect(screen.getByText(/Missing E2E tests for payment flow/)).toBeInTheDocument();
  });

  it('calls onStatusChange when status is updated', () => {
    const onStatusChange = jest.fn();
    render(
      <QAStatusSection
        status="in_progress"
        onStatusChange={onStatusChange}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'signed_off' } });

    expect(onStatusChange).toHaveBeenCalledWith('signed_off');
  });
});

// TODO: Uncomment when DeployToTestControl component is implemented
/*
describe('DeployToTestControl', () => {
  it('renders deploy button when idle', () => {
    render(
      <DeployToTestControl
        storyId="test-story-id"
        status="idle"
        onDeploy={jest.fn()}
      />
    );

    expect(screen.getByText('DEPLOY TO TEST ENVIRONMENT')).toBeInTheDocument();
  });

  it('shows queue position when queued', () => {
    render(
      <DeployToTestControl
        storyId="test-story-id"
        status="queued"
        queuePosition={{ position: 3, total: 15, estimatedWaitMinutes: 8 }}
        onDeploy={jest.fn()}
      />
    );

    expect(screen.getByText('Queue Status')).toBeInTheDocument();
    expect(screen.getByText('3 of 15')).toBeInTheDocument();
    expect(screen.getByText('8 min')).toBeInTheDocument();
  });

  it('shows progress bar when deploying', () => {
    render(
      <DeployToTestControl
        storyId="test-story-id"
        status="deploying"
        deploymentProgress={{
          currentStep: 2,
          steps: [
            { name: 'Schema Detection', status: 'completed' },
            { name: 'Dependencies', status: 'completed' },
            { name: 'Docker Build', status: 'running' },
            { name: 'Migration', status: 'pending' },
            { name: 'Health Check', status: 'pending' },
            { name: 'Test Init', status: 'pending' },
          ],
        }}
        onDeploy={jest.fn()}
      />
    );

    expect(screen.getByText('Deployment Progress')).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 6')).toBeInTheDocument();
    expect(screen.getByText('Docker Build')).toBeInTheDocument();
  });

  it('shows success result with test URL', () => {
    render(
      <DeployToTestControl
        storyId="test-story-id"
        status="success"
        deploymentResult={{
          testUrl: 'http://test-frontend:5174',
          duration: 165,
          testsPassed: 145,
          testsFailed: 0,
        }}
        onDeploy={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByText('Deployment Successful')).toBeInTheDocument();
    expect(screen.getByText('http://test-frontend:5174')).toBeInTheDocument();
    expect(screen.getByText('145 passed')).toBeInTheDocument();
  });

  it('shows error message when failed', () => {
    render(
      <DeployToTestControl
        storyId="test-story-id"
        status="failed"
        deploymentResult={{
          duration: 60,
          errorMessage: 'Health check failed: Backend not responding',
        }}
        onDeploy={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByText('Deployment Failed')).toBeInTheDocument();
    expect(screen.getByText('Health check failed: Backend not responding')).toBeInTheDocument();
  });

  it('disables button with reason', () => {
    render(
      <DeployToTestControl
        storyId="test-story-id"
        status="idle"
        disabledReason="No commits yet - push changes first"
        onDeploy={jest.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /DEPLOY TO TEST ENVIRONMENT/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('No commits yet - push changes first')).toBeInTheDocument();
  });

  it('calls onDeploy when button is clicked', () => {
    const onDeploy = jest.fn();
    render(
      <DeployToTestControl
        storyId="test-story-id"
        status="idle"
        onDeploy={onDeploy}
      />
    );

    fireEvent.click(screen.getByText('DEPLOY TO TEST ENVIRONMENT'));
    expect(onDeploy).toHaveBeenCalled();
  });
});
*/

describe('ConcernsGapsPanel', () => {
  it('renders risk score gauge', () => {
    render(<ConcernsGapsPanel riskScore={35} />);

    expect(screen.getByText('Concerns & Gaps')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });

  it('shows risk factors breakdown', () => {
    render(
      <ConcernsGapsPanel
        riskScore={35}
        riskFactors={[
          { name: 'Code Complexity', score: 40, trend: 'up', weight: 0.25 },
          { name: 'Test Coverage', score: 82, trend: 'stable', weight: 0.30 },
        ]}
      />
    );

    expect(screen.getByText('Code Complexity')).toBeInTheDocument();
    expect(screen.getByText('40/100')).toBeInTheDocument();
    expect(screen.getByText('Test Coverage')).toBeInTheDocument();
    expect(screen.getByText('82/100')).toBeInTheDocument();
  });

  it('displays issues with severity', () => {
    render(
      <ConcernsGapsPanel
        riskScore={50}
        issues={[
          {
            id: 'issue-1',
            category: 'coverage',
            severity: 'critical',
            message: 'Missing E2E tests for payment flow',
            suggestion: 'Add 5 E2E tests',
          },
        ]}
      />
    );

    expect(screen.getByText(/1 critical/)).toBeInTheDocument();
    expect(screen.getByText(/Missing E2E tests for payment flow/)).toBeInTheDocument();
  });

  it('shows no breaking changes message', () => {
    render(<ConcernsGapsPanel riskScore={20} breakingChanges={[]} />);

    expect(screen.getByText('No breaking changes detected')).toBeInTheDocument();
  });

  it('displays breaking changes when present', () => {
    render(
      <ConcernsGapsPanel
        riskScore={60}
        breakingChanges={[
          {
            type: 'schema',
            description: 'Deleted column user.email',
            migration: 'Add migration to preserve data',
          },
        ]}
      />
    );

    expect(screen.getByText(/Deleted column user.email/)).toBeInTheDocument();
  });

  it('shows implementation coverage', () => {
    render(
      <ConcernsGapsPanel
        riskScore={35}
        implementationCoverage={85}
        uncoveredCriteria={['Support dark mode toggle']}
      />
    );

    expect(screen.getByText('Implementation Coverage: 85%')).toBeInTheDocument();
    expect(screen.getByText(/Support dark mode toggle/)).toBeInTheDocument();
  });
});

describe('ScreenshotGallery', () => {
  const mockScreenshots = [
    {
      id: 'ss-1',
      url: 'https://example.com/before.png',
      category: 'before' as const,
      description: 'Before state',
      uploadedAt: '2025-11-21T10:00:00Z',
    },
    {
      id: 'ss-2',
      url: 'https://example.com/feature.png',
      category: 'feature' as const,
      description: 'Feature implementation',
      uploadedAt: '2025-11-21T10:30:00Z',
    },
  ];

  it('renders gallery with screenshots', () => {
    render(<ScreenshotGallery screenshots={mockScreenshots} />);

    expect(screen.getByText('Screenshots (2)')).toBeInTheDocument();
  });

  it('shows empty state when no screenshots', () => {
    render(<ScreenshotGallery screenshots={[]} />);

    expect(screen.getByText('No screenshots uploaded yet')).toBeInTheDocument();
  });

  it('filters by category', () => {
    render(<ScreenshotGallery screenshots={mockScreenshots} />);

    // Click on 'Before' filter
    fireEvent.click(screen.getByText(/Before/));

    // Should show only before screenshots
    expect(screen.getByAltText('Before state')).toBeInTheDocument();
  });

  it('shows upload button when onUpload provided', () => {
    render(<ScreenshotGallery screenshots={[]} onUpload={jest.fn()} />);

    expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
  });
});
