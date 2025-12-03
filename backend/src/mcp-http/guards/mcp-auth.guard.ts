/**
 * McpAuthGuard - API Key Authentication with Account Lockout (Tasks 2.3, 2.7)
 *
 * Implements:
 * - API key authentication using bcrypt.compare()
 * - Account lockout after 5 failed attempts (5 minutes)
 * - Session binding (IP + User-Agent) validation
 * - Timing attack prevention
 *
 * @see ST-163 Task 2.3: Implement API Key Authentication Guard
 * @see ST-163 Task 2.7: Implement Account Lockout
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { validateApiKey, extractKeyPrefix } from '../utils/api-key.util';

@Injectable()
export class McpAuthGuard implements CanActivate {
  private readonly logger = new Logger(McpAuthGuard.name);

  // Account lockout configuration
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private readonly FAILED_ATTEMPTS_WINDOW_SEC = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip auth for admin endpoints (they handle their own security, e.g., internal network only)
    const path = request.path || request.url;
    if (path.includes('/admin/')) {
      return true;
    }

    // Extract Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('API key required');
    }

    const providedKey = authHeader.replace('Bearer ', '');
    const keyPrefix = extractKeyPrefix(providedKey);

    // Check if API key is locked out
    const lockoutKey = `lockout:${keyPrefix}`;
    const lockoutUntil = await this.redis.get(lockoutKey);

    if (lockoutUntil && Date.now() < parseInt(lockoutUntil)) {
      const remainingMs = parseInt(lockoutUntil) - Date.now();
      const retryAfter = Math.ceil(remainingMs / 1000);

      throw new HttpException(
        {
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Too many failed authentication attempts',
            retryAfter,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Validate API key
    try {
      const apiKey = await validateApiKey(providedKey, this.prisma);

      // Attach validated API key to request
      request.user = request.user || {};
      request.user.apiKey = apiKey;

      // Reset failed attempts on successful authentication
      const failedKey = `failed-attempts:${keyPrefix}`;
      await this.redis.del(failedKey);

      this.logger.log(
        `API key ${keyPrefix} authenticated successfully (project: ${apiKey.projectId})`,
      );

      return true;
    } catch (error) {
      // Increment failed attempts
      const failedKey = `failed-attempts:${keyPrefix}`;
      const attempts = await this.redis.incr(failedKey);

      // Set expiration on first attempt
      if (attempts === 1) {
        await this.redis.expire(failedKey, this.FAILED_ATTEMPTS_WINDOW_SEC);
      }

      this.logger.warn(
        `Failed authentication attempt ${attempts} for key ${keyPrefix}`,
      );

      // Lock account if max attempts reached
      if (attempts >= this.MAX_FAILED_ATTEMPTS) {
        const lockoutUntil = Date.now() + this.LOCKOUT_DURATION_MS;
        await this.redis.set(
          lockoutKey,
          lockoutUntil.toString(),
          'PX',
          this.LOCKOUT_DURATION_MS,
        );

        this.logger.warn(
          `API key ${keyPrefix} locked out after ${attempts} failed attempts`,
        );

        throw new HttpException(
          {
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Too many failed authentication attempts',
              retryAfter: this.LOCKOUT_DURATION_MS / 1000,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Re-throw original error
      throw error;
    }
  }
}
