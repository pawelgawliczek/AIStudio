/**
 * ST-268: Orphan Deployment Detector Service
 *
 * NestJS cron service that detects and cleans up orphaned deployments.
 * Runs every 5 minutes to find deployments with status='deploying' that
 * haven't sent a heartbeat in over 10 minutes.
 *
 * Features:
 * - Marks orphaned deployments as 'failed'
 * - Releases their deployment locks
 * - Logs cleanup actions for audit
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentLockService } from '../services/deployment-lock.service';

@Injectable()
export class OrphanDeploymentDetectorService {
  private readonly logger = new Logger(OrphanDeploymentDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lockService: DeploymentLockService,
  ) {}

  /**
   * Cron job that runs every 5 minutes to detect orphaned deployments
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async detectOrphanedDeployments(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('Running orphan deployment detection...');

      // Find deployments with status='deploying' and lastHeartbeat > 10 min ago
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const orphanedDeployments = await this.prisma.deploymentLog.findMany({
        where: {
          status: 'deploying',
          OR: [
            { lastHeartbeat: { lt: tenMinutesAgo } },
            { lastHeartbeat: null }, // No heartbeat recorded
          ],
        },
        include: {
          story: {
            select: { key: true, projectId: true },
          },
        },
      });

      if (orphanedDeployments.length === 0) {
        this.logger.debug('No orphaned deployments found');
        return;
      }

      this.logger.warn(
        `Found ${orphanedDeployments.length} orphaned deployment(s)`,
      );

      // Mark each as failed and release locks
      for (const deployment of orphanedDeployments) {
        try {
          await this.cleanupOrphanedDeployment(deployment);
        } catch (error) {
          this.logger.error(
            `Failed to cleanup orphaned deployment ${deployment.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Orphan detection completed in ${duration}ms (cleaned up ${orphanedDeployments.length} deployment(s))`,
      );
    } catch (error) {
      this.logger.error(
        `Orphan detection failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Cleanup a single orphaned deployment
   */
  private async cleanupOrphanedDeployment(deployment: any): Promise<void> {
    const storyKey = deployment.story?.key || 'UNKNOWN';
    const lastHeartbeat = deployment.lastHeartbeat
      ? new Date(deployment.lastHeartbeat).toISOString()
      : 'NEVER';

    this.logger.warn(
      `Cleaning up orphaned deployment: ${deployment.id} (${storyKey}) - Last heartbeat: ${lastHeartbeat}`,
    );

    // Mark deployment as failed
    await this.prisma.deploymentLog.update({
      where: { id: deployment.id },
      data: {
        status: 'failed',
        errorMessage: `Deployment worker process appears to have died. No heartbeat received since ${lastHeartbeat}. Marked as failed by orphan detector.`,
        completedAt: new Date(),
      },
    });

    // HIGH-3: Fix lock release to query by storyId
    // Release deployment lock if held (find by storyId)
    if (deployment.storyId) {
      try {
        const lock = await this.prisma.deploymentLock.findFirst({
          where: {
            storyId: deployment.storyId,
            active: true,
          },
        });

        if (lock) {
          await this.prisma.deploymentLock.update({
            where: { id: lock.id },
            data: { active: false },
          });
          this.logger.log(
            `Released deployment lock ${lock.id} for orphaned deployment ${deployment.id}`,
          );
        } else {
          this.logger.debug(
            `No active lock found for storyId ${deployment.storyId}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to release lock for storyId ${deployment.storyId}: ${error.message}`,
        );
      }
    }

    // Kill child process if PID is recorded (best effort)
    if (deployment.childProcessPid) {
      try {
        process.kill(deployment.childProcessPid, 'SIGTERM');
        this.logger.log(
          `Sent SIGTERM to orphaned worker process: ${deployment.childProcessPid}`,
        );
      } catch (error) {
        // Process might already be dead, which is fine
        this.logger.debug(
          `Could not kill process ${deployment.childProcessPid}: ${error.message}`,
        );
      }
    }
  }
}
