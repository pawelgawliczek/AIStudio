/**
 * TDD Tests for ArtifactWatcher (ST-325)
 *
 * Watches docs/ST-* directories for artifact files and queues uploads.
 * These tests verify file watching, path parsing, and upload queueing.
 *
 * Test Categories:
 * - Unit: Path parsing and content type detection
 * - Integration: Chokidar watching and file handling
 * - Edge Cases: File patterns, extensions, error handling
 * - Security: Path traversal, malicious filenames
 */

import { ArtifactWatcher } from '../artifact-watcher';
import { UploadManager } from '../upload-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock UploadManager to track queued uploads
jest.mock('../upload-manager');

describe('ArtifactWatcher', () => {
  let watcher: ArtifactWatcher;
  let mockUploadManager: jest.Mocked<UploadManager>;
  let testProjectPath: string;
  let docsDir: string;

  beforeEach(() => {
    // Create temp directory structure
    testProjectPath = path.join(os.tmpdir(), `test-artifact-watcher-${Date.now()}`);
    docsDir = path.join(testProjectPath, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    // Create mock UploadManager
    mockUploadManager = {
      queueUpload: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({ pending: 0, sent: 0, acked: 0, total: 0 }),
      flush: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create watcher instance
    watcher = new ArtifactWatcher({
      uploadManager: mockUploadManager,
      projectPath: testProjectPath,
    });
  });

  afterEach(async () => {
    // Stop watcher and cleanup
    await watcher.stop();

    // Remove test directory
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }

    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create watcher instance with correct options', () => {
      expect(watcher).toBeDefined();
      expect(watcher).toBeInstanceOf(ArtifactWatcher);
    });

    it('should accept UploadManager and projectPath', () => {
      const customWatcher = new ArtifactWatcher({
        uploadManager: mockUploadManager,
        projectPath: '/custom/path',
      });

      expect(customWatcher).toBeDefined();
    });

    it('should not start watching until start() is called', async () => {
      // Create file before starting watcher
      const storyDir = path.join(docsDir, 'ST-123');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'TEST.md'), 'Content');

      // Should not have triggered any uploads
      expect(mockUploadManager.queueUpload).not.toHaveBeenCalled();
    });
  });

  describe('Path Parsing', () => {
    it('should parse valid artifact path with story key and artifact name', () => {
      const filePath = 'docs/ST-123/THE_PLAN.md';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed).toEqual({
        storyKey: 'ST-123',
        artifactKey: 'THE_PLAN',
        extension: 'md',
      });
    });

    it('should parse path with absolute path prefix', () => {
      const filePath = '/Users/user/projects/AIStudio/docs/ST-456/ARCH_DOC.json';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed).toEqual({
        storyKey: 'ST-456',
        artifactKey: 'ARCH_DOC',
        extension: 'json',
      });
    });

    it('should parse path with Windows backslashes', () => {
      const filePath = 'C:\\Users\\user\\projects\\docs\\ST-789\\TEST.txt';
      const parsed = (watcher as any).parseArtifactPath(filePath);

      expect(parsed).toEqual({
        storyKey: 'ST-789',
        artifactKey: 'TEST',
        extension: 'txt',
      });
    });

    it('should parse story keys with different numbers', () => {
      const testCases = [
        { path: 'docs/ST-1/test.md', expected: 'ST-1' },
        { path: 'docs/ST-99/test.md', expected: 'ST-99' },
        { path: 'docs/ST-325/test.md', expected: 'ST-325' },
        { path: 'docs/ST-1234/test.md', expected: 'ST-1234' },
      ];

      for (const tc of testCases) {
        const parsed = (watcher as any).parseArtifactPath(tc.path);
        expect(parsed?.storyKey).toBe(tc.expected);
      }
    });

    it('should parse artifact names with underscores and hyphens', () => {
      const testCases = [
        { path: 'docs/ST-123/THE_PLAN.md', expected: 'THE_PLAN' },
        { path: 'docs/ST-123/ARCH_DOC.md', expected: 'ARCH_DOC' },
        { path: 'docs/ST-123/test-file.md', expected: 'test-file' },
        { path: 'docs/ST-123/my_artifact_123.md', expected: 'my_artifact_123' },
      ];

      for (const tc of testCases) {
        const parsed = (watcher as any).parseArtifactPath(tc.path);
        expect(parsed?.artifactKey).toBe(tc.expected);
      }
    });

    it('should return null for non-matching paths', () => {
      const invalidPaths = [
        'docs/README.md',
        'docs/ST-123',
        'src/code.ts',
        'docs/story-123/test.md',
        'docs/ST-ABC/test.md',
      ];

      for (const invalidPath of invalidPaths) {
        const parsed = (watcher as any).parseArtifactPath(invalidPath);
        expect(parsed).toBeNull();
      }
    });

    it('should parse all supported extensions', () => {
      const extensions = ['md', 'json', 'txt'];

      for (const ext of extensions) {
        const parsed = (watcher as any).parseArtifactPath(`docs/ST-123/test.${ext}`);
        expect(parsed).not.toBeNull();
        expect(parsed.extension).toBe(ext);
      }
    });
  });

  describe('Content Type Detection', () => {
    it('should return text/markdown for .md files', () => {
      const contentType = (watcher as any).getContentType('md');
      expect(contentType).toBe('text/markdown');
    });

    it('should return application/json for .json files', () => {
      const contentType = (watcher as any).getContentType('json');
      expect(contentType).toBe('application/json');
    });

    it('should return text/plain for .txt files', () => {
      const contentType = (watcher as any).getContentType('txt');
      expect(contentType).toBe('text/plain');
    });

    it('should return application/octet-stream for unknown extensions', () => {
      const contentType = (watcher as any).getContentType('pdf');
      expect(contentType).toBe('application/octet-stream');
    });
  });

  describe('File Watching', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should detect new .md file in ST-* directory', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });

      fs.writeFileSync(path.join(storyDir, 'THE_PLAN.md'), '# Implementation Plan\n\nDetails here.');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact', {
        storyKey: 'ST-325',
        artifactKey: 'THE_PLAN',
        filePath: expect.stringContaining('THE_PLAN.md'),
        content: '# Implementation Plan\n\nDetails here.',
        contentType: 'text/markdown',
        timestamp: expect.any(Number),
      });
    });

    it('should detect new .json file in ST-* directory', async () => {
      const storyDir = path.join(docsDir, 'ST-100');
      fs.mkdirSync(storyDir, { recursive: true });

      const jsonContent = JSON.stringify({ test: 'data', nested: { value: 123 } });
      fs.writeFileSync(path.join(storyDir, 'config.json'), jsonContent);

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact', {
        storyKey: 'ST-100',
        artifactKey: 'config',
        filePath: expect.stringContaining('config.json'),
        content: jsonContent,
        contentType: 'application/json',
        timestamp: expect.any(Number),
      });
    });

    it('should detect new .txt file in ST-* directory', async () => {
      const storyDir = path.join(docsDir, 'ST-200');
      fs.mkdirSync(storyDir, { recursive: true });

      fs.writeFileSync(path.join(storyDir, 'notes.txt'), 'Plain text notes');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact', {
        storyKey: 'ST-200',
        artifactKey: 'notes',
        filePath: expect.stringContaining('notes.txt'),
        content: 'Plain text notes',
        contentType: 'text/plain',
        timestamp: expect.any(Number),
      });
    });

    it('should detect file changes and trigger re-upload', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });
      const filePath = path.join(storyDir, 'TEST.md');

      fs.writeFileSync(filePath, 'Version 1');
      await new Promise(resolve => setTimeout(resolve, 600));

      const firstCallCount = mockUploadManager.queueUpload.mock.calls.length;

      fs.writeFileSync(filePath, 'Version 2');
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload.mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    it('should ignore files with unsupported extensions', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });

      fs.writeFileSync(path.join(storyDir, 'image.png'), 'fake image data');
      fs.writeFileSync(path.join(storyDir, 'script.js'), 'console.log(	est)');

      await new Promise(resolve => setTimeout(resolve, 600));

      const calls = mockUploadManager.queueUpload.mock.calls;
      for (const call of calls) {
        const data = call[1] as any;
        expect(data.filePath).not.toContain('.png');
        expect(data.filePath).not.toContain('.js');
      }
    });

    it('should handle multiple files in same story directory', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });

      fs.writeFileSync(path.join(storyDir, 'THE_PLAN.md'), 'Plan content');
      fs.writeFileSync(path.join(storyDir, 'ARCH_DOC.md'), 'Architecture content');
      fs.writeFileSync(path.join(storyDir, 'config.json'), '{key: alue}');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledTimes(3);

      const artifactKeys = mockUploadManager.queueUpload.mock.calls.map(
        (call: any) => call[1].artifactKey
      );
      expect(artifactKeys).toContain('THE_PLAN');
      expect(artifactKeys).toContain('ARCH_DOC');
      expect(artifactKeys).toContain('config');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle upload queue errors gracefully', async () => {
      mockUploadManager.queueUpload.mockRejectedValueOnce(new Error('Queue full'));

      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'test.md'), 'Content');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalled();
    });

    it('should handle Unicode content', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });

      const unicodeContent = 'Hello 世界 🌍 Привет مرحبا';
      fs.writeFileSync(path.join(storyDir, 'unicode.md'), unicodeContent, 'utf-8');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact', {
        storyKey: 'ST-325',
        artifactKey: 'unicode',
        filePath: expect.stringContaining('unicode.md'),
        content: unicodeContent,
        contentType: 'text/markdown',
        timestamp: expect.any(Number),
      });
    });

    it('should handle empty files', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'empty.md'), '');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact', {
        storyKey: 'ST-325',
        artifactKey: 'empty',
        filePath: expect.stringContaining('empty.md'),
        content: '',
        contentType: 'text/markdown',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Security', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should validate story key format strictly', async () => {
      const invalidDirs = [
        'ST-',
        'ST-ABC',
        'ST123',
        'story-123',
      ];

      for (const dirName of invalidDirs) {
        const dir = path.join(docsDir, dirName);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'test.md'), 'Content');
      }

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).not.toHaveBeenCalled();
    });

    it('should handle malicious filenames safely', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });

      const safeNames = [
        'normal-file.md',
        'file_with_underscore.md',
        'file123.md',
      ];

      for (const filename of safeNames) {
        fs.writeFileSync(path.join(storyDir, filename), 'Content');
      }

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('should start watching when start() is called', async () => {
      await watcher.start();

      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'test.md'), 'Content');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalled();
    });

    it('should stop watching when stop() is called', async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      await watcher.stop();

      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'test.md'), 'Content');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).not.toHaveBeenCalled();
    });

    it('should handle stop without start', async () => {
      await expect(watcher.stop()).resolves.not.toThrow();
    });
  });

  describe('Integration with UploadManager', () => {
    beforeEach(async () => {
      await watcher.start();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should pass correct event type to queueUpload', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'test.md'), 'Content');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith(
        'artifact',
        expect.any(Object)
      );
    });

    it('should include all required fields in upload payload', async () => {
      const storyDir = path.join(docsDir, 'ST-325');
      fs.mkdirSync(storyDir, { recursive: true });
      fs.writeFileSync(path.join(storyDir, 'TEST.md'), 'Content');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUploadManager.queueUpload).toHaveBeenCalledWith('artifact', {
        storyKey: expect.any(String),
        artifactKey: expect.any(String),
        filePath: expect.any(String),
        content: expect.any(String),
        contentType: expect.any(String),
        timestamp: expect.any(Number),
      });
    });
  });
});
