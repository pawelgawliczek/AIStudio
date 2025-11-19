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

export interface DeleteStoryParams {
  storyId: string;
  confirm: boolean;
}

export interface DeleteStoryResponse {
  id: string;
  key: string;
  title: string;
  cascadeDeleted: {
    subtasks: number;
    useCaseLinks: number;
    storyFiles: number;
    workflowRuns: number;
    componentRuns: number;
    testCases: number;
  };
}

export interface DeleteEpicParams {
  epicId: string;
  confirm: boolean;
  deleteStories?: boolean;
}

export interface DeleteEpicResponse {
  id: string;
  key: string;
  title: string;
  storiesDeleted: number;
  cascadeDeleted: {
    subtasks: number;
    useCaseLinks: number;
    workflowRuns: number;
    componentRuns: number;
    testCases: number;
  };
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

// ============================================================================
// TEST QUEUE MANAGEMENT TOOLS
// ============================================================================

export interface TestQueueAddParams {
  storyId: string;                // Story UUID (required)
  priority?: number;              // 0-10 scale, default: 5
  submittedBy?: string;           // User/agent ID, default: 'mcp-user'
}

export interface TestQueueAddResponse {
  id: string;                     // Queue entry UUID
  storyId: string;
  storyKey: string;               // For human-readable output
  position: number;               // Absolute position (100, 200, etc.)
  priority: number;
  queuePosition: number;          // Ordinal position (1st, 2nd, 3rd)
  estimatedWaitMinutes: number;   // Based on entries ahead × 5 min
  totalInQueue: number;           // Total pending entries
  status: string;                 // Always 'pending' on add
  message: string;                // Success message
}

export interface TestQueueListParams {
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped';
  limit?: number;                 // Max results, default: 20, max: 100
  offset?: number;                // Pagination offset, default: 0
}

export interface TestQueueEntryResponse {
  id: string;
  storyId: string;
  storyKey?: string;              // Included via join
  storyTitle?: string;            // Included via join
  position: number;
  priority: number;
  status: string;
  submittedBy: string;
  testResults?: any;              // JSONB, only if status = passed/failed
  errorMessage?: string;          // Only if status = failed
  createdAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
}

export interface TestQueueListResponse {
  entries: TestQueueEntryResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface TestQueueGetPositionParams {
  storyId: string;
}

export interface TestQueuePositionResponse {
  id: string;
  storyId: string;
  storyKey: string;
  position: number;               // Absolute position
  queuePosition: number;          // Ordinal position in queue
  priority: number;
  estimatedWaitMinutes: number;
  totalInQueue: number;
  status: string;
}

export interface TestQueueGetStatusParams {
  storyId: string;
}

export interface TestQueueStatusResponse {
  id: string;
  storyId: string;
  storyKey: string;
  storyTitle: string;
  position: number;
  priority: number;
  status: string;
  submittedBy: string;
  testResults?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  queuePosition?: number;         // Only if status = pending
  estimatedWaitMinutes?: number;  // Only if status = pending
}

export interface TestQueueRemoveParams {
  storyId: string;
}

export interface TestQueueRemoveResponse {
  id: string;
  storyId: string;
  storyKey: string;
  previousStatus: string;
  message: string;
}

// ============================================================================
// TEST QUEUE LOCKING TOOLS (ST-43)
// ============================================================================

export interface LockTestQueueParams {
  reason: string;                     // Required: reason for lock (min 10 chars)
  durationMinutes?: number;           // Optional: default 60, range 1-480
  lockedBy?: string;                  // Optional: default 'mcp-user'
  metadata?: Record<string, any>;     // Optional: migration context
}

export interface LockTestQueueResponse {
  id: string;                         // Lock UUID
  reason: string;
  lockedBy: string;
  lockedAt: string;                   // ISO 8601
  expiresAt: string;                  // ISO 8601
  message: string;
}

export interface UnlockTestQueueParams {
  lockId?: string;                    // Optional: unlock specific lock
  force?: boolean;                    // Optional: force unlock (default: false)
}

export interface UnlockTestQueueResponse {
  id: string;
  reason: string;
  duration: string;                   // Human readable (e.g., "45 minutes", "1h 23m")
  message: string;
}

export interface QueueLockStatusResponse {
  isLocked: boolean;
  lock?: {
    id: string;
    reason: string;
    lockedBy: string;
    lockedAt: string;                 // ISO 8601
    expiresAt: string;                // ISO 8601
    expiresIn: string;                // Human readable (e.g., "15 minutes")
    isExpired: boolean;
  };
}

// ============================================================================
// PULL REQUEST MANAGEMENT TOOLS (ST-46)
// ============================================================================

export interface CreatePullRequestParams {
  storyId: string;
  title?: string;
  description?: string;
  draft?: boolean;
  baseBranch?: string;
}

export interface CreatePullRequestResponse {
  success: true;
  prId: string;
  prNumber: number;
  prUrl: string;
  status: string;
  message: string;
}

export interface GetPrStatusParams {
  storyId?: string;
  prNumber?: number;
  prUrl?: string;
  includeComments?: boolean;
  includeReviews?: boolean;
}

export interface ReviewInfo {
  reviewer: string;
  status: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  submittedAt: string;
}

export interface CheckInfo {
  name: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'SKIPPED';
  conclusion: string;
}

export interface GetPrStatusResponse {
  success: true;
  prNumber: number;
  prUrl: string;
  status: string;
  title: string;
  state: string;
  checksStatus: 'PASSING' | 'FAILING' | 'PENDING' | 'NONE';
  approvals: ReviewInfo[];
  ciChecks: CheckInfo[];
  mergeable: boolean;
  conflictStatus: 'NONE' | 'CONFLICTING' | 'UNKNOWN';
  commentCount?: number;
}

export interface MergePullRequestParams {
  storyId?: string;
  prNumber?: number;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  deleteBranch?: boolean;
  requireApproval?: boolean;
  requireChecks?: boolean;
}

export interface MergePullRequestResponse {
  success: true;
  prNumber: number;
  prUrl: string;
  mergeCommitSha: string;
  mergedAt: string;
  branchDeleted: boolean;
  message: string;
}

export interface ClosePullRequestParams {
  storyId?: string;
  prNumber?: number;
  reason?: string;
  comment?: string;
  deleteBranch?: boolean;
}

export interface ClosePullRequestResponse {
  success: true;
  prNumber: number;
  prUrl: string;
  closedAt: string;
  reason?: string;
  branchDeleted: boolean;
  message: string;
}

export interface PullRequestErrorResponse {
  success: false;
  error: 'ValidationError' | 'NotFoundError' | 'MCPError';
  message: string;
  details?: Record<string, any>;
  suggestion: string;
  retryable: boolean;
  errorCode: string;
}
