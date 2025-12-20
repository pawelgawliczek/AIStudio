/**
 * ST-363: ArtifactMover Tests
 *
 * Tests the ArtifactMover service that handles moving story directories
 * when stories are assigned to epics or moved to unassigned.
 *
 * Test Categories:
 * - Unit: Path validation and security checks
 * - Integration: Actual directory moving operations
 * - Edge Cases: Error handling, concurrent moves, edge cases
 * - Security: Directory traversal prevention, malicious inputs
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArtifactMover } from '../artifact-mover';

describe('ArtifactMover', () => {
  let mover: ArtifactMover;
  let testProjectPath: string;
  let docsDir: string;

  beforeEach(() => {
    // Create temp directory structure
    testProjectPath = path.join(os.tmpdir(), `test-artifact-mover-${Date.now()}`);
    docsDir = path.join(testProjectPath, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    // Create mover instance
    mover = new ArtifactMover(testProjectPath);
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('Validation', () => {
    describe('Story Key Validation', () => {
      it('should reject invalid story key format - missing number', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-',
          newPath: 'docs/EP-1/ST-',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid story key format');
      });

      it('should reject invalid story key format - letters instead of numbers', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-ABC',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-ABC',
          newPath: 'docs/EP-1/ST-ABC',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid story key format');
      });

      it('should reject invalid story key format - missing prefix', async () => {
        const result = await mover.moveArtifacts({
          storyKey: '123',
          epicKey: 'EP-1',
          oldPath: 'docs/123',
          newPath: 'docs/EP-1/123',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid story key format');
      });

      it('should accept valid story key formats', async () => {
        const validKeys = ['ST-1', 'ST-99', 'ST-123', 'ST-9999'];

        for (const storyKey of validKeys) {
          const storyDir = path.join(docsDir, storyKey);
          fs.mkdirSync(storyDir, { recursive: true });
          fs.writeFileSync(path.join(storyDir, 'test.md'), 'content');

          const result = await mover.moveArtifacts({
            storyKey,
            epicKey: 'EP-1',
            oldPath: `docs/${storyKey}`,
            newPath: `docs/EP-1/${storyKey}`,
          });

          // Should pass validation (may fail on filesystem if already moved)
          if (!result.success && result.error) {
            expect(result.error).not.toContain('Invalid story key format');
          }
        }
      });
    });

    describe('Epic Key Validation', () => {
      it('should reject invalid epic key format - missing number', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-',
          oldPath: 'docs/ST-123',
          newPath: 'docs/EP-/ST-123',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid epic key format');
      });

      it('should reject invalid epic key format - letters instead of numbers', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-XYZ',
          oldPath: 'docs/ST-123',
          newPath: 'docs/EP-XYZ/ST-123',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid epic key format');
      });

      it('should accept null epic key for unassigned move', async () => {
        const storyDir = path.join(docsDir, 'ST-123');
        fs.mkdirSync(storyDir, { recursive: true });
        fs.writeFileSync(path.join(storyDir, 'test.md'), 'content');

        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: null,
          oldPath: 'docs/ST-123',
          newPath: 'docs/unassigned/ST-123',
        });

        // Should pass validation (may fail on filesystem)
        if (!result.success && result.error) {
          expect(result.error).not.toContain('Invalid epic key format');
        }
      });

      it('should accept valid epic key formats', async () => {
        const validKeys = ['EP-1', 'EP-99', 'EP-123', 'EP-9999'];

        for (const epicKey of validKeys) {
          const storyKey = `ST-${Math.floor(Math.random() * 1000)}`;
          const storyDir = path.join(docsDir, storyKey);
          fs.mkdirSync(storyDir, { recursive: true });
          fs.writeFileSync(path.join(storyDir, 'test.md'), 'content');

          const result = await mover.moveArtifacts({
            storyKey,
            epicKey,
            oldPath: `docs/${storyKey}`,
            newPath: `docs/${epicKey}/${storyKey}`,
          });

          // Should pass validation
          if (!result.success && result.error) {
            expect(result.error).not.toContain('Invalid epic key format');
          }
        }
      });
    });

    describe('Path Pattern Validation', () => {
      it('should reject old path with invalid directory structure', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/foo/bar/ST-123', // Invalid structure
          newPath: 'docs/EP-1/ST-123',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Old path must be story directory');
      });

      it('should reject old path with wrong directory prefix', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'stories/ST-123', // Wrong prefix
          newPath: 'docs/EP-1/ST-123',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Old path must be story directory');
      });

      it('should reject old path that does not match story key', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-456', // Wrong story key
          newPath: 'docs/EP-1/ST-123',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Old path does not match story key');
      });

      it('should reject new path that is not an epic directory when epic is provided', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-123',
          newPath: 'docs/ST-123', // Not in epic format
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('New path must be epic directory');
      });

      it('should reject new path that is not unassigned directory when epic is null', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: null,
          oldPath: 'docs/ST-123',
          newPath: 'docs/ST-123', // Should be docs/unassigned/ST-123
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('New path must be unassigned directory');
      });

      it('should reject new path that does not contain the epic key', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-123',
          newPath: 'docs/EP-2/ST-123', // Wrong epic key
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('New path does not contain epic key');
      });

      it('should reject new path that does not match story key', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-123',
          newPath: 'docs/EP-1/ST-456', // Wrong story key
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('New path does not match story key');
      });
    });

    describe('Security - Directory Traversal', () => {
      it('should reject old path with directory traversal', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/../../../etc/ST-123',
          newPath: 'docs/EP-1/ST-123',
        });

        expect(result.success).toBe(false);
        // May fail on path pattern check before traversal check
        expect(result.error).toBeDefined();
      });

      it('should reject new path with directory traversal', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-123',
          newPath: 'docs/EP-1/../../etc/ST-123',
        });

        expect(result.success).toBe(false);
        // May fail on path pattern check before traversal check
        expect(result.error).toBeDefined();
      });

      it('should detect directory traversal in paths', async () => {
        // Paths with .. are rejected by either pattern or traversal check
        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-123',
          newPath: 'docs/EP-1/../ST-123',
        });

        expect(result.success).toBe(false);
        // May be caught by pattern validation or traversal check
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Directory Moving', () => {
    describe('Move to Epic', () => {
      it('should move story directory from docs/ST-XXX to docs/EP-YYY/ST-XXX', async () => {
        const storyDir = path.join(docsDir, 'ST-123');
        fs.mkdirSync(storyDir, { recursive: true });
        fs.writeFileSync(path.join(storyDir, 'THE_PLAN.md'), '# Plan content');
        fs.writeFileSync(path.join(storyDir, 'notes.txt'), 'Notes');

        const result = await mover.moveArtifacts({
          storyKey: 'ST-123',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-123',
          newPath: 'docs/EP-1/ST-123',
        });

        expect(result.success).toBe(true);
        expect(result.newPath).toBe('docs/EP-1/ST-123');

        // Verify old directory is gone
        expect(fs.existsSync(storyDir)).toBe(false);

        // Verify new directory exists with files
        const newDir = path.join(testProjectPath, 'docs/EP-1/ST-123');
        expect(fs.existsSync(newDir)).toBe(true);
        expect(fs.existsSync(path.join(newDir, 'THE_PLAN.md'))).toBe(true);
        expect(fs.existsSync(path.join(newDir, 'notes.txt'))).toBe(true);

        // Verify file contents preserved
        const planContent = fs.readFileSync(path.join(newDir, 'THE_PLAN.md'), 'utf-8');
        expect(planContent).toBe('# Plan content');
      });

      it('should create parent epic directory if it does not exist', async () => {
        const storyDir = path.join(docsDir, 'ST-456');
        fs.mkdirSync(storyDir, { recursive: true });
        fs.writeFileSync(path.join(storyDir, 'test.md'), 'test');

        const result = await mover.moveArtifacts({
          storyKey: 'ST-456',
          epicKey: 'EP-99',
          oldPath: 'docs/ST-456',
          newPath: 'docs/EP-99/ST-456',
        });

        expect(result.success).toBe(true);

        // Verify epic directory was created
        const epicDir = path.join(docsDir, 'EP-99');
        expect(fs.existsSync(epicDir)).toBe(true);
        expect(fs.statSync(epicDir).isDirectory()).toBe(true);
      });

      it('should preserve directory structure and nested files', async () => {
        const storyDir = path.join(docsDir, 'ST-789');
        const subDir = path.join(storyDir, 'images');
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(storyDir, 'README.md'), 'readme');
        fs.writeFileSync(path.join(subDir, 'diagram.txt'), 'diagram');

        const result = await mover.moveArtifacts({
          storyKey: 'ST-789',
          epicKey: 'EP-2',
          oldPath: 'docs/ST-789',
          newPath: 'docs/EP-2/ST-789',
        });

        expect(result.success).toBe(true);

        const newStoryDir = path.join(testProjectPath, 'docs/EP-2/ST-789');
        const newSubDir = path.join(newStoryDir, 'images');
        expect(fs.existsSync(newSubDir)).toBe(true);
        expect(fs.existsSync(path.join(newStoryDir, 'README.md'))).toBe(true);
        expect(fs.existsSync(path.join(newSubDir, 'diagram.txt'))).toBe(true);
      });
    });

    describe('Move to Unassigned', () => {
      it('should move story directory from docs/ST-XXX to docs/unassigned/ST-XXX', async () => {
        const storyDir = path.join(docsDir, 'ST-111');
        fs.mkdirSync(storyDir, { recursive: true });
        fs.writeFileSync(path.join(storyDir, 'plan.md'), 'content');

        const result = await mover.moveArtifacts({
          storyKey: 'ST-111',
          epicKey: null,
          oldPath: 'docs/ST-111',
          newPath: 'docs/unassigned/ST-111',
        });

        expect(result.success).toBe(true);
        expect(result.newPath).toBe('docs/unassigned/ST-111');

        // Verify old directory is gone
        expect(fs.existsSync(storyDir)).toBe(false);

        // Verify new directory exists
        const newDir = path.join(testProjectPath, 'docs/unassigned/ST-111');
        expect(fs.existsSync(newDir)).toBe(true);
        expect(fs.existsSync(path.join(newDir, 'plan.md'))).toBe(true);
      });

      it('should create unassigned directory if it does not exist', async () => {
        const storyDir = path.join(docsDir, 'ST-222');
        fs.mkdirSync(storyDir, { recursive: true });
        fs.writeFileSync(path.join(storyDir, 'test.md'), 'test');

        const result = await mover.moveArtifacts({
          storyKey: 'ST-222',
          epicKey: null,
          oldPath: 'docs/ST-222',
          newPath: 'docs/unassigned/ST-222',
        });

        expect(result.success).toBe(true);

        // Verify unassigned directory was created
        const unassignedDir = path.join(docsDir, 'unassigned');
        expect(fs.existsSync(unassignedDir)).toBe(true);
        expect(fs.statSync(unassignedDir).isDirectory()).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should return error if source directory does not exist', async () => {
        const result = await mover.moveArtifacts({
          storyKey: 'ST-999',
          epicKey: 'EP-1',
          oldPath: 'docs/ST-999',
          newPath: 'docs/EP-1/ST-999',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Source directory does not exist');
      });

      it('should return error if target directory already exists', async () => {
        const storyDir = path.join(docsDir, 'ST-333');
        const epicDir = path.join(docsDir, 'EP-3');
        const targetDir = path.join(epicDir, 'ST-333');

        fs.mkdirSync(storyDir, { recursive: true });
        fs.mkdirSync(targetDir, { recursive: true });

        const result = await mover.moveArtifacts({
          storyKey: 'ST-333',
          epicKey: 'EP-3',
          oldPath: 'docs/ST-333',
          newPath: 'docs/EP-3/ST-333',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Target directory already exists');
      });

      it('should handle filesystem errors gracefully', async () => {
        const storyDir = path.join(docsDir, 'ST-444');
        fs.mkdirSync(storyDir, { recursive: true });

        // Make directory read-only on Unix systems
        if (process.platform !== 'win32') {
          fs.chmodSync(docsDir, 0o444);

          const result = await mover.moveArtifacts({
            storyKey: 'ST-444',
            epicKey: 'EP-4',
            oldPath: 'docs/ST-444',
            newPath: 'docs/EP-4/ST-444',
          });

          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();

          // Restore permissions for cleanup
          fs.chmodSync(docsDir, 0o755);
        }
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty story directory', async () => {
        const storyDir = path.join(docsDir, 'ST-555');
        fs.mkdirSync(storyDir, { recursive: true });

        const result = await mover.moveArtifacts({
          storyKey: 'ST-555',
          epicKey: 'EP-5',
          oldPath: 'docs/ST-555',
          newPath: 'docs/EP-5/ST-555',
        });

        expect(result.success).toBe(true);

        const newDir = path.join(testProjectPath, 'docs/EP-5/ST-555');
        expect(fs.existsSync(newDir)).toBe(true);
        expect(fs.readdirSync(newDir).length).toBe(0);
      });

      it('should handle story with many files', async () => {
        const storyDir = path.join(docsDir, 'ST-666');
        fs.mkdirSync(storyDir, { recursive: true });

        // Create 100 files
        for (let i = 0; i < 100; i++) {
          fs.writeFileSync(path.join(storyDir, `file-${i}.md`), `content ${i}`);
        }

        const result = await mover.moveArtifacts({
          storyKey: 'ST-666',
          epicKey: 'EP-6',
          oldPath: 'docs/ST-666',
          newPath: 'docs/EP-6/ST-666',
        });

        expect(result.success).toBe(true);

        const newDir = path.join(testProjectPath, 'docs/EP-6/ST-666');
        const files = fs.readdirSync(newDir);
        expect(files.length).toBe(100);
      });

      it('should handle deep nested directory structures', async () => {
        const storyDir = path.join(docsDir, 'ST-777');
        const deepDir = path.join(storyDir, 'a/b/c/d/e');
        fs.mkdirSync(deepDir, { recursive: true });
        fs.writeFileSync(path.join(deepDir, 'deep.md'), 'deep content');

        const result = await mover.moveArtifacts({
          storyKey: 'ST-777',
          epicKey: 'EP-7',
          oldPath: 'docs/ST-777',
          newPath: 'docs/EP-7/ST-777',
        });

        expect(result.success).toBe(true);

        const newDeepFile = path.join(testProjectPath, 'docs/EP-7/ST-777/a/b/c/d/e/deep.md');
        expect(fs.existsSync(newDeepFile)).toBe(true);
        expect(fs.readFileSync(newDeepFile, 'utf-8')).toBe('deep content');
      });

      it('should handle Unicode file names and content', async () => {
        const storyDir = path.join(docsDir, 'ST-888');
        fs.mkdirSync(storyDir, { recursive: true });
        const unicodeContent = 'Hello 世界 🌍 Привет مرحبا';
        fs.writeFileSync(path.join(storyDir, '文档.md'), unicodeContent, 'utf-8');

        const result = await mover.moveArtifacts({
          storyKey: 'ST-888',
          epicKey: 'EP-8',
          oldPath: 'docs/ST-888',
          newPath: 'docs/EP-8/ST-888',
        });

        expect(result.success).toBe(true);

        const newFile = path.join(testProjectPath, 'docs/EP-8/ST-888/文档.md');
        expect(fs.existsSync(newFile)).toBe(true);
        const content = fs.readFileSync(newFile, 'utf-8');
        expect(content).toBe(unicodeContent);
      });
    });
  });
});
