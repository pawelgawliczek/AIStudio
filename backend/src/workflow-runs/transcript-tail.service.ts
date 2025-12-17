/**
 * TranscriptTailService - Real-Time Transcript File Tailing (ST-176)
 *
 * Provides real-time streaming of transcript files to WebSocket clients:
 * - File watching using chokidar for cross-platform reliability
 * - Position tracking for incremental reads
 * - Security: Path traversal protection with whitelist
 * - Security: Redaction of sensitive data before streaming
 * - Performance: Batching and debouncing
 * - Socket.IO rooms for targeted broadcasting
 *
 * @see ST-176: Real-Time Agent Transcript Streaming in Web GUI
 */

import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as readline from 'readline';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as chokidar from 'chokidar';
import { redactSensitiveData } from '../mcp/utils/content-security';
import { TelemetryService } from '../telemetry/telemetry.service';
import { Traced } from '../telemetry/traced.decorator';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { TranscriptsService } from './transcripts.service';

/**
 * Allowed base directories for transcript files (whitelist)
 */
const ALLOWED_TRANSCRIPT_DIRECTORIES = [
  '/Users/pawelgawliczek/.claude/projects',
  '/opt/stack/AIStudio',
];

@Injectable()
export class TranscriptTailService implements OnModuleDestroy {
  private readonly logger = new Logger(TranscriptTailService.name);

  /**
   * Active file watchers by componentRunId
   */
  private readonly watchers = new Map<string, chokidar.FSWatcher>();

  /**
   * Current read positions by componentRunId
   */
  private readonly positions = new Map<string, number>();

  /**
   * Sequence number trackers by componentRunId
   */
  private readonly sequenceNumbers = new Map<string, number>();

  constructor(
    private readonly webSocketGateway: AppWebSocketGateway,
    private readonly transcriptsService: TranscriptsService,
    private readonly telemetry: TelemetryService,
  ) {}

  /**
   * Start tailing a transcript file
   *
   * @param componentRunId - Component run identifier
   * @param transcriptPath - Absolute path to transcript file
   */
  @Traced('transcript_tail.start')
  async startTailing(
    componentRunId: string,
    transcriptPath: string,
  ): Promise<void> {
    // Prevent duplicate watchers
    if (this.watchers.has(componentRunId)) {
      this.logger.warn(
        `Watcher already exists for componentRunId: ${componentRunId}`,
      );
      return;
    }

    // Security: Validate path
    this.validateTranscriptPath(transcriptPath);

    try {
      // Initialize read position from current file size (start from end)
      const stats = await fs.stat(transcriptPath);
      this.positions.set(componentRunId, stats.size);
      this.sequenceNumbers.set(componentRunId, 0);

      // Setup chokidar watcher
      const watcher = chokidar.watch(transcriptPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200, // Wait 200ms for file to stabilize
          pollInterval: 100,
        },
      });

      // Register event handlers
      watcher.on('change', async () => {
        await this.handleFileChange(componentRunId, transcriptPath);
      });

      watcher.on('error', (error: unknown) => {
        this.handleWatcherError(componentRunId, error instanceof Error ? error : new Error(String(error)));
      });

      // Store watcher
      this.watchers.set(componentRunId, watcher);

      this.logger.log(
        `Started tailing transcript for componentRunId: ${componentRunId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to start tailing: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Stop tailing a transcript file
   *
   * @param componentRunId - Component run identifier
   */
  @Traced('transcript_tail.stop')
  async stopTailing(componentRunId: string): Promise<void> {
    const watcher = this.watchers.get(componentRunId);

    if (!watcher) {
      // Safe to call when not tailing
      return;
    }

    try {
      await watcher.close();
      this.watchers.delete(componentRunId);
      this.positions.delete(componentRunId);
      this.sequenceNumbers.delete(componentRunId);

      this.logger.log(
        `Stopped tailing transcript for componentRunId: ${componentRunId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error stopping tailing for ${componentRunId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Lifecycle: Close all watchers on service shutdown
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing all transcript watchers...');

    const closePromises = Array.from(this.watchers.keys()).map((componentRunId) =>
      this.stopTailing(componentRunId),
    );

    await Promise.all(closePromises);

    this.logger.log('All transcript watchers closed');
  }

  /**
   * Security: Validate transcript path against whitelist
   */
  private validateTranscriptPath(transcriptPath: string): void {
    // Check file extension
    if (!transcriptPath.endsWith('.jsonl')) {
      throw new Error('Invalid transcript file extension');
    }

    // Check for path traversal
    if (transcriptPath.includes('../') || transcriptPath.includes('..\\')) {
      throw new Error('Transcript path not in allowed directory');
    }

    // Check against whitelist
    const isAllowed = ALLOWED_TRANSCRIPT_DIRECTORIES.some((allowedDir) =>
      transcriptPath.startsWith(allowedDir),
    );

    if (!isAllowed) {
      throw new Error('Transcript path not in allowed directory');
    }
  }

  /**
   * Handle file change event - read new lines and emit to WebSocket
   */
  @Traced('transcript_tail.file_change')
  private async handleFileChange(
    componentRunId: string,
    transcriptPath: string,
  ): Promise<void> {
    try {
      const currentPosition = this.positions.get(componentRunId) ?? 0;

      // Check file size
      const stats = await fs.stat(transcriptPath);

      // Handle file truncation
      if (stats.size < currentPosition) {
        this.logger.warn(
          `File truncated for ${componentRunId}, resetting position`,
        );
        this.positions.set(componentRunId, 0);
        return;
      }

      // Read new lines from current position
      const newLines = await this.readNewLines(
        transcriptPath,
        currentPosition,
        stats.size,
      );

      if (newLines.length > 0) {
        // Update position
        this.positions.set(componentRunId, stats.size);

        // Emit new lines to WebSocket
        this.emitNewLines(componentRunId, newLines);
      }
    } catch (error) {
      this.logger.error(
        `Error handling file change for ${componentRunId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Read new lines from file starting at position
   */
  @Traced('transcript_tail.read_lines', { 'operation.type': 'file_io' })
  private async readNewLines(
    filePath: string,
    startPosition: number,
    endPosition: number,
  ): Promise<string[]> {
    const lines: string[] = [];

    return new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, {
        start: startPosition,
        end: endPosition - 1,
        encoding: 'utf8',
      });

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        if (line.trim()) {
          lines.push(line);
        }
      });

      rl.on('close', () => {
        // Add span attributes for file I/O metrics
        this.telemetry.addSpanAttributes({
          'bytes_read': endPosition - startPosition,
          'line_count': lines.length,
        });
        resolve(lines);
      });
      rl.on('error', reject);
    });
  }

  /**
   * Emit new lines to WebSocket clients (with redaction and sequencing)
   */
  private emitNewLines(componentRunId: string, lines: string[]): void {
    const server = this.webSocketGateway.getServer();
    const room = `transcript:${componentRunId}`;

    for (const line of lines) {
      // Apply redaction
      const { redactedContent } = redactSensitiveData(line);

      // Increment sequence number
      const currentSeq = this.sequenceNumbers.get(componentRunId) ?? 0;
      const sequenceNumber = currentSeq + 1;
      this.sequenceNumbers.set(componentRunId, sequenceNumber);

      // Emit to room (not global broadcast)
      server.to(room).emit('transcript:line', {
        componentRunId,
        line: redactedContent,
        sequenceNumber,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle watcher error - cleanup and emit error event
   */
  private handleWatcherError(componentRunId: string, error: Error): void {
    this.logger.error(
      `Watcher error for ${componentRunId}: ${error.message}`,
      error.stack,
    );

    // Emit error to WebSocket
    const server = this.webSocketGateway.getServer();
    const room = `transcript:${componentRunId}`;

    server.to(room).emit('transcript:error', {
      componentRunId,
      message: 'Failed to stream transcript',
      code: 'STREAM_ERROR',
    });

    // Cleanup
    this.stopTailing(componentRunId).catch((err) => {
      this.logger.error(`Error during cleanup: ${err.message}`);
    });
  }
}
