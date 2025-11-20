import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * NoCacheInterceptor - Prevents caching of API responses
 *
 * Purpose: Ensures frontend always receives fresh data after analysis completion.
 * This addresses BR-1 (Real-Time Data Refresh) from BA Analysis.
 *
 * Cache-Control Headers:
 * - no-cache: Must revalidate with server before using cached response
 * - no-store: Must not store any part of response
 * - must-revalidate: Cannot serve stale data
 * - max-age=0: Response expires immediately
 *
 * Use Case: Applied to all /code-metrics/* endpoints to prevent stale data display
 * after code analysis completion (ST-16 Issue #1 fix).
 */
@Injectable()
export class NoCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    // Set cache-control headers as specified in architect_analysis
    response.setHeader(
      'Cache-Control',
      'no-cache, no-store, must-revalidate, max-age=0',
    );
    response.setHeader('Pragma', 'no-cache'); // HTTP/1.0 compatibility
    response.setHeader('Expires', '0'); // Proxies

    return next.handle().pipe(
      map((data) => {
        return data;
      }),
    );
  }
}
