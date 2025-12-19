/**
 * Unit tests for detect_schema_changes MCP tool
 * Tests schema change detection in Prisma migrations
 */

import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { handler } from '../detect_schema_changes';
import * as gitUtils from '../git_utils';

jest.mock('fs');
jest.mock('../git_utils');

describe('detect_schema_changes MCP Tool', () => {
  let mockPrisma: any;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockGitUtils = gitUtils as jest.Mocked<typeof gitUtils>;

  beforeEach(() => {
    mockPrisma = {
      story: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      worktree: {
        findFirst: jest.fn(),
      },
      remoteAgent: {
        findFirst: jest.fn(),
      },
    };

    jest.clearAllMocks();
  });

  // ==========================================================================
  // Input Validation
  // ==========================================================================

  describe('Input Validation', () => {
    it('should throw error when story not found', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { storyId: 'invalid-story' })
      ).rejects.toThrow('Story');
    });

    it('should throw error when no worktree exists', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({ id: 'story-123' });
      mockPrisma.worktree.findFirst.mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { storyId: 'story-123' })
      ).rejects.toThrow('Worktree');
    });

    it('should throw error when worktree filesystem does not exist', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({ id: 'story-123' });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/nonexistent/path',
        branchName: 'st-123',
        hostType: 'server',
      });

      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(false);

      await expect(
        handler(mockPrisma, { storyId: 'story-123' })
      ).rejects.toThrow('Worktree filesystem does not exist');
    });
  });

  // ==========================================================================
  // Migration Discovery
  // ==========================================================================

  describe('Migration Discovery', () => {
    const setupValidWorktree = () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
    };

    it('should detect no changes when migrations match main', async () => {
      setupValidWorktree();

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_init', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('20250101_init\n');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.hasChanges).toBe(false);
      expect(result.migrationFiles).toHaveLength(0);
      expect(result.summary).toContain('No schema changes');
    });

    it('should detect new migrations in worktree', async () => {
      setupValidWorktree();

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_init', isDirectory: () => true },
        { name: '20250102_add_users', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('20250101_init\n');
      mockFs.readFileSync.mockReturnValue('CREATE TABLE users (id UUID PRIMARY KEY);');
      mockFs.statSync.mockReturnValue({ size: 100 } as any);

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.hasChanges).toBe(true);
      expect(result.migrationFiles).toHaveLength(1);
      expect(result.migrationFiles[0].name).toBe('20250102_add_users');
    });

    it('should handle empty migrations directory in worktree', async () => {
      setupValidWorktree();

      mockFs.existsSync.mockReturnValue(false);
      mockGitUtils.execGit.mockReturnValue('');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.hasChanges).toBe(false);
      expect(result.migrationFiles).toHaveLength(0);
    });

    it('should handle empty main branch migrations', async () => {
      setupValidWorktree();

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_init', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockImplementation(() => {
        throw new Error('not a tree object');
      });
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id UUID);');
      mockFs.statSync.mockReturnValue({ size: 50 } as any);

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.hasChanges).toBe(true);
      expect(result.migrationFiles).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Breaking Pattern Detection
  // ==========================================================================

  describe('Breaking Pattern Detection', () => {
    const setupMigrationTest = (sqlContent: string) => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_test', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('');
      mockFs.readFileSync.mockReturnValue(sqlContent);
      mockFs.statSync.mockReturnValue({ size: sqlContent.length } as any);
    };

    it('should detect DROP TABLE as breaking', async () => {
      setupMigrationTest('DROP TABLE users;');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns.length).toBeGreaterThan(0);
      expect(result.summary).toContain('breaking');
    });

    it('should detect DROP COLUMN as breaking', async () => {
      setupMigrationTest('ALTER TABLE users DROP COLUMN email;');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns).toEqual(
        expect.arrayContaining([expect.stringContaining('DROP COLUMN')])
      );
    });

    it('should detect RENAME TABLE as breaking', async () => {
      setupMigrationTest('ALTER TABLE users RENAME TO accounts;');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns.length).toBeGreaterThan(0);
    });

    it('should detect RENAME COLUMN as breaking', async () => {
      setupMigrationTest('ALTER TABLE users RENAME COLUMN name TO full_name;');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(true);
    });

    it('should detect ALTER COLUMN TYPE as breaking', async () => {
      setupMigrationTest('ALTER TABLE users ALTER COLUMN age TYPE VARCHAR(10);');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(true);
    });

    it('should detect DROP INDEX as breaking', async () => {
      setupMigrationTest('DROP INDEX idx_users_email;');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(true);
    });

    it('should detect DROP CONSTRAINT as breaking', async () => {
      setupMigrationTest('ALTER TABLE users DROP CONSTRAINT fk_users_company;');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(true);
    });

    it('should detect DROP TYPE as breaking', async () => {
      setupMigrationTest('DROP TYPE user_role;');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(true);
    });
  });

  // ==========================================================================
  // Non-Breaking Pattern Detection
  // ==========================================================================

  describe('Non-Breaking Pattern Detection', () => {
    const setupMigrationTest = (sqlContent: string) => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_test', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('');
      mockFs.readFileSync.mockReturnValue(sqlContent);
      mockFs.statSync.mockReturnValue({ size: sqlContent.length } as any);
    };

    it('should detect CREATE TABLE as non-breaking', async () => {
      setupMigrationTest('CREATE TABLE users (id UUID PRIMARY KEY);');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(false);
      expect(result.migrationFiles[0].nonBreakingPatterns.length).toBeGreaterThan(0);
      expect(result.summary).toContain('non-breaking');
    });

    it('should detect ADD COLUMN as non-breaking', async () => {
      setupMigrationTest('ALTER TABLE users ADD COLUMN email VARCHAR(255);');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(false);
      expect(result.migrationFiles[0].nonBreakingPatterns).toEqual(
        expect.arrayContaining([expect.stringContaining('ADD')])
      );
    });

    it('should detect CREATE INDEX as non-breaking', async () => {
      setupMigrationTest('CREATE INDEX idx_users_email ON users(email);');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(false);
    });

    it('should detect ADD CONSTRAINT as non-breaking', async () => {
      setupMigrationTest('ALTER TABLE users ADD CONSTRAINT uk_email UNIQUE (email);');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(false);
    });

    it('should detect CREATE TYPE as non-breaking', async () => {
      setupMigrationTest('CREATE TYPE user_status AS ENUM (\'active\', \'inactive\');');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(false);
    });

    it('should detect UPDATE as non-breaking', async () => {
      setupMigrationTest('UPDATE users SET status = \'active\' WHERE status IS NULL;');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.isBreaking).toBe(false);
    });
  });

  // ==========================================================================
  // Timestamp Extraction
  // ==========================================================================

  describe('Timestamp Extraction', () => {
    const setupMigrationTest = (migrationName: string) => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: migrationName, isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('');
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id UUID);');
      mockFs.statSync.mockReturnValue({ size: 50 } as any);
    };

    it('should extract timestamp from 12-digit format (YYYYMMDDHHMM)', async () => {
      setupMigrationTest('202501011230_add_users');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.migrationFiles[0].timestamp).toBe('2025-01-01T12:30:00.000Z');
    });

    it('should extract timestamp from 8-digit format (YYYYMMDD)', async () => {
      setupMigrationTest('20250101_add_users');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.migrationFiles[0].timestamp).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should return null timestamp for invalid format', async () => {
      setupMigrationTest('invalid_migration_name');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.migrationFiles[0].timestamp).toBeNull();
    });
  });

  // ==========================================================================
  // Schema Version Generation
  // ==========================================================================

  describe('Schema Version Generation', () => {
    const setupMigrationTest = (migrationName: string) => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: migrationName, isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('');
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id UUID);');
      mockFs.statSync.mockReturnValue({ size: 50 } as any);
    };

    it('should generate schema version from migration name', async () => {
      setupMigrationTest('202501011230_add_users');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.schemaVersion).toBe('202501011230');
    });

    it('should use latest migration for schema version', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_first', isDirectory: () => true },
        { name: '20250102_second', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('');
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id UUID);');
      mockFs.statSync.mockReturnValue({ size: 50 } as any);

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.schemaVersion).toBe('20250102');
    });
  });

  // ==========================================================================
  // Story Metadata Update
  // ==========================================================================

  describe('Story Metadata Update', () => {
    it('should update story metadata with schema change info', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: { existing: 'data' },
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_test', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('');
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id UUID);');
      mockFs.statSync.mockReturnValue({ size: 50 } as any);

      await handler(mockPrisma, { storyId: 'story-123' });

      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            existing: 'data',
            schemaChanges: expect.objectContaining({
              hasChanges: true,
              isBreaking: false,
              detectedAt: expect.any(String),
              schemaVersion: '20250101',
              migrationCount: 1,
              breakingMigrationCount: 0,
              migrationFiles: ['20250101_test'],
            }),
          }),
        },
      });
    });
  });

  // ==========================================================================
  // Laptop Worktree Support (ST-158)
  // ==========================================================================

  describe('Laptop Worktree Support (ST-158)', () => {
    it('should use laptop project path for local worktrees', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/Users/user/projects/AIStudio/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'local',
      });
      mockPrisma.remoteAgent.findFirst.mockResolvedValue({
        id: 'agent-123',
        status: 'online',
        capabilities: ['git-execute'],
        config: { projectPath: '/Users/user/projects/AIStudio' },
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);
      mockGitUtils.execGit.mockReturnValue('');

      await handler(mockPrisma, { storyId: 'story-123' });

      expect(mockGitUtils.execGit).toHaveBeenCalledWith(
        expect.any(String),
        '/Users/user/projects/AIStudio'
      );
    });

    it('should fallback to default laptop path when agent offline', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/Users/user/projects/AIStudio/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'local',
      });
      mockPrisma.remoteAgent.findFirst.mockResolvedValue(null);
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);
      mockGitUtils.execGit.mockReturnValue('');

      await handler(mockPrisma, { storyId: 'story-123' });

      expect(mockGitUtils.execGit).toHaveBeenCalledWith(
        expect.any(String),
        '/Users/pawelgawliczek/projects/AIStudio'
      );
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_test', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('');
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      // Should still return result, marking migration as breaking conservatively
      expect(result.migrationFiles[0].isBreaking).toBe(true);
      expect(result.migrationFiles[0].warnings).toContain(
        expect.stringContaining('Failed to read')
      );
    });

    it('should handle migration file too large', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-123',
        metadata: {},
      });
      mockPrisma.worktree.findFirst.mockResolvedValue({
        id: 'wt-123',
        worktreePath: '/opt/stack/worktrees/st-123',
        branchName: 'st-123',
        hostType: 'server',
      });
      mockGitUtils.validateWorktreePath.mockImplementation(() => {});
      mockGitUtils.checkFilesystemExists.mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20250101_test', isDirectory: () => true },
      ] as any);
      mockGitUtils.execGit.mockReturnValue('');
      mockFs.statSync.mockReturnValue({ size: 15 * 1024 * 1024 } as any);

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.migrationFiles[0].warnings).toContain(
        expect.stringContaining('too large')
      );
    });
  });
});
