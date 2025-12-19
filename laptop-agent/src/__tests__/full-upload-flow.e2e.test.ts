/**
 * Full Upload Flow E2E Test (Epic-14)
 *
 * Tests the complete queue+ACK flow between laptop-agent and backend:
 * 1. Queue item in SQLite (UploadQueue)
 * 2. UploadManager flushes queue → sends upload:batch
 * 3. Backend receives batch, processes items, sends upload:ack
 * 4. Laptop-agent receives ACK, marks items as acked in queue
 * 5. Queue is cleared (acked items removed)
 *
 * Run: npm test -- full-upload-flow.e2e
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { io, Socket } from 'socket.io-client';
import { UploadQueue } from '../upload-queue';
import { UploadManager } from '../upload-manager';

// Production configuration
const PROD_URL = 'https://vibestudio.example.com';
const AGENT_SECRET = process.env.AGENT_SECRET || '48d8a63b17f8283d2ccc33abd1d1d68f9eb79284b1ca0edeb754115ccd4dd090';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds for E2E tests

describe('Full Upload Flow E2E', () => {
  let uploadQueue: UploadQueue;
  let uploadManager: UploadManager;
  let socket: Socket;
  let tempDir: string;
  let dbPath: string;
  let agentId: string;

  beforeAll(async () => {
    // Create temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
    dbPath = path.join(tempDir, 'test-queue.db');

    console.log(`📁 Test database: ${dbPath}`);

    // Connect to production WebSocket
    console.log('🔌 Connecting to production WebSocket...');
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
        console.log('  ✅ Connected to WebSocket');
        clearTimeout(timeout);

        // Register as agent
        console.log('  📝 Registering as agent...');
        socket.emit('agent:register', {
          secret: AGENT_SECRET,
          hostname: 'full-flow-e2e-test',
          capabilities: ['transcript:upload'],
          claudeCodeVersion: '1.0.0',
          config: {},
        });
      });

      socket.on('agent:registered', (data: { agentId: string }) => {
        console.log(`  ✅ Registered successfully (Agent ID: ${data.agentId})`);
        agentId = data.agentId;
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Initialize UploadManager with real queue and socket
    uploadManager = new UploadManager({
      socket,
      agentId, // Pass the agentId obtained from registration
      dbPath,
      flushIntervalMs: 200, // Fast flush for testing
      batchSize: 50,
      cleanupIntervalHours: 24,
    });

    // Access the internal queue for verification
    uploadQueue = (uploadManager as any).queue;

    console.log('✅ Setup complete\n');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    console.log('\n🧹 Cleaning up...');

    // Stop upload manager
    if (uploadManager) {
      await uploadManager.stop();
    }

    // Disconnect socket
    if (socket) {
      socket.disconnect();
    }

    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('  ✅ Temp files removed');
    }

    console.log('✅ Cleanup complete');
  });

  it('should complete full upload cycle: queue → upload → ACK → clear', async () => {
    console.log('\n🧪 Test: Full upload cycle');

    // Setup: Listen for ACK events
    const receivedItemAcks: Array<{ success: boolean; id: number; isDuplicate?: boolean; error?: string }> = [];
    const receivedBatchAcks: Array<{ ids: number[] }> = [];

    socket.on('upload:ack:item', (data) => {
      console.log(`  📨 Received upload:ack:item:`, JSON.stringify(data));
      receivedItemAcks.push(data);
    });

    socket.on('upload:ack', (data) => {
      console.log(`  📨 Received upload:ack:`, JSON.stringify(data));
      receivedBatchAcks.push(data);
    });

    // Step 1: Queue an item (using a fake workflow ID, we expect error ACK)
    console.log('  📝 Step 1: Queue item...');
    const testPayload = {
      queueId: 0, // Will be set by queue
      workflowRunId: '00000000-0000-0000-0000-000000000000', // Fake ID
      componentRunId: '00000000-0000-0000-0000-000000000001',
      transcriptPath: '/tmp/test-full-flow.jsonl',
      content: JSON.stringify({ test: true, timestamp: Date.now() }),
      sequenceNumber: 1,
    };

    await uploadManager.queueUpload('transcript', testPayload);

    // Verify item is in queue
    const stats1 = await uploadQueue.getStats();
    expect(stats1.pending).toBe(1);
    expect(stats1.sent).toBe(0);
    expect(stats1.acked).toBe(0);
    console.log(`  ✅ Item queued (pending: ${stats1.pending})`);

    // Step 2: Wait for flush and ACK (automatic via UploadManager)
    // Note: Production backend responds very fast, so item may already be acked
    console.log('  ⏳ Step 2: Waiting for flush and ACK...');
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Verify item was processed (sent or already acked due to fast backend response)
    const stats2 = await uploadQueue.getStats();
    expect(stats2.pending).toBe(0);
    // Item is either sent (waiting for ACK) or already acked (fast response)
    expect(stats2.sent + stats2.acked).toBeGreaterThan(0);
    console.log(`  ✅ Item processed (sent: ${stats2.sent}, acked: ${stats2.acked})`);

    // Verify we received individual ACK (even if it's an error ACK)
    expect(receivedItemAcks.length).toBeGreaterThan(0);
    console.log(`  ✅ Received ${receivedItemAcks.length} item ACK(s)`);

    const itemAck = receivedItemAcks[0];
    expect(itemAck).toHaveProperty('success');
    expect(itemAck).toHaveProperty('id');
    console.log(`  📋 ACK: success=${itemAck.success}, id=${itemAck.id}, error=${itemAck.error || 'none'}`);

    // For fake workflow ID, we expect error ACK
    if (!itemAck.success) {
      expect(itemAck.error).toBeTruthy();
      console.log(`  ⚠️ Expected error ACK received: ${itemAck.error}`);
    }

    // Step 4: Verify queue state (items marked as acked)
    console.log('  ⏳ Step 4: Verifying queue state...');
    await new Promise(resolve => setTimeout(resolve, 500));

    const stats3 = await uploadQueue.getStats();
    console.log(`  📊 Final stats: pending=${stats3.pending}, sent=${stats3.sent}, acked=${stats3.acked}`);

    // Note: Error ACKs still mark items as acked to prevent infinite retry
    // The queue should have processed the ACK
    expect(stats3.acked).toBeGreaterThan(0);
    console.log(`  ✅ Item marked as acked`);

    console.log('✅ Test passed: Full upload cycle completed\n');
  }, TEST_TIMEOUT);

  it('should handle multiple items in a single batch', async () => {
    console.log('\n🧪 Test: Batch processing');

    // Get initial acked count (items from previous tests persist in queue)
    const initialStats = await uploadQueue.getStats();
    const initialAcked = initialStats.acked;
    console.log(`  📊 Initial state: acked=${initialAcked}`);

    // Setup: Track ACKs
    const itemAcks: Array<{ success: boolean; id: number }> = [];
    const batchAcks: Array<{ ids: number[] }> = [];

    const itemAckHandler = (data: any) => itemAcks.push(data);
    const batchAckHandler = (data: any) => batchAcks.push(data);

    socket.on('upload:ack:item', itemAckHandler);
    socket.on('upload:ack', batchAckHandler);

    // Queue multiple items
    console.log('  📝 Queueing 3 items...');
    const basePayload = {
      workflowRunId: '00000000-0000-0000-0000-000000000000',
      componentRunId: '00000000-0000-0000-0000-000000000001',
      transcriptPath: '/tmp/test-batch.jsonl',
    };

    await uploadManager.queueUpload('transcript', {
      ...basePayload,
      content: JSON.stringify({ test: 1, timestamp: Date.now() }),
      sequenceNumber: 1,
    });

    await uploadManager.queueUpload('transcript', {
      ...basePayload,
      content: JSON.stringify({ test: 2, timestamp: Date.now() + 1 }),
      sequenceNumber: 2,
    });

    await uploadManager.queueUpload('transcript', {
      ...basePayload,
      content: JSON.stringify({ test: 3, timestamp: Date.now() + 2 }),
      sequenceNumber: 3,
    });

    const stats1 = await uploadQueue.getStats();
    expect(stats1.pending).toBe(3);
    console.log(`  ✅ 3 items queued`);

    // Wait for flush and ACKs
    console.log('  ⏳ Waiting for flush and ACKs...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify all items received ACKs
    expect(itemAcks.length).toBe(3);
    console.log(`  ✅ Received ${itemAcks.length} item ACKs`);

    // Verify batch ACK received
    expect(batchAcks.length).toBeGreaterThan(0);
    console.log(`  ✅ Received batch ACK`);

    // Verify queue cleared (check relative to initial count since queue persists)
    const stats2 = await uploadQueue.getStats();
    expect(stats2.acked).toBe(initialAcked + 3);
    console.log(`  ✅ All items marked as acked (acked: ${stats2.acked}, added: ${stats2.acked - initialAcked})`);

    // Cleanup listeners
    socket.off('upload:ack:item', itemAckHandler);
    socket.off('upload:ack', batchAckHandler);

    console.log('✅ Test passed: Batch processing completed\n');
  }, TEST_TIMEOUT);

  it('should handle duplicate detection', async () => {
    console.log('\n🧪 Test: Duplicate detection');

    // Queue same content twice
    console.log('  📝 Queueing item...');
    const payload = {
      workflowRunId: '00000000-0000-0000-0000-000000000000',
      componentRunId: '00000000-0000-0000-0000-000000000001',
      transcriptPath: '/tmp/test-duplicate.jsonl',
      content: JSON.stringify({ test: 'duplicate', timestamp: 123456 }),
      sequenceNumber: 1,
    };

    await uploadManager.queueUpload('transcript', payload);

    // Try to queue duplicate (should fail at queue level)
    console.log('  📝 Attempting to queue duplicate...');
    await expect(uploadManager.queueUpload('transcript', payload))
      .rejects.toThrow('Duplicate content already in queue');

    console.log('  ✅ Duplicate rejected at queue level');

    // Wait for flush
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('✅ Test passed: Duplicate detection works\n');
  }, TEST_TIMEOUT);

  it('should handle queue statistics', async () => {
    console.log('\n🧪 Test: Queue statistics');

    // Get initial stats
    const initialStats = await uploadManager.getStats();
    console.log(`  📊 Initial stats: pending=${initialStats.pending}, sent=${initialStats.sent}, acked=${initialStats.acked}`);

    // Queue an item
    await uploadManager.queueUpload('transcript', {
      workflowRunId: '00000000-0000-0000-0000-000000000000',
      componentRunId: '00000000-0000-0000-0000-000000000001',
      transcriptPath: '/tmp/test-stats.jsonl',
      content: JSON.stringify({ test: 'stats', timestamp: Date.now() }),
      sequenceNumber: 1,
    });

    // Check stats updated
    const afterQueueStats = await uploadManager.getStats();
    expect(afterQueueStats.pending).toBe(initialStats.pending + 1);
    console.log(`  ✅ Stats updated after queue: pending=${afterQueueStats.pending}`);

    // Wait for flush and ACK
    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalStats = await uploadManager.getStats();
    expect(finalStats.acked).toBeGreaterThan(initialStats.acked);
    console.log(`  ✅ Stats updated after ACK: acked=${finalStats.acked}`);

    console.log('✅ Test passed: Queue statistics work\n');
  }, TEST_TIMEOUT);

  it('should maintain queue state across flush cycles', async () => {
    console.log('\n🧪 Test: Queue persistence');

    // Queue items
    console.log('  📝 Queueing 2 items...');
    await uploadManager.queueUpload('transcript', {
      workflowRunId: '00000000-0000-0000-0000-000000000000',
      componentRunId: '00000000-0000-0000-0000-000000000001',
      transcriptPath: '/tmp/test-persist-1.jsonl',
      content: JSON.stringify({ test: 'persist1', timestamp: Date.now() }),
      sequenceNumber: 1,
    });

    await uploadManager.queueUpload('transcript', {
      workflowRunId: '00000000-0000-0000-0000-000000000000',
      componentRunId: '00000000-0000-0000-0000-000000000001',
      transcriptPath: '/tmp/test-persist-2.jsonl',
      content: JSON.stringify({ test: 'persist2', timestamp: Date.now() + 1 }),
      sequenceNumber: 2,
    });

    // Get items before flush
    const pendingBefore = await uploadQueue.getPendingItems();
    expect(pendingBefore.length).toBe(2);
    console.log(`  ✅ 2 items pending before flush`);

    // Wait for flush
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check items are now sent
    const pendingAfter = await uploadQueue.getPendingItems();
    expect(pendingAfter.length).toBe(0);
    console.log(`  ✅ 0 items pending after flush (moved to sent)`);

    // Wait for ACKs
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify items are acked
    const finalStats = await uploadQueue.getStats();
    expect(finalStats.acked).toBeGreaterThanOrEqual(2);
    console.log(`  ✅ Items marked as acked: ${finalStats.acked}`);

    console.log('✅ Test passed: Queue persistence works\n');
  }, TEST_TIMEOUT);
});
