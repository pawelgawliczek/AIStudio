/**
 * E2E Test for Artifact Deduplication (ST-324)
 *
 * Tests the duplicate content detection flow via WebSocket:
 * 1. Connect to production WebSocket
 * 2. Register as agent (laptop agent)
 * 3. Upload artifact (first time - should succeed, not duplicate)
 * 4. Upload same artifact again (should detect duplicate and return isDuplicate=true)
 * 5. Upload modified artifact (should succeed, not duplicate)
 *
 * This test uses WebSocket responses only - no direct database access required.
 * Uses existing story ST-324 and THE_PLAN artifact definition.
 *
 * Run: npx tsx backend/src/e2e/st324-deduplication.e2e.test.ts
 */

import { io, Socket } from 'socket.io-client';

const PROD_URL = process.env.PROD_URL || 'https://vibestudio.example.com';
const AGENT_SECRET = process.env.AGENT_SECRET || '48d8a63b17f8283d2ccc33abd1d1d68f9eb79284b1ca0edeb754115ccd4dd090';

// Use existing story ST-324 for testing (this story itself)
const TEST_STORY_KEY = 'ST-324';
const TEST_ARTIFACT_KEY = 'THE_PLAN';

interface TestResults {
  connected: boolean;
  registered: boolean;
  firstUploadSuccess: boolean;
  duplicateDetected: boolean;
  modifiedUploadSuccess: boolean;
}

async function testDeduplication(): Promise<TestResults> {
  console.log('🔌 Connecting to WebSocket...');
  console.log(`   URL: ${PROD_URL}/remote-agent`);

  return new Promise((resolve) => {
    const socket: Socket = io(`${PROD_URL}/remote-agent`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    const results: TestResults = {
      connected: false,
      registered: false,
      firstUploadSuccess: false,
      duplicateDetected: false,
      modifiedUploadSuccess: false,
    };

    let agentId: string | null = null;

    // Generate unique test content with timestamp to avoid conflicts with previous runs
    const timestamp = Date.now();
    const testContent = `# ST-324 Deduplication Test

This content is for testing artifact deduplication.
Test run: ${timestamp}
Test ID: e2e-dedup-${timestamp}

## Purpose
Verify that uploading the same content twice returns isDuplicate=true.
`;

    socket.on('connect', async () => {
      console.log('  ✅ Connected to WebSocket');
      results.connected = true;

      // Register as agent
      console.log('  📝 Registering as laptop agent...');
      socket.emit('agent:register', {
        secret: AGENT_SECRET,
        hostname: 'st324-dedup-test',
        capabilities: ['artifact:upload'],
        claudeCodeVersion: '1.0.0',
        config: {},
      });
    });

    socket.on('agent:registered', async (data: { agentId: string }) => {
      console.log('  ✅ Registered successfully');
      console.log(`  🆔 Agent ID: ${data.agentId}`);
      results.registered = true;
      agentId = data.agentId;

      // Test 1: Upload artifact for the first time
      console.log('\n📤 Test 1: Uploading artifact (first time)...');
      console.log(`   Story: ${TEST_STORY_KEY}, Artifact: ${TEST_ARTIFACT_KEY}`);
      socket.emit('artifact:upload', {
        agentId: data.agentId,
        items: [
          {
            queueId: 1001,
            storyKey: TEST_STORY_KEY,
            artifactKey: TEST_ARTIFACT_KEY,
            filePath: `/test/e2e/${TEST_ARTIFACT_KEY}.md`,
            content: testContent,
            contentType: 'text/markdown',
            timestamp: Date.now(),
          },
        ],
      });
    });

    socket.on('upload:ack:item', async (data: { id: number; success: boolean; isDuplicate?: boolean; error?: string }) => {
      console.log(`  📨 Received ACK for queueId ${data.id}:`, JSON.stringify(data));

      // Process ACKs in sequence
      if (data.id === 1001) {
        // First upload
        if (data.success && !data.isDuplicate) {
          console.log('  ✅ First upload successful (not duplicate)');
          results.firstUploadSuccess = true;

          // Wait a bit then upload the same content again
          setTimeout(() => {
            console.log('\n📤 Test 2: Uploading same artifact (should be duplicate)...');
            socket.emit('artifact:upload', {
              agentId: agentId!,
              items: [
                {
                  queueId: 1002,
                  storyKey: TEST_STORY_KEY,
                  artifactKey: TEST_ARTIFACT_KEY,
                  filePath: `/test/e2e/${TEST_ARTIFACT_KEY}.md`,
                  content: testContent, // Same content
                  contentType: 'text/markdown',
                  timestamp: Date.now(),
                },
              ],
            });
          }, 500);
        } else if (data.error) {
          console.log(`  ❌ First upload failed: ${data.error}`);
          socket.disconnect();
          resolve(results);
        } else {
          console.log('  ❌ First upload unexpectedly marked as duplicate');
          socket.disconnect();
          resolve(results);
        }
      } else if (data.id === 1002) {
        // Second upload (should be duplicate)
        if (data.success && data.isDuplicate) {
          console.log('  ✅ Duplicate detected correctly');
          results.duplicateDetected = true;

          // Now upload modified content (should NOT be duplicate)
          const modifiedContent = testContent + '\n\n## Additional Section\nThis is modified content added at ' + Date.now();
          console.log('\n📤 Test 3: Uploading modified artifact (should NOT be duplicate)...');
          setTimeout(() => {
            socket.emit('artifact:upload', {
              agentId: agentId!,
              items: [
                {
                  queueId: 1003,
                  storyKey: TEST_STORY_KEY,
                  artifactKey: TEST_ARTIFACT_KEY,
                  filePath: `/test/e2e/${TEST_ARTIFACT_KEY}.md`,
                  content: modifiedContent,
                  contentType: 'text/markdown',
                  timestamp: Date.now(),
                },
              ],
            });
          }, 500);
        } else {
          console.log('  ❌ Duplicate not detected or upload failed');
          socket.disconnect();
          resolve(results);
        }
      } else if (data.id === 1003) {
        // Third upload (modified content)
        if (data.success && !data.isDuplicate) {
          console.log('  ✅ Modified content uploaded successfully (not duplicate)');
          results.modifiedUploadSuccess = true;
        } else {
          console.log('  ❌ Modified upload failed or incorrectly marked as duplicate');
        }

        // All tests complete, disconnect
        setTimeout(() => {
          socket.disconnect();
          resolve(results);
        }, 500);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('  ❌ Connection error:', error.message);
      socket.disconnect();
      resolve(results);
    });

    socket.on('agent:error', (error: { message: string }) => {
      console.log('  ⚠️ Agent error:', JSON.stringify(error));
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      console.log('\n  ⏱️ Test timeout');
      socket.disconnect();
      resolve(results);
    }, 15000);
  });
}

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(50));
  console.log('  ST-324 Artifact Deduplication - E2E Test');
  console.log('═'.repeat(50) + '\n');

  try {
    // Run tests
    const results = await testDeduplication();

    // Print results
    console.log('\n' + '═'.repeat(50));
    console.log('📊 TEST RESULTS');
    console.log('═'.repeat(50));

    const checks = [
      { name: 'WebSocket connection', passed: results.connected },
      { name: 'Agent registration', passed: results.registered },
      { name: 'First upload succeeds (not duplicate)', passed: results.firstUploadSuccess },
      { name: 'Duplicate detected on second upload', passed: results.duplicateDetected },
      { name: 'Modified content succeeds (not duplicate)', passed: results.modifiedUploadSuccess },
    ];

    checks.forEach(check => {
      console.log(check.passed ? `✅ ${check.name}` : `❌ ${check.name}`);
    });

    const allPassed = checks.every(c => c.passed);

    console.log('═'.repeat(50));
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED');
      console.log('Artifact deduplication is working correctly!');
    } else {
      console.log('💥 SOME TESTS FAILED');
    }
    console.log('═'.repeat(50) + '\n');

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

main();
