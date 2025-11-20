#!/usr/bin/env npx ts-node
/**
 * Test OTEL Pipeline - sends test telemetry to verify end-to-end flow
 *
 * Run: npx ts-node backend/src/utils/test-otel-pipeline.ts
 */
import fetch from 'node-fetch';

const OTEL_COLLECTOR_URL = 'http://localhost:4318/v1/logs';
const BACKEND_API_URL = 'http://localhost:3000/api/otel/ingest';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const sessionId = `test-session-${Date.now()}`;
  const workflowRunId = `test-workflow-${Date.now()}`;
  const componentRunId = `test-component-${Date.now()}`;

  // Test 1: Direct backend API
  console.log('Test 1: Direct backend API ingestion...');
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        timestamp: new Date().toISOString(),
        eventType: 'tool_use',
        eventName: 'Read file test',
        toolName: 'Read',
        toolDuration: 150,
        toolSuccess: true,
        toolParameters: { file_path: '/test/file.ts' },
        attributes: {
          workflow_run_id: workflowRunId,
          component_run_id: componentRunId,
          project_id: 'test-project',
        },
        metadata: {
          lines_read: 100,
          file_size: 5000,
        },
      }),
    });

    const data = await response.json();
    results.push({
      test: 'Direct Backend API',
      success: response.ok,
      message: response.ok ? 'Event ingested successfully' : `Failed: ${response.statusText}`,
      data,
    });
  } catch (error: any) {
    results.push({
      test: 'Direct Backend API',
      success: false,
      message: `Error: ${error.message}`,
    });
  }

  // Test 2: OTEL Collector (OTLP HTTP)
  console.log('Test 2: OTEL Collector OTLP ingestion...');
  try {
    const otlpPayload = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code-agent' } },
              { key: 'workflow_run_id', value: { stringValue: workflowRunId } },
              { key: 'component_run_id', value: { stringValue: componentRunId } },
              { key: 'project_id', value: { stringValue: 'test-project' } },
            ],
          },
          scopeLogs: [
            {
              scope: { name: 'claude-code', version: '1.0.0' },
              logRecords: [
                {
                  timeUnixNano: (Date.now() * 1000000).toString(),
                  severityNumber: 9, // INFO
                  severityText: 'INFO',
                  body: {
                    stringValue: JSON.stringify({
                      event: 'tool_use',
                      tool: 'Bash',
                      duration: 250,
                    }),
                  },
                  attributes: [
                    { key: 'session_id', value: { stringValue: sessionId } },
                    { key: 'event_type', value: { stringValue: 'tool_use' } },
                    { key: 'tool_name', value: { stringValue: 'Bash' } },
                    { key: 'tool_duration', value: { intValue: 250 } },
                    { key: 'tool_success', value: { boolValue: true } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(OTEL_COLLECTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otlpPayload),
    });

    const responseText = await response.text();
    results.push({
      test: 'OTEL Collector OTLP',
      success: response.ok,
      message: response.ok
        ? 'OTLP logs sent to collector successfully'
        : `Failed: ${response.statusText}`,
      data: responseText || '(empty response)',
    });
  } catch (error: any) {
    results.push({
      test: 'OTEL Collector OTLP',
      success: false,
      message: `Error: ${error.message}`,
    });
  }

  // Test 3: Batch ingestion
  console.log('Test 3: Batch event ingestion...');
  try {
    const batchEvents = [
      {
        sessionId,
        timestamp: new Date().toISOString(),
        eventType: 'tool_use',
        toolName: 'Grep',
        toolDuration: 80,
        toolSuccess: true,
      },
      {
        sessionId,
        timestamp: new Date().toISOString(),
        eventType: 'tool_use',
        toolName: 'Edit',
        toolDuration: 200,
        toolSuccess: true,
      },
      {
        sessionId,
        timestamp: new Date().toISOString(),
        eventType: 'api_call',
        metadata: {
          tokens_input: 1500,
          tokens_output: 800,
          cache_hit: true,
          cache_tokens: 500,
        },
      },
    ];

    const response = await fetch(`${BACKEND_API_URL}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchEvents),
    });

    const data = await response.json();
    results.push({
      test: 'Batch Ingestion',
      success: response.ok,
      message: response.ok ? `Batch of ${batchEvents.length} events ingested` : `Failed: ${response.statusText}`,
      data,
    });
  } catch (error: any) {
    results.push({
      test: 'Batch Ingestion',
      success: false,
      message: `Error: ${error.message}`,
    });
  }

  return results;
}

async function main(): Promise<void> {
  console.log('=== OTEL Pipeline Test Suite ===\n');
  console.log('Testing telemetry ingestion pipeline...\n');

  const results = await runTests();

  console.log('\n=== Test Results ===\n');
  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2).split('\n').join('\n   ')}`);
    }
    console.log();
  }

  const passCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  console.log(`\nSummary: ${passCount}/${totalCount} tests passed`);

  if (passCount === totalCount) {
    console.log('\n✅ All tests passed! OTEL pipeline is ready for live metrics.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.\n');
  }
}

main().catch(console.error);
