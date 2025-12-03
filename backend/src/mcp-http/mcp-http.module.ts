/**
 * MCP HTTP Module (Tasks 1.1, 1.6, 3.1, 3.2)
 *
 * Module for MCP protocol over HTTP transport.
 * Provides RESTful endpoints for session management and tool execution.
 *
 * Features:
 * - HTTP REST endpoints for MCP protocol
 * - WebSocket streaming for real-time tool events (Phase 3)
 * - Redis session storage with 1-hour TTL
 * - Global exception filter for security
 * - Input validation with DTOs
 *
 * @see ST-163 Task 1.1: Create Module Structure
 * @see ST-163 Task 1.6: Register Redis Client Provider
 * @see ST-163 Task 3.1: Implement WebSocket Gateway
 * @see ST-163 Task 3.2: Integrate WebSocket with Session Service
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import Redis from 'ioredis';
import { PrismaModule } from '../prisma/prisma.module';
import { McpExceptionFilter } from './filters/mcp-exception.filter';
import { McpAuthGuard } from './guards/mcp-auth.guard';
import { McpRateLimitGuard } from './guards/mcp-rate-limit.guard';
import { McpHttpController } from './mcp-http.controller';
import { McpHttpGateway } from './mcp-http.gateway';
import { McpSessionService } from './mcp-session.service';

/**
 * Redis client provider
 * Injects Redis instance for session storage
 */
const redisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: (configService: ConfigService) => {
    const redisUrl = configService.get('REDIS_URL');

    // If REDIS_URL is set, use it; otherwise use individual config
    if (redisUrl) {
      return new Redis(redisUrl);
    }

    return new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: parseInt(configService.get('REDIS_PORT', '6379'), 10),
      password: configService.get('REDIS_PASSWORD'),
      db: parseInt(configService.get('REDIS_DB', '0'), 10),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });
  },
  inject: [ConfigService],
};

/**
 * McpSessionService provider with Redis injection
 */
const sessionServiceProvider = {
  provide: McpSessionService,
  useFactory: (redis: Redis) => {
    return new McpSessionService(redis);
  },
  inject: ['REDIS_CLIENT'],
};

/**
 * Gateway provider with session service injection
 * Task 3.2: Wire up gateway with session service
 */
const gatewayProvider = {
  provide: McpHttpGateway,
  useFactory: (sessionService: McpSessionService) => {
    return new McpHttpGateway(sessionService);
  },
  inject: [McpSessionService],
};

// Guards are now @Injectable with @Inject('REDIS_CLIENT') decorators
// so they can be provided as simple classes

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [McpHttpController],
  providers: [
    redisProvider,
    sessionServiceProvider,
    gatewayProvider,
    McpAuthGuard,
    McpRateLimitGuard,
    {
      provide: APP_FILTER,
      useClass: McpExceptionFilter,
    },
  ],
  exports: [McpSessionService, McpHttpGateway],
})
export class McpHttpModule implements OnModuleInit {
  constructor(
    private readonly sessionService: McpSessionService,
    private readonly gateway: McpHttpGateway,
  ) {}

  /**
   * Task 3.2: Register gateway with session service after module initialization
   * This allows the session service to emit WebSocket events
   */
  onModuleInit() {
    this.sessionService.setGateway(this.gateway);
  }
}
