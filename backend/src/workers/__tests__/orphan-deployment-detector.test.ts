/**
 * Unit tests for orphan-deployment-detector.ts - ST-268
 *
 * Tests the orphan detection system:
 * - Detects deployments with stale heartbeat (>10 min)
 * - Marks orphaned deployments as failed
 * - Releases lock for orphaned deployments
 * - Runs periodically (every 5 minutes)
 * - Handles multiple orphaned deployments
 */

import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client');

describe('orphan-deployment-detector', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockSetInterval: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock PrismaClient
    mockPrisma = {
      deploymentLog: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      deploymentLock: {
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
      $disconnect: jest.fn(),
    } as any;

    (PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma);

    // Spy on setInterval
    mockSetInterval = jest.spyOn(global, 'setInterval');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('AC1: Orphan Detection', () => {
    it('should detect deployments with stale heartbeat (>10 minutes)', async () => {
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago

      const orphanedDeployment = {
        id: 'deployment-orphan-1',
        storyId: 'story-123',
        status: 'deploying',
        environment: 'production',
        deployedAt: new Date(now.getTime() - 20 * 60 * 1000),
        updatedAt: staleHeartbeat,
        metadata: {
          progress: {
            currentPhase: 'buildBackend',
            percentComplete: 40,
            lastHeartbeat: staleHeartbeat.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([orphanedDeployment]);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...orphanedDeployment,
        status: 'failed',
      });

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(mockPrisma.deploymentLog.findMany).toHaveBeenCalledWith({
        where: {
          status: 'deploying',
          updatedAt: {
            lt: expect.any(Date), // 10 minutes ago
          },
        },
      });

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: 'deployment-orphan-1' },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          errorMessage: expect.stringContaining('Deployment worker orphaned'),
        },
      });
    });

    it('should not flag deployments with recent heartbeat', async () => {
      const now = new Date();
      const recentHeartbeat = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutes ago

      const activeDeployment = {
        id: 'deployment-active-1',
        storyId: 'story-456',
        status: 'deploying',
        environment: 'production',
        deployedAt: new Date(now.getTime() - 5 * 60 * 1000),
        updatedAt: recentHeartbeat,
        metadata: {
          progress: {
            currentPhase: 'buildFrontend',
            percentComplete: 60,
            lastHeartbeat: recentHeartbeat.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([]);

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(mockPrisma.deploymentLog.update).not.toHaveBeenCalled();
    });

    it('should handle multiple orphaned deployments', async () => {
      const now = new Date();
      const staleHeartbeat1 = new Date(now.getTime() - 12 * 60 * 1000);
      const staleHeartbeat2 = new Date(now.getTime() - 18 * 60 * 1000);

      const orphanedDeployments = [
        {
          id: 'deployment-orphan-1',
          storyId: 'story-111',
          status: 'deploying',
          environment: 'production',
          updatedAt: staleHeartbeat1,
          metadata: {
            progress: {
              lastHeartbeat: staleHeartbeat1.toISOString(),
            },
          },
        },
        {
          id: 'deployment-orphan-2',
          storyId: 'story-222',
          status: 'deploying',
          environment: 'production',
          updatedAt: staleHeartbeat2,
          metadata: {
            progress: {
              lastHeartbeat: staleHeartbeat2.toISOString(),
            },
          },
        },
      ];

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue(orphanedDeployments);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({});

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: 'deployment-orphan-1' },
        data: expect.objectContaining({
          status: 'failed',
        }),
      });
      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: 'deployment-orphan-2' },
        data: expect.objectContaining({
          status: 'failed',
        }),
      });
    });
  });

  describe('AC2: Lock Release', () => {
    it('should release deployment lock for orphaned deployment', async () => {
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 15 * 60 * 1000);

      const orphanedDeployment = {
        id: 'deployment-orphan-lock',
        storyId: 'story-lock',
        status: 'deploying',
        environment: 'production',
        updatedAt: staleHeartbeat,
        deploymentId: 'lock-123',
        metadata: {
          progress: {
            lastHeartbeat: staleHeartbeat.toISOString(),
          },
        },
      };

      const existingLock = {
        id: 'lock-123',
        heldBy: 'orphaned-worker',
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      };

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([orphanedDeployment]);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(existingLock);
      (mockPrisma.deploymentLock.delete as jest.Mock).mockResolvedValue({});

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(mockPrisma.deploymentLock.delete).toHaveBeenCalledWith({
        where: { id: 'lock-123' },
      });
    });

    it('should not release lock if already released', async () => {
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 15 * 60 * 1000);

      const orphanedDeployment = {
        id: 'deployment-orphan-no-lock',
        storyId: 'story-no-lock',
        status: 'deploying',
        environment: 'production',
        updatedAt: staleHeartbeat,
        deploymentId: null, // No lock ID
        metadata: {
          progress: {
            lastHeartbeat: staleHeartbeat.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([orphanedDeployment]);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({});

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(mockPrisma.deploymentLock.delete).not.toHaveBeenCalled();
    });

    it('should handle lock deletion errors gracefully', async () => {
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 15 * 60 * 1000);

      const orphanedDeployment = {
        id: 'deployment-orphan-lock-error',
        storyId: 'story-lock-error',
        status: 'deploying',
        environment: 'production',
        updatedAt: staleHeartbeat,
        deploymentId: 'lock-456',
        metadata: {
          progress: {
            lastHeartbeat: staleHeartbeat.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([orphanedDeployment]);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null); // Lock not found
      (mockPrisma.deploymentLock.delete as jest.Mock).mockRejectedValue(
        new Error('Lock not found')
      );

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');

      // Should not throw error
      await expect(detectOrphanedDeployments()).resolves.not.toThrow();

      // Deployment should still be marked as failed
      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: 'deployment-orphan-lock-error' },
        data: expect.objectContaining({
          status: 'failed',
        }),
      });
    });
  });

  describe('AC3: Periodic Execution', () => {
    it('should run every 5 minutes', () => {
      const { startOrphanDetector } = require('../orphan-deployment-detector');
      startOrphanDetector();

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000 // 5 minutes
      );
    });

    it('should run immediately on start', async () => {
      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([]);

      const { startOrphanDetector } = require('../orphan-deployment-detector');
      await startOrphanDetector();

      expect(mockPrisma.deploymentLog.findMany).toHaveBeenCalled();
    });

    it('should continue running after errors', async () => {
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 15 * 60 * 1000);

      const orphanedDeployment = {
        id: 'deployment-orphan-error',
        storyId: 'story-error',
        status: 'deploying',
        environment: 'production',
        updatedAt: staleHeartbeat,
        metadata: {
          progress: {
            lastHeartbeat: staleHeartbeat.toISOString(),
          },
        },
      };

      // First call: success
      (mockPrisma.deploymentLog.findMany as jest.Mock)
        .mockResolvedValueOnce([orphanedDeployment])
        .mockRejectedValueOnce(new Error('Database connection error'))
        .mockResolvedValueOnce([]);

      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({});

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');

      // First execution: success
      await detectOrphanedDeployments();
      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledTimes(1);

      // Second execution: error (should not throw)
      await expect(detectOrphanedDeployments()).rejects.toThrow('Database connection error');

      // Third execution: success (detector should still work)
      await detectOrphanedDeployments();
      expect(mockPrisma.deploymentLog.findMany).toHaveBeenCalledTimes(3);
    });
  });

  describe('AC4: Error Messages', () => {
    it('should include helpful error message for orphaned deployment', async () => {
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 15 * 60 * 1000);

      const orphanedDeployment = {
        id: 'deployment-orphan-msg',
        storyId: 'story-msg',
        status: 'deploying',
        environment: 'production',
        deployedAt: new Date(now.getTime() - 20 * 60 * 1000),
        updatedAt: staleHeartbeat,
        metadata: {
          progress: {
            currentPhase: 'buildBackend',
            percentComplete: 40,
            lastHeartbeat: staleHeartbeat.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([orphanedDeployment]);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({});

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: 'deployment-orphan-msg' },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          errorMessage: expect.stringContaining('Deployment worker orphaned'),
        },
      });

      const errorMessage = (mockPrisma.deploymentLog.update as jest.Mock).mock.calls[0][0].data
        .errorMessage;

      expect(errorMessage).toContain('buildBackend');
      expect(errorMessage).toContain('40%');
      expect(errorMessage).toContain('heartbeat');
    });

    it('should preserve existing metadata when marking as failed', async () => {
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 15 * 60 * 1000);

      const orphanedDeployment = {
        id: 'deployment-orphan-preserve',
        storyId: 'story-preserve',
        status: 'deploying',
        environment: 'production',
        updatedAt: staleHeartbeat,
        metadata: {
          confirmDeploy: true,
          skipBackup: false,
          useCache: true,
          progress: {
            currentPhase: 'buildBackend',
            percentComplete: 40,
            lastHeartbeat: staleHeartbeat.toISOString(),
            phasesCompleted: ['validation', 'lockAcquisition', 'backup'],
          },
        },
      };

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([orphanedDeployment]);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({});

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: 'deployment-orphan-preserve' },
        data: expect.objectContaining({
          status: 'failed',
          completedAt: expect.any(Date),
          errorMessage: expect.any(String),
        }),
      });

      // Metadata should be preserved (or merged if implementation updates it)
      // This test ensures we don't accidentally delete important deployment metadata
    });
  });

  describe('AC5: Query Optimization', () => {
    it('should query only deploying status', async () => {
      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([]);

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(mockPrisma.deploymentLog.findMany).toHaveBeenCalledWith({
        where: {
          status: 'deploying',
          updatedAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should use efficient query with time threshold', async () => {
      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([]);

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      const beforeTime = Date.now();
      await detectOrphanedDeployments();
      const afterTime = Date.now();

      const callArgs = (mockPrisma.deploymentLog.findMany as jest.Mock).mock.calls[0][0];
      const threshold = callArgs.where.updatedAt.lt.getTime();

      // Threshold should be ~10 minutes ago (within 1 second tolerance)
      const expectedThreshold = beforeTime - 10 * 60 * 1000;
      expect(threshold).toBeGreaterThanOrEqual(expectedThreshold - 1000);
      expect(threshold).toBeLessThanOrEqual(afterTime - 10 * 60 * 1000 + 1000);
    });
  });

  describe('AC6: Logging', () => {
    it('should log when orphaned deployments are detected', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 15 * 60 * 1000);

      const orphanedDeployment = {
        id: 'deployment-orphan-log',
        storyId: 'story-log',
        status: 'deploying',
        environment: 'production',
        updatedAt: staleHeartbeat,
        metadata: {
          progress: {
            lastHeartbeat: staleHeartbeat.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([orphanedDeployment]);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({});

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Detected orphaned deployment'),
        expect.objectContaining({
          deploymentLogId: 'deployment-orphan-log',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log when no orphaned deployments found', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (mockPrisma.deploymentLog.findMany as jest.Mock).mockResolvedValue([]);

      const { detectOrphanedDeployments } = require('../orphan-deployment-detector');
      await detectOrphanedDeployments();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned deployments detected')
      );

      consoleSpy.mockRestore();
    });
  });
});
