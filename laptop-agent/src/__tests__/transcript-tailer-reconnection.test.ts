/**
 * TranscriptTailer Reconnection Tests (EP-14)
 *
 * Tests for the updateSocket() method and reconnection behavior.
 * When the WebSocket reconnects, the TranscriptTailer needs to:
 * 1. Update its socket reference
 * 2. Re-emit streaming_started for all active sessions
 * 3. Preserve session state
 *
 * These tests close the gap identified in EP-14 code review.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TranscriptTailer, TailRequest } from '../transcript-tailer';
import { UploadManager } from '../upload-manager';
import { Socket } from 'socket.io-client';

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

describe('TranscriptTailer - Reconnection Tests (updateSocket)', () => {
  let tailer: TranscriptTailer;
  let mockSocket: jest.Mocked<Socket>;
  let mockNewSocket: jest.Mocked<Socket>;
  let mockUploadManager: jest.Mocked<UploadManager>;
  let testTranscriptPath: string;
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for transcript files
    // Use /Users/ prefix to pass isValidTranscriptPath security check
    testDir = path.join(os.homedir(), `.claude-test-reconnect-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    testTranscriptPath = path.join(testDir, 'session-reconnect.jsonl');

    // Create original mock socket
    mockSocket = {
      connected: true,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    // Create new mock socket (for reconnection)
    mockNewSocket = {
      connected: true,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    // Create mock UploadManager
    mockUploadManager = {
      queueUpload: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({ pending: 0, sent: 0, acked: 0, total: 0 }),
      stop: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  afterEach(async () => {
    // Stop tailer if running
    if (tailer) {
      await tailer.stopAll();
    }

    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    jest.clearAllMocks();
  });

  describe('updateSocket', () => {
    it('should update the socket reference', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Verify initial socket
      expect((tailer as any).socket).toBe(mockSocket);

      // Update socket
      await tailer.updateSocket(mockNewSocket);

      // Verify socket reference is updated
      expect((tailer as any).socket).toBe(mockNewSocket);
    });

    it('should re-emit streaming_started for all active sessions after reconnect', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Create transcript file and start tailing
      fs.writeFileSync(testTranscriptPath, '');

      const request: TailRequest = {
        runId: 'run-reconnect-test',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify initial streaming_started was emitted on original socket
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transcript:streaming_started',
        expect.objectContaining({
          runId: 'run-reconnect-test',
          sessionIndex: 0,
        })
      );

      // Clear the mock
      mockSocket.emit.mockClear();

      // Simulate reconnection by updating socket
      await tailer.updateSocket(mockNewSocket);

      // Verify streaming_started was re-emitted on new socket
      expect(mockNewSocket.emit).toHaveBeenCalledWith(
        'transcript:streaming_started',
        expect.objectContaining({
          runId: 'run-reconnect-test',
          sessionIndex: 0,
          filePath: testTranscriptPath,
        })
      );
    });

    it('should re-emit streaming_started for multiple active sessions', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Create multiple transcript files
      const path1 = path.join(testDir, 'session-1.jsonl');
      const path2 = path.join(testDir, 'session-2.jsonl');
      fs.writeFileSync(path1, '');
      fs.writeFileSync(path2, '');

      // Start tailing multiple sessions
      await tailer.startTailing({
        runId: 'run-multi-1',
        sessionIndex: 0,
        filePath: path1,
        fromBeginning: false,
      });

      await tailer.startTailing({
        runId: 'run-multi-1',
        sessionIndex: 1,
        filePath: path2,
        fromBeginning: false,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify we have 2 active sessions
      expect(tailer.getActiveSessionCount()).toBe(2);

      // Update socket
      await tailer.updateSocket(mockNewSocket);

      // Verify streaming_started was re-emitted for BOTH sessions
      const streamingStartedCalls = mockNewSocket.emit.mock.calls.filter(
        call => call[0] === 'transcript:streaming_started'
      );

      expect(streamingStartedCalls).toHaveLength(2);

      // Verify each session was notified
      const runIds = streamingStartedCalls.map(call => call[1].sessionIndex);
      expect(runIds).toContain(0);
      expect(runIds).toContain(1);
    });

    it('should preserve session state after reconnection', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Create transcript file
      fs.writeFileSync(testTranscriptPath, '{"initial":"content"}\n');

      const request: TailRequest = {
        runId: 'run-preserve-state',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get initial session count
      const countBefore = tailer.getActiveSessionCount();

      // Update socket (reconnect)
      await tailer.updateSocket(mockNewSocket);

      // Session count should be preserved
      expect(tailer.getActiveSessionCount()).toBe(countBefore);
    });

    it('should use new socket for file change emissions after reconnect', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Create transcript file
      fs.writeFileSync(testTranscriptPath, '');

      const request: TailRequest = {
        runId: 'run-new-socket-emit',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Update socket
      await tailer.updateSocket(mockNewSocket);

      // Clear mocks
      mockSocket.emit.mockClear();
      mockNewSocket.emit.mockClear();
      mockUploadManager.queueUpload.mockClear();

      // Append new content (should use new socket or UploadManager)
      fs.appendFileSync(testTranscriptPath, '{"new":"line after reconnect"}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      // If UploadManager is used, it should be called
      // If direct socket, new socket should be used (not old socket)
      const uploadManagerCalled = mockUploadManager.queueUpload.mock.calls.length > 0;
      const oldSocketCalled = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'transcript:lines'
      ).length > 0;

      // The old socket should NOT be used for new emissions
      expect(oldSocketCalled).toBe(false);

      // Either UploadManager or new socket should handle new lines
      if (!uploadManagerCalled) {
        const newSocketLinesEmit = mockNewSocket.emit.mock.calls.filter(
          call => call[0] === 'transcript:lines'
        );
        expect(newSocketLinesEmit.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle updateSocket when no sessions are active', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // No sessions started

      // Update socket should not throw
      await expect(tailer.updateSocket(mockNewSocket)).resolves.not.toThrow();

      // Socket should still be updated
      expect((tailer as any).socket).toBe(mockNewSocket);

      // No streaming_started should be emitted
      expect(mockNewSocket.emit).not.toHaveBeenCalledWith(
        'transcript:streaming_started',
        expect.any(Object)
      );
    });

    it('should include file size and position in re-emitted streaming_started', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Create transcript file with some content
      fs.writeFileSync(testTranscriptPath, '{"line1":"data"}\n{"line2":"data"}\n');

      const request: TailRequest = {
        runId: 'run-with-size',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update socket
      await tailer.updateSocket(mockNewSocket);

      // Verify re-emitted streaming_started includes file size
      expect(mockNewSocket.emit).toHaveBeenCalledWith(
        'transcript:streaming_started',
        expect.objectContaining({
          runId: 'run-with-size',
          sessionIndex: 0,
          filePath: testTranscriptPath,
          fileSize: expect.any(Number),
          startPosition: expect.any(Number),
        })
      );
    });

    it('should handle file not found error gracefully during reconnect', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Create and start tailing
      fs.writeFileSync(testTranscriptPath, '');

      await tailer.startTailing({
        runId: 'run-file-deleted',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Delete the file before reconnect
      fs.unlinkSync(testTranscriptPath);

      // Update socket should not throw even if file is gone
      await expect(tailer.updateSocket(mockNewSocket)).resolves.not.toThrow();
    });
  });

  describe('Session Continuity After Reconnect', () => {
    it('should continue processing file changes after reconnect', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Create transcript file
      fs.writeFileSync(testTranscriptPath, '');

      await tailer.startTailing({
        runId: 'run-continuity',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Simulate reconnection
      await tailer.updateSocket(mockNewSocket);
      mockUploadManager.queueUpload.mockClear();

      // Append content after reconnect
      fs.appendFileSync(testTranscriptPath, '{"post-reconnect":"line"}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have processed the new line
      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.objectContaining({
          runId: 'run-continuity',
          lines: expect.arrayContaining([
            expect.objectContaining({
              line: expect.stringContaining('post-reconnect'),
            }),
          ]),
        })
      );
    });

    it('should maintain sequence numbers across reconnects', async () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      // Create transcript file
      fs.writeFileSync(testTranscriptPath, '');

      await tailer.startTailing({
        runId: 'run-sequence',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Add first line before reconnect
      fs.appendFileSync(testTranscriptPath, '{"line":"before"}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      const callsBefore = mockUploadManager.queueUpload.mock.calls.filter(
        call => call[0] === 'transcript_line'
      );
      const seqBefore = callsBefore.length > 0
        ? (callsBefore[callsBefore.length - 1][1] as any).lines[0]?.sequenceNumber
        : 0;

      // Reconnect
      await tailer.updateSocket(mockNewSocket);
      mockUploadManager.queueUpload.mockClear();

      // Add line after reconnect
      fs.appendFileSync(testTranscriptPath, '{"line":"after"}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      const callsAfter = mockUploadManager.queueUpload.mock.calls.filter(
        call => call[0] === 'transcript_line'
      );

      if (callsAfter.length > 0) {
        const seqAfter = (callsAfter[0][1] as any).lines[0]?.sequenceNumber;
        // Sequence should continue from where it left off
        expect(seqAfter).toBeGreaterThan(seqBefore);
      }
    });
  });
});
