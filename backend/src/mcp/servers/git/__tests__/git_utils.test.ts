/**
 * Tests for git_utils shared utilities
 * Including ST-153 location-aware git execution
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import {
  execGit,
  parseGitStatus,
  getDiskUsageMB,
  checkFilesystemExists,
  validateWorktreePath,
  validateBranchName,
  setRemoteExecutionService,
  execGitLocationAware,
  isLaptopAgentOnline,
} from '../git_utils';

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

// Mock Prisma client
const mockPrisma = {
  worktree: {
    findFirst: jest.fn(),
  },
  remoteAgent: {
    findFirst: jest.fn(),
  },
} as any;

// Mock RemoteExecutionService
const mockRemoteExecutionService = {
  executeGitCommand: jest.fn(),
};

describe('git_utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execGit', () => {
    it('should execute git command successfully', () => {
      mockExecSync.mockReturnValue('success output');

      const result = execGit('git status');

      expect(result).toBe('success output');
      expect(mockExecSync).toHaveBeenCalledWith('git status', {
        cwd: '/opt/stack/AIStudio',
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('should use custom working directory', () => {
      mockExecSync.mockReturnValue('success');

      execGit('git status', '/custom/path');

      expect(mockExecSync).toHaveBeenCalledWith(
        'git status',
        expect.objectContaining({ cwd: '/custom/path' })
      );
    });

    it('should throw error with stderr on failure', () => {
      const error: any = new Error('Command failed');
      error.stderr = 'fatal: not a git repository';
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      expect(() => execGit('git status')).toThrow('fatal: not a git repository');
    });
  });

  describe('parseGitStatus', () => {
    it('should parse clean branch status', () => {
      const output = '## main...origin/main';

      const result = parseGitStatus(output);

      expect(result).toEqual({
        branch: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        modified: 0,
        staged: 0,
        untracked: 0,
        conflicted: 0,
        isClean: true,
        rawStatus: output,
      });
    });

    it('should parse branch ahead and behind', () => {
      const output = '## main...origin/main [ahead 2, behind 1]';

      const result = parseGitStatus(output);

      expect(result.ahead).toBe(2);
      expect(result.behind).toBe(1);
    });

    it('should count untracked files', () => {
      const output = `## main...origin/main
?? file1.ts
?? file2.ts`;

      const result = parseGitStatus(output);

      expect(result.untracked).toBe(2);
      expect(result.isClean).toBe(false);
    });

    it('should count modified and staged files', () => {
      const output = `## main...origin/main
M  staged-file.ts
 M modified-file.ts
MM both-modified.ts`;

      const result = parseGitStatus(output);

      expect(result.staged).toBe(2); // M  and MM (first character)
      expect(result.modified).toBe(2); // _M and MM (second character)
    });

    it('should count conflicted files', () => {
      const output = `## main...origin/main
UU conflict1.ts
AU conflict2.ts`;

      const result = parseGitStatus(output);

      expect(result.conflicted).toBe(2);
    });

    it('should handle branch without tracking', () => {
      const output = '## feature-branch';

      const result = parseGitStatus(output);

      expect(result.branch).toBe('feature-branch');
      expect(result.tracking).toBeUndefined();
    });
  });

  describe('getDiskUsageMB', () => {
    it('should return disk usage in MB', () => {
      mockExecSync.mockReturnValue('1234\t/path/to/worktree');

      const result = getDiskUsageMB('/path/to/worktree');

      expect(result).toBe(1234);
      expect(mockExecSync).toHaveBeenCalledWith(
        'du -sm "/path/to/worktree"',
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should return undefined on error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('du failed');
      });

      const result = getDiskUsageMB('/path/to/worktree');

      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid output', () => {
      mockExecSync.mockReturnValue('invalid output');

      const result = getDiskUsageMB('/path/to/worktree');

      expect(result).toBeUndefined();
    });
  });

  describe('checkFilesystemExists', () => {
    it('should return true if path exists', () => {
      mockExistsSync.mockReturnValue(true);

      const result = checkFilesystemExists('/path/to/worktree');

      expect(result).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/path/to/worktree');
    });

    it('should return false if path does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = checkFilesystemExists('/path/to/worktree');

      expect(result).toBe(false);
    });

    it('should return false on error', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = checkFilesystemExists('/path/to/worktree');

      expect(result).toBe(false);
    });
  });

  describe('validateWorktreePath', () => {
    it('should accept valid worktree path', () => {
      expect(() => {
        validateWorktreePath('/opt/stack/worktrees/st-1-test-story');
      }).not.toThrow();
    });

    it('should reject main repository path', () => {
      expect(() => {
        validateWorktreePath('/opt/stack/AIStudio');
      }).toThrow('Cannot delete main repository worktree');
    });

    it('should reject path outside worktrees directory', () => {
      expect(() => {
        validateWorktreePath('/tmp/malicious-path');
      }).toThrow('Must be within /opt/stack/worktrees/');
    });

    it('should reject path traversal attempts', () => {
      expect(() => {
        validateWorktreePath('/opt/stack/worktrees/../../../etc/passwd');
      }).toThrow('Path traversal detected');
    });
  });

  describe('validateBranchName', () => {
    it('should accept valid branch names', () => {
      expect(() => validateBranchName('st-1-test-story')).not.toThrow();
      expect(() => validateBranchName('feature/user-auth')).not.toThrow();
      expect(() => validateBranchName('bugfix_123')).not.toThrow();
    });

    it('should reject branch names with shell metacharacters', () => {
      expect(() => validateBranchName('branch; rm -rf /')).toThrow('Invalid branch name');
      expect(() => validateBranchName('branch$(whoami)')).toThrow('Invalid branch name');
      expect(() => validateBranchName('branch|ls')).toThrow('Invalid branch name');
    });

    it('should reject branch names with special characters', () => {
      expect(() => validateBranchName('branch name')).toThrow('Invalid branch name');
      expect(() => validateBranchName('branch@name')).toThrow('Invalid branch name');
    });
  });

  // =============================================================================
  // ST-153: Location-Aware Git Execution Tests
  // =============================================================================

  describe('setRemoteExecutionService', () => {
    it('should set the remote execution service reference', () => {
      // This is a side-effect function, verify it doesn't throw
      expect(() => setRemoteExecutionService(mockRemoteExecutionService)).not.toThrow();
    });
  });

  describe('execGitLocationAware', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Set up the remote execution service
      setRemoteExecutionService(mockRemoteExecutionService);
    });

    describe('local execution (KVM)', () => {
      it('should execute locally when target is kvm', async () => {
        mockExecSync.mockReturnValue('success output');
        mockPrisma.worktree.findFirst.mockResolvedValue(null);

        const result = await execGitLocationAware('git status', '/opt/stack/worktrees/test', {
          target: 'kvm',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(true);
        expect(result.output).toBe('success output');
        expect(result.executedOn).toBe('kvm');
        expect(mockRemoteExecutionService.executeGitCommand).not.toHaveBeenCalled();
      });

      it('should execute locally when auto-detect finds KVM worktree', async () => {
        mockExecSync.mockReturnValue('status output');
        mockPrisma.worktree.findFirst.mockResolvedValue({
          id: 'worktree-1',
          hostType: 'kvm',
          worktreePath: '/opt/stack/worktrees/st-1-test',
        });

        const result = await execGitLocationAware('git status', '/opt/stack/worktrees/st-1-test', {
          target: 'auto',
          storyId: 'story-1',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(true);
        expect(result.executedOn).toBe('kvm');
      });

      it('should default to KVM when no worktree found and path is /opt/stack', async () => {
        mockExecSync.mockReturnValue('git log output');
        mockPrisma.worktree.findFirst.mockResolvedValue(null);

        const result = await execGitLocationAware('git log', '/opt/stack/AIStudio', {
          target: 'auto',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(true);
        expect(result.executedOn).toBe('kvm');
      });

      it('should handle local git command failure', async () => {
        mockExecSync.mockImplementation(() => {
          throw new Error('Git command failed: fatal: not a git repository');
        });
        mockPrisma.worktree.findFirst.mockResolvedValue(null);

        const result = await execGitLocationAware('git status', '/opt/stack/worktrees/test', {
          target: 'kvm',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not a git repository');
        expect(result.executedOn).toBe('kvm');
      });
    });

    describe('remote execution (laptop)', () => {
      it('should execute remotely when target is laptop', async () => {
        mockRemoteExecutionService.executeGitCommand.mockResolvedValue({
          success: true,
          output: 'remote git output',
        });

        const result = await execGitLocationAware('git status', '/Users/dev/projects/test', {
          target: 'laptop',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(true);
        expect(result.output).toBe('remote git output');
        expect(result.executedOn).toBe('laptop');
        expect(mockRemoteExecutionService.executeGitCommand).toHaveBeenCalledWith({
          command: 'git status',
          cwd: '/Users/dev/projects/test',
          timeout: undefined,
        });
      });

      it('should execute remotely when auto-detect finds local worktree', async () => {
        mockPrisma.worktree.findFirst.mockResolvedValue({
          id: 'worktree-2',
          hostType: 'local',
          worktreePath: '/Users/dev/projects/test',
        });
        mockRemoteExecutionService.executeGitCommand.mockResolvedValue({
          success: true,
          output: 'laptop git output',
        });

        const result = await execGitLocationAware('git status', '/Users/dev/projects/test', {
          target: 'auto',
          worktreeId: 'worktree-2',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(true);
        expect(result.executedOn).toBe('laptop');
      });

      it('should handle laptop agent offline', async () => {
        mockRemoteExecutionService.executeGitCommand.mockResolvedValue({
          agentOffline: true,
          error: 'Laptop agent is offline',
        });

        const result = await execGitLocationAware('git status', '/Users/dev/projects/test', {
          target: 'laptop',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('offline');
        expect(result.executedOn).toBe('laptop');
      });

      it('should handle remote execution failure', async () => {
        mockRemoteExecutionService.executeGitCommand.mockResolvedValue({
          success: false,
          error: 'Command execution failed',
        });

        const result = await execGitLocationAware('git push', '/Users/dev/projects/test', {
          target: 'laptop',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Command execution failed');
        expect(result.executedOn).toBe('laptop');
      });

      it('should handle remote execution exception', async () => {
        mockRemoteExecutionService.executeGitCommand.mockRejectedValue(
          new Error('Network connection failed')
        );

        const result = await execGitLocationAware('git fetch', '/Users/dev/projects/test', {
          target: 'laptop',
          prisma: mockPrisma,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Network connection failed');
        expect(result.executedOn).toBe('laptop');
      });

      it('should pass timeout to remote execution', async () => {
        mockRemoteExecutionService.executeGitCommand.mockResolvedValue({
          success: true,
          output: 'success',
        });

        await execGitLocationAware('git fetch origin', '/Users/dev/projects/test', {
          target: 'laptop',
          timeout: 30000,
          prisma: mockPrisma,
        });

        expect(mockRemoteExecutionService.executeGitCommand).toHaveBeenCalledWith({
          command: 'git fetch origin',
          cwd: '/Users/dev/projects/test',
          timeout: 30000,
        });
      });
    });

    describe('error handling', () => {
      it('should fall back to HTTP and return error when remote service not configured', async () => {
        // Clear the remote service - triggers HTTP fallback (ST-158)
        setRemoteExecutionService(null);

        // Mock global.fetch to simulate HTTP failure
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

        const result = await execGitLocationAware('git status', '/Users/dev/projects/test', {
          target: 'laptop',
          prisma: mockPrisma,
        });

        // Should return error result from HTTP fallback, not throw
        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to execute git via HTTP');
        expect(result.executedOn).toBe('laptop');

        // Restore
        global.fetch = originalFetch;
        setRemoteExecutionService(mockRemoteExecutionService);
      });
    });
  });

  describe('isLaptopAgentOnline', () => {
    it('should return true when online agent with git capability exists', async () => {
      mockPrisma.remoteAgent.findFirst.mockResolvedValue({
        id: 'agent-1',
        hostname: 'pawels-macbook',
        status: 'online',
        capabilities: ['git-execute', 'parse-transcript'],
      });

      const result = await isLaptopAgentOnline(mockPrisma);

      expect(result).toBe(true);
      expect(mockPrisma.remoteAgent.findFirst).toHaveBeenCalledWith({
        where: {
          status: 'online',
          capabilities: {
            has: 'git-execute',
          },
        },
      });
    });

    it('should return false when no online agent exists', async () => {
      mockPrisma.remoteAgent.findFirst.mockResolvedValue(null);

      const result = await isLaptopAgentOnline(mockPrisma);

      expect(result).toBe(false);
    });
  });
});
