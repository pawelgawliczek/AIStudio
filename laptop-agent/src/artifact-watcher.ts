/**
 * ST-325: ArtifactWatcher - Watch and upload story artifacts
 * ST-363: Added epic file hierarchy support (docs/EP-XXX/)
 *
 * Watches docs/ directories for artifact files (.md, .json, .txt)
 * and queues them for upload via UploadManager.
 *
 * Supported paths:
 * - docs/EP-XXX/*.md (epic-level artifacts)
 * - docs/EP-XXX/ST-YYY/*.md (story in epic)
 * - docs/unassigned/ST-YYY/*.md (unassigned stories)
 * - docs/ST-YYY/*.md (legacy direct story path)
 *
 * Features:
 * - Watches docs/ directories at depth 3
 * - Parses epicKey, storyKey, and artifactKey from file paths
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
      depth: 3, // ST-363: docs/EP-XXX/ST-YYY/files or docs/unassigned/ST-YYY/files
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
   * ST-363: Skip epic-level artifacts (no storyKey) for now
   */
  private async handleFile(filePath: string): Promise<void> {
    this.logger.debug('handleFile called', { filePath });

    // Skip if already processed (for initial scan)
    if (this.processedFiles.has(filePath)) {
      this.logger.debug('File already processed, skipping', { filePath });
      return;
    }

    // Parse the file path to extract epicKey, storyKey, and artifactKey
    const parsed = this.parseArtifactPath(filePath);
    if (!parsed) {
      this.logger.debug('File does not match artifact pattern, skipping', { filePath });
      return;
    }

    const { epicKey, storyKey, artifactKey, extension } = parsed;

    // ST-363: Skip epic-level artifacts (no storyKey) - these will be handled in future story
    if (epicKey && !storyKey) {
      this.logger.debug('Epic-level artifact detected, skipping (not yet supported)', {
        filePath,
        epicKey,
        artifactKey,
      });
      return;
    }

    // Validate storyKey is present
    if (!storyKey) {
      this.logger.debug('No storyKey found, skipping', { filePath });
      return;
    }

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
        epicKey,
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
   * Parse artifact path to extract epicKey, storyKey, and artifactKey
   * ST-363: Support multiple path patterns:
   * - docs/EP-XXX/THE_PLAN.md (epic-level artifact)
   * - docs/EP-XXX/ST-YYY/ARTIFACT.md (story in epic)
   * - docs/unassigned/ST-YYY/ARTIFACT.md (unassigned story)
   * - docs/ST-YYY/ARTIFACT.md (legacy direct story path)
   *
   * Returns { epicKey?, storyKey?, artifactKey, extension } or null if not valid
   */
  private parseArtifactPath(filePath: string): {
    epicKey?: string;
    storyKey?: string;
    artifactKey: string;
    extension: string;
  } | null {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Pattern 1: docs/EP-XXX/THE_PLAN.md (epic-level artifact)
    const epicMatch = normalizedPath.match(/docs\/(EP-\d+)\/([^/]+)\.(md|json|txt)$/);
    if (epicMatch) {
      return {
        epicKey: epicMatch[1],
        artifactKey: epicMatch[2],
        extension: epicMatch[3],
      };
    }

    // Pattern 2: docs/EP-XXX/ST-YYY/ARTIFACT.md (story in epic)
    const epicStoryMatch = normalizedPath.match(/docs\/(EP-\d+)\/(ST-\d+)\/([^/]+)\.(md|json|txt)$/);
    if (epicStoryMatch) {
      return {
        epicKey: epicStoryMatch[1],
        storyKey: epicStoryMatch[2],
        artifactKey: epicStoryMatch[3],
        extension: epicStoryMatch[4],
      };
    }

    // Pattern 3: docs/unassigned/ST-YYY/ARTIFACT.md (unassigned story)
    const unassignedMatch = normalizedPath.match(/docs\/unassigned\/(ST-\d+)\/([^/]+)\.(md|json|txt)$/);
    if (unassignedMatch) {
      return {
        storyKey: unassignedMatch[1],
        artifactKey: unassignedMatch[2],
        extension: unassignedMatch[3],
      };
    }

    // Pattern 4: docs/ST-YYY/ARTIFACT.md (legacy direct story path)
    const legacyMatch = normalizedPath.match(/docs\/(ST-\d+)\/([^/]+)\.(md|json|txt)$/);
    if (legacyMatch) {
      return {
        storyKey: legacyMatch[1],
        artifactKey: legacyMatch[2],
        extension: legacyMatch[3],
      };
    }

    return null;
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
