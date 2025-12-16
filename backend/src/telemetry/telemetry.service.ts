import { Injectable, Logger } from '@nestjs/common';
import * as api from '@opentelemetry/api';
import { Span, SpanStatusCode, Context } from '@opentelemetry/api';

/**
 * TelemetryService - Central service for distributed tracing
 *
 * Provides OpenTelemetry instrumentation with:
 * - Span creation and management
 * - Context propagation
 * - Story/workflow correlation
 * - Sensitive data sanitization
 *
 * Security: Never logs traces to stdout (MCP uses stdout for JSON-RPC)
 */
@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly tracer: api.Tracer;
  private enabled: boolean;

  // Sensitive fields to redact from traces
  private readonly SENSITIVE_KEYS = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'auth',
    'bearer',
    'jwt',
    'privateKey',
    'private_key',
    'credentials',
    'cookie',
    'session',
  ];

  constructor() {
    this.enabled = process.env.OTEL_ENABLED === 'true';

    if (this.enabled) {
      this.tracer = api.trace.getTracer('aistudio-backend', '1.0.0');
      this.logger.log('Telemetry service initialized');
    } else {
      // Provide no-op tracer when disabled
      this.tracer = api.trace.getTracer('noop');
      this.logger.log('Telemetry disabled (OTEL_ENABLED=false)');
    }
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Start a new span with automatic context management
   *
   * @param name - Span name (e.g., "mcp.get_story", "http.request")
   * @param attributes - Span attributes (will be sanitized)
   * @param options - OpenTelemetry span options
   * @returns Active span
   */
  startSpan(
    name: string,
    attributes?: Record<string, any>,
    options?: api.SpanOptions,
  ): Span {
    if (!this.enabled) {
      return api.trace.getSpan(api.context.active()) || api.trace.wrapSpanContext(api.INVALID_SPAN_CONTEXT);
    }

    const sanitizedAttrs = attributes ? this.sanitizeParams(attributes) : {};

    const span = this.tracer.startSpan(name, {
      ...options,
      attributes: sanitizedAttrs,
    });

    return span;
  }

  /**
   * Get current trace ID for correlation
   *
   * @returns Trace ID string or null if no active span
   */
  getCurrentTraceId(): string | null {
    if (!this.enabled) {
      return null;
    }

    const span = api.trace.getActiveSpan();
    if (!span) {
      return null;
    }

    const spanContext = span.spanContext();
    return spanContext.traceId || null;
  }

  /**
   * Get current span ID
   *
   * @returns Span ID string or null if no active span
   */
  getCurrentSpanId(): string | null {
    if (!this.enabled) {
      return null;
    }

    const span = api.trace.getActiveSpan();
    if (!span) {
      return null;
    }

    const spanContext = span.spanContext();
    return spanContext.spanId || null;
  }

  /**
   * Execute a function within a span context
   *
   * @param name - Span name
   * @param fn - Function to execute
   * @param attributes - Span attributes
   * @returns Function result
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    if (!this.enabled) {
      // When disabled, execute function without tracing
      const noopSpan = api.trace.getSpan(api.context.active()) || api.trace.wrapSpanContext(api.INVALID_SPAN_CONTEXT);
      return fn(noopSpan);
    }

    const span = this.startSpan(name, attributes);
    const ctx = api.trace.setSpan(api.context.active(), span);

    try {
      const result = await api.context.with(ctx, async () => {
        return await fn(span);
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute a function with story/workflow context
   *
   * Adds story.id, workflow.run.id attributes to all spans in context
   *
   * @param storyId - Story UUID
   * @param runId - Workflow run UUID (optional)
   * @param fn - Function to execute
   * @returns Function result
   */
  async withStoryContext<T>(
    storyId: string,
    runId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const attributes: Record<string, string> = {
      'story.id': storyId,
    };

    if (runId) {
      attributes['workflow.run.id'] = runId;
    }

    return this.withSpan('story.context', async (span) => {
      span.setAttributes(attributes);
      return fn();
    });
  }

  /**
   * Add session context to current span
   *
   * @param sessionId - Claude Code session ID
   */
  addSessionContext(sessionId: string): void {
    if (!this.enabled) {
      return;
    }

    const span = api.trace.getActiveSpan();
    if (span) {
      span.setAttribute('session.id', sessionId);
    }
  }

  /**
   * Add attributes to current active span
   *
   * @param attributes - Attributes to add (will be sanitized)
   */
  addSpanAttributes(attributes: Record<string, any>): void {
    if (!this.enabled) {
      return;
    }

    const span = api.trace.getActiveSpan();
    if (span) {
      const sanitized = this.sanitizeParams(attributes);
      span.setAttributes(sanitized);
    }
  }

  /**
   * Record an event on the current span
   *
   * @param name - Event name
   * @param attributes - Event attributes (will be sanitized)
   */
  addSpanEvent(name: string, attributes?: Record<string, any>): void {
    if (!this.enabled) {
      return;
    }

    const span = api.trace.getActiveSpan();
    if (span) {
      const sanitized = attributes ? this.sanitizeParams(attributes) : undefined;
      span.addEvent(name, sanitized);
    }
  }

  /**
   * Record an exception on the current span
   *
   * @param error - Error object
   */
  recordException(error: Error): void {
    if (!this.enabled) {
      return;
    }

    const span = api.trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Sanitize parameters to redact sensitive data
   *
   * Recursively processes objects and arrays to redact fields matching
   * SENSITIVE_KEYS patterns
   *
   * @param params - Parameters to sanitize
   * @returns Sanitized parameters
   */
  sanitizeParams(params: Record<string, any>): Record<string, any> {
    if (!params || typeof params !== 'object') {
      return params;
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      const lowerKey = key.toLowerCase();

      // Check if key contains any sensitive pattern
      const isSensitive = this.SENSITIVE_KEYS.some(sensitiveKey =>
        lowerKey.includes(sensitiveKey.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          typeof item === 'object' && item !== null
            ? this.sanitizeParams(item)
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeParams(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get current OpenTelemetry context
   *
   * @returns Current context
   */
  getContext(): Context {
    return api.context.active();
  }

  /**
   * Set context for execution
   *
   * @param context - Context to set
   * @param fn - Function to execute in context
   * @returns Function result
   */
  async withContext<T>(context: Context, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    return api.context.with(context, fn);
  }
}
