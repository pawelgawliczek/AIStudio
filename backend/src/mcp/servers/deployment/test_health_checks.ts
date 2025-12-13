/**
 * Test Health Checks MCP Tool (ST-87 Debugging)
 *
 * Standalone tool to test health check connectivity and logic
 * without running full deployment.
 */

import { z } from 'zod';

// Input schema
const TestHealthChecksParamsSchema = z.object({
  skipWarmup: z.boolean().optional().default(false),
  maxAttempts: z.number().optional().default(5),
});

type TestHealthChecksParams = z.infer<typeof TestHealthChecksParamsSchema>;

interface HealthCheckResult {
  success: boolean;
  latency?: number;
  error?: string;
}

interface TestHealthChecksResponse {
  success: boolean;
  warmupDelay: number;
  maxAttempts: number;
  attemptsExecuted: number;
  backend: {
    url: string;
    consecutiveSuccesses: number;
    totalSuccesses: number;
    totalFailures: number;
    lastError?: string;
    healthy: boolean;
  };
  frontend: {
    url: string;
    consecutiveSuccesses: number;
    totalSuccesses: number;
    totalFailures: number;
    lastError?: string;
    healthy: boolean;
  };
  logs: string[];
  duration: number;
}

/**
 * Check if a service endpoint is healthy
 */
async function checkServiceHealth(url: string): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'VibeStudio-HealthCheck/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return { success: true, latency };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Run health checks with detailed logging
 */
async function runHealthChecks(params: TestHealthChecksParams): Promise<TestHealthChecksResponse> {
  const startTime = Date.now();
  const logs: string[] = [];

  const warmupDelay = params.skipWarmup ? 0 : 15000;
  const maxAttempts = params.maxAttempts || 5;
  const requiredConsecutiveSuccesses = 3;
  const delayBetweenChecks = 5000;

  const backendUrl = 'http://127.0.0.1:3000/api/health';
  const frontendUrl = 'http://127.0.0.1:5173';

  let backendSuccesses = 0;
  let frontendSuccesses = 0;
  let backendTotalSuccesses = 0;
  let backendTotalFailures = 0;
  let frontendTotalSuccesses = 0;
  let frontendTotalFailures = 0;
  let lastBackendError: string | undefined;
  let lastFrontendError: string | undefined;
  let attempts = 0;

  // Warmup delay
  if (warmupDelay > 0) {
    logs.push(`⏳ Waiting ${warmupDelay / 1000}s for containers to initialize...`);
    await new Promise(resolve => setTimeout(resolve, warmupDelay));
  } else {
    logs.push('⏭️  Skipping warmup delay');
  }

  // Run health checks
  while (attempts < maxAttempts) {
    attempts++;
    logs.push(`\n🔍 Health check attempt ${attempts}/${maxAttempts}`);

    // Check backend
    const backendCheck = await checkServiceHealth(backendUrl);
    if (backendCheck.success) {
      backendSuccesses++;
      backendTotalSuccesses++;
      logs.push(`  ✅ Backend: OK (${backendSuccesses}/${requiredConsecutiveSuccesses}) - ${backendCheck.latency}ms`);
    } else {
      backendTotalFailures++;
      lastBackendError = backendCheck.error;
      logs.push(`  ❌ Backend: FAILED - ${backendCheck.error}`);
      // ST-87: Don't reset counter on transient failures
    }

    // Check frontend
    const frontendCheck = await checkServiceHealth(frontendUrl);
    if (frontendCheck.success) {
      frontendSuccesses++;
      frontendTotalSuccesses++;
      logs.push(`  ✅ Frontend: OK (${frontendSuccesses}/${requiredConsecutiveSuccesses}) - ${frontendCheck.latency}ms`);
    } else {
      frontendTotalFailures++;
      lastFrontendError = frontendCheck.error;
      logs.push(`  ❌ Frontend: FAILED - ${frontendCheck.error}`);
      // ST-87: Don't reset counter on transient failures
    }

    // Check if both services have enough consecutive successes
    if (backendSuccesses >= requiredConsecutiveSuccesses &&
        frontendSuccesses >= requiredConsecutiveSuccesses) {
      logs.push(`\n✅ All health checks passed!`);
      break;
    }

    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenChecks));
    }
  }

  const duration = Date.now() - startTime;

  const backendHealthy = backendSuccesses >= requiredConsecutiveSuccesses;
  const frontendHealthy = frontendSuccesses >= requiredConsecutiveSuccesses;

  if (!backendHealthy || !frontendHealthy) {
    logs.push(`\n❌ Health checks failed after ${attempts} attempts`);
  }

  return {
    success: backendHealthy && frontendHealthy,
    warmupDelay,
    maxAttempts,
    attemptsExecuted: attempts,
    backend: {
      url: backendUrl,
      consecutiveSuccesses: backendSuccesses,
      totalSuccesses: backendTotalSuccesses,
      totalFailures: backendTotalFailures,
      lastError: lastBackendError,
      healthy: backendHealthy,
    },
    frontend: {
      url: frontendUrl,
      consecutiveSuccesses: frontendSuccesses,
      totalSuccesses: frontendTotalSuccesses,
      totalFailures: frontendTotalFailures,
      lastError: lastFrontendError,
      healthy: frontendHealthy,
    },
    logs,
    duration,
  };
}

export async function handler(
  _prisma: any, // Not used but required by registry
  params: TestHealthChecksParams
): Promise<TestHealthChecksResponse> {
  return await runHealthChecks(params);
}

export const definition = {
  name: 'test_health_checks',
  description: 'Test health check connectivity and logic. Runs same checks as production deployments without full deployment. Debugging tool.',
  inputSchema: TestHealthChecksParamsSchema,
  outputSchema: z.object({
    success: z.boolean(),
    warmupDelay: z.number(),
    maxAttempts: z.number(),
    attemptsExecuted: z.number(),
    backend: z.object({
      url: z.string(),
      consecutiveSuccesses: z.number(),
      totalSuccesses: z.number(),
      totalFailures: z.number(),
      lastError: z.string().optional(),
      healthy: z.boolean(),
    }),
    frontend: z.object({
      url: z.string(),
      consecutiveSuccesses: z.number(),
      totalSuccesses: z.number(),
      totalFailures: z.number(),
      lastError: z.string().optional(),
      healthy: z.boolean(),
    }),
    logs: z.array(z.string()),
    duration: z.number(),
  }),
};
