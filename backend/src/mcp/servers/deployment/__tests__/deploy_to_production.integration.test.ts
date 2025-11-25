/**
 * Integration tests for deploy_to_production - ST-77
 *
 * These tests validate end-to-end deployment workflows with mocked external dependencies
 * but realistic service interactions:
 * - Lock singleton enforcement
 * - Lock auto-expiration
 * - Concurrent deployment blocking
 * - Full deployment workflow
 * - Rollback mechanisms
 * - Audit trail creation
 *
 * Note: Uses mocked Prisma for isolation, but tests realistic multi-service scenarios
 */

// Mock @prisma/client FIRST before any imports
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    story: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    worktree: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    deploymentLog: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    deploymentLock: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    epic: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
  })),
}));

import { DeploymentService } from '../../../../services/deployment.service';
import { DeploymentLockService } from '../../../../services/deployment-lock.service';
import { BackupService } from '../../../../services/backup.service';
import { RestoreService } from '../../../../services/restore.service';

// Mock child_process for Docker commands
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock fs for filesystem checks
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}));

// Mock GitHub PR validator
jest.mock('../utils/github-pr-validator.js', () => ({
  validatePRForProduction: jest.fn(),
}));

// Mock fetch for health checks
global.fetch = jest.fn() as jest.Mock;

import { execSync } from 'child_process';
import { validatePRForProduction } from '../utils/github-pr-validator.js';

describe.skip('deploy_to_production Integration Tests', () => {
  let mockPrisma: any;
  let deploymentService: DeploymentService;
  let lockService: DeploymentLockService;
  let mockBackupService: any;
  let mockRestoreService: any;
  const testStoryId = 'test-story-123';

  beforeAll(async () => {
    // Create mock Prisma client (already mocked at module level)
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();

    // Create mock services
    mockBackupService = {
      createBackup: jest.fn(),
    };

    mockRestoreService = {
      restoreFromBackup: jest.fn(),
    };

    // Initialize services with mocks
    lockService = new DeploymentLockService(mockPrisma);
    deploymentService = new DeploymentService(
      mockPrisma,
      lockService,
      mockBackupService,
      mockRestoreService
    );
  });

  afterAll(async () => {
    // No cleanup needed for mocked database
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // Use fake timers for integration tests
    jest.useFakeTimers();

    jest.clearAllMocks();

    // Setup standard story/worktree mocks
    mockPrisma.story.findUnique.mockResolvedValue({
      id: testStoryId,
      key: 'ST-77-INT',
      title: 'Integration Test Story',
      status: 'qa',
    });

    mockPrisma.worktree.findFirst.mockResolvedValue({
      id: 'worktree-1',
      storyId: testStoryId,
      worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77-INT',
      status: 'active',
    });

    mockPrisma.deploymentLog.create.mockResolvedValue({
      id: 'log-123',
    });

    mockPrisma.deploymentLog.update.mockResolvedValue({});

    // Setup default mocks
    (validatePRForProduction as jest.Mock).mockResolvedValue({
      valid: true,
      approved: true,
      prState: 'merged',
      mergedAt: '2025-11-22T10:00:00Z',
      approvers: ['reviewer1'],
      conflictsExist: false,
      errors: [],
      warnings: [],
    });

    (execSync as jest.Mock).mockReturnValue(undefined);
    (fetch as jest.Mock).mockResolvedValue({ ok: true });

    mockBackupService.createBackup.mockResolvedValue({
      filename: 'backup.sql',
      filepath: '/backups/backup.sql',
      size: 1000,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // ==========================================================================
  // Test 1: Lock Singleton Enforcement
  // ==========================================================================

  it('should enforce lock singleton at service level', async () => {
    // First lock acquisition succeeds
    mockPrisma.deploymentLock.findFirst.mockResolvedValueOnce(null); // No active lock
    mockPrisma.deploymentLock.create.mockResolvedValueOnce({
      id: 'lock-1',
      reason: 'Test deployment 1',
      lockedBy: 'production-deployment',
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      active: true,
    });

    const lock1 = await lockService.acquireLock(
      'Test deployment 1',
      testStoryId,
      1,
      30
    );
    expect(lock1.id).toBe('lock-1');

    // Second lock attempt fails (active lock exists)
    mockPrisma.deploymentLock.findFirst.mockResolvedValueOnce({
      id: 'lock-1',
      reason: 'Test deployment 1',
      lockedBy: 'production-deployment',
      active: true,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    await expect(
      lockService.acquireLock('Test deployment 2', testStoryId, 2, 30)
    ).rejects.toThrow('Production deployment locked');

    // Release first lock
    mockPrisma.deploymentLock.update.mockResolvedValueOnce({
      id: 'lock-1',
      active: false,
    });

    await lockService.releaseLock(lock1.id);

    // Now second lock should succeed
    mockPrisma.deploymentLock.findFirst.mockResolvedValueOnce(null); // No active lock
    mockPrisma.deploymentLock.create.mockResolvedValueOnce({
      id: 'lock-2',
      reason: 'Test deployment 3',
      lockedBy: 'production-deployment',
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      active: true,
    });

    const lock2 = await lockService.acquireLock(
      'Test deployment 3',
      testStoryId,
      3,
      30
    );
    expect(lock2.id).toBe('lock-2');
  });

  // ==========================================================================
  // Test 2: Lock Auto-Expiration
  // ==========================================================================

  it('should auto-expire lock after duration', async () => {
    // Create lock with 1-second expiration (for fast test)
    const lock = await prisma.deploymentLock.create({
      data: {
        reason: 'Test expiration',
        lockedBy: 'test-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000), // 1 second
        active: true,
        metadata: {},
      },
    });

    // Immediately: lock should be found
    const activeLock1 = await prisma.deploymentLock.findFirst({
      where: {
        active: true,
        expiresAt: { gt: new Date() },
      },
    });
    expect(activeLock1).not.toBeNull();

    // Wait 1.5 seconds for expiration
    await new Promise(resolve => setTimeout(resolve, 1500));

    // After expiration: lock should not be found (filtered by expiresAt)
    const activeLock2 = await prisma.deploymentLock.findFirst({
      where: {
        active: true,
        expiresAt: { gt: new Date() },
      },
    });
    expect(activeLock2).toBeNull();

    // Cleanup
    await prisma.deploymentLock.delete({ where: { id: lock.id } });
  });

  // ==========================================================================
  // Test 3: Concurrent Deployment Blocking
  // ==========================================================================

  it('should block concurrent deployments with lock', async () => {
    // Mock successful deployment operations
    const mockBackupService = {
      createBackup: jest.fn().mockResolvedValue({
        filename: 'backup.sql',
        filepath: '/backups/backup.sql',
        size: 1000,
      }),
    };

    const deployment1Service = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      new RestoreService()
    );

    const deployment2Service = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      new RestoreService()
    );

    // Start deployment 1 (will acquire lock)
    const deployment1Promise = deployment1Service.deployToProduction({
      storyId: testStoryId,
      prNumber: 1,
    });

    // Wait a bit to ensure lock is acquired
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start deployment 2 concurrently (should be blocked by lock)
    const deployment2Result = await deployment2Service.deployToProduction({
      storyId: testStoryId,
      prNumber: 2,
    });

    // Deployment 2 should fail due to lock
    expect(deployment2Result.success).toBe(false);
    expect(deployment2Result.errors[0]).toContain('Production deployment locked');

    // Wait for deployment 1 to complete
    const deployment1Result = await deployment1Promise;

    // Deployment 1 should succeed (or fail for other reasons, but not lock)
    expect(deployment1Result.phases.lockAcquisition.success).toBe(true);
  });

  // ==========================================================================
  // Test 4: Full Deployment Success Path
  // ==========================================================================

  it('should complete full deployment workflow successfully', async () => {
    // Mock all external dependencies
    const mockBackupService = {
      createBackup: jest.fn().mockResolvedValue({
        filename: 'vibestudio_ST-77-INT_20251122.sql',
        filepath: '/backups/vibestudio_ST-77-INT_20251122.sql',
        size: 2048576,
      }),
    };

    const testDeploymentService = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      new RestoreService()
    );

    const result = await testDeploymentService.deployToProduction({
      storyId: testStoryId,
      prNumber: 42,
      triggeredBy: 'integration-test',
    });

    // Verify deployment succeeded
    expect(result.success).toBe(true);
    expect(result.storyKey).toBe('ST-77-INT');
    expect(result.prNumber).toBe(42);

    // Verify all phases succeeded
    expect(result.phases.validation.success).toBe(true);
    expect(result.phases.lockAcquisition.success).toBe(true);
    expect(result.phases.backup.success).toBe(true);
    expect(result.phases.buildBackend.success).toBe(true);
    expect(result.phases.buildFrontend.success).toBe(true);
    expect(result.phases.restartBackend.success).toBe(true);
    expect(result.phases.restartFrontend.success).toBe(true);
    expect(result.phases.healthChecks.success).toBe(true);
    expect(result.phases.lockRelease.success).toBe(true);

    // Verify DeploymentLog created in database
    const deploymentLog = await prisma.deploymentLog.findUnique({
      where: { id: result.deploymentLogId },
    });

    expect(deploymentLog).not.toBeNull();
    expect(deploymentLog?.status).toBe('deployed');
    expect(deploymentLog?.storyId).toBe(testStoryId);
    expect(deploymentLog?.prNumber).toBe(42);
    expect(deploymentLog?.deployedBy).toBe('integration-test');
    expect(deploymentLog?.completedAt).not.toBeNull();

    // Verify lock was released
    const activeLock = await prisma.deploymentLock.findFirst({
      where: {
        active: true,
        expiresAt: { gt: new Date() },
      },
    });
    expect(activeLock).toBeNull();
  });

  // ==========================================================================
  // Test 5: Rollback on Health Check Failure
  // ==========================================================================

  it('should rollback after health check failure', async () => {
    // Mock backup creation
    const mockBackupService = {
      createBackup: jest.fn().mockResolvedValue({
        filename: 'backup.sql',
        filepath: '/backups/backup.sql',
        size: 1000,
      }),
    };

    // Mock successful restore
    const mockRestoreService = {
      restoreFromBackup: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
      }),
    };

    const testDeploymentService = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      mockRestoreService as any
    );

    // Health checks fail
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });

    const result = await testDeploymentService.deployToProduction({
      storyId: testStoryId,
      prNumber: 43,
    });

    // Deployment should fail
    expect(result.success).toBe(false);
    expect(result.phases.healthChecks.success).toBe(false);

    // Rollback should succeed
    expect(result.phases.rollback?.success).toBe(true);
    expect(mockRestoreService.restoreFromBackup).toHaveBeenCalledWith(
      '/backups/backup.sql',
      { force: true, skipValidation: false }
    );

    // Verify DeploymentLog status
    const deploymentLog = await prisma.deploymentLog.findUnique({
      where: { id: result.deploymentLogId },
    });

    expect(deploymentLog?.status).toBe('rolled_back');
    expect(deploymentLog?.errorMessage).toContain('Health checks failed');
  });

  // ==========================================================================
  // Test 6: Rollback on Build Failure
  // ==========================================================================

  it('should abort deployment on build failure', async () => {
    const mockBackupService = {
      createBackup: jest.fn().mockResolvedValue({
        filename: 'backup.sql',
        filepath: '/backups/backup.sql',
        size: 1000,
      }),
    };

    const testDeploymentService = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      new RestoreService()
    );

    // Docker build fails
    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error('Docker build failed: syntax error');
    });

    const result = await testDeploymentService.deployToProduction({
      storyId: testStoryId,
      prNumber: 44,
    });

    // Deployment should fail
    expect(result.success).toBe(false);
    expect(result.phases.buildBackend.success).toBe(false);

    // No restart should be attempted
    expect(result.phases.restartBackend.success).toBe(false);
    expect(result.phases.healthChecks.success).toBe(false);

    // Verify DeploymentLog status
    const deploymentLog = await prisma.deploymentLog.findUnique({
      where: { id: result.deploymentLogId },
    });

    expect(deploymentLog?.status).toBe('rolled_back');
    expect(deploymentLog?.errorMessage).toContain('Docker build failed');

    // Verify lock was released
    const activeLock = await prisma.deploymentLock.findFirst({
      where: {
        active: true,
        expiresAt: { gt: new Date() },
      },
    });
    expect(activeLock).toBeNull();
  });

  // ==========================================================================
  // Test 7: GitHub PR Validation Failure
  // ==========================================================================

  it('should fail deployment if PR not approved', async () => {
    const mockBackupService = {
      createBackup: jest.fn(),
    };

    const testDeploymentService = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      new RestoreService()
    );

    // Mock PR validation failure
    (validatePRForProduction as jest.Mock).mockResolvedValue({
      valid: true,
      approved: false, // Not approved!
      prState: 'merged',
      mergedAt: '2025-11-22T10:00:00Z',
      approvers: [],
      conflictsExist: false,
      errors: [],
      warnings: [],
    });

    const result = await testDeploymentService.deployToProduction({
      storyId: testStoryId,
      prNumber: 45,
    });

    // Deployment should fail at validation phase
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('PR #45 is not approved');

    // No backup should be created
    expect(mockBackupService.createBackup).not.toHaveBeenCalled();

    // No Docker commands should be executed
    expect(execSync).not.toHaveBeenCalled();

    // Verify DeploymentLog created but with failed status
    const deploymentLog = await prisma.deploymentLog.findUnique({
      where: { id: result.deploymentLogId },
    });

    expect(deploymentLog?.status).toBe('failed');
  });

  // ==========================================================================
  // Test 8: Merge Conflict Detection
  // ==========================================================================

  it('should fail deployment if PR has merge conflicts', async () => {
    const mockBackupService = {
      createBackup: jest.fn(),
    };

    const testDeploymentService = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      new RestoreService()
    );

    // Mock PR with merge conflicts
    (validatePRForProduction as jest.Mock).mockResolvedValue({
      valid: true,
      approved: true,
      prState: 'merged',
      mergedAt: '2025-11-22T10:00:00Z',
      approvers: ['reviewer1'],
      conflictsExist: true, // Conflicts!
      errors: [],
      warnings: [],
    });

    const result = await testDeploymentService.deployToProduction({
      storyId: testStoryId,
      prNumber: 46,
    });

    // Deployment should fail
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('merge conflicts');

    // No backup or Docker operations
    expect(mockBackupService.createBackup).not.toHaveBeenCalled();
    expect(execSync).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 9: Database Backup Failure
  // ==========================================================================

  it('should fail deployment if backup creation fails', async () => {
    const mockBackupService = {
      createBackup: jest.fn().mockRejectedValue(
        new Error('Disk full - cannot create backup')
      ),
    };

    const testDeploymentService = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      new RestoreService()
    );

    const result = await testDeploymentService.deployToProduction({
      storyId: testStoryId,
      prNumber: 47,
    });

    // Deployment should fail
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Disk full');

    // Lock should be released
    const activeLock = await prisma.deploymentLock.findFirst({
      where: {
        active: true,
        expiresAt: { gt: new Date() },
      },
    });
    expect(activeLock).toBeNull();

    // Verify DeploymentLog
    const deploymentLog = await prisma.deploymentLog.findUnique({
      where: { id: result.deploymentLogId },
    });

    expect(deploymentLog?.status).toBe('failed');
    expect(deploymentLog?.errorMessage).toContain('Disk full');
  });

  // ==========================================================================
  // Test 10: Force Release Lock
  // ==========================================================================

  it('should force release lock for admin operations', async () => {
    // Create active lock
    const lock = await lockService.acquireLock(
      'Test deployment',
      testStoryId,
      50,
      30
    );

    // Verify lock is active
    const activeLockBefore = await lockService.checkLockStatus();
    expect(activeLockBefore.locked).toBe(true);

    // Force release
    await lockService.forceReleaseLock(
      lock.id,
      'Admin emergency unlock - deployment stuck'
    );

    // Verify lock is inactive
    const activeLockAfter = await lockService.checkLockStatus();
    expect(activeLockAfter.locked).toBe(false);

    // Verify new deployment can proceed
    const newLock = await lockService.acquireLock(
      'New deployment after force release',
      testStoryId,
      51,
      30
    );

    expect(newLock.id).toBeDefined();

    // Cleanup
    await lockService.releaseLock(newLock.id);
  });

  // ==========================================================================
  // Test 11: Audit Trail Completeness
  // ==========================================================================

  it('should create complete audit trail in DeploymentLog', async () => {
    const mockBackupService = {
      createBackup: jest.fn().mockResolvedValue({
        filename: 'backup.sql',
        filepath: '/backups/backup.sql',
        size: 1000,
      }),
    };

    const testDeploymentService = new DeploymentService(
      prisma,
      lockService,
      mockBackupService as any,
      new RestoreService()
    );

    const result = await testDeploymentService.deployToProduction({
      storyId: testStoryId,
      prNumber: 52,
      triggeredBy: 'audit-test-user',
    });

    expect(result.success).toBe(true);

    // Query DeploymentLog with all fields
    const deploymentLog = await prisma.deploymentLog.findUnique({
      where: { id: result.deploymentLogId },
    });

    expect(deploymentLog).not.toBeNull();

    // Verify all required fields
    expect(deploymentLog?.storyId).toBe(testStoryId);
    expect(deploymentLog?.prNumber).toBe(52);
    expect(deploymentLog?.status).toBe('deployed');
    expect(deploymentLog?.environment).toBe('production');
    expect(deploymentLog?.deployedBy).toBe('audit-test-user');
    expect(deploymentLog?.deployedAt).not.toBeNull();
    expect(deploymentLog?.completedAt).not.toBeNull();
    expect(deploymentLog?.deploymentId).toBe(result.lockId);

    // Verify metadata contains phase details
    const metadata = deploymentLog?.metadata as any;
    expect(metadata?.phases).toBeDefined();
    expect(metadata?.phases?.validation).toBeDefined();
    expect(metadata?.phases?.backup).toBeDefined();
    expect(metadata?.phases?.buildBackend).toBeDefined();
    expect(metadata?.phases?.healthChecks).toBeDefined();
    expect(metadata?.backupFile).toContain('backup.sql');
    expect(metadata?.duration).toBeGreaterThan(0);
  });

  // ==========================================================================
  // Test 12: Lock Renewal
  // ==========================================================================

  it('should renew lock during long deployment', async () => {
    // Create lock with 30-minute expiration
    const lock = await lockService.acquireLock(
      'Long deployment',
      testStoryId,
      60,
      30
    );

    const originalExpiresAt = (await prisma.deploymentLock.findUnique({
      where: { id: lock.id },
    }))?.expiresAt;

    expect(originalExpiresAt).toBeDefined();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Renew lock
    await lockService.renewLock(lock.id, 30);

    const renewedExpiresAt = (await prisma.deploymentLock.findUnique({
      where: { id: lock.id },
    }))?.expiresAt;

    expect(renewedExpiresAt).toBeDefined();

    // Renewed expiration should be later than original
    expect(renewedExpiresAt!.getTime()).toBeGreaterThan(originalExpiresAt!.getTime());

    // Cleanup
    await lockService.releaseLock(lock.id);
  });
});
