/**
 * MCP Exception Filter (Task 1.8 - CRITICAL SECURITY)
 *
 * Global exception handler that prevents information leakage by:
 * - Returning generic error messages in production
 * - Returning detailed error messages in development
 * - Logging full error details server-side
 * - Mapping exceptions to standardized error codes
 *
 * @see ST-163 Task 1.8: Implement GlobalExceptionFilter
 */

import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class McpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(McpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProd = process.env.NODE_ENV === 'production';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorCode = this.mapExceptionToCode(exception);

    // Log full error server-side (always)
    this.logger.error({
      message: exception.message,
      stack: exception.stack,
      url: request.url,
      method: request.method,
      ip: request.ip,
      sessionId: request.body?.sessionId || request.params?.id,
    });

    // Return sanitized error to client
    const errorResponse = {
      error: {
        code: errorCode,
        message: isProd
          ? this.getGenericMessage(status)
          : exception.message,
        details: isProd ? undefined : exception.stack,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Map exception to standardized error code
   */
  private mapExceptionToCode(exception: any): string {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
      if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
      if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
      if (status === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMIT_EXCEEDED';
      if (status === HttpStatus.BAD_REQUEST) return 'BAD_REQUEST';
    }
    return 'INTERNAL_ERROR';
  }

  /**
   * Get generic error message for production (no sensitive info leaked)
   */
  private getGenericMessage(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'Authentication failed';
      case HttpStatus.FORBIDDEN:
        return 'Access denied';
      case HttpStatus.NOT_FOUND:
        return 'Resource not found';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Rate limit exceeded';
      case HttpStatus.BAD_REQUEST:
        return 'Invalid request';
      default:
        return 'An error occurred';
    }
  }
}
