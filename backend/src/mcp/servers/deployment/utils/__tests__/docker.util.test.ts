/**
 * Unit Tests for Docker Utilities (ST-113, ST-115)
 *
 * Tests:
 * - Builder isolation functionality
 * - Build command generation with worktree context
 * - Test stack startup with WORKTREE_PATH env
 * - Build context isolation (prevents main worktree rebuild issue)
 *
 * NOTE: These tests mock child_process.execSync to verify command generation
 */

import { execSync } from 'child_process';
import * as environments from '../../../../../config/environments.js';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock environments module
jest.mock('../../../../../config/environments.js', () => ({
  isAgentTestingMode: jest.fn(),
  assertSafeDockerCommand: jest.fn(),
  ProductionSafetyError: class extends Error {},
}));

// Import after mocks
import {
  buildTestContainers,
  startTestStack,
  buildContainers,
  getContainerStatus,
  getTestContainerStatus,
  checkTestStackHealthy,
  getContainerLogs,
  getTestContainerLogs,
} from '../docker.util.js';

describe('Docker Utilities', () => {
  const mockExecSync = execSync as jest.Mock;
  const mockIsAgentTestingMode = environments.isAgentTestingMode as jest.Mock;
  const mockAssertSafeDockerCommand = environments.assertSafeDockerCommand as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAgentTestingMode.mockReturnValue(false);
    mockAssertSafeDockerCommand.mockImplementation(() => {}); // No-op by default
  });

  // ==========================================================================
  // Test Stack Container Builds (ST-113)
  // ==========================================================================

  describe('buildTestContainers', () => {
    it('should use vibestudio-test builder for isolated cache', async () => {
      // Builder exists
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('docker buildx inspect vibestudio-test')) {
          return 'Name: vibestudio-test\n';
        }
        return '';
      });

      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115-build', true, true);

      // Should inspect builder first
      expect(mockExecSync).toHaveBeenCalledWith(
        'docker buildx inspect vibestudio-test',
        expect.any(Object)
      );

      // Should use --builder vibestudio-test in build commands
      const buildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker buildx build')
      );
      expect(buildCalls.length).toBe(2); // backend + frontend

      buildCalls.forEach(call => {
        expect(call[0]).toContain('--builder vibestudio-test');
      });
    });

    it('should create builder if it does not exist', async () => {
      // Builder doesn't exist
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('docker buildx inspect vibestudio-test')) {
          throw new Error('Builder not found');
        }
        if (cmd.includes('docker buildx create')) {
          return 'vibestudio-test\n';
        }
        return '';
      });

      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115-build', true, true);

      // Should create builder
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('docker buildx create --name vibestudio-test'),
        expect.any(Object)
      );
    });

    it('should use worktree path as build context (not main worktree)', async () => {
      mockExecSync.mockReturnValue('');

      const mainWorktree = '/opt/stack/AIStudio';
      const storyWorktree = '/opt/stack/worktrees/st-115-build';

      await buildTestContainers(mainWorktree, storyWorktree, true, true);

      // Build commands should use story worktree as context
      const buildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker buildx build')
      );

      buildCalls.forEach(call => {
        const command = call[0];
        // Command should end with the worktree path as build context
        expect(command).toContain(storyWorktree);
        // Dockerfile should be from main worktree
        expect(command).toContain(`-f ${mainWorktree}`);
      });
    });

    it('should use --load flag to load image into local Docker daemon', async () => {
      mockExecSync.mockReturnValue('');

      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115', true, true);

      const buildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker buildx build')
      );

      buildCalls.forEach(call => {
        expect(call[0]).toContain('--load');
      });
    });

    it('should use --no-cache flag for reproducible builds', async () => {
      mockExecSync.mockReturnValue('');

      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115', true, true);

      const buildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker buildx build')
      );

      buildCalls.forEach(call => {
        expect(call[0]).toContain('--no-cache');
      });
    });

    it('should tag images correctly for test stack', async () => {
      mockExecSync.mockReturnValue('');

      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115', true, true);

      const buildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker buildx build')
      );

      // Should have backend and frontend builds with correct tags
      expect(buildCalls.some(call => call[0].includes('-t aistudio-test-backend'))).toBe(true);
      expect(buildCalls.some(call => call[0].includes('-t aistudio-test-frontend'))).toBe(true);
    });

    it('should skip backend build when rebuildBackend is false', async () => {
      mockExecSync.mockReturnValue('');

      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115', false, true);

      const buildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker buildx build')
      );

      expect(buildCalls.some(call => call[0].includes('aistudio-test-backend'))).toBe(false);
      expect(buildCalls.some(call => call[0].includes('aistudio-test-frontend'))).toBe(true);
    });

    it('should skip frontend build when rebuildFrontend is false', async () => {
      mockExecSync.mockReturnValue('');

      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115', true, false);

      const buildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker buildx build')
      );

      expect(buildCalls.some(call => call[0].includes('aistudio-test-backend'))).toBe(true);
      expect(buildCalls.some(call => call[0].includes('aistudio-test-frontend'))).toBe(false);
    });

    it('should remove node_modules symlinks before build', async () => {
      mockExecSync.mockReturnValue('');

      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115', true, true);

      // Should attempt to remove backend and frontend node_modules
      const rmCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('rm -f')
      );

      expect(rmCalls.some(call => call[0].includes('backend/node_modules'))).toBe(true);
      expect(rmCalls.some(call => call[0].includes('frontend/node_modules'))).toBe(true);
    });
  });

  // ==========================================================================
  // Test Stack Startup (ST-115 Build Context Issue)
  // ==========================================================================

  describe('startTestStack', () => {
    it('should set WORKTREE_PATH environment variable when worktreePath provided', async () => {
      mockExecSync.mockReturnValue('');

      const mainWorktree = '/opt/stack/AIStudio';
      const storyWorktree = '/opt/stack/worktrees/st-115-build';

      await startTestStack(mainWorktree, storyWorktree);

      // Check that execSync was called with env containing WORKTREE_PATH
      const composeCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker compose')
      );

      expect(composeCalls.length).toBeGreaterThan(0);
      const lastCall = composeCalls[composeCalls.length - 1];
      expect(lastCall[1].env).toBeDefined();
      expect(lastCall[1].env.WORKTREE_PATH).toBe(storyWorktree);
    });

    it('should use docker-compose.test.yml file', async () => {
      mockExecSync.mockReturnValue('');

      await startTestStack('/opt/stack/AIStudio');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('docker compose -f docker-compose.test.yml'),
        expect.any(Object)
      );
    });

    it('should start all test services', async () => {
      mockExecSync.mockReturnValue('');

      await startTestStack('/opt/stack/AIStudio');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('test-postgres test-redis test-backend test-frontend'),
        expect.any(Object)
      );
    });

    /**
     * CRITICAL TEST: Verifies the fix for the build context issue
     *
     * Issue: When docker compose up runs with `build:` directive in docker-compose.test.yml
     * without --no-build flag, it can trigger a rebuild from the wrong context (main worktree)
     *
     * Resolution: buildTestContainers pre-builds images with explicit worktree context,
     * and startTestStack starts containers without triggering additional builds
     */
    it('should NOT trigger docker build during startup (prevents wrong context builds)', async () => {
      mockExecSync.mockReturnValue('');

      await startTestStack('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115');

      const composeCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker compose')
      );

      // The compose command should NOT contain --build or --force-recreate
      // which would trigger a rebuild from docker-compose.yml context
      composeCalls.forEach(call => {
        const command = call[0];
        // Note: Current implementation doesn't explicitly use --no-build
        // This test documents the expected behavior that builds should NOT happen here
        // The actual build happens in buildTestContainers with explicit context
        expect(command).not.toContain('--build');
      });
    });
  });

  // ==========================================================================
  // Production Container Builds (ST-113)
  // ==========================================================================

  describe('buildContainers - Production Builds', () => {
    it('should use --no-cache flag for backend builds', async () => {
      mockExecSync.mockReturnValue('');

      await buildContainers('/opt/stack/AIStudio', false, true);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('build --no-cache backend'),
        expect.any(Object)
      );
    });

    it('should use --no-cache flag for frontend builds', async () => {
      mockExecSync.mockReturnValue('');

      await buildContainers('/opt/stack/AIStudio', true, false);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('build --no-cache frontend'),
        expect.any(Object)
      );
    });

    it('should block production operations in agent testing mode', async () => {
      mockIsAgentTestingMode.mockReturnValue(true);
      mockExecSync.mockReturnValue('');

      await buildContainers('/opt/stack/AIStudio', true, true);

      // Should call assertSafeDockerCommand for each docker compose command
      expect(mockAssertSafeDockerCommand).toHaveBeenCalled();
    });

    it('should skip backend when rebuildBackend is false', async () => {
      mockExecSync.mockReturnValue('');

      await buildContainers('/opt/stack/AIStudio', false, false);

      const buildCalls = mockExecSync.mock.calls;
      expect(buildCalls.some(call => call[0].includes('backend'))).toBe(false);
    });

    it('should skip frontend when rebuildFrontend is false', async () => {
      mockExecSync.mockReturnValue('');

      await buildContainers('/opt/stack/AIStudio', false, false);

      const buildCalls = mockExecSync.mock.calls;
      expect(buildCalls.some(call => call[0].includes('frontend'))).toBe(false);
    });
  });

  // ==========================================================================
  // Container Status Queries
  // ==========================================================================

  describe('getContainerStatus', () => {
    it('should return healthy status when container is running', () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        Name: 'backend',
        State: 'running',
        Health: 'healthy',
      }));

      const status = getContainerStatus('/opt/stack/AIStudio', 'backend');

      expect(status.name).toBe('backend');
      expect(status.state).toBe('running');
      expect(status.healthy).toBe(true);
    });

    it('should return unhealthy when container is not running', () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        Name: 'backend',
        State: 'exited',
        Health: 'none',
      }));

      const status = getContainerStatus('/opt/stack/AIStudio', 'backend');

      expect(status.healthy).toBe(false);
    });

    it('should return stopped when no container found', () => {
      mockExecSync.mockReturnValue('');

      const status = getContainerStatus('/opt/stack/AIStudio', 'nonexistent');

      expect(status.state).toBe('stopped');
      expect(status.healthy).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Docker not available');
      });

      const status = getContainerStatus('/opt/stack/AIStudio', 'backend');

      expect(status.state).toBe('unknown');
      expect(status.healthy).toBe(false);
    });
  });

  describe('getTestContainerStatus', () => {
    it('should query test stack using test compose file', () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        Name: 'test-backend',
        State: 'running',
        Health: 'healthy',
      }));

      getTestContainerStatus('/opt/stack/AIStudio', 'test-backend');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose.test.yml'),
        expect.any(Object)
      );
    });
  });

  describe('checkTestStackHealthy', () => {
    it('should check all test services', () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        State: 'running',
        Health: 'healthy',
      }));

      const result = checkTestStackHealthy('/opt/stack/AIStudio');

      // Should query all 4 services
      expect(mockExecSync).toHaveBeenCalledTimes(4);
      expect(result.statuses.length).toBe(4);
    });

    it('should return unhealthy if any service is down', () => {
      mockExecSync
        .mockReturnValueOnce(JSON.stringify({ State: 'running', Health: 'healthy' }))
        .mockReturnValueOnce(JSON.stringify({ State: 'running', Health: 'healthy' }))
        .mockReturnValueOnce(JSON.stringify({ State: 'exited', Health: 'unhealthy' }))
        .mockReturnValueOnce(JSON.stringify({ State: 'running', Health: 'healthy' }));

      const result = checkTestStackHealthy('/opt/stack/AIStudio');

      expect(result.healthy).toBe(false);
    });
  });

  // ==========================================================================
  // Container Logs
  // ==========================================================================

  describe('getContainerLogs', () => {
    it('should fetch logs with specified line count', () => {
      mockExecSync.mockReturnValue('line1\nline2\nline3');

      const logs = getContainerLogs('/opt/stack/AIStudio', 'backend', 100);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('logs --tail 100 backend'),
        expect.any(Object)
      );
      expect(logs).toBe('line1\nline2\nline3');
    });

    it('should default to 50 lines', () => {
      mockExecSync.mockReturnValue('logs');

      getContainerLogs('/opt/stack/AIStudio', 'backend');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('logs --tail 50'),
        expect.any(Object)
      );
    });

    it('should return error message on failure', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Container not found');
      });

      const logs = getContainerLogs('/opt/stack/AIStudio', 'backend');

      expect(logs).toContain('Container not found');
    });
  });

  describe('getTestContainerLogs', () => {
    it('should use test compose file', () => {
      mockExecSync.mockReturnValue('test logs');

      getTestContainerLogs('/opt/stack/AIStudio', 'test-backend', 25);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose.test.yml'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('logs --tail 25'),
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // Builder Isolation Verification (ST-113)
  // ==========================================================================

  describe('Builder Isolation', () => {
    it('should use different builders for test and production', async () => {
      // This test verifies the architecture:
      // - Test builds use vibestudio-test builder
      // - Production builds use default builder (docker compose build)
      //
      // This prevents cache contamination between environments

      mockExecSync.mockReturnValue('');

      // Test build
      await buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115', true, false);

      const testBuildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker buildx build')
      );
      expect(testBuildCalls.some(call => call[0].includes('--builder vibestudio-test'))).toBe(true);

      jest.clearAllMocks();

      // Production build (uses docker compose, not buildx)
      await buildContainers('/opt/stack/AIStudio', false, true);

      const prodBuildCalls = mockExecSync.mock.calls.filter(
        call => call[0].includes('docker compose')
      );
      expect(prodBuildCalls.some(call => call[0].includes('build'))).toBe(true);
      // Production uses compose build, not buildx with --builder
      expect(prodBuildCalls.some(call => call[0].includes('--builder'))).toBe(false);
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should propagate build errors with context', async () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('Build failed');
        (error as any).stderr = 'npm ERR! ERESOLVE';
        (error as any).stdout = '';
        throw error;
      });

      await expect(
        buildTestContainers('/opt/stack/AIStudio', '/opt/stack/worktrees/st-115', true, false)
      ).rejects.toThrow();
    });

    it('should handle compose startup errors', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('docker compose')) {
          const error = new Error('Container start failed');
          (error as any).stderr = 'port already in use';
          throw error;
        }
        return '';
      });

      await expect(startTestStack('/opt/stack/AIStudio')).rejects.toThrow();
    });
  });
});
