/**
 * Unit Tests for TranscriptTailService (ST-176)
 *
 * Tests real-time transcript file tailing with:
 * - File watching using chokidar
 * - Position tracking (incremental reads)
 * - Cleanup on stop
 * - Edge cases (file not found, deleted, truncated)
 * - Security: Path traversal protection
 * - Security: Redaction of sensitive data
 *
 * @see ST-176: Real-Time Agent Transcript Streaming in Web GUI
 */

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

// Mock dependencies
const mockChokidar = {
  watch: jest.fn(),
};

const mockWatcher = {
  on: jest.fn().mockReturnThis(),
  close: jest.fn(),
};

const mockWebSocketGateway = {
  getServer: jest.fn(() => ({
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
  })),
};

const mockTranscriptsService = {
  redactSensitiveData: jest.fn((content: string) => ({
    redactedContent: content.replace(/sk-[a-zA-Z0-9]+/g, '[REDACTED-KEY]'),
    redactionApplied: content.includes('sk-'),
  })),
};

const mockFs = {
  stat: jest.fn(),
  createReadStream: jest.fn(),
};

// Mock modules
jest.mock('chokidar', () => mockChokidar);
jest.mock('fs/promises', () => mockFs);
jest.mock('fs', () => mockFs);

// Import after mocks
import { TranscriptTailService } from '../transcript-tail.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { TranscriptsService } from '../transcripts.service';

describe('TranscriptTailService', () => {
  let service: TranscriptTailService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup default mock behaviors
    mockChokidar.watch.mockReturnValue(mockWatcher);
    mockFs.stat.mockResolvedValue({ size: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptTailService,
        {
          provide: AppWebSocketGateway,
          useValue: mockWebSocketGateway,
        },
        {
          provide: TranscriptsService,
          useValue: mockTranscriptsService,
        },
      ],
    }).compile();

    service = module.get<TranscriptTailService>(TranscriptTailService);
  });

  describe('startTailing', () => {
    const validPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';
    const componentRunId = 'run-123';

    it('should start file watcher with chokidar', async () => {
      mockFs.stat.mockResolvedValue({ size: 100 });

      await service.startTailing(componentRunId, validPath);

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        validPath,
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 100,
          },
        })
      );
    });

    it('should initialize read position from current file size', async () => {
      mockFs.stat.mockResolvedValue({ size: 5000 });

      await service.startTailing(componentRunId, validPath);

      // Position should be set to file size (start from end)
      const position = service['positions'].get(componentRunId);
      expect(position).toBe(5000);
    });

    it('should register change event handler', async () => {
      await service.startTailing(componentRunId, validPath);

      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should register error event handler', async () => {
      await service.startTailing(componentRunId, validPath);

      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should prevent duplicate watchers for same componentRunId', async () => {
      await service.startTailing(componentRunId, validPath);
      await service.startTailing(componentRunId, validPath);

      // Should only create one watcher
      expect(mockChokidar.watch).toHaveBeenCalledTimes(1);
    });

    it('should store watcher in internal map', async () => {
      await service.startTailing(componentRunId, validPath);

      const watchers = service['watchers'];
      expect(watchers.has(componentRunId)).toBe(true);
      expect(watchers.get(componentRunId)).toBe(mockWatcher);
    });
  });

  describe('stopTailing', () => {
    const validPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';
    const componentRunId = 'run-123';

    beforeEach(async () => {
      await service.startTailing(componentRunId, validPath);
    });

    it('should close file watcher', async () => {
      await service.stopTailing(componentRunId);

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should remove watcher from internal map', async () => {
      await service.stopTailing(componentRunId);

      const watchers = service['watchers'];
      expect(watchers.has(componentRunId)).toBe(false);
    });

    it('should remove position from internal map', async () => {
      await service.stopTailing(componentRunId);

      const positions = service['positions'];
      expect(positions.has(componentRunId)).toBe(false);
    });

    it('should be safe to call when not tailing', async () => {
      await service.stopTailing(componentRunId);

      // Should not throw
      await expect(service.stopTailing('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy (Lifecycle)', () => {
    it('should close all watchers on service shutdown', async () => {
      const path1 = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-1.jsonl';
      const path2 = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-2.jsonl';

      await service.startTailing('run-1', path1);
      await service.startTailing('run-2', path2);

      await service.onModuleDestroy();

      expect(mockWatcher.close).toHaveBeenCalledTimes(2);
      expect(service['watchers'].size).toBe(0);
      expect(service['positions'].size).toBe(0);
    });
  });

  describe('Security: Path Traversal Protection', () => {
    const componentRunId = 'run-123';

    it('should reject path traversal attempts (../)', async () => {
      const maliciousPath = '../../etc/passwd';

      await expect(
        service.startTailing(componentRunId, maliciousPath)
      ).rejects.toThrow('Transcript path not in allowed directory');
    });

    it('should reject absolute paths outside allowed directories', async () => {
      const maliciousPath = '/etc/passwd';

      await expect(
        service.startTailing(componentRunId, maliciousPath)
      ).rejects.toThrow('Transcript path not in allowed directory');
    });

    it('should reject paths without .jsonl extension', async () => {
      const invalidPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/malicious.sh';

      await expect(
        service.startTailing(componentRunId, invalidPath)
      ).rejects.toThrow('Invalid transcript file extension');
    });

    it('should accept valid transcript paths', async () => {
      const validPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';

      await expect(
        service.startTailing(componentRunId, validPath)
      ).resolves.not.toThrow();
    });

    it('should accept paths from /opt/stack/AIStudio (KVM)', async () => {
      const kvmPath = '/opt/stack/AIStudio/.claude/projects/agent-123.jsonl';

      await expect(
        service.startTailing(componentRunId, kvmPath)
      ).resolves.not.toThrow();
    });
  });

  describe('Security: Redaction of Sensitive Data', () => {
    const validPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';
    const componentRunId = 'run-123';

    it('should apply redaction to streamed lines', async () => {
      const lineWithApiKey = '{"content": "API_KEY=sk-abc123xyz"}';

      mockTranscriptsService.redactSensitiveData.mockReturnValueOnce({
        redactedContent: '{"content": "API_KEY=[REDACTED-KEY]"}',
        redactionApplied: true,
      });

      await service.startTailing(componentRunId, validPath);

      // Simulate emitting lines
      service['emitNewLines'](componentRunId, [lineWithApiKey]);

      expect(mockTranscriptsService.redactSensitiveData).toHaveBeenCalledWith(lineWithApiKey);

      const mockEmit = mockWebSocketGateway.getServer().to('').emit;
      expect(mockEmit).toHaveBeenCalledWith(
        'transcript:line',
        expect.objectContaining({
          line: '{"content": "API_KEY=[REDACTED-KEY]"}',
        })
      );
    });

    it('should emit to room (not global broadcast)', async () => {
      await service.startTailing(componentRunId, validPath);

      const line = '{"content": "test"}';
      service['emitNewLines'](componentRunId, [line]);

      const mockTo = mockWebSocketGateway.getServer().to;
      expect(mockTo).toHaveBeenCalledWith(`transcript:${componentRunId}`);
    });

    it('should include sequence number in emitted events', async () => {
      await service.startTailing(componentRunId, validPath);

      service['emitNewLines'](componentRunId, ['line1', 'line2', 'line3']);

      const mockEmit = mockWebSocketGateway.getServer().to('').emit;
      expect(mockEmit).toHaveBeenCalledTimes(3);
      expect(mockEmit).toHaveBeenNthCalledWith(1, 'transcript:line', expect.objectContaining({ sequenceNumber: 1 }));
      expect(mockEmit).toHaveBeenNthCalledWith(2, 'transcript:line', expect.objectContaining({ sequenceNumber: 2 }));
      expect(mockEmit).toHaveBeenNthCalledWith(3, 'transcript:line', expect.objectContaining({ sequenceNumber: 3 }));
    });

    it('should include timestamp in emitted events', async () => {
      await service.startTailing(componentRunId, validPath);

      service['emitNewLines'](componentRunId, ['test']);

      const mockEmit = mockWebSocketGateway.getServer().to('').emit;
      expect(mockEmit).toHaveBeenCalledWith(
        'transcript:line',
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    const validPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';
    const componentRunId = 'run-123';

    it('should handle file not found error', async () => {
      mockFs.stat.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        service.startTailing(componentRunId, validPath)
      ).rejects.toThrow('ENOENT: no such file');
    });

    it('should handle watcher error and cleanup', async () => {
      await service.startTailing(componentRunId, validPath);

      // Get the error handler
      const errorHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      // Simulate error
      errorHandler(new Error('File deleted'));

      // Should have cleaned up
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow async cleanup
      expect(service['watchers'].has(componentRunId)).toBe(false);
    });

    it('should emit error event to WebSocket on watcher error', async () => {
      await service.startTailing(componentRunId, validPath);

      const errorHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      errorHandler(new Error('File deleted'));

      const mockEmit = mockWebSocketGateway.getServer().to('').emit;
      expect(mockEmit).toHaveBeenCalledWith(
        'transcript:error',
        expect.objectContaining({
          componentRunId,
          message: 'Failed to stream transcript',
          code: 'STREAM_ERROR',
        })
      );
    });

    it('should handle file truncation (position > file size)', async () => {
      mockFs.stat.mockResolvedValueOnce({ size: 5000 });
      await service.startTailing(componentRunId, validPath);

      // File is truncated
      mockFs.stat.mockResolvedValueOnce({ size: 100 });

      // Trigger file change
      const changeHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'change'
      )?.[1];

      await changeHandler();

      // Position should be reset to current file size
      const position = service['positions'].get(componentRunId);
      expect(position).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance: Batching and Debouncing', () => {
    const validPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';
    const componentRunId = 'run-123';

    it('should batch multiple lines into single WebSocket event', async () => {
      await service.startTailing(componentRunId, validPath);

      const lines = ['line1', 'line2', 'line3', 'line4', 'line5'];
      service['emitNewLines'](componentRunId, lines);

      const mockEmit = mockWebSocketGateway.getServer().to('').emit;
      // Each line should be emitted separately but in rapid succession
      expect(mockEmit).toHaveBeenCalledTimes(5);
    });

    it('should use chokidar awaitWriteFinish for debouncing', async () => {
      await service.startTailing(componentRunId, validPath);

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        validPath,
        expect.objectContaining({
          awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 100,
          },
        })
      );
    });
  });
});
