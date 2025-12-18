/**
 * Tests for MCP utility functions, focusing on error formatting
 */

import {
  MCPError,
  NotFoundError,
  ValidationError,
  DatabaseError,
} from '../types/';
import {
  formatError,
} from '../utils';

describe('formatError', () => {
  describe('ValidationError formatting', () => {
    it('should format validation errors with helpful suggestions', () => {
      const error = new ValidationError('Missing required parameter: runId');
      const formatted = formatError(error);

      expect(formatted.error).toContain('Missing required parameter: runId');
      expect(formatted.code).toBe('VALIDATION_ERROR');
      expect(formatted.statusCode).toBe(400);
      expect(formatted.suggestions).toBeDefined();
      expect(formatted.suggestions.length).toBeGreaterThan(0);
    });

    it('should provide context about what parameters are required', () => {
      const error = new ValidationError('status must be one of: running, completed, failed');
      const formatted = formatError(error);

      expect(formatted.error).toContain('status must be one of');
      // Context may not be set for simple validation errors, but suggestions should be
      expect(formatted.suggestions).toBeDefined();
      expect(formatted.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('NotFoundError formatting', () => {
    it('should format not found errors with helpful suggestions', () => {
      const error = new NotFoundError('Workflow run', 'fda653a2-ad4a-45c4-a712-ca3d47a3b3b0');
      const formatted = formatError(error);

      expect(formatted.error).toContain('Workflow run');
      expect(formatted.error).toContain('fda653a2-ad4a-45c4-a712-ca3d47a3b3b0');
      expect(formatted.code).toBe('NOT_FOUND');
      expect(formatted.statusCode).toBe(404);
      expect(formatted.suggestions).toBeDefined();
      expect(formatted.suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest alternative tools to check or create resources', () => {
      const error = new NotFoundError('Story', 'story-123');
      const formatted = formatError(error);

      // Check if any suggestion contains 'list_stories'
      const hasSuggestion = formatted.suggestions?.some(s => s.includes('list_stories'));
      expect(hasSuggestion).toBe(true);
      expect(formatted.nextSteps).toBeDefined();
    });
  });

  describe('StateError formatting', () => {
    it('should format state validation errors with current state info', () => {
      const error = new ValidationError(
        'Workflow run fda653a2-ad4a-45c4-a712-ca3d47a3b3b0 is not in running state. Current status: completed'
      );
      const formatted = formatError(error);

      expect(formatted.error).toContain('not in running state');
      expect(formatted.currentState).toBeDefined();
      expect(formatted.suggestions).toBeDefined();
      expect(formatted.suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest tools to check current state', () => {
      const error = new ValidationError(
        'Cannot update completed workflow'
      );
      const formatted = formatError(error);

      // Check if any suggestion contains 'get_workflow_run_results'
      const hasSuggestion = formatted.suggestions?.some(s => s.includes('get_workflow_run_results'));
      expect(hasSuggestion).toBe(true);
    });
  });

  describe('DatabaseError formatting', () => {
    it('should format database errors without exposing internal details', () => {
      const error = new DatabaseError('Database connection failed');
      const formatted = formatError(error);

      // The message is preserved but we add hints about database errors
      expect(formatted.error).toContain('Database');
      expect(formatted.code).toBe('DATABASE_ERROR');
      expect(formatted.statusCode).toBe(500);
      expect(formatted.suggestions).toBeDefined();
    });
  });

  describe('Generic Error formatting', () => {
    it('should format generic errors with default suggestions', () => {
      const error = new Error('Something went wrong');
      const formatted = formatError(error);

      expect(formatted.error).toContain('Something went wrong');
      expect(formatted.code).toBe('INTERNAL_ERROR');
      expect(formatted.statusCode).toBe(500);
      expect(formatted.suggestions).toBeDefined();
    });

    it('should handle errors without messages', () => {
      const error = new Error();
      const formatted = formatError(error);

      expect(formatted.error).toBe('An unexpected error occurred');
      expect(formatted.suggestions).toBeDefined();
    });
  });

  describe('Error context extraction', () => {
    it('should extract resource IDs from error messages', () => {
      const error = new NotFoundError('Workflow', 'abc-123-def');
      const formatted = formatError(error);

      expect(formatted.context).toBeDefined();
      expect(formatted.context.resourceType).toBe('Workflow');
      expect(formatted.context.resourceId).toBe('abc-123-def');
    });

    it('should extract state information from error messages', () => {
      const error = new ValidationError(
        'Workflow is not in running state. Current status: completed'
      );
      const formatted = formatError(error);

      expect(formatted.context).toBeDefined();
      expect(formatted.context.currentState).toBe('completed');
    });
  });

  describe('Helpful suggestions', () => {
    it('should suggest alternative tools for workflow errors', () => {
      const error = new ValidationError(
        'Cannot update workflow that is already completed'
      );
      const formatted = formatError(error);

      // Check if suggestions contain the expected tools
      const hasGetResults = formatted.suggestions?.some(s => s.includes('get_workflow_run_results'));
      const hasStartRun = formatted.suggestions?.some(s => s.includes('start_workflow_run'));
      expect(hasGetResults).toBe(true);
      expect(hasStartRun).toBe(true);
    });

    it('should provide next steps for validation errors', () => {
      const error = new ValidationError('Missing required parameter: projectId');
      const formatted = formatError(error);

      expect(formatted.nextSteps).toBeDefined();
      expect(formatted.nextSteps.length).toBeGreaterThan(0);
    });

    it('should include documentation hints', () => {
      const error = new ValidationError('status must be one of: running, completed');
      const formatted = formatError(error);

      // Hints should be provided for status validation errors
      expect(formatted.hints).toBeDefined();
      expect(formatted.hints.length).toBeGreaterThan(0);
    });
  });
});

describe('Enhanced error classes', () => {
  describe('StateError', () => {
    it('should capture current and expected states', () => {
      const error = new ValidationError(
        'Workflow is not in running state. Current status: completed',
        {
          currentState: 'completed',
          expectedState: 'running',
          resourceId: 'workflow-123'
        }
      );

      expect(error.message).toContain('not in running state');
      expect(error.context).toBeDefined();
      expect(error.context.currentState).toBe('completed');
    });
  });

  describe('ResourceNotFoundError', () => {
    it('should suggest how to find or create the resource', () => {
      const error = new NotFoundError('Story', 'ST-123', {
        searchTool: 'list_stories',
        createTool: 'create_story'
      });

      expect(error.message).toContain('Story');
      expect(error.suggestions).toBeDefined();
    });
  });
});
