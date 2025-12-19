/**
 * Production E2E Test for Upload ACK Flow (ST-323)
 *
 * Tests the upload:batch → ACK flow against production backend.
 * Verifies that the handler responds with ACK messages.
 *
 * Run: npx tsx backend/src/remote-agent/__tests__/upload-ack-prod.e2e.ts
 */

import { io, Socket } from 'socket.io-client';

const PROD_URL = 'https://vibestudio.example.com';
const AGENT_SECRET = process.env.AGENT_SECRET || '48d8a63b17f8283d2ccc33abd1d1d68f9eb79284b1ca0edeb754115ccd4dd090';

async function testUploadAckFlow(): Promise<boolean> {
  console.log('🔌 Connecting to WebSocket...');

  return new Promise((resolve) => {
    const socket: Socket = io(`${PROD_URL}/remote-agent`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000
    });

    const receivedAcks: any[] = [];
    let batchAck: any = null;
    let connected = false;
    let registered = false;

    socket.on('connect', async () => {
      console.log('  ✅ Connected to WebSocket');
      connected = true;

      // Register as agent with pre-shared secret
      console.log('  📝 Registering as agent...');
      socket.emit('agent:register', {
        secret: AGENT_SECRET,
        hostname: 'st323-e2e-test',
        capabilities: ['transcript:upload'],
        claudeCodeVersion: '1.0.0',
        config: {}
      });
    });

    socket.on('agent:registered', () => {
      console.log('  ✅ Registered successfully');
      registered = true;

      console.log('\n📤 Sending upload:batch with test data...');

      // Test 1: Send batch with fake workflow run (should get error ACK)
      const batch = {
        items: [
          {
            id: 9001,
            type: 'transcript:upload',
            payload: {
              workflowRunId: '00000000-0000-0000-0000-000000000000', // Fake ID
              componentRunId: '00000000-0000-0000-0000-000000000001',
              transcriptPath: '/tmp/test-st323.jsonl',
              content: JSON.stringify({ test: true, timestamp: Date.now() }),
              agentId: 'st323-e2e-test'
            }
          },
          {
            id: 9002,
            type: 'transcript:upload',
            payload: {
              workflowRunId: '00000000-0000-0000-0000-000000000000',
              componentRunId: '00000000-0000-0000-0000-000000000001',
              transcriptPath: '/tmp/test-st323-2.jsonl',
              content: JSON.stringify({ test: true, timestamp: Date.now() + 1 }),
              agentId: 'st323-e2e-test'
            }
          }
        ]
      };

      socket.emit('upload:batch', batch);
    });

    // Listen for individual ACKs
    socket.on('upload:ack:item', (data: any) => {
      console.log('  📨 Received upload:ack:item:', JSON.stringify(data));
      receivedAcks.push(data);
    });

    // Listen for batch ACK
    socket.on('upload:ack', (data: any) => {
      console.log('  📨 Received upload:ack:', JSON.stringify(data));
      batchAck = data;
    });

    socket.on('connect_error', (error) => {
      console.error('  ❌ Connection error:', error.message);
      resolve(false);
    });

    socket.on('agent:error', (error) => {
      console.log('  ⚠️ Agent error:', JSON.stringify(error));
    });

    socket.on('error', (error) => {
      console.log('  ⚠️ Socket error:', error);
    });

    // Wait for responses then evaluate
    setTimeout(() => {
      socket.disconnect();

      console.log('\n' + '═'.repeat(50));
      console.log('📊 TEST RESULTS');
      console.log('═'.repeat(50));

      let passed = true;
      const results: string[] = [];

      // Check connection
      if (connected) {
        results.push('✅ WebSocket connection: PASS');
      } else {
        results.push('❌ WebSocket connection: FAIL');
        passed = false;
      }

      // Check registration
      if (registered) {
        results.push('✅ Agent registration: PASS');
      } else {
        results.push('❌ Agent registration: FAIL');
        passed = false;
      }

      // Check that handler responded
      if (receivedAcks.length > 0) {
        results.push(`✅ upload:ack:item events received: ${receivedAcks.length}`);

        // Check ACK structure
        const ack = receivedAcks[0];
        if (typeof ack.success === 'boolean' && typeof ack.id === 'number') {
          results.push('✅ ACK structure correct: { success, id }');

          // We expect errors since workflow doesn't exist
          if (!ack.success && ack.error) {
            results.push(`✅ Error handling works: "${ack.error.substring(0, 50)}..."`);
          }
        } else {
          results.push('❌ ACK structure incorrect');
          passed = false;
        }
      } else {
        results.push('❌ No upload:ack:item events received');
        passed = false;
      }

      // Batch ACK (may be empty if all items failed)
      if (batchAck) {
        results.push(`✅ upload:ack batch event received: { ids: [${batchAck.ids?.join(', ') || ''}] }`);
      } else {
        results.push('⚠️ No batch ACK (expected if all items failed)');
      }

      // Print results
      results.forEach(r => console.log(r));

      console.log('═'.repeat(50));
      if (passed) {
        console.log('🎉 ALL TESTS PASSED');
        console.log('The upload:batch handler is working correctly!');
      } else {
        console.log('💥 SOME TESTS FAILED');
      }
      console.log('═'.repeat(50) + '\n');

      resolve(passed);
    }, 5000);
  });
}

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(50));
  console.log('  ST-323 Upload ACK Flow - Production E2E Test');
  console.log('═'.repeat(50) + '\n');

  try {
    const passed = await testUploadAckFlow();
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

main();
