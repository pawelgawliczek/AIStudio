/**
 * OpenTelemetry SDK Initialization
 *
 * MUST be imported and called before any other application code.
 * Sets up OTLP trace exporter and automatic instrumentation.
 *
 * Security: Only exports traces to configured endpoint (never to stdout)
 * MCP uses stdout for JSON-RPC protocol - traces must not interfere.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 *
 * Must be called before NestFactory.create() in main.ts
 */
export function initializeTelemetry(): void {
  const enabled = process.env.OTEL_ENABLED === 'true';

  if (!enabled) {
    console.log('[Telemetry] OpenTelemetry disabled (OTEL_ENABLED=false)');
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'aistudio-backend';
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4318/v1/traces';

  console.log(`[Telemetry] Initializing OpenTelemetry for service: ${serviceName}`);
  console.log(`[Telemetry] OTLP endpoint: ${endpoint}`);

  // Create OTLP trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: endpoint,
    headers: {},
  });

  // Create resource with service metadata
  const resource = Resource.default().merge(
    new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
  );

  // Initialize SDK with automatic instrumentations
  // Uses traceExporter directly - SDK handles span processing internally
  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Enable automatic instrumentation for:
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingPaths: ['/health', '/api/health'], // Skip health checks
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-nestjs-core': {
          enabled: true,
        },
        // Disable noisy instrumentations
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
      }),
    ],
  });

  try {
    sdk.start();
    console.log('[Telemetry] OpenTelemetry SDK initialized successfully');
  } catch (error) {
    console.error('[Telemetry] Failed to initialize OpenTelemetry SDK:', error);
  }
}

/**
 * Shutdown OpenTelemetry SDK
 *
 * Should be called on application shutdown to flush remaining spans
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('[Telemetry] OpenTelemetry SDK shut down gracefully');
    } catch (error) {
      console.error('[Telemetry] Error shutting down OpenTelemetry SDK:', error);
    }
  }
}

/**
 * Register shutdown handlers
 */
export function registerTelemetryShutdownHandlers(): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`[Telemetry] Received ${signal}, shutting down telemetry...`);
      await shutdownTelemetry();
      process.exit(0);
    });
  });
}
