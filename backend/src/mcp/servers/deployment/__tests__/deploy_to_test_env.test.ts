/**
 * Unit Tests for Deploy to Test Environment Tool
 *
 * Tests validation, change detection, and error handling
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../../types';
import { handler } from '../deploy_to_test_env';
import * as changeDetectionUtil from '../utils/change-detection.util';
import * as dockerUtil from '../utils/docker.util';
import * as healthCheckUtil from '../utils/health-check.util';

// Mock modules
jest.mock('../utils/change-detection.util');
jest.mock('../utils/docker.util');
jest.mock('../utils/health-check.util');
jest.mock('../../git/git_utils');
jest.mock('child_process');
jest.mock('fs');

const mockPrisma = {
  story: {
    findUnique: jest.fn(),
  },
  worktree: {
    findFirst: jest.fn(),
  },
  testQueue: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('deploy_to_test_env Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('should throw ValidationError when storyId is missing', async () => {
      await expect(
        handler(mockPrisma, {} as any)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when story does not exist', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { storyId: 'nonexistent-id' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when story has no worktree', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue({
        id: 'story-1',
        key: 'ST-1',
        title: 'Test Story',
      });
      (mockPrisma.worktree.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { storyId: 'story-1' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when worktree path does not exist', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue({
        id: 'story-1',
        key: 'ST-1',
        title: 'Test Story',
      });
      (mockPrisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        id: 'worktree-1',
        branchName: 'ST-1-test-story',
        worktreePath: '/nonexistent/path',
      });

      const fs = require('fs');
      fs.existsSync = jest.fn().mockReturnValue(false);

      await expect(
        handler(mockPrisma, { storyId: 'story-1' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Change Detection', () => {
    beforeEach(() => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue({
        id: 'story-1',
        key: 'ST-1',
        title: 'Test Story',
      });
      (mockPrisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        id: 'worktree-1',
        branchName: 'ST-1-test-story',
        worktreePath: '/opt/stack/worktrees/ST-1-test-story',
      });

      const fs = require('fs');
      fs.existsSync = jest.fn().mockReturnValue(true);

      const gitUtils = require('../../git/git_utils');
      gitUtils.execGit = jest.fn();

      (mockPrisma.testQueue.findFirst as jest.Mock).mockResolvedValue({
        id: 'queue-1',
        status: 'pending',
        position: 1,
      });
      (mockPrisma.testQueue.update as jest.Mock).mockResolvedValue({
        id: 'queue-1',
        status: 'running',
        position: 1,
      });
    });

    it('should detect schema changes and trigger migration', async () => {
      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: true,
        dependencies: false,
        environment: false,
        docker: false,
        schemaDetails: {
          hasChanges: true,
          isBreaking: false,
          migrationCount: 1,
          schemaVersion: '20250120_001',
          migrationFiles: [
            {
              name: '20250120_001_add_column',
              timestamp: '2025-01-20',
              isNew: true,
              isBreaking: false,
            },
          ],
        },
      });

      (dockerUtil.restartServices as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3000/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5173',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const childProcess = require('child_process');
      childProcess.execSync = jest.fn(); // Mock npm run migrate:safe

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      expect(result.actionsExecuted.schemaMigration).toBe(true);
      expect(childProcess.execSync).toHaveBeenCalledWith(
        expect.stringContaining('migrate:safe'),
        expect.any(Object)
      );
    });

    it('should detect dependency changes and run npm install', async () => {
      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: true,
        environment: false,
        docker: false,
      });

      (dockerUtil.restartServices as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3000/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5173',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const childProcess = require('child_process');
      childProcess.execSync = jest.fn();

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      expect(result.actionsExecuted.npmInstall).toBe(true);
      expect(childProcess.execSync).toHaveBeenCalledWith(
        'npm install',
        expect.any(Object)
      );
    });

    it('should detect docker changes and rebuild containers', async () => {
      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: false,
        environment: false,
        docker: true,
      });

      (dockerUtil.buildContainers as jest.Mock).mockResolvedValue(undefined);
      (dockerUtil.restartServices as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3000/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5173',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      expect(result.actionsExecuted.dockerRebuild).toBe(true);
      expect(dockerUtil.buildContainers).toHaveBeenCalledWith(
        '/opt/stack/AIStudio',
        true,
        true
      );
    });

    it('should warn about environment variable changes', async () => {
      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: false,
        environment: true,
        docker: false,
        envDetails: {
          hasChanges: true,
          addedVars: ['NEW_VAR'],
          removedVars: [],
          modifiedVars: ['EXISTING_VAR'],
          missingRequired: [],
        },
      });

      (dockerUtil.restartServices as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3000/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5173',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('NEW_VAR'))).toBe(true);
    });

    it('should fail when missing required environment variables', async () => {
      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: false,
        environment: true,
        docker: false,
        envDetails: {
          hasChanges: true,
          addedVars: [],
          removedVars: [],
          modifiedVars: [],
          missingRequired: ['REQUIRED_VAR'],
        },
      });

      await expect(
        handler(mockPrisma, { storyId: 'story-1' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Health Checks', () => {
    beforeEach(() => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue({
        id: 'story-1',
        key: 'ST-1',
        title: 'Test Story',
      });
      (mockPrisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        id: 'worktree-1',
        branchName: 'ST-1-test-story',
        worktreePath: '/opt/stack/worktrees/ST-1-test-story',
      });

      const fs = require('fs');
      fs.existsSync = jest.fn().mockReturnValue(true);

      const gitUtils = require('../../git/git_utils');
      gitUtils.execGit = jest.fn();

      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: false,
        environment: false,
        docker: false,
      });

      (dockerUtil.restartServices as jest.Mock).mockResolvedValue(undefined);
    });

    it('should fail deployment when health checks fail', async () => {
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: false,
        results: [
          {
            url: 'http://localhost:3000/api/health',
            status: 500,
            healthy: false,
            latency: 100,
            timestamp: new Date().toISOString(),
            error: 'Internal server error',
          },
          {
            url: 'http://localhost:5173',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      (dockerUtil.getContainerLogs as jest.Mock).mockReturnValue(
        'Backend error logs...'
      );

      await expect(
        handler(mockPrisma, { storyId: 'story-1' })
      ).rejects.toThrow(/Health checks failed/);
    });

    it('should succeed when all health checks pass', async () => {
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3000/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5173',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      (mockPrisma.testQueue.findFirst as jest.Mock).mockResolvedValue({
        id: 'queue-1',
        status: 'pending',
        position: 1,
      });
      (mockPrisma.testQueue.update as jest.Mock).mockResolvedValue({
        id: 'queue-1',
        status: 'running',
        position: 1,
      });

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      expect(result.healthCheckResults?.backend.healthy).toBe(true);
      expect(result.healthCheckResults?.frontend.healthy).toBe(true);
    });
  });

  describe('Test Queue Integration', () => {
    beforeEach(() => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue({
        id: 'story-1',
        key: 'ST-1',
        title: 'Test Story',
      });
      (mockPrisma.worktree.findFirst as jest.Mock).mockResolvedValue({
        id: 'worktree-1',
        branchName: 'ST-1-test-story',
        worktreePath: '/opt/stack/worktrees/ST-1-test-story',
      });

      const fs = require('fs');
      fs.existsSync = jest.fn().mockReturnValue(true);

      const gitUtils = require('../../git/git_utils');
      gitUtils.execGit = jest.fn();

      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: false,
        environment: false,
        docker: false,
      });

      (dockerUtil.restartServices as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3000/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5173',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    });

    it('should update test queue status to running', async () => {
      (mockPrisma.testQueue.findFirst as jest.Mock).mockResolvedValue({
        id: 'queue-1',
        status: 'pending',
        position: 1,
      });
      (mockPrisma.testQueue.update as jest.Mock).mockResolvedValue({
        id: 'queue-1',
        status: 'running',
        position: 1,
      });

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      expect(result.testQueueUpdate?.status).toBe('running');
      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: { status: 'running' },
      });
    });

    it('should warn when test queue entry not found', async () => {
      (mockPrisma.testQueue.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'Test queue status not updated - story may not be in queue'
      );
    });
  });
});
