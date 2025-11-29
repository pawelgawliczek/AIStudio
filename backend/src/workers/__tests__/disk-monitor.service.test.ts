/**
 * Disk Monitor Service Unit Tests
 *
 * Tests cover (ST-54):
 * - Disk space checking and metric calculation
 * - Stalled worktree detection (> 14 days)
 * - Threshold evaluation (warning at 5GB, critical at 2GB)
 * - Alert deduplication (max 1 per hour per threshold)
 * - Circuit breaker (pauses after 5 consecutive failures)
 * - Health check metrics
 */

// Create mock reference before any imports
const mockExecSync = jest.fn();

// Mock child_process at module level
jest.mock('child_process', () => ({
  execSync: mockExecSync,
  exec: jest.fn(),
  spawn: jest.fn(),
}));

// Skip Prisma mock from conditional-setup by not importing PrismaService from the actual module
// Instead we'll mock PrismaService directly
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DiskMonitorService } from '../disk-monitor.service';
import { WorkersService } from '../workers.service';

// ============================================================================
// Mocks
// ============================================================================

const mockPrisma = {
  worktree: {
    findMany: jest.fn(),
  },
  diskUsageAlert: {
    create: jest.fn(),
  },
  diskUsageReport: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockWorkersService = {
  sendNotification: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      DISK_MONITOR_ENABLED: 'true',
      DISK_WORKTREE_ROOT_PATH: '/opt/stack/worktrees',
      DISK_ALERT_WARNING_GB: '5',
      DISK_ALERT_CRITICAL_GB: '2',
      DISK_STALE_WORKTREE_DAYS: '14',
    };
    return config[key] || defaultValue;
  }),
};

// ============================================================================
// Test Suite
// ============================================================================

describe('DiskMonitorService', () => {
  let service: DiskMonitorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiskMonitorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: WorkersService, useValue: mockWorkersService },
      ],
    }).compile();

    service = module.get<DiskMonitorService>(DiskMonitorService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('checkDiskSpace', () => {
    it('should successfully check disk space and return metrics', async () => {
      // Mock df output: 500GB total, 380GB used, 120GB available, 76% used
      const dfOutput = 'Filesystem     500G 380G 120G  76% /opt/stack\n';
      mockExecSync.mockReturnValue(dfOutput);

      // Mock database worktrees
      const mockWorktrees = [
        {
          id: 'wt-1',
          storyId: 'story-1',
          branchName: 'feat-auth',
          status: 'active',
          worktreePath: '/opt/stack/worktrees/feat-auth',
          updatedAt: new Date(), // Fresh
          createdAt: new Date(),
          story: { key: 'ST-1' },
        },
        {
          id: 'wt-2',
          storyId: 'story-2',
          branchName: 'fix-bug',
          status: 'active',
          worktreePath: '/opt/stack/worktrees/fix-bug',
          updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          story: { key: 'ST-2' },
        },
      ];
      mockPrisma.worktree.findMany.mockResolvedValue(mockWorktrees);

      const metrics = await service.checkDiskSpace();

      expect(metrics.totalSpaceGB).toBe(500);
      expect(metrics.usedSpaceGB).toBe(380);
      expect(metrics.availableSpaceGB).toBe(120);
      expect(metrics.percentUsed).toBe(76);
      expect(metrics.worktreeCount).toBe(2);
      expect(metrics.stalledWorktrees).toHaveLength(1);
      expect(metrics.stalledWorktrees[0].storyKey).toBe('ST-2');
      expect(metrics.stalledWorktrees[0].daysStale).toBeGreaterThan(14);
    });

    it('should identify stalled worktrees (updatedAt > 14 days)', async () => {
      const dfOutput = 'Filesystem     500G 380G 120G  76% /opt/stack\n';
      mockExecSync.mockReturnValue(dfOutput);

      const mockWorktrees = [
        {
          id: 'wt-fresh',
          storyId: 'story-fresh',
          branchName: 'feat-new',
          status: 'active',
          worktreePath: '/opt/stack/worktrees/feat-new',
          updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days
          createdAt: new Date(),
          story: { key: 'ST-10' },
        },
        {
          id: 'wt-stale',
          storyId: 'story-stale',
          branchName: 'feat-old',
          status: 'active',
          worktreePath: '/opt/stack/worktrees/feat-old',
          updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days
          createdAt: new Date(),
          story: { key: 'ST-20' },
        },
      ];
      mockPrisma.worktree.findMany.mockResolvedValue(mockWorktrees);

      const metrics = await service.checkDiskSpace();

      expect(metrics.stalledWorktrees).toHaveLength(1);
      expect(metrics.stalledWorktrees[0].storyKey).toBe('ST-20');
    });

    it('should handle df command failure gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('df command failed');
      });

      await expect(service.checkDiskSpace()).rejects.toThrow('df command failed');
    });
  });

  describe('evaluateThresholds', () => {
    it('should send critical alert when available space < 2GB', async () => {
      const metrics = {
        totalSpaceGB: 500,
        usedSpaceGB: 498,
        availableSpaceGB: 1.5, // Below critical threshold
        percentUsed: 99,
        worktreeCount: 10,
        totalWorktreeUsageMB: 5000,
        stalledWorktrees: [],
      };

      await service.evaluateThresholds(metrics);

      expect(mockPrisma.diskUsageAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'critical',
            thresholdGB: 2,
            availableSpaceGB: expect.any(Object),
          }),
        })
      );

      expect(mockWorkersService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disk-space-alert',
          alertType: 'critical',
          priority: 1,
        })
      );
    });

    it('should send warning alert when available space < 5GB but > 2GB', async () => {
      const metrics = {
        totalSpaceGB: 500,
        usedSpaceGB: 496,
        availableSpaceGB: 4, // Below warning threshold
        percentUsed: 99,
        worktreeCount: 10,
        totalWorktreeUsageMB: 5000,
        stalledWorktrees: [],
      };

      await service.evaluateThresholds(metrics);

      expect(mockPrisma.diskUsageAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'warning',
            thresholdGB: 5,
          }),
        })
      );

      expect(mockWorkersService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disk-space-alert',
          alertType: 'warning',
          priority: 2,
        })
      );
    });

    it('should not send alert when available space is sufficient', async () => {
      const metrics = {
        totalSpaceGB: 500,
        usedSpaceGB: 400,
        availableSpaceGB: 100, // Above warning threshold
        percentUsed: 80,
        worktreeCount: 10,
        totalWorktreeUsageMB: 5000,
        stalledWorktrees: [],
      };

      await service.evaluateThresholds(metrics);

      expect(mockPrisma.diskUsageAlert.create).not.toHaveBeenCalled();
      expect(mockWorkersService.sendNotification).not.toHaveBeenCalled();
    });

    it('should deduplicate alerts (max 1 per hour per threshold type)', async () => {
      const metrics = {
        totalSpaceGB: 500,
        usedSpaceGB: 498,
        availableSpaceGB: 1.5,
        percentUsed: 99,
        worktreeCount: 10,
        totalWorktreeUsageMB: 5000,
        stalledWorktrees: [],
      };

      // Send alert twice in same hour
      await service.evaluateThresholds(metrics);
      await service.evaluateThresholds(metrics);

      // Should only send one notification
      expect(mockWorkersService.sendNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('monitorDiskSpace', () => {
    it('should successfully complete monitoring cycle', async () => {
      const dfOutput = 'Filesystem     500G 380G 120G  76% /opt/stack\n';
      mockExecSync.mockReturnValue(dfOutput);
      mockPrisma.worktree.findMany.mockResolvedValue([]);

      await service.monitorDiskSpace();

      const health = service.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.consecutiveFailures).toBe(0);
      expect(health.metrics.totalChecks).toBe(1);
      expect(health.metrics.failedChecks).toBe(0);
    });

    it('should implement circuit breaker after 5 consecutive failures', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      // Trigger 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        await service.monitorDiskSpace().catch(() => {});
      }

      const health = service.getHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.consecutiveFailures).toBe(5);

      // Next call should be skipped due to circuit breaker
      await service.monitorDiskSpace();
      expect(health.consecutiveFailures).toBe(5); // Should not increment
    });

    it('should reset consecutive failures on successful check', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      // Fail once
      await service.monitorDiskSpace().catch(() => {});
      expect(service.getHealth().consecutiveFailures).toBe(1);

      // Then succeed
      const dfOutput = 'Filesystem     500G 380G 120G  76% /opt/stack\n';
      mockExecSync.mockReturnValue(dfOutput);
      mockPrisma.worktree.findMany.mockResolvedValue([]);

      await service.monitorDiskSpace();
      expect(service.getHealth().consecutiveFailures).toBe(0);
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when no failures', () => {
      const health = service.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.consecutiveFailures).toBe(0);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.thresholds.warningGB).toBe(5);
      expect(health.thresholds.criticalGB).toBe(2);
    });

    it('should return degraded status with some failures', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      // Fail twice
      await service.monitorDiskSpace().catch(() => {});
      await service.monitorDiskSpace().catch(() => {});

      const health = service.getHealth();
      expect(health.status).toBe('degraded');
      expect(health.consecutiveFailures).toBe(2);
    });
  });
});
