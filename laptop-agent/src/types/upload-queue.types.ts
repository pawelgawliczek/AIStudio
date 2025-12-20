/**
 * Type definitions for UploadQueue (ST-320)
 *
 * These types define the structure of the persistent queue system
 * for guaranteed delivery of artifacts and transcripts.
 */

/**
 * Queue item status lifecycle:
 * pending -> sent -> acked
 *           |
 *           +-> failed (after max retries)
 */
export type QueueStatus = 'pending' | 'sent' | 'acked' | 'failed';

/**
 * Queue item types
 */
export type QueueItemType = 'artifact:upload' | 'transcript:upload';

/**
 * Core queue item structure
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueueItem<T = any> {
  id: number;
  type: QueueItemType | string;
  payload: T;
  status: QueueStatus;
  contentHash: string;
  createdAt: Date;
  sentAt: Date | null;
  ackedAt: Date | null;
  retryCount: number;
  errorMessage?: string;
}

/**
 * Input for enqueuing new items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface EnqueueInput<T = any> {
  type: QueueItemType | string;
  payload: T;
}

/**
 * Options for getPendingItems
 */
export interface GetPendingItemsOptions {
  limit?: number;
  type?: QueueItemType | string;
}

/**
 * Options for getSentItems (ST-345)
 */
export interface GetSentItemsOptions {
  limit?: number;
  type?: QueueItemType | string;
}

/**
 * Options for cleanupAcked
 */
export interface CleanupAckedOptions {
  olderThanDays?: number;
}

/**
 * Options for requeueStuckItems
 */
export interface RequeueStuckItemsOptions {
  timeoutSeconds?: number;
  maxRetries?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  sent: number;
  acked: number;
  total: number;
  /** Maximum allowed items in queue (ST-346) */
  limit: number;
  /** Percentage of capacity used by active items (pending + sent) (ST-346) */
  usagePercent: number;
  byType?: Record<string, number>;
}

/**
 * Queue statistics options
 */
export interface GetStatsOptions {
  includeTypes?: boolean;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  maxItems?: number;
  defaultRetryTimeout?: number;
  maxRetries?: number;
}

/**
 * Database column info
 */
export interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dflt_value: any; // SQLite default values can be various types
  pk: boolean;
}

/**
 * Database index info
 */
export interface IndexInfo {
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
}

/**
 * Custom error for queue full condition
 */
export class QueueFullError extends Error {
  code = 'QUEUE_FULL';

  constructor(maxItems: number) {
    super(`Queue is full (max ${maxItems} items)`);
    this.name = 'QueueFullError';
  }
}

/**
 * Custom error for invalid database path
 */
export class InvalidDatabasePathError extends Error {
  constructor(path: string) {
    super(`Invalid database path: ${path}`);
    this.name = 'InvalidDatabasePathError';
  }
}

/**
 * Custom error for corrupted database
 */
export class DatabaseCorruptedError extends Error {
  constructor(message?: string) {
    super(message || 'Database corrupted');
    this.name = 'DatabaseCorruptedError';
  }
}
