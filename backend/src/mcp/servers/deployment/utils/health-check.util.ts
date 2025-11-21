/**
 * Health Check Utilities for Deployment
 *
 * Provides HTTP-based health checking with retry logic:
 * - Single health check attempts
 * - Polling with retry and timeout
 * - Health check result aggregation
 */

import * as http from 'http';
import * as https from 'https';

export interface HealthCheckResult {
  url: string;
  status: number;
  healthy: boolean;
  latency: number; // milliseconds
  timestamp: string;
  error?: string;
}

export interface HealthCheckConfig {
  url: string;
  timeout: number; // milliseconds per request
  expectedStatus?: number;
  validateBody?: (body: any) => boolean;
}

/**
 * Perform a single health check using native http module
 */
export async function checkHealth(
  config: HealthCheckConfig
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  return new Promise((resolve) => {
    const parsedUrl = new URL(config.url);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: config.timeout
    };

    const req = httpModule.request(options, (res) => {
      const latency = Date.now() - startTime;
      const expectedStatus = config.expectedStatus || 200;
      const statusMatch = res.statusCode === expectedStatus;

      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        let bodyValid = true;
        if (config.validateBody && body) {
          try {
            const parsed = JSON.parse(body);
            bodyValid = config.validateBody(parsed);
          } catch {
            bodyValid = false;
          }
        }

        const healthy = statusMatch && bodyValid;

        resolve({
          url: config.url,
          status: res.statusCode || 0,
          healthy,
          latency,
          timestamp,
          error: healthy ? undefined : `Status ${res.statusCode} or invalid body`
        });
      });
    });

    req.on('error', (error) => {
      const latency = Date.now() - startTime;
      resolve({
        url: config.url,
        status: 0,
        healthy: false,
        latency,
        timestamp,
        error: error.message || 'Request failed'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const latency = Date.now() - startTime;
      resolve({
        url: config.url,
        status: 0,
        healthy: false,
        latency,
        timestamp,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

/**
 * Poll health endpoint with retry logic
 */
export async function pollHealth(
  config: HealthCheckConfig,
  maxAttempts: number = 12,
  intervalMs: number = 10000
): Promise<HealthCheckResult> {
  let lastResult: HealthCheckResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `Health check attempt ${attempt}/${maxAttempts} for ${config.url}`
    );

    lastResult = await checkHealth(config);

    if (lastResult.healthy) {
      console.log(`Health check passed for ${config.url}`);
      return lastResult;
    }

    // Don't wait after last attempt
    if (attempt < maxAttempts) {
      console.log(
        `Health check failed, retrying in ${intervalMs / 1000}s... (${lastResult.error})`
      );
      await sleep(intervalMs);
    }
  }

  console.error(`Health check failed after ${maxAttempts} attempts`);
  return lastResult!;
}

/**
 * Wait for multiple services to become healthy
 */
export async function waitForHealthy(
  configs: HealthCheckConfig[],
  maxWaitMs: number = 120000 // 2 minutes
): Promise<{ healthy: boolean; results: HealthCheckResult[] }> {
  const startTime = Date.now();
  const intervalMs = 10000; // 10 seconds
  const maxAttempts = Math.ceil(maxWaitMs / intervalMs);

  console.log(
    `Waiting for ${configs.length} services to become healthy (max ${maxWaitMs / 1000}s)...`
  );

  // Poll all services in parallel
  const results = await Promise.all(
    configs.map(config => pollHealth(config, maxAttempts, intervalMs))
  );

  const allHealthy = results.every(r => r.healthy);
  const duration = Date.now() - startTime;

  console.log(
    `Health check completed in ${duration / 1000}s. All healthy: ${allHealthy}`
  );

  return { healthy: allHealthy, results };
}

/**
 * Create health check configs for production backend and frontend
 */
export function createDefaultHealthChecks(): HealthCheckConfig[] {
  return [
    {
      url: 'http://localhost:3000/api/health',
      timeout: 5000,
      expectedStatus: 200,
      validateBody: (body: any) => {
        // Backend health endpoint should return { status: 'ok' } or similar
        return body && (body.status === 'ok' || body.healthy === true);
      }
    },
    {
      url: 'http://localhost:5173',
      timeout: 5000,
      expectedStatus: 200
      // Frontend may not have health endpoint, just check if accessible
    }
  ];
}

/**
 * Create health check configs for TEST stack (ST-76)
 * Uses isolated test ports: backend=3001, frontend=5174
 */
export function createTestStackHealthChecks(): HealthCheckConfig[] {
  return [
    {
      url: 'http://localhost:3001/api/health',
      timeout: 5000,
      expectedStatus: 200,
      validateBody: (body: any) => {
        return body && (body.status === 'ok' || body.healthy === true);
      }
    },
    {
      url: 'http://localhost:5174/health',
      timeout: 5000,
      expectedStatus: 200
      // Frontend nginx health endpoint
    }
  ];
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
