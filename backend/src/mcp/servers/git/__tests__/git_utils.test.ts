/**
 * Tests for git_utils shared utilities
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
} from '../git_utils';

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

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
});
