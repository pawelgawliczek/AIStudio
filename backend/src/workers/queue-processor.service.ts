/**
 * Queue Processor Service - Background worker for automated test queue processing
 *
 * This service runs as a scheduled task (every 60 seconds) to:
 * 1. Poll TestQueue for pending items (priority DESC, createdAt ASC)
 * 2. Check queue lock status (skip if locked during migrations)
 * 3. Acquire distributed lock (ensures single worker instance)
 * 4. Execute automated tests
 * 5. Update queue entry status and results
 * 6. Unlock queue if breaking migration was applied
 *
 * Features:
 * - Distributed locking via Redis (prevents concurrent processing)
 * - Circuit breaker (pauses after 5 consecutive failures)
 * - Graceful error handling (continues to next item on failure)
 * - Health check metrics for monitoring
 */

import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from './constants';
import { McpToolClient } from './mcp-tool-client';

// ============================================================================
// Types and Interfaces
// ============================================================================

type TestQueueWithStory = Prisma.TestQueueGetPayload<{
  include: { story: { select: { key: true; title: true } } };
}>;

interface WorkerState {
  workerId: string;
  startedAt: Date;
  lastProcessedAt: Date | null;
  currentItemId: string | null;
  currentStoryKey: string | null;
  lockId: string | null;
  isProcessing: boolean;
  consecutiveFailures: number;
  metrics: {
    processedCount: number;
    failedCount: number;
    totalProcessingTime: number;
  };
  lastError: string | null;
  lastErrorAt: Date | null;
}

export interface QueueProcessorHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastProcessedAt: string | null;
  lastProcessedStoryKey: string | null;
  currentlyProcessing: boolean;
  currentStoryKey: string | null;
  queueDepth: {
    pending: number;
    running: number;
    total: number;
  };
  metrics: {
    processedCount: number;
    failedCount: number;
    successRate: number;
    avgProcessingTime: number;
  };
  lockStatus: {
    hasLock: boolean;
    lockId: string | null;
    lockAcquiredAt: string | null;
  };
  queueLockStatus: {
    locked: boolean;
    reason: string | null;
    expiresAt: string | null;
  };
  workerState: 'idle' | 'acquiring_lock' | 'checking_queue' | 'processing' | 'error';
  lastError: string | null;
  lastErrorAt: string | null;
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class QueueProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueProcessorService.name);
  private readonly mcpClient: McpToolClient;

  // Worker state
  private state: WorkerState;

  // Configuration
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly lockTTL: number;
  private readonly lockRenewalInterval: number;
  private readonly circuitBreakerThreshold: number = 5;

  // Redis client for distributed lock
  private redis: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.CODE_ANALYSIS) private readonly codeAnalysisQueue: Queue
  ) {
    // Initialize MCP client
    this.mcpClient = new McpToolClient(this.prisma, this.logger);

    // Load configuration
    this.enabled = this.config.get('QUEUE_PROCESSOR_ENABLED', 'true') === 'true';
    this.intervalMs = parseInt(this.config.get('QUEUE_PROCESSOR_INTERVAL_MS', '60000'), 10);
    this.timeoutMs = parseInt(this.config.get('QUEUE_PROCESSOR_TIMEOUT_MS', '1800000'), 10);
    this.lockTTL = parseInt(this.config.get('QUEUE_PROCESSOR_LOCK_TTL_MS', '90000'), 10);
    this.lockRenewalInterval = parseInt(
      this.config.get('QUEUE_PROCESSOR_LOCK_RENEWAL_MS', '15000'),
      10
    );

    // Initialize worker state
    this.state = {
      workerId: `worker-${process.pid}-${Date.now()}`,
      startedAt: new Date(),
      lastProcessedAt: null,
      currentItemId: null,
      currentStoryKey: null,
      lockId: null,
      isProcessing: false,
      consecutiveFailures: 0,
      metrics: {
        processedCount: 0,
        failedCount: 0,
        totalProcessingTime: 0,
      },
      lastError: null,
      lastErrorAt: null,
    };

    // Get Redis client from Bull queue
    this.redis = this.codeAnalysisQueue.client;
  }

  /**
   * Lifecycle: Module initialization
   */
  async onModuleInit(): Promise<void> {
    if (this.enabled) {
      this.logger.log(`Queue processor started (workerId: ${this.state.workerId})`);
      this.logger.log(`Configuration: interval=${this.intervalMs}ms, timeout=${this.timeoutMs}ms`);
    } else {
      this.logger.warn('Queue processor is DISABLED (QUEUE_PROCESSOR_ENABLED=false)');
    }
  }

  /**
   * Lifecycle: Module destruction
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Queue processor shutting down...');

    // Release lock if held
    if (this.state.lockId) {
      await this.releaseLock();
    }

    this.logger.log('Queue processor stopped');
  }

  /**
   * Main processing interval - runs every minute
   *
   * Flow:
   * 1. Check if already processing (skip if true)
   * 2. Acquire distributed lock (skip if locked by another worker)
   * 3. Check queue lock status (skip if migration in progress)
   * 4. Get next pending item (ordered by priority DESC, createdAt ASC)
   * 5. Process item (deploy + test)
   * 6. Release distributed lock
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'queue-processor-cron' })
  async processQueueInterval(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Prevent concurrent executions
    if (this.state.isProcessing) {
      this.logger.debug('Skipping interval - already processing');
      return;
    }

    try {
      this.state.isProcessing = true;

      // Acquire distributed lock
      const lockAcquired = await this.acquireDistributedLock();
      if (!lockAcquired) {
        this.logger.debug('Skipping interval - another worker has lock');
        return;
      }

      // Check queue lock status
      const queueLockStatus = await this.checkQueueLockStatus();
      if (queueLockStatus.locked) {
        this.logger.warn(
          `Queue locked for migration: ${queueLockStatus.reason} (expires: ${queueLockStatus.expiresAt})`
        );
        await this.releaseLock();
        return;
      }

      // Get next pending item
      const nextItem = await this.getNextPendingItem();
      if (!nextItem) {
        this.logger.debug('No pending items in queue');
        await this.releaseLock();
        return;
      }

      // Process the item
      this.logger.log(
        `Processing ${nextItem.story.key} (itemId: ${nextItem.id}, priority: ${nextItem.priority})`
      );
      await this.processQueueItem(nextItem);

      // Release lock
      await this.releaseLock();
    } catch (error: any) {
      this.logger.error(`Error in processing interval: ${error.message}`, error.stack);
      this.state.lastError = error.message;
      this.state.lastErrorAt = new Date();

      // Release lock on error
      if (this.state.lockId) {
        await this.releaseLock();
      }
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: TestQueueWithStory): Promise<void> {
    const startTime = Date.now();
    this.state.currentItemId = item.id;
    this.state.currentStoryKey = item.story.key;

    try {
      // Update status to 'running'
      await this.updateQueueStatus(item.id, 'running', {});

      this.logger.log(`[${item.story.key}] Running tests...`);

      // Call run_tests
      const testResponse = await this.mcpClient.runTests(item.storyId, 'all');

      // Check if breaking migration was applied
      const hasBreakingMigration = testResponse.testResults.migrationInfo?.isBreaking;

      // If breaking migration, unlock queue
      if (hasBreakingMigration) {
        this.logger.log(
          `[${item.story.key}] Breaking migration detected - unlocking queue`
        );
        await this.mcpClient.unlockTestQueue();
      }

      // Update queue entry with final status
      const finalStatus = testResponse.success ? 'passed' : 'failed';
      await this.updateQueueStatus(item.id, finalStatus, {
        testResults: testResponse.testResults,
        errorMessage: testResponse.success ? null : testResponse.message,
      });

      // Update metrics
      const duration = Date.now() - startTime;
      this.state.metrics.processedCount++;
      this.state.metrics.totalProcessingTime += duration;
      this.state.lastProcessedAt = new Date();
      this.state.consecutiveFailures = 0; // Reset on success

      this.logger.log(
        `[${item.story.key}] Completed in ${duration}ms - status: ${finalStatus}`
      );
    } catch (error: any) {
      // Handle failure
      const duration = Date.now() - startTime;
      this.state.metrics.failedCount++;
      this.state.metrics.processedCount++;
      this.state.metrics.totalProcessingTime += duration;
      this.state.consecutiveFailures++;

      this.logger.error(`[${item.story.key}] Processing failed: ${error.message}`, error.stack);

      // Update queue entry with error
      await this.updateQueueStatus(item.id, 'failed', {
        errorMessage: error.message || 'Processing failed',
      });

      // Circuit breaker
      if (this.state.consecutiveFailures >= this.circuitBreakerThreshold) {
        this.logger.error(
          `Circuit breaker triggered - ${this.state.consecutiveFailures} consecutive failures. Pausing for 5 minutes...`
        );
        await this.sleep(300000); // 5 minutes
        this.state.consecutiveFailures = 0;
      }
    } finally {
      this.state.currentItemId = null;
      this.state.currentStoryKey = null;
    }
  }

  /**
   * Acquire distributed lock using Redis SET NX EX
   */
  private async acquireDistributedLock(): Promise<boolean> {
    const lockKey = 'queue-processor:worker-lock';
    const lockTTLSeconds = Math.ceil(this.lockTTL / 1000);

    try {
      const result = await this.redis.set(
        lockKey,
        this.state.workerId,
        'NX',
        'EX',
        lockTTLSeconds
      );

      if (result === 'OK') {
        this.state.lockId = lockKey;
        this.logger.debug(`Acquired lock (TTL: ${lockTTLSeconds}s)`);
        return true;
      }

      return false;
    } catch (error: any) {
      this.logger.error(`Failed to acquire lock: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(): Promise<void> {
    if (!this.state.lockId) {
      return;
    }

    const lockKey = this.state.lockId;

    try {
      // Verify we still own the lock before deleting
      const currentValue = await this.redis.get(lockKey);
      if (currentValue === this.state.workerId) {
        await this.redis.del(lockKey);
        this.logger.debug('Released lock');
      }
    } catch (error: any) {
      this.logger.error(`Failed to release lock: ${error.message}`, error.stack);
    } finally {
      this.state.lockId = null;
    }
  }

  /**
   * Check queue lock status (migration locks)
   */
  private async checkQueueLockStatus(): Promise<{
    locked: boolean;
    reason?: string;
    expiresAt?: Date;
  }> {
    try {
      const activeLock = await this.prisma.testQueueLock.findFirst({
        where: {
          active: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (activeLock) {
        return {
          locked: true,
          reason: activeLock.reason,
          expiresAt: activeLock.expiresAt,
        };
      }

      return { locked: false };
    } catch (error: any) {
      this.logger.error(`Failed to check queue lock: ${error.message}`, error.stack);
      return { locked: false };
    }
  }

  /**
   * Get next pending item (priority DESC, createdAt ASC)
   */
  private async getNextPendingItem(): Promise<TestQueueWithStory | null> {
    try {
      const item = await this.prisma.testQueue.findFirst({
        where: {
          status: 'pending',
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        include: {
          story: {
            select: {
              key: true,
              title: true,
            },
          },
        },
      });

      return item;
    } catch (error: any) {
      this.logger.error(`Failed to get next pending item: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Update queue entry status
   */
  private async updateQueueStatus(
    itemId: string,
    status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped',
    data: any
  ): Promise<void> {
    try {
      await this.prisma.testQueue.update({
        where: { id: itemId },
        data: {
          status,
          ...data,
          updatedAt: new Date(),
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to update queue status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get health status for monitoring
   */
  async getHealthStatus(): Promise<QueueProcessorHealth> {
    const uptime = Date.now() - this.state.startedAt.getTime();
    const uptimeSeconds = Math.floor(uptime / 1000);

    // Query queue depth
    const [pending, running, total] = await Promise.all([
      this.prisma.testQueue.count({ where: { status: 'pending' } }),
      this.prisma.testQueue.count({ where: { status: 'running' } }),
      this.prisma.testQueue.count(),
    ]);

    // Calculate metrics
    const successRate =
      this.state.metrics.processedCount > 0
        ? ((this.state.metrics.processedCount - this.state.metrics.failedCount) /
            this.state.metrics.processedCount) *
          100
        : 0;

    const avgProcessingTime =
      this.state.metrics.processedCount > 0
        ? this.state.metrics.totalProcessingTime / this.state.metrics.processedCount / 1000
        : 0;

    // Get queue lock status
    const queueLockStatus = await this.checkQueueLockStatus();

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (this.state.consecutiveFailures >= 3) {
      status = 'degraded';
    }
    if (this.state.consecutiveFailures >= this.circuitBreakerThreshold) {
      status = 'unhealthy';
    }

    // Determine worker state
    let workerState: 'idle' | 'acquiring_lock' | 'checking_queue' | 'processing' | 'error' =
      'idle';
    if (this.state.isProcessing) {
      workerState = this.state.currentItemId ? 'processing' : 'checking_queue';
    }
    if (this.state.lastError && Date.now() - (this.state.lastErrorAt?.getTime() || 0) < 60000) {
      workerState = 'error';
    }

    return {
      status,
      uptime: uptimeSeconds,
      lastProcessedAt: this.state.lastProcessedAt?.toISOString() || null,
      lastProcessedStoryKey: this.state.lastProcessedAt ? this.state.currentStoryKey : null,
      currentlyProcessing: this.state.isProcessing,
      currentStoryKey: this.state.currentStoryKey,
      queueDepth: {
        pending,
        running,
        total,
      },
      metrics: {
        processedCount: this.state.metrics.processedCount,
        failedCount: this.state.metrics.failedCount,
        successRate: Math.round(successRate * 100) / 100,
        avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      },
      lockStatus: {
        hasLock: this.state.lockId !== null,
        lockId: this.state.lockId,
        lockAcquiredAt: this.state.lockId ? new Date().toISOString() : null,
      },
      queueLockStatus: {
        locked: queueLockStatus.locked,
        reason: queueLockStatus.reason || null,
        expiresAt: queueLockStatus.expiresAt?.toISOString() || null,
      },
      workerState,
      lastError: this.state.lastError,
      lastErrorAt: this.state.lastErrorAt?.toISOString() || null,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
