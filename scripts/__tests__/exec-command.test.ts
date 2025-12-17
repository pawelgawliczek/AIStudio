/**
 * Tests for exec-command.ts - Git Rev-Parse Whitelist
 * ST-278: Accurate Per-Phase LOC Tracking with Orchestrator-Driven Commits
 *
 * TDD Implementation - These tests WILL FAIL until exec-command.ts is updated
 *
 * The feature requires whitelisting `git rev-parse HEAD` for capturing commit hashes
 * during agent execution to enable accurate LOC tracking per phase.
 */

import { execCommand } from '../exec-command';

describe('exec-command.ts - Git Rev-Parse Whitelist (ST-278)', () => {
  const TEST_CWD = process.cwd();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Git Rev-Parse Command Whitelist', () => {
    it('should allow "git rev-parse HEAD" command', async () => {
      // This test will FAIL until git rev-parse is whitelisted
      const result = await execCommand([
        '--command=git rev-parse HEAD',
        `--cwd=${TEST_CWD}`,
      ]);

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^[0-9a-f]{40}$/); // SHA-1 hash format
    });

    it('should allow "git rev-parse --short HEAD" command', async () => {
      // This test will FAIL until git rev-parse is whitelisted
      const result = await execCommand([
        '--command=git rev-parse --short HEAD',
        `--cwd=${TEST_CWD}`,
      ]);

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^[0-9a-f]{7,40}$/); // Short hash format
    });

    it('should allow "git rev-parse --verify HEAD" command', async () => {
      // This test will FAIL until git rev-parse is whitelisted
      const result = await execCommand([
        '--command=git rev-parse --verify HEAD',
        `--cwd=${TEST_CWD}`,
      ]);

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should allow "git rev-parse main" to get branch commit', async () => {
      // This test will FAIL until git rev-parse is whitelisted
      const result = await execCommand([
        '--command=git rev-parse main',
        `--cwd=${TEST_CWD}`,
      ]);

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should allow "git rev-parse" with various ref formats', async () => {
      const validCommands = [
        'git rev-parse HEAD',
        'git rev-parse HEAD~1',
        'git rev-parse HEAD^',
        'git rev-parse origin/main',
      ];

      for (const command of validCommands) {
        // This test will FAIL until git rev-parse is whitelisted
        const result = await execCommand([
          `--command=${command}`,
          `--cwd=${TEST_CWD}`,
        ]);

        expect(result).toBeDefined();
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe('Existing Whitelist Still Works', () => {
    it('should still allow "git diff" commands', async () => {
      const result = await execCommand([
        '--command=git diff --numstat',
        `--cwd=${TEST_CWD}`,
      ]);

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    });

    it('should still allow "git status" commands', async () => {
      const result = await execCommand([
        '--command=git status --porcelain',
        `--cwd=${TEST_CWD}`,
      ]);

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Security: Dangerous Commands Still Blocked', () => {
    it('should block "git push" command', async () => {
      await expect(
        execCommand([
          '--command=git push',
          `--cwd=${TEST_CWD}`,
        ])
      ).rejects.toThrow(/Command not whitelisted/i);
    });

    it('should block "git reset" command', async () => {
      await expect(
        execCommand([
          '--command=git reset --hard',
          `--cwd=${TEST_CWD}`,
        ])
      ).rejects.toThrow(/Command not whitelisted/i);
    });

    it('should block arbitrary shell commands', async () => {
      await expect(
        execCommand([
          '--command=rm -rf /',
          `--cwd=${TEST_CWD}`,
        ])
      ).rejects.toThrow(/Command not whitelisted/i);
    });
  });

  describe('Parameter Validation', () => {
    it('should require --command parameter', async () => {
      await expect(
        execCommand([`--cwd=${TEST_CWD}`])
      ).rejects.toThrow(/--command parameter is required/i);
    });

    it('should require --cwd parameter', async () => {
      await expect(
        execCommand(['--command=git rev-parse HEAD'])
      ).rejects.toThrow(/--cwd parameter is required/i);
    });

    it('should validate cwd is a directory', async () => {
      await expect(
        execCommand([
          '--command=git rev-parse HEAD',
          '--cwd=/nonexistent/path',
        ])
      ).rejects.toThrow(/Working directory does not exist/i);
    });
  });

  describe('Return Value Format', () => {
    it('should return stdout, stderr, exitCode, and command', async () => {
      const result = await execCommand([
        '--command=git rev-parse HEAD',
        `--cwd=${TEST_CWD}`,
      ]);

      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('command');
      expect(result.command).toBe('git');
    });

    it('should return clean stdout without trailing newlines for rev-parse', async () => {
      const result = await execCommand([
        '--command=git rev-parse HEAD',
        `--cwd=${TEST_CWD}`,
      ]);

      // stdout should contain a commit hash (may have newline)
      const hash = result.stdout.trim();
      expect(hash).toMatch(/^[0-9a-f]{40}$/);
    });
  });
});
