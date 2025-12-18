/**
 * Tests for RemoteRunner - Fetch timeout with AbortController
 * ST-305: Fix MCP Timeout Issues with Robust Retry Mechanism
 *
 * Fix 1: Add AbortController to fetch() calls in remote-runner.ts
 * These tests verify that:
 * - Fetch requests abort after configured timeout
 * - Timeout error is properly returned
 * - clearTimeout is called on success
 */

import { RemoteRunner } from '../remote-runner';

// Mock global fetch
global.fetch = jest.fn();

describe('RemoteRunner - AbortController Timeout', () => {
  let runner: RemoteRunner;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    runner = new RemoteRunner('http://localhost:3000');
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('execute() with timeout', () => {
    it('should abort fetch after configured timeout', async () => {
      jest.useFakeTimers();

      // Mock fetch to hang indefinitely
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => {
          // Never resolves
        })
      );

      const executePromise = runner.execute('test-script', [], { timeout: 5000 });

      // Fast-forward time past timeout
      jest.advanceTimersByTime(5000);

      const result = await executePromise;

      // Should return timeout error
      expect(result.executed).toBe(false);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.fallbackCommand).toBeDefined();

      jest.useRealTimers();
    });

    it('should use default timeout when not specified', async () => {
      jest.useFakeTimers();

      mockFetch.mockImplementation(() =>
        new Promise(() => {})
      );

      const executePromise = runner.execute('test-script', []);

      // Default timeout should be 30000ms (30s)
      jest.advanceTimersByTime(30000);

      const result = await executePromise;

      expect(result.executed).toBe(false);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');

      jest.useRealTimers();
    });

    it('should clear timeout on successful completion', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: { data: 'test' },
        }),
        text: jest.fn(),
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const result = await runner.execute('test-script', [], { timeout: 5000 });

      expect(result.executed).toBe(true);
      expect(result.success).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should pass AbortSignal to fetch', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          result: {},
        }),
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      await runner.execute('test-script', [], { timeout: 5000 });

      // Verify fetch was called with AbortSignal
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle AbortError properly', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      mockFetch.mockRejectedValue(abortError);

      const result = await runner.execute('test-script', [], { timeout: 5000 });

      expect(result.executed).toBe(false);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.fallbackCommand).toBeDefined();
    });
  });

  describe('getOnlineAgents() with timeout', () => {
    it('should abort fetch after timeout for agent check', async () => {
      jest.useFakeTimers();

      mockFetch.mockImplementation(() =>
        new Promise(() => {})
      );

      const agentsPromise = runner.getOnlineAgents();

      jest.advanceTimersByTime(30000);

      const agents = await agentsPromise;

      // Should return empty array on timeout
      expect(agents).toEqual([]);

      jest.useRealTimers();
    });

    it('should clear timeout on successful agent fetch', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 'agent-1',
            name: 'Test Agent',
            status: 'online',
            capabilities: ['script-execution'],
            lastHeartbeat: new Date(),
          },
        ]),
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const agents = await runner.getOnlineAgents();

      expect(agents).toHaveLength(1);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('timeout configuration', () => {
    it('should respect custom timeout value', async () => {
      jest.useFakeTimers();

      mockFetch.mockImplementation(() =>
        new Promise(() => {})
      );

      const customTimeout = 10000; // 10 seconds
      const executePromise = runner.execute('test-script', [], { timeout: customTimeout });

      // Should NOT timeout before custom timeout
      jest.advanceTimersByTime(9000);

      // Should timeout after custom timeout
      jest.advanceTimersByTime(1000);

      const result = await executePromise;

      expect(result.executed).toBe(false);
      expect(result.error).toContain('timeout');

      jest.useRealTimers();
    });

    it('should handle very short timeouts', async () => {
      jest.useFakeTimers();

      mockFetch.mockImplementation(() =>
        new Promise(() => {})
      );

      const executePromise = runner.execute('test-script', [], { timeout: 100 });

      jest.advanceTimersByTime(100);

      const result = await executePromise;

      expect(result.executed).toBe(false);
      expect(result.error).toContain('timeout');

      jest.useRealTimers();
    });
  });
});
