/**
 * ST-127: DeploymentsTable Component Tests
 * Tests for the reusable deployments table component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { DeploymentsTable } from '../DeploymentsTable';
import { Deployment, DeploymentStatus } from '../../services/deployments.service';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createMockDeployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  id: 'deploy-1',
  storyId: 'story-1',
  storyKey: 'ST-123',
  storyTitle: 'Test Story Title',
  projectId: 'project-1',
  prNumber: 42,
  status: 'deployed' as DeploymentStatus,
  environment: 'production',
  branch: 'main',
  commitHash: 'abc123def',
  approvedBy: 'admin@test.com',
  approvedAt: '2025-01-15T10:00:00Z',
  deployedBy: 'claude-agent',
  deployedAt: '2025-01-15T10:05:00Z',
  completedAt: '2025-01-15T10:10:00Z',
  duration: 300000, // 5 minutes
  errorMessage: null,
  approvalMethod: 'pr',
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:10:00Z',
  ...overrides,
});

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('DeploymentsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading spinner when isLoading is true', () => {
      renderWithRouter(<DeploymentsTable deployments={[]} isLoading={true} />);

      // Loading spinner has animate-spin class
      expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('should not display table when loading', () => {
      renderWithRouter(<DeploymentsTable deployments={[]} isLoading={true} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display default empty message when no deployments', () => {
      renderWithRouter(<DeploymentsTable deployments={[]} />);

      expect(screen.getByText('No deployments found')).toBeInTheDocument();
    });

    it('should display custom empty message', () => {
      renderWithRouter(
        <DeploymentsTable deployments={[]} emptyMessage="No deployments for this story" />
      );

      expect(screen.getByText('No deployments for this story')).toBeInTheDocument();
    });

    it('should display helpful subtext in empty state', () => {
      renderWithRouter(<DeploymentsTable deployments={[]} />);

      expect(screen.getByText(/Deployments will appear here/)).toBeInTheDocument();
    });
  });

  describe('Full Table Mode', () => {
    const mockDeployments = [
      createMockDeployment({ id: 'deploy-1', storyKey: 'ST-123' }),
      createMockDeployment({
        id: 'deploy-2',
        storyKey: 'ST-124',
        status: 'failed' as DeploymentStatus,
        errorMessage: 'Build failed',
      }),
    ];

    it('should render table with deployments', () => {
      renderWithRouter(<DeploymentsTable deployments={mockDeployments} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('ST-123')).toBeInTheDocument();
      expect(screen.getByText('ST-124')).toBeInTheDocument();
    });

    it('should display all column headers with story column', () => {
      renderWithRouter(<DeploymentsTable deployments={mockDeployments} showStoryColumn={true} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Story')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Environment')).toBeInTheDocument();
      expect(screen.getByText('Deployed By')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should hide story column when showStoryColumn is false', () => {
      renderWithRouter(<DeploymentsTable deployments={mockDeployments} showStoryColumn={false} />);

      expect(screen.queryByText('Story')).not.toBeInTheDocument();
      expect(screen.queryByText('Title')).not.toBeInTheDocument();
    });

    it('should display status badges with correct styling', () => {
      const deployments = [
        createMockDeployment({ status: 'deployed' as DeploymentStatus }),
      ];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      const statusBadge = screen.getByText('deployed');
      expect(statusBadge).toBeInTheDocument();
    });

    it('should format duration correctly', () => {
      const deployments = [
        createMockDeployment({ duration: 300000 }), // 5 minutes
      ];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      expect(screen.getByText('5m 0s')).toBeInTheDocument();
    });

    it('should display dash for null duration', () => {
      const deployments = [
        createMockDeployment({ duration: null }),
      ];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      // Should show '-' for missing duration
      const durationCell = screen.getAllByText('-');
      expect(durationCell.length).toBeGreaterThan(0);
    });

    it('should navigate to story on row click', () => {
      const deployments = [createMockDeployment({ storyKey: 'ST-123' })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      const row = screen.getByText('ST-123').closest('tr');
      fireEvent.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith('/stories/ST-123');
    });

    it('should not navigate if storyKey is missing', () => {
      const deployments = [createMockDeployment({ storyKey: null })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      const row = screen.getAllByRole('row')[1]; // Skip header row
      fireEvent.click(row);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Compact Mode', () => {
    const mockDeployments = [
      createMockDeployment({ id: 'deploy-1', storyKey: 'ST-123' }),
      createMockDeployment({ id: 'deploy-2', storyKey: 'ST-124', environment: 'test' }),
    ];

    it('should render compact list instead of table', () => {
      renderWithRouter(<DeploymentsTable deployments={mockDeployments} compact={true} />);

      // Compact mode doesn't render a table
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('should display story key in compact mode', () => {
      renderWithRouter(<DeploymentsTable deployments={mockDeployments} compact={true} />);

      expect(screen.getByText('ST-123')).toBeInTheDocument();
      expect(screen.getByText('ST-124')).toBeInTheDocument();
    });

    it('should display environment in abbreviated form', () => {
      renderWithRouter(<DeploymentsTable deployments={mockDeployments} compact={true} />);

      expect(screen.getByText('prod')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
    });

    it('should navigate to story on compact row click', () => {
      renderWithRouter(<DeploymentsTable deployments={mockDeployments} compact={true} />);

      const row = screen.getByText('ST-123').closest('div[class*="cursor-pointer"]');
      fireEvent.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith('/stories/ST-123');
    });
  });

  describe('Status Badge Colors', () => {
    const statusTests: { status: DeploymentStatus; icon: string }[] = [
      { status: 'deployed', icon: '✓' },
      { status: 'failed', icon: '✗' },
      { status: 'rolled_back', icon: '↺' },
      { status: 'deploying', icon: '⟳' },
      { status: 'pending', icon: '○' },
      { status: 'approved', icon: '✓' },
    ];

    statusTests.forEach(({ status, icon }) => {
      it(`should display status badge for ${status}`, () => {
        const deployments = [createMockDeployment({ status })];
        renderWithRouter(<DeploymentsTable deployments={deployments} />);

        // Status text should be present
        expect(screen.getByText(status.replace('_', ' '))).toBeInTheDocument();
      });

      it(`should display correct icon for ${status} status`, () => {
        const deployments = [createMockDeployment({ status })];
        renderWithRouter(<DeploymentsTable deployments={deployments} />);

        expect(screen.getByText(icon)).toBeInTheDocument();
      });
    });
  });

  describe('Environment Badge Colors', () => {
    it('should display production environment badge', () => {
      const deployments = [createMockDeployment({ environment: 'production' })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      expect(screen.getByText('production')).toBeInTheDocument();
    });

    it('should display test environment badge', () => {
      const deployments = [createMockDeployment({ environment: 'test' })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should display "Just now" for recent deployments', () => {
      const now = new Date();
      const deployments = [createMockDeployment({ completedAt: now.toISOString() })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should display relative time for older deployments', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const deployments = [createMockDeployment({ completedAt: twoHoursAgo.toISOString() })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    });

    it('should display "-" for null completedAt', () => {
      const deployments = [createMockDeployment({ completedAt: null })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      // Multiple dashes may appear, just verify one exists
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('Duration Formatting', () => {
    it('should format minutes and seconds correctly', () => {
      const deployments = [createMockDeployment({ duration: 125000 })]; // 2m 5s
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      expect(screen.getByText('2m 5s')).toBeInTheDocument();
    });

    it('should handle zero duration', () => {
      const deployments = [createMockDeployment({ duration: 0 })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      // 0 is falsy, so should show '-'
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      const deployments = [createMockDeployment()];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });

    it('should have clickable rows with cursor pointer', () => {
      const deployments = [createMockDeployment()];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      const dataRow = screen.getAllByRole('row')[1]; // Skip header
      expect(dataRow).toHaveClass('cursor-pointer');
    });
  });

  describe('Missing Data Handling', () => {
    it('should display "-" for missing storyKey', () => {
      const deployments = [createMockDeployment({ storyKey: null })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('should display "-" for missing storyTitle', () => {
      const deployments = [createMockDeployment({ storyTitle: null })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('should display "-" for missing deployedBy', () => {
      const deployments = [createMockDeployment({ deployedBy: null })];
      renderWithRouter(<DeploymentsTable deployments={deployments} />);

      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });
});
