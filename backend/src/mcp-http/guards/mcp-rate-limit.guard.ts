/**
 * McpRateLimitGuard - Multi-Dimensional Rate Limiting (Task 2.3a)
 *
 * Implements 4 layers of rate limiting:
 * 1. Per-API-key: 60 req/min
 * 2. Per-IP: 100 req/min
 * 3. Per-endpoint: 10-120 req/min (varies by endpoint cost)
 * 4. Global: 10,000 req/min (infrastructure protection)
 *
 * Uses Redis for distributed rate limiting across multiple instances.
 *
 * @see ST-163 Task 2.3a: Implement Multi-Dimensional Rate Limiting
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Rate limit configuration for all dimensions
 */
export const RATE_LIMITS = {
  // Per API key (primary limit)
  perApiKey: {
    ttl: 60,      // 1 minute
    limit: 60,    // 60 requests
  },

  // Per IP (prevent single IP abuse)
  perIp: {
    ttl: 60,
    limit: 100,   // More lenient for NAT scenarios
  },

  // Per endpoint (expensive operations have stricter limits)
  perEndpoint: {
    '/call-tool': { ttl: 60, limit: 30 },     // Most expensive
    '/initialize': { ttl: 60, limit: 10 },    // Moderate
    '/list-tools': { ttl: 60, limit: 60 },    // Cheap
    '/heartbeat': { ttl: 60, limit: 120 },    // Very cheap
  },

  // Global (protect infrastructure)
  global: {
    ttl: 60,
    limit: 10000, // Total across all clients
  },
};

interface RateLimitResult {
  allowed: boolean;
  dimension: string;
  retryAfter?: number;
}

@Injectable()
export class McpRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(McpRateLimitGuard.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip rate limiting for admin endpoints
    const path = request.path || request.url;
    if (path.includes('/admin/')) {
      return true;
    }

    try {
      // Extract request identifiers
      const apiKey = request.user?.apiKey;
      const keyPrefix = apiKey?.keyPrefix || 'unknown';
      const ip = request.ip;
      const endpoint = request.route?.path || '/unknown';

      // Check all dimensions
      const checks = await Promise.all([
        this.checkPerApiKey(keyPrefix),
        this.checkPerIp(ip),
        this.checkPerEndpoint(endpoint, keyPrefix),
        this.checkGlobal(),
      ]);

      // Find first exceeded limit
      const exceeded = checks.find((result) => !result.allowed);

      if (exceeded) {
        throw new HttpException(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded: ${exceeded.dimension}`,
              retryAfter: exceeded.retryAfter || 60,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      // Fail open if Redis is down (availability over rate limiting)
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.warn(`Rate limiting failed (Redis error): ${error.message}`);
      return true;
    }
  }

  /**
   * Check per-API-key rate limit (60 req/min)
   */
  private async checkPerApiKey(keyPrefix: string): Promise<RateLimitResult> {
    const key = `rate-limit:api-key:${keyPrefix}`;
    const count = await this.increment(key, RATE_LIMITS.perApiKey.ttl);
    const retryAfter = await this.getRetryAfter(key);

    return {
      allowed: count <= RATE_LIMITS.perApiKey.limit,
      dimension: 'per-API-key',
      retryAfter,
    };
  }

  /**
   * Check per-IP rate limit (100 req/min)
   */
  private async checkPerIp(ip: string): Promise<RateLimitResult> {
    const key = `rate-limit:ip:${ip}`;
    const count = await this.increment(key, RATE_LIMITS.perIp.ttl);
    const retryAfter = await this.getRetryAfter(key);

    return {
      allowed: count <= RATE_LIMITS.perIp.limit,
      dimension: 'per-IP',
      retryAfter,
    };
  }

  /**
   * Check per-endpoint rate limit (varies by endpoint)
   */
  private async checkPerEndpoint(
    endpoint: string,
    keyPrefix: string,
  ): Promise<RateLimitResult> {
    // Extract endpoint name from path (e.g., "/api/mcp/v1/call-tool" -> "/call-tool")
    const endpointName = endpoint.split('/').pop() || endpoint;
    const endpointKey = `/${endpointName}`;

    // Get endpoint-specific limits
    const endpointLimit = RATE_LIMITS.perEndpoint[endpointKey];
    if (!endpointLimit) {
      // No specific limit for this endpoint, allow
      return { allowed: true, dimension: 'per-endpoint' };
    }

    const key = `rate-limit:endpoint:${endpointKey}:${keyPrefix}`;
    const count = await this.increment(key, endpointLimit.ttl);
    const retryAfter = await this.getRetryAfter(key);

    return {
      allowed: count <= endpointLimit.limit,
      dimension: 'per-endpoint',
      retryAfter,
    };
  }

  /**
   * Check global rate limit (10,000 req/min)
   */
  private async checkGlobal(): Promise<RateLimitResult> {
    const key = 'rate-limit:global';
    const count = await this.increment(key, RATE_LIMITS.global.ttl);
    const retryAfter = await this.getRetryAfter(key);

    return {
      allowed: count <= RATE_LIMITS.global.limit,
      dimension: 'global',
      retryAfter,
    };
  }

  /**
   * Increment counter and set TTL if new key
   */
  private async increment(key: string, ttl: number): Promise<number> {
    const currentValue = await this.redis.get(key);

    if (currentValue === null) {
      // New key, set initial value with TTL
      await this.redis.set(key, '1', 'EX', ttl);
      return 1;
    }

    // Existing key, increment
    const count = await this.redis.incr(key);
    return count;
  }

  /**
   * Get retry-after value (remaining TTL)
   */
  private async getRetryAfter(key: string): Promise<number> {
    const ttl = await this.redis.ttl(key);
    return ttl > 0 ? ttl : 60; // Default 60 seconds if TTL not set
  }
}
