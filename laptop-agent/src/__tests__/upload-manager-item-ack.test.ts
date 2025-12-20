/**
 * UploadManager Individual Item ACK Handler Tests (EP-14)
 *
 * Tests for the upload:ack:item handler that processes individual ACKs.
 * This handler was added in ST-323 to support the new ACK protocol where
 * the backend sends individual ACKs for each item.
 *
 * These tests close the gap identified in EP-14 code review.
 */

import { UploadManager } from '../upload-manager';
import { Socket } from 'socket.io-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock Logger to avoid file system operations during tests
jest.mock('../logger', () => {
  return {
    Logger: jest.fn().mockImplementation((context: string) => {
      return {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
    }),
  };
});

let testCounter = 0;

describe('UploadManager - Individual Item ACK Handler (ST-323)', () => {
  let manager: UploadManager;
  let mockSocket: jest.Mocked<Socket>;
  let testDbPath: string;

  beforeEach(() => {
    jest.useFakeTimers();
    testDbPath = path.join(os.tmpdir(), `test-item-ack-${Date.now()}-${testCounter++}.db`);

    mockSocket = {
      connected: true,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as any;
  });

  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('upload:ack:item Handler Registration', () => {
    it('should register upload:ack:item handler on initialization', () => {
      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
      });

      // Verify handler was registered
      expect(mockSocket.on).toHaveBeenCalledWith(
        'upload:ack:item',
        expect.any(Function)
      );
    });

    it('should register both upload:ack and upload:ack:item handlers', () => {
      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
      });

      const registeredEvents = (mockSocket.on as jest.Mock).mock.calls.map(
        call => call[0]
      );

      expect(registeredEvents).toContain('upload:ack');
      expect(registeredEvents).toContain('upload:ack:item');
    });
  });

  describe('Individual Item ACK Processing', () => {
    it('should mark item as acked on success ACK', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue and flush an item
      await manager.queueUpload('test', { id: 1 });
      await jest.advanceTimersByTimeAsync(200);

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      expect(itemAckHandler).toBeDefined();

      // Simulate successful ACK
      await itemAckHandler({
        success: true,
        id: 1,
      });

      // Verify item was marked as acked
      const stats = await manager.getStats();
      expect(stats.acked).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('should mark item as acked even on error ACK (prevent infinite retries)', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue and flush an item
      await manager.queueUpload('test', { id: 1 });
      await jest.advanceTimersByTimeAsync(200);

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      // Simulate error ACK (item should still be marked as acked to prevent infinite retry)
      await itemAckHandler({
        success: false,
        id: 1,
        error: 'Story not found',
      });

      // Verify item was marked as acked despite error
      const stats = await manager.getStats();
      expect(stats.acked).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('should mark duplicate items as acked', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue and flush an item
      await manager.queueUpload('test', { id: 1 });
      await jest.advanceTimersByTimeAsync(200);

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      // Simulate duplicate ACK
      await itemAckHandler({
        success: true,
        id: 1,
        isDuplicate: true,
      });

      // Verify item was marked as acked
      const stats = await manager.getStats();
      expect(stats.acked).toBe(1);
    });
  });

  describe('queue:acked Event Emission', () => {
    it('should emit queue:acked event after marking item as acked', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue and flush an item
      await manager.queueUpload('test', { id: 1 });
      await jest.advanceTimersByTimeAsync(200);

      // Clear emit calls from flush
      (mockSocket.emit as jest.Mock).mockClear();

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      // Simulate ACK - wait for the async handler to complete
      await itemAckHandler({
        success: true,
        id: 1,
      });

      // Give the async operations time to complete
      await jest.advanceTimersByTimeAsync(50);

      // Verify queue:acked was emitted (the handler emits this)
      const queueAckedCalls = (mockSocket.emit as jest.Mock).mock.calls.filter(
        call => call[0] === 'queue:acked'
      );
      expect(queueAckedCalls.length).toBeGreaterThan(0);
      expect(queueAckedCalls[0][1]).toMatchObject({
        ids: [1],
        count: 1,
      });
    });
  });

  describe('queue:stats Event Emission', () => {
    it('should emit queue:stats event after marking item as acked', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue and flush an item
      await manager.queueUpload('test', { id: 1 });
      await jest.advanceTimersByTimeAsync(200);

      // Clear emit calls from flush
      (mockSocket.emit as jest.Mock).mockClear();

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      // Simulate ACK
      await itemAckHandler({
        success: true,
        id: 1,
      });

      // Give the async operations time to complete
      await jest.advanceTimersByTimeAsync(50);

      // Find the queue:stats call
      const statsCall = (mockSocket.emit as jest.Mock).mock.calls.find(
        call => call[0] === 'queue:stats'
      );

      expect(statsCall).toBeDefined();
      expect(statsCall[1]).toMatchObject({
        pending: expect.any(Number),
        sent: expect.any(Number),
        acked: expect.any(Number),
        total: expect.any(Number),
      });
    });

    it('should include type breakdown in queue:stats', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue items of different types
      await manager.queueUpload('artifact:upload', { id: 1 });
      await manager.queueUpload('transcript:upload', { id: 2 });
      await jest.advanceTimersByTimeAsync(200);

      // Clear emit calls
      (mockSocket.emit as jest.Mock).mockClear();

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      // ACK first item
      await itemAckHandler({ success: true, id: 1 });

      // Give the async operations time to complete
      await jest.advanceTimersByTimeAsync(50);

      // Find the queue:stats call
      const statsCall = (mockSocket.emit as jest.Mock).mock.calls.find(
        call => call[0] === 'queue:stats'
      );

      expect(statsCall).toBeDefined();
      expect(statsCall[1]).toHaveProperty('byType');
    });
  });

  describe('Error Handling', () => {
    it('should handle ACK for non-existent item gracefully', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
      });

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      expect(itemAckHandler).toBeDefined();

      // ACK for non-existent item should not throw
      // The handler is async but catches its own errors
      let errorThrown = false;
      try {
        await itemAckHandler({ success: true, id: 99999 });
      } catch {
        errorThrown = true;
      }
      expect(errorThrown).toBe(false);
    });

    it('should handle database errors during ACK processing gracefully', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue and flush an item
      await manager.queueUpload('test', { id: 1 });
      await jest.advanceTimersByTimeAsync(200);

      // Get the item ACK handler (from before stop)
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      expect(itemAckHandler).toBeDefined();

      // Stop manager to close database
      await manager.stop();

      // ACK should not throw even if database is closed
      // (handler should catch and log error)
      let errorThrown = false;
      try {
        await itemAckHandler({ success: true, id: 1 });
      } catch {
        errorThrown = true;
      }
      expect(errorThrown).toBe(false);
    });
  });

  describe('Multiple Item ACKs', () => {
    it('should process multiple individual ACKs correctly', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue multiple items
      await manager.queueUpload('test', { id: 1 });
      await manager.queueUpload('test', { id: 2 });
      await manager.queueUpload('test', { id: 3 });
      await jest.advanceTimersByTimeAsync(200);

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      // ACK items individually
      await itemAckHandler({ success: true, id: 1 });
      await itemAckHandler({ success: true, id: 2 });
      await itemAckHandler({ success: false, id: 3, error: 'Some error' });

      // All should be acked
      const stats = await manager.getStats();
      expect(stats.acked).toBe(3);
      expect(stats.sent).toBe(0);
      expect(stats.pending).toBe(0);
    });

    it('should handle mixed success/failure ACKs', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue items
      await manager.queueUpload('artifact:upload', { storyKey: 'ST-123' });
      await manager.queueUpload('artifact:upload', { storyKey: 'ST-INVALID' });
      await jest.advanceTimersByTimeAsync(200);

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      // First item succeeds
      await itemAckHandler({ success: true, id: 1 });

      // Second item fails (but should still be acked)
      await itemAckHandler({
        success: false,
        id: 2,
        error: 'Story not found',
      });

      // Both should be acked
      const stats = await manager.getStats();
      expect(stats.acked).toBe(2);
    });
  });

  describe('ACK Ordering', () => {
    it('should handle out-of-order ACKs correctly', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue items in order 1, 2, 3
      await manager.queueUpload('test', { order: 1 });
      await manager.queueUpload('test', { order: 2 });
      await manager.queueUpload('test', { order: 3 });
      await jest.advanceTimersByTimeAsync(200);

      // Get the item ACK handler
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      // ACK in reverse order: 3, 1, 2
      await itemAckHandler({ success: true, id: 3 });
      await itemAckHandler({ success: true, id: 1 });
      await itemAckHandler({ success: true, id: 2 });

      // All should be acked regardless of order
      const stats = await manager.getStats();
      expect(stats.acked).toBe(3);
    });
  });

  describe('Integration with Batch ACK Handler', () => {
    it('should work alongside batch ACK handler without conflicts', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        agentId: 'test-agent',
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue items
      await manager.queueUpload('test', { id: 1 });
      await manager.queueUpload('test', { id: 2 });
      await jest.advanceTimersByTimeAsync(200);

      // Get both handlers
      const itemAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack:item'
      )?.[1];

      const batchAckHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack'
      )?.[1];

      // Use item ACK for first item
      await itemAckHandler({ success: true, id: 1 });

      // Use batch ACK for second item
      await batchAckHandler({ ids: [2] });

      // Both should be acked
      const stats = await manager.getStats();
      expect(stats.acked).toBe(2);
    });
  });
});
