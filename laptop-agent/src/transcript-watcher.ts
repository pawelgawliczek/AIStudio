/**
 * ST-170: Simple Transcript Watcher
 * ST-267: Fixed bulk sync flooding by adding persistent cache and throttling
 *
 * Watches for new transcript files and notifies backend via WebSocket.
 * Backend handles all registration and upload logic.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { Socket } from 'socket.io-client';
import { Logger } from './logger';

export interface TranscriptWatcherOptions {
  socket: Socket;
  projectPath: string;
}

// ST-267: Configuration for throttling
const BATCH_SIZE = 5;  // Max transcripts to send at once
const BATCH_DELAY_MS = 500;  // Delay between batches
const CACHE_FILE = path.join(os.homedir(), '.vibestudio', 'synced-transcripts.json');

export class TranscriptWatcher {
  private readonly logger = new Logger('TranscriptWatcher');
  private watcher: chokidar.FSWatcher | null = null;
  private readonly socket: Socket;
  private readonly projectPath: string;
  private notifiedFiles = new Set<string>();

  // ST-267: Persistent cache of synced transcript paths
  private syncedCache = new Set<string>();

  // ST-267: Queue for batching transcript notifications
  private notificationQueue: Array<{filePath: string; isInitialScan: boolean}> = [];
  private isProcessingQueue = false;
  private initialScanComplete = false;

  constructor(options: TranscriptWatcherOptions) {
    this.socket = options.socket;
    this.projectPath = options.projectPath;

    // ST-267: Load persistent cache
    this.loadSyncedCache();
  }

  /**
   * ST-267: Load synced transcripts cache from disk
   */
  private loadSyncedCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        if (Array.isArray(data.syncedPaths)) {
          this.syncedCache = new Set(data.syncedPaths);
          this.logger.info('Loaded synced cache', { count: this.syncedCache.size });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load synced cache, starting fresh', { error });
      this.syncedCache = new Set();
    }
  }

  /**
   * ST-267: Save synced transcripts cache to disk
   */
  private saveSyncedCache(): void {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify({
        syncedPaths: Array.from(this.syncedCache),
        lastUpdated: new Date().toISOString(),
      }, null, 2));
    } catch (error) {
      this.logger.warn('Failed to save synced cache', { error });
    }
  }

  async start(): Promise<void> {
    // Watch the .claude/projects directory recursively
    // We can't use glob patterns like */*.jsonl because chokidar doesn't match them properly
    const watchDir = path.join(os.homedir(), '.claude/projects');

    this.logger.info('Starting transcript watcher', { watchDir, cachedCount: this.syncedCache.size });

    // ST-267: Use ignoreInitial: true to prevent flooding on startup
    // We'll handle existing files separately with throttling
    this.watcher = chokidar.watch(watchDir, {
      persistent: true,
      ignoreInitial: true,  // ST-267: Changed from false - prevents bulk sync flooding
      depth: 2,  // Only watch 2 levels deep (projects/*/files)
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => {
      this.logger.debug('File detected by chokidar', { filePath });
      this.queueNotification(filePath, false);
    });

    this.watcher.on('ready', () => {
      this.logger.info('Chokidar ready, starting initial scan with throttling');
      this.initialScanComplete = true;
      // ST-267: Perform initial scan with throttling
      this.performThrottledInitialScan(watchDir);
    });

    this.watcher.on('error', (error) => {
      this.logger.error('Watcher error', { error });
    });

    this.logger.info('Transcript watcher initialized');
  }

  /**
   * ST-267: Perform initial scan with throttling to avoid flooding backend
   */
  private async performThrottledInitialScan(watchDir: string): Promise<void> {
    try {
      const files: string[] = [];

      // Recursively find all .jsonl files
      const scanDir = (dir: string, depth: number) => {
        if (depth > 2) return;

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              scanDir(fullPath, depth + 1);
            } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
              files.push(fullPath);
            }
          }
        } catch (err) {
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

    } catch (error) {
      this.logger.error('Initial scan failed', { error });
    }
  }

  /**
   * ST-267: Queue a notification for batched processing
   */
  private queueNotification(filePath: string, isInitialScan: boolean): void {
    // Skip if already in cache (persistent) or already notified (in-session)
    if (this.syncedCache.has(filePath) || this.notifiedFiles.has(filePath)) {
      this.logger.debug('Skipping already-synced file', { filePath });
      return;
    }

    this.notificationQueue.push({ filePath, isInitialScan });
    this.processQueue();
  }

  /**
   * ST-267: Process notification queue with throttling
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

        this.logger.info('Processing transcript batch', {
          batchSize: batch.length,
          remaining: this.notificationQueue.length
        });

        // Process batch
        for (const { filePath, isInitialScan } of batch) {
          await this.handleNewFile(filePath);
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

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      // ST-267: Save cache on shutdown
      this.saveSyncedCache();
      this.logger.info('Transcript watcher stopped');
    }
  }

  private async handleNewFile(filePath: string): Promise<void> {
    this.logger.debug('handleNewFile called', { filePath });

    // ST-267: Skip if already in persistent cache or already notified this session
    if (this.syncedCache.has(filePath) || this.notifiedFiles.has(filePath)) {
      this.logger.debug('File already synced, skipping', { filePath });
      return;
    }

    // Only process .jsonl files
    if (!filePath.endsWith('.jsonl')) {
      return;
    }

    const filename = path.basename(filePath);
    this.logger.debug('Checking filename pattern', { filename });

    // Check if it's an agent transcript (agent-{6-16-char-hex}.jsonl)
    // Claude Code uses variable-length hex IDs (typically 7-8 chars)
    const agentMatch = filename.match(/^agent-([a-f0-9]{6,16})\.jsonl$/);
    if (agentMatch) {
      const agentId = agentMatch[1];

      // Read first line to get metadata
      const metadata = await this.readFirstLine(filePath);

      // Notify backend via WebSocket with parsed metadata
      this.socket.emit('agent:transcript_detected', {
        agentId,
        transcriptPath: filePath,
        projectPath: this.projectPath,
        metadata, // Include parsed metadata
      });

      // ST-267: Add to both caches
      this.notifiedFiles.add(filePath);
      this.syncedCache.add(filePath);
      this.logger.info('Notified backend about agent transcript', { agentId, filePath });
      return;
    }

    // Check if it's a master session transcript ({uuid}.jsonl)
    const masterMatch = filename.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.jsonl$/);
    if (masterMatch) {
      const sessionId = masterMatch[1];

      // Read first line to get metadata
      const metadata = await this.readFirstLine(filePath);

      // Notify backend via WebSocket with parsed metadata
      this.socket.emit('agent:transcript_detected', {
        agentId: null, // No agent ID for master sessions
        transcriptPath: filePath,
        projectPath: this.projectPath,
        metadata, // Include parsed metadata
      });

      // ST-267: Add to both caches
      this.notifiedFiles.add(filePath);
      this.syncedCache.add(filePath);
      this.logger.info('Notified backend about master session transcript', { sessionId, filePath });
      return;
    }

    // Not a transcript we care about
    this.logger.debug('Filename does not match transcript patterns, skipping', { filename });
  }

  /**
   * Read and parse the first line of a transcript file
   */
  private async readFirstLine(filePath: string): Promise<any> {
    const fs = await import('fs');
    const readline = await import('readline');

    return new Promise((resolve, reject) => {
      try {
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
        const reader = readline.createInterface({ input: stream });

        reader.on('line', (line) => {
          reader.close();
          stream.destroy();

          try {
            const parsed = JSON.parse(line);
            resolve(parsed);
          } catch (error) {
            this.logger.warn('Failed to parse first line as JSON', { filePath, line });
            resolve(null);
          }
        });

        reader.on('error', (error) => {
          this.logger.error('Error reading file', { filePath, error });
          resolve(null);
        });

        stream.on('error', (error) => {
          this.logger.error('Error opening file', { filePath, error });
          resolve(null);
        });
      } catch (error) {
        this.logger.error('Unexpected error in readFirstLine', { filePath, error });
        resolve(null);
      }
    });
  }
}
