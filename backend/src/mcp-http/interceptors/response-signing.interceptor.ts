/**
 * Response Signing Interceptor (Task 5.3)
 *
 * Adds HMAC signatures to responses for integrity verification.
 * Prevents response tampering and ensures clients receive authentic data.
 *
 * Security Features:
 * - HMAC-SHA256 signatures
 * - X-Signature header with hex digest
 * - Optional (enabled via HMAC_SECRET env var)
 * - Only applied when HMAC_SECRET is configured
 *
 * @see ST-163 Task 5.3: Response Signing with HMAC
 */

import * as crypto from 'crypto';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseSigningInterceptor implements NestInterceptor {
  private readonly hmacSecret = process.env.HMAC_SECRET;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Only sign if HMAC_SECRET is configured
        if (this.hmacSecret) {
          try {
            // Create HMAC signature of response body
            const signature = crypto
              .createHmac('sha256', this.hmacSecret)
              .update(JSON.stringify(data))
              .digest('hex');

            // Add signature to response headers
            response.setHeader('X-Signature', signature);
            response.setHeader('X-Signature-Algorithm', 'HMAC-SHA256');
          } catch (error) {
            // Log error but don't fail the request
            console.error('Failed to sign response:', error);
          }
        }

        return data;
      }),
    );
  }
}
