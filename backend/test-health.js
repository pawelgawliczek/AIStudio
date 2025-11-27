#!/usr/bin/env node
/**
 * Standalone health check test script
 * Run with: node backend/test-health.js
 */

async function checkHealth(url, name) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'HealthTest/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      console.log(`✅ ${name}: OK - ${latency}ms - ${url}`);
      return { success: true, latency };
    } else {
      console.log(`❌ ${name}: HTTP ${response.status} - ${url}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message} - ${url}`);
    return { success: false, error: error.message };
  }
}

async function runHealthChecks() {
  console.log('🔍 Testing health check connectivity...\n');

  const backendUrl = 'http://127.0.0.1:3000/api/health';
  const frontendUrl = 'http://127.0.0.1:5173';

  console.log('⏳ Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  let backendSuccesses = 0;
  let frontendSuccesses = 0;

  for (let i = 1; i <= 5; i++) {
    console.log(`\nAttempt ${i}/5:`);

    const backend = await checkHealth(backendUrl, 'Backend ');
    if (backend.success) backendSuccesses++;

    const frontend = await checkHealth(frontendUrl, 'Frontend');
    if (frontend.success) frontendSuccesses++;

    if (i < 5) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: Backend ${backendSuccesses}/5, Frontend ${frontendSuccesses}/5`);

  if (backendSuccesses >= 3 && frontendSuccesses >= 3) {
    console.log('✅ Health checks would PASS in deployment');
  } else {
    console.log('❌ Health checks would FAIL in deployment');
  }
}

runHealthChecks().catch(console.error);
