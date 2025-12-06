/**
 * ST-170: Simple Transcript Watcher
 * 
 * Watches for new transcript files and notifies backend via WebSocket.
 * Backend handles all registration and upload logic.
 */

import * as path from 'path';
import * as os from 'os';
import * as chokidar from 'chokidar';
import { Socket } from 'socket.io-client';
import { Logger } from './logger';

export interface TranscriptWatcherOptions {
  socket: Socket;
  projectPath: string;
}

export class TranscriptWatcher {
  private readonly logger = new Logger('TranscriptWatcher');
  private watcher: chokidar.FSWatcher | null = null;
  private readonly socket: Socket;
  private readonly projectPath: string;
  private notifiedFiles = new Set<string>();

  constructor(options: TranscriptWatcherOptions) {
    this.socket = options.socket;
    this.projectPath = options.projectPath;
  }

  async start(): Promise<void> {
    // Watch the .claude/projects directory recursively
    // We can't use glob patterns like */*.jsonl because chokidar doesn't match them properly
    const watchDir = path.join(os.homedir(), '.claude/projects');

    this.logger.info('Starting transcript watcher', { watchDir });

    this.watcher = chokidar.watch(watchDir, {
      persistent: true,
      ignoreInitial: false,
      depth: 2,  // Only watch 2 levels deep (projects/*/files)
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => {
      this.logger.info('File detected by chokidar', { filePath });
      this.handleNewFile(filePath);
    });

    this.watcher.on('ready', () => {
      this.logger.info('Chokidar initial scan complete, watching for changes');
    });

    this.watcher.on('error', (error) => {
      this.logger.error('Watcher error', { error });
    });

    this.logger.info('Transcript watcher initialized');
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.logger.info('Transcript watcher stopped');
    }
  }

  private async handleNewFile(filePath: string): Promise<void> {
    this.logger.info('handleNewFile called', { filePath });

    // Skip if already notified
    if (this.notifiedFiles.has(filePath)) {
      this.logger.info('File already notified, skipping', { filePath });
      return;
    }

    // Only process .jsonl files
    if (!filePath.endsWith('.jsonl')) {
      return;
    }

    const filename = path.basename(filePath);
    this.logger.info('Checking filename pattern', { filename });

    // Check if it's an agent transcript (agent-{8-char-hex}.jsonl)
    const agentMatch = filename.match(/^agent-([a-f0-9]{8})\.jsonl$/);
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

      this.notifiedFiles.add(filePath);
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

      this.notifiedFiles.add(filePath);
      this.logger.info('Notified backend about master session transcript', { sessionId, filePath });
      return;
    }

    // Not a transcript we care about
    this.logger.info('Filename does not match transcript patterns, skipping', { filename });
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
