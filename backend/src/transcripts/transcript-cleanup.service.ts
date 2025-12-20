/**
 * Transcript Cleanup Service - Background worker for transcript line retention management
 *
 * This service runs as a scheduled task (daily at midnight) to:
 * 1. Delete TranscriptLines older than the configured retention period
 * 2. Log cleanup metrics for monitoring
 *
 * Features:
 * - Daily cleanup at midnight
 * - Configurable retention period via TRANSCRIPT_RETENTION_DAYS (default: 7 days)
 * - Cleanup metrics logging (deleted count, duration)
 *
 * @see Story: ST-348
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getErrorMessage, getErrorStack } from '../common';
import { PrismaService } from '../prisma/prisma.service';

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class TranscriptCleanupService implements OnModuleInit {
  private readonly logger = new Logger(TranscriptCleanupService.name);

  // Configuration
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    // Load configuration - default to 7 days retention
    this.retentionDays = parseInt(
      this.config.get('TRANSCRIPT_RETENTION_DAYS', '7'),
      10
    );
  }

  /**
   * Lifecycle: Module initialization
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Transcript Cleanup Service started');
    this.logger.log(`Configuration: retention=${this.retentionDays} days`);
  }

  /**
   * Main cleanup task - runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'transcript-cleanup-cron',
  })
  async cleanupOldTranscriptLines(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug('Starting transcript cleanup...');

      // Calculate cutoff date: now - retentionDays
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      // Delete transcript lines older than cutoff
      const result = await this.prisma.transcriptLine.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      const duration = Date.now() - startTime;

      this.logger.log(
        `Transcript cleanup completed: ${result.count} lines deleted (cutoff: ${cutoffDate.toISOString()}) [${duration}ms]`
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        `Transcript cleanup failed: ${getErrorMessage(error)} [${duration}ms]`,
        getErrorStack(error)
      );
    }
  }

  /**
   * Get retention configuration for monitoring
   */
  getRetentionConfig(): { retentionDays: number } {
    return {
      retentionDays: this.retentionDays,
    };
  }
}
