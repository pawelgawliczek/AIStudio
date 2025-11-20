import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoryTraceabilityTabs } from '../StoryTraceabilityTabs';

describe('StoryTraceabilityTabs', () => {
  const mockWorkflowRuns = [
    {
      id: 'run-1',
      status: 'completed',
      startedAt: '2025-11-14T10:00:00Z',
      finishedAt: '2025-11-14T10:05:00Z',
      durationSeconds: 300,
      totalTokens: 15000,
      estimatedCost: 0.45,
      workflow: {
        id: 'workflow-1',
        name: 'Full-Stack Dev Workflow',
      },
      componentRuns: [],
    },
  ];

  const mockUseCaseLinks = [
    {
      id: 'link-1',
      relation: 'implements' as const,
      useCase: {
        id: 'uc-1',
        key: 'UC-AUTH-001',
        title: 'User Authentication',
        area: 'Authentication',
        testCases: [
          {
            id: 'tc-1',
            key: 'TC-AUTH-001',
            title: 'Test login flow',
            testLevel: 'integration',
            status: 'implemented',
            testFilePath: 'backend/src/auth/login.test.ts',
          },
        ],
      },
    },
  ];

  const mockCommits = [
    {
      hash: 'abc123def456',
      author: 'John Doe <john@example.com>',
      timestamp: '2025-11-14T09:00:00Z',
      message: 'feat: Add user authentication [Story-ST-25]',
      files: [
        {
          id: 'file-1',
          filePath: 'backend/src/auth/login.ts',
          locAdded: 50,
          locDeleted: 10,
        },
      ],
    },
  ];

  describe('Tab Navigation', () => {
    it('renders all four tabs', () => {
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      expect(screen.getByRole('tab', { name: /workflow runs/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /use cases/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /test cases/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /git commits/i })).toBeInTheDocument();
    });

    it('shows Workflow Runs tab as active by default', () => {
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      const workflowTab = screen.getByRole('tab', { name: /workflow runs/i });
      expect(workflowTab).toHaveAttribute('aria-selected', 'true');
    });

    it('displays Workflow Runs content by default', () => {
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      expect(screen.getByText('Full-Stack Dev Workflow')).toBeInTheDocument();
    });

    it('switches to Use Cases tab when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      const useCasesTab = screen.getByRole('tab', { name: /use cases/i });
      await user.click(useCasesTab);

      expect(useCasesTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('User Authentication')).toBeInTheDocument();
    });

    it('switches to Test Cases tab when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      const testCasesTab = screen.getByRole('tab', { name: /test cases/i });
      await user.click(testCasesTab);

      expect(testCasesTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Test login flow')).toBeInTheDocument();
    });

    it('switches to Git Commits tab when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      const commitsTab = screen.getByRole('tab', { name: /git commits/i });
      await user.click(commitsTab);

      expect(commitsTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/feat: Add user authentication/i)).toBeInTheDocument();
    });
  });

  describe('Tab Content', () => {
    it('only shows active tab content at a time', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      // Initially shows Workflow Runs
      expect(screen.getByText('Full-Stack Dev Workflow')).toBeInTheDocument();
      expect(screen.queryByText('User Authentication')).not.toBeInTheDocument();

      // Switch to Use Cases
      await user.click(screen.getByRole('tab', { name: /use cases/i }));
      expect(screen.getByText('User Authentication')).toBeInTheDocument();
      expect(screen.queryByText('Full-Stack Dev Workflow')).not.toBeInTheDocument();
    });

    it('shows test cases from all use cases in Test Cases tab', async () => {
      const user = userEvent.setup();
      const multipleUseCases = [
        {
          id: 'link-1',
          relation: 'implements' as const,
          useCase: {
            id: 'uc-1',
            key: 'UC-AUTH-001',
            title: 'User Authentication',
            testCases: [
              {
                id: 'tc-1',
                key: 'TC-AUTH-001',
                title: 'Test login flow',
                testLevel: 'integration',
                status: 'implemented',
              },
            ],
          },
        },
        {
          id: 'link-2',
          relation: 'modifies' as const,
          useCase: {
            id: 'uc-2',
            key: 'UC-AUTH-002',
            title: 'Password Reset',
            testCases: [
              {
                id: 'tc-2',
                key: 'TC-AUTH-002',
                title: 'Test password reset',
                testLevel: 'e2e',
                status: 'pending',
              },
            ],
          },
        },
      ];

      render(
        <StoryTraceabilityTabs
          workflowRuns={[]}
          useCaseLinks={multipleUseCases}
          commits={[]}
        />
      );

      await user.click(screen.getByRole('tab', { name: /test cases/i }));

      // Should show test cases from both use cases
      expect(screen.getByText('Test login flow')).toBeInTheDocument();
      expect(screen.getByText('Test password reset')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty state for Workflow Runs when no runs exist', () => {
      render(
        <StoryTraceabilityTabs
          workflowRuns={[]}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      expect(screen.getByText(/no workflow runs yet/i)).toBeInTheDocument();
    });

    it('shows empty state for Use Cases when no use cases linked', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={[]}
          commits={mockCommits}
        />
      );

      await user.click(screen.getByRole('tab', { name: /use cases/i }));
      expect(screen.getByText(/no use cases linked yet/i)).toBeInTheDocument();
    });

    it('shows empty state for Test Cases when no test cases exist', async () => {
      const user = userEvent.setup();
      const useCasesWithoutTests = [
        {
          id: 'link-1',
          relation: 'implements' as const,
          useCase: {
            id: 'uc-1',
            key: 'UC-AUTH-001',
            title: 'User Authentication',
            testCases: [],
          },
        },
      ];

      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={useCasesWithoutTests}
          commits={mockCommits}
        />
      );

      await user.click(screen.getByRole('tab', { name: /test cases/i }));
      expect(screen.getByText(/no test cases yet/i)).toBeInTheDocument();
    });

    it('shows empty state for Git Commits when no commits exist', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={[]}
        />
      );

      await user.click(screen.getByRole('tab', { name: /git commits/i }));
      expect(screen.getByText(/no commits linked yet/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation between tabs', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      const workflowTab = screen.getByRole('tab', { name: /workflow runs/i });
      workflowTab.focus();

      // Press Tab key to move to next tab
      await user.keyboard('{ArrowRight}');

      const useCasesTab = screen.getByRole('tab', { name: /use cases/i });
      expect(useCasesTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Integration with existing components', () => {
    it('renders WorkflowRunsSection component in first tab', () => {
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      // WorkflowRunsSection should render the workflow name
      expect(screen.getByText('Full-Stack Dev Workflow')).toBeInTheDocument();
      expect(screen.getByText(/completed/i)).toBeInTheDocument();
    });

    it('renders UseCasesSection component in second tab', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      await user.click(screen.getByRole('tab', { name: /use cases/i }));

      // UseCasesSection should render use case details
      expect(screen.getByText('UC-AUTH-001')).toBeInTheDocument();
      expect(screen.getByText('User Authentication')).toBeInTheDocument();
    });

    it('renders CommitsSection component in fourth tab', async () => {
      const user = userEvent.setup();
      render(
        <StoryTraceabilityTabs
          workflowRuns={mockWorkflowRuns}
          useCaseLinks={mockUseCaseLinks}
          commits={mockCommits}
        />
      );

      await user.click(screen.getByRole('tab', { name: /git commits/i }));

      // CommitsSection should render commit details
      expect(screen.getByText(/abc123d/i)).toBeInTheDocument();
      expect(screen.getByText(/feat: Add user authentication/i)).toBeInTheDocument();
    });
  });
});
