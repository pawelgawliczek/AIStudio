/**
 * Unit tests for McpSessionService (ST-163)
 * Tests session management, security validation, and tool execution
 */

import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { McpSessionService } from '../mcp-session.service';

jest.mock('ioredis');
jest.mock('../../mcp/core/registry');

describe('McpSessionService', () => {
  let service: McpSessionService;
  let mockRedis: jest.Mocked<Redis>;
  let mockPrisma: any;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRedis = {
      hset: jest.fn(),
      hgetall: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    } as any;

    mockPrisma = {
      apiKey: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new McpSessionService(mockRedis, mockPrisma as PrismaService);

    mockRequest = {
      ip: '192.168.1.100',
      headers: {
        'user-agent': 'Claude/1.0',
      },
    };

    jest.clearAllMocks();
  });

  // ==========================================================================
  // Session Creation
  // ==========================================================================

  describe('createSession', () => {
    const validSessionData = {
      apiKeyId: 'key-123',
      projectId: 'proj-456',
      protocolVersion: 'mcp/1.0',
      clientInfo: 'Claude Desktop 1.0',
      capabilities: ['tools', 'prompts'],
    };

    it('should create a new session with correct fields', async () => {
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const session = await service.createSession(
        validSessionData,
        mockRequest as Request
      );

      expect(session.sessionId).toMatch(/^sess_[a-f0-9]{32}$/);
      expect(session.apiKeyId).toBe('key-123');
      expect(session.projectId).toBe('proj-456');
      expect(session.originIp).toBe('192.168.1.100');
      expect(session.userAgent).toBe('Claude/1.0');
      expect(session.apiKeyRevoked).toBe(false);
      expect(session.reconnectCount).toBe(0);
    });

    it('should store session in Redis with TTL', async () => {
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.createSession(validSessionData, mockRequest as Request);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringMatching(/^mcp:session:sess_/),
        expect.objectContaining({
          apiKeyId: 'key-123',
          projectId: 'proj-456',
          capabilities: JSON.stringify(['tools', 'prompts']),
        })
      );

      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringMatching(/^mcp:session:sess_/),
        3600 // 1 hour TTL
      );
    });

    it('should handle missing IP address', async () => {
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const requestWithoutIp = { ...mockRequest, ip: undefined };

      const session = await service.createSession(
        validSessionData,
        requestWithoutIp as Request
      );

      expect(session.originIp).toBe('unknown');
    });

    it('should handle missing User-Agent', async () => {
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const requestWithoutUA = {
        ...mockRequest,
        headers: {},
      };

      const session = await service.createSession(
        validSessionData,
        requestWithoutUA as Request
      );

      expect(session.userAgent).toBe('unknown');
    });

    it('should validate protocol version format', async () => {
      const invalidData = {
        ...validSessionData,
        protocolVersion: 'invalid',
      };

      await expect(
        service.createSession(invalidData, mockRequest as Request)
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate client info length', async () => {
      const invalidData = {
        ...validSessionData,
        clientInfo: 'a'.repeat(201),
      };

      await expect(
        service.createSession(invalidData, mockRequest as Request)
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate client info format', async () => {
      const invalidData = {
        ...validSessionData,
        clientInfo: 'Client<script>alert(1)</script>',
      };

      await expect(
        service.createSession(invalidData, mockRequest as Request)
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // Session Retrieval
  // ==========================================================================

  describe('getSession', () => {
    it('should retrieve existing session from Redis', async () => {
      mockRedis.hgetall.mockResolvedValue({
        sessionId: 'sess_abc123',
        apiKeyId: 'key-123',
        capabilities: JSON.stringify(['tools']),
        reconnectCount: '0',
        apiKeyRevoked: 'false',
      });

      const session = await service.getSession('sess_abc123');

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('sess_abc123');
      expect(session?.capabilities).toEqual(['tools']);
      expect(session?.reconnectCount).toBe(0);
      expect(session?.apiKeyRevoked).toBe(false);
    });

    it('should return null for non-existent session', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const session = await service.getSession('sess_nonexistent');

      expect(session).toBeNull();
    });

    it('should parse boolean fields correctly', async () => {
      mockRedis.hgetall.mockResolvedValue({
        sessionId: 'sess_abc123',
        apiKeyRevoked: 'true',
        reconnectCount: '5',
        capabilities: JSON.stringify(['tools']),
      });

      const session = await service.getSession('sess_abc123');

      expect(session?.apiKeyRevoked).toBe(true);
      expect(session?.reconnectCount).toBe(5);
    });

    it('should validate session ID format', async () => {
      await expect(
        service.getSession('invalid-session-id')
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // Session Binding Validation
  // ==========================================================================

  describe('validateSessionBinding', () => {
    const mockSession = {
      sessionId: 'sess_abc123',
      apiKeyId: 'key-123',
      projectId: 'proj-456',
      protocolVersion: 'mcp/1.0',
      clientInfo: 'Claude 1.0',
      capabilities: ['tools'],
      createdAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      reconnectCount: 0,
      originIp: '192.168.1.100',
      userAgent: 'Claude/1.0',
      apiKeyRevoked: false,
    };

    it('should pass validation for matching IP and User-Agent', async () => {
      mockRedis.hgetall.mockResolvedValue({
        ...mockSession,
        capabilities: JSON.stringify(mockSession.capabilities),
        reconnectCount: '0',
        apiKeyRevoked: 'false',
      });

      await expect(
        service.validateSessionBinding('sess_abc123', mockRequest as Request)
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent session', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      await expect(
        service.validateSessionBinding('sess_abc123', mockRequest as Request)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw error for revoked API key', async () => {
      mockRedis.hgetall.mockResolvedValue({
        ...mockSession,
        capabilities: JSON.stringify(mockSession.capabilities),
        reconnectCount: '0',
        apiKeyRevoked: 'true',
      });

      await expect(
        service.validateSessionBinding('sess_abc123', mockRequest as Request)
      ).rejects.toThrow('API key revoked');
    });

    it('should throw error for IP mismatch', async () => {
      mockRedis.hgetall.mockResolvedValue({
        ...mockSession,
        capabilities: JSON.stringify(mockSession.capabilities),
        reconnectCount: '0',
        apiKeyRevoked: 'false',
      });

      const differentIpRequest = {
        ...mockRequest,
        ip: '10.0.0.1',
      };

      await expect(
        service.validateSessionBinding('sess_abc123', differentIpRequest as Request)
      ).rejects.toThrow('IP mismatch');
    });

    it('should throw error for User-Agent mismatch', async () => {
      mockRedis.hgetall.mockResolvedValue({
        ...mockSession,
        capabilities: JSON.stringify(mockSession.capabilities),
        reconnectCount: '0',
        apiKeyRevoked: 'false',
      });

      const differentUARequest = {
        ...mockRequest,
        headers: { 'user-agent': 'Different Client' },
      };

      await expect(
        service.validateSessionBinding('sess_abc123', differentUARequest as Request)
      ).rejects.toThrow('User-Agent mismatch');
    });
  });

  // ==========================================================================
  // Heartbeat Updates
  // ==========================================================================

  describe('updateHeartbeat', () => {
    it('should update heartbeat timestamp and reset TTL', async () => {
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.updateHeartbeat('sess_abc123');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'mcp:session:sess_abc123',
        'lastHeartbeat',
        expect.any(String)
      );

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'mcp:session:sess_abc123',
        3600
      );
    });

    it('should validate session ID format', async () => {
      await expect(
        service.updateHeartbeat('invalid-id')
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // Reconnection Count
  // ==========================================================================

  describe('incrementReconnectCount', () => {
    it('should increment reconnection count', async () => {
      mockRedis.hgetall.mockResolvedValue({
        sessionId: 'sess_abc123',
        reconnectCount: '2',
        capabilities: JSON.stringify(['tools']),
        apiKeyRevoked: 'false',
      });
      mockRedis.hset.mockResolvedValue(1);

      await service.incrementReconnectCount('sess_abc123');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'mcp:session:sess_abc123',
        'reconnectCount',
        '3'
      );
    });

    it('should handle session not found gracefully', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      await expect(
        service.incrementReconnectCount('sess_abc123')
      ).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // Session Closure
  // ==========================================================================

  describe('closeSession', () => {
    it('should delete session from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.closeSession('sess_abc123');

      expect(mockRedis.del).toHaveBeenCalledWith('mcp:session:sess_abc123');
    });

    it('should validate session ID format', async () => {
      await expect(
        service.closeSession('invalid-id')
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // API Key Revocation
  // ==========================================================================

  describe('revokeApiKeySessions', () => {
    it('should mark all sessions for API key as revoked', async () => {
      mockRedis.keys.mockResolvedValue([
        'mcp:session:sess_1',
        'mcp:session:sess_2',
      ]);
      mockRedis.hgetall
        .mockResolvedValueOnce({
          sessionId: 'sess_1',
          apiKeyId: 'key-123',
          capabilities: JSON.stringify(['tools']),
          reconnectCount: '0',
          apiKeyRevoked: 'false',
        })
        .mockResolvedValueOnce({
          sessionId: 'sess_2',
          apiKeyId: 'key-123',
          capabilities: JSON.stringify(['tools']),
          reconnectCount: '0',
          apiKeyRevoked: 'false',
        });
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      await service.revokeApiKeySessions('key-123');

      expect(mockRedis.hset).toHaveBeenCalledTimes(2);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'mcp:session:sess_1',
        'apiKeyRevoked',
        'true'
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'mcp:session:sess_2',
        'apiKeyRevoked',
        'true'
      );
    });

    it('should emit WebSocket events when gateway available', async () => {
      const mockGateway = {
        emitToSession: jest.fn(),
      };
      service.setGateway(mockGateway);

      mockRedis.keys.mockResolvedValue(['mcp:session:sess_1']);
      mockRedis.hgetall.mockResolvedValue({
        sessionId: 'sess_1',
        apiKeyId: 'key-123',
        capabilities: JSON.stringify(['tools']),
        reconnectCount: '0',
        apiKeyRevoked: 'false',
      });
      mockRedis.hset.mockResolvedValue(1);

      await service.revokeApiKeySessions('key-123');

      expect(mockGateway.emitToSession).toHaveBeenCalledWith(
        'sess_1',
        expect.objectContaining({
          type: 'session:revoked',
        })
      );
    });
  });

  // ==========================================================================
  // Input Validation
  // ==========================================================================

  describe('Input Validation', () => {
    it('should validate tool name format - valid', () => {
      expect(() => service.validateToolName('get_story')).not.toThrow();
      expect(() => service.validateToolName('list-items')).not.toThrow();
      expect(() => service.validateToolName('tool_123')).not.toThrow();
    });

    it('should reject invalid tool name characters', () => {
      expect(() => service.validateToolName('tool@name')).toThrow(BadRequestException);
      expect(() => service.validateToolName('tool$name')).toThrow(BadRequestException);
      expect(() => service.validateToolName('tool name')).toThrow(BadRequestException);
    });

    it('should reject tool name exceeding max length', () => {
      const longName = 'a'.repeat(101);
      expect(() => service.validateToolName(longName)).toThrow(BadRequestException);
    });

    it('should validate protocol version format', () => {
      expect(() => service.validateProtocolVersion('mcp/1.0')).not.toThrow();
      expect(() => service.validateProtocolVersion('mcp/2.5')).not.toThrow();
      expect(() => service.validateProtocolVersion('invalid')).toThrow(BadRequestException);
      expect(() => service.validateProtocolVersion('mcp/1')).toThrow(BadRequestException);
    });

    it('should reject extremely high version numbers', () => {
      expect(() => service.validateProtocolVersion('mcp/1000.0')).toThrow(BadRequestException);
      expect(() => service.validateProtocolVersion('mcp/1.1000')).toThrow(BadRequestException);
    });

    it('should validate session ID format', () => {
      expect(() => service.validateSessionId('sess_abc123def456789012345678901234')).not.toThrow();
      expect(() => service.validateSessionId('invalid')).toThrow(BadRequestException);
      expect(() => service.validateSessionId('sess_toolong123456789012345678901234567890')).toThrow(BadRequestException);
    });

    it('should validate client info format', () => {
      expect(() => service.validateClientInfo('Claude Desktop 1.0')).not.toThrow();
      expect(() => service.validateClientInfo('Client-Name_v2.0')).not.toThrow();
    });

    it('should reject client info with invalid characters', () => {
      expect(() => service.validateClientInfo('Client<script>')).toThrow(BadRequestException);
      expect(() => service.validateClientInfo('Client$special')).toThrow(BadRequestException);
      expect(() => service.validateClientInfo('Client`backtick')).toThrow(BadRequestException);
    });

    it('should reject client info with null bytes', () => {
      expect(() => service.validateClientInfo('Client\x00Name')).toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // Tool Execution
  // ==========================================================================

  describe('executeTool', () => {
    beforeEach(() => {
      const mockGateway = {
        emitToSession: jest.fn(),
      };
      service.setGateway(mockGateway);
    });

    it('should validate tool name before execution', async () => {
      await expect(
        service.executeTool('sess_abc123', 'invalid@tool', {})
      ).rejects.toThrow(BadRequestException);
    });

    it('should emit tool:start event', async () => {
      const mockGateway = {
        emitToSession: jest.fn(),
      };
      service.setGateway(mockGateway);

      // Mock the toolRegistry to throw error so we can test just the start event
      (service as any).toolRegistry = {
        executeTool: jest.fn().mockRejectedValue(new Error('Tool not found')),
      };

      await expect(
        service.executeTool('sess_abc123', 'test_tool', {})
      ).rejects.toThrow();

      expect(mockGateway.emitToSession).toHaveBeenCalledWith(
        'sess_abc123',
        expect.objectContaining({
          type: 'tool:start',
          toolName: 'test_tool',
        })
      );
    });

    it('should emit tool:error on execution failure', async () => {
      const mockGateway = {
        emitToSession: jest.fn(),
      };
      service.setGateway(mockGateway);

      (service as any).toolRegistry = {
        executeTool: jest.fn().mockRejectedValue(new Error('Execution failed')),
      };

      await expect(
        service.executeTool('sess_abc123', 'test_tool', {})
      ).rejects.toThrow(BadRequestException);

      expect(mockGateway.emitToSession).toHaveBeenCalledWith(
        'sess_abc123',
        expect.objectContaining({
          type: 'tool:error',
          data: expect.objectContaining({
            error: expect.objectContaining({
              message: 'Execution failed',
            }),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // List Tools
  // ==========================================================================

  describe('listTools', () => {
    it('should list all tools when no query provided', async () => {
      (service as any).toolRegistry = {
        listTools: jest.fn().mockResolvedValue([
          { name: 'get_story', description: 'Get story details', inputSchema: {} },
          { name: 'list_stories', description: 'List stories', inputSchema: {} },
        ]),
      };

      const result = await service.listTools('sess_abc123');

      expect(result.tools).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.category).toBe('all');
      expect(result.query).toBeNull();
    });

    it('should search tools when query provided', async () => {
      (service as any).toolRegistry = {
        searchTools: jest.fn().mockResolvedValue({
          tools: [
            { name: 'get_story', description: 'Get story details' },
          ],
        }),
      };

      const result = await service.listTools('sess_abc123', undefined, 'story');

      expect(result.tools).toHaveLength(1);
      expect(result.query).toBe('story');
    });

    it('should filter by category', async () => {
      (service as any).toolRegistry = {
        listTools: jest.fn().mockResolvedValue([]),
      };

      await service.listTools('sess_abc123', 'stories');

      expect((service as any).toolRegistry.listTools).toHaveBeenCalledWith('stories');
    });

    it('should handle tool registry errors', async () => {
      (service as any).toolRegistry = {
        listTools: jest.fn().mockRejectedValue(new Error('Registry error')),
      };

      await expect(
        service.listTools('sess_abc123')
      ).rejects.toThrow(BadRequestException);
    });
  });
});
