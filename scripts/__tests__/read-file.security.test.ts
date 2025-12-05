/**
 * Security Tests for read-file.ts Script (ST-173 Phase 1)
 *
 * TDD Implementation - These tests WILL FAIL until read-file.ts is implemented
 *
 * Security Requirements from SECURITY_REVIEW:
 * - CRITICAL: Path traversal protection (8+ attack vectors)
 * - CRITICAL: File ownership validation
 * - HIGH: Size limit enforcement (2MB max)
 * - HIGH: Symlink blocking
 * - MEDIUM: Device file blocking
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Module under test (will fail until implemented)
let readFile: (args: string[]) => Promise<{ content: string; size: number; path: string }>;

describe('read-file.ts - Security Tests (TDD)', () => {
  const ALLOWED_BASE_DIR = path.resolve(os.homedir(), '.claude', 'projects');
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test Case 1: Path Traversal Attack Prevention (CRITICAL)', () => {
    const pathTraversalAttacks = [
      '~/.claude/projects/../../etc/passwd',
      '~/.claude/projects/../.ssh/id_rsa',
      '~/.claude/projects/transcript.jsonl/../../../secret',
      '~/.claude/projects/../../../root/.bashrc',
      '~/.claude/projects/./../../../tmp/malicious',
      `${ALLOWED_BASE_DIR}/../../../etc/shadow`,
      `${ALLOWED_BASE_DIR}/../../.aws/credentials`,
      `${ALLOWED_BASE_DIR}/../.env`,
    ];

    pathTraversalAttacks.forEach((attackPath, index) => {
      it(`should reject path traversal attack #${index + 1}: ${attackPath}`, async () => {
        // Mock fs.realpathSync to resolve to dangerous path
        mockFs.realpathSync.mockReturnValue('/etc/passwd');

        await expect(
          readFile([`--path=${attackPath}`])
        ).rejects.toThrow(/Path outside allowed directory/i);

        // Should never read the file
        expect(mockFs.readFileSync).not.toHaveBeenCalled();
      });
    });

    it('should accept valid path within allowed directory', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'AIStudio', 'transcript.jsonl');

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);
      mockFs.readFileSync.mockReturnValue('{"type":"text","content":"test"}');

      const result = await readFile([`--path=${validPath}`]);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('size');
      expect(mockFs.realpathSync).toHaveBeenCalledWith(expect.stringContaining('transcript.jsonl'));
    });

    it('should validate path AFTER normalization', async () => {
      const trickyPath = path.join(ALLOWED_BASE_DIR, 'AIStudio', '..', '..', '..', 'etc', 'passwd');

      // Real path resolves to dangerous location
      mockFs.realpathSync.mockReturnValue('/etc/passwd');

      await expect(
        readFile([`--path=${trickyPath}`])
      ).rejects.toThrow(/Path outside allowed directory/i);

      // Must use realpathSync BEFORE validation
      expect(mockFs.realpathSync).toHaveBeenCalled();
    });
  });

  describe('Test Case 2: File Ownership Validation (CRITICAL)', () => {
    it('should reject file not owned by current user', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'transcript.jsonl');

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024,
        uid: 0, // Root-owned file
      } as fs.Stats);

      const currentUid = process.getuid?.() ?? 1000;

      await expect(
        readFile([`--path=${validPath}`])
      ).rejects.toThrow(/File not owned by current user/i);

      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should accept file owned by current user', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'transcript.jsonl');
      const currentUid = process.getuid?.() ?? 1000;

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024,
        uid: currentUid,
      } as fs.Stats);
      mockFs.readFileSync.mockReturnValue('{"type":"text"}');

      const result = await readFile([`--path=${validPath}`]);

      expect(result).toHaveProperty('content');
    });
  });

  describe('Test Case 4: DoS via Large File (HIGH)', () => {
    it('should reject files larger than 2MB', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'large-transcript.jsonl');

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 3 * 1024 * 1024, // 3MB - exceeds limit
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);

      await expect(
        readFile([`--path=${validPath}`])
      ).rejects.toThrow(/File too large/i);

      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should accept files exactly at 2MB limit', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'max-size.jsonl');

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: MAX_FILE_SIZE,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);
      mockFs.readFileSync.mockReturnValue('x'.repeat(MAX_FILE_SIZE));

      const result = await readFile([`--path=${validPath}`]);

      expect(result.size).toBe(MAX_FILE_SIZE);
    });

    it('should check size BEFORE reading file', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'huge.jsonl');

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 100 * 1024 * 1024, // 100MB
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);

      await expect(
        readFile([`--path=${validPath}`])
      ).rejects.toThrow(/File too large/i);

      // Must check size via statSync before readFileSync
      expect(mockFs.statSync).toHaveBeenCalled();
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Symlink Blocking (HIGH)', () => {
    it('should reject symlinks pointing outside allowed directory', async () => {
      const symlinkPath = path.join(ALLOWED_BASE_DIR, 'symlink.jsonl');

      // Symlink resolves to dangerous location
      mockFs.realpathSync.mockReturnValue('/etc/passwd');

      await expect(
        readFile([`--path=${symlinkPath}`])
      ).rejects.toThrow(/Path outside allowed directory/i);
    });

    it('should accept symlinks within allowed directory', async () => {
      const symlinkPath = path.join(ALLOWED_BASE_DIR, 'link.jsonl');
      const targetPath = path.join(ALLOWED_BASE_DIR, 'target.jsonl');

      mockFs.realpathSync.mockReturnValue(targetPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);
      mockFs.readFileSync.mockReturnValue('{"type":"text"}');

      const result = await readFile([`--path=${symlinkPath}`]);

      expect(result).toHaveProperty('content');
    });
  });

  describe('Device File Blocking (MEDIUM)', () => {
    it('should reject device files', async () => {
      const devicePath = path.join(ALLOWED_BASE_DIR, 'device');

      mockFs.realpathSync.mockReturnValue(devicePath);
      mockFs.statSync.mockReturnValue({
        isFile: () => false,
        isDirectory: () => false,
        isBlockDevice: () => true,
        size: 0,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);

      await expect(
        readFile([`--path=${devicePath}`])
      ).rejects.toThrow(/Path is not a regular file/i);
    });

    it('should reject pipes', async () => {
      const pipePath = path.join(ALLOWED_BASE_DIR, 'pipe');

      mockFs.realpathSync.mockReturnValue(pipePath);
      mockFs.statSync.mockReturnValue({
        isFile: () => false,
        isFIFO: () => true,
        size: 0,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);

      await expect(
        readFile([`--path=${pipePath}`])
      ).rejects.toThrow(/Path is not a regular file/i);
    });

    it('should reject sockets', async () => {
      const socketPath = path.join(ALLOWED_BASE_DIR, 'socket');

      mockFs.realpathSync.mockReturnValue(socketPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => false,
        isSocket: () => true,
        size: 0,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);

      await expect(
        readFile([`--path=${socketPath}`])
      ).rejects.toThrow(/Path is not a regular file/i);
    });
  });

  describe('Parameter Validation', () => {
    it('should require --path parameter', async () => {
      await expect(
        readFile([])
      ).rejects.toThrow(/--path parameter is required/i);
    });

    it('should accept custom encoding parameter', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'transcript.jsonl');

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);
      mockFs.readFileSync.mockReturnValue('{"type":"text"}');

      await readFile([`--path=${validPath}`, '--encoding=utf-8']);

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        validPath,
        expect.objectContaining({ encoding: 'utf-8' })
      );
    });

    it('should use utf-8 encoding by default', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'transcript.jsonl');

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);
      mockFs.readFileSync.mockReturnValue('{"type":"text"}');

      await readFile([`--path=${validPath}`]);

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        validPath,
        expect.objectContaining({ encoding: 'utf-8' })
      );
    });
  });

  describe('Error Message Sanitization (MEDIUM)', () => {
    it('should not leak absolute paths in error messages', async () => {
      const attackPath = '/etc/passwd';

      mockFs.realpathSync.mockReturnValue(attackPath);

      try {
        await readFile([`--path=${attackPath}`]);
        fail('Should have thrown error');
      } catch (error: any) {
        // Error message should not contain full absolute path
        expect(error.message).not.toContain('/etc/passwd');
        expect(error.message).toMatch(/Path outside allowed directory/i);
      }
    });

    it('should not leak username in error messages', async () => {
      const userPath = path.join('/Users/secretuser/projects/transcript.jsonl');

      mockFs.realpathSync.mockReturnValue(userPath);

      try {
        await readFile([`--path=${userPath}`]);
        fail('Should have thrown error');
      } catch (error: any) {
        // Should not expose username
        expect(error.message).not.toContain('secretuser');
      }
    });
  });

  describe('Return Value Format', () => {
    it('should return content, size, and path', async () => {
      const validPath = path.join(ALLOWED_BASE_DIR, 'transcript.jsonl');
      const content = '{"type":"text","content":"test"}';

      mockFs.realpathSync.mockReturnValue(validPath);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: content.length,
        uid: process.getuid?.() ?? 1000,
      } as fs.Stats);
      mockFs.readFileSync.mockReturnValue(content);

      const result = await readFile([`--path=${validPath}`]);

      expect(result).toEqual({
        content,
        size: content.length,
        path: validPath,
      });
    });
  });
});
