import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Min, Max, IsBoolean, IsObject, IsArray } from 'class-validator';

/**
 * DTO for creating new versions
 */
export class CreateVersionDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  majorVersion?: number;

  @IsOptional()
  @IsString()
  changeDescription?: string;
}

/**
 * DTO for version comparison query parameters
 */
export class CompareVersionsQueryDto {
  @IsString()
  versionId1: string;

  @IsString()
  versionId2: string;
}

/**
 * Response DTOs
 */
export interface ComponentVersionResponse {
  id: string;
  componentId: string;
  versionMajor: number;
  versionMinor: number;
  version: string;
  inputInstructions: string;
  operationInstructions: string;
  outputInstructions: string;
  config: {
    modelId: string;
    temperature: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    timeout?: number;
    maxRetries?: number;
    costLimit?: number;
  };
  tools: string[];
  active: boolean;
  checksum?: string;
  checksumAlgorithm?: string;
  changeDescription?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CoordinatorVersionResponse {
  id: string;
  coordinatorId: string;
  versionMajor: number;
  versionMinor: number;
  version: string;
  coordinatorInstructions: string;
  decisionStrategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
  config: {
    modelId: string;
    temperature: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    timeout?: number;
    maxRetries?: number;
    costLimit?: number;
  };
  tools: string[];
  componentIds?: string[];
  active: boolean;
  checksum?: string;
  checksumAlgorithm?: string;
  changeDescription?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface WorkflowVersionResponse {
  id: string;
  workflowId: string;
  versionMajor: number;
  versionMinor: number;
  version: string;
  coordinatorId: string;
  coordinatorVersion: string;
  triggerConfig: {
    type: string;
    filters?: any;
    notifications?: any;
  };
  active: boolean;
  checksum?: string;
  checksumAlgorithm?: string;
  changeDescription?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  componentVersions?: Array<{
    componentId: string;
    componentName: string;
    version: string;
    versionId: string;
  }>;
}

export interface VersionComparisonResponse {
  entityType: 'component' | 'coordinator' | 'workflow';
  version1: ComponentVersionResponse | CoordinatorVersionResponse | WorkflowVersionResponse;
  version2: ComponentVersionResponse | CoordinatorVersionResponse | WorkflowVersionResponse;
  diff: {
    summary: {
      fieldsAdded: number;
      fieldsRemoved: number;
      fieldsModified: number;
    };
    changes: Array<{
      field: string;
      changeType: 'added' | 'removed' | 'modified';
      oldValue?: any;
      newValue?: any;
      description: string;
    }>;
    impactAnalysis?: {
      breakingChanges: boolean;
      affectedWorkflows?: number;
      recommendation: string;
    };
  };
}

export interface ChecksumVerificationResponse {
  verified: boolean;
  expectedChecksum: string;
  actualChecksum: string;
  algorithm: string;
  verifiedAt: string;
  mismatchDetails?: string;
}
