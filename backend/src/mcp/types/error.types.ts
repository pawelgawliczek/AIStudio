/**
 * Error Type Definitions
 */

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
