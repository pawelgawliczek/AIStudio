/**
 * Checkpoint Service
 * Dual-redundancy checkpoint system (database + file)
 * Enables crash recovery by persisting runner state
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { RunnerCheckpoint, RunnerConfig, isValidCheckpoint } from '../types';

/**
 * Checkpoint save result
 */
export interface CheckpointSaveResult {
  success: boolean;
  dbSaved: boolean;
  fileSaved: boolean;
  error?: string;
}

/**
 * Checkpoint load result
 */
export interface CheckpointLoadResult {
  checkpoint: RunnerCheckpoint | null;
  source: 'database' | 'file' | null;
  error?: string;
}

/**
 * Checkpoint Service
 * Provides dual-redundancy checkpoint persistence
 */
export class CheckpointService {
  private config: RunnerConfig;
  private checkpointDir: string;

  constructor(config: RunnerConfig) {
    this.config = config;
    this.checkpointDir = path.join(config.workingDirectory, '.runner', 'checkpoints');
    this.ensureCheckpointDir();
  }

  /**
   * Ensure checkpoint directory exists
   */
  private ensureCheckpointDir(): void {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
      console.log(`[CheckpointService] Created checkpoint directory: ${this.checkpointDir}`);
    }
  }

  /**
   * Save checkpoint to both database and file
   * Returns success if at least one save succeeds
   */
  async save(checkpoint: RunnerCheckpoint): Promise<CheckpointSaveResult> {
    const result: CheckpointSaveResult = {
      success: false,
      dbSaved: false,
      fileSaved: false,
    };

    // Update timestamp
    checkpoint.checkpointedAt = new Date().toISOString();

    // Try database save first
    try {
      await this.saveToDatabase(checkpoint);
      result.dbSaved = true;
      console.log(`[CheckpointService] Saved checkpoint to database: ${checkpoint.runId}`);
    } catch (error) {
      console.error(`[CheckpointService] Database save failed:`, error);
    }

    // Then file save
    try {
      await this.saveToFile(checkpoint);
      result.fileSaved = true;
      console.log(`[CheckpointService] Saved checkpoint to file: ${checkpoint.runId}`);
    } catch (error) {
      console.error(`[CheckpointService] File save failed:`, error);
    }

    // Success if at least one worked
    result.success = result.dbSaved || result.fileSaved;

    if (!result.success) {
      result.error = 'Both database and file checkpoint saves failed';
    }

    return result;
  }

  /**
   * Load checkpoint with fallback (database first, then file)
   */
  async load(runId: string): Promise<RunnerCheckpoint | null> {
    // Try database first
    try {
      const dbCheckpoint = await this.loadFromDatabase(runId);
      if (dbCheckpoint && isValidCheckpoint(dbCheckpoint)) {
        console.log(`[CheckpointService] Loaded checkpoint from database: ${runId}`);
        return dbCheckpoint;
      }
    } catch (error) {
      console.warn(`[CheckpointService] Database load failed:`, error);
    }

    // Fallback to file
    try {
      const fileCheckpoint = await this.loadFromFile(runId);
      if (fileCheckpoint && isValidCheckpoint(fileCheckpoint)) {
        console.log(`[CheckpointService] Loaded checkpoint from file: ${runId}`);
        return fileCheckpoint;
      }
    } catch (error) {
      console.warn(`[CheckpointService] File load failed:`, error);
    }

    console.error(`[CheckpointService] No valid checkpoint found for: ${runId}`);
    return null;
  }

  /**
   * Save checkpoint to database via backend API
   */
  private async saveToDatabase(checkpoint: RunnerCheckpoint): Promise<void> {
    const url = `${this.config.backendUrl}/api/runner/checkpoints`;

    await axios.post(url, {
      runId: checkpoint.runId,
      workflowId: checkpoint.workflowId,
      storyId: checkpoint.storyId,
      checkpointData: checkpoint,
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Load checkpoint from database via backend API
   */
  private async loadFromDatabase(runId: string): Promise<RunnerCheckpoint | null> {
    const url = `${this.config.backendUrl}/api/runner/checkpoints/${runId}`;

    try {
      const response = await axios.get<{ checkpointData: RunnerCheckpoint }>(url, {
        timeout: 10000,
      });

      return response.data.checkpointData;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save checkpoint to local file
   */
  private async saveToFile(checkpoint: RunnerCheckpoint): Promise<void> {
    const filePath = this.getCheckpointFilePath(checkpoint.runId);
    const content = JSON.stringify(checkpoint, null, 2);

    // Write to temp file first, then rename (atomic operation)
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Load checkpoint from local file
   */
  private async loadFromFile(runId: string): Promise<RunnerCheckpoint | null> {
    const filePath = this.getCheckpointFilePath(runId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as RunnerCheckpoint;
  }

  /**
   * Get file path for checkpoint
   */
  private getCheckpointFilePath(runId: string): string {
    return path.join(this.checkpointDir, `${runId}.checkpoint.json`);
  }

  /**
   * Delete checkpoint (both database and file)
   */
  async delete(runId: string): Promise<void> {
    // Delete from database
    try {
      const url = `${this.config.backendUrl}/api/runner/checkpoints/${runId}`;
      await axios.delete(url, { timeout: 10000 });
      console.log(`[CheckpointService] Deleted checkpoint from database: ${runId}`);
    } catch (error) {
      console.warn(`[CheckpointService] Database delete failed:`, error);
    }

    // Delete file
    try {
      const filePath = this.getCheckpointFilePath(runId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[CheckpointService] Deleted checkpoint file: ${runId}`);
      }
    } catch (error) {
      console.warn(`[CheckpointService] File delete failed:`, error);
    }
  }

  /**
   * List all checkpoints (from files - quick scan)
   */
  listCheckpoints(): string[] {
    if (!fs.existsSync(this.checkpointDir)) {
      return [];
    }

    const files = fs.readdirSync(this.checkpointDir);
    return files
      .filter(f => f.endsWith('.checkpoint.json'))
      .map(f => f.replace('.checkpoint.json', ''));
  }

  /**
   * Get checkpoint age in milliseconds
   */
  async getCheckpointAge(runId: string): Promise<number | null> {
    const checkpoint = await this.load(runId);
    if (!checkpoint) return null;

    const checkpointTime = new Date(checkpoint.checkpointedAt).getTime();
    return Date.now() - checkpointTime;
  }

  /**
   * Clean up old checkpoints
   */
  async cleanupOldCheckpoints(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const runIds = this.listCheckpoints();
    let cleaned = 0;

    for (const runId of runIds) {
      const age = await this.getCheckpointAge(runId);
      if (age && age > maxAgeMs) {
        await this.delete(runId);
        cleaned++;
      }
    }

    console.log(`[CheckpointService] Cleaned up ${cleaned} old checkpoints`);
    return cleaned;
  }
}
