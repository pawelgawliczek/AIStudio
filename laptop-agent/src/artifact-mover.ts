/**
 * ST-363: Artifact Mover Service
 *
 * Handles moving story artifact directories when stories are assigned to epics.
 * Moves from docs/ST-XXX/ to docs/EP-YYY/ST-XXX/ or docs/unassigned/ST-XXX/
 *
 * Features:
 * - Safe directory moves with validation
 * - Creates parent directories if needed
 * - Handles both epic assignment and unassignment
 * - Validates paths to prevent directory traversal
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

export interface MoveArtifactRequest {
  storyKey: string;
  epicKey: string | null; // null = move to unassigned
  oldPath: string;
  newPath: string;
}

export interface MoveArtifactResult {
  success: boolean;
  newPath?: string;
  error?: string;
}

export class ArtifactMover {
  private readonly logger = new Logger('ArtifactMover');
  private readonly projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Move story artifact directory from old path to new path
   */
  async moveArtifacts(request: MoveArtifactRequest): Promise<MoveArtifactResult> {
    const { storyKey, epicKey, oldPath, newPath } = request;

    this.logger.info('Moving artifact directory', { storyKey, epicKey, oldPath, newPath });

    try {
      // Validate paths
      const validationError = this.validatePaths(oldPath, newPath, storyKey, epicKey);
      if (validationError) {
        this.logger.error('Path validation failed', { error: validationError });
        return { success: false, error: validationError };
      }

      // Resolve absolute paths
      const absOldPath = path.join(this.projectPath, oldPath);
      const absNewPath = path.join(this.projectPath, newPath);

      // Check if old path exists
      if (!fs.existsSync(absOldPath)) {
        const error = `Source directory does not exist: ${oldPath}`;
        this.logger.warn('Source directory not found', { oldPath });
        return { success: false, error };
      }

      // Check if new path already exists
      if (fs.existsSync(absNewPath)) {
        const error = `Target directory already exists: ${newPath}`;
        this.logger.error('Target directory already exists', { newPath });
        return { success: false, error };
      }

      // Create parent directory if needed
      const parentDir = path.dirname(absNewPath);
      if (!fs.existsSync(parentDir)) {
        this.logger.debug('Creating parent directory', { parentDir });
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Perform the move
      fs.renameSync(absOldPath, absNewPath);

      this.logger.info('Artifact directory moved successfully', {
        storyKey,
        epicKey,
        oldPath,
        newPath,
      });

      return { success: true, newPath };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to move artifact directory', {
        storyKey,
        error: message,
      });
      return { success: false, error: message };
    }
  }

  /**
   * Validate paths to ensure they are safe and follow expected patterns
   */
  private validatePaths(
    oldPath: string,
    newPath: string,
    storyKey: string,
    epicKey: string | null,
  ): string | null {
    // Validate story key format
    if (!/^ST-\d+$/.test(storyKey)) {
      return `Invalid story key format: ${storyKey}`;
    }

    // Validate epic key format if provided
    if (epicKey !== null && !/^EP-\d+$/.test(epicKey)) {
      return `Invalid epic key format: ${epicKey}`;
    }

    // Validate old path is a valid story directory:
    // - docs/ST-XXX (legacy/unassigned)
    // - docs/EP-XXX/ST-YYY (story in epic)
    const directStoryPattern = /^docs\/ST-\d+$/;
    const epicStoryPattern = /^docs\/EP-\d+\/ST-\d+$/;
    if (!directStoryPattern.test(oldPath) && !epicStoryPattern.test(oldPath)) {
      return `Old path must be story directory (docs/ST-XXX or docs/EP-XXX/ST-XXX): ${oldPath}`;
    }

    // Validate old path matches the story key
    if (!oldPath.endsWith(storyKey)) {
      return `Old path does not match story key: ${oldPath} vs ${storyKey}`;
    }

    // Validate new path based on epic assignment
    if (epicKey === null) {
      // Moving to unassigned
      const unassignedPattern = /^docs\/unassigned\/ST-\d+$/;
      if (!unassignedPattern.test(newPath)) {
        return `New path must be unassigned directory (docs/unassigned/ST-XXX): ${newPath}`;
      }
    } else {
      // Moving to epic
      const epicPattern = /^docs\/EP-\d+\/ST-\d+$/;
      if (!epicPattern.test(newPath)) {
        return `New path must be epic directory (docs/EP-XXX/ST-YYY): ${newPath}`;
      }

      // Validate new path contains the epic key
      if (!newPath.includes(epicKey)) {
        return `New path does not contain epic key: ${newPath} vs ${epicKey}`;
      }
    }

    // Validate new path contains the story key
    if (!newPath.endsWith(storyKey)) {
      return `New path does not match story key: ${newPath} vs ${storyKey}`;
    }

    // Check for directory traversal attempts
    if (oldPath.includes('..') || newPath.includes('..')) {
      return 'Directory traversal detected in paths';
    }

    return null; // Valid
  }
}
