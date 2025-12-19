/**
 * TDD Tests for TranscriptTailer with UploadManager Integration (ST-330)
 *
 * Tests verify that TranscriptTailer queues transcript lines via UploadManager
 * instead of directly emitting to WebSocket. This provides guaranteed delivery
 * with persistent queue and retry logic.
 *
 * Test Categories:
 * - Unit: Constructor accepts UploadManager, queues transcript lines
 * - Integration: File watching triggers queueUpload calls
 * - Edge Cases: Fallback to socket emit when UploadManager not provided
 * - Security: Sequence tracking, payload validation
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

describe('TranscriptTailer - UploadManager Integration (ST-330)', () => {
  let tailer: TranscriptTailer;
  let mockSocket: jest.Mocked<Socket>;
  let mockUploadManager: jest.Mocked<UploadManager>;
  let testTranscriptPath: string;
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for transcript files
    // Use /Users/ prefix to pass isValidTranscriptPath security check
    testDir = path.join(os.homedir(), `.claude-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    testTranscriptPath = path.join(testDir, 'session-123.jsonl');

    // Create mock socket
    mockSocket = {
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

  describe('Constructor', () => {
    it('should accept UploadManager in constructor', () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      expect(tailer).toBeDefined();
      expect(tailer).toBeInstanceOf(TranscriptTailer);
    });

    it('should accept Socket without UploadManager for backward compatibility', () => {
      tailer = new TranscriptTailer(mockSocket);

      expect(tailer).toBeDefined();
      expect(tailer).toBeInstanceOf(TranscriptTailer);
    });

    it('should store UploadManager reference when provided', () => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);

      expect((tailer as any).uploadManager).toBe(mockUploadManager);
    });

    it('should have null UploadManager when not provided', () => {
      tailer = new TranscriptTailer(mockSocket);

      expect((tailer as any).uploadManager).toBeNull();
    });
  });

  describe('Queueing Transcript Lines via UploadManager', () => {
    beforeEach(() => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);
    });

    it('should queue historical transcript lines via UploadManager', async () => {
      // Create transcript file with content
      const transcriptContent = [
        '{"type":"request","message":"Hello"}',
        '{"type":"response","message":"Hi"}',
        '{"type":"request","message":"How are you?"}',
      ].join('\n');

      fs.writeFileSync(testTranscriptPath, transcriptContent);

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);

      // Wait for file reading to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify UploadManager.queueUpload was called for historical content
      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.objectContaining({
          runId: 'run-123',
          sessionIndex: 0,
          lines: expect.arrayContaining([
            expect.objectContaining({
              line: expect.any(String),
              sequenceNumber: expect.any(Number),
            }),
          ]),
          isHistorical: true,
          timestamp: expect.any(String),
        })
      );
    });

    it('should queue new transcript lines via UploadManager on file change', async () => {
      // Create empty transcript file
      fs.writeFileSync(testTranscriptPath, '');

      const request: TailRequest = {
        runId: 'run-456',
        sessionIndex: 1,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);

      // Wait for watcher to initialize
      await new Promise(resolve => setTimeout(resolve, 200));

      // Clear previous calls
      mockUploadManager.queueUpload.mockClear();

      // Append new line to file
      fs.appendFileSync(testTranscriptPath, '{"type":"request","message":"New line"}\n');

      // Wait for file change detection
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify UploadManager.queueUpload was called for new content
      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.objectContaining({
          runId: 'run-456',
          sessionIndex: 1,
          lines: expect.arrayContaining([
            expect.objectContaining({
              line: expect.stringContaining('New line'),
              sequenceNumber: expect.any(Number),
            }),
          ]),
          isHistorical: false,
          timestamp: expect.any(String),
        })
      );
    });

    it('should include correct runId in queued payload', async () => {
      fs.writeFileSync(testTranscriptPath, '{"type":"test"}');

      const request: TailRequest = {
        runId: 'run-specific-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.objectContaining({
          runId: 'run-specific-123',
        })
      );
    });

    it('should include correct sessionIndex in queued payload', async () => {
      fs.writeFileSync(testTranscriptPath, '{"type":"test"}');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 5,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.objectContaining({
          sessionIndex: 5,
        })
      );
    });

    it('should include sequence numbers for ordering', async () => {
      const transcriptContent = [
        '{"line":1}',
        '{"line":2}',
        '{"line":3}',
      ].join('\n');

      fs.writeFileSync(testTranscriptPath, transcriptContent);

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      const calls = mockUploadManager.queueUpload.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const payload = calls[0][1] as any;
      expect(payload.lines).toBeInstanceOf(Array);
      expect(payload.lines.length).toBe(3);

      // Verify sequence numbers are incremental
      expect(payload.lines[0].sequenceNumber).toBe(1);
      expect(payload.lines[1].sequenceNumber).toBe(2);
      expect(payload.lines[2].sequenceNumber).toBe(3);
    });

    it('should include timestamp in queued payload', async () => {
      fs.writeFileSync(testTranscriptPath, '{"type":"test"}');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      const beforeTimestamp = new Date().toISOString();
      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));
      const afterTimestamp = new Date().toISOString();

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );

      const payload = mockUploadManager.queueUpload.mock.calls[0][1] as any;
      expect(payload.timestamp).toBeDefined();
      expect(new Date(payload.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTimestamp).getTime());
      expect(new Date(payload.timestamp).getTime()).toBeLessThanOrEqual(new Date(afterTimestamp).getTime());
    });

    it('should mark historical content with isHistorical: true', async () => {
      fs.writeFileSync(testTranscriptPath, '{"type":"historical"}');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.objectContaining({
          isHistorical: true,
        })
      );
    });

    it('should mark new content with isHistorical: false', async () => {
      fs.writeFileSync(testTranscriptPath, '');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      mockUploadManager.queueUpload.mockClear();

      // Append new content
      fs.appendFileSync(testTranscriptPath, '{"type":"new"}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.objectContaining({
          isHistorical: false,
        })
      );
    });

    it('should pass correct event type to queueUpload', async () => {
      fs.writeFileSync(testTranscriptPath, '{"type":"test"}');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'transcript_line',
        expect.any(Object)
      );
    });
  });

  describe('Fallback to Socket Emit', () => {
    beforeEach(() => {
      // Create tailer WITHOUT UploadManager
      tailer = new TranscriptTailer(mockSocket);
    });

    it('should emit to socket when UploadManager is not provided', async () => {
      fs.writeFileSync(testTranscriptPath, '{"type":"test"}');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should emit to socket instead of queueing
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transcript:batch',
        expect.any(Object)
      );
    });

    it('should emit transcript:lines on file change when no UploadManager', async () => {
      fs.writeFileSync(testTranscriptPath, '');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      mockSocket.emit.mockClear();

      fs.appendFileSync(testTranscriptPath, '{"type":"new"}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transcript:lines',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);
    });

    it('should handle queueUpload errors gracefully', async () => {
      mockUploadManager.queueUpload.mockRejectedValueOnce(new Error('Queue full'));

      fs.writeFileSync(testTranscriptPath, '{"type":"test"}');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      // Should not throw
      await expect(tailer.startTailing(request)).resolves.not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify queueUpload was attempted
      expect(mockUploadManager.queueUpload).toHaveBeenCalled();
    });

    it('should continue watching after queueUpload error', async () => {
      mockUploadManager.queueUpload
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      fs.writeFileSync(testTranscriptPath, '{"type":"test"}');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      mockUploadManager.queueUpload.mockClear();

      // Append new content - should succeed this time
      fs.appendFileSync(testTranscriptPath, '{"type":"new"}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(mockUploadManager.queueUpload).toHaveBeenCalled();
    });

    it('should handle empty lines gracefully', async () => {
      const transcriptContent = [
        '{"line":1}',
        '',
        '{"line":2}',
        '   ',
        '{"line":3}',
      ].join('\n');

      fs.writeFileSync(testTranscriptPath, transcriptContent);

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: true,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      const payload = mockUploadManager.queueUpload.mock.calls[0][1] as any;

      // Only non-empty lines should be included
      expect(payload.lines.length).toBe(3);
    });
  });

  describe('Sequence Number Tracking', () => {
    beforeEach(() => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);
    });

    it('should maintain sequence across multiple file changes', async () => {
      fs.writeFileSync(testTranscriptPath, '{"line":1}\n{"line":2}\n');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      // First change
      mockUploadManager.queueUpload.mockClear();
      fs.appendFileSync(testTranscriptPath, '{"line":3}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      const firstPayload = mockUploadManager.queueUpload.mock.calls[0][1] as any;
      const firstSeq = firstPayload.lines[0].sequenceNumber;

      // Second change
      mockUploadManager.queueUpload.mockClear();
      fs.appendFileSync(testTranscriptPath, '{"line":4}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      const secondPayload = mockUploadManager.queueUpload.mock.calls[0][1] as any;
      const secondSeq = secondPayload.lines[0].sequenceNumber;

      // Sequence should increment
      expect(secondSeq).toBe(firstSeq + 1);
    });

    it('should reset sequence for each session', async () => {
      const path1 = path.join(testDir, 'session-1.jsonl');
      const path2 = path.join(testDir, 'session-2.jsonl');

      fs.writeFileSync(path1, '{"line":1}\n');
      fs.writeFileSync(path2, '{"line":1}\n');

      // Start first session
      await tailer.startTailing({
        runId: 'run-123',
        sessionIndex: 0,
        filePath: path1,
        fromBeginning: true,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const firstPayload = mockUploadManager.queueUpload.mock.calls[0][1] as any;
      const firstSeq = firstPayload.lines[0].sequenceNumber;

      mockUploadManager.queueUpload.mockClear();

      // Start second session
      await tailer.startTailing({
        runId: 'run-123',
        sessionIndex: 1,
        filePath: path2,
        fromBeginning: true,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const secondPayload = mockUploadManager.queueUpload.mock.calls[0][1] as any;
      const secondSeq = secondPayload.lines[0].sequenceNumber;

      // Both should start at 1 (independent sequences)
      expect(firstSeq).toBe(1);
      expect(secondSeq).toBe(1);
    });
  });

  describe('Existing Behavior Preservation', () => {
    beforeEach(() => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);
    });

    it('should still emit streaming_started to socket', async () => {
      fs.writeFileSync(testTranscriptPath, '');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transcript:streaming_started',
        expect.objectContaining({
          runId: 'run-123',
          sessionIndex: 0,
          filePath: testTranscriptPath,
        })
      );
    });

    it('should still emit streaming_stopped to socket', async () => {
      fs.writeFileSync(testTranscriptPath, '');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      await tailer.stopTailing('run-123', 0);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transcript:streaming_stopped',
        expect.objectContaining({
          runId: 'run-123',
          sessionIndex: 0,
        })
      );
    });

    it('should maintain existing start/stop tailing logic', async () => {
      fs.writeFileSync(testTranscriptPath, '');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      expect(tailer.getActiveSessionCount()).toBe(1);

      await tailer.stopTailing('run-123', 0);
      expect(tailer.getActiveSessionCount()).toBe(0);
    });

    it('should validate file path security', async () => {
      const invalidPath = '/etc/passwd';

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: invalidPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should emit error instead of queueing
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transcript:error',
        expect.objectContaining({
          code: 'INVALID_PATH',
        })
      );

      expect(mockUploadManager.queueUpload).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Existing System', () => {
    beforeEach(() => {
      tailer = new TranscriptTailer(mockSocket, mockUploadManager);
    });

    it('should work with file truncation (context compaction)', async () => {
      fs.writeFileSync(testTranscriptPath, '{"line":1}\n{"line":2}\n');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Truncate file (simulate context compaction)
      fs.writeFileSync(testTranscriptPath, '');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Append new content
      mockUploadManager.queueUpload.mockClear();
      fs.appendFileSync(testTranscriptPath, '{"line":3}\n');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should still queue new content
      expect(mockUploadManager.queueUpload).toHaveBeenCalled();
    });

    it('should handle duplicate session requests', async () => {
      fs.writeFileSync(testTranscriptPath, '{"line":1}\n');

      const request: TailRequest = {
        runId: 'run-123',
        sessionIndex: 0,
        filePath: testTranscriptPath,
        fromBeginning: false,
      };

      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Start same session again
      await tailer.startTailing(request);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should emit streaming_started for new client
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transcript:streaming_started',
        expect.any(Object)
      );

      // Should still have one active session
      expect(tailer.getActiveSessionCount()).toBe(1);
    });
  });
});
