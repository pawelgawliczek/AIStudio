/**
 * Integration tests for CodeQualityDashboard
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from '../../lib/axios';
import CodeQualityDashboard from '../CodeQualityDashboard';

vi.mock('../../lib/axios');

const mockMetrics = {
  healthScore: {
    overallScore: 75,
    coverage: 70,
    complexity: 8,
    techDebtRatio: 15,
    trend: 'stable',
    weeklyChange: 1,
  },
  totalLoc: 10000,
  locByLanguage: { typescript: 8000, javascript: 2000 },
  securityIssues: { critical: 1, high: 2, medium: 5, low: 10 },
  lastUpdate: new Date(),
};

describe('CodeQualityDashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({ data: mockMetrics });
  });

  it('should render dashboard with metrics', async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.includes('/project/')) {
        return Promise.resolve({ data: mockMetrics });
      }
      if (url.includes('/hotspots')) {
        return Promise.resolve({ data: [] });
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
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={['/projects/test-id/quality']}>
        <Routes>
          <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Code Quality Overview')).toBeInTheDocument();
    });
  });

  it('should handle loading state', () => {
    render(
      <MemoryRouter initialEntries={['/projects/test-id/quality']}>
        <Routes>
          <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should handle error state', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Failed to load'));

    render(
      <MemoryRouter initialEntries={['/projects/test-id/quality']}>
        <Routes>
          <Route path="/projects/:projectId/quality" element={<CodeQualityDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeTruthy();
    });
  });
});
