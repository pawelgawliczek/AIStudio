/**
 * MCP Server Type Definitions
 * Types for all MCP tools and their parameters
 */

// ============================================================================
// TOOL METADATA
// ============================================================================

export interface ToolMetadata {
  category: string;
  domain?: string;
  version?: string;
  since?: string;
  lastUpdated?: string;
  tags?: string[];
  aiHints?: string[];
  dependencies?: string[];
}

// ============================================================================
// PAGINATION SUPPORT (Sprint 4.5)
// ============================================================================

export interface PaginationParams {
  page?: number; // Default: 1
  pageSize?: number; // Default: 20, Max: 100
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

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

export interface ListProjectsParams extends PaginationParams {
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

export interface ListEpicsParams extends PaginationParams {
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

export interface ListStoriesParams extends PaginationParams {
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
  contextExploration?: string;
  baAnalysis?: string;
  designerAnalysis?: string;
  architectAnalysis?: string;
}

// ============================================================================
// LAYER MANAGEMENT TOOLS
// ============================================================================

export interface CreateLayerParams {
  projectId: string;
  name: string;
  description?: string;
  techStack?: string[];
  orderIndex: number;
  color?: string;
  icon?: string;
  status?: 'active' | 'deprecated';
}

export interface UpdateLayerParams {
  layerId: string;
  name?: string;
  description?: string;
  techStack?: string[];
  orderIndex?: number;
  color?: string;
  icon?: string;
  status?: 'active' | 'deprecated';
}

export interface ListLayersParams {
  projectId?: string;
  status?: 'active' | 'deprecated';
}

export interface GetLayerParams {
  layerId: string;
}

// ============================================================================
// COMPONENT MANAGEMENT TOOLS
// ============================================================================

export interface CreateComponentParams {
  projectId: string;
  name: string;
  description?: string;
  ownerId?: string;
  filePatterns?: string[];
  layerIds?: string[];
  color?: string;
  icon?: string;
  status?: 'active' | 'deprecated' | 'planning';
}

export interface UpdateComponentParams {
  componentId: string;
  name?: string;
  description?: string;
  ownerId?: string;
  filePatterns?: string[];
  layerIds?: string[];
  color?: string;
  icon?: string;
  status?: 'active' | 'deprecated' | 'planning';
}

export interface ListComponentsParams {
  projectId?: string;
  status?: 'active' | 'deprecated' | 'planning';
  layerId?: string;
}

export interface GetComponentParams {
  componentId: string;
}

export interface GetComponentUseCasesParams {
  componentId: string;
}

export interface GetComponentStoriesParams {
  componentId: string;
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

export interface LayerResponse {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  techStack: string[];
  orderIndex: number;
  color?: string;
  icon?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  usageCount?: {
    stories: number;
    components: number;
    useCases: number;
    testCases: number;
  };
  components?: Array<{
    id: string;
    name: string;
    icon?: string;
    color?: string;
  }>;
}

export interface ComponentResponse {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  ownerId?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  filePatterns: string[];
  color?: string;
  icon?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  layers?: Array<{
    id: string;
    name: string;
    icon?: string;
    color?: string;
    orderIndex: number;
  }>;
  usageCount?: {
    stories: number;
    useCases: number;
    testCases: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ErrorContext {
  resourceType?: string;
  resourceId?: string;
  currentState?: string;
  expectedState?: string;
  searchTool?: string;
  createTool?: string;
  [key: string]: any;
}

export class MCPError extends Error {
  public context?: ErrorContext;
  public suggestions?: string[];

  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    context?: ErrorContext,
  ) {
    super(message);
    this.name = 'MCPError';
    this.context = context;
  }
}

export class NotFoundError extends MCPError {
  constructor(resource: string, id: string, context?: ErrorContext) {
    const enhancedContext = {
      ...context,
      resourceType: resource,
      resourceId: id,
    };
    super(`${resource} with ID ${id} not found`, 'NOT_FOUND', 404, enhancedContext);
    this.name = 'NotFoundError';

    // Add suggestions based on context or resource type
    this.suggestions = [];
    if (context?.searchTool) {
      this.suggestions.push(`Use ${context.searchTool} to search for existing ${resource}s`);
    }
    if (context?.createTool) {
      this.suggestions.push(`Use ${context.createTool} to create a new ${resource}`);
    }
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends MCPError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'DATABASE_ERROR', 500, context);
    this.name = 'DatabaseError';
  }
}
