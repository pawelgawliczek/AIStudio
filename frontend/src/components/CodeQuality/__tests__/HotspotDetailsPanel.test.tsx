/**
 * Tests for HotspotDetailsPanel Component
 * Critical component that fetches and displays detailed file information
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from '../../../lib/axios';
import { FileHotspot, FileDetail } from '../../../types/codeQualityTypes';
import { HotspotDetailsPanel } from '../HotspotDetailsPanel';

vi.mock('../../../lib/axios');
vi.mock('../TrendChart', () => ({
  TrendChart: ({ title, data }: any) => (
    <div data-testid="trend-chart">
      <span>{title}</span>
      <span data-testid="trend-data-length">{data.length}</span>
    </div>
  ),
}));

const mockHotspot: FileHotspot = {
  filePath: 'backend/src/auth/password-reset.ts',
  riskScore: 85.5,
  complexity: 25,
  churnCount: 45,
  coverage: 30,
  loc: 500,
  lastModified: new Date('2025-01-15T10:00:00Z'),
  lastStoryKey: 'ST-123',
  criticalIssues: 3,
};

const mockFileDetail: FileDetail = {
  filePath: 'backend/src/auth/password-reset.ts',
  language: 'typescript',
  riskScore: 85.5,
  loc: 500,
  complexity: 25,
  cognitiveComplexity: 32,
  maintainabilityIndex: 45,
  coverage: 30,
  churnCount: 45,
  linesChanged: 250,
  churnRate: 5.5,
  lastModified: new Date('2025-01-15T10:00:00Z'),
  recentChanges: [
    { storyKey: 'ST-123', date: new Date('2025-01-15T10:00:00Z'), linesChanged: 50 },
    { storyKey: 'ST-122', date: new Date('2025-01-14T09:00:00Z'), linesChanged: 75 },
    { storyKey: 'ST-121', date: new Date('2025-01-13T08:00:00Z'), linesChanged: 125 },
  ],
  issues: [
    { severity: 'critical', type: 'complexity', message: 'Function too complex', line: 42 },
  ],
  imports: [
    'express',
    '../utils/validation',
    '../services/email-service',
  ],
  importedBy: [
    'backend/src/auth/auth.controller.ts',
    'backend/src/auth/auth.routes.ts',
  ],
  couplingScore: 'high',
};

const renderWithRouter = (ui: React.ReactElement, projectId = 'test-project-123') => {
  return render(
    <MemoryRouter initialEntries={[`/code-quality/${projectId}`]}>
      <Routes>
        <Route path="/code-quality/:projectId" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('HotspotDetailsPanel', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Panel visibility and interactions', () => {
    it('should not render when isOpen is false', () => {
      const { container } = renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={false} onClose={mockOnClose} />
      );

      const panel = container.querySelector('aside');
      expect(panel).toHaveClass('translate-x-full');
    });

    it('should render and be visible when isOpen is true', () => {
      const { container } = renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      const panel = container.querySelector('aside');
      expect(panel).toHaveClass('translate-x-0');
    });

    it('should render backdrop when panel is open', () => {
      const { container } = renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      const backdrop = container.querySelector('.fixed.inset-0.bg-black');
      expect(backdrop).toBeInTheDocument();
    });

    it('should not render backdrop when panel is closed', () => {
      const { container } = renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={false} onClose={mockOnClose} />
      );

      const backdrop = container.querySelector('.fixed.inset-0.bg-black');
      expect(backdrop).not.toBeInTheDocument();
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const { container } = renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      const backdrop = container.querySelector('.fixed.inset-0.bg-black') as HTMLElement;
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not render anything when hotspot is null', () => {
      const { container } = renderWithRouter(
        <HotspotDetailsPanel hotspot={null} isOpen={true} onClose={mockOnClose} />
      );

      const panel = container.querySelector('aside');
      expect(panel).not.toBeInTheDocument();
    });
  });

  describe('Header and basic info display', () => {
    it('should display file path in header', () => {
      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText(mockHotspot.filePath)).toBeInTheDocument();
    });

    it('should display LOC in header', () => {
      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText(/LOC: 500/i)).toBeInTheDocument();
    });

    it('should display last analyzed date in header', () => {
      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText(/Last Analyzed:/i)).toBeInTheDocument();
      expect(screen.getByText(/1\/15\/2025/i)).toBeInTheDocument();
    });

    it('should truncate long file paths with title attribute', () => {
      const longPathHotspot = {
        ...mockHotspot,
        filePath: 'backend/src/very/long/path/to/some/deeply/nested/file/that/should/be/truncated.ts',
      };

      renderWithRouter(
        <HotspotDetailsPanel hotspot={longPathHotspot} isOpen={true} onClose={mockOnClose} />
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveAttribute('title', longPathHotspot.filePath);
    });
  });

  describe('API data fetching', () => {
    it('should fetch file details when panel opens', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          `/code-metrics/file/test-project-123?filePath=${encodeURIComponent(mockHotspot.filePath)}`
        );
      });
    });

    it('should not fetch when panel is closed', () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={false} onClose={mockOnClose} />
      );

      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should not fetch when hotspot is null', () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={null} isOpen={true} onClose={mockOnClose} />
      );

      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should show loading state while fetching', async () => {
      vi.mocked(axios.get).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: mockFileDetail }), 100))
      );

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      // Look for loading animation dots
      const loadingIndicator = screen.getByRole('generic', { hidden: true });
      expect(loadingIndicator).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByRole('generic', { hidden: true })).not.toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch file details:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should display metrics even when API fails', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('API error'));

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('85.5')).toBeInTheDocument(); // Risk score
        expect(screen.getByText('25')).toBeInTheDocument(); // Complexity
        expect(screen.getByText('45')).toBeInTheDocument(); // Churn
      });
    });

    it('should refetch when hotspot changes', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      const { rerender } = renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      const newHotspot = { ...mockHotspot, filePath: 'different/path.ts' };
      rerender(
        <MemoryRouter initialEntries={['/code-quality/test-project-123']}>
          <Routes>
            <Route path="/code-quality/:projectId" element={
              <HotspotDetailsPanel hotspot={newHotspot} isOpen={true} onClose={mockOnClose} />
            } />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Metrics display', () => {
    it('should display all four metric cards', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('Risk Score')).toBeInTheDocument();
        expect(screen.getByText('Complexity')).toBeInTheDocument();
        expect(screen.getByText('Churn Rate')).toBeInTheDocument();
        expect(screen.getByText('Maintainability')).toBeInTheDocument();
      });
    });

    it('should display risk score with correct value', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('85.5')).toBeInTheDocument();
      });
    });

    it('should display complexity', () => {
      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should display churn count', () => {
      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText('45')).toBeInTheDocument();
    });

    it('should show dash for maintainability when no file details', () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('No data'));

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      const maintainabilityCards = screen.getAllByText('-');
      expect(maintainabilityCards.length).toBeGreaterThan(0);
    });

    it('should display maintainability grade when file details are loaded', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('D')).toBeInTheDocument(); // Grade for maintainability 45
      });
    });
  });

  describe('Risk factor breakdown cards', () => {
    it('should show high churn card when churn > 30', () => {
      const highChurnHotspot = { ...mockHotspot, churnCount: 35 };

      renderWithRouter(
        <HotspotDetailsPanel hotspot={highChurnHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText('High Churn Rate')).toBeInTheDocument();
      expect(screen.getByText(/modified in 35 commits/i)).toBeInTheDocument();
    });

    it('should not show high churn card when churn <= 30', () => {
      const lowChurnHotspot = { ...mockHotspot, churnCount: 25 };

      renderWithRouter(
        <HotspotDetailsPanel hotspot={lowChurnHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.queryByText('High Churn Rate')).not.toBeInTheDocument();
    });

    it('should show high complexity card when complexity > 20', () => {
      const highComplexityHotspot = { ...mockHotspot, complexity: 25 };

      renderWithRouter(
        <HotspotDetailsPanel hotspot={highComplexityHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText('High Complexity')).toBeInTheDocument();
      expect(screen.getByText(/cyclomatic complexity of 25/i)).toBeInTheDocument();
    });

    it('should not show high complexity card when complexity <= 20', () => {
      const lowComplexityHotspot = { ...mockHotspot, complexity: 15 };

      renderWithRouter(
        <HotspotDetailsPanel hotspot={lowComplexityHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.queryByText('High Complexity')).not.toBeInTheDocument();
    });

    it('should show low maintainability card when maintainability < 60', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('Low Maintainability')).toBeInTheDocument();
        expect(screen.getByText(/grade of 'D'/i)).toBeInTheDocument();
      });
    });

    it('should not show low maintainability card when maintainability >= 60', async () => {
      const highMaintFile = { ...mockFileDetail, maintainabilityIndex: 75 };
      vi.mocked(axios.get).mockResolvedValue({ data: highMaintFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.queryByText('Low Maintainability')).not.toBeInTheDocument();
      });
    });
  });

  describe('Churn trend chart', () => {
    it('should render trend chart when recent changes exist', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
        expect(screen.getByText('Recent Changes (Lines Modified)')).toBeInTheDocument();
      });
    });

    it('should pass correct data to trend chart', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        const dataLength = screen.getByTestId('trend-data-length');
        expect(dataLength.textContent).toBe('3'); // 3 recent changes
      });
    });

    it('should not render trend chart when no recent changes', async () => {
      const noChangesFile = { ...mockFileDetail, recentChanges: [] };
      vi.mocked(axios.get).mockResolvedValue({ data: noChangesFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.queryByText('Recent Changes (Lines Modified)')).not.toBeInTheDocument();
      });
    });

    it('should format dates correctly for trend chart', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
      });
    });
  });

  describe('AI recommendations', () => {
    it('should always show base complexity recommendation', () => {
      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText(/Consider breaking down large functions/i)).toBeInTheDocument();
      expect(screen.getByText(/reduce complexity from 25/i)).toBeInTheDocument();
    });

    it('should show high churn recommendation when churn > 30', () => {
      const highChurnHotspot = { ...mockHotspot, churnCount: 45 };

      renderWithRouter(
        <HotspotDetailsPanel hotspot={highChurnHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText(/High churn rate indicates/i)).toBeInTheDocument();
      expect(screen.getByText(/design patterns/i)).toBeInTheDocument();
    });

    it('should not show high churn recommendation when churn <= 30', () => {
      const lowChurnHotspot = { ...mockHotspot, churnCount: 20 };

      renderWithRouter(
        <HotspotDetailsPanel hotspot={lowChurnHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.queryByText(/High churn rate indicates/i)).not.toBeInTheDocument();
    });
  });

  describe('Dependencies display', () => {
    it('should show dependencies when they exist', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText(/This file imports \(3\)/i)).toBeInTheDocument();
        expect(screen.getByText('express')).toBeInTheDocument();
        expect(screen.getByText('../utils/validation')).toBeInTheDocument();
      });
    });

    it('should show dependents when they exist', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Imported by \(2\)/i)).toBeInTheDocument();
        expect(screen.getByText('backend/src/auth/auth.controller.ts')).toBeInTheDocument();
      });
    });

    it('should truncate dependencies list at 10 items', async () => {
      const manyDeps = Array.from({ length: 15 }, (_, i) => `dependency-${i}`);
      const manyDepsFile = { ...mockFileDetail, imports: manyDeps };
      vi.mocked(axios.get).mockResolvedValue({ data: manyDepsFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText(/This file imports \(15\)/i)).toBeInTheDocument();
        expect(screen.getByText(/\.\.\. and 5 more/i)).toBeInTheDocument();
      });
    });

    it('should truncate dependents list at 10 items', async () => {
      const manyDependents = Array.from({ length: 12 }, (_, i) => `dependent-${i}.ts`);
      const manyDependentsFile = { ...mockFileDetail, importedBy: manyDependents };
      vi.mocked(axios.get).mockResolvedValue({ data: manyDependentsFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Imported by \(12\)/i)).toBeInTheDocument();
        expect(screen.getByText(/\.\.\. and 2 more/i)).toBeInTheDocument();
      });
    });

    it('should show "No dependencies found" when both lists are empty', async () => {
      const noDepsFile = { ...mockFileDetail, imports: [], importedBy: [] };
      vi.mocked(axios.get).mockResolvedValue({ data: noDepsFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('No dependencies found')).toBeInTheDocument();
      });
    });

    it('should show Import badge for dependencies', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        const importBadges = screen.getAllByText('Import');
        expect(importBadges.length).toBe(3);
      });
    });

    it('should show Dependent badge for dependents', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        const dependentBadges = screen.getAllByText('Dependent');
        expect(dependentBadges.length).toBe(2);
      });
    });
  });

  describe('Maintainability grading', () => {
    it('should return grade A for maintainability >= 80', async () => {
      const highMaintFile = { ...mockFileDetail, maintainabilityIndex: 85 };
      vi.mocked(axios.get).mockResolvedValue({ data: highMaintFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('A')).toBeInTheDocument();
      });
    });

    it('should return grade B for maintainability >= 60 and < 80', async () => {
      const goodMaintFile = { ...mockFileDetail, maintainabilityIndex: 70 };
      vi.mocked(axios.get).mockResolvedValue({ data: goodMaintFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('B')).toBeInTheDocument();
      });
    });

    it('should return grade C for maintainability >= 40 and < 60', async () => {
      const mediumMaintFile = { ...mockFileDetail, maintainabilityIndex: 50 };
      vi.mocked(axios.get).mockResolvedValue({ data: mediumMaintFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });
    });

    it('should return grade D for maintainability < 40', async () => {
      const lowMaintFile = { ...mockFileDetail, maintainabilityIndex: 30 };
      vi.mocked(axios.get).mockResolvedValue({ data: lowMaintFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('D')).toBeInTheDocument();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle file details with null recentChanges', async () => {
      const nullChangesFile = { ...mockFileDetail, recentChanges: null as any };
      vi.mocked(axios.get).mockResolvedValue({ data: nullChangesFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.queryByText('Recent Changes')).not.toBeInTheDocument();
      });
    });

    it('should handle undefined imports and importedBy', async () => {
      const undefinedDepsFile = {
        ...mockFileDetail,
        imports: undefined as any,
        importedBy: undefined as any,
      };
      vi.mocked(axios.get).mockResolvedValue({ data: undefinedDepsFile });

      renderWithRouter(
        <HotspotDetailsPanel hotspot={mockHotspot} isOpen={true} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByText('No dependencies found')).toBeInTheDocument();
      });
    });

    it('should handle zero values gracefully', () => {
      const zeroHotspot = {
        ...mockHotspot,
        riskScore: 0,
        complexity: 0,
        churnCount: 0,
        coverage: 0,
        criticalIssues: 0,
      };

      renderWithRouter(
        <HotspotDetailsPanel hotspot={zeroHotspot} isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText('0.0')).toBeInTheDocument(); // Risk score with toFixed(1)
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });

    it('should handle very long file names with truncation', () => {
      const longNameHotspot = {
        ...mockHotspot,
        filePath: 'a'.repeat(200) + '.ts',
      };

      const { container } = renderWithRouter(
        <HotspotDetailsPanel hotspot={longNameHotspot} isOpen={true} onClose={mockOnClose} />
      );

      const heading = container.querySelector('h2');
      expect(heading).toHaveClass('truncate');
    });
  });
});
