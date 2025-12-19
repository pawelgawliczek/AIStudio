/**
 * Integration Tests for Artifact Upload Flow (ST-327)
 *
 * Tests the complete flow:
 * 1. File write → ArtifactWatcher detects
 * 2. UploadManager queues
 * 3. Flush routes correctly
 * 4. ACK handling updates queue
 * 5. Reconnection restores queue
 * 6. Deduplication via content hash
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArtifactWatcher } from '../artifact-watcher';
import { UploadManager } from '../upload-manager';
import { Socket } from 'socket.io-client';

// Mock Logger
jest.mock('../logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

let testCounter = 0;

// Helper to wait for file system events
const waitForFileDetection = (ms: number = 1000) =>
  new Promise(resolve => setTimeout(resolve, ms));

// Helper to poll queue until condition is met or timeout
const waitForQueueCondition = async (
  manager: UploadManager,
  condition: (stats: { pending: number; sent: number; acked: number; total: number }) => boolean,
  timeoutMs: number = 5000,
  pollIntervalMs: number = 100
): Promise<void> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const stats = await manager.getStats();
    if (condition(stats)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  // Final check before failing
  const stats = await manager.getStats();
  if (!condition(stats)) {
    throw new Error(`Queue condition not met within ${timeoutMs}ms. Final stats: ${JSON.stringify(stats)}`);
  }
};

describe('Artifact Upload Integration', () => {
  let watcher: ArtifactWatcher;
  let manager: UploadManager;
  let mockSocket: jest.Mocked<Socket>;
  let testProjectPath: string;
  let testDbPath: string;
  let docsDir: string;

  beforeEach(() => {
    jest.useRealTimers(); // Use real timers for chokidar file watching
    jest.setTimeout(15000); // Increase timeout for real timers

    // Create test directories
    testProjectPath = path.join(os.tmpdir(), `test-integration-${Date.now()}-${testCounter++}`);
    docsDir = path.join(testProjectPath, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    testDbPath = path.join(testProjectPath, 'queue.db');

    // Create mock socket
    mockSocket = {
      connected: true,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    // Create UploadManager with shorter flush interval for faster tests
    manager = new UploadManager({
      socket: mockSocket,
      agentId: 'test-agent',
      dbPath: testDbPath,
      flushIntervalMs: 200, // Shorter interval for faster tests
    });

    // Create ArtifactWatcher
    watcher = new ArtifactWatcher({
      uploadManager: manager,
      projectPath: testProjectPath,
    });
  });

  afterEach(async () => {
    await watcher.stop();
    await manager.stop();

    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }

    jest.clearAllMocks();
  });

  describe('Complete Flow', () => {
    it('should detect file write, queue, and flush artifact', async () => {
      // Start watcher
      await watcher.start();

      // Wait for watcher to be ready
      await waitForFileDetection(500);

      // Create story directory and file
      const storyDir = path.join(docsDir, 'ST-123');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'THE_PLAN.md'), '# Implementation Plan\n\nDetails here.');

      // Wait for file detection using polling (chokidar + awaitWriteFinish takes ~500ms+)
      await waitForQueueCondition(manager, stats => stats.total > 0, 3000);

      // Verify item was queued
      const stats = await manager.getStats();
      expect(stats.total).toBeGreaterThan(0);

      // Wait for flush (200ms interval + buffer)
      await waitForFileDetection(400);

      // Verify artifact:upload was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'artifact:upload',
        expect.objectContaining({
          agentId: 'test-agent',
          items: expect.arrayContaining([
            expect.objectContaining({
              storyKey: 'ST-123',
              artifactKey: 'THE_PLAN',
              content: '# Implementation Plan\n\nDetails here.',
              contentType: 'text/markdown',
            }),
          ]),
        })
      );
    });

    it('should handle multiple files in same story', async () => {
      await watcher.start();
      await waitForFileDetection(500);

      const storyDir = path.join(docsDir, 'ST-456');
      fs.mkdirSync(storyDir, { recursive: true });

      // Write multiple files
      fs.writeFileSync(path.join(storyDir, 'PLAN.md'), 'Plan content');
      fs.writeFileSync(path.join(storyDir, 'ARCH.md'), 'Architecture content');
      fs.writeFileSync(path.join(storyDir, 'config.json'), '{"key":"value"}');

      // Wait for detection of all 3 files using polling
      await waitForQueueCondition(manager, stats => stats.total >= 3, 5000);

      // Verify all queued
      const stats = await manager.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(3);

      // Flush
      await waitForFileDetection(600);

      // All should be in one artifact:upload event
      const artifactCalls = (mockSocket.emit as jest.Mock).mock.calls.filter(
        call => call[0] === 'artifact:upload'
      );

      expect(artifactCalls.length).toBeGreaterThan(0);

      // Sum all items across calls (may be multiple flushes)
      const totalItems = artifactCalls.reduce((sum, call) => sum + call[1].items.length, 0);
      expect(totalItems).toBe(3);
    });

    it('should handle file changes and re-upload', async () => {
      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-789');
      fs.mkdirSync(storyDir, { recursive: true });
      const filePath = path.join(storyDir, 'DOC.md');

      // Write initial version
      fs.writeFileSync(filePath, 'Version 1');
      await waitForFileDetection(700);
      await waitForFileDetection(600); // Flush

      const firstCallCount = (mockSocket.emit as jest.Mock).mock.calls.length;
      expect(firstCallCount).toBeGreaterThan(0);

      // Modify file
      fs.writeFileSync(filePath, 'Version 2');
      await waitForFileDetection(700);
      await waitForFileDetection(600); // Flush

      const secondCallCount = (mockSocket.emit as jest.Mock).mock.calls.length;
      expect(secondCallCount).toBeGreaterThan(firstCallCount);

      // Verify new content was sent
      const lastCall = (mockSocket.emit as jest.Mock).mock.calls[secondCallCount - 1];
      expect(lastCall[1].items[0].content).toContain('Version 2');
    });
  });

  describe('ACK Handling', () => {
    it('should update queue state on ACK', async () => {
      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-100');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'TEST.md'), 'Test content');

      // Wait for queue and flush
      await waitForFileDetection(700);
      await waitForFileDetection(600);

      // Get the queueId
      const emitCall = (mockSocket.emit as jest.Mock).mock.calls.find(
        call => call[0] === 'artifact:upload'
      );
      const queueId = emitCall[1].items[0].queueId;

      // Verify item is in 'sent' state
      let stats = await manager.getStats();
      expect(stats.sent).toBe(1);

      // Simulate ACK from server
      const ackHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      await ackHandler({ success: true, id: queueId });

      // Verify item is now 'acked'
      stats = await manager.getStats();
      expect(stats.acked).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('should handle ACK for duplicate', async () => {
      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-200');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'DUP.md'), 'Duplicate content');

      // Queue and flush
      await waitForFileDetection(700);
      await waitForFileDetection(600);

      const emitCall = (mockSocket.emit as jest.Mock).mock.calls.find(
        call => call[0] === 'artifact:upload'
      );
      const queueId = emitCall[1].items[0].queueId;

      // Simulate duplicate ACK
      const ackHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      await ackHandler({ success: true, id: queueId, isDuplicate: true });

      // Should still be marked as acked (no retry)
      const stats = await manager.getStats();
      expect(stats.acked).toBe(1);
    });

    it('should handle ACK for failure', async () => {
      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-300');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'FAIL.md'), 'Fail content');

      // Queue and flush
      await waitForFileDetection(700);
      await waitForFileDetection(600);

      const emitCall = (mockSocket.emit as jest.Mock).mock.calls.find(
        call => call[0] === 'artifact:upload'
      );
      const queueId = emitCall[1].items[0].queueId;

      // Simulate failure ACK
      const ackHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      await ackHandler({ success: false, id: queueId, error: 'Story not found' });

      // Should still be marked as acked (no infinite retry)
      const stats = await manager.getStats();
      expect(stats.acked).toBe(1);
    });
  });

  describe('Reconnection', () => {
    it('should restore queue and resume uploads on reconnect', async () => {
      await watcher.start();
      await waitForFileDetection(500);

      // Queue items while connected
      const storyDir = path.join(docsDir, 'ST-400');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'TEST1.md'), 'Test 1');
      fs.writeFileSync(path.join(storyDir, 'TEST2.md'), 'Test 2');

      // Wait for files to be detected and queued
      await waitForQueueCondition(manager, stats => stats.total >= 2, 5000);

      // Disconnect
      mockSocket.connected = false;
      const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler();

      // Flush should not send while disconnected
      (mockSocket.emit as jest.Mock).mockClear();
      await waitForFileDetection(600);
      expect(mockSocket.emit).not.toHaveBeenCalled();

      // Reconnect
      mockSocket.connected = true;
      const connectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      await connectHandler();

      // Should flush immediately on reconnect
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'artifact:upload',
        expect.any(Object)
      );
    });

    it('should persist queue across manager restarts', async () => {
      await watcher.start();
      await waitForFileDetection(500);

      // Queue items
      const storyDir = path.join(docsDir, 'ST-500');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'PERSIST.md'), 'Persistent content');

      // Wait for file to be detected and queued
      await waitForQueueCondition(manager, stats => stats.total >= 1, 3000);

      // Stop manager without flushing
      mockSocket.connected = false;
      await manager.stop();

      // Restart manager with same database
      const newMockSocket = {
        connected: true,
        on: jest.fn(),
        emit: jest.fn(),
      } as any;

      const newManager = new UploadManager({
        socket: newMockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      // Check stats
      const stats = await newManager.getStats();
      expect(stats.pending).toBeGreaterThan(0);

      // Cleanup
      await newManager.stop();
    });
  });

  describe('Deduplication', () => {
    it('should queue different files even with same content', async () => {
      // Note: Deduplication is by full payload hash (including filePath and timestamp),
      // not just content. Different files with same content ARE both queued.
      await watcher.start();
      await waitForFileDetection(500);

      const storyDir = path.join(docsDir, 'ST-600');
      fs.mkdirSync(storyDir, { recursive: true });
      const content = 'Same content in different files';

      // Write same content to different files
      fs.writeFileSync(path.join(storyDir, 'FILE1.md'), content);
      fs.writeFileSync(path.join(storyDir, 'FILE2.md'), content);

      // Wait for both files to be detected
      await waitForQueueCondition(manager, stats => stats.total >= 2, 5000);

      // Both should be queued (different filePath means different payload hash)
      const stats = await manager.getStats();
      expect(stats.total).toBe(2);
    });

    it('should allow same content for different stories', async () => {
      await watcher.start();
      await waitForFileDetection(500);

      const content = 'Shared content across stories';

      // Story 1
      const story1Dir = path.join(docsDir, 'ST-700');
      fs.mkdirSync(story1Dir, { recursive: true });
      fs.writeFileSync(path.join(story1Dir, 'SHARED.md'), content);

      // Story 2
      const story2Dir = path.join(docsDir, 'ST-701');
      fs.mkdirSync(story2Dir, { recursive: true });
      fs.writeFileSync(path.join(story2Dir, 'SHARED.md'), content);

      // Wait for both files to be detected
      await waitForQueueCondition(manager, stats => stats.total >= 2, 5000);

      // Both should be queued (different file paths)
      const stats = await manager.getStats();
      expect(stats.total).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-800');
      fs.mkdirSync(storyDir, { recursive: true });
      const filePath = path.join(storyDir, 'ERROR.md');

      // Create file
      fs.writeFileSync(filePath, 'Initial content');
      await waitForFileDetection(100);

      // Delete file immediately (race condition)
      fs.unlinkSync(filePath);

      // Should not crash
      await waitForFileDetection(700);

      expect(true).toBe(true); // No crash
    });

    it('should handle many files gracefully', async () => {
      await watcher.start();
      await waitForFileDetection(500);

      const storyDir = path.join(docsDir, 'ST-900');
      fs.mkdirSync(storyDir, { recursive: true });

      // Create multiple files rapidly
      const content = 'Content for batch test';
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(path.join(storyDir, `BATCH${i}.md`), `${content} ${i}`);
      }

      // Wait for all files to be detected
      await waitForQueueCondition(manager, stats => stats.total >= 5, 8000);

      // Watcher should queue all unique files
      const stats = await manager.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(5);
    });

    it('should handle socket emit failures', async () => {
      // Mock emit to fail
      mockSocket.emit = jest.fn().mockImplementation(() => {
        throw new Error('Socket error');
      });

      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-1000');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'TEST.md'), 'Test');

      await waitForFileDetection(700);

      // Should not crash on flush
      await waitForFileDetection(600);

      expect(true).toBe(true); // No crash
    });
  });

  describe('Content Types', () => {
    it('should correctly set contentType for markdown files', async () => {
      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-111');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'DOC.md'), '# Markdown');

      await waitForFileDetection(700);
      await waitForFileDetection(600);

      const call = (mockSocket.emit as jest.Mock).mock.calls.find(
        c => c[0] === 'artifact:upload'
      );
      expect(call[1].items[0].contentType).toBe('text/markdown');
    });

    it('should correctly set contentType for JSON files', async () => {
      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-222');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'config.json'), '{"key":"value"}');

      await waitForFileDetection(700);
      await waitForFileDetection(600);

      const call = (mockSocket.emit as jest.Mock).mock.calls.find(
        c => c[0] === 'artifact:upload'
      );
      expect(call[1].items[0].contentType).toBe('application/json');
    });

    it('should correctly set contentType for text files', async () => {
      await watcher.start();
      await waitForFileDetection(200);

      const storyDir = path.join(docsDir, 'ST-333');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'notes.txt'), 'Plain text');

      await waitForFileDetection(700);
      await waitForFileDetection(600);

      const call = (mockSocket.emit as jest.Mock).mock.calls.find(
        c => c[0] === 'artifact:upload'
      );
      expect(call[1].items[0].contentType).toBe('text/plain');
    });
  });
});
