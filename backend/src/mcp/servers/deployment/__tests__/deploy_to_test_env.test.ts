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
    update: jest.fn(),
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
      (mockPrisma.worktree.update as jest.Mock).mockResolvedValue({
        id: 'worktree-1',
        status: 'removed',
      });

      const fs = require('fs');
      fs.existsSync = jest.fn().mockReturnValue(false);

      await expect(
        handler(mockPrisma, { storyId: 'story-1' })
      ).rejects.toThrow(ValidationError);

      // Verify worktree status was updated to 'removed'
      expect(mockPrisma.worktree.update).toHaveBeenCalledWith({
        where: { id: 'worktree-1' },
        data: { status: 'removed' },
      });
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

      (dockerUtil.buildTestContainers as jest.Mock).mockResolvedValue(undefined);
      (dockerUtil.startTestStack as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3001/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5174/health',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const childProcess = require('child_process');
      childProcess.execSync = jest.fn(); // Mock prisma migrate deploy

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      expect(result.actionsExecuted.schemaMigration).toBe(true);
      // Now uses prisma migrate deploy against test DB
      expect(childProcess.execSync).toHaveBeenCalledWith(
        expect.stringContaining('prisma migrate deploy'),
        expect.any(Object)
      );
    });

    it('should no longer run npm install (test containers are pre-built)', async () => {
      // ST-76: We no longer run npm install during deployment
      // Test containers are pre-built with dependencies
      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: true, // This is ignored now
        environment: false,
        docker: false,
      });

      (dockerUtil.buildTestContainers as jest.Mock).mockResolvedValue(undefined);
      (dockerUtil.startTestStack as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3001/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5174/health',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const result = await handler(mockPrisma, { storyId: 'story-1' });

      expect(result.success).toBe(true);
      // npm install is no longer executed in isolated test stack
      expect(result.actionsExecuted.npmInstall).toBe(false);
    });

    it('should build and start test containers', async () => {
      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: false,
        environment: false,
        docker: false,
      });

      (dockerUtil.buildTestContainers as jest.Mock).mockResolvedValue(undefined);
      (dockerUtil.startTestStack as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3001/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5174/health',
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
      expect(result.actionsExecuted.dockerRebuild).toBe(true);
      expect(result.actionsExecuted.containerRestart).toBe(true);
      expect(dockerUtil.buildTestContainers).toHaveBeenCalledWith(
        '/opt/stack/AIStudio',
        true,
        true
      );
      expect(dockerUtil.startTestStack).toHaveBeenCalledWith(
        '/opt/stack/AIStudio'
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

      (dockerUtil.buildTestContainers as jest.Mock).mockResolvedValue(undefined);
      (dockerUtil.startTestStack as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3001/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5174/health',
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

      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: false,
        environment: false,
        docker: false,
      });

      (dockerUtil.buildTestContainers as jest.Mock).mockResolvedValue(undefined);
      (dockerUtil.startTestStack as jest.Mock).mockResolvedValue(undefined);
    });

    it('should fail deployment when test stack health checks fail', async () => {
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: false,
        results: [
          {
            url: 'http://localhost:3001/api/health',
            status: 500,
            healthy: false,
            latency: 100,
            timestamp: new Date().toISOString(),
            error: 'Internal server error',
          },
          {
            url: 'http://localhost:5174/health',
            status: 200,
            healthy: true,
            latency: 50,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      (dockerUtil.getTestContainerLogs as jest.Mock).mockReturnValue(
        'Test backend error logs...'
      );

      await expect(
        handler(mockPrisma, { storyId: 'story-1' })
      ).rejects.toThrow(/Test stack health checks failed/);
    });

    it('should succeed when all test stack health checks pass', async () => {
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3001/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5174/health',
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

      (changeDetectionUtil.detectAllChanges as jest.Mock).mockResolvedValue({
        schema: false,
        dependencies: false,
        environment: false,
        docker: false,
      });

      (dockerUtil.buildTestContainers as jest.Mock).mockResolvedValue(undefined);
      (dockerUtil.startTestStack as jest.Mock).mockResolvedValue(undefined);
      (healthCheckUtil.waitForHealthy as jest.Mock).mockResolvedValue({
        healthy: true,
        results: [
          {
            url: 'http://localhost:3001/api/health',
            status: 200,
            healthy: true,
            latency: 100,
            timestamp: new Date().toISOString(),
          },
          {
            url: 'http://localhost:5174/health',
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
