/**
 * MCP Server Utility Functions
 */

import { PrismaClient } from '@prisma/client';
import {
  MCPError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  ProjectResponse,
  EpicResponse,
  StoryResponse,
  WorkflowStateResponse,
} from './types';

/**
 * Format project for MCP response
 */
export function formatProject(project: any, includeCounts = false): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    repositoryUrl: project.repositoryUrl,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    ...(includeCounts && {
      epicCount: project._count?.epics || 0,
      storyCount: project._count?.stories || 0,
    }),
  };
}

/**
 * Format epic for MCP response
 */
export function formatEpic(epic: any, includeStoryCount = false): EpicResponse {
  return {
    id: epic.id,
    projectId: epic.projectId,
    key: epic.key,
    title: epic.title,
    description: epic.description,
    status: epic.status,
    priority: epic.priority,
    createdAt: epic.createdAt.toISOString(),
    updatedAt: epic.updatedAt.toISOString(),
    ...(includeStoryCount && {
      storyCount: epic._count?.stories || 0,
    }),
  };
}

/**
 * Format story for MCP response
 */
export function formatStory(story: any, includeRelations = false): StoryResponse {
  const formatted: StoryResponse = {
    id: story.id,
    projectId: story.projectId,
    epicId: story.epicId,
    key: story.key,
    type: story.type,
    title: story.title,
    description: story.description,
    status: story.status,
    businessImpact: story.businessImpact,
    businessComplexity: story.businessComplexity,
    technicalComplexity: story.technicalComplexity,
    estimatedTokenCost: story.estimatedTokenCost,
    assignedFrameworkId: story.assignedFrameworkId,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  };

  if (includeRelations) {
    if (story.subtasks) {
      formatted.subtasks = story.subtasks.map((subtask: any) => ({
        id: subtask.id,
        storyId: subtask.storyId,
        key: subtask.key,
        title: subtask.title,
        description: subtask.description,
        layer: subtask.layer,
        component: subtask.component,
        assigneeType: subtask.assigneeType,
        assigneeId: subtask.assigneeId,
        status: subtask.status,
        createdAt: subtask.createdAt.toISOString(),
        updatedAt: subtask.updatedAt.toISOString(),
      }));
    }

    if (story.useCaseLinks) {
      formatted.useCases = story.useCaseLinks.map((link: any) => ({
        id: link.useCase.id,
        projectId: link.useCase.projectId,
        key: link.useCase.key,
        title: link.useCase.title,
        area: link.useCase.area,
        latestVersion: link.useCase.versions?.[0]
          ? {
              version: link.useCase.versions[0].version,
              summary: link.useCase.versions[0].summary,
              content: link.useCase.versions[0].content,
            }
          : undefined,
      }));
    }

    if (story.commits) {
      formatted.commits = story.commits.map((commit: any) => ({
        hash: commit.hash,
        author: commit.author,
        timestamp: commit.timestamp.toISOString(),
        message: commit.message,
        files: commit.files?.map((file: any) => ({
          filePath: file.filePath,
          locAdded: file.locAdded,
          locDeleted: file.locDeleted,
        })),
      }));
    }
  }

  return formatted;
}

/**
 * Generate next key for entity (e.g., EP-1, ST-42)
 */
export async function generateNextKey(
  prisma: PrismaClient,
  type: 'epic' | 'story',
  projectId: string,
): Promise<string> {
  const prefix = type === 'epic' ? 'EP' : 'ST';

  // Find the highest existing key number
  const entities =
    type === 'epic'
      ? await prisma.epic.findMany({
          where: { projectId },
          select: { key: true },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.story.findMany({
          where: { projectId },
          select: { key: true },
          orderBy: { createdAt: 'desc' },
        });

  let maxNumber = 0;
  for (const entity of entities) {
    const match = entity.key.match(/^[A-Z]+-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return `${prefix}-${maxNumber + 1}`;
}

/**
 * Validate required parameters
 */
export function validateRequired(params: any, required: string[]): void {
  const missing = required.filter((field) => !params[field]);
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Handle Prisma errors and convert to MCPError
 */
export function handlePrismaError(error: any, operation: string): never {
  console.error(`Prisma error during ${operation}:`, error);

  // Check if error is already an MCPError before wrapping
  if (error.name === 'MCPError' || error instanceof MCPError) {
    throw error;  // Already wrapped, re-throw as-is
  }

  if (error.code === 'P2002') {
    throw new ValidationError(
      `A record with this ${error.meta?.target || 'field'} already exists`,
    );
  }

  if (error.code === 'P2003') {
    throw new ValidationError('Referenced record does not exist');
  }

  if (error.code === 'P2025') {
    throw new NotFoundError('Record', 'unknown');
  }

  throw new DatabaseError(`Database error during ${operation}: ${error.message}`);
}

/**
 * Get the default user ID (for MVP, we'll use a system user)
 * In production, this would come from authentication context
 */
export async function getSystemUserId(prisma: PrismaClient): Promise<string> {
  // Find or create a system user
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@aistudio.local' },
  });

  if (!systemUser) {
    // Create system user if it doesn't exist
    systemUser = await prisma.user.create({
      data: {
        email: 'system@aistudio.local',
        name: 'System User',
        password: 'not-used', // System user doesn't need a real password
        role: 'admin',
      },
    });
  }

  return systemUser.id;
}

/**
 * Safely parse JSON or return default
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * Enhanced error response interface
 */
export interface EnhancedErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  context?: {
    resourceType?: string;
    resourceId?: string;
    currentState?: string;
    expectedState?: string;
    [key: string]: any;
  };
  suggestions?: string[];
  nextSteps?: string[];
  hints?: string[];
  currentState?: string;
}

/**
 * Extract context information from error message
 */
function extractErrorContext(message: string): Partial<EnhancedErrorResponse['context']> {
  const context: Partial<EnhancedErrorResponse['context']> = {};

  // Extract current state from patterns like "Current status: completed"
  const stateMatch = message.match(/Current status: (\w+)/i);
  if (stateMatch) {
    context.currentState = stateMatch[1];
  }

  return context;
}

/**
 * Generate helpful suggestions based on error type and message
 */
function generateSuggestions(error: any): string[] {
  const suggestions: string[] = [];
  const message = error.message?.toLowerCase() || '';

  // Workflow-related errors
  if (message.includes('workflow')) {
    if (message.includes('not found')) {
      suggestions.push('Use list_workflows to see all available workflows');
      suggestions.push('Check that the workflow ID is correct');
    } else if (message.includes('completed') || message.includes('not in running state')) {
      suggestions.push('Use get_workflow_run_results to check the workflow status');
      suggestions.push('Use start_workflow_run to start a new workflow execution');
    } else if (message.includes('already')) {
      suggestions.push('Check the current workflow state with get_workflow_run_results');
    }
  }

  // Story-related errors
  if (message.includes('story') && message.includes('not found')) {
    suggestions.push('Use search_stories to find the story');
    suggestions.push('Use list_stories to see all stories in the project');
    suggestions.push('Use create_story to create a new story');
  }

  // Project-related errors
  if (message.includes('project') && message.includes('not found')) {
    suggestions.push('Use list_projects to see all available projects');
    suggestions.push('Use create_project to create a new project');
  }

  // Validation errors - missing parameters
  if (message.includes('missing') || message.includes('required')) {
    suggestions.push('Check the tool documentation for required parameters');
    suggestions.push('Ensure all required fields are provided in the correct format');
  }

  // State-related errors
  if (message.includes('state') || message.includes('status')) {
    suggestions.push('Verify the resource exists and is in the correct state');
    suggestions.push('Check the tool documentation for valid state transitions');
  }

  return suggestions;
}

/**
 * Generate next steps based on error type
 */
function generateNextSteps(error: any): string[] {
  const nextSteps: string[] = [];
  const message = error.message?.toLowerCase() || '';

  if (message.includes('not found')) {
    nextSteps.push('Verify the resource ID is correct');
    nextSteps.push('Check if the resource was created successfully');
    nextSteps.push('Search for the resource using the appropriate search tool');
  }

  if (message.includes('missing') || message.includes('required')) {
    nextSteps.push('Review the tool documentation for required parameters');
    nextSteps.push('Check that all required fields are included in your request');
  }

  if (message.includes('state') || message.includes('status') || message.includes('completed')) {
    nextSteps.push('Check the current state of the resource');
    nextSteps.push('Ensure the resource is in the correct state for this operation');
  }

  return nextSteps;
}

/**
 * Generate helpful hints
 */
function generateHints(error: any): string[] {
  const hints: string[] = [];
  const message = error.message?.toLowerCase() || '';

  if (message.includes('validation')) {
    hints.push('Validation errors indicate that the request parameters are incorrect or incomplete');
  }

  if (message.includes('status') && message.includes('must be one of')) {
    hints.push('Check the allowed values in the tool schema');
  }

  if (message.includes('database')) {
    hints.push('Database errors may indicate data inconsistency or connection issues');
  }

  return hints;
}

/**
 * Format error for MCP response with enhanced error reporting
 */
export function formatError(error: any): EnhancedErrorResponse {
  const response: EnhancedErrorResponse = {
    error: error.message || 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };

  // Handle MCPError and its subclasses
  if (error instanceof MCPError) {
    response.error = error.message;
    response.code = error.code;
    response.statusCode = error.statusCode;

    // Include context if available
    if (error.context) {
      response.context = error.context;
    }

    // Include suggestions from error if available
    if (error.suggestions && error.suggestions.length > 0) {
      response.suggestions = error.suggestions;
    }
  }

  // Extract context from error message
  const extractedContext = extractErrorContext(response.error);
  if (Object.keys(extractedContext).length > 0) {
    response.context = { ...response.context, ...extractedContext };

    // Also set currentState at top level for backward compatibility
    if (extractedContext.currentState) {
      response.currentState = extractedContext.currentState;
    }
  }

  // Generate suggestions if not already provided
  if (!response.suggestions || response.suggestions.length === 0) {
    response.suggestions = generateSuggestions(error);
  }

  // Add next steps
  const nextSteps = generateNextSteps(error);
  if (nextSteps.length > 0) {
    response.nextSteps = nextSteps;
  }

  // Add hints
  const hints = generateHints(error);
  if (hints.length > 0) {
    response.hints = hints;
  }

  return response;
}

/**
 * Format workflow state for MCP response
 */
export function formatWorkflowState(
  state: any,
  includeComponent = false,
): WorkflowStateResponse {
  const formatted: WorkflowStateResponse = {
    id: state.id,
    workflowId: state.workflowId,
    name: state.name,
    order: state.order,
    componentId: state.componentId || undefined,
    preExecutionInstructions: state.preExecutionInstructions || undefined,
    postExecutionInstructions: state.postExecutionInstructions || undefined,
    requiresApproval: state.requiresApproval,
    mandatory: state.mandatory,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
  };

  if (includeComponent && state.component) {
    formatted.component = {
      id: state.component.id,
      name: state.component.name,
      description: state.component.description || undefined,
    };
  }

  return formatted;
}
