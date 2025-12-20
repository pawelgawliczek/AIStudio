/**
 * ST-325: ArtifactWatcher - Watch and upload story artifacts
 * ST-363: Added epic file hierarchy support (docs/EP-XXX/)
 * ST-351: Added initial file sync with persistent cache and throttling
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
 * - ST-351: Persistent cache prevents re-upload after restarts
 * - ST-351: Throttled initial scan prevents backend flooding
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { Logger } from './logger';
import { UploadManager } from './upload-manager';

export interface ArtifactWatcherOptions {
  uploadManager: UploadManager;
  projectPath: string;
}

// ST-351: Configuration for throttling
const BATCH_SIZE = 5;  // Max artifacts to send at once
const BATCH_DELAY_MS = 500;  // Delay between batches

// ST-351: Cache file path (configurable for testing)
const getCacheFilePath = (): string => {
  return process.env.ARTIFACT_CACHE_FILE ||
    path.join(os.homedir(), '.vibestudio', 'synced-artifacts.json');
};

export class ArtifactWatcher {
  private readonly logger = new Logger('ArtifactWatcher');
  private watcher: chokidar.FSWatcher | null = null;
  private readonly uploadManager: UploadManager;
  private readonly projectPath: string;
  private processedFiles = new Set<string>();

  // ST-351: Persistent cache of synced artifact paths
  private syncedCache = new Set<string>();

  // ST-351: Queue for batching artifact notifications
  private notificationQueue: Array<{filePath: string; isInitialScan: boolean}> = [];
  private isProcessingQueue = false;
  private initialScanComplete = false;

  constructor(options: ArtifactWatcherOptions) {
    this.uploadManager = options.uploadManager;
    this.projectPath = options.projectPath;

    // ST-351: Load persistent cache
    this.loadSyncedCache();
  }

  /**
   * ST-351: Load synced artifacts cache from disk
   */
  private loadSyncedCache(): void {
    try {
      const cacheFile = getCacheFilePath();
      if (fs.existsSync(cacheFile)) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        if (Array.isArray(data.syncedPaths)) {
          this.syncedCache = new Set(data.syncedPaths);
          this.logger.info('Loaded synced cache', { count: this.syncedCache.size });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to load synced cache, starting fresh', { error: message });
      this.syncedCache = new Set();
    }
  }

  /**
   * ST-351: Save synced artifacts cache to disk
   */
  private saveSyncedCache(): void {
    try {
      const cacheFile = getCacheFilePath();
      const dir = path.dirname(cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(cacheFile, JSON.stringify({
        syncedPaths: Array.from(this.syncedCache),
        lastUpdated: new Date().toISOString(),
      }, null, 2));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to save synced cache', { error: message });
    }
  }

  async start(): Promise<void> {
    // Watch the docs directory recursively
    // We watch the entire docs dir because chokidar glob patterns don't dynamically
    // pick up new directories created after the watcher starts
    const watchDir = path.join(this.projectPath, 'docs');

    // ST-351: Check if initial sync is enabled (default: true)
    const syncExisting = process.env.SYNC_EXISTING_ARTIFACTS !== 'false';

    this.logger.info('Starting artifact watcher', {
      watchDir,
      cachedCount: this.syncedCache.size,
      syncExisting
    });

    // ST-351: Use ignoreInitial: true to prevent flooding on startup
    // We'll handle existing files separately with throttling
    this.watcher = chokidar.watch(watchDir, {
      persistent: true,
      ignoreInitial: true, // ST-351: Changed from false - prevents bulk sync flooding
      depth: 3, // ST-363: docs/EP-XXX/ST-YYY/files or docs/unassigned/ST-YYY/files
      awaitWriteFinish: {
        stabilityThreshold: 500, // Wait 500ms for file to stabilize
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => {
      this.logger.debug('File added', { filePath });
      this.queueNotification(filePath, false);
    });

    this.watcher.on('change', (filePath) => {
      this.logger.debug('File changed', { filePath });
      // Remove from both caches to allow re-upload on change
      this.processedFiles.delete(filePath);
      this.syncedCache.delete(filePath);
      this.queueNotification(filePath, false);
    });

    this.watcher.on('error', (error) => {
      this.logger.error('Watcher error', { error });
    });

    this.watcher.on('ready', () => {
      this.logger.info('Chokidar ready, starting initial scan with throttling');
      this.initialScanComplete = true;
      // ST-351: Perform initial scan with throttling if enabled
      if (syncExisting) {
        this.performThrottledInitialScan(watchDir);
      }
    });

    this.logger.info('Artifact watcher initialized');
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      // ST-351: Save cache on shutdown
      this.saveSyncedCache();
      this.logger.info('Artifact watcher stopped');
    }
  }

  /**
   * ST-351: Clear the synced cache (for testing)
   * @internal
   */
  clearCache(): void {
    this.syncedCache.clear();
    this.processedFiles.clear();
    try {
      const cacheFile = getCacheFilePath();
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
      }
    } catch (error: unknown) {
      // Ignore errors during cleanup
    }
  }

  /**
   * ST-351: Perform initial scan with throttling to avoid flooding backend
   */
  private async performThrottledInitialScan(watchDir: string): Promise<void> {
    try {
      const files: string[] = [];

      // Recursively find all artifact files (.md, .json, .txt)
      const scanDir = (dir: string, depth: number) => {
        if (depth > 3) return;

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              scanDir(fullPath, depth + 1);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).substring(1);
              if (['md', 'json', 'txt'].includes(ext)) {
                files.push(fullPath);
              }
            }
          }
        } catch (error: unknown) {
          // Ignore permission errors, etc.
        }
      };

      scanDir(watchDir, 0);

      // Filter out already-synced files
      const newFiles = files.filter(f => !this.syncedCache.has(f));

      this.logger.info('Initial scan found files', {
        total: files.length,
        alreadySynced: files.length - newFiles.length,
        needsSync: newFiles.length
      });

      // Queue new files for throttled processing
      for (const filePath of newFiles) {
        this.queueNotification(filePath, true);
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Initial scan failed', { error: message });
    }
  }

  /**
   * ST-351: Queue a notification for batched processing
   */
  private queueNotification(filePath: string, isInitialScan: boolean): void {
    // Skip if already in cache (persistent) or already notified (in-session)
    if (this.syncedCache.has(filePath) || this.processedFiles.has(filePath)) {
      this.logger.debug('Skipping already-synced file', { filePath });
      return;
    }

    this.notificationQueue.push({ filePath, isInitialScan });
    this.processQueue();
  }

  /**
   * ST-351: Process notification queue with throttling
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.notificationQueue.length > 0) {
        // Take a batch
        const batch = this.notificationQueue.splice(0, BATCH_SIZE);

        this.logger.info('Processing artifact batch', {
          batchSize: batch.length,
          remaining: this.notificationQueue.length
        });

        // Process batch
        for (const { filePath } of batch) {
          await this.handleFile(filePath);
        }

        // Save cache after each batch
        this.saveSyncedCache();

        // Delay before next batch if there are more
        if (this.notificationQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Handle a new or changed artifact file
   * ST-363: Skip epic-level artifacts (no storyKey) for now
   * ST-351: Check persistent cache to prevent re-upload
   */
  private async handleFile(filePath: string): Promise<void> {
    this.logger.debug('handleFile called', { filePath });

    // ST-351: Skip if already in persistent cache or already processed this session
    if (this.syncedCache.has(filePath) || this.processedFiles.has(filePath)) {
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

    // Must have either storyKey or epicKey (for epic-level artifacts)
    if (!storyKey && !epicKey) {
      this.logger.debug('No storyKey or epicKey found, skipping', { filePath });
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
        epicKey,  // ST-362: Support epic-level artifacts
        artifactKey,
        filePath,
        content,
        contentType: this.getContentType(extension),
        timestamp: Date.now(),
      });

      // ST-351: Mark as processed in both caches
      this.processedFiles.add(filePath);
      this.syncedCache.add(filePath);

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
