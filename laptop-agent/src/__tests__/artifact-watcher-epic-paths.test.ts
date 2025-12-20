/**
 * ST-363: ArtifactWatcher Epic Path Support Tests
 *
 * Tests the updated path parsing logic that supports 4 patterns:
 * 1. docs/EP-XXX/*.md (epic-level - detected but skipped)
 * 2. docs/EP-XXX/ST-YYY/*.md (story in epic)
 * 3. docs/unassigned/ST-YYY/*.md (unassigned stories)
 * 4. docs/ST-YYY/*.md (legacy direct story path)
 *
 * Test Categories:
 * - Unit: Path parsing for all 4 patterns
 * - Integration: File watching with epic paths
 * - Edge Cases: Invalid patterns, epic-level artifacts
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArtifactWatcher } from '../artifact-watcher';
import { UploadManager } from '../upload-manager';

// Mock UploadManager
jest.mock('../upload-manager');

describe('ArtifactWatcher - Epic Path Support (ST-363)', () => {
  let watcher: ArtifactWatcher;
  let mockUploadManager: jest.Mocked<UploadManager>;
  let testProjectPath: string;
  let docsDir: string;

  beforeEach(() => {
    testProjectPath = path.join(os.tmpdir(), `test-artifact-watcher-epic-${Date.now()}`);
    docsDir = path.join(testProjectPath, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    mockUploadManager = {
      queueUpload: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({ pending: 0, sent: 0, acked: 0, total: 0 }),
      flush: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    } as any;

    watcher = new ArtifactWatcher({
      uploadManager: mockUploadManager,
      projectPath: testProjectPath,
    });
  });

  afterEach(async () => {
    await watcher.stop();
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  describe('Path Parsing - Pattern 1: Epic-Level Artifacts', () => {
    it('should parse epic-level artifact path: docs/EP-XXX/THE_PLAN.md', () => {
      const filePath = 'docs/EP-123/THE_PLAN.md';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed).toEqual({
        epicKey: 'EP-123',
        artifactKey: 'THE_PLAN',
        extension: 'md',
        // Note: storyKey is undefined for epic-level artifacts
      });
    });

    it('should parse epic-level artifacts with different epic numbers', () => {
      const testCases = [
        { path: 'docs/EP-1/plan.md', epicKey: 'EP-1' },
        { path: 'docs/EP-99/config.json', epicKey: 'EP-99' },
        { path: 'docs/EP-456/notes.txt', epicKey: 'EP-456' },
      ];

      for (const tc of testCases) {
        const parsed = (watcher as any).parseArtifactPath(tc.path);
        expect(parsed?.epicKey).toBe(tc.epicKey);
        expect(parsed?.storyKey).toBeUndefined();
      }
    });

    it('should parse epic-level artifacts with various names', () => {
      const testCases = [
        { path: 'docs/EP-1/THE_PLAN.md', artifactKey: 'THE_PLAN' },
        { path: 'docs/EP-1/ARCH_DOC.md', artifactKey: 'ARCH_DOC' },
        { path: 'docs/EP-1/epic-overview.md', artifactKey: 'epic-overview' },
      ];

      for (const tc of testCases) {
        const parsed = (watcher as any).parseArtifactPath(tc.path);
        expect(parsed?.artifactKey).toBe(tc.artifactKey);
      }
    });
  });

  describe('Path Parsing - Pattern 2: Story in Epic', () => {
    it('should parse story-in-epic path: docs/EP-XXX/ST-YYY/ARTIFACT.md', () => {
      const filePath = 'docs/EP-10/ST-123/THE_PLAN.md';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed).toEqual({
        epicKey: 'EP-10',
        storyKey: 'ST-123',
        artifactKey: 'THE_PLAN',
        extension: 'md',
      });
    });

    it('should parse story-in-epic with different combinations', () => {
      const testCases = [
        { path: 'docs/EP-1/ST-1/test.md', epicKey: 'EP-1', storyKey: 'ST-1' },
        { path: 'docs/EP-99/ST-456/plan.json', epicKey: 'EP-99', storyKey: 'ST-456' },
        { path: 'docs/EP-123/ST-999/notes.txt', epicKey: 'EP-123', storyKey: 'ST-999' },
      ];

      for (const tc of testCases) {
        const parsed = (watcher as any).parseArtifactPath(tc.path);
        expect(parsed?.epicKey).toBe(tc.epicKey);
        expect(parsed?.storyKey).toBe(tc.storyKey);
      }
    });

    it('should parse story-in-epic with absolute path', () => {
      const filePath = '/Users/user/projects/AIStudio/docs/EP-50/ST-200/ARCH_DOC.md';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed?.epicKey).toBe('EP-50');
      expect(parsed?.storyKey).toBe('ST-200');
      expect(parsed?.artifactKey).toBe('ARCH_DOC');
    });

    it('should parse story-in-epic with Windows backslashes', () => {
      const filePath = 'C:\\projects\\docs\\EP-3\\ST-45\\test.md';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed?.epicKey).toBe('EP-3');
      expect(parsed?.storyKey).toBe('ST-45');
      expect(parsed?.artifactKey).toBe('test');
    });
  });

  describe('Path Parsing - Pattern 3: Unassigned Stories', () => {
    it('should parse unassigned story path: docs/unassigned/ST-YYY/ARTIFACT.md', () => {
      const filePath = 'docs/unassigned/ST-789/THE_PLAN.md';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed).toEqual({
        storyKey: 'ST-789',
        artifactKey: 'THE_PLAN',
        extension: 'md',
        // epicKey is undefined for unassigned
      });
    });

    it('should parse unassigned stories with different story numbers', () => {
      const testCases = [
        { path: 'docs/unassigned/ST-1/test.md', storyKey: 'ST-1' },
        { path: 'docs/unassigned/ST-100/plan.json', storyKey: 'ST-100' },
        { path: 'docs/unassigned/ST-999/notes.txt', storyKey: 'ST-999' },
      ];

      for (const tc of testCases) {
        const parsed = (watcher as any).parseArtifactPath(tc.path);
        expect(parsed?.storyKey).toBe(tc.storyKey);
        expect(parsed?.epicKey).toBeUndefined();
      }
    });

    it('should parse unassigned with absolute path', () => {
      const filePath = '/Users/user/projects/AIStudio/docs/unassigned/ST-500/test.md';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed?.storyKey).toBe('ST-500');
      expect(parsed?.epicKey).toBeUndefined();
    });
  });

  describe('Path Parsing - Pattern 4: Legacy Direct Story Path', () => {
    it('should parse legacy direct story path: docs/ST-YYY/ARTIFACT.md', () => {
      const filePath = 'docs/ST-325/THE_PLAN.md';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed).toEqual({
        storyKey: 'ST-325',
        artifactKey: 'THE_PLAN',
        extension: 'md',
        // epicKey is undefined for legacy paths
      });
    });

    it('should still support all existing legacy path patterns', () => {
      const testCases = [
        { path: 'docs/ST-1/test.md', expected: 'ST-1' },
        { path: 'docs/ST-99/test.md', expected: 'ST-99' },
        { path: 'docs/ST-325/test.md', expected: 'ST-325' },
        { path: 'docs/ST-1234/test.md', expected: 'ST-1234' },
      ];

      for (const tc of testCases) {
        const parsed = (watcher as any).parseArtifactPath(tc.path);
        expect(parsed?.storyKey).toBe(tc.expected);
        expect(parsed?.epicKey).toBeUndefined();
      }
    });
  });

  describe('Path Parsing - Invalid Patterns', () => {
    it('should return null for paths that do not match any pattern', () => {
      const invalidPaths = [
        'docs/README.md', // No story/epic
        'docs/EP-1', // No file
        'docs/ST-123', // No file
        'src/code.ts', // Wrong directory
        'docs/story-123/test.md', // Wrong format
        'docs/EP-ABC/test.md', // Invalid epic key
        'docs/EP-1/ST-ABC/test.md', // Invalid story key
      ];

      for (const invalidPath of invalidPaths) {
        const parsed = (watcher as any).parseArtifactPath(invalidPath);
        expect(parsed).toBeNull();
      }
    });

    it('should return null for unsupported file extensions', () => {
      const invalidPaths = [
        'docs/ST-123/image.png',
        'docs/EP-1/ST-123/script.js',
        'docs/unassigned/ST-456/data.csv',
      ];

      for (const invalidPath of invalidPaths) {
        const parsed = (watcher as any).parseArtifactPath(invalidPath);
        expect(parsed).toBeNull();
      }
    });

    it('should return null for deeply nested paths beyond expected depth', () => {
      const invalidPaths = [
        'docs/EP-1/ST-123/subdir/file.md', // Too deep
        'docs/unassigned/ST-456/subdir/file.md', // Too deep
      ];

      for (const invalidPath of invalidPaths) {
        const parsed = (watcher as any).parseArtifactPath(invalidPath);
        expect(parsed).toBeNull();
      }
    });
  });

  describe('File Watching - Epic-Level Artifacts', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should detect epic-level artifact but SKIP upload (not yet supported)', async () => {
      const epicDir = path.join(docsDir, 'EP-10');
      fs.mkdirSync(epicDir, { recursive: true });
      fs.writeFileSync(path.join(epicDir, 'THE_PLAN.md'), '# Epic Plan');

      await new Promise(resolve => setTimeout(resolve, 600));

      // Should NOT queue upload because epic-level artifacts are skipped
      expect(mockUploadManager.queueUpload).not.toHaveBeenCalled();
    });

    it('should log detection of epic-level artifacts even if skipped', async () => {
      const epicDir = path.join(docsDir, 'EP-20');
      fs.mkdirSync(epicDir, { recursive: true });
      fs.writeFileSync(path.join(epicDir, 'overview.md'), 'Epic overview');

      await new Promise(resolve => setTimeout(resolve, 600));

      // Verify it was detected and skipped (no upload)
      expect(mockUploadManager.queueUpload).not.toHaveBeenCalled();
    });
  });

  describe('File Watching - Story in Epic', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should detect and upload story artifacts in epic directory', async () => {
      const storyDir = path.join(docsDir, 'EP-5/ST-100');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'THE_PLAN.md'), '# Implementation Plan');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact:upload', {
        storyKey: 'ST-100',
        artifactKey: 'THE_PLAN',
        filePath: expect.stringContaining('THE_PLAN.md'),
        content: '# Implementation Plan',
        contentType: 'text/markdown',
        timestamp: expect.any(Number),
      });
    });

    it('should handle multiple files in epic story directory', async () => {
      const storyDir = path.join(docsDir, 'EP-7/ST-200');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'THE_PLAN.md'), 'Plan');
      fs.writeFileSync(path.join(storyDir, 'ARCH_DOC.md'), 'Architecture');
      fs.writeFileSync(path.join(storyDir, 'config.json'), '{"key": "value"}');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledTimes(3);

      const artifactKeys = mockUploadManager.queueUpload.mock.calls.map(
        (call: any) => call[1].artifactKey
      );
      expect(artifactKeys).toContain('THE_PLAN');
      expect(artifactKeys).toContain('ARCH_DOC');
      expect(artifactKeys).toContain('config');
    });

    it('should detect changes to files in epic story directory', async () => {
      const storyDir = path.join(docsDir, 'EP-8/ST-300');
      fs.mkdirSync(storyDir, { recursive: true });
      const filePath = path.join(storyDir, 'test.md');

      fs.writeFileSync(filePath, 'Version 1');
      await new Promise(resolve => setTimeout(resolve, 700));

      const firstCallCount = mockUploadManager.queueUpload.mock.calls.length;
      expect(firstCallCount).toBeGreaterThan(0);

      fs.writeFileSync(filePath, 'Version 2 - Updated');
      await new Promise(resolve => setTimeout(resolve, 700));

      expect(mockUploadManager.queueUpload.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });

  describe('File Watching - Unassigned Stories', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should detect and upload artifacts in unassigned story directory', async () => {
      const storyDir = path.join(docsDir, 'unassigned/ST-400');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'THE_PLAN.md'), '# Unassigned Story Plan');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact:upload', {
        storyKey: 'ST-400',
        artifactKey: 'THE_PLAN',
        filePath: expect.stringContaining('THE_PLAN.md'),
        content: '# Unassigned Story Plan',
        contentType: 'text/markdown',
        timestamp: expect.any(Number),
      });
    });

    it('should handle multiple unassigned stories', async () => {
      const story1Dir = path.join(docsDir, 'unassigned/ST-500');
      const story2Dir = path.join(docsDir, 'unassigned/ST-501');

      fs.mkdirSync(story1Dir, { recursive: true });
      fs.mkdirSync(story2Dir, { recursive: true });

      fs.writeFileSync(path.join(story1Dir, 'plan1.md'), 'Plan 1');
      fs.writeFileSync(path.join(story2Dir, 'plan2.md'), 'Plan 2');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledTimes(2);

      const storyKeys = mockUploadManager.queueUpload.mock.calls.map(
        (call: any) => call[1].storyKey
      );
      expect(storyKeys).toContain('ST-500');
      expect(storyKeys).toContain('ST-501');
    });
  });

  describe('File Watching - Legacy Direct Story Paths', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should still detect and upload legacy direct story paths', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'THE_PLAN.md'), '# Legacy Plan');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact:upload', {
        storyKey: 'ST-325',
        artifactKey: 'THE_PLAN',
        filePath: expect.stringContaining('THE_PLAN.md'),
        content: '# Legacy Plan',
        contentType: 'text/markdown',
        timestamp: expect.any(Number),
      });
    });

    it('should support backward compatibility with existing stories', async () => {
      // Create multiple stories using legacy format
      const stories = ['ST-1', 'ST-99', 'ST-325'];

      for (const storyKey of stories) {
        const storyDir = path.join(docsDir, storyKey);
        fs.mkdirSync(storyDir, { recursive: true });
        fs.writeFileSync(path.join(storyDir, 'test.md'), `Content for ${storyKey}`);
      }

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledTimes(stories.length);

      const uploadedStories = mockUploadManager.queueUpload.mock.calls.map(
        (call: any) => call[1].storyKey
      );
      for (const storyKey of stories) {
        expect(uploadedStories).toContain(storyKey);
      }
    });
  });

  describe('Depth and Performance', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should watch at depth 3 to support epic/story structure', async () => {
      // Depth 3: docs/ -> EP-X/ -> ST-Y/ -> file.md
      const storyDir = path.join(docsDir, 'EP-1/ST-1');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'test.md'), 'content');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalled();
    });

    it('should NOT watch beyond depth 3', async () => {
      // This is depth 4, should not be detected by pattern
      const deepDir = path.join(docsDir, 'EP-1/ST-1/subdir');
      fs.mkdirSync(deepDir, { recursive: true });
      fs.writeFileSync(path.join(deepDir, 'deep.md'), 'content');

      await new Promise(resolve => setTimeout(resolve, 600));

      // Should not match the pattern (file too deep)
      const calls = mockUploadManager.queueUpload.mock.calls;
      for (const call of calls) {
        const data = call[1] as any;
        const filePath = data?.filePath || '';
        expect(filePath).not.toContain('subdir/deep.md');
      }
    });
  });

  describe('Mixed Path Patterns', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle all 4 path patterns simultaneously', async () => {
      // Pattern 1: Epic-level (skipped)
      const epicDir = path.join(docsDir, 'EP-1');
      fs.mkdirSync(epicDir, { recursive: true });
      fs.writeFileSync(path.join(epicDir, 'epic-plan.md'), 'Epic Plan');

      // Pattern 2: Story in epic
      const epicStoryDir = path.join(docsDir, 'EP-2/ST-1');
      fs.mkdirSync(epicStoryDir, { recursive: true });
      fs.writeFileSync(path.join(epicStoryDir, 'story1.md'), 'Story 1');

      // Pattern 3: Unassigned
      const unassignedDir = path.join(docsDir, 'unassigned/ST-2');
      fs.mkdirSync(unassignedDir, { recursive: true });
      fs.writeFileSync(path.join(unassignedDir, 'story2.md'), 'Story 2');

      // Pattern 4: Legacy
      const legacyDir = path.join(docsDir, 'ST-3');
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(path.join(legacyDir, 'story3.md'), 'Story 3');

      await new Promise(resolve => setTimeout(resolve, 700));

      // Should have 3 uploads (epic-level is skipped)
      expect(mockUploadManager.queueUpload).toHaveBeenCalledTimes(3);

      const storyKeys = mockUploadManager.queueUpload.mock.calls.map(
        (call: any) => call[1].storyKey
      );
      expect(storyKeys).toContain('ST-1');
      expect(storyKeys).toContain('ST-2');
      expect(storyKeys).toContain('ST-3');
    });
  });
});
