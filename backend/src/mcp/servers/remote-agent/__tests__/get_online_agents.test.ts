/**
 * ST-150: get_online_agents MCP Tool Tests
 */

import { handler } from '../get_online_agents';

describe('get_online_agents', () => {
  const mockPrisma = {
    remoteAgent: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handler', () => {
    it('should return all online agents', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: ['parse-transcript', 'claude-code'],
          claudeCodeAvailable: true,
          claudeCodeVersion: '1.0.0',
          currentExecutionId: null,
          lastSeenAt: new Date(),
        },
        {
          id: 'agent-2',
          hostname: 'laptop-2',
          status: 'online',
          capabilities: ['parse-transcript'],
          claudeCodeAvailable: false,
          claudeCodeVersion: null,
          currentExecutionId: 'job-123',
          lastSeenAt: new Date(),
        },
      ];

      mockPrisma.remoteAgent.findMany.mockResolvedValue(mockAgents);

      const result = await handler(mockPrisma as any, {});

      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.onlineCount).toBe(2);
      expect(mockPrisma.remoteAgent.findMany).toHaveBeenCalledWith({
        where: { status: 'online' },
        orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
      });
    });

    it('should filter by capability', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: ['claude-code'],
          claudeCodeAvailable: true,
          claudeCodeVersion: '1.0.0',
          currentExecutionId: null,
          lastSeenAt: new Date(),
        },
      ];

      mockPrisma.remoteAgent.findMany.mockResolvedValue(mockAgents);

      const result = await handler(mockPrisma as any, { capability: 'claude-code' });

      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(1);
      expect(mockPrisma.remoteAgent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'online',
          capabilities: { has: 'claude-code' },
        },
        orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
      });
    });

    it('should include offline agents when requested', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          hostname: 'laptop-1',
          status: 'online',
          capabilities: ['claude-code'],
          claudeCodeAvailable: true,
          claudeCodeVersion: '1.0.0',
          currentExecutionId: null,
          lastSeenAt: new Date(),
        },
        {
          id: 'agent-2',
          hostname: 'laptop-2',
          status: 'offline',
          capabilities: ['parse-transcript'],
          claudeCodeAvailable: false,
          claudeCodeVersion: null,
          currentExecutionId: null,
          lastSeenAt: new Date(Date.now() - 3600000),
        },
      ];

      mockPrisma.remoteAgent.findMany.mockResolvedValue(mockAgents);

      const result = await handler(mockPrisma as any, { includeOffline: true });

      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(2);
      expect(result.onlineCount).toBe(1);
      expect(mockPrisma.remoteAgent.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
      });
    });

    it('should return empty array when no agents', async () => {
      mockPrisma.remoteAgent.findMany.mockResolvedValue([]);

      const result = await handler(mockPrisma as any, {});

      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.onlineCount).toBe(0);
    });
  });
});
