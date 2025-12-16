import { TelemetryService } from './telemetry.service';
import { SpanStatusCode, trace, context } from '@opentelemetry/api';

/**
 * @Traced decorator for automatic method tracing
 *
 * Wraps method execution in a span with:
 * - Automatic span naming (class.method)
 * - Parameter sanitization
 * - Error tracking
 * - Execution timing
 *
 * Usage:
 *   @Traced()
 *   async myMethod(param1: string) { ... }
 *
 * Custom span name:
 *   @Traced('custom.span.name')
 *   async myMethod() { ... }
 *
 * With attributes:
 *   @Traced('mcp.get_story', { 'operation.type': 'read' })
 *   async getStory(storyId: string) { ... }
 */
export function Traced(
  spanName?: string,
  attributes?: Record<string, any>,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);

    descriptor.value = async function (...args: any[]) {
      // Get telemetry service from this context (should be injected)
      const telemetry: TelemetryService = (this as any).telemetry || (this as any).telemetryService;

      if (!telemetry || !telemetry.isEnabled()) {
        // Fall back to original method if telemetry not available
        return originalMethod.apply(this, args);
      }

      const name = spanName || `${className}.${methodName}`;
      const span = telemetry.startSpan(name, {
        'code.function': methodName,
        'code.namespace': className,
        ...attributes,
      });

      // Set span as active in current context
      const ctx = trace.setSpan(context.active(), span);

      const startTime = Date.now();

      try {
        const result = await context.with(ctx, async () => {
          return await originalMethod.apply(this, args);
        });

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}

/**
 * @TracedMCP decorator for MCP tool tracing
 *
 * Specialized decorator for MCP tools with additional attributes:
 * - tool.name
 * - tool.category
 * - Parameter sanitization
 *
 * Usage:
 *   @TracedMCP('get_story')
 *   async handleGetStory(params: GetStoryParams) { ... }
 */
export function TracedMCP(toolName: string, category?: string): MethodDecorator {
  const attributes: Record<string, any> = {
    'tool.name': toolName,
    'operation.type': 'mcp_tool',
  };

  if (category) {
    attributes['tool.category'] = category;
  }

  return Traced(`mcp.${toolName}`, attributes);
}
