/**
 * ST-325: ArtifactWatcher - Watch and upload story artifacts
 *
 * Watches docs/ST-* directories for artifact files (.md, .json, .txt)
 * and queues them for upload via UploadManager.
 *
 * Features:
 * - Watches docs/ST-* directories recursively
 * - Parses storyKey and artifactKey from file paths
 * - Queues uploads via UploadManager for guaranteed delivery
 * - Handles both new files and changes
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { Logger } from './logger';
import { UploadManager } from './upload-manager';

export interface ArtifactWatcherOptions {
  uploadManager: UploadManager;
  projectPath: string;
}

export class ArtifactWatcher {
  private readonly logger = new Logger('ArtifactWatcher');
  private watcher: chokidar.FSWatcher | null = null;
  private readonly uploadManager: UploadManager;
  private readonly projectPath: string;
  private processedFiles = new Set<string>();

  constructor(options: ArtifactWatcherOptions) {
    this.uploadManager = options.uploadManager;
    this.projectPath = options.projectPath;
  }

  async start(): Promise<void> {
    // Watch the docs directory recursively
    // We watch the entire docs dir because chokidar glob patterns don't dynamically
    // pick up new directories created after the watcher starts
    const watchDir = path.join(this.projectPath, 'docs');

    this.logger.info('Starting artifact watcher', { watchDir });

    this.watcher = chokidar.watch(watchDir, {
      persistent: true,
      ignoreInitial: false, // Process existing files on startup
      depth: 2, // docs/ST-XXX/files
      awaitWriteFinish: {
        stabilityThreshold: 500, // Wait 500ms for file to stabilize
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => {
      this.logger.debug('File added', { filePath });
      this.handleFile(filePath).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to handle added file', { filePath, error: message });
      });
    });

    this.watcher.on('change', (filePath) => {
      this.logger.debug('File changed', { filePath });
      // Remove from processedFiles to allow re-upload on change
      this.processedFiles.delete(filePath);
      this.handleFile(filePath).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to handle changed file', { filePath, error: message });
      });
    });

    this.watcher.on('error', (error) => {
      this.logger.error('Watcher error', { error });
    });

    this.watcher.on('ready', () => {
      this.logger.info('Artifact watcher ready');
    });

    this.logger.info('Artifact watcher initialized');
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.logger.info('Artifact watcher stopped');
    }
  }

  /**
   * Handle a new or changed artifact file
   */
  private async handleFile(filePath: string): Promise<void> {
    this.logger.debug('handleFile called', { filePath });

    // Skip if already processed (for initial scan)
    if (this.processedFiles.has(filePath)) {
      this.logger.debug('File already processed, skipping', { filePath });
      return;
    }

    // Parse the file path to extract storyKey and artifactKey
    // Expected pattern: docs/ST-XXX/ARTIFACT_NAME.ext
    const parsed = this.parseArtifactPath(filePath);
    if (!parsed) {
      this.logger.debug('File does not match artifact pattern, skipping', { filePath });
      return;
    }

    const { storyKey, artifactKey, extension } = parsed;

    // Validate file extension
    if (!['md', 'json', 'txt'].includes(extension)) {
      this.logger.debug('File extension not supported, skipping', { filePath, extension });
      return;
    }

    // Read file content
    let content: string;
    try {
      content = await fs.promises.readFile(filePath, 'utf-8');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to read file', { filePath, error: message });
      return;
    }

    // Queue the upload via UploadManager
    try {
      await this.uploadManager.queueUpload('artifact:upload', {
        storyKey,
        artifactKey,
        filePath,
        content,
        contentType: this.getContentType(extension),
        timestamp: Date.now(),
      });

      // Mark as processed to prevent duplicate uploads during initial scan
      this.processedFiles.add(filePath);

      // Calculate content hash for logging
      const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);

      this.logger.info('Artifact queued for upload', {
        storyKey,
        artifactKey,
        filePath,
        sizeBytes: content.length,
        contentHash,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to queue artifact', { filePath, error: message });
      throw error;
    }
  }

  /**
   * Parse artifact path to extract storyKey and artifactKey
   * Expected pattern: docs/ST-XXX/ARTIFACT_NAME.ext
   * Returns { storyKey, artifactKey, extension } or null if not a valid artifact path
   */
  private parseArtifactPath(filePath: string): { storyKey: string; artifactKey: string; extension: string } | null {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Match pattern: docs/ST-XXX/ARTIFACT.ext
    const match = normalizedPath.match(/docs\/(ST-\d+)\/([^/]+)\.(md|json|txt)$/);
    if (!match) {
      return null;
    }

    const storyKey = match[1];
    const artifactKey = match[2];
    const extension = match[3];

    return { storyKey, artifactKey, extension };
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(extension: string): string {
    switch (extension) {
      case 'md':
        return 'text/markdown';
      case 'json':
        return 'application/json';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }
}
