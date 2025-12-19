/**
 * UploadQueue - Persistent SQLite Queue for Guaranteed Delivery (ST-320)
 *
 * STUB IMPLEMENTATION - Tests will fail until this is fully implemented.
 *
 * This file is a placeholder to make TypeScript compilation succeed.
 * Actual implementation will be done in the Implementation phase.
 */

export * from './types/upload-queue.types';

import {
  QueueItem,
  EnqueueInput,
  GetPendingItemsOptions,
  CleanupAckedOptions,
  RequeueStuckItemsOptions,
  QueueStats,
  GetStatsOptions,
  QueueConfig,
  ColumnInfo,
  IndexInfo,
} from './types/upload-queue.types';

/**
 * UploadQueue class - STUB
 */
export class UploadQueue {
  constructor(dbPath?: string, config?: QueueConfig) {
    throw new Error('Not implemented');
  }

  async close(): Promise<void> {
    throw new Error('Not implemented');
  }

  async getTables(): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    throw new Error('Not implemented');
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    throw new Error('Not implemented');
  }

  async enqueue<T = any>(input: EnqueueInput<T>): Promise<QueueItem<T>> {
    throw new Error('Not implemented');
  }

  async getItem(id: number): Promise<QueueItem | null> {
    throw new Error('Not implemented');
  }

  async getPendingItems(options?: GetPendingItemsOptions): Promise<QueueItem[]> {
    throw new Error('Not implemented');
  }

  async markSent(id: number): Promise<void> {
    throw new Error('Not implemented');
  }

  async markAcked(id: number): Promise<void> {
    throw new Error('Not implemented');
  }

  async markAckedBatch(ids: number[]): Promise<number> {
    throw new Error('Not implemented');
  }

  async cleanupAcked(options?: CleanupAckedOptions): Promise<number> {
    throw new Error('Not implemented');
  }

  async getStats(options?: GetStatsOptions): Promise<QueueStats> {
    throw new Error('Not implemented');
  }

  async incrementRetryCount(id: number): Promise<void> {
    throw new Error('Not implemented');
  }

  async requeueStuckItems(options?: RequeueStuckItemsOptions): Promise<number> {
    throw new Error('Not implemented');
  }

  async markFailed(id: number, errorMessage: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async updateAckedAt(id: number, date: Date): Promise<void> {
    throw new Error('Not implemented');
  }

  async updateSentAt(id: number, date: Date): Promise<void> {
    throw new Error('Not implemented');
  }

  async updateCreatedAt(id: number, date: Date): Promise<void> {
    throw new Error('Not implemented');
  }

  async executeRaw(sql: string, params: any[]): Promise<void> {
    throw new Error('Not implemented');
  }

  getMaxItems(): number {
    throw new Error('Not implemented');
  }

  async getQueryPlan(sql: string): Promise<string> {
    throw new Error('Not implemented');
  }
}
