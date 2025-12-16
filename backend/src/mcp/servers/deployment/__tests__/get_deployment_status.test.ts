/**
 * Unit tests for get_deployment_status MCP tool - ST-268
 *
 * Tests the deployment status polling feature:
 * - Returns current deployment status
 * - Returns progress info (currentPhase, percentComplete)
 * - Returns 404 for invalid deploymentId
 * - Returns final result when complete (success/failure)
 */

import { PrismaClient } from '@prisma/client';
import { handler, GetDeploymentStatusParams } from '../get_deployment_status';
import { NotFoundError } from '../../../types';

// Mock PrismaClient
const mockPrisma = {
  deploymentLog: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('get_deployment_status MCP tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AC1: Returns Current Status', () => {
    it('should return queued status for pending deployment', async () => {
      const deploymentLogId = 'deployment-log-123';
      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-456',
        status: 'queued',
        environment: 'production',
        prNumber: 42,
        deployedBy: 'test-user',
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {
          confirmDeploy: true,
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result).toMatchObject({
        deploymentLogId,
        status: 'queued',
        environment: 'production',
        prNumber: 42,
        deployedBy: 'test-user',
        isComplete: false,
      });
    });

    it('should return deploying status with progress info', async () => {
      const deploymentLogId = 'deployment-log-deploying';
      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-789',
        status: 'deploying',
        environment: 'production',
        prNumber: 55,
        deployedBy: 'claude-agent',
        deployedAt: new Date('2025-01-15T10:01:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:05:00Z'),
        metadata: {
          progress: {
            currentPhase: 'buildBackend',
            percentComplete: 45,
            phasesCompleted: ['validation', 'lockAcquisition', 'backup'],
            startTime: '2025-01-15T10:01:00Z',
            lastHeartbeat: '2025-01-15T10:05:00Z',
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result).toMatchObject({
        deploymentLogId,
        status: 'deploying',
        isComplete: false,
        progress: {
          currentPhase: 'buildBackend',
          percentComplete: 45,
          phasesCompleted: ['validation', 'lockAcquisition', 'backup'],
          elapsedSeconds: expect.any(Number),
          lastHeartbeat: '2025-01-15T10:05:00Z',
        },
      });
    });
  });

  describe('AC2: Returns Final Result for Completed Deployments', () => {
    it('should return success result for deployed status', async () => {
      const deploymentLogId = 'deployment-log-success';
      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-success',
        status: 'deployed',
        environment: 'production',
        prNumber: 99,
        commitHash: 'abc1234',
        deployedBy: 'success-user',
        deployedAt: new Date('2025-01-15T10:00:00Z'),
        completedAt: new Date('2025-01-15T10:12:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:12:00Z'),
        metadata: {
          result: {
            success: true,
            duration: 720000,
            backupFile: '/backups/pre_deployment_ST-268.dump',
            healthCheckResults: {
              backend: { success: true, consecutiveSuccesses: 3 },
              frontend: { success: true, consecutiveSuccesses: 3 },
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
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result).toMatchObject({
        deploymentLogId,
        status: 'deployed',
        isComplete: true,
        success: true,
        result: {
          success: true,
          duration: 720000,
          backupFile: '/backups/pre_deployment_ST-268.dump',
          healthCheckResults: expect.any(Object),
          phases: expect.any(Object),
        },
      });
    });

    it('should return failure result for failed status', async () => {
      const deploymentLogId = 'deployment-log-failed';
      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-failed',
        status: 'failed',
        environment: 'production',
        prNumber: 88,
        deployedBy: 'fail-user',
        deployedAt: new Date('2025-01-15T10:00:00Z'),
        completedAt: new Date('2025-01-15T10:05:00Z'),
        errorMessage: 'Build failed: Frontend container build error',
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:05:00Z'),
        metadata: {
          result: {
            success: false,
            duration: 300000,
            errors: ['Build failed: Frontend container build error'],
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
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result).toMatchObject({
        deploymentLogId,
        status: 'failed',
        isComplete: true,
        success: false,
        errorMessage: 'Build failed: Frontend container build error',
        result: {
          success: false,
          duration: 300000,
          errors: ['Build failed: Frontend container build error'],
          phases: expect.objectContaining({
            rollback: { success: true, duration: 25000 },
          }),
        },
      });
    });

    it('should return rolled_back status with failure details', async () => {
      const deploymentLogId = 'deployment-log-rollback';
      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-rollback',
        status: 'rolled_back',
        environment: 'production',
        prNumber: 77,
        deployedBy: 'rollback-user',
        deployedAt: new Date('2025-01-15T10:00:00Z'),
        completedAt: new Date('2025-01-15T10:08:00Z'),
        errorMessage: 'Health checks failed after deployment',
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:08:00Z'),
        metadata: {
          result: {
            success: false,
            duration: 480000,
            errors: ['Health checks failed: Backend not responding'],
            phases: {
              validation: { success: true, duration: 1000 },
              lockAcquisition: { success: true, duration: 500 },
              backup: { success: true, duration: 30000 },
              buildBackend: { success: true, duration: 180000 },
              buildFrontend: { success: true, duration: 120000 },
              restartBackend: { success: true, duration: 15000 },
              restartFrontend: { success: true, duration: 12000 },
              healthChecks: { success: false, duration: 90000, error: 'Backend not responding' },
              rollback: { success: true, duration: 30000 },
              lockRelease: { success: true, duration: 500 },
            },
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result).toMatchObject({
        deploymentLogId,
        status: 'rolled_back',
        isComplete: true,
        success: false,
        errorMessage: 'Health checks failed after deployment',
      });
    });
  });

  describe('AC3: 404 for Invalid Deployment ID', () => {
    it('should throw NotFoundError for non-existent deployment', async () => {
      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(null);

      const params: GetDeploymentStatusParams = {
        deploymentLogId: 'non-existent-id',
      };

      await expect(handler(mockPrisma, params)).rejects.toThrow(NotFoundError);
      await expect(handler(mockPrisma, params)).rejects.toThrow(
        'Deployment with ID non-existent-id not found'
      );
    });

    it('should validate UUID format', async () => {
      const params: GetDeploymentStatusParams = {
        deploymentLogId: 'invalid-uuid-format',
      };

      await expect(handler(mockPrisma, params)).rejects.toThrow(
        'Invalid deploymentLogId format'
      );
    });
  });

  describe('AC4: Heartbeat Monitoring', () => {
    it('should include heartbeat freshness indicator', async () => {
      const deploymentLogId = 'deployment-log-heartbeat';
      const now = new Date();
      const recentHeartbeat = new Date(now.getTime() - 15000); // 15 seconds ago

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-heartbeat',
        status: 'deploying',
        environment: 'production',
        deployedAt: new Date(now.getTime() - 120000), // Started 2 min ago
        createdAt: new Date(now.getTime() - 120000),
        updatedAt: recentHeartbeat,
        metadata: {
          progress: {
            currentPhase: 'buildFrontend',
            percentComplete: 60,
            lastHeartbeat: recentHeartbeat.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result.progress).toMatchObject({
        lastHeartbeat: recentHeartbeat.toISOString(),
        heartbeatFresh: true, // < 60s ago
      });
    });

    it('should flag stale heartbeat', async () => {
      const deploymentLogId = 'deployment-log-stale';
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 180000); // 3 minutes ago

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-stale',
        status: 'deploying',
        environment: 'production',
        deployedAt: new Date(now.getTime() - 600000), // Started 10 min ago
        createdAt: new Date(now.getTime() - 600000),
        updatedAt: staleHeartbeat,
        metadata: {
          progress: {
            currentPhase: 'healthChecks',
            percentComplete: 85,
            lastHeartbeat: staleHeartbeat.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result.progress).toMatchObject({
        lastHeartbeat: staleHeartbeat.toISOString(),
        heartbeatFresh: false, // > 60s ago
      });

      expect(result.warnings).toContainEqual(
        expect.stringContaining('No heartbeat for')
      );
    });
  });

  describe('AC5: Progress Calculation', () => {
    it('should calculate elapsed time', async () => {
      const deploymentLogId = 'deployment-log-elapsed';
      const deployedAt = new Date('2025-01-15T10:00:00Z');

      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-elapsed',
        status: 'deploying',
        environment: 'production',
        deployedAt,
        createdAt: new Date('2025-01-15T09:59:00Z'),
        updatedAt: new Date('2025-01-15T10:05:00Z'),
        metadata: {
          progress: {
            currentPhase: 'restartBackend',
            percentComplete: 75,
            startTime: deployedAt.toISOString(),
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result.progress).toHaveProperty('elapsedSeconds');
      expect(result.progress?.elapsedSeconds).toBeGreaterThan(0);
    });

    it('should include estimated time remaining', async () => {
      const deploymentLogId = 'deployment-log-eta';
      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-eta',
        status: 'deploying',
        environment: 'production',
        deployedAt: new Date('2025-01-15T10:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:05:00Z'),
        metadata: {
          progress: {
            currentPhase: 'buildFrontend',
            percentComplete: 50,
            startTime: '2025-01-15T10:00:00Z',
            estimatedRemainingSeconds: 300, // 5 minutes
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
      };

      const result = await handler(mockPrisma, params);

      expect(result.progress).toMatchObject({
        percentComplete: 50,
        estimatedRemainingSeconds: 300,
      });
    });
  });

  describe('AC6: Optional includeResult Parameter', () => {
    it('should exclude result details by default for completed deployments', async () => {
      const deploymentLogId = 'deployment-log-no-result';
      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-completed',
        status: 'deployed',
        environment: 'production',
        prNumber: 100,
        deployedBy: 'test-user',
        deployedAt: new Date('2025-01-15T10:00:00Z'),
        completedAt: new Date('2025-01-15T10:12:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:12:00Z'),
        metadata: {
          result: {
            success: true,
            duration: 720000,
            phases: { /* large object */ },
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
        includeResult: false,
      };

      const result = await handler(mockPrisma, params);

      expect(result).toMatchObject({
        deploymentLogId,
        status: 'deployed',
        isComplete: true,
        success: true,
      });

      expect(result.result).toBeUndefined();
    });

    it('should include full result when includeResult=true', async () => {
      const deploymentLogId = 'deployment-log-with-result';
      const mockDeploymentLog = {
        id: deploymentLogId,
        storyId: 'story-with-result',
        status: 'deployed',
        environment: 'production',
        prNumber: 101,
        completedAt: new Date('2025-01-15T10:12:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T10:12:00Z'),
        metadata: {
          result: {
            success: true,
            duration: 720000,
            backupFile: '/backups/backup.dump',
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
          },
        },
      };

      (mockPrisma.deploymentLog.findUnique as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const params: GetDeploymentStatusParams = {
        deploymentLogId,
        includeResult: true,
      };

      const result = await handler(mockPrisma, params);

      expect(result).toMatchObject({
        deploymentLogId,
        status: 'deployed',
        isComplete: true,
        success: true,
        result: {
          success: true,
          duration: 720000,
          backupFile: '/backups/backup.dump',
          phases: expect.any(Object),
        },
      });
    });
  });
});
