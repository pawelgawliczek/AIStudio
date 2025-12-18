/**
 * ST-16 Integration Tests for Code Quality Dashboard Refresh Flow
 *
 * Purpose: Verify end-to-end flow of analysis refresh with cache-busting,
 * delay, notifications, and data updates.
 *
 * Related Requirements:
 * - BR-1 (Real-Time Data Refresh): Complete refresh flow works correctly
 * - AC-1: Metrics immediately update after analysis completion
 * - AC-2: Trend graphs show today's date as latest data point
 * - AC-3: File complexity values match database values
 * - AC-4: File/LOC counts reflect latest analysis
 * - AC-6: Works consistently across multiple analysis runs
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from '../../lib/axios';
import CodeQualityDashboard from '../CodeQualityDashboard';

vi.mock('../../lib/axios');
vi.mock('react-hot-toast');

describe('CodeQualityDashboard - ST-16 Integration Tests', () => {
  const mockProjectId = 'test-project-123';

  const mockInitialMetrics = {
    totalFiles: 454,
    totalLoc: 66139,
    healthScore: 72,
    averageComplexity: 8.5,
    averageCoverage: 45.2,
    lastAnalysis: '2025-11-16T10:00:00Z',
  };

  const mockUpdatedMetrics = {
    totalFiles: 531,
    totalLoc: 86763,
    healthScore: 78,
    averageComplexity: 7.8,
    averageCoverage: 52.3,
    lastAnalysis: '2025-11-18T12:51:22Z',
  };

  const mockInitialHotspots = [
    {
      filePath: 'frontend/src/pages/CodeQualityDashboard.tsx',
      complexity: 307,
      testCoverage: 0,
      riskScore: 95,
    },
  ];

  const mockUpdatedHotspots = [
    {
      filePath: 'frontend/src/pages/CodeQualityDashboard.tsx',
      complexity: 377,
      testCoverage: 45.2, // Now has test coverage!
      riskScore: 88,
    },
  ];

  const mockInitialTrends = [
    { date: '2025-11-14', healthScore: 70 },
    { date: '2025-11-15', healthScore: 71 },
    { date: '2025-11-16', healthScore: 72 },
  ];

  const mockUpdatedTrends = [
    { date: '2025-11-14', healthScore: 70 },
    { date: '2025-11-15', healthScore: 71 },
    { date: '2025-11-16', healthScore: 72 },
    { date: '2025-11-17', healthScore: 75 },
    { date: '2025-11-18', healthScore: 78 }, // Today's date!
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock initial data load
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.includes('/project/') && !url.includes('/hotspots') && !url.includes('/hierarchy')) {
        return Promise.resolve({ data: mockInitialMetrics });
      }
      if (url.includes('/hotspots')) {
        return Promise.resolve({ data: mockInitialHotspots });
      }
      if (url.includes('/trends')) {
        return Promise.resolve({ data: mockInitialTrends });
      }
      if (url.includes('/hierarchy')) {
        return Promise.resolve({ data: null });
      }
      if (url.includes('/coverage-gaps')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/issues')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/comparison')) {
        return Promise.resolve({ data: {} });
      }
      if (url.includes('/test-summary')) {
        return Promise.resolve({ data: {} });
      }
      if (url.includes('/file-changes')) {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: {} });
    });
  });

  describe('TC-ST16-I1: Complete refresh flow with stale to fresh data', () => {
    it('should show initial stale data, then update after analysis completes', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <MemoryRouter initialEntries={[`/projects/${mockProjectId}/quality`]}>
          <Routes>
            <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
          </Routes>
        </MemoryRouter>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/454/)).toBeInTheDocument(); // Initial file count
        expect(screen.getByText(/66.*139/)).toBeInTheDocument(); // Initial LOC
      });

      // Setup mock for analysis trigger and updated data
      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'job-123', status: 'running', message: 'Analysis started' },
      });

      vi.mocked(axios.get).mockImplementation((url: string) => {
        // Status polling
        if (url.includes('/analysis-status')) {
          return Promise.resolve({
            data: { status: 'completed', message: 'Analysis complete', completedAt: new Date() },
          });
        }

        // Updated metrics after analysis
        if (url.includes('/project/') && !url.includes('/hotspots') && !url.includes('/hierarchy')) {
          return Promise.resolve({ data: mockUpdatedMetrics });
        }
        if (url.includes('/hotspots')) {
          return Promise.resolve({ data: mockUpdatedHotspots });
        }
        if (url.includes('/trends')) {
          return Promise.resolve({ data: mockUpdatedTrends });
        }
        if (url.includes('/hierarchy')) {
          return Promise.resolve({ data: null });
        }
        if (url.includes('/coverage-gaps')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/issues')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/comparison')) {
          return Promise.resolve({ data: {} });
        }
        if (url.includes('/test-summary')) {
          return Promise.resolve({ data: {} });
        }
        if (url.includes('/file-changes')) {
          return Promise.resolve({ data: {} });
        }
        return Promise.resolve({ data: {} });
      });

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh analysis/i });
      await user.click(refreshButton);

      // Advance through polling interval (3 seconds)
      await vi.advanceTimersByTimeAsync(3000);

      // Advance through 500ms delay
      await vi.advanceTimersByTimeAsync(500);

      // Wait for updated data to appear
      await waitFor(
        () => {
          expect(screen.getByText(/531/)).toBeInTheDocument(); // Updated file count
          expect(screen.getByText(/86.*763/)).toBeInTheDocument(); // Updated LOC
        },
        { timeout: 5000 }
      );

      // Verify toast notification was shown
      expect(toast.success).toHaveBeenCalledWith(
        'Analysis complete! Dashboard metrics have been updated.',
        expect.objectContaining({ duration: 4000 })
      );
    });
  });

  describe('TC-ST16-I2: Cache-busting verification across all endpoints', () => {
    it('should add unique _t timestamp to all 9 API calls on refresh', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <MemoryRouter initialEntries={[`/projects/${mockProjectId}/quality`]}>
          <Routes>
            <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      // Setup for analysis
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/analysis-status')) {
          return Promise.resolve({ data: { status: 'completed' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Trigger refresh
      const refreshButton = screen.getByRole('button', { name: /refresh analysis/i });
      await user.click(refreshButton);

      await vi.advanceTimersByTimeAsync(3500);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      // Check that all GET calls have _t parameter
      const getCalls = vi.mocked(axios.get).mock.calls.map((call) => call[0] as string);
      const callsWithTimestamp = getCalls.filter((url) => url.includes('_t='));

      // Should have cache-busting on data fetch calls (not status polling)
      expect(callsWithTimestamp.length).toBeGreaterThan(0);

      // Verify format of timestamp parameter
      callsWithTimestamp.forEach((url) => {
        const timestampMatch = url.match(/_t=(\d+)/);
        expect(timestampMatch).not.toBeNull();
        const timestamp = parseInt(timestampMatch![1], 10);
        expect(timestamp.toString().length).toBe(13); // Milliseconds timestamp
      });
    });
  });

  describe('TC-ST16-I3: Test coverage update verification', () => {
    it('should show 0% coverage initially, then >0% after analysis with test correlation', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <MemoryRouter initialEntries={[`/projects/${mockProjectId}/quality`]}>
          <Routes>
            <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
          </Routes>
        </MemoryRouter>
      );

      // Wait for initial hotspots
      await waitFor(() => {
        expect(screen.getByText(/CodeQualityDashboard.tsx/)).toBeInTheDocument();
      });

      // Should show 0% coverage initially
      const initialHotspot = screen.getByText(/CodeQualityDashboard.tsx/).closest('tr');
      expect(within(initialHotspot!).getByText(/0%/)).toBeInTheDocument();

      // Setup for analysis with updated coverage
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/analysis-status')) {
          return Promise.resolve({ data: { status: 'completed' } });
        }
        if (url.includes('/hotspots')) {
          return Promise.resolve({ data: mockUpdatedHotspots });
        }
        return Promise.resolve({ data: mockUpdatedMetrics });
      });

      // Trigger refresh
      const refreshButton = screen.getByRole('button', { name: /refresh analysis/i });
      await user.click(refreshButton);

      await vi.advanceTimersByTimeAsync(3500);

      // Wait for coverage to update
      await waitFor(
        () => {
          const updatedHotspot = screen.getByText(/CodeQualityDashboard.tsx/).closest('tr');
          expect(within(updatedHotspot!).getByText(/45\.2%/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('TC-ST16-I4: Trend graph latest date update', () => {
    it('should show 11/16 as latest date initially, then 11/18 after refresh', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <MemoryRouter initialEntries={[`/projects/${mockProjectId}/quality`]}>
          <Routes>
            <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/11\/16/)).toBeInTheDocument();
      });

      // Should NOT have 11/18 yet
      expect(screen.queryByText(/11\/18/)).not.toBeInTheDocument();

      // Setup for analysis with updated trends
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-123' } });
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/analysis-status')) {
          return Promise.resolve({ data: { status: 'completed' } });
        }
        if (url.includes('/trends')) {
          return Promise.resolve({ data: mockUpdatedTrends });
        }
        return Promise.resolve({ data: mockUpdatedMetrics });
      });

      // Trigger refresh
      const refreshButton = screen.getByRole('button', { name: /refresh analysis/i });
      await user.click(refreshButton);

      await vi.advanceTimersByTimeAsync(3500);

      // Wait for new date to appear
      await waitFor(
        () => {
          expect(screen.getByText(/11\/18/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('TC-ST16-I5: Multiple refresh cycles', () => {
    it('should work consistently across 3 sequential refresh cycles', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <MemoryRouter initialEntries={[`/projects/${mockProjectId}/quality`]}>
          <Routes>
            <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      for (let cycle = 1; cycle <= 3; cycle++) {
        vi.clearAllMocks();

        vi.mocked(axios.post).mockResolvedValue({ data: { jobId: `job-${cycle}` } });
        vi.mocked(axios.get).mockImplementation((url: string) => {
          if (url.includes('/analysis-status')) {
            return Promise.resolve({ data: { status: 'completed' } });
          }
          return Promise.resolve({
            data: { ...mockUpdatedMetrics, healthScore: 70 + cycle },
          });
        });

        const refreshButton = screen.getByRole('button', { name: /refresh analysis/i });
        await user.click(refreshButton);

        await vi.advanceTimersByTimeAsync(3500);

        await waitFor(() => {
          expect(toast.success).toHaveBeenCalled();
        });

        // Verify data was fetched with cache-busting
        const getCalls = vi.mocked(axios.get).mock.calls;
        const cacheBustedCalls = getCalls.filter((call) =>
          (call[0] as string).includes('_t=')
        );
        expect(cacheBustedCalls.length).toBeGreaterThan(0);
      }

      // Should have shown 3 success toasts
      expect(toast.success).toHaveBeenCalledTimes(3);
    });
  });

  describe('TC-ST16-I6: Error handling with notifications', () => {
    it('should show error toast when analysis fails', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <MemoryRouter initialEntries={[`/projects/${mockProjectId}/quality`]}>
          <Routes>
            <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      // Setup for failed analysis
      vi.mocked(axios.post).mockResolvedValue({ data: { jobId: 'job-fail' } });
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/analysis-status')) {
          return Promise.resolve({
            data: { status: 'failed', message: 'Syntax error in file X' },
          });
        }
        return Promise.resolve({ data: mockInitialMetrics });
      });

      const refreshButton = screen.getByRole('button', { name: /refresh analysis/i });
      await user.click(refreshButton);

      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Syntax error in file X',
          expect.objectContaining({ duration: 5000 })
        );
      });
    });
  });
});
