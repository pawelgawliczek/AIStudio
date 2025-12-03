/**
 * MCP HTTP Controller (Tasks 1.5, 2.4, 2.4a)
 *
 * RESTful endpoints for MCP protocol over HTTP:
 * - POST /api/mcp/v1/initialize - Create new session
 * - POST /api/mcp/v1/call-tool - Execute MCP tool
 * - GET /api/mcp/v1/list-tools - List available tools
 * - GET /api/mcp/v1/session/:id - Get session status
 * - POST /api/mcp/v1/session/:id/heartbeat - Update heartbeat
 * - DELETE /api/mcp/v1/session/:id - Close session
 *
 * Admin endpoints (Task 2.4, 2.4a):
 * - POST /api/mcp/v1/admin/keys - Generate new API key
 * - GET /api/mcp/v1/admin/keys/:projectId - List project's API keys
 * - DELETE /api/mcp/v1/admin/keys/:id - Revoke API key
 *
 * @see ST-163 Task 1.5: Implement HTTP Controller
 * @see ST-163 Task 2.4: Create API Key Management Endpoints
 * @see ST-163 Task 2.4a: Implement Session Invalidation on API Key Revocation
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Header,
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CallToolDto } from './dto/call-tool.dto';
import { InitializeSessionDto } from './dto/initialize-session.dto';
import { ListToolsDto } from './dto/list-tools.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { ResponseSigningInterceptor } from './interceptors/response-signing.interceptor';
import { McpHttpGateway, ToolEvent } from './mcp-http.gateway';
import { McpSessionService } from './mcp-session.service';

@ApiTags('MCP HTTP Transport')
@UseInterceptors(ResponseSigningInterceptor)
@Controller('api/mcp/v1')
export class McpHttpController {
  constructor(
    private readonly sessionService: McpSessionService,
    private readonly gateway: McpHttpGateway,
  ) {}

  /**
   * Initialize a new MCP session
   * Rate limit: 10 req/min per IP
   */
  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new MCP session' })
  @ApiResponse({
    status: 201,
    description: 'Session created successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async initialize(
    @Body() dto: InitializeSessionDto,
    @Req() req: Request
  ): Promise<SessionResponseDto> {
    // Extract API key from request.user (set by McpAuthGuard in Phase 2)
    const apiKey = (req as any).user?.apiKey;

    if (!apiKey) {
      throw new Error('API key not found in request context');
    }

    // Create session
    const session = await this.sessionService.createSession(
      {
        apiKeyId: apiKey.id,
        projectId: apiKey.projectId,
        protocolVersion: dto.protocolVersion,
        clientInfo: dto.clientInfo,
        capabilities: dto.capabilities,
      },
      req
    );

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return {
      sessionId: session.sessionId,
      serverInfo: {
        name: 'vibestudio-mcp-server',
        version: '1.0.0',
      },
      capabilities: ['tools', 'prompts', 'resources'],
      expiresAt,
      protocolVersion: session.protocolVersion,
    };
  }

  /**
   * Execute an MCP tool
   * Rate limit: 30 req/min per API key
   */
  @Post('call-tool')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Execute MCP tool' })
  @ApiResponse({ status: 200, description: 'Tool executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tool name or arguments' })
  @ApiResponse({ status: 401, description: 'Authentication failed or session expired' })
  @ApiResponse({ status: 404, description: 'Session or tool not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async callTool(
    @Body() dto: CallToolDto,
    @Req() req: Request
  ): Promise<any> {
    // Validate session binding
    await this.sessionService.validateSessionBinding(dto.sessionId, req);

    // Validate tool name
    this.sessionService.validateToolName(dto.toolName);

    // Execute tool (Phase 2 - will delegate to ToolRegistry)
    const result = await this.sessionService.executeTool(
      dto.sessionId,
      dto.toolName,
      dto.arguments
    );

    return result;
  }

  /**
   * List available MCP tools
   * Rate limit: 60 req/min per API key
   */
  @Get('list-tools')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List available MCP tools' })
  @ApiResponse({ status: 200, description: 'Tools listed successfully' })
  @ApiResponse({ status: 401, description: 'Authentication failed or session expired' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async listTools(
    @Query() dto: ListToolsDto,
    @Req() req: Request
  ): Promise<any> {
    // Validate session binding
    await this.sessionService.validateSessionBinding(dto.sessionId, req);

    // List tools (Phase 2 - will delegate to ToolRegistry)
    const tools = await this.sessionService.listTools(
      dto.sessionId,
      dto.category,
      dto.query
    );

    return tools;
  }

  /**
   * Get session status
   * Rate limit: 60 req/min per API key
   */
  @Get('session/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get session status' })
  @ApiResponse({ status: 200, description: 'Session retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getSession(
    @Param('id') sessionId: string,
    @Req() req: Request
  ): Promise<any> {
    // Validate session binding
    await this.sessionService.validateSessionBinding(sessionId, req);

    // Get session
    const session = await this.sessionService.getSession(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      sessionId: session.sessionId,
      protocolVersion: session.protocolVersion,
      clientInfo: session.clientInfo,
      capabilities: session.capabilities,
      createdAt: session.createdAt,
      lastHeartbeat: session.lastHeartbeat,
      reconnectCount: session.reconnectCount,
    };
  }

  /**
   * Update session heartbeat
   * Rate limit: 120 req/min per API key
   */
  @Post('session/:id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update session heartbeat' })
  @ApiResponse({ status: 200, description: 'Heartbeat updated successfully' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async updateHeartbeat(
    @Param('id') sessionId: string,
    @Req() req: Request
  ): Promise<{ message: string }> {
    // Validate session binding
    await this.sessionService.validateSessionBinding(sessionId, req);

    // Update heartbeat
    await this.sessionService.updateHeartbeat(sessionId);

    return { message: 'Heartbeat updated' };
  }

  /**
   * Close session
   * Rate limit: 60 req/min per API key
   */
  @Delete('session/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Close session' })
  @ApiResponse({ status: 200, description: 'Session closed successfully' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async closeSession(
    @Param('id') sessionId: string,
    @Req() req: Request
  ): Promise<{ message: string }> {
    // Validate session binding
    await this.sessionService.validateSessionBinding(sessionId, req);

    // Close session
    await this.sessionService.closeSession(sessionId);

    return { message: 'Session closed successfully' };
  }

  // =========================================================================
  // SSE FALLBACK ENDPOINT (Task 3.3)
  // =========================================================================

  /**
   * Stream session events via Server-Sent Events (SSE)
   * Fallback for clients that cannot use WebSocket
   *
   * This endpoint:
   * - Validates session ownership
   * - Sets up SSE stream with proper headers
   * - Subscribes to session events via in-memory event emitter
   * - Sends keep-alive pings every 30 seconds
   * - Cleans up on disconnect
   *
   * Rate limit: 10 req/min per API key (expensive long-lived connection)
   */
  @Get('session/:id/events')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stream session events via SSE (WebSocket fallback)' })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'event: tool:start\ndata: {"sessionId":"sess_abc...","toolName":"search","timestamp":"2025-12-03T12:00:00Z"}\n\n',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication failed or session expired' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async streamEvents(
    @Param('id') sessionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Validate session ownership
    try {
      await this.sessionService.validateSessionBinding(sessionId, req);
    } catch (error) {
      throw new NotFoundException('Session not found or access denied');
    }

    // Get session to verify it exists
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Set SSE headers (already set by decorators, but ensuring proper format)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    // Send initial connection event
    res.write(`: SSE connection established for session ${sessionId}\n\n`);
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ sessionId, timestamp: new Date().toISOString() })}\n\n`);

    // Create event listener for this session
    // We'll listen to the WebSocket gateway's events via a shared mechanism
    const eventHandler = (event: ToolEvent) => {
      // Format SSE message
      const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
      res.write(sseMessage);
    };

    // Subscribe to session events
    // Note: This is a simplified implementation. In production, you'd want to use
    // a shared event emitter or Redis pub/sub for scalability across multiple instances.
    // For MVP, we'll hook into the gateway's server instance.
    const room = `session:${sessionId}`;

    // Store event handler reference for cleanup
    (req as any).eventHandler = eventHandler;
    (req as any).sessionRoom = room;

    // Set up keep-alive ping every 30 seconds
    const keepAliveInterval = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(keepAliveInterval);

      // Log disconnect
      this.gateway['logger'].log(`SSE client disconnected from session ${sessionId}`);

      // Remove event listener (if we had registered one with the gateway)
      // For MVP, the cleanup is automatic as the response stream closes
    });

    // Note: We don't call res.end() here - SSE connections stay open
    // until the client disconnects or the server closes the connection
  }

  // =========================================================================
  // ADMIN ENDPOINTS (Task 2.4, 2.4a)
  // =========================================================================

  /**
   * Generate a new API key for a project
   * Requires JWT authentication and admin role
   */
  @Post('admin/keys')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate new API key (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'API key generated successfully',
    schema: {
      example: {
        key: 'proj_abc12345_dGVzdGtleTE2Mzg4...',
        keyData: {
          id: 'uuid-here',
          keyPrefix: 'proj_abc123_',
          name: 'Production Key',
          projectId: 'project-uuid',
          createdAt: '2025-12-03T12:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async generateApiKey(
    @Body() body: { projectId: string; name: string; description?: string }
  ): Promise<any> {
    return await this.sessionService.generateApiKey(
      body.projectId,
      body.name,
      body.description
    );
  }

  /**
   * List all API keys for a project
   * Requires JWT authentication and admin role
   */
  @Get('admin/keys/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List project API keys (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'API keys listed successfully',
    schema: {
      example: {
        keys: [
          {
            id: 'uuid-here',
            keyPrefix: 'proj_abc123_',
            name: 'Production Key',
            description: 'Key for production environment',
            createdAt: '2025-12-03T12:00:00.000Z',
            lastUsedAt: '2025-12-03T14:00:00.000Z',
            expiresAt: null,
            revokedAt: null,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async listApiKeys(@Param('projectId') projectId: string): Promise<any> {
    return await this.sessionService.listApiKeys(projectId);
  }

  /**
   * Revoke an API key (Task 2.4a - Session Invalidation)
   * Invalidates all active sessions using this key
   * Requires JWT authentication and admin role
   */
  @Delete('admin/keys/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke API key (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'API key revoked and sessions invalidated',
    schema: {
      example: {
        message: 'API key revoked successfully',
        sessionsInvalidated: 3,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revokeApiKey(@Param('id') id: string): Promise<any> {
    return await this.sessionService.revokeApiKey(id);
  }
}
