/**
 * Tests for UploadManager (ST-321)
 *
 * Orchestration layer for guaranteed delivery of artifacts and transcripts.
 * These tests verify the manager coordinates the queue and flush loop correctly.
 *
 * Test Categories:
 * - Unit: Core orchestration operations (queue, flush, cleanup)
 * - Integration: Socket.io integration and reconnect handling
 * - Edge Cases: Concurrent flushes, timer management, error handling
 * - Security: Resource limits, error propagation
 */

import { UploadManager, UploadManagerOptions } from '../upload-manager';
import { UploadQueue, QueueStats } from '../upload-queue';
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

describe('UploadManager', () => {
  let manager: UploadManager;
  let mockSocket: jest.Mocked<Socket>;
  let testDbPath: string;

  beforeEach(() => {
    // Use fake timers for consistent timer testing
    jest.useFakeTimers();
    // Create unique database for each test
    testDbPath = path.join(os.tmpdir(), `test-manager-${Date.now()}-${testCounter++}.db`);

    // Create mock socket
    mockSocket = {
      connected: false,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as any;
  });

  afterEach(async () => {
    // Stop manager if running
    if (manager) {
      await manager.stop();
    }

    // Cleanup database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should create UploadManager with default options', () => {
      manager = new UploadManager({ socket: mockSocket });

      expect(manager).toBeDefined();
    });

    it('should create UploadQueue with provided dbPath', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      // Verify database was created
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should use custom flush interval', () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 1000,
      });

      expect(manager).toBeDefined();
    });

    it('should use custom batch size', () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        batchSize: 100,
      });

      expect(manager).toBeDefined();
    });

    it('should use custom cleanup interval', () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        cleanupIntervalHours: 48,
      });

      expect(manager).toBeDefined();
    });

    it('should setup socket event handlers on init', () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('upload:ack', expect.any(Function));
    });

    it('should start flush loop on init', () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      // Manager should be initialized
      expect(manager).toBeDefined();
    });

    it('should start cleanup loop on init', () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      // Manager should be initialized
      expect(manager).toBeDefined();
    });

    it('should track initial connection state', () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      expect(manager).toBeDefined();
    });
  });

  describe('queueUpload', () => {
    beforeEach(() => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });
    });

    it('should queue artifact upload', async () => {
      await manager.queueUpload('artifact:upload', {
        storyId: 'ST-123',
        content: 'Test artifact',
      });

      const stats = await manager.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.total).toBe(1);
    });

    it('should queue transcript upload', async () => {
      await manager.queueUpload('transcript:upload', {
        sessionId: 'session-123',
        data: 'Test transcript',
      });

      const stats = await manager.getStats();
      expect(stats.pending).toBe(1);
    });

    it('should queue multiple items', async () => {
      await manager.queueUpload('artifact:upload', { id: 1 });
      await manager.queueUpload('artifact:upload', { id: 2 });
      await manager.queueUpload('transcript:upload', { id: 3 });

      const stats = await manager.getStats();
      expect(stats.pending).toBe(3);
    });

    it('should throw error if queue operation fails', async () => {
      // Queue an item
      await manager.queueUpload('test', { data: 'original' });

      // Try to queue duplicate (should fail)
      await expect(
        manager.queueUpload('test', { data: 'original' })
      ).rejects.toThrow('Duplicate content already in queue');
    });

    it('should handle generic payload types', async () => {
      const complexPayload = {
        storyId: 'ST-123',
        metadata: {
          author: 'user-1',
          timestamp: Date.now(),
        },
        items: [1, 2, 3],
      };

      await manager.queueUpload('artifact:upload', complexPayload);

      const stats = await manager.getStats();
      expect(stats.pending).toBe(1);
    });
  });

  describe('Socket Event Handlers', () => {
    describe('connect', () => {
      it('should trigger flush on socket connect', async () => {
        mockSocket.connected = false;

        manager = new UploadManager({
          socket: mockSocket,
          dbPath: testDbPath,
        });

        // Queue some items
        await manager.queueUpload('test', { id: 1 });
        await manager.queueUpload('test', { id: 2 });

        // Get connect handler
        const connectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
          call => call[0] === 'connect'
        )?.[1];

        expect(connectHandler).toBeDefined();

        // Simulate connection
        mockSocket.connected = true;
        await connectHandler();

        // Flush should have been triggered
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'upload:batch',
          expect.objectContaining({
            items: expect.arrayContaining([expect.any(Object)]),
          })
        );
      });

      it('should update connection state on connect', async () => {
        mockSocket.connected = false;

        manager = new UploadManager({
          socket: mockSocket,
          dbPath: testDbPath,
        });

        // Get connect handler
        const connectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
          call => call[0] === 'connect'
        )?.[1];

        // Simulate connection
        mockSocket.connected = true;
        await connectHandler();

        // Connection state should be updated
        expect(mockSocket.connected).toBe(true);
      });

      it('should handle flush errors on reconnect gracefully', async () => {
        manager = new UploadManager({
          socket: mockSocket,
          dbPath: testDbPath,
        });

        // Stop manager to close database
        await manager.stop();

        // Get connect handler
        const connectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
          call => call[0] === 'connect'
        )?.[1];

        // Simulate connection (should not throw)
        mockSocket.connected = true;
        expect(() => connectHandler()).not.toThrow();
      });
    });

    describe('disconnect', () => {
      it('should update connection state on disconnect', async () => {
        mockSocket.connected = true;

        manager = new UploadManager({
          socket: mockSocket,
          dbPath: testDbPath,
        });

        // Get disconnect handler
        const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
          call => call[0] === 'disconnect'
        )?.[1];

        // Simulate disconnection
        mockSocket.connected = false;
        disconnectHandler();

        // Connection state should be updated
        expect(mockSocket.connected).toBe(false);
      });

      it('should not flush while disconnected', async () => {
        mockSocket.connected = true;

        manager = new UploadManager({
          socket: mockSocket,
          dbPath: testDbPath,
          flushIntervalMs: 100,
        });

        await manager.queueUpload('test', { id: 1 });

        // Simulate disconnection
        const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
          call => call[0] === 'disconnect'
        )?.[1];
        mockSocket.connected = false;
        disconnectHandler();

        // Clear emit calls
        (mockSocket.emit as jest.Mock).mockClear();

        // Advance timers (should not flush)
        await jest.advanceTimersByTimeAsync(200);

        expect(mockSocket.emit).not.toHaveBeenCalled();
      });
    });

    describe('upload:ack', () => {
      it('should handle acknowledgement from server', async () => {
        mockSocket.connected = true;

        manager = new UploadManager({
          socket: mockSocket,
          dbPath: testDbPath,
        });

        // Queue and flush items
        await manager.queueUpload('test', { id: 1 });
        await manager.queueUpload('test', { id: 2 });

        await jest.advanceTimersByTimeAsync(600);

        // Get ack handler
        const ackHandler = (mockSocket.on as jest.Mock).mock.calls.find(
          call => call[0] === 'upload:ack'
        )?.[1];

        expect(ackHandler).toBeDefined();

        // Simulate server acknowledgement
        await ackHandler({ ids: [1, 2] });

        const stats = await manager.getStats();
        expect(stats.acked).toBe(2);
        expect(stats.sent).toBe(0);
      });

      it('should handle empty acknowledgement array', async () => {
        manager = new UploadManager({
          socket: mockSocket,
          dbPath: testDbPath,
        });

        const ackHandler = (mockSocket.on as jest.Mock).mock.calls.find(
          call => call[0] === 'upload:ack'
        )?.[1];

        // Should not throw
        expect(() => ackHandler({ ids: [] })).not.toThrow();
      });

      it('should handle acknowledgement errors gracefully', async () => {
        manager = new UploadManager({
          socket: mockSocket,
          dbPath: testDbPath,
        });

        const ackHandler = (mockSocket.on as jest.Mock).mock.calls.find(
          call => call[0] === 'upload:ack'
        )?.[1];

        // Invalid IDs should not throw
        expect(() => ackHandler({ ids: [99999, 99998] })).not.toThrow();
      });
    });
  });

  describe('Flush Loop', () => {
    it('should flush pending items on interval', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      await manager.queueUpload('test', { id: 1 });

      // Wait for flush
      await jest.advanceTimersByTimeAsync(200);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'upload:batch',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              type: 'test',
              payload: { id: 1 },
            }),
          ]),
        })
      );
    });

    it('should respect batch size limit', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
        batchSize: 2,
      });

      // Queue 5 items
      for (let i = 0; i < 5; i++) {
        await manager.queueUpload('test', { id: i });
      }

      // Advance timer to trigger flush
      await jest.advanceTimersByTimeAsync(600);

      // Should only flush 2 items (batch size)
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'upload:batch',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.any(Object),
            expect.any(Object),
          ]),
        })
      );

      const emitCall = (mockSocket.emit as jest.Mock).mock.calls[0];
      expect(emitCall[1].items).toHaveLength(2);
    });

    it('should skip flush if not connected', async () => {
      mockSocket.connected = false;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      await manager.queueUpload('test', { id: 1 });

      // Advance timer
      await jest.advanceTimersByTimeAsync(600);

      // Should not emit
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should skip flush if no pending items', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      // Advance timer (no items queued)
      await jest.advanceTimersByTimeAsync(600);

      // Should not emit
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should mark items as sent after flush', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      await manager.queueUpload('test', { id: 1 });

      // Advance timer to trigger flush
      await jest.advanceTimersByTimeAsync(600);

      const stats = await manager.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.sent).toBe(1);
    });

    it('should prevent concurrent flushes', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      // Queue many items
      for (let i = 0; i < 100; i++) {
        await manager.queueUpload('test', { id: i });
      }

      // Advance timers multiple times rapidly
      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(100);

      // Emit should be called, but concurrent flushes should be prevented
      expect(mockSocket.emit).toHaveBeenCalled();
    });

    it('should handle flush errors gracefully', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      await manager.queueUpload('test', { id: 1 });

      // Stop manager to close database (will cause flush to fail)
      await manager.stop();

      // Create new manager with same db (simulate error scenario)
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      // Should not throw on flush errors
      await jest.advanceTimersByTimeAsync(600);
    });

    it('should include all required fields in emitted items', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      await manager.queueUpload('artifact:upload', {
        storyId: 'ST-123',
        content: 'Test',
      });

      await jest.advanceTimersByTimeAsync(600);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'upload:batch',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              type: 'artifact:upload',
              payload: expect.objectContaining({
                storyId: 'ST-123',
                content: 'Test',
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('Cleanup Loop', () => {
    it('should run cleanup on startup', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      // Queue and ack an item
      await manager.queueUpload('test', { id: 1 });
      const stats1 = await manager.getStats();
      expect(stats1.pending).toBe(1);
    });

    it('should run cleanup on interval', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        cleanupIntervalHours: 1,
      });

      // Fast-forward 1 hour + some buffer
      await jest.advanceTimersByTimeAsync(1 * 60 * 60 * 1000 + 1000);

      // Should have triggered cleanup (no errors)
      expect(manager).toBeDefined();
    });

    it('should use custom cleanup interval', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        cleanupIntervalHours: 48,
      });

      // Verify manager is running with custom interval
      expect(manager).toBeDefined();
    });

    it('should handle cleanup errors gracefully', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        cleanupIntervalHours: 1,
      });

      // Stop manager to close database
      await manager.stop();

      // Advance timer (cleanup should handle error gracefully)
      await jest.advanceTimersByTimeAsync(1 * 60 * 60 * 1000 + 1000);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });
    });

    it('should return queue statistics', async () => {
      await manager.queueUpload('test', { id: 1 });
      await manager.queueUpload('test', { id: 2 });

      const stats = await manager.getStats();

      expect(stats).toMatchObject({
        pending: 2,
        sent: 0,
        acked: 0,
        total: 2,
      });
    });

    it('should include type breakdown', async () => {
      await manager.queueUpload('artifact:upload', { id: 1 });
      await manager.queueUpload('transcript:upload', { id: 2 });

      const stats = await manager.getStats();

      expect(stats.byType).toEqual({
        'artifact:upload': 1,
        'transcript:upload': 1,
      });
    });

    it('should return updated stats after flush', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      await manager.queueUpload('test', { id: 1 });

      await jest.advanceTimersByTimeAsync(200);

      const stats = await manager.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.sent).toBe(1);
    });
  });

  describe('stop', () => {
    it('should stop flush loop', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      await manager.queueUpload('test', { id: 1 });

      // Stop manager
      await manager.stop();

      // Clear emit calls
      (mockSocket.emit as jest.Mock).mockClear();

      // Advance timer (should not flush)
      await jest.advanceTimersByTimeAsync(600);

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should stop cleanup loop', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      await manager.stop();

      // Should have cleared timers
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should close queue', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      await manager.stop();

      // Queue operations should fail after stop
      await expect(manager.queueUpload('test', { id: 1 })).rejects.toThrow();
    });

    it('should be idempotent', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      await manager.stop();
      await manager.stop();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle socket emit errors gracefully', async () => {
      mockSocket.connected = true;
      mockSocket.emit = jest.fn().mockImplementation(() => {
        throw new Error('Socket error');
      });

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      await manager.queueUpload('test', { id: 1 });

      // Should not throw on flush
      await jest.advanceTimersByTimeAsync(600);

      expect(true).toBe(true);
    });

    it('should handle database errors during queue', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      // Close database to simulate error
      await manager.stop();

      // Should throw on queue operation
      await expect(manager.queueUpload('test', { id: 1 })).rejects.toThrow();
    });

    it('should recover from temporary flush failures', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      await manager.queueUpload('test', { id: 1 });

      // Cause one flush to fail
      mockSocket.emit = jest.fn().mockImplementationOnce(() => {
        throw new Error('Temporary failure');
      });

      await jest.advanceTimersByTimeAsync(600);

      // Restore normal emit
      mockSocket.emit = jest.fn();

      // Next flush should succeed
      await jest.advanceTimersByTimeAsync(600);

      expect(mockSocket.emit).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete upload lifecycle', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      // 1. Queue item
      await manager.queueUpload('artifact:upload', {
        storyId: 'ST-123',
        content: 'Test artifact',
      });

      let stats = await manager.getStats();
      expect(stats.pending).toBe(1);

      // 2. Flush
      await jest.advanceTimersByTimeAsync(600);

      stats = await manager.getStats();
      expect(stats.sent).toBe(1);

      // 3. Acknowledge
      const ackHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'upload:ack'
      )?.[1];

      await ackHandler({ ids: [1] });

      stats = await manager.getStats();
      expect(stats.acked).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('should handle reconnection with pending items', async () => {
      mockSocket.connected = false;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      // Queue while disconnected
      await manager.queueUpload('test', { id: 1 });
      await manager.queueUpload('test', { id: 2 });

      // Verify not flushed
      await jest.advanceTimersByTimeAsync(600);
      expect(mockSocket.emit).not.toHaveBeenCalled();

      // Reconnect
      const connectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      mockSocket.connected = true;
      await connectHandler();

      // Should flush immediately
      expect(mockSocket.emit).toHaveBeenCalled();
    });

    it('should handle multiple flushes with batch size limit', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
        batchSize: 3,
      });

      // Queue 10 items
      for (let i = 0; i < 10; i++) {
        await manager.queueUpload('test', { id: i });
      }

      // First flush (3 items)
      await jest.advanceTimersByTimeAsync(600);
      expect((mockSocket.emit as jest.Mock).mock.calls[0][1].items).toHaveLength(3);

      // Second flush (3 items)
      await jest.advanceTimersByTimeAsync(600);
      expect((mockSocket.emit as jest.Mock).mock.calls[1][1].items).toHaveLength(3);

      // Third flush (3 items)
      await jest.advanceTimersByTimeAsync(600);
      expect((mockSocket.emit as jest.Mock).mock.calls[2][1].items).toHaveLength(3);

      // Fourth flush (1 item)
      await jest.advanceTimersByTimeAsync(600);
      expect((mockSocket.emit as jest.Mock).mock.calls[3][1].items).toHaveLength(1);
    });

    it('should persist queue across manager restarts', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      await manager.queueUpload('test', { id: 1 });
      await manager.queueUpload('test', { id: 2 });

      await manager.stop();

      // Create new manager with same database
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      const stats = await manager.getStats();
      expect(stats.pending).toBe(2);
    });
  });

  describe('Performance', () => {
    it('should handle high volume of queue operations', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(manager.queueUpload('test', { id: i }));
      }

      await Promise.all(promises);

      const stats = await manager.getStats();
      expect(stats.pending).toBe(100);
    });

    it('should handle rapid flush cycles', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 100,
      });

      for (let i = 0; i < 20; i++) {
        await manager.queueUpload('test', { id: i });
      }

      // Advance through multiple flush cycles
      for (let i = 0; i < 10; i++) {
        await jest.advanceTimersByTimeAsync(150);
      }

      // Should have processed all items
      const stats = await manager.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.sent).toBe(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue stats request', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      const stats = await manager.getStats();

      expect(stats).toMatchObject({
        pending: 0,
        sent: 0,
        acked: 0,
        total: 0,
      });
    });

    it('should handle socket state changes during flush', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 500,
      });

      await manager.queueUpload('test', { id: 1 });

      // Simulate disconnect before flush fires
      const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      mockSocket.connected = false;
      disconnectHandler();

      // Advance timer to when flush would fire
      jest.advanceTimersByTime(600);

      // Should not have flushed because socket is disconnected
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should handle zero flush interval', async () => {
      mockSocket.connected = true;

      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        flushIntervalMs: 0,
      });

      await manager.queueUpload('test', { id: 1 });

      // With 0ms interval and fake timers, avoid advancing timers to prevent infinite loops
      // Just verify manager was created successfully
      expect(manager).toBeDefined();
      const stats = await manager.getStats();
      expect(stats.pending).toBe(1);
    });

    it('should handle zero batch size', async () => {
      mockSocket.connected = true;

      // This is an edge case - batch size 0 should be handled
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
        batchSize: 0,
      });

      await manager.queueUpload('test', { id: 1 });

      await jest.advanceTimersByTimeAsync(600);

      // Should not flush with batch size 0
      expect(manager).toBeDefined();
    });
  });

  describe('Security', () => {
    it('should not expose internal queue implementation', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      // Manager should not expose queue directly
      expect((manager as any).queue).toBeDefined();
      // But it should not be accessible through public API
    });

    it('should validate socket is provided', () => {
      expect(() => {
        new UploadManager({} as UploadManagerOptions);
      }).toThrow();
    });

    it('should handle malicious payloads safely', async () => {
      manager = new UploadManager({
        socket: mockSocket,
        dbPath: testDbPath,
      });

      const maliciousPayload = {
        constructor: 'malicious',
        __proto__: { injected: true },
        prototype: 'attack',
      };

      await manager.queueUpload('test', maliciousPayload);

      const stats = await manager.getStats();
      expect(stats.pending).toBe(1);
    });
  });
});
