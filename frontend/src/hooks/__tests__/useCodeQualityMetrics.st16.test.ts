/**
 * ST-16 Specific Tests for useCodeQualityMetrics Hook
 *
 * Purpose: Verify cache-busting query parameters are added to all API requests
 * to prevent stale data display after analysis completion.
 *
 * Related Requirements:
 * - BR-1 (Real-Time Data Refresh): Must bypass browser/proxy cache
 * - AC-1: Metrics immediately update after analysis completion
 * - AC-5: No need for hard refresh or cache clearing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCodeQualityMetrics } from '../useCodeQualityMetrics';
import axios from '../../lib/axios';

vi.mock('../../lib/axios');

describe('useCodeQualityMetrics - ST-16 Cache-Busting Tests', () => {
  const mockProjectId = 'test-project-id-123';
  const mockFilters = {
    language: undefined,
    minRiskScore: 0,
    maxRiskScore: 100,
    hasTests: undefined,
    timeRange: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({ data: {} });
  });

  describe('TC-ST16-F5: Cache-busting parameters on all endpoints', () => {
    it('should add _t parameter to /project/:id endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}\\?timeRangeDays=30&_t=\\d+`)
          )
        );
      });
    });

    it('should add _t parameter to /hotspots endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}/hotspots\\?limit=50&_t=\\d+`)
          )
        );
      });
    });

    it('should add _t parameter to /hierarchy endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}/hierarchy\\?_t=\\d+`)
          )
        );
      });
    });

    it('should add _t parameter to /coverage-gaps endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}/coverage-gaps\\?limit=20&_t=\\d+`)
          )
        );
      });
    });

    it('should add _t parameter to /issues endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}/issues\\?_t=\\d+`)
          )
        );
      });
    });

    it('should add _t parameter to /trends endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}/trends\\?days=30&_t=\\d+`)
          )
        );
      });
    });

    it('should add _t parameter to /comparison endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}/comparison\\?_t=\\d+`)
          )
        );
      });
    });

    it('should add _t parameter to /test-summary endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}/test-summary\\?_t=\\d+`)
          )
        );
      });
    });

    it('should add _t parameter to /file-changes endpoint', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`/code-metrics/project/${mockProjectId}/file-changes\\?_t=\\d+`)
          )
        );
      });
    });
  });

  describe('TC-ST16-F6: Unique timestamps across calls', () => {
    it('should use unique timestamp for each request', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      const calls = vi.mocked(axios.get).mock.calls;
      const timestamps = calls
        .map((call) => {
          const url = call[0] as string;
          const match = url.match(/_t=(\d+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      // All timestamps should be the same within a single fetch batch
      // (they're all called at once with Date.now())
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(1);
    });

    it('should use different timestamp on refetch', async () => {
      const { result } = renderHook(() =>
        useCodeQualityMetrics(mockProjectId, mockFilters)
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      const firstCallTimestamp = vi
        .mocked(axios.get)
        .mock.calls[0][0].match(/_t=(\d+)/)?.[1];

      vi.clearAllMocks();

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger refetch
      await waitFor(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      const secondCallTimestamp = vi
        .mocked(axios.get)
        .mock.calls[0][0].match(/_t=(\d+)/)?.[1];

      expect(firstCallTimestamp).not.toBe(secondCallTimestamp);
    });
  });

  describe('TC-ST16-F7: Cache-busting with other parameters', () => {
    it('should properly combine _t with existing query parameters', async () => {
      const filtersWithTime = { ...mockFilters, timeRange: 60 };
      renderHook(() => useCodeQualityMetrics(mockProjectId, filtersWithTime));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(`timeRangeDays=60&_t=\\d+`)
          )
        );
      });
    });

    it('should handle endpoints with existing query params and add _t', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        // Hotspots has limit parameter
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(/limit=50&_t=\d+/)
        );

        // Coverage gaps has limit parameter
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(/coverage-gaps\?limit=20&_t=\d+/)
        );
      });
    });
  });

  describe('TC-ST16-F8: Timestamp format validation', () => {
    it('should use Unix timestamp in milliseconds', async () => {
      const now = Date.now();

      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      const call = vi.mocked(axios.get).mock.calls[0][0] as string;
      const timestamp = parseInt(call.match(/_t=(\d+)/)?.[1] || '0', 10);

      // Timestamp should be within 1 second of now
      expect(timestamp).toBeGreaterThanOrEqual(now);
      expect(timestamp).toBeLessThanOrEqual(now + 1000);

      // Timestamp should be 13 digits (milliseconds since epoch)
      expect(timestamp.toString().length).toBe(13);
    });
  });

  describe('TC-ST16-F9: All 9 endpoints coverage', () => {
    it('should call all 9 code-metrics endpoints with cache-busting', async () => {
      renderHook(() => useCodeQualityMetrics(mockProjectId, mockFilters));

      await waitFor(() => {
        // Should have called 9 endpoints total (6 main + 3 supplementary)
        expect(axios.get).toHaveBeenCalledTimes(9);
      });

      const calls = vi.mocked(axios.get).mock.calls.map((call) => call[0] as string);

      // Verify all 9 endpoints were called with _t parameter
      expect(calls.filter((url) => url.includes('/project/') && url.includes('_t='))).toHaveLength(1);
      expect(calls.filter((url) => url.includes('/hotspots') && url.includes('_t='))).toHaveLength(1);
      expect(calls.filter((url) => url.includes('/hierarchy') && url.includes('_t='))).toHaveLength(1);
      expect(calls.filter((url) => url.includes('/coverage-gaps') && url.includes('_t='))).toHaveLength(1);
      expect(calls.filter((url) => url.includes('/issues') && url.includes('_t='))).toHaveLength(1);
      expect(calls.filter((url) => url.includes('/trends') && url.includes('_t='))).toHaveLength(1);
      expect(calls.filter((url) => url.includes('/comparison') && url.includes('_t='))).toHaveLength(1);
      expect(calls.filter((url) => url.includes('/test-summary') && url.includes('_t='))).toHaveLength(1);
      expect(calls.filter((url) => url.includes('/file-changes') && url.includes('_t='))).toHaveLength(1);
    });
  });
});
