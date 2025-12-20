/**
 * ST-334: Integration test for health server in RemoteAgent
 *
 * Tests the health endpoint lifecycle with the agent.
 */

import { RemoteAgent } from '../agent';
import { AgentConfig } from '../config';
import * as http from 'http';

describe('RemoteAgent Health Server Integration', () => {
  let agent: RemoteAgent;
  const testConfig: AgentConfig = {
    serverUrl: 'http://127.0.0.1:3001',
    agentSecret: 'test-secret',
    hostname: 'test-hostname',
    capabilities: ['test'],
    projectPath: '/test/path',
    logLevel: 'error',
    lokiEnabled: false,
    lokiUrl: '',
    lokiUsername: '',
    lokiPassword: '',
    maxQueueSize: 100000,
    healthPort: 3098, // Use different port to avoid conflicts
  };

  beforeEach(() => {
    agent = new RemoteAgent(testConfig);
  });

  afterEach(async () => {
    agent.disconnect();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('health server initialization', () => {
    it('should initialize health server on agent construction', () => {
      expect((agent as any).healthServer).toBeDefined();
      expect((agent as any).healthServer.isRunning()).toBe(false);
    });
  });

  describe('health server lifecycle with agent', () => {
    it('should start health server when agent connects (mock)', async () => {
      // We can't actually connect without a backend server, but we can verify
      // the health server would be initialized
      const healthServer = (agent as any).healthServer;
      expect(healthServer).toBeDefined();

      // Start health server directly to test it
      await healthServer.start(() => ({
        status: 'disconnected' as const,
        agentId: null,
        uptime: process.uptime(),
      }));

      expect(healthServer.isRunning()).toBe(true);

      // Test health endpoint
      const response = await makeRequest(testConfig.healthPort, '/health');
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe('disconnected');
      expect(body.agentId).toBeNull();
      expect(body.uptime).toBeGreaterThan(0);

      await healthServer.stop();
    });

    it('should reflect connection status in health endpoint', async () => {
      const healthServer = (agent as any).healthServer;

      // Mock connection status
      let mockConnected = false;
      let mockAgentId: string | null = null;

      await healthServer.start(() => ({
        status: mockConnected && mockAgentId ? 'connected' : 'disconnected',
        agentId: mockAgentId,
        uptime: process.uptime(),
      }));

      // Test disconnected state
      let response = await makeRequest(testConfig.healthPort, '/health');
      let body = JSON.parse(response.body);
      expect(body.status).toBe('disconnected');
      expect(body.agentId).toBeNull();

      // Simulate connection
      mockConnected = true;
      mockAgentId = 'test-agent-123';

      // Test connected state
      response = await makeRequest(testConfig.healthPort, '/health');
      body = JSON.parse(response.body);
      expect(body.status).toBe('connected');
      expect(body.agentId).toBe('test-agent-123');

      await healthServer.stop();
    });
  });

  // Helper function to make HTTP requests
  function makeRequest(
    port: number,
    path: string
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
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
