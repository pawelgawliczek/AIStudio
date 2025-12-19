/**
 * ST-321: UploadManager - Orchestration for guaranteed delivery
 *
 * Manages the upload queue and flush loop for artifacts and transcripts.
 * Provides a simple interface for watchers to queue items for upload.
 *
 * Features:
 * - Automatic flush every 500ms
 * - Batch processing (50 items per flush)
 * - Reconnect handling (flush on socket connect)
 * - Daily cleanup of acked items
 * - Queue statistics
 */

import { Socket } from 'socket.io-client';
import { Logger } from './logger';
import { UploadQueue, QueueStats } from './upload-queue';

export interface UploadManagerOptions {
  socket: Socket;
  agentId: string;
  dbPath?: string;
  flushIntervalMs?: number;
  batchSize?: number;
  cleanupIntervalHours?: number;
}

/**
 * UploadManager orchestrates the queue and flush loop
 */
export class UploadManager {
  private readonly logger = new Logger('UploadManager');
  private readonly socket: Socket;
  private readonly agentId: string;
  private readonly queue: UploadQueue;
  private readonly flushIntervalMs: number;
  private readonly batchSize: number;
  private readonly cleanupIntervalHours: number;

  private flushTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stuckItemTimer: NodeJS.Timeout | null = null;
  private statsTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private isFlushing: boolean = false;

  constructor(options: UploadManagerOptions) {
    this.socket = options.socket;
    this.agentId = options.agentId;
    this.flushIntervalMs = options.flushIntervalMs ?? 500;
    this.batchSize = options.batchSize ?? 50;
    this.cleanupIntervalHours = options.cleanupIntervalHours ?? 24;

    // Create queue
    this.queue = new UploadQueue(options.dbPath);

    // Track connection state
    this.isConnected = this.socket.connected;

    // Setup socket event handlers
    this.setupSocketHandlers();

    // Start flush loop
    this.startFlushLoop();

    // Start cleanup loop
    this.startCleanupLoop();

    // Start stuck item monitor
    this.startStuckItemMonitor();

    // Start stats logging
    this.startStatsLogging();

    this.logger.info('UploadManager initialized', {
      flushIntervalMs: this.flushIntervalMs,
      batchSize: this.batchSize,
      cleanupIntervalHours: this.cleanupIntervalHours,
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupSocketHandlers(): void {
    this.socket.on('connect', () => {
      this.logger.info('Socket connected, triggering flush');
      this.isConnected = true;
      // Flush immediately on reconnect
      this.flush().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Flush on reconnect failed', { error: message });
      });
    });

    this.socket.on('disconnect', () => {
      this.logger.info('Socket disconnected');
      this.isConnected = false;
    });

    // Handle individual item acknowledgements from server
    this.socket.on('upload:ack:item', (data: { success: boolean; id: number; isDuplicate?: boolean; error?: string }) => {
      this.handleItemAcknowledgement(data).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to handle item acknowledgement', { error: message });
      });
    });

    // Handle batch acknowledgements from server
    this.socket.on('upload:ack', (data: { ids: number[] }) => {
      this.handleAcknowledgement(data.ids).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to handle acknowledgement', { error: message });
      });
    });
  }

  /**
   * Queue an item for upload
   * Called by watchers (transcript watcher, artifact watcher, etc.)
   */
  async queueUpload<T = unknown>(type: string, payload: T): Promise<void> {
    try {
      await this.queue.enqueue({ type, payload });
      this.logger.debug('Item queued', { type });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to queue item', { type, error: message });
      throw error;
    }
  }

  /**
   * Start the flush loop
   */
  private startFlushLoop(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Flush loop error', { error: message });
      });
    }, this.flushIntervalMs);
  }

  /**
   * Flush pending items to server
   */
  private async flush(): Promise<void> {
    // Skip if already flushing
    if (this.isFlushing) {
      this.logger.debug('Flush already in progress, skipping');
      return;
    }

    // Skip if not connected
    if (!this.isConnected) {
      this.logger.debug('Not connected, skipping flush');
      return;
    }

    this.isFlushing = true;

    try {
      // Get pending items (batch size limit)
      const items = await this.queue.getPendingItems({ limit: this.batchSize });

      if (items.length === 0) {
        this.logger.debug('No pending items to flush');
        return;
      }

      this.logger.info('Flushing items', { count: items.length });

      // ST-327: Group items by type for type-based routing
      const artifactItems = items.filter(item => item.type === 'artifact:upload');
      const transcriptItems = items.filter(item => item.type !== 'artifact:upload');

      // Send artifacts to artifact:upload endpoint
      if (artifactItems.length > 0) {
        this.logger.info('Sending artifact items', { count: artifactItems.length });
        this.socket.emit('artifact:upload', {
          agentId: this.agentId,
          items: artifactItems.map(item => ({
            ...item.payload,
            queueId: item.id,
          })),
        });
      }

      // Send transcripts to upload:batch endpoint (existing behavior)
      if (transcriptItems.length > 0) {
        this.logger.info('Sending transcript items', { count: transcriptItems.length });
        this.socket.emit('upload:batch', {
          agentId: this.agentId,
          items: transcriptItems.map(item => ({
            ...item.payload,
            queueId: item.id,
          })),
        });
      }

      // Mark as sent
      for (const item of items) {
        await this.queue.markSent(item.id);
      }

      this.logger.info('Flush completed', { count: items.length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Flush failed', { error: message });
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Handle individual item acknowledgement from server
   * ST-323: Process individual ACKs and mark items as acked regardless of success/failure
   */
  private async handleItemAcknowledgement(data: { success: boolean; id: number; isDuplicate?: boolean; error?: string }): Promise<void> {
    this.logger.info('Received item acknowledgement', { id: data.id, success: data.success, isDuplicate: data.isDuplicate, error: data.error });

    try {
      // Mark item as acked regardless of success/failure to prevent infinite retries
      await this.queue.markAcked(data.id);
      this.logger.info('Item marked as acked', { id: data.id });

      // ST-322: Emit queue:acked event for UI
      this.socket.emit('queue:acked', {
        ids: [data.id],
        count: 1,
        timestamp: Date.now(),
      });

      // ST-322: Emit queue:stats event for monitoring
      const stats = await this.queue.getStats({ includeTypes: true });
      this.socket.emit('queue:stats', stats);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to mark item as acked', { id: data.id, error: message });
    }
  }

  /**
   * Handle batch acknowledgement from server
   * ST-322: Emit queue:acked and queue:stats events for UI
   */
  private async handleAcknowledgement(ids: number[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    this.logger.info('Received batch acknowledgement', { count: ids.length });

    try {
      const count = await this.queue.markAckedBatch(ids);
      this.logger.info('Items marked as acked', { count });

      // ST-322: Emit queue:acked event for UI
      this.socket.emit('queue:acked', {
        ids,
        count,
        timestamp: Date.now(),
      });

      // ST-322: Emit queue:stats event for monitoring
      const stats = await this.queue.getStats({ includeTypes: true });
      this.socket.emit('queue:stats', stats);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to mark items as acked', { error: message });
    }
  }

  /**
   * Start daily cleanup of acked items
   */
  private startCleanupLoop(): void {
    const intervalMs = this.cleanupIntervalHours * 60 * 60 * 1000;

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Cleanup loop error', { error: message });
      });
    }, intervalMs);

    // Run cleanup immediately on startup
    this.cleanup().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Initial cleanup error', { error: message });
    });
  }

  /**
   * Cleanup old acked items
   */
  private async cleanup(): Promise<void> {
    this.logger.info('Running cleanup of acked items');

    try {
      const deleted = await this.queue.cleanupAcked({ olderThanDays: 7 });
      this.logger.info('Cleanup completed', { deleted });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Cleanup failed', { error: message });
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    return this.queue.getStats({ includeTypes: true });
  }

  /**
   * Start stuck item monitor
   * Requeues items that have been in 'sent' state for too long
   */
  private startStuckItemMonitor(): void {
    this.stuckItemTimer = setInterval(async () => {
      try {
        const stats = await this.queue.getStats();
        if (stats.sent > 0) {
          const requeued = await this.queue.requeueStuckItems({
            timeoutSeconds: 30,
            maxRetries: 5,
          });
          if (requeued > 0) {
            this.logger.warn('Requeued stuck items', {
              count: requeued,
              previousSentCount: stats.sent,
            });
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Stuck item monitor failed', { error: message });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start periodic stats logging
   * Logs queue statistics every 60 seconds for monitoring
   */
  private startStatsLogging(): void {
    this.statsTimer = setInterval(async () => {
      try {
        const stats = await this.queue.getStats({ includeTypes: true });
        this.logger.info('Queue stats', {
          pending: stats.pending,
          sent: stats.sent,
          acked: stats.acked,
          total: stats.total,
          byType: stats.byType,
        });
      } catch (error: unknown) {
        // Silent - stats logging shouldn't crash
      }
    }, 60000); // Every 60 seconds
  }

  /**
   * Stop stuck item monitor
   */
  private stopStuckItemMonitor(): void {
    if (this.stuckItemTimer) {
      clearInterval(this.stuckItemTimer);
      this.stuckItemTimer = null;
    }
  }

  /**
   * Stop stats logging timer
   */
  private stopStatsLogging(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  /**
   * Stop the manager and cleanup
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping UploadManager');

    // Stop timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.stopStuckItemMonitor();
    this.stopStatsLogging();

    // Close queue
    await this.queue.close();

    this.logger.info('UploadManager stopped');
  }
}
