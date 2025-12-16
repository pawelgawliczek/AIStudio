/**
 * Unit tests for deployment-worker.ts - ST-268
 *
 * Tests the detached deployment worker process:
 * - Updates DeploymentLog status to 'deploying' on start
 * - Sends heartbeat every 30s
 * - Updates progress on each phase
 * - Handles uncaughtException gracefully
 * - Updates status to 'deployed' on success
 * - Updates status to 'failed' on error
 * - Cleans up on exit
 */

import { PrismaClient } from '@prisma/client';
import { DeploymentService } from '../../services/deployment.service';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../services/deployment.service');

// Mock process.exit
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit: ${code}`);
});

describe('deployment-worker', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockDeploymentService: jest.Mocked<DeploymentService>;
  let mockSetInterval: jest.SpyInstance;
  let mockClearInterval: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock PrismaClient
    mockPrisma = {
      deploymentLog: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      deploymentLock: {
        delete: jest.fn(),
      },
      $disconnect: jest.fn(),
    } as any;

    (PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma);

    // Mock DeploymentService
    mockDeploymentService = {
      deployToProduction: jest.fn(),
    } as any;

    (DeploymentService as jest.MockedClass<typeof DeploymentService>).mockImplementation(
      () => mockDeploymentService
    );

    // Spy on setInterval and clearInterval
    mockSetInterval = jest.spyOn(global, 'setInterval');
    mockClearInterval = jest.spyOn(global, 'clearInterval');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('AC1: Worker Initialization', () => {
    it('should update DeploymentLog status to deploying on start', async () => {
      const deploymentLogId = 'deployment-log-123';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-456',
        prNumber: 42,
        status: 'queued',
        environment: 'production',
        metadata: {
          confirmDeploy: true,
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
        deployedAt: new Date(),
      });

      // Simulate worker initialization
      const { startDeployment } = require('../deployment-worker');
      await startDeployment(deploymentLogId);

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: deploymentLogId },
        data: {
          status: 'deploying',
          deployedAt: expect.any(Date),
          metadata: expect.objectContaining({
            progress: expect.objectContaining({
              currentPhase: 'initialization',
              percentComplete: 0,
              startTime: expect.any(String),
            }),
          }),
        },
      });
    });

    it('should exit with error if deployment log not found', async () => {
      const deploymentLogId = 'non-existent-log';

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(null);

      const { startDeployment } = require('../deployment-worker');

      await expect(startDeployment(deploymentLogId)).rejects.toThrow(
        `process.exit: 1`
      );

      expect(mockPrisma.deploymentLog.update).not.toHaveBeenCalled();
    });

    it('should parse deployment params from metadata', async () => {
      const deploymentLogId = 'deployment-log-params';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-789',
        prNumber: 55,
        status: 'queued',
        environment: 'production',
        metadata: {
          confirmDeploy: true,
          skipBackup: true,
          skipHealthChecks: false,
          useCache: true,
          autoDetectBuilds: false,
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      mockDeploymentService.deployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId,
        storyKey: 'ST-268',
        duration: 600000,
        phases: {},
        warnings: [],
        errors: [],
        message: 'Success',
      } as any);

      const { startDeployment } = require('../deployment-worker');
      await startDeployment(deploymentLogId);

      expect(mockDeploymentService.deployToProduction).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId: 'story-789',
          prNumber: 55,
          confirmDeploy: true,
          skipBackup: true,
          skipHealthChecks: false,
          useCache: true,
          autoDetectBuilds: false,
        })
      );
    });
  });

  describe('AC2: Heartbeat Management', () => {
    it('should send heartbeat every 30 seconds', async () => {
      const deploymentLogId = 'deployment-log-heartbeat';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-heartbeat',
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      // Mock long-running deployment
      mockDeploymentService.deployToProduction.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => resolve({
            success: true,
            deploymentLogId,
            storyKey: 'ST-268',
            duration: 90000,
            phases: {},
            warnings: [],
            errors: [],
            message: 'Success',
          } as any), 90000);
        })
      );

      const { startDeployment } = require('../deployment-worker');
      const deploymentPromise = startDeployment(deploymentLogId);

      // Advance time by 30s (first heartbeat)
      jest.advanceTimersByTime(30000);
      await Promise.resolve(); // Flush promises

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: deploymentLogId },
        data: {
          updatedAt: expect.any(Date),
          metadata: expect.objectContaining({
            progress: expect.objectContaining({
              lastHeartbeat: expect.any(String),
            }),
          }),
        },
      });

      // Advance time by another 30s (second heartbeat)
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledTimes(3); // init + 2 heartbeats

      // Complete deployment
      jest.advanceTimersByTime(30000);
      await deploymentPromise;
    });

    it('should stop heartbeat after deployment completes', async () => {
      const deploymentLogId = 'deployment-log-heartbeat-stop';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-stop',
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      mockDeploymentService.deployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId,
        storyKey: 'ST-268',
        duration: 60000,
        phases: {},
        warnings: [],
        errors: [],
        message: 'Success',
      } as any);

      const { startDeployment } = require('../deployment-worker');
      await startDeployment(deploymentLogId);

      expect(mockClearInterval).toHaveBeenCalled();
    });
  });

  describe('AC3: Progress Updates', () => {
    it('should update progress for each deployment phase', async () => {
      const deploymentLogId = 'deployment-log-progress';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-progress',
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      // Mock deployment service with phase callbacks
      mockDeploymentService.deployToProduction.mockImplementation(async (params: any) => {
        // Simulate phases
        if (params.onProgress) {
          params.onProgress({ phase: 'validation', percentComplete: 10 });
          params.onProgress({ phase: 'lockAcquisition', percentComplete: 15 });
          params.onProgress({ phase: 'backup', percentComplete: 25 });
          params.onProgress({ phase: 'buildBackend', percentComplete: 50 });
          params.onProgress({ phase: 'buildFrontend', percentComplete: 70 });
          params.onProgress({ phase: 'restartBackend', percentComplete: 80 });
          params.onProgress({ phase: 'restartFrontend', percentComplete: 85 });
          params.onProgress({ phase: 'healthChecks', percentComplete: 95 });
          params.onProgress({ phase: 'lockRelease', percentComplete: 100 });
        }

        return {
          success: true,
          deploymentLogId,
          storyKey: 'ST-268',
          duration: 600000,
          phases: {
            validation: { success: true, duration: 1000 },
            lockAcquisition: { success: true, duration: 500 },
            backup: { success: true, duration: 30000 },
            buildBackend: { success: true, duration: 180000 },
            buildFrontend: { success: true, duration: 120000 },
            restartBackend: { success: true, duration: 15000 },
            restartFrontend: { success: true, duration: 12000 },
            healthChecks: { success: true, duration: 60000 },
            lockRelease: { success: true, duration: 500 },
          },
          warnings: [],
          errors: [],
          message: 'Success',
        } as any;
      });

      const { startDeployment } = require('../deployment-worker');
      await startDeployment(deploymentLogId);

      // Verify progress updates for each phase
      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: deploymentLogId },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            progress: expect.objectContaining({
              currentPhase: 'validation',
              percentComplete: 10,
            }),
          }),
        }),
      });

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: deploymentLogId },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            progress: expect.objectContaining({
              currentPhase: 'buildBackend',
              percentComplete: 50,
            }),
          }),
        }),
      });

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: deploymentLogId },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            progress: expect.objectContaining({
              currentPhase: 'healthChecks',
              percentComplete: 95,
            }),
          }),
        }),
      });
    });
  });

  describe('AC4: Success Handling', () => {
    it('should update status to deployed on successful deployment', async () => {
      const deploymentLogId = 'deployment-log-success';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-success',
        prNumber: 99,
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      const mockResult = {
        success: true,
        deploymentLogId,
        storyKey: 'ST-268',
        prNumber: 99,
        duration: 720000,
        lockId: 'lock-123',
        backupFile: '/backups/pre_deployment.dump',
        healthCheckResults: {
          backend: { success: true, consecutiveSuccesses: 3, url: 'http://localhost:3000' },
          frontend: { success: true, consecutiveSuccesses: 3, url: 'http://localhost:5173' },
        },
        phases: {
          validation: { success: true, duration: 1000 },
          lockAcquisition: { success: true, duration: 500 },
          backup: { success: true, duration: 30000 },
          buildBackend: { success: true, duration: 180000 },
          buildFrontend: { success: true, duration: 120000 },
          restartBackend: { success: true, duration: 15000 },
          restartFrontend: { success: true, duration: 12000 },
          healthChecks: { success: true, duration: 60000 },
          lockRelease: { success: true, duration: 500 },
        },
        warnings: [],
        errors: [],
        message: 'Deployment successful',
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      mockDeploymentService.deployToProduction.mockResolvedValue(mockResult as any);

      const { startDeployment } = require('../deployment-worker');
      await startDeployment(deploymentLogId);

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: deploymentLogId },
        data: {
          status: 'deployed',
          completedAt: expect.any(Date),
          metadata: expect.objectContaining({
            result: mockResult,
          }),
        },
      });
    });
  });

  describe('AC5: Failure Handling', () => {
    it('should update status to failed on deployment error', async () => {
      const deploymentLogId = 'deployment-log-failed';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-failed',
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      const mockResult = {
        success: false,
        deploymentLogId,
        storyKey: 'ST-268',
        duration: 300000,
        phases: {
          validation: { success: true, duration: 1000 },
          lockAcquisition: { success: true, duration: 500 },
          backup: { success: true, duration: 30000 },
          buildBackend: { success: true, duration: 120000 },
          buildFrontend: { success: false, duration: 90000, error: 'Build failed' },
          restartBackend: { success: false, duration: 0 },
          restartFrontend: { success: false, duration: 0 },
          healthChecks: { success: false, duration: 0 },
          lockRelease: { success: true, duration: 500 },
          rollback: { success: true, duration: 25000 },
        },
        warnings: [],
        errors: ['Build failed: Frontend container build error'],
        message: 'Deployment failed',
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      mockDeploymentService.deployToProduction.mockResolvedValue(mockResult as any);

      const { startDeployment } = require('../deployment-worker');
      await startDeployment(deploymentLogId);

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: deploymentLogId },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          errorMessage: 'Build failed: Frontend container build error',
          metadata: expect.objectContaining({
            result: mockResult,
          }),
        },
      });
    });

    it('should handle uncaught exceptions gracefully', async () => {
      const deploymentLogId = 'deployment-log-exception';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-exception',
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      mockDeploymentService.deployToProduction.mockRejectedValue(
        new Error('Unexpected error during deployment')
      );

      const { startDeployment } = require('../deployment-worker');

      await expect(startDeployment(deploymentLogId)).rejects.toThrow();

      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: deploymentLogId },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          errorMessage: expect.stringContaining('Unexpected error during deployment'),
        },
      });
    });
  });

  describe('AC6: Cleanup and Exit', () => {
    it('should disconnect Prisma on exit', async () => {
      const deploymentLogId = 'deployment-log-cleanup';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-cleanup',
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      mockDeploymentService.deployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId,
        storyKey: 'ST-268',
        duration: 600000,
        phases: {},
        warnings: [],
        errors: [],
        message: 'Success',
      } as any);

      const { startDeployment } = require('../deployment-worker');
      await startDeployment(deploymentLogId);

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should exit with code 0 on success', async () => {
      const deploymentLogId = 'deployment-log-exit-success';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-exit',
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      mockDeploymentService.deployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId,
        storyKey: 'ST-268',
        duration: 600000,
        phases: {},
        warnings: [],
        errors: [],
        message: 'Success',
      } as any);

      const { startDeployment } = require('../deployment-worker');

      await expect(startDeployment(deploymentLogId)).rejects.toThrow('process.exit: 0');
    });

    it('should exit with code 1 on failure', async () => {
      const deploymentLogId = 'deployment-log-exit-failure';

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-exit-fail',
        status: 'queued',
        environment: 'production',
        metadata: { confirmDeploy: true },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);
      (mockPrisma.deploymentLog.update as jest.Mock).mockResolvedValue({
        ...mockDeploymentLog,
        status: 'deploying',
      });

      mockDeploymentService.deployToProduction.mockRejectedValue(
        new Error('Deployment failed')
      );

      const { startDeployment } = require('../deployment-worker');

      await expect(startDeployment(deploymentLogId)).rejects.toThrow('process.exit: 1');
    });
  });
});
