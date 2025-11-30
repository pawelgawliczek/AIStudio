/**
 * Unit tests for DeploymentService - ST-77
 *
 * Tests cover all phases of the production deployment workflow:
 * - Story validation
 * - PR approval validation
 * - Worktree validation
 * - Pre-deployment backup
 * - Docker build and restart
 * - Health checks
 * - Rollback on failure
 * - Full end-to-end deployment
 */

// Mock @prisma/client to avoid module-level initialization issues
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    story: {
      findUnique: jest.fn(),
    },
    worktree: {
      findFirst: jest.fn(),
    },
    deploymentLog: {
      create: jest.fn(),
      update: jest.fn(),
    },
  })),
}));

// Mock child_process for Docker commands
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    callback(null, 'success', '');
  }),
  execSync: jest.fn(),
}));

// Mock fs for filesystem checks
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

// Mock GitHub PR validator
jest.mock('../../mcp/servers/deployment/utils/github-pr-validator.js', () => ({
  validatePRForProduction: jest.fn(),
}));

// Mock fetch for health checks
global.fetch = jest.fn() as jest.Mock;

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { validatePRForProduction } from '../../mcp/servers/deployment/utils/github-pr-validator.js';
import { BackupService } from '../backup.service';
import { DeploymentLockService } from '../deployment-lock.service';
import { DeploymentService } from '../deployment.service';
import { RestoreService } from '../restore.service';

describe('DeploymentService', () => {
  let deploymentService: DeploymentService;
  let mockPrisma: any;
  let mockLockService: any;
  let mockBackupService: any;
  let mockRestoreService: any;

  beforeEach(() => {
    // Use fake timers for health check tests
    jest.useFakeTimers();

    // Create mock Prisma client
    mockPrisma = {
      story: {
        findUnique: jest.fn(),
      },
      worktree: {
        findFirst: jest.fn(),
      },
      deploymentLog: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]), // Mock for health check
    };

    // Create mock services
    mockLockService = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    };

    mockBackupService = {
      createBackup: jest.fn(),
    };

    mockRestoreService = {
      restoreFromBackup: jest.fn(),
    };

    // Inject all mocks via constructor
    deploymentService = new DeploymentService(
      mockPrisma as any,
      mockLockService as any,
      mockBackupService as any,
      mockRestoreService as any
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // ==========================================================================
  // GROUP 1: Story Validation (3-4 tests)
  // ==========================================================================

  describe('validateStory', () => {
    it('should validate story in qa status successfully', async () => {
      const mockStory = {
        id: 'story-123',
        key: 'ST-77',
        title: 'Production Deployment Safety',
        status: 'qa',
        epic: { id: 'epic-1', title: 'Deployment System' },
      };

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      const result = await (deploymentService as any).validateStory('story-123');

      expect(result).toEqual(mockStory);
      expect(mockPrisma.story.findUnique).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        include: { epic: true },
      });
    });

    it('should validate story in done status successfully', async () => {
      const mockStory = {
        id: 'story-123',
        key: 'ST-77',
        status: 'done',
      };

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      const result = await (deploymentService as any).validateStory('story-123');

      expect(result).toEqual(mockStory);
    });

    it('should throw error if story not found', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(null);

      await expect(
        (deploymentService as any).validateStory('nonexistent-id')
      ).rejects.toThrow('Story nonexistent-id not found');
    });

    it('should throw error if story in invalid status', async () => {
      const mockStory = {
        id: 'story-123',
        key: 'ST-77',
        status: 'impl', // Not ready for production
      };

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      await expect(
        (deploymentService as any).validateStory('story-123')
      ).rejects.toThrow('Story ST-77 is not ready for production. Status: impl. Expected: qa or done');
    });
  });

  // ==========================================================================
  // GROUP 2: PR Approval Validation (5 tests)
  // ==========================================================================

  describe('validatePRApproval', () => {
    it('should validate approved and merged PR successfully', async () => {
      (validatePRForProduction as jest.Mock).mockResolvedValue({
        valid: true,
        approved: true,
        prState: 'merged',
        mergedAt: '2025-11-22T10:00:00Z',
        approvers: ['reviewer1', 'reviewer2'],
        conflictsExist: false,
        errors: [],
        warnings: [],
      });

      await expect(
        (deploymentService as any).validatePRApproval(42)
      ).resolves.not.toThrow();

      expect(validatePRForProduction).toHaveBeenCalledWith(42);
    });

    it('should throw error if PR not found (404)', async () => {
      (validatePRForProduction as jest.Mock).mockResolvedValue({
        valid: false,
        approved: false,
        prState: 'unknown',
        conflictsExist: false,
        errors: ['PR #999 not found'],
        warnings: [],
      });

      await expect(
        (deploymentService as any).validatePRApproval(999)
      ).rejects.toThrow('PR #999 validation failed');
    });

    it('should throw error if PR not merged', async () => {
      (validatePRForProduction as jest.Mock).mockResolvedValue({
        valid: true,
        approved: true,
        prState: 'open', // Not merged yet
        mergedAt: null,
        approvers: ['reviewer1'],
        conflictsExist: false,
        errors: [],
        warnings: [],
      });

      await expect(
        (deploymentService as any).validatePRApproval(42)
      ).rejects.toThrow('PR #42 is not merged. State: open');
    });

    it('should throw error if PR has merge conflicts', async () => {
      (validatePRForProduction as jest.Mock).mockResolvedValue({
        valid: true,
        approved: true,
        prState: 'merged',
        mergedAt: '2025-11-22T10:00:00Z',
        approvers: ['reviewer1'],
        conflictsExist: true, // Conflicts detected
        errors: [],
        warnings: [],
      });

      await expect(
        (deploymentService as any).validatePRApproval(42)
      ).rejects.toThrow('PR #42 has merge conflicts');
    });

    it('should throw error if PR not approved', async () => {
      (validatePRForProduction as jest.Mock).mockResolvedValue({
        valid: true,
        approved: false, // No approvals
        prState: 'merged',
        mergedAt: '2025-11-22T10:00:00Z',
        approvers: [],
        conflictsExist: false,
        errors: [],
        warnings: [],
      });

      await expect(
        (deploymentService as any).validatePRApproval(42)
      ).rejects.toThrow('PR #42 is not approved. At least 1 approval required');
    });
  });

  // ==========================================================================
  // GROUP 3: Worktree Validation (3 tests)
  // ==========================================================================

  describe('validateWorktree', () => {
    it('should validate active worktree successfully', async () => {
      const mockWorktree = {
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      };

      mockPrisma.worktree.findFirst.mockResolvedValue(mockWorktree);
      (existsSync as jest.Mock).mockReturnValue(true);

      await expect(
        (deploymentService as any).validateWorktree('story-123')
      ).resolves.not.toThrow();

      expect(mockPrisma.worktree.findFirst).toHaveBeenCalledWith({
        where: {
          storyId: 'story-123',
          status: 'active',
        },
      });
      expect(existsSync).toHaveBeenCalledWith('/opt/stack/AIStudio/.worktrees/ST-77');
    });

    it('should throw error if worktree not found', async () => {
      mockPrisma.worktree.findFirst.mockResolvedValue(null);

      await expect(
        (deploymentService as any).validateWorktree('story-123')
      ).rejects.toThrow('No active worktree found for story story-123');
    });

    it('should throw error if worktree directory does not exist', async () => {
      const mockWorktree = {
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      };

      mockPrisma.worktree.findFirst.mockResolvedValue(mockWorktree);
      (existsSync as jest.Mock).mockReturnValue(false); // Directory missing

      await expect(
        (deploymentService as any).validateWorktree('story-123')
      ).rejects.toThrow('Worktree directory not found: /opt/stack/AIStudio/.worktrees/ST-77');
    });
  });

  // ==========================================================================
  // GROUP 4: Pre-Deployment Backup (4 tests)
  // ==========================================================================

  describe('Backup Phase', () => {
    it('should create backup successfully', async () => {
      const mockBackup = {
        filename: 'vibestudio_ST-77-PR-42_20251122_120000.sql',
        filepath: '/opt/stack/AIStudio/backups/vibestudio_ST-77-PR-42_20251122_120000.sql',
        size: 1048576, // 1MB
      };

      mockBackupService.createBackup.mockResolvedValue(mockBackup);

      // Call backup phase directly by testing deployToProduction with mocked phases
      // Setup all required mocks for successful deployment
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);

      mockPrisma.deploymentLog.create.mockResolvedValue({
        id: 'log-1',
      });

      mockLockService.acquireLock.mockResolvedValue({
        id: 'lock-1',
      });

      mockPrisma.deploymentLog.update.mockResolvedValue({});
      mockLockService.releaseLock.mockResolvedValue(undefined);
      (execSync as jest.Mock).mockReturnValue(undefined);
      (fetch as jest.Mock).mockResolvedValue({ ok: true });

      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
        skipBackup: false,
      });

      // Advance timers for health checks
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(mockBackupService.createBackup).toHaveBeenCalled();
      expect(result.phases.backup.success).toBe(true);
      expect(result.backupFile).toContain('vibestudio_ST-77-PR-42');
    });

    it('should skip backup in emergency mode', async () => {
      // Setup minimal mocks
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockLockService.acquireLock.mockResolvedValue({ id: 'lock-1' });
      mockPrisma.deploymentLog.update.mockResolvedValue({});
      mockLockService.releaseLock.mockResolvedValue(undefined);
      (execSync as jest.Mock).mockReturnValue(undefined);
      (fetch as jest.Mock).mockResolvedValue({ ok: true });

      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        skipBackup: true, // Emergency mode
        confirmDeploy: true,
      });

      // Advance timers for health checks
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(mockBackupService.createBackup).not.toHaveBeenCalled();
      expect(result.phases.backup.success).toBe(true);
      expect(result.phases.backup.message).toContain('Backup skipped (emergency mode)');
      expect(result.warnings).toContain('⚠️  BACKUP SKIPPED - Emergency deployment mode');
    });

    it('should handle backup creation failure', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockLockService.acquireLock.mockResolvedValue({ id: 'lock-1' });
      mockPrisma.deploymentLog.update.mockResolvedValue({});
      mockLockService.releaseLock.mockResolvedValue(undefined);

      // Backup fails (disk full)
      mockBackupService.createBackup.mockRejectedValue(new Error('Disk full'));

      const result = await deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Disk full');
      expect(mockLockService.releaseLock).toHaveBeenCalled(); // Lock released on failure
    });

    it('should handle backup integrity check failure', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockLockService.acquireLock.mockResolvedValue({ id: 'lock-1' });
      mockPrisma.deploymentLog.update.mockResolvedValue({});
      mockLockService.releaseLock.mockResolvedValue(undefined);

      // Backup completes but integrity check fails
      mockBackupService.createBackup.mockRejectedValue(
        new Error('Backup integrity check failed: corrupted dump')
      );

      const result = await deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Backup integrity check failed');
    });
  });

  // ==========================================================================
  // GROUP 5: Docker Build (4 tests)
  // ==========================================================================

  describe('Docker Build', () => {
    it('should build backend container successfully', async () => {
      (execSync as jest.Mock).mockReturnValue(undefined);

      await expect(
        (deploymentService as any).buildDockerContainer('backend')
      ).resolves.not.toThrow();

      expect(execSync).toHaveBeenCalledWith(
        'docker compose build backend --no-cache',
        expect.objectContaining({
          timeout: 600000, // 10 minutes
        })
      );
    });

    it('should build frontend container successfully', async () => {
      (execSync as jest.Mock).mockReturnValue(undefined);

      await expect(
        (deploymentService as any).buildDockerContainer('frontend')
      ).resolves.not.toThrow();

      expect(execSync).toHaveBeenCalledWith(
        'docker compose build frontend --no-cache',
        expect.anything()
      );
    });

    it('should handle build failure (syntax error)', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: npm ERR! Missing script: "build"');
      });

      await expect(
        (deploymentService as any).buildDockerContainer('backend')
      ).rejects.toThrow(/Failed to build backend container/);
    });

    it('should handle build timeout', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: timeout exceeded');
      });

      await expect(
        (deploymentService as any).buildDockerContainer('frontend')
      ).rejects.toThrow('Failed to build frontend container');
    });
  });

  // ==========================================================================
  // GROUP 6: Docker Restart (3 tests)
  // ==========================================================================

  describe('Docker Restart', () => {
    it('should restart container successfully', async () => {
      (execSync as jest.Mock).mockReturnValue(undefined);

      await expect(
        (deploymentService as any).restartDockerContainer('backend')
      ).resolves.not.toThrow();

      expect(execSync).toHaveBeenCalledWith(
        'docker compose up -d backend',
        expect.objectContaining({
          timeout: 120000, // 2 minutes
        })
      );
    });

    it('should handle container restart failure', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: container exited with code 1');
      });

      await expect(
        (deploymentService as any).restartDockerContainer('frontend')
      ).rejects.toThrow('Failed to restart frontend container');
    });

    it('should handle container not found error', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Error: No such service: backend');
      });

      await expect(
        (deploymentService as any).restartDockerContainer('backend')
      ).rejects.toThrow('Failed to restart backend container');
    });
  });

  // ==========================================================================
  // GROUP 7: Health Checks (ST-87 Enhanced) (8 tests)
  // ==========================================================================

  describe('Health Checks', () => {
    it('should wait 15 seconds before first health check (ST-87 warmup)', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const resultPromise = (deploymentService as any).runHealthChecks();

      // Verify fetch not called immediately (warmup delay)
      expect(fetch).not.toHaveBeenCalled();

      // Advance timers through warmup period
      await jest.runAllTimersAsync();

      await resultPromise;

      // Now fetch should have been called
      expect(fetch).toHaveBeenCalled();
    });

    it('should pass with 3 consecutive successes for both services', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const resultPromise = (deploymentService as any).runHealthChecks();

      // Fast-forward through warmup + health check delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.backend.success).toBe(true);
      expect(result.backend.consecutiveSuccesses).toBeGreaterThanOrEqual(3);
      expect(result.frontend.success).toBe(true);
      expect(result.frontend.consecutiveSuccesses).toBeGreaterThanOrEqual(3);
    });

    it('should NOT reset counter on transient failures (ST-87 enhancement)', async () => {
      let backendCalls = 0;
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('3000')) {
          backendCalls++;
          // Pattern: Success, Fail, Success, Fail, Success, Success (reaches 3 total)
          // Old behavior would reset to 0 after each failure
          // New ST-87 behavior accumulates successes without reset
          if (backendCalls === 2 || backendCalls === 4) {
            return Promise.resolve({ ok: false, status: 503 });
          }
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const resultPromise = (deploymentService as any).runHealthChecks();

      // Fast-forward through all timer delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      // Should succeed because counters don't reset (accumulates 3+ successes eventually)
      expect(result.backend.success).toBe(true);
      expect(result.backend.consecutiveSuccesses).toBeGreaterThanOrEqual(3);
      expect(result.frontend.success).toBe(true);
    });

    it('should support 24 attempts with 2-minute timeout (ST-87 enhancement)', async () => {
      let attempts = 0;
      (fetch as jest.Mock).mockImplementation((url: string) => {
        attempts++;
        // Fail for first 20 attempts, then succeed
        // Old behavior: only 10 attempts (50s timeout) - would fail
        // New ST-87 behavior: 24 attempts (2min timeout) - succeeds
        if (attempts <= 20) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const resultPromise = (deploymentService as any).runHealthChecks();

      // Fast-forward through all timer delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      // With old 10-attempt limit, this would fail
      // With new 24-attempt limit, this succeeds
      expect(attempts).toBeGreaterThan(20);
      expect(result.backend.success).toBe(true);
      expect(result.frontend.success).toBe(true);
    });

    it('should handle health check timeout', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const resultPromise = (deploymentService as any).runHealthChecks();

      // Fast-forward through all timer delays (will hit max 24 attempts)
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.backend.success).toBe(false);
      expect(result.frontend.success).toBe(false);
      expect(result.backend.consecutiveSuccesses).toBe(0);
      expect(result.frontend.consecutiveSuccesses).toBe(0);
    });

    it('should skip health checks in emergency mode', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockLockService.acquireLock.mockResolvedValue({ id: 'lock-1' });
      mockPrisma.deploymentLog.update.mockResolvedValue({});
      mockLockService.releaseLock.mockResolvedValue(undefined);
      mockBackupService.createBackup.mockResolvedValue({
        filename: 'backup.sql',
        filepath: '/backups/backup.sql',
        size: 1000,
      });
      (execSync as jest.Mock).mockReturnValue(undefined);

      const result = await deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        skipHealthChecks: true, // Emergency mode
        confirmDeploy: true,
      });

      expect(fetch).not.toHaveBeenCalled();
      expect(result.phases.healthChecks.success).toBe(true);
      expect(result.phases.healthChecks.message).toContain('Health checks skipped (emergency mode)');
      expect(result.warnings).toContain('⚠️  HEALTH CHECKS SKIPPED - Emergency deployment mode');
    });
  });

  // ==========================================================================
  // GROUP 8: Rollback (4 tests)
  // ==========================================================================

  describe('Rollback', () => {
    it('should rollback successfully after health check failure', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockLockService.acquireLock.mockResolvedValue({ id: 'lock-1' });
      mockPrisma.deploymentLog.update.mockResolvedValue({});
      mockLockService.releaseLock.mockResolvedValue(undefined);

      const mockBackupFile = '/backups/vibestudio_ST-77-PR-42_20251122.sql';
      mockBackupService.createBackup.mockResolvedValue({
        filename: 'vibestudio_ST-77-PR-42_20251122.sql',
        filepath: mockBackupFile,
        size: 1048576,
      });

      (execSync as jest.Mock).mockReturnValue(undefined);

      // Health checks fail
      (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });

      // Rollback succeeds
      mockRestoreService.restoreFromBackup.mockResolvedValue({
        success: true,
        errors: [],
      });

      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
      });

      // Advance timers for health checks
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.phases.rollback?.success).toBe(true);
      expect(mockRestoreService.restoreFromBackup).toHaveBeenCalledWith(
        mockBackupFile,
        { force: true, skipValidation: false }
      );
      expect(result.warnings.some((w: string) => w.includes('Automatic rollback completed from backup'))).toBe(true);
    });

    it('should restore database from backup successfully', async () => {
      const backupFile = '/backups/test.sql';

      mockRestoreService.restoreFromBackup.mockResolvedValue({
        success: true,
        errors: [],
      });

      await expect(
        (deploymentService as any).rollback(backupFile)
      ).resolves.not.toThrow();

      expect(mockRestoreService.restoreFromBackup).toHaveBeenCalledWith(
        backupFile,
        { force: true, skipValidation: false }
      );
    });

    it('should handle rollback failure (corrupted backup)', async () => {
      const backupFile = '/backups/corrupted.sql';

      mockRestoreService.restoreFromBackup.mockResolvedValue({
        success: false,
        errors: ['Backup file is corrupted'],
      });

      await expect(
        (deploymentService as any).rollback(backupFile)
      ).rejects.toThrow('Restore failed: Backup file is corrupted');
    });

    it('should handle database restore failure', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockLockService.acquireLock.mockResolvedValue({ id: 'lock-1' });
      mockPrisma.deploymentLog.update.mockResolvedValue({});
      mockLockService.releaseLock.mockResolvedValue(undefined);

      mockBackupService.createBackup.mockResolvedValue({
        filename: 'backup.sql',
        filepath: '/backups/backup.sql',
        size: 1000,
      });

      (execSync as jest.Mock).mockReturnValue(undefined);
      (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });

      // Rollback fails
      mockRestoreService.restoreFromBackup.mockRejectedValue(
        new Error('Database connection failed')
      );

      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
      });

      // Advance timers for health checks
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.phases.rollback?.success).toBe(false);
      expect(result.warnings).toContain(
        '❌ CRITICAL: Automatic rollback failed. Manual intervention required!'
      );
    });
  });

  // ==========================================================================
  // GROUP 9: Parallel Builds & Selective Skip (ST-87) (5 tests)
  // ==========================================================================

  describe('Parallel Builds and Selective Skip (ST-87)', () => {
    beforeEach(() => {
      // Setup common mocks for deployment tests
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-87',
        status: 'qa',
      });

      (validatePRForProduction as jest.Mock).mockResolvedValue({
        valid: true,
        approved: true,
        prState: 'merged',
        mergedAt: '2025-11-23T10:00:00Z',
        approvers: ['reviewer1'],
        conflictsExist: false,
        errors: [],
        warnings: [],
      });

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-87',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockLockService.acquireLock.mockResolvedValue({ id: 'lock-1' });
      mockBackupService.createBackup.mockResolvedValue({
        filename: 'backup.sql',
        filepath: '/backups/backup.sql',
        size: 1000,
      });
      mockPrisma.deploymentLog.update.mockResolvedValue({});
      mockLockService.releaseLock.mockResolvedValue(undefined);
      (execSync as jest.Mock).mockReturnValue(undefined);
      (fetch as jest.Mock).mockResolvedValue({ ok: true });
    });

    it('should run backend and frontend builds in parallel (default behavior)', async () => {
      let backendBuildStart: number | null = null;
      let frontendBuildStart: number | null = null;
      let backendBuildEnd: number | null = null;
      let frontendBuildEnd: number | null = null;

      (execSync as jest.Mock).mockImplementation((cmd: string) => {
        const now = Date.now();
        if (cmd.includes('backend')) {
          backendBuildStart = now;
          // Simulate 100ms build time
          const start = Date.now();
          while (Date.now() - start < 100) {}
          backendBuildEnd = Date.now();
        } else if (cmd.includes('frontend')) {
          frontendBuildStart = now;
          // Simulate 100ms build time
          const start = Date.now();
          while (Date.now() - start < 100) {}
          frontendBuildEnd = Date.now();
        }
        return undefined;
      });

      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.phases.buildBackend.success).toBe(true);
      expect(result.phases.buildFrontend.success).toBe(true);

      // Verify builds started concurrently (within 50ms of each other)
      const timeDiff = Math.abs(backendBuildStart! - frontendBuildStart!);
      expect(timeDiff).toBeLessThan(50); // Should start nearly simultaneously
    });

    it('should skip backend build when skipBackendBuild=true', async () => {
      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        skipBackendBuild: true,
        confirmDeploy: true,
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.phases.buildBackend.success).toBe(true);
      expect(result.phases.buildBackend.duration).toBe(0);
      expect(result.phases.buildBackend.message).toContain('skipped');

      // Verify backend build command was NOT called (but restart was called)
      expect(execSync).not.toHaveBeenCalledWith(
        expect.stringContaining('build backend'),
        expect.anything()
      );

      // Verify frontend build WAS called
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('build frontend'),
        expect.anything()
      );
    });

    it('should skip frontend build when skipFrontendBuild=true', async () => {
      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        skipFrontendBuild: true,
        confirmDeploy: true,
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.phases.buildFrontend.success).toBe(true);
      expect(result.phases.buildFrontend.duration).toBe(0);
      expect(result.phases.buildFrontend.message).toContain('skipped');

      // Verify frontend build command was NOT called (but restart was called)
      expect(execSync).not.toHaveBeenCalledWith(
        expect.stringContaining('build frontend'),
        expect.anything()
      );

      // Verify backend build WAS called
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('build backend'),
        expect.anything()
      );
    });

    it('should skip both builds when both skip flags are true', async () => {
      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        skipBackendBuild: true,
        skipFrontendBuild: true,
        confirmDeploy: true,
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.phases.buildBackend.duration).toBe(0);
      expect(result.phases.buildFrontend.duration).toBe(0);
      expect(result.phases.buildBackend.message).toContain('skipped');
      expect(result.phases.buildFrontend.message).toContain('skipped');

      // Verify NO build commands were called
      expect(execSync).not.toHaveBeenCalledWith(
        expect.stringContaining('build'),
        expect.anything()
      );
    });

    it('should handle parallel build failure correctly', async () => {
      // Frontend build fails, backend succeeds
      (execSync as jest.Mock).mockImplementation((cmd: string) => {
        if (cmd.includes('frontend')) {
          throw new Error('Frontend build failed: syntax error');
        }
        return undefined; // Backend succeeds
      });

      const result = await deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Frontend build failed');

      // Verify lock was released on failure
      expect(mockLockService.releaseLock).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GROUP 10: Full Deployment Workflow (3 tests)
  // ==========================================================================

  describe('Full Deployment Workflow', () => {
    it('should complete end-to-end deployment successfully', async () => {
      // Setup all mocks for successful deployment
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        title: 'Production Deployment Safety',
        status: 'qa',
        epic: { id: 'epic-1', title: 'Deployment' },
      });

      (validatePRForProduction as jest.Mock).mockResolvedValue({
        valid: true,
        approved: true,
        prState: 'merged',
        mergedAt: '2025-11-22T10:00:00Z',
        approvers: ['reviewer1', 'reviewer2'],
        conflictsExist: false,
        errors: [],
        warnings: [],
      });

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);

      mockPrisma.deploymentLog.create.mockResolvedValue({
        id: 'log-123',
      });

      mockLockService.acquireLock.mockResolvedValue({
        id: 'lock-123',
      });

      mockBackupService.createBackup.mockResolvedValue({
        filename: 'vibestudio_ST-77-PR-42_20251122_120000.sql',
        filepath: '/backups/vibestudio_ST-77-PR-42_20251122_120000.sql',
        size: 2097152, // 2MB
      });

      (execSync as jest.Mock).mockReturnValue(undefined); // Docker commands succeed

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      }); // Health checks pass

      mockLockService.releaseLock.mockResolvedValue(undefined);
      mockPrisma.deploymentLog.update.mockResolvedValue({});

      const resultPromise = deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        triggeredBy: 'test-user',
        confirmDeploy: true,
      });

      // Advance timers for health checks
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      // Verify successful deployment
      expect(result.success).toBe(true);
      expect(result.storyKey).toBe('ST-77');
      expect(result.prNumber).toBe(42);
      expect(result.deploymentLogId).toBe('log-123');
      expect(result.lockId).toBe('lock-123');
      expect(result.errors).toHaveLength(0);

      // Verify all phases completed
      expect(result.phases.validation.success).toBe(true);
      expect(result.phases.lockAcquisition.success).toBe(true);
      expect(result.phases.backup.success).toBe(true);
      expect(result.phases.buildBackend.success).toBe(true);
      expect(result.phases.buildFrontend.success).toBe(true);
      expect(result.phases.restartBackend.success).toBe(true);
      expect(result.phases.restartFrontend.success).toBe(true);
      expect(result.phases.healthChecks.success).toBe(true);
      expect(result.phases.lockRelease.success).toBe(true);

      // Verify lock was released
      expect(mockLockService.releaseLock).toHaveBeenCalledWith('lock-123');

      // Verify deployment log was updated with success
      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: expect.objectContaining({
          status: 'deployed',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should block deployment when lock already exists', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });

      // Lock acquisition fails (another deployment in progress)
      mockLockService.acquireLock.mockRejectedValue(
        new Error('Production deployment locked by production-deployment')
      );

      mockPrisma.deploymentLog.update.mockResolvedValue({});

      const result = await deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Production deployment locked');
      expect(result.phases.validation.success).toBe(true); // Validation passed
      expect(result.phases.lockAcquisition.success).toBe(false); // Lock failed
      expect(result.phases.backup.success).toBe(false); // Never reached
    });

    it('should handle failure at each critical phase with proper rollback', async () => {
      // Test failure during build phase
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        key: 'ST-77',
        status: 'qa',
      });

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

      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'worktree-1',
        storyId: 'story-123',
        worktreePath: '/opt/stack/AIStudio/.worktrees/ST-77',
        status: 'active',
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      mockPrisma.deploymentLog.create.mockResolvedValue({ id: 'log-1' });
      mockLockService.acquireLock.mockResolvedValue({ id: 'lock-1' });

      mockBackupService.createBackup.mockResolvedValue({
        filename: 'backup.sql',
        filepath: '/backups/backup.sql',
        size: 1000,
      });

      // Docker build fails
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Docker build failed: syntax error');
      });

      mockLockService.releaseLock.mockResolvedValue(undefined);
      mockPrisma.deploymentLog.update.mockResolvedValue({});

      // No rollback needed (didn't restart containers yet)
      mockRestoreService.restoreFromBackup.mockResolvedValue({
        success: true,
        errors: [],
      });

      const result = await deploymentService.deployToProduction({
        storyId: 'story-123',
        prNumber: 42,
        confirmDeploy: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Docker build failed');
      expect(result.phases.validation.success).toBe(true);
      expect(result.phases.backup.success).toBe(true);
      expect(result.phases.buildBackend.success).toBe(false);

      // Verify lock was released even on failure
      expect(mockLockService.releaseLock).toHaveBeenCalledWith('lock-1');

      // Verify deployment log updated with failure status
      expect(mockPrisma.deploymentLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: expect.objectContaining({
          status: 'rolled_back', // Rollback attempted
        }),
      });
    });
  });

  // ==========================================================================
  // GROUP 11: Utility Methods (2 tests)
  // ==========================================================================

  describe('Utility Methods', () => {
    it('should get deployment history for a story', async () => {
      const mockHistory = [
        {
          id: 'log-1',
          storyId: 'story-123',
          status: 'deployed',
          createdAt: new Date('2025-11-22T10:00:00Z'),
        },
        {
          id: 'log-2',
          storyId: 'story-123',
          status: 'failed',
          createdAt: new Date('2025-11-21T15:30:00Z'),
        },
      ];

      mockPrisma.deploymentLog.findMany.mockResolvedValue(mockHistory);

      const result = await deploymentService.getDeploymentHistory('story-123');

      expect(result).toEqual(mockHistory);
      expect(mockPrisma.deploymentLog.findMany).toHaveBeenCalledWith({
        where: { storyId: 'story-123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('should get current deployment status', async () => {
      const mockCurrentDeployment = {
        id: 'log-1',
        status: 'deploying',
        story: {
          key: 'ST-77',
          title: 'Production Deployment Safety',
        },
      };

      mockPrisma.deploymentLog.findFirst.mockResolvedValue(mockCurrentDeployment);

      const result = await deploymentService.getCurrentDeployment();

      expect(result).toEqual(mockCurrentDeployment);
      expect(mockPrisma.deploymentLog.findFirst).toHaveBeenCalledWith({
        where: { status: 'deploying' },
        orderBy: { createdAt: 'desc' },
        include: {
          story: {
            select: {
              key: true,
              title: true,
            },
          },
        },
      });
    });
  });
});
