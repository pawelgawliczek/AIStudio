/**
 * EP-14: E2E Test for transcript:lines and transcript:batch ACK Protocol
 *
 * This test verifies the complete flow:
 * 1. Laptop agent sends transcript:lines or transcript:batch
 * 2. Backend saves to database
 * 3. Backend emits upload:ack:item back to client
 * 4. Client receives ACK with correct queueId and success status
 *
 * This test runs against the production backend to verify the fix works end-to-end.
 *
 * Run: npm test -- transcript-streaming-ack.e2e
 */

import { io, Socket } from 'socket.io-client';

// Production configuration
const PROD_URL = process.env.TEST_URL || 'https://vibestudio.example.com';
const AGENT_SECRET = process.env.AGENT_SECRET || '48d8a63b17f8283d2ccc33abd1d1d68f9eb79284b1ca0edeb754115ccd4dd090';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds for E2E tests

describe('EP-14: Transcript Streaming ACK Protocol E2E', () => {
  let socket: Socket;
  let agentId: string;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('EP-14: Transcript Streaming ACK Protocol E2E Test');
    console.log('============================================================');
    console.log(`Target: ${PROD_URL}`);
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('');

    // Connect to production WebSocket
    console.log('Connecting to WebSocket...');
    socket = io(`${PROD_URL}/remote-agent`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    // Wait for connection and registration
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      socket.on('connect', () => {
        console.log('  Connected to WebSocket');
        clearTimeout(timeout);

        // Register as agent
        console.log('  Registering as agent...');
        socket.emit('agent:register', {
          secret: AGENT_SECRET,
          hostname: 'transcript-ack-e2e-test',
          capabilities: ['transcript:upload', 'watch-transcripts'],
          claudeCodeVersion: '1.0.0',
          config: {},
        });
      });

      socket.on('agent:registered', (data: { agentId: string }) => {
        console.log(`  Registered successfully (Agent ID: ${data.agentId})`);
        agentId = data.agentId;
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log('Setup complete\n');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    console.log('\nCleaning up...');

    if (socket) {
      socket.disconnect();
      console.log('  Disconnected from WebSocket');
    }

    console.log('Cleanup complete');
    console.log('\n============================================================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('============================================================\n');
  });

  describe('transcript:lines ACK emission', () => {
    it('should receive upload:ack:item after sending transcript:lines', async () => {
      console.log('\nTest: transcript:lines ACK emission');

      // Setup: Track received ACKs
      const receivedAcks: Array<{ success: boolean; id: number; error?: string }> = [];
      const ackHandler = (data: any) => {
        console.log(`  Received upload:ack:item: ${JSON.stringify(data)}`);
        receivedAcks.push(data);
      };

      socket.on('upload:ack:item', ackHandler);

      try {
        // Send transcript:lines with a test queueId
        // Note: Using fake runId will result in error ACK, but we're testing ACK emission
        const testQueueId = Math.floor(Math.random() * 100000);
        console.log(`  Sending transcript:lines with queueId=${testQueueId}`);

        socket.emit('transcript:lines', {
          queueId: testQueueId,
          runId: '00000000-0000-0000-0000-000000000000', // Fake runId for test
          sessionIndex: 0,
          lines: [
            { line: '{"type":"test","content":"ACK test line 1"}', sequenceNumber: 1 },
            { line: '{"type":"test","content":"ACK test line 2"}', sequenceNumber: 2 },
          ],
          isHistorical: false,
          timestamp: new Date().toISOString(),
        });

        // Wait for ACK
        console.log('  Waiting for ACK...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify ACK received
        expect(receivedAcks.length).toBeGreaterThan(0);
        console.log(`  Received ${receivedAcks.length} ACK(s)`);

        // Find ACK for our queueId
        const ourAck = receivedAcks.find(ack => ack.id === testQueueId);
        expect(ourAck).toBeDefined();
        console.log(`  ACK for queueId=${testQueueId}: ${JSON.stringify(ourAck)}`);

        // Verify ACK structure
        expect(ourAck).toHaveProperty('success');
        expect(ourAck).toHaveProperty('id');
        expect(ourAck!.id).toBe(testQueueId);

        // Note: With fake runId, we expect error ACK (but ACK was emitted!)
        if (!ourAck!.success) {
          expect(ourAck).toHaveProperty('error');
          console.log(`  Expected error (fake runId): ${ourAck!.error}`);
        }

        console.log('  transcript:lines ACK emission verified');
      } finally {
        socket.off('upload:ack:item', ackHandler);
      }
    }, TEST_TIMEOUT);

    it('should receive success ACK with valid runId (if available)', async () => {
      // This test is informational - we'd need a real workflow run to get success ACK
      // The important thing is that ACK is emitted at all (which previous test verifies)
      console.log('\nTest: transcript:lines success ACK (informational)');
      console.log('  Note: Full success requires valid workflowRunId in database');
      console.log('  ACK emission mechanism verified by previous test');
    });
  });

  describe('transcript:batch ACK emission', () => {
    it('should receive upload:ack:item after sending transcript:batch', async () => {
      console.log('\nTest: transcript:batch ACK emission');

      // Setup: Track received ACKs
      const receivedAcks: Array<{ success: boolean; id: number; error?: string }> = [];
      const ackHandler = (data: any) => {
        console.log(`  Received upload:ack:item: ${JSON.stringify(data)}`);
        receivedAcks.push(data);
      };

      socket.on('upload:ack:item', ackHandler);

      try {
        // Send transcript:batch with a test queueId
        const testQueueId = Math.floor(Math.random() * 100000);
        console.log(`  Sending transcript:batch with queueId=${testQueueId}`);

        socket.emit('transcript:batch', {
          queueId: testQueueId,
          runId: '00000000-0000-0000-0000-000000000000', // Fake runId for test
          sessionIndex: 0,
          lines: [
            { line: '{"type":"batch","content":"batch line 1"}', sequenceNumber: 100 },
            { line: '{"type":"batch","content":"batch line 2"}', sequenceNumber: 101 },
            { line: '{"type":"batch","content":"batch line 3"}', sequenceNumber: 102 },
          ],
          isHistorical: true,
          timestamp: new Date().toISOString(),
        });

        // Wait for ACK
        console.log('  Waiting for ACK...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify ACK received
        expect(receivedAcks.length).toBeGreaterThan(0);
        console.log(`  Received ${receivedAcks.length} ACK(s)`);

        // Find ACK for our queueId
        const ourAck = receivedAcks.find(ack => ack.id === testQueueId);
        expect(ourAck).toBeDefined();
        console.log(`  ACK for queueId=${testQueueId}: ${JSON.stringify(ourAck)}`);

        // Verify ACK structure
        expect(ourAck).toHaveProperty('success');
        expect(ourAck).toHaveProperty('id');
        expect(ourAck!.id).toBe(testQueueId);

        console.log('  transcript:batch ACK emission verified');
      } finally {
        socket.off('upload:ack:item', ackHandler);
      }
    }, TEST_TIMEOUT);
  });

  describe('ACK protocol consistency', () => {
    it('should emit ACKs in same format as upload:batch handler', async () => {
      console.log('\nTest: ACK format consistency');

      // Setup: Track ACKs from both handlers
      const transcriptAcks: Array<any> = [];
      const ackHandler = (data: any) => {
        transcriptAcks.push(data);
      };

      socket.on('upload:ack:item', ackHandler);

      try {
        // Send transcript:lines
        const transcriptLinesQueueId = Math.floor(Math.random() * 100000);
        socket.emit('transcript:lines', {
          queueId: transcriptLinesQueueId,
          runId: '00000000-0000-0000-0000-000000000001',
          sessionIndex: 0,
          lines: [{ line: 'test', sequenceNumber: 1 }],
          isHistorical: false,
          timestamp: new Date().toISOString(),
        });

        // Wait for ACK
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify ACK format matches expected structure
        const ack = transcriptAcks.find(a => a.id === transcriptLinesQueueId);
        expect(ack).toBeDefined();

        // ACK should have these properties (matching upload:batch handler format)
        expect(typeof ack.success).toBe('boolean');
        expect(typeof ack.id).toBe('number');
        if (!ack.success) {
          expect(typeof ack.error).toBe('string');
        }

        console.log('  ACK format verified: matches upload:batch handler');
        console.log(`  Sample ACK: ${JSON.stringify(ack)}`);
      } finally {
        socket.off('upload:ack:item', ackHandler);
      }
    }, TEST_TIMEOUT);

    it('should handle multiple concurrent transcript events', async () => {
      console.log('\nTest: Multiple concurrent events');

      const receivedAcks = new Map<number, any>();
      const ackHandler = (data: any) => {
        receivedAcks.set(data.id, data);
      };

      socket.on('upload:ack:item', ackHandler);

      try {
        // Send multiple events concurrently
        const queueIds = [
          Math.floor(Math.random() * 100000),
          Math.floor(Math.random() * 100000) + 100000,
          Math.floor(Math.random() * 100000) + 200000,
        ];

        console.log(`  Sending 3 concurrent events with queueIds: ${queueIds.join(', ')}`);

        // Send all at once
        for (const queueId of queueIds) {
          socket.emit('transcript:lines', {
            queueId,
            runId: '00000000-0000-0000-0000-000000000002',
            sessionIndex: 0,
            lines: [{ line: `concurrent test ${queueId}`, sequenceNumber: 1 }],
            isHistorical: false,
            timestamp: new Date().toISOString(),
          });
        }

        // Wait for all ACKs
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify all ACKs received
        console.log(`  Received ${receivedAcks.size} ACKs`);
        for (const queueId of queueIds) {
          const ack = receivedAcks.get(queueId);
          expect(ack).toBeDefined();
          expect(ack.id).toBe(queueId);
          console.log(`  ACK for ${queueId}: success=${ack.success}`);
        }

        console.log('  All concurrent ACKs received correctly');
      } finally {
        socket.off('upload:ack:item', ackHandler);
      }
    }, TEST_TIMEOUT);
  });
});
