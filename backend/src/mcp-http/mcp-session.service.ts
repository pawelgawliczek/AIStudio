/**
 * MCP Session Service (Tasks 1.4, 1.4a)
 *
 * Manages MCP HTTP sessions with Redis storage and security features:
 * - Session creation with 1-hour TTL
 * - IP and User-Agent binding for hijacking prevention
 * - API key revocation propagation
 * - Input validation for security
 *
 * @see ST-163 Task 1.4: Implement Session Service
 * @see ST-163 Task 1.4a: Enhance Session Interface with IP/User-Agent Binding
 * @see ST-163 Task 1.2a: Define Detailed Input Validation Rules
 */

import * as crypto from 'crypto';
import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { Redis } from 'ioredis';
import {
  McpSession,
  CreateSessionData,
  MCP_SESSION_TTL,
  MCP_SESSION_PREFIX,
} from './interfaces/mcp-session.interface';
import { validateToolArguments } from './utils/ssrf-validator';

@Injectable()
export class McpSessionService {
  private readonly logger = new Logger(McpSessionService.name);
  private mcpGateway: any; // Injected later in Phase 3 for WebSocket events

  constructor(private readonly redis: Redis) {}

  /**
   * Set WebSocket gateway for event emission (Task 3.2)
   * Called by module after gateway is instantiated
   */
  setGateway(gateway: any): void {
    this.mcpGateway = gateway;
    this.logger.log('WebSocket gateway registered with session service');
  }

  /**
   * Create a new session in Redis with 1-hour TTL
   * Captures IP and User-Agent for session binding
   */
  async createSession(
    data: CreateSessionData,
    req: Request
  ): Promise<McpSession> {
    // Validate inputs
    this.validateProtocolVersion(data.protocolVersion);
    this.validateClientInfo(data.clientInfo);

    // Generate session ID (format: sess_{32-char hex})
    const randomBytes = crypto.randomBytes(16);
    const sessionId = `sess_${randomBytes.toString('hex')}`;

    const now = new Date().toISOString();

    // Create session object
    const session: McpSession = {
      sessionId,
      apiKeyId: data.apiKeyId,
      projectId: data.projectId,
      protocolVersion: data.protocolVersion,
      clientInfo: data.clientInfo,
      capabilities: data.capabilities,
      createdAt: now,
      lastHeartbeat: now,
      reconnectCount: 0,
      // Security: Session binding (Task 1.4a)
      originIp: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      apiKeyRevoked: false,
    };

    // Store in Redis with TTL
    const redisKey = `${MCP_SESSION_PREFIX}${sessionId}`;
    await this.redis.hset(redisKey, session as any);
    await this.redis.expire(redisKey, MCP_SESSION_TTL);

    this.logger.log(
      `Session created: ${sessionId} (API key: ${data.apiKeyId}, IP: ${session.originIp})`
    );

    return session;
  }

  /**
   * Retrieve session from Redis
   */
  async getSession(sessionId: string): Promise<McpSession | null> {
    this.validateSessionId(sessionId);

    const redisKey = `${MCP_SESSION_PREFIX}${sessionId}`;
    const data = await this.redis.hgetall(redisKey);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    // Parse capabilities array and boolean fields (Redis stores everything as strings)
    const session: McpSession = {
      ...data,
      capabilities: typeof data.capabilities === 'string'
        ? JSON.parse(data.capabilities)
        : data.capabilities,
      reconnectCount: parseInt(data.reconnectCount as any, 10) || 0,
      apiKeyRevoked: (data.apiKeyRevoked as any) === 'true' || (data.apiKeyRevoked as any) === true,
    } as McpSession;

    return session;
  }

  /**
   * Validate session binding (Task 1.4a - HIGH SECURITY)
   * Checks:
   * - Session exists
   * - API key not revoked
   * - IP address matches
   * - User-Agent matches
   */
  async validateSessionBinding(sessionId: string, req: Request): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.apiKeyRevoked) {
      throw new UnauthorizedException('API key revoked');
    }

    if (session.originIp !== req.ip) {
      this.logger.warn(
        `Session hijacking attempt detected: ${sessionId} (expected IP: ${session.originIp}, got: ${req.ip})`
      );
      throw new UnauthorizedException('Session binding violation (IP mismatch)');
    }

    if (session.userAgent !== req.headers['user-agent']) {
      this.logger.warn(
        `Session hijacking attempt detected: ${sessionId} (User-Agent mismatch)`
      );
      throw new UnauthorizedException('Session binding violation (User-Agent mismatch)');
    }
  }

  /**
   * Update session heartbeat and reset TTL
   */
  async updateHeartbeat(sessionId: string): Promise<void> {
    this.validateSessionId(sessionId);

    const redisKey = `${MCP_SESSION_PREFIX}${sessionId}`;
    const now = new Date().toISOString();

    await this.redis.hset(redisKey, 'lastHeartbeat', now);
    await this.redis.expire(redisKey, MCP_SESSION_TTL);
  }

  /**
   * Increment reconnection count
   */
  async incrementReconnectCount(sessionId: string): Promise<void> {
    this.validateSessionId(sessionId);

    const redisKey = `${MCP_SESSION_PREFIX}${sessionId}`;
    const session = await this.getSession(sessionId);

    if (session) {
      const newCount = session.reconnectCount + 1;
      await this.redis.hset(redisKey, 'reconnectCount', newCount.toString());
    }
  }

  /**
   * Close session and delete from Redis
   */
  async closeSession(sessionId: string): Promise<void> {
    this.validateSessionId(sessionId);

    const redisKey = `${MCP_SESSION_PREFIX}${sessionId}`;
    await this.redis.del(redisKey);

    this.logger.log(`Session closed: ${sessionId}`);
  }

  /**
   * Revoke all sessions for an API key (Task 2.4a - HIGH SECURITY)
   */
  async revokeApiKeySessions(apiKeyId: string): Promise<void> {
    // Find all sessions for this API key
    const pattern = `${MCP_SESSION_PREFIX}*`;
    const keys = await this.redis.keys(pattern);

    const sessions: McpSession[] = [];
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (data && data.apiKeyId === apiKeyId) {
        sessions.push({
          ...data,
          capabilities: JSON.parse(data.capabilities as any),
          reconnectCount: parseInt(data.reconnectCount as any, 10),
          apiKeyRevoked: data.apiKeyRevoked === 'true',
        } as McpSession);
      }
    }

    // Mark all sessions as revoked
    for (const session of sessions) {
      const redisKey = `${MCP_SESSION_PREFIX}${session.sessionId}`;
      await this.redis.hset(redisKey, 'apiKeyRevoked', 'true');

      // Emit WebSocket event if gateway available (Phase 3)
      if (this.mcpGateway) {
        this.mcpGateway.emitToSession(session.sessionId, {
          type: 'session:revoked',
          message: 'API key revoked - session terminated',
        });
      }
    }

    this.logger.warn(
      `API key ${apiKeyId} revoked - ${sessions.length} sessions invalidated`
    );

    // Schedule session deletion after grace period (5 seconds)
    setTimeout(() => {
      sessions.forEach(session => this.closeSession(session.sessionId));
    }, 5000);
  }

  // ===== Input Validation Methods (Task 1.2a - CRITICAL SECURITY) =====

  /**
   * Validate tool name format
   * Allows only alphanumeric, hyphens, and underscores
   */
  validateToolName(toolName: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) {
      throw new BadRequestException('Invalid tool name format');
    }

    if (toolName.length > 100) {
      throw new BadRequestException('Tool name exceeds maximum length');
    }
  }

  /**
   * Validate client info format and length
   */
  validateClientInfo(clientInfo: string): void {
    if (clientInfo.length > 200) {
      throw new BadRequestException('Client info exceeds maximum length');
    }

    // Check for null bytes, control characters, script tags
    if (/[\x00<>$`]/.test(clientInfo)) {
      throw new BadRequestException('Invalid client info format');
    }

    if (!/^[a-zA-Z0-9\s\-_.]+$/.test(clientInfo)) {
      throw new BadRequestException('Invalid client info format');
    }
  }

  // =========================================================================
  // ADMIN METHODS (Task 2.4, 2.4a)
  // =========================================================================

  /**
   * Generate a new API key for a project (Task 2.4)
   */
  async generateApiKey(
    projectId: string,
    name: string,
    description?: string
  ): Promise<any> {
    const { generateApiKey } = await import('./utils/api-key.util');
    const { key, keyData } = await generateApiKey(projectId, name);

    // Store in database (need to import PrismaService)
    const { PrismaService } = await import('../prisma/prisma.service');
    const prisma = new PrismaService();

    const apiKey = await prisma.apiKey.create({
      data: {
        projectId: keyData.projectId,
        keyHash: keyData.keyHash,
        keyPrefix: keyData.keyPrefix,
        name: keyData.name,
        description: description || null,
      },
    });

    this.logger.log(`API key created: ${keyData.keyPrefix} for project ${projectId}`);

    return {
      key, // Return plaintext key ONCE
      keyData: {
        id: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        projectId: apiKey.projectId,
        createdAt: apiKey.createdAt,
      },
    };
  }

  /**
   * List all API keys for a project (Task 2.4)
   */
  async listApiKeys(projectId: string): Promise<any> {
    const { PrismaService } = await import('../prisma/prisma.service');
    const prisma = new PrismaService();

    const keys = await prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        description: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { keys };
  }

  /**
   * Revoke an API key and invalidate all sessions (Task 2.4a)
   * This implements session invalidation on API key revocation
   */
  async revokeApiKey(apiKeyId: string): Promise<any> {
    const { PrismaService } = await import('../prisma/prisma.service');
    const prisma = new PrismaService();

    // Step 1: Update API key in database
    const apiKey = await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    // Step 2: Find all active sessions for this API key
    const sessions = await this.findSessionsByApiKey(apiKeyId);

    // Step 3: Mark all sessions as revoked in Redis
    await Promise.all(
      sessions.map((session) =>
        this.redis.hset(
          `${MCP_SESSION_PREFIX}${session.sessionId}`,
          'apiKeyRevoked',
          'true'
        )
      )
    );

    // Step 4: Emit WebSocket event to close connections (if gateway available)
    if (this.mcpGateway) {
      sessions.forEach((session) => {
        this.mcpGateway.emitToSession(session.sessionId, {
          type: 'session:revoked',
          message: 'API key revoked - session terminated',
        });
      });
    }

    // Step 5: Schedule session deletion after grace period (5 seconds)
    setTimeout(() => {
      sessions.forEach((session) => this.closeSession(session.sessionId));
    }, 5000);

    this.logger.warn(
      `API key ${apiKey.keyPrefix} revoked - ${sessions.length} sessions invalidated`
    );

    return {
      message: 'API key revoked successfully',
      sessionsInvalidated: sessions.length,
    };
  }

  /**
   * Find all sessions for a specific API key (helper for Task 2.4a)
   */
  private async findSessionsByApiKey(apiKeyId: string): Promise<McpSession[]> {
    const pattern = `${MCP_SESSION_PREFIX}*`;
    const keys = await this.redis.keys(pattern);

    const sessions = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.hgetall(key);
        if (!data || Object.keys(data).length === 0) return null;

        // Parse session
        return {
          ...data,
          capabilities: typeof data.capabilities === 'string'
            ? JSON.parse(data.capabilities)
            : data.capabilities,
          reconnectCount: parseInt(data.reconnectCount as any, 10) || 0,
          apiKeyRevoked: (data.apiKeyRevoked as any) === 'true',
        } as McpSession;
      })
    );

    // Filter by API key ID
    return sessions
      .filter((s) => s !== null && s.apiKeyId === apiKeyId)
      .filter((s): s is McpSession => s !== null);
  }

  /**
   * Validate session ID format
   * Must be: sess_{32 hex chars}
   */
  validateSessionId(sessionId: string): void {
    if (!/^sess_[a-f0-9]{32}$/.test(sessionId)) {
      throw new BadRequestException('Invalid session ID format');
    }
  }

  /**
   * Validate protocol version format
   * Must be: mcp/X.Y where X and Y are numbers
   */
  validateProtocolVersion(version: string): void {
    if (!/^mcp\/\d+\.\d+$/.test(version)) {
      throw new BadRequestException('Invalid protocol version format');
    }

    // Prevent extremely high version numbers
    const parts = version.split('/')[1].split('.');
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);

    if (major > 999 || minor > 999) {
      throw new BadRequestException('Invalid protocol version format');
    }
  }

  /**
   * Execute MCP tool with WebSocket event streaming (Tasks 2.x, 3.2, 5.4)
   * Delegates to ToolRegistry and emits events via WebSocket gateway
   * Includes SSRF validation for tool arguments
   */
  async executeTool(sessionId: string, toolName: string, args: Record<string, any>): Promise<any> {
    // Task 5.4: Validate tool arguments for SSRF vulnerabilities
    validateToolArguments(toolName, args);

    // Emit tool:start event
    if (this.mcpGateway) {
      this.mcpGateway.emitToSession(sessionId, {
        type: 'tool:start',
        sessionId,
        toolName,
        timestamp: new Date().toISOString(),
        data: {},
      });
    }

    try {
      // TODO: Phase 2 - Delegate to existing ToolRegistry
      // For now, simulate tool execution for testing
      const result = {
        success: true,
        output: `Tool ${toolName} executed with args: ${JSON.stringify(args)}`,
        timestamp: new Date().toISOString(),
      };

      // Emit tool:complete event
      if (this.mcpGateway) {
        this.mcpGateway.emitToSession(sessionId, {
          type: 'tool:complete',
          sessionId,
          toolName,
          timestamp: new Date().toISOString(),
          data: { result },
        });
      }

      return result;
    } catch (error: any) {
      // Emit tool:error event
      if (this.mcpGateway) {
        this.mcpGateway.emitToSession(sessionId, {
          type: 'tool:error',
          sessionId,
          toolName,
          timestamp: new Date().toISOString(),
          data: {
            error: {
              code: 'TOOL_ERROR',
              message: error.message || 'Tool execution failed',
            },
          },
        });
      }

      throw error;
    }
  }

  /**
   * List available MCP tools (delegated to ToolRegistry in Phase 2)
   * Placeholder for now
   */
  async listTools(sessionId: string, category?: string, query?: string): Promise<any> {
    // This will be implemented in Phase 2 by delegating to the existing ToolRegistry
    throw new Error('Tool listing not implemented yet - Phase 2');
  }
}

// Export constants for use in tests and other modules
export { MCP_SESSION_TTL, MCP_SESSION_PREFIX };
