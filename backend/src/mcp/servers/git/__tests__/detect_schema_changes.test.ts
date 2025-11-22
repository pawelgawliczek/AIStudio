/**
 * Tests for detect_schema_changes tool
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { handler, tool } from '../detect_schema_changes';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../git_utils', () => ({
  execGit: jest.fn(),
  validateWorktreePath: jest.fn(),
  checkFilesystemExists: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockFs = fs as jest.Mocked<typeof fs>;

// Import mocked git_utils
import { execGit, validateWorktreePath, checkFilesystemExists } from '../git_utils';
const mockExecGit = execGit as jest.MockedFunction<typeof execGit>;
const mockValidateWorktreePath = validateWorktreePath as jest.MockedFunction<typeof validateWorktreePath>;
const mockCheckFilesystemExists = checkFilesystemExists as jest.MockedFunction<typeof checkFilesystemExists>;

describe('detect_schema_changes', () => {
  let prisma: PrismaClient;
  const testStoryId = 'test-story-id-123';
  const testWorktreeId = 'test-worktree-id-456';
  const testWorktreePath = '/opt/stack/worktrees/st-42-schema-detection';

  const mockStory = {
    id: testStoryId,
    key: 'ST-42',
    title: 'Schema Detection Test',
    projectId: 'test-project-id',
    metadata: null,
  };

  const mockWorktree = {
    id: testWorktreeId,
    storyId: testStoryId,
    branchName: 'st-42-schema-detection',
    worktreePath: testWorktreePath,
    baseBranch: 'main',
    status: 'active',
    createdAt: new Date(),
  };

  beforeEach(() => {
    prisma = createTestPrismaClient();
    jest.clearAllMocks();

    // Default mock implementations
    mockValidateWorktreePath.mockImplementation(() => undefined);
    mockCheckFilesystemExists.mockReturnValue(true);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('detect_schema_changes');
    });

    it('should have required storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });

    it('should have git category metadata', () => {
      const metadata = require('../detect_schema_changes').metadata;
      expect(metadata.category).toBe('git');
      expect(metadata.version).toBe('1.0.0');
    });
  });

  describe('Input Validation', () => {
    it('should throw NotFoundError when story does not exist', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow('Story');
    });

    it('should throw NotFoundError when no worktree exists', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow('Worktree');
    });

    it('should throw ValidationError when worktree filesystem does not exist', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);
      mockCheckFilesystemExists.mockReturnValue(false);

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow('filesystem does not exist');
    });
  });

  describe('Migration Discovery', () => {
    beforeEach(() => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);
      prisma.story.update = jest.fn().mockResolvedValue(mockStory);
    });

    it('should return no changes when no new migrations', async () => {
      // Mock empty worktree migrations directory
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);
      mockExecGit.mockReturnValue('');

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.hasChanges).toBe(false);
      expect(result.isBreaking).toBe(false);
      expect(result.migrationFiles).toHaveLength(0);
      expect(result.summary).toBe('No schema changes detected');
    });

    it('should detect new migrations in worktree', async () => {
      const migrationName = '20251119_add_tool_calls';
      const migrationSQL = 'CREATE TABLE test_table (id SERIAL PRIMARY KEY);';

      // Mock worktree has new migration
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: migrationName, isDirectory: () => true },
      ] as any);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue(migrationSQL);

      // Mock main branch has no migrations
      mockExecGit.mockReturnValue('');

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.hasChanges).toBe(true);
      expect(result.migrationFiles).toHaveLength(1);
      expect(result.migrationFiles[0].name).toBe(migrationName);
      expect(result.metadata.migrationCount).toBe(1);
    });

    it('should only return new migrations not in main branch', async () => {
      const existingMigration = '20251118_existing_migration';
      const newMigration = '20251119_new_migration';

      // Mock worktree has both migrations
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: existingMigration, isDirectory: () => true },
        { name: newMigration, isDirectory: () => true },
      ] as any);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id INT);');

      // Mock main branch has only existing migration
      mockExecGit.mockReturnValue(`${existingMigration}\n`);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.hasChanges).toBe(true);
      expect(result.migrationFiles).toHaveLength(1);
      expect(result.migrationFiles[0].name).toBe(newMigration);
    });
  });

  describe('Breaking Pattern Detection', () => {
    beforeEach(() => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);
      prisma.story.update = jest.fn().mockResolvedValue(mockStory);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20251119_test_migration', isDirectory: () => true },
      ] as any);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockExecGit.mockReturnValue('');
    });

    it('should detect DROP TABLE as breaking', async () => {
      mockFs.readFileSync.mockReturnValue('DROP TABLE users;');

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns.length).toBeGreaterThan(0);
      expect(result.migrationFiles[0].breakingPatterns[0]).toContain('DROP_TABLE');
      expect(result.summary).toContain('breaking');
    });

    it('should detect DROP COLUMN as breaking', async () => {
      mockFs.readFileSync.mockReturnValue('ALTER TABLE users DROP COLUMN email;');

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns[0]).toContain('DROP_COLUMN');
    });

    it('should detect ALTER COLUMN TYPE as breaking', async () => {
      mockFs.readFileSync.mockReturnValue(
        'ALTER TABLE users ALTER COLUMN id TYPE BIGINT;'
      );

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns[0]).toContain('ALTER_COLUMN_TYPE');
    });

    it('should detect RENAME COLUMN as breaking', async () => {
      mockFs.readFileSync.mockReturnValue(
        'ALTER TABLE users RENAME COLUMN email TO email_address;'
      );

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns[0]).toContain('RENAME_COLUMN');
    });

    it('should detect case-insensitive patterns', async () => {
      mockFs.readFileSync.mockReturnValue('drop table users;');

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(true);
    });

    it('should detect multiple breaking patterns in one file', async () => {
      mockFs.readFileSync.mockReturnValue(`
        DROP TABLE old_users;
        ALTER TABLE accounts DROP COLUMN legacy_id;
        DROP INDEX idx_old_email;
      `);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns.length).toBe(3);
    });
  });

  describe('Non-Breaking Pattern Detection', () => {
    beforeEach(() => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);
      prisma.story.update = jest.fn().mockResolvedValue(mockStory);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20251119_test_migration', isDirectory: () => true },
      ] as any);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockExecGit.mockReturnValue('');
    });

    it('should identify CREATE TABLE as non-breaking', async () => {
      mockFs.readFileSync.mockReturnValue('CREATE TABLE logs (id SERIAL PRIMARY KEY);');

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(false);
      expect(result.migrationFiles[0].nonBreakingPatterns.length).toBeGreaterThan(0);
      expect(result.migrationFiles[0].nonBreakingPatterns[0]).toContain('CREATE_TABLE');
    });

    it('should identify ADD COLUMN as non-breaking', async () => {
      mockFs.readFileSync.mockReturnValue('ALTER TABLE users ADD COLUMN metadata JSONB;');

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(false);
      expect(result.migrationFiles[0].nonBreakingPatterns[0]).toContain('ADD_COLUMN');
    });

    it('should identify CREATE INDEX as non-breaking', async () => {
      mockFs.readFileSync.mockReturnValue('CREATE INDEX idx_user_email ON users(email);');

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.isBreaking).toBe(false);
      expect(result.migrationFiles[0].nonBreakingPatterns[0]).toContain('CREATE_INDEX');
    });

    it('should identify mixed patterns but mark as breaking', async () => {
      mockFs.readFileSync.mockReturnValue(`
        CREATE TABLE new_users (id SERIAL PRIMARY KEY);
        DROP TABLE old_users;
      `);

      const result = await handler(prisma, { storyId: testStoryId });

      // Should be breaking due to DROP TABLE
      expect(result.isBreaking).toBe(true);
      expect(result.migrationFiles[0].breakingPatterns.length).toBeGreaterThan(0);
      // Non-breaking patterns should be empty when breaking patterns exist
      expect(result.migrationFiles[0].nonBreakingPatterns.length).toBe(0);
    });
  });

  describe('Schema Version Extraction', () => {
    beforeEach(() => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);
      prisma.story.update = jest.fn().mockResolvedValue(mockStory);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id INT);');
      mockExecGit.mockReturnValue('');
    });

    it('should extract timestamp from standard format', async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: '202511191430_add_fields', isDirectory: () => true },
      ] as any);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.schemaVersion).toBe('202511191430');
      expect(result.migrationFiles[0].timestamp).toContain('2025-11-19');
    });

    it('should handle date-only format', async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: '20251119_add_fields', isDirectory: () => true },
      ] as any);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.schemaVersion).toBe('20251119');
      expect(result.migrationFiles[0].timestamp).toContain('2025-11-19');
    });

    it('should return null for invalid format', async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'invalid_migration_name', isDirectory: () => true },
      ] as any);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.migrationFiles[0].timestamp).toBeNull();
    });

    it('should use latest timestamp for schemaVersion', async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: '20251118_first', isDirectory: () => true },
        { name: '20251119_second', isDirectory: () => true },
      ] as any);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.schemaVersion).toBe('20251119');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);
      prisma.story.update = jest.fn().mockResolvedValue(mockStory);

      mockFs.existsSync.mockReturnValue(true);
      mockExecGit.mockReturnValue('');
    });

    it('should handle unreadable migration file gracefully', async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: '20251119_bad_migration', isDirectory: () => true },
      ] as any);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await handler(prisma, { storyId: testStoryId });

      // Should still return result with warning
      expect(result.hasChanges).toBe(true);
      expect(result.migrationFiles[0].warnings).toBeDefined();
      expect(result.migrationFiles[0].warnings![0]).toContain('Failed to read');
      // Conservative: mark as breaking when can't read
      expect(result.migrationFiles[0].isBreaking).toBe(true);
    });

    it('should handle missing migrations directory in worktree', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.hasChanges).toBe(false);
      expect(result.migrationFiles).toHaveLength(0);
    });

    it('should handle git command failure for main branch', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20251119_new', isDirectory: () => true },
      ] as any);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id INT);');

      mockExecGit.mockImplementation(() => {
        throw new Error('Git command failed');
      });

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow('Git command failed');
    });

    it('should handle missing main branch migrations gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20251119_new', isDirectory: () => true },
      ] as any);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id INT);');

      // Main branch doesn't have migrations directory yet
      mockExecGit.mockImplementation(() => {
        const error = new Error('not a tree object');
        throw error;
      });

      const result = await handler(prisma, { storyId: testStoryId });

      // Should treat all worktree migrations as new
      expect(result.hasChanges).toBe(true);
      expect(result.migrationFiles).toHaveLength(1);
    });
  });

  describe('Database Updates', () => {
    beforeEach(() => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);
      prisma.story.update = jest.fn().mockResolvedValue(mockStory);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20251119_test', isDirectory: () => true },
      ] as any);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue('DROP TABLE users;');
      mockExecGit.mockReturnValue('');
    });

    it('should update story metadata with schema changes', async () => {
      await handler(prisma, { storyId: testStoryId });

      expect(prisma.story.update).toHaveBeenCalledWith({
        where: { id: testStoryId },
        data: {
          metadata: expect.objectContaining({
            schemaChanges: expect.objectContaining({
              hasChanges: true,
              isBreaking: true,
              migrationCount: 1,
              breakingMigrationCount: 1,
            }),
          }),
        },
      });
    });

    it('should preserve existing metadata fields', async () => {
      const storyWithMetadata = {
        ...mockStory,
        metadata: { existingField: 'value' },
      };
      prisma.story.findUnique = jest.fn().mockResolvedValue(storyWithMetadata);

      await handler(prisma, { storyId: testStoryId });

      expect(prisma.story.update).toHaveBeenCalledWith({
        where: { id: testStoryId },
        data: {
          metadata: expect.objectContaining({
            existingField: 'value',
            schemaChanges: expect.any(Object),
          }),
        },
      });
    });
  });

  describe('Response Structure', () => {
    beforeEach(() => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(mockStory);
      prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);
      prisma.story.update = jest.fn().mockResolvedValue(mockStory);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: '20251119_test', isDirectory: () => true },
      ] as any);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue('CREATE TABLE test (id INT);');
      mockExecGit.mockReturnValue('');
    });

    it('should return complete response structure', async () => {
      const result = await handler(prisma, { storyId: testStoryId });

      expect(result).toHaveProperty('hasChanges');
      expect(result).toHaveProperty('isBreaking');
      expect(result).toHaveProperty('migrationFiles');
      expect(result).toHaveProperty('schemaVersion');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('metadata');

      expect(result.metadata).toHaveProperty('worktreeId');
      expect(result.metadata).toHaveProperty('worktreePath');
      expect(result.metadata).toHaveProperty('branchName');
      expect(result.metadata).toHaveProperty('comparedAgainst');
      expect(result.metadata).toHaveProperty('detectedAt');
      expect(result.metadata).toHaveProperty('migrationCount');
      expect(result.metadata).toHaveProperty('breakingMigrationCount');
    });

    it('should include migration file details', async () => {
      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.migrationFiles[0]).toHaveProperty('name');
      expect(result.migrationFiles[0]).toHaveProperty('timestamp');
      expect(result.migrationFiles[0]).toHaveProperty('filePath');
      expect(result.migrationFiles[0]).toHaveProperty('isBreaking');
      expect(result.migrationFiles[0]).toHaveProperty('breakingPatterns');
      expect(result.migrationFiles[0]).toHaveProperty('nonBreakingPatterns');
    });
  });
});
