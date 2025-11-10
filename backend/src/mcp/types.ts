/**
 * MCP Server Type Definitions
 * Types for all MCP tools and their parameters
 */

// ============================================================================
// PROJECT MANAGEMENT TOOLS
// ============================================================================

export interface BootstrapProjectParams {
  name: string;
  description?: string;
  repositoryUrl?: string;
  defaultFramework?: string;
}

export interface CreateProjectParams {
  name: string;
  description?: string;
  repositoryUrl?: string;
}

export interface ListProjectsParams {
  status?: 'active' | 'archived';
}

export interface GetProjectParams {
  projectId: string;
}

// ============================================================================
// EPIC MANAGEMENT TOOLS
// ============================================================================

export interface CreateEpicParams {
  projectId: string;
  title: string;
  description?: string;
  priority?: number;
}

export interface ListEpicsParams {
  projectId: string;
  status?: 'planning' | 'in_progress' | 'done' | 'archived';
}

// ============================================================================
// STORY MANAGEMENT TOOLS
// ============================================================================

export interface CreateStoryParams {
  projectId: string;
  epicId?: string;
  title: string;
  description?: string;
  type?: 'feature' | 'bug' | 'defect' | 'chore' | 'spike';
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
  assignedFrameworkId?: string;
}

export interface ListStoriesParams {
  projectId?: string;
  epicId?: string;
  status?: 'planning' | 'analysis' | 'architecture' | 'design' | 'impl' | 'review' | 'qa' | 'done';
  type?: 'feature' | 'bug' | 'defect' | 'chore' | 'spike';
  assignedToMe?: boolean; // future: filter by current user
}

export interface GetStoryParams {
  storyId: string;
  includeSubtasks?: boolean;
  includeUseCases?: boolean;
  includeCommits?: boolean;
}

export interface UpdateStoryParams {
  storyId: string;
  title?: string;
  description?: string;
  status?: 'planning' | 'analysis' | 'architecture' | 'design' | 'impl' | 'review' | 'qa' | 'done';
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
  assignedFrameworkId?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  repositoryUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  epicCount?: number;
  storyCount?: number;
}

export interface EpicResponse {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  storyCount?: number;
}

export interface StoryResponse {
  id: string;
  projectId: string;
  epicId?: string;
  key: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
  estimatedTokenCost?: number;
  assignedFrameworkId?: string;
  createdAt: string;
  updatedAt: string;
  subtasks?: SubtaskResponse[];
  useCases?: UseCaseResponse[];
  commits?: CommitResponse[];
}

export interface SubtaskResponse {
  id: string;
  storyId: string;
  key?: string;
  title: string;
  description?: string;
  layer?: string;
  component?: string;
  assigneeType: string;
  assigneeId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UseCaseResponse {
  id: string;
  projectId: string;
  key: string;
  title: string;
  area?: string;
  latestVersion?: {
    version: number;
    summary?: string;
    content: string;
  };
}

export interface CommitResponse {
  hash: string;
  author: string;
  timestamp: string;
  message: string;
  files?: {
    filePath: string;
    locAdded: number;
    locDeleted: number;
  }[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class NotFoundError extends MCPError {
  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends MCPError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends MCPError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}
