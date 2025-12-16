import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TelemetryService } from './telemetry.service';
import * as api from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';

/**
 * TracingInterceptor - Automatic HTTP request tracing
 *
 * Intercepts all HTTP requests and creates spans with:
 * - HTTP method, path, status code
 * - Request/response timing
 * - Error tracking
 * - Session context (from headers)
 *
 * Applied globally via APP_INTERCEPTOR provider
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TracingInterceptor.name);

  constructor(private readonly telemetry: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.telemetry.isEnabled()) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Skip health check endpoint to reduce noise
    if (request.path === '/api/health' || request.path === '/health') {
      return next.handle();
    }

    const method = request.method;
    const path = request.route?.path || request.path;
    const spanName = `HTTP ${method} ${path}`;

    const span = this.telemetry.startSpan(spanName, {
      'http.method': method,
      'http.route': path,
      'http.url': request.url,
      'http.target': request.path,
      'http.scheme': request.protocol,
      'http.host': request.get('host'),
      'http.user_agent': request.get('user-agent'),
    });

    // Extract session ID from headers if present
    const sessionId = request.get('x-session-id') || request.get('x-claude-session-id');
    if (sessionId) {
      span.setAttribute('session.id', sessionId);
    }

    // Extract story/workflow context from headers if present
    const storyId = request.get('x-story-id');
    const runId = request.get('x-workflow-run-id');
    if (storyId) {
      span.setAttribute('story.id', storyId);
    }
    if (runId) {
      span.setAttribute('workflow.run.id', runId);
    }

    const ctx = api.trace.setSpan(api.context.active(), span);

    const startTime = Date.now();

    return api.context.with(ctx, () => {
      return next.handle().pipe(
        tap(() => {
          const duration = Date.now() - startTime;
          span.setAttribute('http.status_code', response.statusCode);
          span.setAttribute('http.duration_ms', duration);

          // Set span status based on HTTP status code
          if (response.statusCode >= 200 && response.statusCode < 400) {
            span.setStatus({ code: SpanStatusCode.OK });
          } else if (response.statusCode >= 400 && response.statusCode < 500) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Client error' });
          } else if (response.statusCode >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Server error' });
          }

          span.end();
        }),
        catchError((error) => {
          const duration = Date.now() - startTime;
          span.setAttribute('http.duration_ms', duration);
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message || 'Request failed',
          });
          span.end();
          throw error;
        }),
      );
    });
  }
}
