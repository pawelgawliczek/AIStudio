import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard for internal API endpoints (ST-129)
 *
 * These endpoints are called by MCP handlers running in separate processes.
 * They authenticate using a shared secret (INTERNAL_API_SECRET) instead of JWT.
 *
 * The secret is passed in the X-Internal-API-Secret header.
 */
@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedSecret = request.headers['x-internal-api-secret'];
    const expectedSecret = this.configService.get<string>('INTERNAL_API_SECRET');

    // If no secret is configured, deny all requests (fail-safe)
    if (!expectedSecret) {
      console.warn('[InternalApiGuard] INTERNAL_API_SECRET not configured - denying request');
      throw new UnauthorizedException('Internal API not configured');
    }

    // Validate the secret
    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid internal API secret');
    }

    return true;
  }
}
