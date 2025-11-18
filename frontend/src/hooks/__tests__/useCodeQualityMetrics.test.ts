/**
 * Tests for useCodeQualityMetrics hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCodeQualityMetrics } from '../useCodeQualityMetrics';
import axios from '../../lib/axios';

vi.mock('../../lib/axios');

const mockProjectMetrics = {
  healthScore: { overallScore: 75, coverage: 70, complexity: 8, techDebtRatio: 15 },
  totalLoc: 10000,
  locByLanguage: { typescript: 8000 },
  securityIssues: { critical: 1, high: 2, medium: 5 },
  lastUpdate: new Date().toISOString(),
};

const mockHotspots = [
  {
    filePath: 'src/test.ts',
    riskScore: 85,
    complexity: 20,
    churnCount: 10,
    coverage: 30,
    loc: 500,
    criticalIssues: 3,
  },
];

const mockHierarchy = {
  name: 'root',
  path: '',
  type: 'folder' as const,
  children: [],
  metrics: { healthScore: 75, fileCount: 10, totalLoc: 10000 },
};

const mockFilters = {
  severityFilter: 'all' as const,
  typeFilter: 'all' as const,
  showOnlyHighRisk: false,
  timeRange: 30,
};

describe('useCodeQualityMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() =>
      useCodeQualityMetrics('test-project-id', mockFilters)
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.projectMetrics).toBeNull();
    expect(result.current.hotspots).toEqual([]);
    expect(result.current.folderHierarchy).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should fetch and set all main metrics successfully', async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.includes('/project/')) {
        if (url.includes('/hotspots')) return Promise.resolve({ data: mockHotspots });
        if (url.includes('/hierarchy')) return Promise.resolve({ data: mockHierarchy });
        if (url.includes('/coverage-gaps')) return Promise.resolve({ data: [] });
        if (url.includes('/issues')) return Promise.resolve({ data: [] });
        if (url.includes('/comparison')) return Promise.resolve({ data: null });
        if (url.includes('/test-summary')) return Promise.resolve({ data: null });
        if (url.includes('/file-changes')) return Promise.resolve({ data: null });
        return Promise.resolve({ data: mockProjectMetrics });
      }
      return Promise.resolve({ data: null });
    });

    const { result } = renderHook(() =>
      useCodeQualityMetrics('test-project-id', mockFilters)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projectMetrics).toEqual(mockProjectMetrics);
    expect(result.current.hotspots).toEqual(mockHotspots);
    expect(result.current.folderHierarchy).toEqual(mockHierarchy);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors and set error state', async () => {
    const errorMessage = 'Network error';
    vi.mocked(axios.get).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() =>
      useCodeQualityMetrics('test-project-id', mockFilters)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.projectMetrics).toBeNull();
  });

  it('should handle API error responses with message', async () => {
    const errorMessage = 'Unauthorized access';
    vi.mocked(axios.get).mockRejectedValue({
      response: { data: { message: errorMessage } },
    });

    const { result } = renderHook(() =>
      useCodeQualityMetrics('test-project-id', mockFilters)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
  });

  it('should not fetch when projectId is undefined', () => {
    const { result } = renderHook(() =>
      useCodeQualityMetrics(undefined, mockFilters)
    );

    expect(result.current.loading).toBe(true);
    expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
  });

  it('should refetch data when refetch is called', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: mockProjectMetrics });

    const { result } = renderHook(() =>
      useCodeQualityMetrics('test-project-id', mockFilters)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialCallCount = vi.mocked(axios.get).mock.calls.length;

    await result.current.refetch();

    expect(vi.mocked(axios.get).mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it('should refetch when timeRange filter changes', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: mockProjectMetrics });

    const { rerender } = renderHook(
      ({ filters }) => useCodeQualityMetrics('test-project-id', filters),
      { initialProps: { filters: mockFilters } }
    );

    await waitFor(() => {
      expect(vi.mocked(axios.get)).toHaveBeenCalled();
    });

    const initialCallCount = vi.mocked(axios.get).mock.calls.length;
    vi.clearAllMocks();

    rerender({ filters: { ...mockFilters, timeRange: 60 } });

    await waitFor(() => {
      expect(vi.mocked(axios.get).mock.calls.length).toBeGreaterThan(0);
    });
  });

  it('should silently handle errors in supplementary data (comparison, tests)', async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.includes('/comparison') || url.includes('/test-summary') || url.includes('/file-changes')) {
        return Promise.reject(new Error('Supplementary data not available'));
      }
      return Promise.resolve({ data: url.includes('/hotspots') ? [] : null });
    });

    const { result } = renderHook(() =>
      useCodeQualityMetrics('test-project-id', mockFilters)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should not set error for supplementary data failures
    expect(result.current.analysisComparison).toBeNull();
    expect(result.current.testSummary).toBeNull();
    expect(result.current.fileChanges).toBeNull();
  });
});
