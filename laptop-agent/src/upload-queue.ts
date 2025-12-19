/**
 * UploadQueue - Persistent SQLite Queue for Guaranteed Delivery (ST-320)
 *
 * Provides a reliable queue system for uploading artifacts and transcripts
 * with guaranteed delivery through persistent storage and retry mechanisms.
 */

export * from './types/upload-queue.types';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import {
  QueueItem,
  QueueStatus,
  EnqueueInput,
  GetPendingItemsOptions,
  CleanupAckedOptions,
  RequeueStuckItemsOptions,
  QueueStats,
  GetStatsOptions,
  QueueConfig,
  ColumnInfo,
  IndexInfo,
  QueueFullError,
  InvalidDatabasePathError,
  DatabaseCorruptedError,
} from './types/upload-queue.types';

interface DbQueueItem {
  id: number;
  type: string;
  payload: string;
  status: QueueStatus;
  contentHash: string;
  createdAt: string;
  sentAt: string | null;
  ackedAt: string | null;
  retryCount: number;
  errorMessage?: string;
}

/**
 * UploadQueue class
 */
export class UploadQueue {
  private db: Database.Database;
  private dbPath: string;
  private config: Required<QueueConfig>;

  constructor(dbPath?: string, config?: QueueConfig) {
    // Set default config
    this.config = {
      maxItems: config?.maxItems ?? 10000,
      defaultRetryTimeout: config?.defaultRetryTimeout ?? 30,
      maxRetries: config?.maxRetries ?? 5,
    };

    // Determine database path
    if (dbPath) {
      // Validate path for security
      this.validateDatabasePath(dbPath);
      this.dbPath = dbPath;
    } else {
      // Default: ~/.vibestudio/upload-queue.db
      const vibestudioDir = path.join(os.homedir(), '.vibestudio');
      if (!fs.existsSync(vibestudioDir)) {
        fs.mkdirSync(vibestudioDir, { recursive: true });
      }
      this.dbPath = path.join(vibestudioDir, 'upload-queue.db');
    }

    // Initialize database
    try {
      this.db = new Database(this.dbPath);
      this.initializeSchema();
    } catch (error) {
      if (error instanceof Error && error.message.includes('file is not a database')) {
        throw new DatabaseCorruptedError('Database corrupted');
      }
      throw error;
    }
  }

  private validateDatabasePath(filePath: string): void {
    // Prevent path traversal attacks
    const normalized = path.normalize(filePath);
    if (normalized.includes('..')) {
      throw new InvalidDatabasePathError(filePath);
    }

    // Additional security checks
    const forbidden = ['/etc', '/sys', '/proc', '/dev'];
    for (const forbiddenPath of forbidden) {
      if (normalized.startsWith(forbiddenPath)) {
        throw new InvalidDatabasePathError(filePath);
      }
    }
  }

  private initializeSchema(): void {
    // Create upload_queue table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS upload_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        contentHash TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        sentAt DATETIME,
        ackedAt DATETIME,
        retryCount INTEGER NOT NULL DEFAULT 0,
        errorMessage TEXT
      )
    `);

    // Create metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queue_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_status ON upload_queue(status)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_contentHash ON upload_queue(contentHash)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_createdAt ON upload_queue(createdAt)
    `);
  }

  async close(): Promise<void> {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }

  async getTables(): Promise<string[]> {
    const result = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as { name: string }[];

    return result.map(r => r.name);
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    const result = this.db.pragma(`table_info(${tableName})`) as ColumnInfo[];
    return result;
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const result = this.db.prepare(`
      SELECT name, "unique", origin, partial
      FROM pragma_index_list(?)
    `).all(tableName) as IndexInfo[];

    return result;
  }

  private calculateContentHash(type: string, payload: unknown): string {
    const content = JSON.stringify({ type, payload });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async enqueue<T = unknown>(input: EnqueueInput<T>): Promise<QueueItem<T>> {
    // Validation
    if (!input.type || input.type.trim() === '') {
      throw new Error('type is required');
    }

    if (!input.payload || typeof input.payload !== 'object') {
      throw new Error('payload must be an object');
    }

    // Check queue size limit
    const stats = await this.getStats();
    const activeCount = stats.total - stats.acked;
    if (activeCount >= this.config.maxItems) {
      throw new QueueFullError(this.config.maxItems);
    }

    // Calculate content hash for deduplication
    const contentHash = this.calculateContentHash(input.type, input.payload);

    // Check for duplicates (only in non-acked items)
    const duplicate = this.db.prepare(`
      SELECT id FROM upload_queue
      WHERE contentHash = ? AND status != 'acked'
    `).get(contentHash);

    if (duplicate) {
      throw new Error('Duplicate content already in queue');
    }

    // Insert item
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(input.payload);

    const result = this.db.prepare(`
      INSERT INTO upload_queue (type, payload, status, contentHash, createdAt, retryCount)
      VALUES (?, ?, 'pending', ?, ?, 0)
    `).run(input.type, payloadJson, contentHash, now);

    // Fetch and return the created item
    const item = await this.getItem(result.lastInsertRowid as number);
    return item as QueueItem<T>;
  }

  async getItem(id: number): Promise<QueueItem | null> {
    const row = this.db.prepare(`
      SELECT * FROM upload_queue WHERE id = ?
    `).get(id) as DbQueueItem | undefined;

    if (!row) {
      return null;
    }

    return this.deserializeItem(row);
  }

  private deserializeItem(row: DbQueueItem): QueueItem {
    let payload;
    try {
      payload = JSON.parse(row.payload);
    } catch (error) {
      throw new Error('Invalid JSON in payload');
    }

    return {
      id: row.id,
      type: row.type,
      payload,
      status: row.status,
      contentHash: row.contentHash,
      createdAt: new Date(row.createdAt),
      sentAt: row.sentAt ? new Date(row.sentAt) : null,
      ackedAt: row.ackedAt ? new Date(row.ackedAt) : null,
      retryCount: row.retryCount,
      errorMessage: row.errorMessage,
    };
  }

  async getPendingItems(options?: GetPendingItemsOptions): Promise<QueueItem[]> {
    const limit = options?.limit;
    const type = options?.type;

    let query = `
      SELECT * FROM upload_queue
      WHERE status = 'pending'
    `;

    const params: unknown[] = [];

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    query += ` ORDER BY createdAt ASC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    const rows = this.db.prepare(query).all(...params) as DbQueueItem[];

    return rows.map(row => this.deserializeItem(row));
  }

  async markSent(id: number): Promise<void> {
    const item = await this.getItem(id);

    if (!item) {
      throw new Error('Item not found');
    }

    if (item.status === 'acked') {
      throw new Error('Cannot mark acked item as sent');
    }

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE upload_queue
      SET status = 'sent', sentAt = ?
      WHERE id = ?
    `).run(now, id);
  }

  async markAcked(id: number): Promise<void> {
    const item = await this.getItem(id);

    if (!item) {
      throw new Error('Item not found');
    }

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE upload_queue
      SET status = 'acked', ackedAt = ?
      WHERE id = ?
    `).run(now, id);
  }

  async markAckedBatch(ids: number[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const transaction = this.db.transaction(() => {
      const now = new Date().toISOString();
      let count = 0;

      for (const id of ids) {
        const result = this.db.prepare(`
          UPDATE upload_queue
          SET status = 'acked', ackedAt = ?
          WHERE id = ?
        `).run(now, id);

        count += result.changes;
      }

      return count;
    });

    return transaction();
  }

  async cleanupAcked(options?: CleanupAckedOptions): Promise<number> {
    const olderThanDays = options?.olderThanDays ?? 7;

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - olderThanDays);
    const thresholdIso = thresholdDate.toISOString();

    const result = this.db.prepare(`
      DELETE FROM upload_queue
      WHERE status = 'acked' AND ackedAt <= ?
    `).run(thresholdIso);

    return result.changes;
  }

  async getStats(options?: GetStatsOptions): Promise<QueueStats> {
    const statusCounts = this.db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM upload_queue
      GROUP BY status
    `).all() as { status: QueueStatus; count: number }[];

    const stats: QueueStats = {
      pending: 0,
      sent: 0,
      acked: 0,
      total: 0,
    };

    for (const row of statusCounts) {
      if (row.status === 'pending') stats.pending = row.count;
      if (row.status === 'sent') stats.sent = row.count;
      if (row.status === 'acked') stats.acked = row.count;
      stats.total += row.count;
    }

    if (options?.includeTypes) {
      const typeCounts = this.db.prepare(`
        SELECT
          type,
          COUNT(*) as count
        FROM upload_queue
        GROUP BY type
      `).all() as { type: string; count: number }[];

      stats.byType = {};
      for (const row of typeCounts) {
        stats.byType[row.type] = row.count;
      }
    }

    return stats;
  }

  async incrementRetryCount(id: number): Promise<void> {
    this.db.prepare(`
      UPDATE upload_queue
      SET retryCount = retryCount + 1
      WHERE id = ?
    `).run(id);
  }

  async requeueStuckItems(options?: RequeueStuckItemsOptions): Promise<number> {
    const timeoutSeconds = options?.timeoutSeconds ?? 30;
    const maxRetries = options?.maxRetries ?? this.config.maxRetries;

    const thresholdDate = new Date();
    thresholdDate.setSeconds(thresholdDate.getSeconds() - timeoutSeconds);
    const thresholdIso = thresholdDate.toISOString();

    const result = this.db.prepare(`
      UPDATE upload_queue
      SET status = 'pending', retryCount = retryCount + 1
      WHERE status = 'sent'
        AND sentAt < ?
        AND retryCount < ?
    `).run(thresholdIso, maxRetries);

    return result.changes;
  }

  async markFailed(id: number, errorMessage: string): Promise<void> {
    this.db.prepare(`
      UPDATE upload_queue
      SET status = 'failed', errorMessage = ?
      WHERE id = ?
    `).run(errorMessage, id);
  }

  async updateAckedAt(id: number, date: Date): Promise<void> {
    this.db.prepare(`
      UPDATE upload_queue
      SET ackedAt = ?
      WHERE id = ?
    `).run(date.toISOString(), id);
  }

  async updateSentAt(id: number, date: Date): Promise<void> {
    this.db.prepare(`
      UPDATE upload_queue
      SET sentAt = ?
      WHERE id = ?
    `).run(date.toISOString(), id);
  }

  async updateCreatedAt(id: number, date: Date): Promise<void> {
    this.db.prepare(`
      UPDATE upload_queue
      SET createdAt = ?
      WHERE id = ?
    `).run(date.toISOString(), id);
  }

  async executeRaw(sql: string, params: unknown[]): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  getMaxItems(): number {
    return this.config.maxItems;
  }

  async getQueryPlan(sql: string): Promise<string> {
    // Note: EXPLAIN QUERY PLAN doesn't support parameters, so we execute without them
    const result = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{
      id?: number;
      parent?: number;
      notused?: number;
      detail: string;
    }>;

    return result.map(r => r.detail).join(' ');
  }
}
