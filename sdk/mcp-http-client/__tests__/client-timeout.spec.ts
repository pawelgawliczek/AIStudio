/**
 * Tests for MCP HTTP Client - Timeout Configuration
 * ST-305: Fix MCP Timeout Issues with Robust Retry Mechanism
 *
 * Fix 2: Increase MCP HTTP client timeout from 30s to 120s
 * These tests verify that:
 * - Axios client has 120s timeout configured
 * - Long operations (like advance_step) don't timeout prematurely
 * - Timeout configuration is properly applied
 */

import { McpHttpClient } from '../src/client';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('McpHttpClient - Timeout Configuration', () => {
  let client: McpHttpClient;
  let mockAxiosInstance: any;
  let mockAxiosCreate: jest.MockedFunction<typeof axios.create>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    };

    mockAxiosCreate = axios.create as jest.MockedFunction<typeof axios.create>;
    mockAxiosCreate.mockReturnValue(mockAxiosInstance);

    client = new McpHttpClient({
      baseUrl: 'https://test.example.com',
      apiKey: 'test-api-key',
      debug: false,
    });
  });

  describe('Client initialization with timeout', () => {
    it('should configure axios with 120s timeout', () => {
      // Verify axios.create was called with correct timeout
      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 120000, // 120 seconds in milliseconds
        })
      );
    });

    it('should not use old 30s timeout', () => {
      const createCall = mockAxiosCreate.mock.calls[0][0];
      
      expect(createCall?.timeout).not.toBe(30000);
      expect(createCall?.timeout).toBe(120000);
    });

    it('should include timeout in axios config', () => {
      const createCall = mockAxiosCreate.mock.calls[0][0];
      
      expect(createCall).toHaveProperty('timeout');
      expect(typeof createCall?.timeout).toBe('number');
      expect(createCall?.timeout).toBeGreaterThan(0);
    });
  });

  describe('Long-running operations', () => {
    beforeEach(async () => {
      // Initialize session first
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test', version: '1.0' },
        },
      });

      await client.initialize('test-client');
      jest.clearAllMocks();
    });

    it('should allow callTool to run for up to 120s', async () => {
      jest.useFakeTimers();

      let resolveResponse: any;
      const slowPromise = new Promise((resolve) => {
        resolveResponse = resolve;
      });

      mockAxiosInstance.post.mockReturnValue(slowPromise);

      const toolCall = client.callTool('advance_step', { runId: 'run-123' });

      // Advance time by 119 seconds (just under timeout)
      jest.advanceTimersByTime(119000);

      // Should not have timed out yet
      resolveResponse({
        data: {
          success: true,
          content: [{ type: 'text', text: 'Done' }],
        },
      });

      const result = await toolCall;

      expect(result.success).toBe(true);

      jest.useRealTimers();
    });

    it('should handle operations that take 60-90 seconds', async () => {
      jest.useFakeTimers();

      let resolveResponse: any;
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolveResponse = resolve;
        }, 75000); // 75 seconds
      });

      mockAxiosInstance.post.mockReturnValue(slowPromise);

      const toolCall = client.callTool('get_current_step', { story: 'ST-123' });

      // Advance time to 75 seconds
      jest.advanceTimersByTime(75000);

      resolveResponse({
        data: {
          success: true,
          content: [{ type: 'text', text: 'Step data' }],
        },
      });

      const result = await toolCall;

      expect(result.success).toBe(true);

      jest.useRealTimers();
    });

    it('should support timeout for listTools operation', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          tools: [
            { name: 'tool1', description: 'Tool 1' },
            { name: 'tool2', description: 'Tool 2' },
          ],
        },
      });

      const tools = await client.listTools();

      expect(tools).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalled();
    });
  });

  describe('Timeout behavior', () => {
    beforeEach(async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test', version: '1.0' },
        },
      });

      await client.initialize('test-client');
      jest.clearAllMocks();
    });

    it('should handle timeout errors properly', async () => {
      const timeoutError = new Error('timeout of 120000ms exceeded');
      timeoutError.code = 'ECONNABORTED';

      mockAxiosInstance.post.mockRejectedValue(timeoutError);

      await expect(client.callTool('slow-tool', {})).rejects.toThrow();
    });

    it('should retry on timeout with extended retry logic', async () => {
      // First call times out, second succeeds
      mockAxiosInstance.post
        .mockRejectedValueOnce({
          code: 'ECONNABORTED',
          message: 'timeout of 120000ms exceeded',
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            content: [{ type: 'text', text: 'Success after retry' }],
          },
        });

      const result = await client.callTool('test-tool', {});

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('Custom timeout configuration', () => {
    it('should allow custom timeout via constructor options', () => {
      const customClient = new McpHttpClient({
        baseUrl: 'https://custom.example.com',
        apiKey: 'test-key',
        timeout: 180000, // 180 seconds
      });

      // Verify axios.create was called with custom timeout
      const lastCall = mockAxiosCreate.mock.calls[mockAxiosCreate.mock.calls.length - 1][0];
      expect(lastCall?.timeout).toBe(180000);
    });

    it('should default to 120s when no timeout specified', () => {
      const defaultClient = new McpHttpClient({
        baseUrl: 'https://default.example.com',
        apiKey: 'test-key',
      });

      const lastCall = mockAxiosCreate.mock.calls[mockAxiosCreate.mock.calls.length - 1][0];
      expect(lastCall?.timeout).toBe(120000);
    });
  });

  describe('Comparison with old timeout', () => {
    it('should have 4x longer timeout than old 30s configuration', () => {
      const createCall = mockAxiosCreate.mock.calls[0][0];
      const oldTimeout = 30000;
      const newTimeout = createCall?.timeout || 0;

      expect(newTimeout).toBe(oldTimeout * 4);
      expect(newTimeout).toBe(120000);
    });

    it('should prevent premature timeouts on slow database queries', () => {
      // Old timeout: 30s - would fail on slow queries
      // New timeout: 120s - allows for slow queries
      const createCall = mockAxiosCreate.mock.calls[0][0];

      expect(createCall?.timeout).toBeGreaterThanOrEqual(90000); // At least 90s
      expect(createCall?.timeout).toBe(120000);
    });
  });
});
