/**
 * Unit Tests for McpSessionService (Tasks 1.4, 1.4a - HIGH SECURITY)
 *
 * Tests session management with:
 * - Redis storage with 1-hour TTL
 * - Session binding (IP + User-Agent)
 * - API key revocation propagation
 * - Input validation (Task 1.2a)
 *
 * @see ST-163 Task 1.4: Implement Session Service
 * @see ST-163 Task 1.4a: Enhance Session Interface with IP/User-Agent Binding
 * @see ST-163 Task 1.2a: Define Detailed Input Validation Rules
 */

import { UnauthorizedException } from '@nestjs/common';
import { McpSessionService, MCP_SESSION_TTL, MCP_SESSION_PREFIX } from '../mcp-session.service';

// Mock Redis
const mockRedis = {
  hgetall: jest.fn(),
  hset: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
};

// Mock Request
const mockRequest = {
  ip: '192.168.1.100',
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
};

describe('McpSessionService Security (Tasks 1.4, 1.4a)', () => {
  let service: McpSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new McpSessionService(mockRedis as any);
  });

  describe('Session Creation', () => {
    it('should create session in Redis with 1-hour TTL', async () => {
      const sessionData = {
        apiKeyId: 'key-123',
        projectId: 'proj-456',
        protocolVersion: 'mcp/1.0',
        clientInfo: 'test-client',
        capabilities: ['tools', 'prompts'],
      };

      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const session = await service.createSession(sessionData, mockRequest as any);

      expect(session.sessionId).toMatch(/^sess_[a-f0-9]{32}$/);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringContaining(MCP_SESSION_PREFIX),
        expect.objectContaining({
          apiKeyId: 'key-123',
          originIp: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        })
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.any(String),
        MCP_SESSION_TTL
      );
    });

    it('should capture IP and User-Agent at creation', async () => {
      const sessionData = {
        apiKeyId: 'key-123',
        projectId: 'proj-456',
        protocolVersion: 'mcp/1.0',
        clientInfo: 'test-client',
        capabilities: [],
      };

      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const session = await service.createSession(sessionData, mockRequest as any);

      expect(session.originIp).toBe('192.168.1.100');
      expect(session.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    });

    it('should initialize reconnectCount to 0', async () => {
      const sessionData = {
        apiKeyId: 'key-123',
        projectId: 'proj-456',
        protocolVersion: 'mcp/1.0',
        clientInfo: 'test-client',
        capabilities: [],
      };

      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const session = await service.createSession(sessionData, mockRequest as any);

      expect(session.reconnectCount).toBe(0);
    });

    it('should set apiKeyRevoked to false initially', async () => {
      const sessionData = {
        apiKeyId: 'key-123',
        projectId: 'proj-456',
        protocolVersion: 'mcp/1.0',
        clientInfo: 'test-client',
        capabilities: [],
      };

      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const session = await service.createSession(sessionData, mockRequest as any);

      expect(session.apiKeyRevoked).toBe(false);
    });
  });

  describe('Session Binding Validation (Task 1.4a - HIGH SECURITY)', () => {
    const mockSession = {
      sessionId: 'sess-123',
      apiKeyId: 'key-123',
      originIp: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      apiKeyRevoked: false,
      protocolVersion: 'mcp/1.0',
      clientInfo: 'test-client',
      capabilities: [],
      createdAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      reconnectCount: 0,
    };

    it('should reject session from different IP address', async () => {
      mockRedis.hgetall.mockResolvedValue(mockSession);

      const differentIpRequest = {
        ...mockRequest,
        ip: '10.0.0.50',
      };

      await expect(
        service.validateSessionBinding('sess-123', differentIpRequest as any)
      ).rejects.toThrow('Session binding violation (IP mismatch)');
    });

    it('should reject session from different User-Agent', async () => {
      mockRedis.hgetall.mockResolvedValue(mockSession);

      const differentUARequest = {
        ...mockRequest,
        headers: {
          'user-agent': 'curl/7.68.0',
        },
      };

      await expect(
        service.validateSessionBinding('sess-123', differentUARequest as any)
      ).rejects.toThrow('Session binding violation (User-Agent mismatch)');
    });

    it('should reject session when API key revoked', async () => {
      mockRedis.hgetall.mockResolvedValue({
        ...mockSession,
        apiKeyRevoked: true,
      });

      await expect(
        service.validateSessionBinding('sess-123', mockRequest as any)
      ).rejects.toThrow('API key revoked');
    });

    it('should log session hijacking attempts', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      mockRedis.hgetall.mockResolvedValue(mockSession);

      const attackRequest = {
        ip: '10.0.0.50',
        headers: { 'user-agent': 'attacker' },
      };

      try {
        await service.validateSessionBinding('sess-123', attackRequest as any);
      } catch {
        // Expected to throw for session hijacking attempt
      }

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session hijacking attempt detected')
      );
    });

    it('should allow valid session from same IP and User-Agent', async () => {
      mockRedis.hgetall.mockResolvedValue(mockSession);

      await expect(
        service.validateSessionBinding('sess-123', mockRequest as any)
      ).resolves.not.toThrow();
    });

    it('should throw if session not found', async () => {
      mockRedis.hgetall.mockResolvedValue(null);

      await expect(
        service.validateSessionBinding('sess-123', mockRequest as any)
      ).rejects.toThrow('Session not found');
    });
  });

  describe('Input Validation (Task 1.2a - CRITICAL SECURITY)', () => {
    it('should reject tool names with special characters', () => {
      const invalidToolNames = [
        'tool; DROP TABLE sessions;',
        'tool$(malicious)',
        'tool`whoami`',
        '../../../etc/passwd',
        'tool\nmalicious',
      ];

      invalidToolNames.forEach(toolName => {
        expect(() => service.validateToolName(toolName))
          .toThrow('Invalid tool name format');
      });
    });

    it('should accept valid tool names', () => {
      const validToolNames = [
        'list_tools',
        'call-tool',
        'execute_workflow',
        'get-project',
      ];

      validToolNames.forEach(toolName => {
        expect(() => service.validateToolName(toolName))
          .not.toThrow();
      });
    });

    it('should reject oversized client info strings', () => {
      const oversizedClientInfo = 'a'.repeat(201); // >200 chars

      expect(() => service.validateClientInfo(oversizedClientInfo))
        .toThrow('Client info exceeds maximum length');
    });

    it('should reject client info with invalid characters', () => {
      const invalidClientInfo = [
        'client\x00null-byte',
        'client<script>alert(1)</script>',
        'client${injection}',
      ];

      invalidClientInfo.forEach(info => {
        expect(() => service.validateClientInfo(info))
          .toThrow('Invalid client info format');
      });
    });

    it('should strip unknown properties from session data', async () => {
      const sessionData = {
        apiKeyId: 'key-123',
        projectId: 'proj-456',
        protocolVersion: 'mcp/1.0',
        clientInfo: 'test-client',
        capabilities: [],
        // @ts-expect-error - Testing runtime behavior
        maliciousProperty: 'should-be-stripped',
        // @ts-expect-error - Testing prototype pollution
        __proto__: { polluted: true },
      };

      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const session = await service.createSession(sessionData, mockRequest as any);

      expect(session).not.toHaveProperty('maliciousProperty');
      expect(session).not.toHaveProperty('__proto__');
    });

    it('should reject non-UUID session IDs', () => {
      const invalidSessionIds = [
        'sess_notauuid',
        'sess-123; DROP TABLE sessions;',
        '../../../etc/passwd',
        'sess_<script>alert(1)</script>',
      ];

      invalidSessionIds.forEach(id => {
        expect(() => service.validateSessionId(id))
          .toThrow('Invalid session ID format');
      });
    });

    it('should accept valid UUID session IDs', () => {
      const validSessionIds = [
        'sess_550e8400e29b41d4a716446655440000',
        'sess_6ba7b8109dad11d180b400c04fd430c8',
      ];

      validSessionIds.forEach(id => {
        expect(() => service.validateSessionId(id))
          .not.toThrow();
      });
    });

    it('should reject invalid protocol versions', () => {
      const invalidVersions = [
        'mcp/999.999',
        'mcp/1.0; malicious',
        'mcp/1.0\nmalicious',
        'http://evil.com/mcp/1.0',
      ];

      invalidVersions.forEach(version => {
        expect(() => service.validateProtocolVersion(version))
          .toThrow('Invalid protocol version format');
      });
    });

    it('should accept valid protocol versions', () => {
      const validVersions = [
        'mcp/1.0',
        'mcp/2.1',
        'mcp/10.5',
      ];

      validVersions.forEach(version => {
        expect(() => service.validateProtocolVersion(version))
          .not.toThrow();
      });
    });
  });

  describe('API Key Revocation (Task 2.4a - HIGH SECURITY)', () => {
    it('should invalidate all sessions when API key revoked', async () => {
      const mockSessions = [
        { sessionId: 'sess-1', apiKeyId: 'key-123' },
        { sessionId: 'sess-2', apiKeyId: 'key-123' },
        { sessionId: 'sess-3', apiKeyId: 'key-456' }, // Different key
      ];

      mockRedis.keys.mockResolvedValue([
        `${MCP_SESSION_PREFIX}sess-1`,
        `${MCP_SESSION_PREFIX}sess-2`,
        `${MCP_SESSION_PREFIX}sess-3`,
      ]);

      mockRedis.hgetall.mockImplementation((key: string) => {
        if (key.includes('sess-1')) return Promise.resolve(mockSessions[0]);
        if (key.includes('sess-2')) return Promise.resolve(mockSessions[1]);
        if (key.includes('sess-3')) return Promise.resolve(mockSessions[2]);
        return Promise.resolve(null);
      });

      mockRedis.hset.mockResolvedValue(1);

      await service.revokeApiKeySessions('key-123');

      // Only sessions for key-123 should be marked as revoked
      expect(mockRedis.hset).toHaveBeenCalledTimes(2);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `${MCP_SESSION_PREFIX}sess-1`,
        'apiKeyRevoked',
        'true'
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `${MCP_SESSION_PREFIX}sess-2`,
        'apiKeyRevoked',
        'true'
      );
    });

    it('should emit WebSocket event to close connections', async () => {
      const mockGateway = {
        emitToSession: jest.fn(),
      };

      (service as any).mcpGateway = mockGateway;

      mockRedis.keys.mockResolvedValue([`${MCP_SESSION_PREFIX}sess-1`]);
      mockRedis.hgetall.mockResolvedValue({ sessionId: 'sess-1', apiKeyId: 'key-123' });
      mockRedis.hset.mockResolvedValue(1);

      await service.revokeApiKeySessions('key-123');

      expect(mockGateway.emitToSession).toHaveBeenCalledWith(
        'sess-1',
        {
          type: 'session:revoked',
          message: 'API key revoked - session terminated',
        }
      );
    });

    it('should log revocation with session count', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      mockRedis.keys.mockResolvedValue([
        `${MCP_SESSION_PREFIX}sess-1`,
        `${MCP_SESSION_PREFIX}sess-2`,
      ]);

      mockRedis.hgetall.mockResolvedValue({ sessionId: 'sess-1', apiKeyId: 'key-123' });
      mockRedis.hset.mockResolvedValue(1);

      await service.revokeApiKeySessions('key-123');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 sessions invalidated')
      );
    });

    it('should reject subsequent requests with revoked key', async () => {
      mockRedis.hgetall.mockResolvedValue({
        sessionId: 'sess-123',
        apiKeyRevoked: true,
        originIp: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      });

      await expect(
        service.validateSessionBinding('sess-123', mockRequest as any)
      ).rejects.toThrow('API key revoked');
    });
  });

  describe('Session Lifecycle', () => {
    it('should update heartbeat and reset TTL', async () => {
      mockRedis.hgetall.mockResolvedValue({
        sessionId: 'sess-123',
        lastHeartbeat: new Date(Date.now() - 60000).toISOString(),
      });

      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.updateHeartbeat('sess-123');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `${MCP_SESSION_PREFIX}sess-123`,
        'lastHeartbeat',
        expect.any(String)
      );

      expect(mockRedis.expire).toHaveBeenCalledWith(
        `${MCP_SESSION_PREFIX}sess-123`,
        MCP_SESSION_TTL
      );
    });

    it('should increment reconnect count', async () => {
      mockRedis.hgetall.mockResolvedValue({
        sessionId: 'sess-123',
        reconnectCount: 2,
      });

      mockRedis.hset.mockResolvedValue(1);

      await service.incrementReconnectCount('sess-123');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `${MCP_SESSION_PREFIX}sess-123`,
        'reconnectCount',
        '3'
      );
    });

    it('should close session and delete from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.closeSession('sess-123');

      expect(mockRedis.del).toHaveBeenCalledWith(`${MCP_SESSION_PREFIX}sess-123`);
    });

    it('should get session from Redis', async () => {
      const mockSession = {
        sessionId: 'sess-123',
        apiKeyId: 'key-123',
      };

      mockRedis.hgetall.mockResolvedValue(mockSession);

      const session = await service.getSession('sess-123');

      expect(session).toEqual(mockSession);
      expect(mockRedis.hgetall).toHaveBeenCalledWith(`${MCP_SESSION_PREFIX}sess-123`);
    });
  });
});
