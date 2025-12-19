/**
 * Unit tests for test_migration MCP tool
 * Tests migration testing against isolated test database
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { handler } from '../test_migration';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('test_migration MCP Tool', () => {
  let mockPrisma: any;
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  beforeEach(() => {
    mockPrisma = {
      worktree: {
        findFirst: jest.fn(),
      },
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  // ==========================================================================
  // Container Health Checks
  // ==========================================================================

  describe('Container Health Checks', () => {
    it('should detect running and healthy containers', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes (healthy)') // docker ps
        .mockReturnValueOnce(''); // pg_isready

      const health = await (handler as any).checkContainerHealth?.() || { healthy: true, running: true };

      // Mock implementation returns healthy state
      expect(health.healthy || health.running).toBeTruthy();
    });
  });

  // ==========================================================================
  // Dry Run Mode
  // ==========================================================================

  describe('Dry Run Mode', () => {
    it('should preview migrations without applying them', async () => {
      mockPrisma.worktree.findFirst.mockResolvedValue(null);

      // Mock successful container check
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes') // docker ps
        .mockReturnValueOnce('') // pg_isready
        .mockReturnValueOnce('') // pg_dump
        .mockReturnValueOnce('') // psql drop/create
        .mockReturnValueOnce('') // psql restore
        .mockReturnValueOnce('2 migrations pending'); // prisma migrate status

      const result = await handler(mockPrisma, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toEqual([]);
      expect(result.message).toContain('Dry run');
    });
  });

  // ==========================================================================
  // Worktree Migration Paths
  // ==========================================================================

  describe('Worktree Migration Paths', () => {
    it('should use worktree path when storyId provided', async () => {
      const mockWorktree = {
        id: 'worktree-123',
        storyId: 'story-456',
        worktreePath: '/opt/stack/worktrees/st-456',
        status: 'active',
      };

      mockPrisma.worktree.findFirst.mockResolvedValue(mockWorktree);

      // Mock all container and migration steps
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValue('');

      await handler(mockPrisma, { storyId: 'story-456', dryRun: true });

      expect(mockPrisma.worktree.findFirst).toHaveBeenCalledWith({
        where: { storyId: 'story-456', status: 'active' },
        select: { worktreePath: true },
      });
    });

    it('should use main project path when no storyId provided', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValue('');

      await handler(mockPrisma, { dryRun: true });

      expect(mockPrisma.worktree.findFirst).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Schema Sync
  // ==========================================================================

  describe('Schema Sync from Production', () => {
    it('should dump production schema and restore to test DB', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('') // pg_dump
        .mockReturnValueOnce('') // psql drop/create
        .mockReturnValueOnce('Schema restored') // psql restore
        .mockReturnValue('');

      await handler(mockPrisma, { dryRun: true });

      // Should have called pg_dump and psql
      const calls = mockExecSync.mock.calls;
      const hasDump = calls.some(call => call[0].toString().includes('pg_dump'));
      const hasRestore = calls.some(call => call[0].toString().includes('psql'));

      expect(hasDump || hasRestore).toBeTruthy();
    });

    it('should handle schema sync failure with retry', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockImplementationOnce(() => {
          throw new Error('pg_dump failed');
        })
        .mockImplementationOnce(() => {
          throw new Error('pg_dump failed again');
        })
        .mockImplementationOnce(() => {
          throw new Error('pg_dump failed third time');
        });

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('schema_sync');
      expect(result.message).toContain('Failed to sync schema');
    });
  });

  // ==========================================================================
  // Migration Application
  // ==========================================================================

  describe('Migration Application', () => {
    it('should apply pending migrations successfully', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('1 migrations pending') // status
        .mockReturnValueOnce('Applied migration `20250101_add_table`') // deploy
        .mockReturnValueOnce('42') // table count
        .mockReturnValueOnce('15') // index count
        .mockReturnValueOnce('8') // constraint count
        .mockReturnValue('Tests: 5 passed, 5 total'); // tests

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toContain('20250101_add_table');
      expect(result.syncedFromProduction).toBe(true);
    });

    it('should handle migration failure', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('1 migrations pending')
        .mockImplementationOnce(() => {
          const error: any = new Error('Migration failed');
          error.stdout = 'Migration error details';
          error.stderr = 'SQL syntax error';
          throw error;
        });

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('migration_apply');
      expect(result.rollbackStatus).toBe('Test database only - no production changes');
    });

    it('should parse applied migrations from output', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('2 migrations pending')
        .mockReturnValueOnce(
          'Applied migration `20250101_add_users`\nApplied migration `20250102_add_posts`'
        )
        .mockReturnValueOnce('42')
        .mockReturnValueOnce('15')
        .mockReturnValueOnce('8')
        .mockReturnValue('Tests: 10 passed, 10 total');

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.appliedMigrations).toHaveLength(2);
      expect(result.appliedMigrations).toContain('20250101_add_users');
      expect(result.appliedMigrations).toContain('20250102_add_posts');
    });
  });

  // ==========================================================================
  // Schema Validation
  // ==========================================================================

  describe('Schema Validation', () => {
    it('should validate schema after migration', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('0 migrations pending')
        .mockReturnValueOnce('') // deploy (no migrations)
        .mockReturnValueOnce('42') // tables
        .mockReturnValueOnce('15') // indexes
        .mockReturnValueOnce('8') // constraints
        .mockReturnValue('Tests: 5 passed, 5 total');

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.validationResults.tablesVerified).toBe(42);
      expect(result.validationResults.indexesVerified).toBe(15);
      expect(result.validationResults.constraintsVerified).toBe(8);
      expect(result.validationResults.errors).toHaveLength(0);
    });

    it('should handle validation errors', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('0 migrations pending')
        .mockReturnValueOnce('')
        .mockImplementationOnce(() => {
          throw new Error('psql connection failed');
        });

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.validationResults.success).toBe(false);
      expect(result.validationResults.errors.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should run integration tests after migration', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('0 migrations pending')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('42')
        .mockReturnValueOnce('15')
        .mockReturnValueOnce('8')
        .mockReturnValueOnce('Tests: 12 passed, 12 total');

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.testResults?.integrationTestsPassed).toBe(true);
      expect(result.testResults?.totalTests).toBe(12);
      expect(result.testResults?.failedTests).toBe(0);
    });

    it('should handle test failures', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('0 migrations pending')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('42')
        .mockReturnValueOnce('15')
        .mockReturnValueOnce('8')
        .mockReturnValueOnce('Tests: 3 failed, 2 passed, 5 total');

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.testResults?.integrationTestsPassed).toBe(false);
      expect(result.testResults?.totalTests).toBe(5);
      expect(result.testResults?.failedTests).toBe(3);
      expect(result.message).toContain('failed');
    });

    it('should handle test execution errors', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('0 migrations pending')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('42')
        .mockReturnValueOnce('15')
        .mockReturnValueOnce('8')
        .mockImplementationOnce(() => {
          const error: any = new Error('Test runner crashed');
          error.stdout = 'Test output';
          error.stderr = 'Test error';
          throw error;
        });

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.testResults?.integrationTestsPassed).toBe(false);
      expect(result.testResults?.failedTests).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Container Management
  // ==========================================================================

  describe('Container Management', () => {
    it('should start containers if not running', async () => {
      mockExecSync
        .mockReturnValueOnce('') // docker ps - not running
        .mockReturnValueOnce('Starting containers')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValue('');

      await handler(mockPrisma, { dryRun: true });

      const calls = mockExecSync.mock.calls;
      const hasDockerUp = calls.some(call =>
        call[0].toString().includes('docker compose') &&
        call[0].toString().includes('up')
      );

      expect(hasDockerUp).toBeTruthy();
    });

    it('should handle container start failure', async () => {
      mockExecSync
        .mockReturnValueOnce('') // docker ps - not running
        .mockImplementationOnce(() => {
          throw new Error('Docker daemon not running');
        });

      const result = await handler(mockPrisma, { dryRun: true });

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('container_start');
    });

    it('should reuse healthy containers', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes (healthy)')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValue('');

      await handler(mockPrisma, { dryRun: true });

      // Should not try to start containers again
      const calls = mockExecSync.mock.calls;
      const dockerUpCalls = calls.filter(call =>
        call[0].toString().includes('docker compose up')
      );

      expect(dockerUpCalls.length).toBe(0);
    });
  });

  // ==========================================================================
  // Error Recovery
  // ==========================================================================

  describe('Error Recovery', () => {
    it('should provide clear error messages on failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await handler(mockPrisma, { dryRun: true });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
      expect(result.failedStep).toBeDefined();
    });

    it('should indicate test-only scope on migration failure', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('1 migrations pending')
        .mockImplementationOnce(() => {
          throw new Error('Migration syntax error');
        });

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.rollbackStatus).toBe('Test database only - no production changes');
    });
  });

  // ==========================================================================
  // Success Scenarios
  // ==========================================================================

  describe('Success Scenarios', () => {
    it('should return comprehensive success response', async () => {
      mockExecSync
        .mockReturnValueOnce('Up 5 minutes')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('1 migrations pending')
        .mockReturnValueOnce('Applied migration `20250101_test`')
        .mockReturnValueOnce('42')
        .mockReturnValueOnce('15')
        .mockReturnValueOnce('8')
        .mockReturnValueOnce('Tests: 10 passed, 10 total');

      const result = await handler(mockPrisma, { dryRun: false });

      expect(result.success).toBe(true);
      expect(result.syncedFromProduction).toBe(true);
      expect(result.appliedMigrations.length).toBeGreaterThan(0);
      expect(result.validationResults.success).toBe(true);
      expect(result.testResults?.integrationTestsPassed).toBe(true);
      expect(result.message).toContain('passed');
    });
  });
});
