import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TelemetryService } from './telemetry.service';
import { TracingInterceptor } from './tracing.interceptor';

/**
 * TelemetryModule - Global module for distributed tracing
 *
 * Provides OpenTelemetry instrumentation across the application:
 * - TelemetryService for manual instrumentation
 * - TracingInterceptor for automatic HTTP request tracing (globally registered)
 * - @Traced decorator for method-level tracing
 *
 * Must be initialized in main.ts before application bootstrap
 */
@Global()
@Module({
  providers: [
    TelemetryService,
    TracingInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: TracingInterceptor,
    },
  ],
  exports: [TelemetryService, TracingInterceptor],
})
export class TelemetryModule {}
