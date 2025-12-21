/**
 * ST-378: Transcripts Service Tests
 *
 * Tests for getTranscriptLines() method that fetches transcript lines from DB.
 * This test file uses TDD - all tests should FAIL until implementation is complete.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../api.client';
import { transcriptsService } from '../transcripts.service';

vi.mock('../api.client');

describe('transcriptsService - getTranscriptLines (ST-378)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // getTranscriptLines() TESTS - Basic Functionality
  // ============================================================================

  describe('getTranscriptLines - Basic Functionality', () => {
    it('should call API with correct URL and default parameters', async () => {
      const mockResponse = {
        data: {
          workflowRunId: 'run-123',
          sessionIndex: 0,
          lines: [],
          totalLines: 0,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/projects/project-123/workflow-runs/run-456/transcript-lines',
        { params: { sessionIndex: '0' } }
      );
    });

    it('should return transcript lines data from API response', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [
          {
            id: 'line-1',
            lineNumber: 1,
            content: '{"type":"user","content":"Hello"}',
            createdAt: '2025-12-21T10:00:00Z',
          },
          {
            id: 'line-2',
            lineNumber: 2,
            content: '{"type":"assistant","content":"Hi"}',
            createdAt: '2025-12-21T10:00:05Z',
          },
        ],
        totalLines: 2,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(result).toEqual(mockData);
      expect(result.lines).toHaveLength(2);
      expect(result.totalLines).toBe(2);
    });

    it('should handle empty lines array', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [],
        totalLines: 0,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(result.lines).toEqual([]);
      expect(result.totalLines).toBe(0);
    });
  });

  // ============================================================================
  // getTranscriptLines() TESTS - sessionIndex Parameter
  // ============================================================================

  describe('getTranscriptLines - sessionIndex Parameter', () => {
    it('should use default sessionIndex of 0 when not provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 0 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: { sessionIndex: '0' } })
      );
    });

    it('should handle custom sessionIndex parameter', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 1, lines: [], totalLines: 0 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456', 1);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: { sessionIndex: '1' } })
      );
    });

    it('should handle sessionIndex of 2 (second compaction)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 2, lines: [], totalLines: 0 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456', 2);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: { sessionIndex: '2' } })
      );
    });

    it('should handle sessionIndex of 0 explicitly', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 0 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456', 0);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: { sessionIndex: '0' } })
      );
    });
  });

  // ============================================================================
  // getTranscriptLines() TESTS - Pagination (limit & offset)
  // ============================================================================

  describe('getTranscriptLines - Pagination', () => {
    it('should not include limit/offset in params when not provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 0 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        { params: { sessionIndex: '0' } }
      );
    });

    it('should include limit parameter when provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 100 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456', 0, 50);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        { params: { sessionIndex: '0', limit: '50' } }
      );
    });

    it('should include offset parameter when provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 100 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456', 0, undefined, 20);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        { params: { sessionIndex: '0', offset: '20' } }
      );
    });

    it('should include both limit and offset when provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 100 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456', 0, 25, 50);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        { params: { sessionIndex: '0', limit: '25', offset: '50' } }
      );
    });

    it('should handle limit of 0', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 100 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456', 0, 0);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        { params: { sessionIndex: '0', limit: '0' } }
      );
    });

    it('should handle offset of 0', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 100 },
      });

      await transcriptsService.getTranscriptLines('project-123', 'run-456', 0, undefined, 0);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        { params: { sessionIndex: '0', offset: '0' } }
      );
    });
  });

  // ============================================================================
  // getTranscriptLines() TESTS - Data Integrity
  // ============================================================================

  describe('getTranscriptLines - Data Integrity', () => {
    it('should preserve line order in response', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [
          { id: 'line-1', lineNumber: 1, content: 'first', createdAt: '2025-12-21T10:00:00Z' },
          { id: 'line-2', lineNumber: 2, content: 'second', createdAt: '2025-12-21T10:00:01Z' },
          { id: 'line-3', lineNumber: 3, content: 'third', createdAt: '2025-12-21T10:00:02Z' },
        ],
        totalLines: 3,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(result.lines[0].lineNumber).toBe(1);
      expect(result.lines[1].lineNumber).toBe(2);
      expect(result.lines[2].lineNumber).toBe(3);
      expect(result.lines[0].content).toBe('first');
      expect(result.lines[1].content).toBe('second');
      expect(result.lines[2].content).toBe('third');
    });

    it('should preserve JSONL content exactly', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [
          {
            id: 'line-1',
            lineNumber: 1,
            content: '{"type":"user","content":"Test with \\"quotes\\" and \\n newlines"}',
            createdAt: '2025-12-21T10:00:00Z',
          },
        ],
        totalLines: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(result.lines[0].content).toBe('{"type":"user","content":"Test with \\"quotes\\" and \\n newlines"}');
    });

    it('should handle very large line content', async () => {
      const largeContent = 'x'.repeat(50000); // 50KB line
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [
          {
            id: 'line-1',
            lineNumber: 1,
            content: largeContent,
            createdAt: '2025-12-21T10:00:00Z',
          },
        ],
        totalLines: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(result.lines[0].content.length).toBe(50000);
    });

    it('should handle special characters in content', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [
          {
            id: 'line-1',
            lineNumber: 1,
            content: '{"content":"Special: <>&\\"\'\\t\\r\\n"}',
            createdAt: '2025-12-21T10:00:00Z',
          },
        ],
        totalLines: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456');

      expect(result.lines[0].content).toContain('<>&');
    });
  });

  // ============================================================================
  // getTranscriptLines() TESTS - Error Handling
  // ============================================================================

  describe('getTranscriptLines - Error Handling', () => {
    it('should handle API errors', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(
        transcriptsService.getTranscriptLines('project-123', 'run-456')
      ).rejects.toThrow('API Error');
    });

    it('should handle 404 errors (workflow not found)', async () => {
      const error = { response: { status: 404, data: { message: 'Workflow run not found' } } };
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(
        transcriptsService.getTranscriptLines('project-123', 'nonexistent-run')
      ).rejects.toBeTruthy();
    });

    it('should handle 403 errors (unauthorized)', async () => {
      const error = { response: { status: 403, data: { message: 'Unauthorized' } } };
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(
        transcriptsService.getTranscriptLines('project-123', 'run-456')
      ).rejects.toBeTruthy();
    });

    it('should handle network errors', async () => {
      const error = new Error('Network Error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(
        transcriptsService.getTranscriptLines('project-123', 'run-456')
      ).rejects.toThrow('Network Error');
    });

    it('should handle timeout errors', async () => {
      const error = { code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' };
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(
        transcriptsService.getTranscriptLines('project-123', 'run-456')
      ).rejects.toBeTruthy();
    });
  });

  // ============================================================================
  // getTranscriptLines() TESTS - URL Encoding & Edge Cases
  // ============================================================================

  describe('getTranscriptLines - URL Encoding & Edge Cases', () => {
    it('should encode special characters in projectId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: 'run-123', sessionIndex: 0, lines: [], totalLines: 0 },
      });

      await transcriptsService.getTranscriptLines('project/with/slashes', 'run-456');

      // apiClient.get should receive the raw path (axios handles encoding)
      expect(apiClient.get).toHaveBeenCalledWith(
        '/projects/project/with/slashes/workflow-runs/run-456/transcript-lines',
        expect.any(Object)
      );
    });

    it('should handle UUIDs correctly in runId', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { workflowRunId: uuid, sessionIndex: 0, lines: [], totalLines: 0 },
      });

      await transcriptsService.getTranscriptLines('project-123', uuid);

      expect(apiClient.get).toHaveBeenCalledWith(
        `/projects/project-123/workflow-runs/${uuid}/transcript-lines`,
        expect.any(Object)
      );
    });

    it('should handle large datasets with pagination', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: Array.from({ length: 100 }, (_, i) => ({
          id: `line-${i}`,
          lineNumber: i + 1,
          content: `{"content":"Line ${i + 1}"}`,
          createdAt: '2025-12-21T10:00:00Z',
        })),
        totalLines: 1000,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456', 0, 100, 0);

      expect(result.lines).toHaveLength(100);
      expect(result.totalLines).toBe(1000);
    });

    it('should handle totalLines mismatch (more data exists)', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [
          { id: 'line-1', lineNumber: 1, content: 'line1', createdAt: '2025-12-21T10:00:00Z' },
        ],
        totalLines: 500, // Only 1 line returned but 500 total exist
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456', 0, 1);

      expect(result.lines).toHaveLength(1);
      expect(result.totalLines).toBe(500);
    });
  });

  // ============================================================================
  // getTranscriptLines() TESTS - Real-World Scenarios
  // ============================================================================

  describe('getTranscriptLines - Real-World Scenarios', () => {
    it('should handle initial load scenario (fetch all lines)', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [
          { id: 'line-1', lineNumber: 1, content: '{"type":"user"}', createdAt: '2025-12-21T10:00:00Z' },
          { id: 'line-2', lineNumber: 2, content: '{"type":"assistant"}', createdAt: '2025-12-21T10:00:01Z' },
        ],
        totalLines: 2,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456', 0);

      expect(result.workflowRunId).toBe('run-123');
      expect(result.sessionIndex).toBe(0);
      expect(result.lines).toHaveLength(2);
    });

    it('should handle polling scenario (fetch new lines)', async () => {
      // First poll - 10 lines
      const firstPoll = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: Array.from({ length: 10 }, (_, i) => ({
          id: `line-${i}`,
          lineNumber: i + 1,
          content: `{"line":${i + 1}}`,
          createdAt: '2025-12-21T10:00:00Z',
        })),
        totalLines: 10,
      };

      // Second poll - 15 lines (5 new)
      const secondPoll = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: Array.from({ length: 15 }, (_, i) => ({
          id: `line-${i}`,
          lineNumber: i + 1,
          content: `{"line":${i + 1}}`,
          createdAt: '2025-12-21T10:00:00Z',
        })),
        totalLines: 15,
      };

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({ data: firstPoll })
        .mockResolvedValueOnce({ data: secondPoll });

      const result1 = await transcriptsService.getTranscriptLines('project-123', 'run-456', 0);
      expect(result1.totalLines).toBe(10);

      const result2 = await transcriptsService.getTranscriptLines('project-123', 'run-456', 0);
      expect(result2.totalLines).toBe(15);
    });

    it('should handle compacted session scenario (sessionIndex > 0)', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 1,
        lines: [
          { id: 'line-100', lineNumber: 100, content: '{"compacted":"yes"}', createdAt: '2025-12-21T10:00:00Z' },
        ],
        totalLines: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456', 1);

      expect(result.sessionIndex).toBe(1);
      expect(result.lines[0].lineNumber).toBe(100);
    });

    it('should handle completed workflow scenario (final fetch)', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: Array.from({ length: 250 }, (_, i) => ({
          id: `line-${i}`,
          lineNumber: i + 1,
          content: `{"line":${i + 1}}`,
          createdAt: '2025-12-21T10:00:00Z',
        })),
        totalLines: 250,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456', 0);

      expect(result.lines).toHaveLength(250);
      expect(result.totalLines).toBe(250);
    });

    it('should handle workflow with no transcript data yet', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [],
        totalLines: 0,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await transcriptsService.getTranscriptLines('project-123', 'run-456', 0);

      expect(result.lines).toEqual([]);
      expect(result.totalLines).toBe(0);
    });
  });

  // ============================================================================
  // getTranscriptLines() TESTS - Performance & Concurrency
  // ============================================================================

  describe('getTranscriptLines - Performance & Concurrency', () => {
    it('should handle concurrent requests to same endpoint', async () => {
      const mockData = {
        workflowRunId: 'run-123',
        sessionIndex: 0,
        lines: [],
        totalLines: 0,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      // Fire 3 concurrent requests
      const promises = [
        transcriptsService.getTranscriptLines('project-123', 'run-456', 0),
        transcriptsService.getTranscriptLines('project-123', 'run-456', 0),
        transcriptsService.getTranscriptLines('project-123', 'run-456', 0),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(apiClient.get).toHaveBeenCalledTimes(3);
    });

    it('should handle requests to different sessions concurrently', async () => {
      vi.mocked(apiClient.get).mockImplementation((url: string, config: any) => {
        const sessionIndex = config.params.sessionIndex;
        return Promise.resolve({
          data: {
            workflowRunId: 'run-123',
            sessionIndex: parseInt(sessionIndex),
            lines: [],
            totalLines: 0,
          },
        });
      });

      const results = await Promise.all([
        transcriptsService.getTranscriptLines('project-123', 'run-456', 0),
        transcriptsService.getTranscriptLines('project-123', 'run-456', 1),
        transcriptsService.getTranscriptLines('project-123', 'run-456', 2),
      ]);

      expect(results[0].sessionIndex).toBe(0);
      expect(results[1].sessionIndex).toBe(1);
      expect(results[2].sessionIndex).toBe(2);
    });
  });
});
