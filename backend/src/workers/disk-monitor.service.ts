/**
 * Disk Monitor Service - Background worker for disk space monitoring and alerting
 *
 * This service runs as a scheduled task (hourly) to:
 * 1. Check available disk space using df command
 * 2. Calculate worktree disk usage (total count and stale worktrees)
 * 3. Evaluate thresholds (warning at < 5GB, critical at < 2GB)
 * 4. Enqueue alerts via notification queue
 * 5. Generate weekly reports (Mondays at 9am)
 *
 * Features:
 * - Hourly disk space monitoring with configurable thresholds
 * - Stale worktree detection (active but updatedAt > 14 days)
 * - Alert deduplication (max 1 alert per hour per threshold)
 * - Circuit breaker (pauses after 5 consecutive failures)
 * - Health check metrics for monitoring
 *
 * @see Architecture Spec: ST-54
 */

import { execSync } from 'child_process';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Decimal } from '@prisma/client/runtime/library';
import { getErrorMessage, getErrorStack } from '../common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkersService } from './workers.service';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface DiskUsageMetrics {
  totalSpaceGB: number;
  usedSpaceGB: number;
  availableSpaceGB: number;
  percentUsed: number;
  worktreeCount: number;
  totalWorktreeUsageMB: number;
  stalledWorktrees: StalledWorktreeInfo[];
}

export interface StalledWorktreeInfo {
  id: string;
  storyId: string;
  storyKey: string;
  branchName: string;
  worktreePath: string;
  diskUsageMB: number | null;
  lastUpdated: Date;
  daysStale: number;
}

export interface DiskMonitorHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheckAt: string | null;
  consecutiveFailures: number;
  thresholds: {
    warningGB: number;
    criticalGB: number;
    staleWorktreeDays: number;
  };
  currentUsage: {
    totalGB: number;
    availableGB: number;
    percentUsed: number;
  } | null;
  stalledWorktreeCount: number;
  lastAlertSentAt: string | null;
  metrics: {
    totalChecks: number;
    failedChecks: number;
    successRate: number;
    avgCheckDuration: number;
  };
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class DiskMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DiskMonitorService.name);

  // Configuration
  private readonly enabled: boolean;
  private readonly worktreeRootPath: string;
  private readonly warningThresholdGB: number;
  private readonly criticalThresholdGB: number;
  private readonly staleWorktreeDays: number;

  // State tracking
  private readonly startedAt: Date = new Date();
  private lastCheckAt: Date | null = null;
  private lastAlertSentAt: Date | null = null;
  private consecutiveFailures: number = 0;
  private currentUsage: DiskUsageMetrics | null = null;
  private readonly circuitBreakerThreshold: number = 5;

  // Metrics
  private totalChecks: number = 0;
  private failedChecks: number = 0;
  private totalCheckDuration: number = 0;

  // Alert deduplication
  private lastAlertType: 'warning' | 'critical' | null = null;
  private lastAlertHour: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly workersService: WorkersService
  ) {
    // Load configuration
    this.enabled = this.config.get('DISK_MONITOR_ENABLED', 'true') === 'true';
    this.worktreeRootPath = this.config.get(
      'DISK_WORKTREE_ROOT_PATH',
      '/opt/stack/worktrees'
    );
    this.warningThresholdGB = parseInt(this.config.get('DISK_ALERT_WARNING_GB', '5'), 10);
    this.criticalThresholdGB = parseInt(this.config.get('DISK_ALERT_CRITICAL_GB', '2'), 10);
    this.staleWorktreeDays = parseInt(this.config.get('DISK_STALE_WORKTREE_DAYS', '14'), 10);
  }

  /**
   * Lifecycle: Module initialization
   */
  async onModuleInit(): Promise<void> {
    if (this.enabled) {
      this.logger.log('Disk Monitor Service started');
      this.logger.log(
        `Configuration: warning=${this.warningThresholdGB}GB, critical=${this.criticalThresholdGB}GB, stale=${this.staleWorktreeDays} days`
      );
      this.logger.log(`Worktree root path: ${this.worktreeRootPath}`);
    } else {
      this.logger.warn('Disk Monitor Service is DISABLED (DISK_MONITOR_ENABLED=false)');
    }
  }

  /**
   * Main monitoring task - runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'disk-monitor-cron' })
  async monitorDiskSpace(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Circuit breaker: Pause if too many consecutive failures
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      this.logger.warn(
        `Circuit breaker open (${this.consecutiveFailures} consecutive failures). Skipping check.`
      );
      return;
    }

    const startTime = Date.now();

    try {
      this.logger.debug('Starting disk space check...');

      // 1. Check disk space and calculate metrics
      const metrics = await this.checkDiskSpace();

      // 2. Evaluate thresholds and send alerts if needed
      await this.evaluateThresholds(metrics);

      // 3. Update state
      this.currentUsage = metrics;
      this.lastCheckAt = new Date();
      this.consecutiveFailures = 0;
      this.totalChecks++;

      const duration = Date.now() - startTime;
      this.totalCheckDuration += duration;

      this.logger.log(
        `Disk check completed: ${metrics.availableSpaceGB}GB available (${metrics.percentUsed}% used), ` +
          `${metrics.worktreeCount} worktrees, ${metrics.stalledWorktrees.length} stalled [${duration}ms]`
      );
    } catch (error) {
      this.consecutiveFailures++;
      this.failedChecks++;
      this.totalChecks++;

      const duration = Date.now() - startTime;
      this.totalCheckDuration += duration;

      this.logger.error(
        `Disk check failed (attempt ${this.consecutiveFailures}/${this.circuitBreakerThreshold}): ${getErrorMessage(error)}`,
        getErrorStack(error)
      );

      // Send critical alert if circuit breaker about to trip
      if (this.consecutiveFailures >= 3) {
        try {
          await (this.workersService as unknown as { sendNotification: (data: Record<string, unknown>) => Promise<unknown> }).sendNotification({
            type: 'disk-monitor-error',
            priority: 1,
            message: `Disk monitor failing: ${this.consecutiveFailures} consecutive failures`,
            error: getErrorMessage(error),
          });
        } catch (notifError) {
          this.logger.error(`Failed to send error notification: ${(notifError as Error).message}`);
        }
      }
    }
  }

  /**
   * Check disk space and calculate worktree metrics
   */
  async checkDiskSpace(): Promise<DiskUsageMetrics> {
    // 1. Get system disk space using df command
    const dfOutput = execSync(`df -BG ${this.worktreeRootPath} | tail -1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Parse df output: Filesystem Total Used Avail Use% Mounted
    const parts = dfOutput.trim().split(/\s+/);
    if (parts.length < 5) {
      throw new Error(`Invalid df output: ${dfOutput}`);
    }

    const totalSpaceGB = parseInt(parts[1].replace('G', ''), 10);
    const usedSpaceGB = parseInt(parts[2].replace('G', ''), 10);
    const availableSpaceGB = parseInt(parts[3].replace('G', ''), 10);
    const percentUsed = parseInt(parts[4].replace('%', ''), 10);

    // 2. Query active worktrees from database
    const staleThresholdDate = new Date(
      Date.now() - this.staleWorktreeDays * 24 * 60 * 60 * 1000
    );

    const worktrees = await this.prisma.worktree.findMany({
      where: {
        status: 'active',
      },
      include: {
        story: {
          select: {
            key: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });

    // 3. Identify stalled worktrees
    const stalledWorktrees: StalledWorktreeInfo[] = worktrees
      .filter((wt) => wt.updatedAt < staleThresholdDate)
      .map((wt) => {
        const daysStale = Math.floor(
          (Date.now() - wt.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
        );

        return {
          id: wt.id,
          storyId: wt.storyId,
          storyKey: wt.story.key,
          branchName: wt.branchName,
          worktreePath: wt.worktreePath,
          diskUsageMB: null as number | null, // Will be calculated on-demand by MCP tool
          lastUpdated: wt.updatedAt,
          daysStale,
        };
      });

    return {
      totalSpaceGB,
      usedSpaceGB,
      availableSpaceGB,
      percentUsed,
      worktreeCount: worktrees.length,
      totalWorktreeUsageMB: 0, // Calculated on-demand by MCP tool
      stalledWorktrees,
    };
  }

  /**
   * Evaluate disk space thresholds and send alerts if needed
   */
  async evaluateThresholds(metrics: DiskUsageMetrics): Promise<void> {
    const currentHour = new Date().getHours();
    const { availableSpaceGB, percentUsed, worktreeCount, stalledWorktrees } = metrics;

    // Determine alert type
    let alertType: 'warning' | 'critical' | null = null;
    let thresholdGB: number = 0;

    if (availableSpaceGB < this.criticalThresholdGB) {
      alertType = 'critical';
      thresholdGB = this.criticalThresholdGB;
    } else if (availableSpaceGB < this.warningThresholdGB) {
      alertType = 'warning';
      thresholdGB = this.warningThresholdGB;
    }

    // No threshold breached
    if (!alertType) {
      return;
    }

    // Alert deduplication: Send max 1 alert per hour per threshold type
    if (this.lastAlertType === alertType && this.lastAlertHour === currentHour) {
      this.logger.debug(`Skipping ${alertType} alert - already sent this hour`);
      return;
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (alertType === 'critical') {
      recommendations.push(
        `CRITICAL: Only ${availableSpaceGB}GB available. Immediately cleanup stalled worktrees to prevent system failure.`
      );
    } else {
      recommendations.push(
        `WARNING: ${availableSpaceGB}GB available. Review and cleanup stalled worktrees soon.`
      );
    }

    if (stalledWorktrees.length > 0) {
      recommendations.push(
        `${stalledWorktrees.length} stalled worktrees found. Cleanup recommended.`
      );

      // List top 5 stalled worktrees
      stalledWorktrees.slice(0, 5).forEach((wt, idx) => {
        recommendations.push(
          `${idx + 1}. ${wt.storyKey} (${wt.branchName}): ${wt.daysStale} days old`
        );
      });
    }

    const message = recommendations.join('\n');

    // Store alert in database
    await this.prisma.diskUsageAlert.create({
      data: {
        alertType,
        thresholdGB,
        availableSpaceGB: new Decimal(availableSpaceGB),
        usedSpaceGB: new Decimal(metrics.usedSpaceGB),
        totalSpaceGB: new Decimal(metrics.totalSpaceGB),
        percentUsed: new Decimal(percentUsed),
        worktreeCount,
        stalledCount: stalledWorktrees.length,
        message,
        notificationSent: false,
      },
    });

    // Enqueue notification
    try {
      await (this.workersService as unknown as { sendNotification: (data: Record<string, unknown>) => Promise<unknown> }).sendNotification({
        type: 'disk-space-alert',
        priority: alertType === 'critical' ? 1 : 2,
        alertType,
        availableSpaceGB,
        thresholdGB,
        percentUsed,
        stalledWorktreeCount: stalledWorktrees.length,
        recommendations,
      });

      // Update deduplication state
      this.lastAlertType = alertType;
      this.lastAlertHour = currentHour;
      this.lastAlertSentAt = new Date();

      this.logger.warn(
        `${alertType.toUpperCase()} alert sent: ${availableSpaceGB}GB available (threshold: ${thresholdGB}GB)`
      );
    } catch (error) {
      this.logger.error(`Failed to enqueue alert notification: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Generate weekly disk usage report (runs Mondays at 9am)
   */
  @Cron('0 9 * * 1', { name: 'weekly-disk-report' })
  async generateWeeklyReport(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      this.logger.log('Generating weekly disk usage report...');

      // Get current metrics
      const metrics = await this.checkDiskSpace();

      // Calculate report period (last 7 days)
      const reportDate = new Date();
      reportDate.setHours(0, 0, 0, 0);
      reportDate.setDate(reportDate.getDate() - reportDate.getDay() + 1); // Monday

      const reportPeriodStart = new Date(reportDate);
      reportPeriodStart.setDate(reportPeriodStart.getDate() - 7);

      const reportPeriodEnd = new Date(reportDate);

      // Get previous week's report for trend calculation
      const previousReport = await this.prisma.diskUsageReport.findFirst({
        where: {
          reportDate: {
            lt: reportDate,
          },
        },
        orderBy: {
          reportDate: 'desc',
        },
      });

      let weekOverWeekChangeGB: Decimal | null = null;
      let weekOverWeekChangePercent: Decimal | null = null;

      if (previousReport) {
        const changeGB =
          metrics.usedSpaceGB - parseFloat(previousReport.usedSpaceGB.toString());
        const changePercent = (changeGB / parseFloat(previousReport.usedSpaceGB.toString())) * 100;

        weekOverWeekChangeGB = new Decimal(changeGB);
        weekOverWeekChangePercent = new Decimal(changePercent);
      }

      // Create report
      const report = await this.prisma.diskUsageReport.create({
        data: {
          reportDate,
          reportPeriodStart,
          reportPeriodEnd,
          totalSpaceGB: new Decimal(metrics.totalSpaceGB),
          usedSpaceGB: new Decimal(metrics.usedSpaceGB),
          availableSpaceGB: new Decimal(metrics.availableSpaceGB),
          percentUsed: new Decimal(metrics.percentUsed),
          totalWorktrees: metrics.worktreeCount,
          activeWorktrees: metrics.worktreeCount - metrics.stalledWorktrees.length,
          stalledWorktrees: metrics.stalledWorktrees.length,
          totalWorktreeUsageMB: 0, // Calculated on-demand
          avgWorktreeUsageMB: new Decimal(0),
          stalledWorktreesList: metrics.stalledWorktrees as any,
          weekOverWeekChangeGB,
          weekOverWeekChangePercent,
          emailSent: false,
        },
      });

      // Enqueue email notification
      await (this.workersService as unknown as { sendNotification: (data: Record<string, unknown>) => Promise<unknown> }).sendNotification({
        type: 'weekly-disk-report',
        priority: 5,
        reportId: report.id,
        metrics,
        weekOverWeekChangeGB: weekOverWeekChangeGB?.toString(),
        weekOverWeekChangePercent: weekOverWeekChangePercent?.toString(),
      });

      this.logger.log(`Weekly report generated: ${report.id}`);
    } catch (error) {
      this.logger.error(`Failed to generate weekly report: ${getErrorMessage(error)}`, getErrorStack(error));
    }
  }

  /**
   * Get service health for monitoring
   */
  getHealth(): DiskMonitorHealth {
    const uptime = Date.now() - this.startedAt.getTime();
    const successRate = this.totalChecks > 0 ? ((this.totalChecks - this.failedChecks) / this.totalChecks) * 100 : 100;
    const avgCheckDuration = this.totalChecks > 0 ? this.totalCheckDuration / this.totalChecks : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      status = 'unhealthy';
    } else if (this.consecutiveFailures > 0 || successRate < 95) {
      status = 'degraded';
    }

    return {
      status,
      uptime: Math.floor(uptime / 1000), // seconds
      lastCheckAt: this.lastCheckAt?.toISOString() || null,
      consecutiveFailures: this.consecutiveFailures,
      thresholds: {
        warningGB: this.warningThresholdGB,
        criticalGB: this.criticalThresholdGB,
        staleWorktreeDays: this.staleWorktreeDays,
      },
      currentUsage: this.currentUsage
        ? {
            totalGB: this.currentUsage.totalSpaceGB,
            availableGB: this.currentUsage.availableSpaceGB,
            percentUsed: this.currentUsage.percentUsed,
          }
        : null,
      stalledWorktreeCount: this.currentUsage?.stalledWorktrees.length || 0,
      lastAlertSentAt: this.lastAlertSentAt?.toISOString() || null,
      metrics: {
        totalChecks: this.totalChecks,
        failedChecks: this.failedChecks,
        successRate: parseFloat(successRate.toFixed(2)),
        avgCheckDuration: parseFloat(avgCheckDuration.toFixed(2)),
      },
    };
  }
}
