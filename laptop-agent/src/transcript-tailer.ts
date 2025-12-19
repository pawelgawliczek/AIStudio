/**
 * ST-182: Transcript Tailer - Live Streaming of Transcript Files
 *
 * Streams transcript file content to backend in real-time.
 * Used for live master session viewing in the web UI.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as chokidar from 'chokidar';
import { Socket } from 'socket.io-client';
import { Logger } from './logger';
import { UploadManager } from './upload-manager';

export interface TailSession {
  filePath: string;
  watcher: chokidar.FSWatcher;
  position: number;
  sequenceNumber: number;
  runId: string;
  sessionIndex: number; // 0 for initial, 1+ for compacted sessions
}

export interface TailRequest {
  runId: string;
  filePath: string;
  sessionIndex: number;
  fromBeginning?: boolean; // If true, stream from start; otherwise tail from end
}

export class TranscriptTailer {
  private readonly logger = new Logger('TranscriptTailer');
  private socket: Socket;
  private uploadManager: UploadManager | null;
  private readonly sessions = new Map<string, TailSession>(); // key: `${runId}:${sessionIndex}`

  constructor(socket: Socket, uploadManager?: UploadManager) {
    this.socket = socket;
    this.uploadManager = uploadManager || null;
  }

  /**
   * ST-182: Update socket reference after reconnection
   * Without this, the tailer would emit to the old disconnected socket
   * Also re-emits streaming_started for all active sessions since the original
   * emit may have been lost during the disconnect
   */
  async updateSocket(newSocket: Socket): Promise<void> {
    this.socket = newSocket;
    this.logger.info('Socket reference updated for TranscriptTailer');

    // Re-emit streaming_started for all active sessions
    // This handles the case where the socket disconnected right after starting to tail
    for (const [sessionKey, session] of this.sessions) {
      try {
        const stats = await fs.promises.stat(session.filePath);
        this.logger.info('Re-emitting streaming_started after reconnect', { sessionKey });

        this.socket.emit('transcript:streaming_started', {
          runId: session.runId,
          sessionIndex: session.sessionIndex,
          filePath: session.filePath,
          fileSize: stats.size,
          startPosition: session.position,
        });
      } catch (error: any) {
        this.logger.error('Failed to re-emit streaming_started', { sessionKey, error: error.message });
      }
    }
  }

  /**
   * Start tailing a transcript file
   */
  async startTailing(request: TailRequest): Promise<void> {
    const sessionKey = `${request.runId}:${request.sessionIndex}`;

    // Handle duplicate sessions - emit streaming_started for new frontend clients
    // This happens when frontend reconnects (page refresh, etc.) but session still exists
    const existingSession = this.sessions.get(sessionKey);
    if (existingSession) {
      this.logger.info('Tail session already exists, notifying new client', { sessionKey });

      // Get current file size
      try {
        const stats = await fs.promises.stat(existingSession.filePath);

        // Re-emit streaming_started for the new frontend client
        this.socket.emit('transcript:streaming_started', {
          runId: request.runId,
          sessionIndex: request.sessionIndex,
          filePath: existingSession.filePath,
          fileSize: stats.size,
          startPosition: existingSession.position,
        });

        // If frontend wants from beginning, send existing content
        if (request.fromBeginning && existingSession.position > 0) {
          await this.streamExistingContent(request, 0, existingSession.position);
        }
      } catch (error: any) {
        this.logger.error('Error handling duplicate session', { sessionKey, error: error.message });
      }
      return;
    }

    // Validate file path
    if (!this.isValidTranscriptPath(request.filePath)) {
      this.logger.error('Invalid transcript path', { filePath: request.filePath });
      this.socket.emit('transcript:error', {
        runId: request.runId,
        sessionIndex: request.sessionIndex,
        error: 'Invalid transcript path',
        code: 'INVALID_PATH',
      });
      return;
    }

    try {
      // Check if file exists
      const stats = await fs.promises.stat(request.filePath);

      // Determine starting position
      const startPosition = request.fromBeginning ? 0 : stats.size;

      // If streaming from beginning, send existing content first
      if (request.fromBeginning && stats.size > 0) {
        await this.streamExistingContent(request, 0, stats.size);
      }

      // Setup chokidar watcher for new content
      const watcher = chokidar.watch(request.filePath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100, // Faster response for live streaming
          pollInterval: 50,
        },
      });

      const session: TailSession = {
        filePath: request.filePath,
        watcher,
        position: startPosition,
        sequenceNumber: 0,
        runId: request.runId,
        sessionIndex: request.sessionIndex,
      };

      // Handle file changes
      watcher.on('change', async () => {
        await this.handleFileChange(session);
      });

      watcher.on('error', (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error('Watcher error', { sessionKey, error: error.message });
        this.socket.emit('transcript:error', {
          runId: request.runId,
          sessionIndex: request.sessionIndex,
          error: error.message,
          code: 'WATCH_ERROR',
        });
      });

      this.sessions.set(sessionKey, session);

      // Notify backend that streaming started
      this.socket.emit('transcript:streaming_started', {
        runId: request.runId,
        sessionIndex: request.sessionIndex,
        filePath: request.filePath,
        fileSize: stats.size,
        startPosition,
      });

      this.logger.info('Started tailing transcript', { sessionKey, filePath: request.filePath });
    } catch (error: any) {
      this.logger.error('Failed to start tailing', { sessionKey, error: error.message });
      this.socket.emit('transcript:error', {
        runId: request.runId,
        sessionIndex: request.sessionIndex,
        error: error.message,
        code: 'START_FAILED',
      });
    }
  }

  /**
   * Stop tailing a transcript file
   */
  async stopTailing(runId: string, sessionIndex: number): Promise<void> {
    const sessionKey = `${runId}:${sessionIndex}`;
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return; // Already stopped or never started
    }

    try {
      await session.watcher.close();
      this.sessions.delete(sessionKey);

      this.socket.emit('transcript:streaming_stopped', {
        runId,
        sessionIndex,
      });

      this.logger.info('Stopped tailing transcript', { sessionKey });
    } catch (error: any) {
      this.logger.error('Error stopping tail session', { sessionKey, error: error.message });
    }
  }

  /**
   * Stop all active tail sessions
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.sessions.entries()).map(([key, session]) =>
      this.stopTailing(session.runId, session.sessionIndex)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Stream existing content from a file
   */
  private async streamExistingContent(
    request: TailRequest,
    startPosition: number,
    endPosition: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(request.filePath, {
        start: startPosition,
        end: endPosition - 1,
        encoding: 'utf8',
      });

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      let sequenceNumber = 0;
      const lines: Array<{ line: string; sequenceNumber: number }> = [];

      rl.on('line', (line) => {
        if (line.trim()) {
          sequenceNumber++;
          lines.push({ line, sequenceNumber });
        }
      });

      rl.on('close', () => {
        // Emit lines in batches for efficiency
        if (lines.length > 0) {
          const payload = {
            runId: request.runId,
            sessionIndex: request.sessionIndex,
            lines,
            isHistorical: true,
            timestamp: new Date().toISOString(),
          };

          // Use UploadManager for guaranteed delivery if available
          if (this.uploadManager) {
            this.uploadManager.queueUpload('transcript_line', payload).catch((err: unknown) => {
              const error = err instanceof Error ? err : new Error(String(err));
              this.logger.error('Failed to queue transcript batch', { error: error.message });
            });
          } else {
            // Fallback to direct socket emit
            this.socket.emit('transcript:batch', payload);
          }
        }
        resolve();
      });

      rl.on('error', reject);
    });
  }

  /**
   * Handle file change - read and stream new lines
   */
  private async handleFileChange(session: TailSession): Promise<void> {
    try {
      const stats = await fs.promises.stat(session.filePath);

      // Handle file truncation
      if (stats.size < session.position) {
        this.logger.warn('File truncated, resetting position', {
          filePath: session.filePath,
          oldPosition: session.position,
          newSize: stats.size,
        });
        session.position = 0;
        return;
      }

      // No new content
      if (stats.size === session.position) {
        return;
      }

      // Read new content
      const newLines = await this.readNewLines(session.filePath, session.position, stats.size);

      if (newLines.length > 0) {
        // Update position
        session.position = stats.size;

        // Emit new lines with sequence numbers
        const linesWithSeq = newLines.map((line) => {
          session.sequenceNumber++;
          return { line, sequenceNumber: session.sequenceNumber };
        });

        const payload = {
          runId: session.runId,
          sessionIndex: session.sessionIndex,
          lines: linesWithSeq,
          isHistorical: false,
          timestamp: new Date().toISOString(),
        };

        // Log the queued lines
        this.logger.debug('Lines queued', {
          runId: session.runId,
          sessionIndex: session.sessionIndex,
          lineCount: linesWithSeq.length,
          sequenceRange: `${linesWithSeq[0]?.sequenceNumber}-${linesWithSeq[linesWithSeq.length - 1]?.sequenceNumber}`,
        });

        // Use UploadManager for guaranteed delivery if available
        if (this.uploadManager) {
          this.uploadManager.queueUpload('transcript_line', payload).catch((err: unknown) => {
            const error = err instanceof Error ? err : new Error(String(err));
            this.logger.error('Failed to queue transcript lines', {
              runId: session.runId,
              sessionIndex: session.sessionIndex,
              error: error.message,
            });
          });
        } else {
          // Fallback to direct socket emit
          this.socket.emit('transcript:lines', payload);
        }
      }
    } catch (error: any) {
      this.logger.error('Error handling file change', {
        filePath: session.filePath,
        error: error.message,
      });
    }
  }

  /**
   * Read new lines from file
   */
  private readNewLines(filePath: string, startPosition: number, endPosition: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];

      const stream = fs.createReadStream(filePath, {
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

      rl.on('close', () => resolve(lines));
      rl.on('error', reject);
    });
  }

  /**
   * Validate transcript path for security
   */
  private isValidTranscriptPath(filePath: string): boolean {
    // Must be a .jsonl file
    if (!filePath.endsWith('.jsonl')) {
      return false;
    }

    // No path traversal
    if (filePath.includes('../') || filePath.includes('..\\')) {
      return false;
    }

    // Must be in allowed directories
    const allowedPaths = [
      process.env.HOME + '/.claude/projects',
      '/Users/', // macOS user directories
    ];

    return allowedPaths.some((allowed) => filePath.startsWith(allowed));
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}
