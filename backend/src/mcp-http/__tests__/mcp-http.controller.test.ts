/**
 * Unit tests for McpHttpController - ST-355
 *
 * Tests cover MCP HTTP Transport endpoints:
 * - Session initialization
 * - Tool execution
 * - Session management (heartbeat, close, get)
 * - SSE streaming
 * - Admin endpoints (API key management)
 */

import { NotFoundException, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { McpHttpController } from '../mcp-http.controller';
import { McpHttpGateway } from '../mcp-http.gateway';
import { McpSessionService } from '../mcp-session.service';
import { McpAuthGuard } from '../guards/mcp-auth.guard';
import { McpRateLimitGuard } from '../guards/mcp-rate-limit.guard';
import { ResponseSigningInterceptor } from '../interceptors/response-signing.interceptor';

describe('McpHttpController', () => {
  let controller: McpHttpController;
  let mockSessionService: any;
  let mockGateway: any;

  beforeEach(async () => {
    mockSessionService = {
      createSession: jest.fn(),
      validateSessionBinding: jest.fn(),
      validateToolName: jest.fn(),
      executeTool: jest.fn(),
      listTools: jest.fn(),
      getSession: jest.fn(),
      updateHeartbeat: jest.fn(),
      closeSession: jest.fn(),
      generateApiKey: jest.fn(),
      listApiKeys: jest.fn(),
      revokeApiKey: jest.fn(),
    };

    mockGateway = {
      logger: {
        log: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpHttpController],
      providers: [
        { provide: McpSessionService, useValue: mockSessionService },
        { provide: McpHttpGateway, useValue: mockGateway },
      ],
    })
      .overrideGuard(McpAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(McpRateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(ResponseSigningInterceptor)
      .useValue({ intercept: (context: ExecutionContext, next: any) => next.handle() })
      .compile();

    controller = module.get<McpHttpController>(McpHttpController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GROUP 1: Session Initialization
  // ==========================================================================

  describe('initialize', () => {
    it('should create a new session successfully', async () => {
      const mockApiKey = {
        id: 'key-123',
        projectId: 'proj-456',
      };

      const mockSession = {
        sessionId: 'sess_abc123',
        protocolVersion: '1.0.0',
        clientInfo: { name: 'test-client' },
        capabilities: ['tools'],
      };

      const req = {
        user: { apiKey: mockApiKey },
      } as any;

      const dto = {
        protocolVersion: '1.0.0',
        clientInfo: { name: 'test-client' },
        capabilities: ['tools'],
      };

      mockSessionService.createSession.mockResolvedValue(mockSession);

      const result = await controller.initialize(dto, req);

      expect(result.sessionId).toBe('sess_abc123');
      expect(result.serverInfo.name).toBe('vibestudio-mcp-server');
      expect(result.serverInfo.version).toBe('1.0.0');
      expect(result.capabilities).toEqual(['tools', 'prompts', 'resources']);
      expect(result.protocolVersion).toBe('1.0.0');
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw error when API key not found in request context', async () => {
      const req = { user: {} } as any;
      const dto = { protocolVersion: '1.0.0', clientInfo: {}, capabilities: [] };

      await expect(controller.initialize(dto, req)).rejects.toThrow(
        'API key not found in request context'
      );
    });

    it('should pass correct parameters to createSession', async () => {
      const mockApiKey = { id: 'key-123', projectId: 'proj-456' };
      const req = { user: { apiKey: mockApiKey } } as any;
      const dto = {
        protocolVersion: '2.0.0',
        clientInfo: { name: 'custom-client', version: '1.0' },
        capabilities: ['tools', 'prompts'],
      };

      mockSessionService.createSession.mockResolvedValue({
        sessionId: 'sess_xyz',
        protocolVersion: '2.0.0',
      });

      await controller.initialize(dto, req);

      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        {
          apiKeyId: 'key-123',
          projectId: 'proj-456',
          protocolVersion: '2.0.0',
          clientInfo: { name: 'custom-client', version: '1.0' },
          capabilities: ['tools', 'prompts'],
        },
        req
      );
    });
  });

  // ==========================================================================
  // GROUP 2: Tool Execution
  // ==========================================================================

  describe('callTool', () => {
    it('should execute tool successfully', async () => {
      const req = {} as any;
      const dto = {
        sessionId: 'sess_123',
        toolName: 'get_story',
        arguments: { storyId: 'ST-123' },
      };

      const mockResult = { content: [{ type: 'text', text: 'Story data' }] };
      mockSessionService.executeTool.mockResolvedValue(mockResult);

      const result = await controller.callTool(dto, req);

      expect(mockSessionService.validateSessionBinding).toHaveBeenCalledWith('sess_123', req);
      expect(mockSessionService.validateToolName).toHaveBeenCalledWith('get_story');
      expect(mockSessionService.executeTool).toHaveBeenCalledWith(
        'sess_123',
        'get_story',
        { storyId: 'ST-123' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should validate session binding before execution', async () => {
      const req = {} as any;
      const dto = { sessionId: 'sess_123', toolName: 'test', arguments: {} };

      mockSessionService.validateSessionBinding.mockRejectedValue(
        new Error('Session not found')
      );

      await expect(controller.callTool(dto, req)).rejects.toThrow('Session not found');
      expect(mockSessionService.executeTool).not.toHaveBeenCalled();
    });

    it('should validate tool name before execution', async () => {
      const req = {} as any;
      const dto = { sessionId: 'sess_123', toolName: 'invalid_tool', arguments: {} };

      mockSessionService.validateToolName.mockImplementation(() => {
        throw new Error('Invalid tool name');
      });

      await expect(controller.callTool(dto, req)).rejects.toThrow('Invalid tool name');
      expect(mockSessionService.executeTool).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GROUP 3: List Tools
  // ==========================================================================

  describe('listTools', () => {
    it('should list tools successfully', async () => {
      const req = {} as any;
      const dto = { sessionId: 'sess_123', category: 'stories', query: 'get' };

      const mockTools = {
        tools: [
          { name: 'get_story', description: 'Get story details' },
          { name: 'get_epic', description: 'Get epic details' },
        ],
      };
      mockSessionService.listTools.mockResolvedValue(mockTools);

      const result = await controller.listTools(dto, req);

      expect(mockSessionService.validateSessionBinding).toHaveBeenCalledWith('sess_123', req);
      expect(mockSessionService.listTools).toHaveBeenCalledWith('sess_123', 'stories', 'get');
      expect(result).toEqual(mockTools);
    });

    it('should list tools without optional parameters', async () => {
      const req = {} as any;
      const dto = { sessionId: 'sess_123' };

      mockSessionService.listTools.mockResolvedValue({ tools: [] });

      await controller.listTools(dto, req);

      expect(mockSessionService.listTools).toHaveBeenCalledWith(
        'sess_123',
        undefined,
        undefined
      );
    });
  });

  // ==========================================================================
  // GROUP 4: Session Management
  // ==========================================================================

  describe('getSession', () => {
    it('should get session details successfully', async () => {
      const req = {} as any;
      const mockSession = {
        sessionId: 'sess_123',
        protocolVersion: '1.0.0',
        clientInfo: { name: 'client' },
        capabilities: ['tools'],
        createdAt: new Date('2025-01-01'),
        lastHeartbeat: new Date('2025-01-02'),
        reconnectCount: 2,
      };

      mockSessionService.getSession.mockResolvedValue(mockSession);

      const result = await controller.getSession('sess_123', req);

      expect(mockSessionService.validateSessionBinding).toHaveBeenCalledWith('sess_123', req);
      expect(result).toEqual({
        sessionId: 'sess_123',
        protocolVersion: '1.0.0',
        clientInfo: { name: 'client' },
        capabilities: ['tools'],
        createdAt: mockSession.createdAt,
        lastHeartbeat: mockSession.lastHeartbeat,
        reconnectCount: 2,
      });
    });

    it('should throw error when session not found', async () => {
      const req = {} as any;
      mockSessionService.getSession.mockResolvedValue(null);

      await expect(controller.getSession('sess_123', req)).rejects.toThrow(
        'Session not found'
      );
    });
  });

  describe('updateHeartbeat', () => {
    it('should update heartbeat successfully', async () => {
      const req = {} as any;

      const result = await controller.updateHeartbeat('sess_123', req);

      expect(mockSessionService.validateSessionBinding).toHaveBeenCalledWith('sess_123', req);
      expect(mockSessionService.updateHeartbeat).toHaveBeenCalledWith('sess_123');
      expect(result).toEqual({ message: 'Heartbeat updated' });
    });
  });

  describe('closeSession', () => {
    it('should close session successfully', async () => {
      const req = {} as any;

      const result = await controller.closeSession('sess_123', req);

      expect(mockSessionService.validateSessionBinding).toHaveBeenCalledWith('sess_123', req);
      expect(mockSessionService.closeSession).toHaveBeenCalledWith('sess_123');
      expect(result).toEqual({ message: 'Session closed successfully' });
    });
  });

  // ==========================================================================
  // GROUP 5: SSE Streaming
  // ==========================================================================

  describe('streamEvents', () => {
    let mockResponse: any;
    let mockRequest: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
      };

      mockRequest = {
        on: jest.fn(),
      };
    });

    it('should establish SSE connection successfully', async () => {
      const mockSession = {
        sessionId: 'sess_123',
        protocolVersion: '1.0.0',
      };

      mockSessionService.getSession.mockResolvedValue(mockSession);

      await controller.streamEvents('sess_123', mockRequest, mockResponse);

      expect(mockSessionService.validateSessionBinding).toHaveBeenCalledWith(
        'sess_123',
        mockRequest
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('SSE connection established')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('event: connected'));
    });

    it('should throw NotFoundException when session validation fails', async () => {
      mockSessionService.validateSessionBinding.mockRejectedValue(
        new Error('Session not found')
      );

      await expect(
        controller.streamEvents('sess_123', mockRequest, mockResponse)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockSessionService.getSession.mockResolvedValue(null);

      await expect(
        controller.streamEvents('sess_123', mockRequest, mockResponse)
      ).rejects.toThrow(NotFoundException);
    });

    it('should set up keep-alive interval', async () => {
      const mockSession = { sessionId: 'sess_123' };
      mockSessionService.getSession.mockResolvedValue(mockSession);

      jest.useFakeTimers();

      await controller.streamEvents('sess_123', mockRequest, mockResponse);

      // Clear the initial calls
      mockResponse.write.mockClear();

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);

      // Should have sent keepalive
      expect(mockResponse.write).toHaveBeenCalledWith(': keepalive\n\n');

      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // GROUP 6: Admin Endpoints - API Key Management
  // ==========================================================================

  describe('generateApiKey', () => {
    it('should generate API key successfully', async () => {
      const body = {
        projectId: 'proj-123',
        name: 'Production Key',
        description: 'Key for production environment',
      };

      const mockResult = {
        key: 'proj_abc12345_dGVzdGtleTE2Mzg4',
        keyData: {
          id: 'key-uuid',
          keyPrefix: 'proj_abc123_',
          name: 'Production Key',
          projectId: 'proj-123',
          createdAt: new Date('2025-01-01'),
        },
      };

      mockSessionService.generateApiKey.mockResolvedValue(mockResult);

      const result = await controller.generateApiKey(body);

      expect(mockSessionService.generateApiKey).toHaveBeenCalledWith(
        'proj-123',
        'Production Key',
        'Key for production environment'
      );
      expect(result).toEqual(mockResult);
    });

    it('should generate API key without description', async () => {
      const body = { projectId: 'proj-123', name: 'Test Key' };

      mockSessionService.generateApiKey.mockResolvedValue({ key: 'test-key' });

      await controller.generateApiKey(body);

      expect(mockSessionService.generateApiKey).toHaveBeenCalledWith(
        'proj-123',
        'Test Key',
        undefined
      );
    });
  });

  describe('listApiKeys', () => {
    it('should list API keys successfully', async () => {
      const mockKeys = {
        keys: [
          {
            id: 'key-1',
            keyPrefix: 'proj_abc123_',
            name: 'Production Key',
            description: 'For production',
            createdAt: new Date('2025-01-01'),
            lastUsedAt: new Date('2025-01-02'),
            expiresAt: null,
            revokedAt: null,
          },
        ],
      };

      mockSessionService.listApiKeys.mockResolvedValue(mockKeys);

      const result = await controller.listApiKeys('proj-123');

      expect(mockSessionService.listApiKeys).toHaveBeenCalledWith('proj-123');
      expect(result).toEqual(mockKeys);
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key successfully', async () => {
      const mockResult = {
        message: 'API key revoked successfully',
        sessionsInvalidated: 3,
      };

      mockSessionService.revokeApiKey.mockResolvedValue(mockResult);

      const result = await controller.revokeApiKey('key-123');

      expect(mockSessionService.revokeApiKey).toHaveBeenCalledWith('key-123');
      expect(result).toEqual(mockResult);
    });
  });

  // ==========================================================================
  // GROUP 7: Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle session service errors gracefully', async () => {
      const req = {} as any;
      const dto = { sessionId: 'sess_123', toolName: 'test', arguments: {} };

      mockSessionService.executeTool.mockRejectedValue(new Error('Database error'));

      await expect(controller.callTool(dto, req)).rejects.toThrow('Database error');
    });

    it('should handle missing session in getSession', async () => {
      const req = {} as any;
      mockSessionService.getSession.mockResolvedValue(null);

      await expect(controller.getSession('nonexistent', req)).rejects.toThrow(
        'Session not found'
      );
    });

    it('should calculate correct expiration time', async () => {
      const mockApiKey = { id: 'key-123', projectId: 'proj-456' };
      const req = { user: { apiKey: mockApiKey } } as any;
      const dto = { protocolVersion: '1.0.0', clientInfo: {}, capabilities: [] };

      mockSessionService.createSession.mockResolvedValue({
        sessionId: 'sess_123',
        protocolVersion: '1.0.0',
      });

      const beforeCall = Date.now();
      const result = await controller.initialize(dto, req);
      const afterCall = Date.now();

      const expiresAt = new Date(result.expiresAt).getTime();
      const expectedMin = beforeCall + 3600 * 1000;
      const expectedMax = afterCall + 3600 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });
  });
});
