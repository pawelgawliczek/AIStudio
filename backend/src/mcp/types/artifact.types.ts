/**
 * Artifact Management Type Definitions
 */

import { PaginationParams } from './common.types';

export type ArtifactType =
  | 'markdown'
  | 'json'
  | 'code'
  | 'report'
  | 'image'
  | 'other';
export type ArtifactAccessType = 'read' | 'write' | 'required';

// --- Artifact Definition CRUD ---

export interface CreateArtifactDefinitionParams {
  workflowId: string;
  name: string;
  key: string;
  description?: string;
  type: ArtifactType;
  schema?: Record<string, unknown>; // JSON Schema for validation
  isMandatory?: boolean;
}

export interface UpdateArtifactDefinitionParams {
  definitionId: string;
  name?: string;
  description?: string;
  type?: ArtifactType;
  schema?: Record<string, unknown> | null; // null to clear
  isMandatory?: boolean;
}

export interface DeleteArtifactDefinitionParams {
  definitionId: string;
  confirm: boolean;
}

export interface ListArtifactDefinitionsParams extends PaginationParams {
  workflowId: string;
}

export interface ArtifactDefinitionResponse {
  id: string;
  workflowId: string;
  name: string;
  key: string;
  description?: string;
  type: string;
  schema?: Record<string, unknown>;
  isMandatory: boolean;
  createdAt: string;
  updatedAt: string;
  accessRules?: ArtifactAccessResponse[];
  artifactCount?: number;
}

// --- Artifact Access Control ---

export interface SetArtifactAccessParams {
  definitionId?: string;
  definitionKey?: string; // Alternative: look up by key
  workflowId?: string; // Required if using definitionKey
  stateId: string;
  accessType: ArtifactAccessType;
}

export interface RemoveArtifactAccessParams {
  definitionId?: string;
  definitionKey?: string;
  workflowId?: string;
  stateId: string;
}

export interface ArtifactAccessResponse {
  id: string;
  definitionId: string;
  stateId: string;
  accessType: string;
  createdAt: string;
  state?: {
    id: string;
    name: string;
    order: number;
  };
  definition?: {
    id: string;
    name: string;
    key: string;
  };
}

// --- Artifact Content ---

export interface UploadArtifactParams {
  definitionId?: string;
  definitionKey?: string;
  storyId?: string; // ST-214: Direct story-scoped upload
  workflowRunId?: string; // Now optional - can derive storyId from run
  content: string;
  contentType?: string;
  componentId?: string;
}

export interface UploadArtifactFromFileParams {
  filePath: string; // Absolute path (must be in ~/.claude/projects/)
  definitionId?: string; // Artifact Definition UUID
  definitionKey?: string; // Artifact key (e.g., "THE_PLAN")
  workflowRunId: string; // Required
  componentId?: string; // Optional creator
  maxFileSize?: number; // Optional override (max 2MB)
}

export interface UploadArtifactFromFileResponse {
  success: boolean;
  artifact?: ArtifactResponse; // Present if upload succeeded
  agentOffline?: boolean; // True if laptop agent unavailable
  fallbackCommand?: string; // Manual command if agent offline
  message: string; // Human-readable status
}

export interface UploadArtifactFromBinaryFileParams {
  filePath: string; // Absolute path to binary file
  definitionId?: string; // Artifact Definition UUID
  definitionKey?: string; // Artifact key (e.g., "SCREENSHOT", "DIAGRAM")
  workflowRunId: string; // Required
  componentId?: string; // Optional creator
  maxFileSize?: number; // Optional override (max 5MB for binary)
  contentType?: string; // Optional MIME type override (auto-detected from extension)
}

export interface UploadArtifactFromBinaryFileResponse {
  success: boolean;
  artifact?: ArtifactResponse; // Present if upload succeeded
  agentOffline?: boolean; // True if laptop agent unavailable
  fallbackCommand?: string; // Manual command if agent offline
  message: string; // Human-readable status
  metadata?: {
    originalSize: number;
    base64Size: number;
    detectedMimeType?: string;
  };
}

export interface GetArtifactParams {
  artifactId?: string;
  definitionKey?: string;
  storyId?: string; // ST-214: Story-scoped lookup
  workflowRunId?: string; // Backward compat - derives storyId
  version?: number; // ST-214: Fetch specific version from history
  includeContent?: boolean;
}

export interface ListArtifactsParams extends PaginationParams {
  storyId?: string; // ST-214: List by story
  workflowRunId?: string; // Backward compat - derives storyId
  definitionKey?: string;
  type?: ArtifactType;
  includeContent?: boolean;
  includeVersionCounts?: boolean; // ST-214: Include version history counts
}

export interface ArtifactResponse {
  id: string;
  definitionId: string;
  storyId: string; // ST-214: Now required
  workflowRunId?: string; // ST-214: Now optional
  content: string;
  contentType: string;
  size: number;
  currentVersion: number; // ST-214: Renamed from version
  lastUpdatedRunId?: string; // ST-214: Track which run last modified
  contentHash?: string; // ST-214: For deduplication
  createdByComponentId?: string;
  createdAt: string;
  updatedAt: string;
  definition?: {
    id: string;
    name: string;
    key: string;
    type: string;
  };
  createdByComponent?: {
    id: string;
    name: string;
  };
  versionCount?: number; // ST-214: Number of versions when includeVersionCounts
}

export interface DeleteArtifactDefinitionResponse {
  id: string;
  key: string;
  name: string;
  cascadeDeleted: {
    artifacts: number;
    accessRules: number;
  };
  message: string;
}
