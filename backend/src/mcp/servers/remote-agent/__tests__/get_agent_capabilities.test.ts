/**
 * ST-150: get_agent_capabilities MCP Tool Tests
 */

import { handler } from '../get_agent_capabilities';

describe('get_agent_capabilities', () => {
  const mockPrisma = {
    remoteAgent: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handler', () => {
    it('should return all approved capabilities when no agent specified', async () => {
      const result = await handler({}, mockPrisma as any);

      expect(result.success).toBe(true);
      expect(result.approvedCapabilities).toBeDefined();
      expect(result.approvedCapabilities.length).toBeGreaterThan(0);

      // Check that claude-code is included
      const claudeCode = result.approvedCapabilities.find((c) => c.name === 'claude-code');
      expect(claudeCode).toBeDefined();
      expect(claudeCode?.type).toBe('capability');
      expect(claudeCode?.timeout).toBe(3600000); // 60 minutes

      // Check that parse-transcript is included
      const parseTranscript = result.approvedCapabilities.find(
        (c) => c.name === 'parse-transcript',
      );
      expect(parseTranscript).toBeDefined();
      expect(parseTranscript?.type).toBe('script');
    });

    it('should return agent-specific capabilities when agentId provided', async () => {
      const mockAgent = {
        id: 'agent-123',
        hostname: 'laptop-1',
        status: 'online',
        capabilities: ['parse-transcript', 'claude-code'],
        claudeCodeAvailable: true,
        claudeCodeVersion: '1.0.0',
      };

      mockPrisma.remoteAgent.findUnique.mockResolvedValue(mockAgent);

      const result = await handler({ agentId: 'agent-123' }, mockPrisma as any);

      expect(result.success).toBe(true);
      expect(result.agent).toBeDefined();
      expect(result.agent?.id).toBe('agent-123');
      expect(result.agent?.hostname).toBe('laptop-1');
      expect(result.agentCapabilities).toBeDefined();

      // Agent should only have its registered capabilities
      expect(result.agentCapabilities?.length).toBe(2);
      expect(result.agentCapabilities?.map((c) => c.name)).toContain('parse-transcript');
      expect(result.agentCapabilities?.map((c) => c.name)).toContain('claude-code');
    });

    it('should return agent-specific capabilities when hostname provided', async () => {
      const mockAgent = {
        id: 'agent-456',
        hostname: 'my-laptop',
        status: 'online',
        capabilities: ['list-transcripts'],
        claudeCodeAvailable: false,
        claudeCodeVersion: null,
      };

      mockPrisma.remoteAgent.findUnique.mockResolvedValue(mockAgent);

      const result = await handler({ hostname: 'my-laptop' }, mockPrisma as any);

      expect(result.success).toBe(true);
      expect(result.agent?.hostname).toBe('my-laptop');
      expect(result.agentCapabilities?.length).toBe(1);
      expect(result.agentCapabilities?.[0].name).toBe('list-transcripts');
    });

    it('should return failure when agent not found', async () => {
      mockPrisma.remoteAgent.findUnique.mockResolvedValue(null);

      const result = await handler({ agentId: 'non-existent' }, mockPrisma as any);

      expect(result.success).toBe(false);
      expect(result.agent).toBeUndefined();
      // Should still include approved capabilities for reference
      expect(result.approvedCapabilities.length).toBeGreaterThan(0);
    });

    it('should include capability metadata', async () => {
      const result = await handler({}, mockPrisma as any);

      // Check that capabilities have proper metadata
      for (const cap of result.approvedCapabilities) {
        expect(cap.name).toBeDefined();
        expect(cap.type).toMatch(/^(script|capability)$/);
        expect(cap.description).toBeDefined();
        expect(typeof cap.timeout).toBe('number');
      }
    });
  });
});
