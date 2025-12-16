/**
 * Unit tests for deploy_to_production MCP tool - ST-268 (Async Deployment)
 *
 * Tests the async deployment feature:
 * - Returns immediately with deploymentLogId and polling info
 * - Spawns detached worker process
 * - Creates DeploymentLog with status='queued'
 * - Validates required params (storyId, confirmDeploy)
 * - Rejects if lock already held
 */

import { PrismaClient } from '@prisma/client';
import { ChildProcess } from 'child_process';
import { handler, DeployToProductionParams } from '../deploy_to_production';
import { ValidationError } from '../../../types';

// Mock child_process
jest.mock('child_process', () => ({
  fork: jest.fn(),
}));

// Mock PrismaClient
const mockPrisma = {
  deploymentLog: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  deploymentLock: {
    findFirst: jest.fn(),
  },
  story: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock fork from child_process
const mockFork = require('child_process').fork as jest.Mock;

describe('deploy_to_production (ST-268: Async Mode)', () => {
  let mockChildProcess: Partial<ChildProcess>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock child process
    mockChildProcess = {
      pid: 12345,
      unref: jest.fn(),
      on: jest.fn(),
      send: jest.fn(),
    };

    // Mock fork to return child process
    mockFork.mockReturnValue(mockChildProcess);
  });

  describe('AC1: Immediate Return with deploymentLogId', () => {
    it('should return immediately with async response', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-123',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const startTime = Date.now();
      const result = await handler(mockPrisma, params);
      const duration = Date.now() - startTime;

      // Should return in < 2 seconds (immediate response)
      expect(duration).toBeLessThan(2000);

      // Should return async response structure
      expect(result).toMatchObject({
        success: true,
        async: true,
        deploymentLogId: 'deployment-log-123',
        status: 'queued',
        message: expect.stringContaining('Deployment started in background'),
      });
    });

    it('should include polling information in response', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-456',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const result = await handler(mockPrisma, params);

      expect(result).toMatchObject({
        deploymentLogId: 'deployment-log-456',
        pollUrl: expect.stringContaining('/api/deployment/deployment-log-456/status'),
        pollIntervalMs: 5000,
        pollToolName: 'get_deployment_status',
      });
    });
  });

  describe('AC2: DeploymentLog Creation with status=queued', () => {
    it('should create DeploymentLog with status=queued', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        triggeredBy: 'test-user',
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-789',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      await handler(mockPrisma, params);

      expect(mockPrisma.deploymentLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storyId: params.storyId,
          prNumber: 42,
          status: 'queued',
          environment: 'production',
          deployedBy: 'test-user',
          approvalMethod: 'PR',
          metadata: expect.objectContaining({
            confirmDeploy: true,
            skipBackup: false,
            skipHealthChecks: false,
          }),
        }),
      });
    });

    it('should record direct commit mode in DeploymentLog', async () => {
      const params: DeployToProductionParams = {
        storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
        directCommit: true,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-84',
        status: 'qa',
        manualApproval: true,
        approvedAt: new Date(),
        approvalExpiresAt: new Date(Date.now() + 3600000),
      };

      const mockDeploymentLog = {
        id: 'deployment-log-direct',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      await handler(mockPrisma, params);

      expect(mockPrisma.deploymentLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storyId: params.storyId,
          prNumber: undefined,
          status: 'queued',
          environment: 'production',
          approvalMethod: 'MANUAL',
          metadata: expect.objectContaining({
            directCommit: true,
          }),
        }),
      });
    });
  });

  describe('AC3: Worker Process Spawning', () => {
    it('should spawn child process with correct worker script', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-worker-1',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      await handler(mockPrisma, params);

      expect(mockFork).toHaveBeenCalledWith(
        expect.stringContaining('deployment-worker'),
        expect.arrayContaining([
          '--deploymentLogId',
          'deployment-log-worker-1',
        ]),
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      );
    });

    it('should call unref() to detach child process', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-unref',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      await handler(mockPrisma, params);

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });

    it('should pass all deployment params to worker', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        triggeredBy: 'claude-agent',
        skipBackup: false,
        skipHealthChecks: false,
        useCache: true,
        autoDetectBuilds: true,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-params',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      await handler(mockPrisma, params);

      expect(mockFork).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          '--useCache',
          'true',
          '--autoDetectBuilds',
          'true',
        ]),
        expect.any(Object)
      );
    });
  });

  describe('AC4: Parameter Validation', () => {
    it('should reject deployment without confirmDeploy flag', async () => {
      const params: any = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: false,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('confirmDeploy'));
    });

    it('should reject deployment with invalid UUID', async () => {
      const params: any = {
        storyId: 'invalid-uuid',
        prNumber: 42,
        confirmDeploy: true,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Invalid storyId format'));
    });

    it('should reject if missing required storyId', async () => {
      const params: any = {
        prNumber: 42,
        confirmDeploy: true,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('storyId'));
    });

    it('should reject if both prNumber and directCommit are provided', async () => {
      const params: any = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        directCommit: true,
        confirmDeploy: true,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Cannot use both prNumber and directCommit')
      );
    });

    it('should reject if neither prNumber nor directCommit provided', async () => {
      const params: any = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        confirmDeploy: true,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Must provide either prNumber')
      );
    });
  });

  describe('AC5: Lock Validation Before Queuing', () => {
    it('should reject if deployment lock is already held', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const existingLock = {
        id: 'lock-123',
        heldBy: 'other-user',
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(existingLock);

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('deployment locked by other-user')
      );

      // Should NOT create deployment log or spawn worker
      expect(mockPrisma.deploymentLog.create).not.toHaveBeenCalled();
      expect(mockFork).not.toHaveBeenCalled();
    });

    it('should allow queuing if lock is expired', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const expiredLock = {
        id: 'lock-expired',
        heldBy: 'old-user',
        expiresAt: new Date(Date.now() - 1000), // Expired
        createdAt: new Date(Date.now() - 1800000),
      };

      const mockDeploymentLog = {
        id: 'deployment-log-after-expired',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(expiredLock);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(mockPrisma.deploymentLog.create).toHaveBeenCalled();
      expect(mockFork).toHaveBeenCalled();
    });
  });

  describe('AC6: Worker Spawn Failure Handling', () => {
    it('should handle fork failure gracefully', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-fork-fail',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      // Mock fork to throw error
      mockFork.mockImplementation(() => {
        throw new Error('Failed to spawn worker process');
      });

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Failed to spawn worker process')
      );
    });

    it('should log worker PID on successful spawn', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-pid',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      await handler(mockPrisma, params);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Worker spawned with PID: 12345')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('AC7: Backward Compatibility with ST-77, ST-84, ST-115', () => {
    it('should support all legacy parameters', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        triggeredBy: 'legacy-user',
        skipBackup: true,
        skipHealthChecks: true,
        skipBackendBuild: false,
        skipFrontendBuild: true,
        useCache: true,
        autoDetectBuilds: false,
        confirmDeploy: true,
      };

      const mockStory = {
        id: params.storyId,
        key: 'ST-268',
        status: 'qa',
      };

      const mockDeploymentLog = {
        id: 'deployment-log-legacy',
        storyId: params.storyId,
        status: 'queued',
        environment: 'production',
        createdAt: new Date(),
      };

      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.deploymentLock.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.deploymentLog.create as jest.Mock).mockResolvedValue(mockDeploymentLog);

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(mockPrisma.deploymentLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            skipBackup: true,
            skipHealthChecks: true,
            skipBackendBuild: false,
            skipFrontendBuild: true,
            useCache: true,
            autoDetectBuilds: false,
          }),
        }),
      });
    });
  });
});
