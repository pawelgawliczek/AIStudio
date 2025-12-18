/**
 * ST-137: Test Execution Service Tests
 * Tests for analytics methods (getFlakyTests, getSlowTests, getTestPerformanceTrends)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../api.client';
import { testExecutionService } from '../test-execution.service';

vi.mock('../api.client');

describe('testExecutionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // getFlakyTests() TESTS
  // ============================================================================

  describe('getFlakyTests', () => {
    it('should call API with correct URL and parameters', async () => {
      const mockResponse = {
        data: [
          {
            testKey: 'TC-AUTH-001',
            title: 'User login test',
            testLevel: 'integration',
            totalRuns: 100,
            passCount: 70,
            failCount: 30,
            passRate: 0.7,
            failRate: 0.3,
            lastFailedAt: '2025-01-15T10:00:00Z',
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await testExecutionService.getFlakyTests('project-123', 30, 0.1);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/test-executions/analytics/flaky-tests?projectId=project-123&days=30&threshold=0.1'
      );
    });

    it('should return flaky tests data from API response', async () => {
      const mockData = [
        {
          testKey: 'TC-AUTH-001',
          title: 'User login test',
          testLevel: 'integration',
          totalRuns: 100,
          passCount: 70,
          failCount: 30,
          passRate: 0.7,
          failRate: 0.3,
          lastFailedAt: '2025-01-15T10:00:00Z',
        },
        {
          testKey: 'TC-AUTH-002',
          title: 'Password reset test',
          testLevel: 'e2e',
          totalRuns: 50,
          passCount: 45,
          failCount: 5,
          passRate: 0.9,
          failRate: 0.1,
          lastFailedAt: '2025-01-14T08:00:00Z',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getFlakyTests('project-123', 30, 0.1);

      expect(result).toEqual(mockData);
      expect(result).toHaveLength(2);
    });

    it('should handle custom days parameter', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getFlakyTests('project-123', 7, 0.1);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('days=7')
      );
    });

    it('should handle custom threshold parameter', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getFlakyTests('project-123', 30, 0.2);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('threshold=0.2')
      );
    });

    it('should use default parameters when not provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getFlakyTests('project-123');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/test-executions/analytics/flaky-tests?projectId=project-123&days=30&threshold=0.1'
      );
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(
        testExecutionService.getFlakyTests('project-123', 30, 0.1)
      ).rejects.toThrow('API Error');
    });

    it('should handle empty response array', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      const result = await testExecutionService.getFlakyTests('project-123', 30, 0.1);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should encode URL parameters correctly', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getFlakyTests('project-with-special-chars-#123', 30, 0.15);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/projectId=project-with-special-chars-%23123/)
      );
    });

    it('should handle null lastFailedAt in response', async () => {
      const mockData = [
        {
          testKey: 'TC-AUTH-001',
          title: 'User login test',
          testLevel: 'integration',
          totalRuns: 100,
          passCount: 70,
          failCount: 30,
          passRate: 0.7,
          failRate: 0.3,
          lastFailedAt: null,
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getFlakyTests('project-123', 30, 0.1);

      expect(result[0].lastFailedAt).toBeNull();
    });
  });

  // ============================================================================
  // getSlowTests() TESTS
  // ============================================================================

  describe('getSlowTests', () => {
    it('should call API with correct URL and parameters', async () => {
      const mockResponse = {
        data: [
          {
            testKey: 'TC-E2E-001',
            title: 'Full checkout flow',
            testLevel: 'e2e',
            avgDurationMs: 15000,
            maxDurationMs: 18000,
            runCount: 50,
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await testExecutionService.getSlowTests('project-123', 10);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/test-executions/analytics/slow-tests?projectId=project-123&limit=10'
      );
    });

    it('should return slow tests data from API response', async () => {
      const mockData = [
        {
          testKey: 'TC-E2E-001',
          title: 'Full checkout flow',
          testLevel: 'e2e',
          avgDurationMs: 15000,
          maxDurationMs: 18000,
          runCount: 50,
        },
        {
          testKey: 'TC-INT-001',
          title: 'Database migration',
          testLevel: 'integration',
          avgDurationMs: 7500,
          maxDurationMs: 9000,
          runCount: 30,
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getSlowTests('project-123', 10);

      expect(result).toEqual(mockData);
      expect(result).toHaveLength(2);
    });

    it('should handle custom limit parameter', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getSlowTests('project-123', 20);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=20')
      );
    });

    it('should use default limit when not provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getSlowTests('project-123');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/test-executions/analytics/slow-tests?projectId=project-123&limit=10'
      );
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(
        testExecutionService.getSlowTests('project-123', 10)
      ).rejects.toThrow('API Error');
    });

    it('should handle empty response array', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      const result = await testExecutionService.getSlowTests('project-123', 10);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle single slow test', async () => {
      const mockData = [
        {
          testKey: 'TC-E2E-001',
          title: 'Full checkout flow',
          testLevel: 'e2e',
          avgDurationMs: 15000,
          maxDurationMs: 18000,
          runCount: 50,
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getSlowTests('project-123', 1);

      expect(result).toHaveLength(1);
      expect(result[0].testKey).toBe('TC-E2E-001');
    });

    it('should handle large limit values', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getSlowTests('project-123', 100);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=100')
      );
    });

    it('should preserve numeric precision for durations', async () => {
      const mockData = [
        {
          testKey: 'TC-E2E-001',
          title: 'Full checkout flow',
          testLevel: 'e2e',
          avgDurationMs: 15234.567,
          maxDurationMs: 18901.234,
          runCount: 50,
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getSlowTests('project-123', 10);

      expect(result[0].avgDurationMs).toBe(15234.567);
      expect(result[0].maxDurationMs).toBe(18901.234);
    });
  });

  // ============================================================================
  // getTestPerformanceTrends() TESTS
  // ============================================================================

  describe('getTestPerformanceTrends', () => {
    it('should call API with correct URL and parameters', async () => {
      const mockResponse = {
        data: {
          trends: [
            {
              date: '2025-01-15',
              totalTests: 100,
              passRate: 95.5,
              avgDurationMs: 1500,
              coverage: 85.2,
            },
          ],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await testExecutionService.getTestPerformanceTrends('project-123', 30);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/test-executions/analytics/trends?projectId=project-123&days=30'
      );
    });

    it('should return trends data from API response', async () => {
      const mockData = {
        trends: [
          {
            date: '2025-01-15',
            totalTests: 100,
            passRate: 95.5,
            avgDurationMs: 1500,
            coverage: 85.2,
          },
          {
            date: '2025-01-14',
            totalTests: 98,
            passRate: 94.0,
            avgDurationMs: 1550,
            coverage: 84.5,
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getTestPerformanceTrends('project-123', 30);

      expect(result).toEqual(mockData);
      expect(result.trends).toHaveLength(2);
    });

    it('should handle custom days parameter', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { trends: [] } });

      await testExecutionService.getTestPerformanceTrends('project-123', 7);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('days=7')
      );
    });

    it('should use default days when not provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { trends: [] } });

      await testExecutionService.getTestPerformanceTrends('project-123');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/test-executions/analytics/trends?projectId=project-123&days=30'
      );
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(
        testExecutionService.getTestPerformanceTrends('project-123', 30)
      ).rejects.toThrow('API Error');
    });

    it('should handle empty trends array', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { trends: [] } });

      const result = await testExecutionService.getTestPerformanceTrends('project-123', 30);

      expect(result.trends).toEqual([]);
      expect(result.trends).toHaveLength(0);
    });

    it('should handle multiple data points for trend analysis', async () => {
      const mockData = {
        trends: Array.from({ length: 30 }, (_, i) => ({
          date: `2025-01-${String(i + 1).padStart(2, '0')}`,
          totalTests: 100 + i,
          passRate: 95.0 + (i * 0.1),
          avgDurationMs: 1500 - (i * 10),
          coverage: 85.0 + (i * 0.2),
        })),
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getTestPerformanceTrends('project-123', 30);

      expect(result.trends).toHaveLength(30);
      expect(result.trends[0].date).toBe('2025-01-01');
      expect(result.trends[29].date).toBe('2025-01-30');
    });

    it('should preserve numeric precision for metrics', async () => {
      const mockData = {
        trends: [
          {
            date: '2025-01-15',
            totalTests: 100,
            passRate: 95.567,
            avgDurationMs: 1500.234,
            coverage: 85.123,
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getTestPerformanceTrends('project-123', 30);

      expect(result.trends[0].passRate).toBe(95.567);
      expect(result.trends[0].avgDurationMs).toBe(1500.234);
      expect(result.trends[0].coverage).toBe(85.123);
    });

    it('should handle different time ranges', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { trends: [] } });

      await testExecutionService.getTestPerformanceTrends('project-123', 90);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('days=90')
      );
    });

    it('should handle single day trend', async () => {
      const mockData = {
        trends: [
          {
            date: '2025-01-15',
            totalTests: 100,
            passRate: 95.5,
            avgDurationMs: 1500,
            coverage: 85.2,
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await testExecutionService.getTestPerformanceTrends('project-123', 1);

      expect(result.trends).toHaveLength(1);
    });
  });

  // ============================================================================
  // URL ENCODING AND EDGE CASES
  // ============================================================================

  describe('URL Encoding and Edge Cases', () => {
    it('should encode special characters in projectId for getFlakyTests', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getFlakyTests('project/with/slashes', 30, 0.1);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/projectId=project%2Fwith%2Fslashes/)
      );
    });

    it('should encode special characters in projectId for getSlowTests', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getSlowTests('project&with&ampersands', 10);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/projectId=project%26with%26ampersands/)
      );
    });

    it('should encode special characters in projectId for getTestPerformanceTrends', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { trends: [] } });

      await testExecutionService.getTestPerformanceTrends('project?with?question', 30);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/projectId=project%3Fwith%3Fquestion/)
      );
    });

    it('should handle zero threshold for getFlakyTests', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getFlakyTests('project-123', 30, 0);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('threshold=0')
      );
    });

    it('should handle zero limit for getSlowTests', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await testExecutionService.getSlowTests('project-123', 0);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=0')
      );
    });

    it('should handle negative days parameter gracefully', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { trends: [] } });

      await testExecutionService.getTestPerformanceTrends('project-123', -7);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('days=-7')
      );
    });
  });
});
