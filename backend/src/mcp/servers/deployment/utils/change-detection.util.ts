/**
 * Change Detection Utilities for Deployment
 *
 * Detects changes between worktree and main branch for:
 * - Schema migrations
 * - Dependencies (package.json, package-lock.json)
 * - Environment variables (.env)
 * - Docker configuration (Dockerfiles, docker-compose.yml)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { handler as detectSchemaChangesHandler } from '../../git/detect_schema_changes.js';

export interface DetectedChanges {
  schema: boolean;
  dependencies: boolean;
  environment: boolean;
  docker: boolean;
  schemaDetails?: SchemaChangeDetails;
  envDetails?: EnvChanges;
}

export interface SchemaChangeDetails {
  hasChanges: boolean;
  isBreaking: boolean;
  migrationCount: number;
  schemaVersion: string | null;
  migrationFiles: Array<{
    name: string;
    timestamp: string;
    isNew: boolean;
    isBreaking: boolean;
  }>;
}

export interface EnvChanges {
  hasChanges: boolean;
  addedVars: string[];
  removedVars: string[];
  modifiedVars: string[];
  missingRequired: string[];
}

/**
 * Detect schema changes by calling detect_schema_changes handler
 */
export async function detectSchemaChanges(
  prisma: PrismaClient,
  storyId: string
): Promise<SchemaChangeDetails> {
  try {
    const result = await detectSchemaChangesHandler(prisma, { storyId });

    return {
      hasChanges: result.hasChanges,
      isBreaking: result.isBreaking,
      migrationCount: result.migrationFiles.length,
      schemaVersion: result.schemaVersion,
      migrationFiles: result.migrationFiles.map(m => ({
        name: m.name,
        timestamp: m.timestamp || '',
        isNew: true, // All migrations from worktree are considered new
        isBreaking: m.isBreaking
      }))
    };
  } catch (error) {
    console.error('Error detecting schema changes:', error);
    throw error;
  }
}

/**
 * Detect dependency changes (package.json, package-lock.json)
 */
export function detectDependencyChanges(
  mainWorktreePath: string,
  branchName: string
): boolean {
  try {
    // Check if package.json or package-lock.json differ between branches
    const files = ['package.json', 'package-lock.json', 'backend/package.json', 'frontend/package.json'];

    for (const file of files) {
      try {
        const diff = execSync(
          `git diff main..${branchName} -- ${file}`,
          { cwd: mainWorktreePath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        if (diff.trim().length > 0) {
          console.log(`Dependency changes detected in ${file}`);
          return true;
        }
      } catch (error) {
        // File may not exist in one of the branches - continue checking
        continue;
      }
    }

    return false;
  } catch (error) {
    console.error('Error detecting dependency changes:', error);
    // If we can't detect changes, assume no changes to avoid unnecessary npm install
    return false;
  }
}

/**
 * Detect environment variable changes
 */
export function detectEnvChanges(
  mainWorktreePath: string,
  worktreePath: string
): EnvChanges {
  const result: EnvChanges = {
    hasChanges: false,
    addedVars: [],
    removedVars: [],
    modifiedVars: [],
    missingRequired: []
  };

  try {
    const mainEnvPath = join(mainWorktreePath, '.env');
    const worktreeEnvPath = join(worktreePath, '.env');

    // If worktree has no .env, no changes
    if (!existsSync(worktreeEnvPath)) {
      return result;
    }

    const mainEnv = existsSync(mainEnvPath)
      ? parseEnvFile(readFileSync(mainEnvPath, 'utf-8'))
      : {};
    const worktreeEnv = parseEnvFile(readFileSync(worktreeEnvPath, 'utf-8'));

    // Find added, removed, and modified variables
    const mainVars = Object.keys(mainEnv);
    const worktreeVars = Object.keys(worktreeEnv);
    const mainVarsSet = new Set(mainVars);
    const worktreeVarsSet = new Set(worktreeVars);

    for (const key of worktreeVars) {
      if (!mainVarsSet.has(key)) {
        result.addedVars.push(key);
        // Check if it's required (no default value in worktree)
        if (!worktreeEnv[key]) {
          result.missingRequired.push(key);
        }
      } else if (mainEnv[key] !== worktreeEnv[key]) {
        result.modifiedVars.push(key);
      }
    }

    for (const key of mainVars) {
      if (!worktreeVarsSet.has(key)) {
        result.removedVars.push(key);
      }
    }

    result.hasChanges =
      result.addedVars.length > 0 ||
      result.removedVars.length > 0 ||
      result.modifiedVars.length > 0;

    return result;
  } catch (error) {
    console.error('Error detecting env changes:', error);
    return result;
  }
}

/**
 * Parse .env file into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  }

  return env;
}

/**
 * Detect Docker configuration changes
 */
export function detectDockerChanges(
  mainWorktreePath: string,
  branchName: string
): boolean {
  try {
    const dockerFiles = [
      'docker-compose.yml',
      'backend/Dockerfile',
      'frontend/Dockerfile',
      'Dockerfile'
    ];

    for (const file of dockerFiles) {
      try {
        const diff = execSync(
          `git diff main..${branchName} -- ${file}`,
          { cwd: mainWorktreePath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        if (diff.trim().length > 0) {
          console.log(`Docker changes detected in ${file}`);
          return true;
        }
      } catch (error) {
        // File may not exist - continue checking
        continue;
      }
    }

    return false;
  } catch (error) {
    console.error('Error detecting Docker changes:', error);
    // If we can't detect changes, assume no changes to avoid unnecessary rebuild
    return false;
  }
}

/**
 * Detect all changes for deployment
 */
export async function detectAllChanges(
  prisma: PrismaClient,
  storyId: string,
  mainWorktreePath: string,
  worktreePath: string,
  branchName: string
): Promise<DetectedChanges> {
  const changes: DetectedChanges = {
    schema: false,
    dependencies: false,
    environment: false,
    docker: false
  };

  // Detect schema changes
  try {
    const schemaDetails = await detectSchemaChanges(prisma, storyId);
    changes.schema = schemaDetails.hasChanges;
    changes.schemaDetails = schemaDetails;
  } catch (error) {
    console.error('Schema detection failed:', error);
    changes.schema = false;
  }

  // Detect dependency changes
  changes.dependencies = detectDependencyChanges(mainWorktreePath, branchName);

  // Detect environment changes
  const envDetails = detectEnvChanges(mainWorktreePath, worktreePath);
  changes.environment = envDetails.hasChanges;
  changes.envDetails = envDetails;

  // Detect Docker changes
  changes.docker = detectDockerChanges(mainWorktreePath, branchName);

  return changes;
}
