/**
 * ST-334: Unit tests for HealthServer
 *
 * Tests verify the health server lifecycle and response format.
 */

import { HealthServer } from '../health-server';
import * as http from 'http';

describe('HealthServer', () => {
  let server: HealthServer;
  const testPort = 3099; // Use a different port to avoid conflicts

  beforeEach(() => {
    server = new HealthServer(testPort);
  });

  afterEach(async () => {
    await server.stop();
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create instance without starting', () => {
      expect(server).toBeDefined();
      expect(server.isRunning()).toBe(false);
    });

    it('should store the port', () => {
      expect((server as any).port).toBe(testPort);
    });
  });

  describe('start/stop lifecycle', () => {
    it('should start the server and bind to port', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);
      expect(server.isRunning()).toBe(true);
    });

    it('should stop the server cleanly', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should handle multiple start calls safely', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);
      await server.start(mockGetStatus); // Should not crash
      await server.stop();
    });

    it('should handle stop before start safely', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('should handle multiple stop calls safely', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);
      await server.stop();
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('should reject on port conflict (EADDRINUSE)', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      // Start first server
      await server.start(mockGetStatus);

      // Try to start second server on same port
      const server2 = new HealthServer(testPort);
      await expect(server2.start(mockGetStatus)).rejects.toThrow();
    });
  });

  describe('GET /health endpoint', () => {
    it('should return connected status with agentId', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);

      // Add small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeRequest('/health');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        status: 'connected',
        agentId: 'test-agent-123',
        uptime: 100.5,
      });
      expect(mockGetStatus).toHaveBeenCalled();
    });

    it('should return disconnected status with null agentId', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'disconnected' as const,
        agentId: null,
        uptime: 50.2,
      }));

      await server.start(mockGetStatus);

      // Add small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeRequest('/health');
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        status: 'disconnected',
        agentId: null,
        uptime: 50.2,
      });
    });

    it('should call getStatus on each request', async () => {
      let counter = 0;
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: counter++,
      }));

      await server.start(mockGetStatus);

      // Add small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 50));

      await makeRequest('/health');
      await makeRequest('/health');
      await makeRequest('/health');

      expect(mockGetStatus).toHaveBeenCalledTimes(3);
    });

    it('should include CORS header', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);

      // Add small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeRequest('/health');
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('other endpoints', () => {
    it('should return 404 for non-health endpoints', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);

      // Add small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeRequest('/status');
      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toBe('text/plain');
      expect(response.body).toBe('Not Found');
      expect(mockGetStatus).not.toHaveBeenCalled();
    });

    it('should return 404 for POST /health', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);

      // Add small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeRequest('/health', 'POST');
      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for root path', async () => {
      const mockGetStatus = jest.fn(() => ({
        status: 'connected' as const,
        agentId: 'test-agent-123',
        uptime: 100.5,
      }));

      await server.start(mockGetStatus);

      // Add small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeRequest('/');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('integration points', () => {
    it('should be importable and instantiable from agent.ts', () => {
      expect(HealthServer).toBeDefined();
      const instance = new HealthServer(3002);
      expect(instance).toBeInstanceOf(HealthServer);
    });

    it('should have public start method', () => {
      expect(typeof server.start).toBe('function');
    });

    it('should have public stop method', () => {
      expect(typeof server.stop).toBe('function');
    });

    it('should have public isRunning method', () => {
      expect(typeof server.isRunning).toBe('function');
    });
  });

  // Helper function to make HTTP requests
  function makeRequest(
    path: string,
    method: string = 'GET'
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path,
          method,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              body,
            });
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  }
});
