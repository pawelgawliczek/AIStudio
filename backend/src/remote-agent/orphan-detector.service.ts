/**
 * ST-150: Orphan Job Detector Service
 *
 * Background worker that detects and handles orphaned remote jobs:
 * 1. Jobs stuck in "running" state with no heartbeat (5 minute threshold)
 * 2. Jobs in "waiting_reconnect" past grace period (15 minutes)
 * 3. Agents that went offline while executing jobs
 *
 * Runs every minute to ensure rapid detection of abandoned jobs.
 *
 * @see ST-150 Remote Agent Execution
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrphanDetectorService implements OnModuleInit {
  private readonly logger = new Logger(OrphanDetectorService.name);

  // Thresholds
  private readonly HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without heartbeat
  private readonly GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minute reconnect window

  // Circuit breaker
  private consecutiveFailures = 0;
  private readonly MAX_FAILURES = 5;
  private circuitOpen = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('OrphanDetectorService initialized');
  }

  /**
   * Main orphan detection job - runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async detectOrphanedJobs(): Promise<void> {
    if (this.circuitOpen) {
      this.logger.warn('Orphan detection circuit breaker is open - skipping');
      return;
    }

    try {
      const now = new Date();

      // 1. Detect stale running jobs (no heartbeat)
      const staleRunningJobs = await this.detectStaleRunningJobs(now);

      // 2. Detect expired waiting_reconnect jobs
      const expiredWaitingJobs = await this.detectExpiredWaitingJobs(now);

      // 3. Detect orphaned agents (online but executing job that's gone)
      const orphanedAgents = await this.detectOrphanedAgents();

      // Reset circuit breaker on success
      this.consecutiveFailures = 0;

      // Log summary
      const total = staleRunningJobs + expiredWaitingJobs + orphanedAgents;
      if (total > 0) {
        this.logger.log(
          `Orphan detection complete: ${staleRunningJobs} stale jobs, ` +
            `${expiredWaitingJobs} expired waiting jobs, ${orphanedAgents} orphaned agents`,
        );
      }
    } catch (error) {
      this.consecutiveFailures++;
      this.logger.error(`Orphan detection failed: ${error.message}`);

      if (this.consecutiveFailures >= this.MAX_FAILURES) {
        this.circuitOpen = true;
        this.logger.error(
          `Circuit breaker opened after ${this.MAX_FAILURES} consecutive failures`,
        );

        // Auto-reset circuit after 5 minutes
        setTimeout(() => {
          this.circuitOpen = false;
          this.consecutiveFailures = 0;
          this.logger.log('Circuit breaker reset');
        }, 5 * 60 * 1000);
      }
    }
  }

  /**
   * Detect jobs that are "running" but haven't had a heartbeat in 5 minutes
   */
  private async detectStaleRunningJobs(now: Date): Promise<number> {
    const heartbeatThreshold = new Date(now.getTime() - this.HEARTBEAT_TIMEOUT_MS);

    const staleJobs = await this.prisma.remoteJob.findMany({
      where: {
        status: 'running',
        jobType: 'claude-agent',
        lastHeartbeatAt: {
          lt: heartbeatThreshold,
        },
      },
    });

    for (const job of staleJobs) {
      this.logger.warn(
        `Stale job detected: ${job.id} (last heartbeat: ${job.lastHeartbeatAt?.toISOString()})`,
      );

      // Check if agent is still online (lookup separately since no relation)
      let agentOnline = false;
      let agentHostname = 'unknown';
      if (job.agentId) {
        const agent = await this.prisma.remoteAgent.findUnique({
          where: { id: job.agentId },
        });
        if (agent) {
          agentOnline = agent.status === 'online';
          agentHostname = agent.hostname;
        }
      }

      if (agentOnline) {
        // Agent is online but job is stale - could be a bug or crashed process
        this.logger.warn(
          `Agent ${agentHostname} is online but job ${job.id} is stale - marking as failed`,
        );

        await this.failJob(job.id, 'Job timeout - no heartbeat for 5 minutes');
      } else {
        // Agent is offline - transition to waiting_reconnect
        this.logger.warn(
          `Agent offline for job ${job.id} - transitioning to waiting_reconnect`,
        );

        await this.prisma.remoteJob.update({
          where: { id: job.id },
          data: {
            status: 'waiting_reconnect',
            disconnectedAt: now,
            reconnectExpiresAt: new Date(now.getTime() + this.GRACE_PERIOD_MS),
          },
        });
      }
    }

    return staleJobs.length;
  }

  /**
   * Detect jobs in "waiting_reconnect" that have exceeded grace period
   */
  private async detectExpiredWaitingJobs(now: Date): Promise<number> {
    const expiredJobs = await this.prisma.remoteJob.findMany({
      where: {
        status: 'waiting_reconnect',
        reconnectExpiresAt: {
          lt: now,
        },
      },
    });

    for (const job of expiredJobs) {
      this.logger.warn(
        `Waiting job expired: ${job.id} (grace period ended: ${job.reconnectExpiresAt?.toISOString()})`,
      );

      await this.failJob(
        job.id,
        'Agent did not reconnect within 15 minute grace period',
      );
    }

    return expiredJobs.length;
  }

  /**
   * Detect agents marked as executing a job that doesn't exist or is not running
   */
  private async detectOrphanedAgents(): Promise<number> {
    const orphanedAgents = await this.prisma.remoteAgent.findMany({
      where: {
        currentExecutionId: { not: null },
      },
    });

    let cleaned = 0;

    for (const agent of orphanedAgents) {
      // Check if the job exists and is running
      const job = await this.prisma.remoteJob.findUnique({
        where: { id: agent.currentExecutionId! },
      });

      if (!job || !['running', 'waiting_reconnect'].includes(job.status)) {
        this.logger.warn(
          `Orphaned agent detected: ${agent.hostname} has currentExecutionId ${agent.currentExecutionId} ` +
            `but job is ${job ? job.status : 'not found'}`,
        );

        // Clear the stale reference
        await this.prisma.remoteAgent.update({
          where: { id: agent.id },
          data: { currentExecutionId: null },
        });

        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Mark a job as failed and clean up associated resources
   */
  private async failJob(jobId: string, error: string): Promise<void> {
    const job = await this.prisma.remoteJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
      },
    });

    // Clear agent's current execution
    if (job.agentId) {
      await this.prisma.remoteAgent.update({
        where: { id: job.agentId },
        data: { currentExecutionId: null },
      });
    }

    // Clear WorkflowRun executing agent
    if (job.workflowRunId) {
      await this.prisma.workflowRun.update({
        where: { id: job.workflowRunId },
        data: {
          executingAgentId: null,
          agentDisconnectedAt: null,
        },
      });
    }

    // Update ComponentRun if linked
    if (job.componentRunId) {
      await this.prisma.componentRun.update({
        where: { id: job.componentRunId },
        data: {
          status: 'failed',
          errorType: 'orphan_detection',
          errorMessage: error,
          finishedAt: new Date(),
        },
      });
    }
  }

  /**
   * Manual trigger for orphan detection (for testing)
   */
  async runDetection(): Promise<{
    staleJobs: number;
    expiredWaiting: number;
    orphanedAgents: number;
  }> {
    const now = new Date();
    const staleJobs = await this.detectStaleRunningJobs(now);
    const expiredWaiting = await this.detectExpiredWaitingJobs(now);
    const orphanedAgents = await this.detectOrphanedAgents();

    return { staleJobs, expiredWaiting, orphanedAgents };
  }

  /**
   * Get health check status
   */
  getHealthStatus(): {
    healthy: boolean;
    circuitOpen: boolean;
    consecutiveFailures: number;
  } {
    return {
      healthy: !this.circuitOpen,
      circuitOpen: this.circuitOpen,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}
