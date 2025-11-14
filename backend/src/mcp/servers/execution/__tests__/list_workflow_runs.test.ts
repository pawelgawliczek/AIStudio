/**
 * Unit Tests for UC-EXEC-006: List Workflow Runs
 */

import { handler } from '../list_workflow_runs';
import { prismaMock, fixtures } from './test-setup';

describe('UC-EXEC-006: List Workflow Runs - Unit Tests', () => {
  describe('TC-EXEC-006-U1: Require at least one filter parameter', () => {
    it('should throw error when no filters provided', async () => {
      const params = {};

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'At least one filter is required'
      );
    });

    it('should accept projectId as filter', async () => {
      const params = { projectId: fixtures.project.id };

      prismaMock.workflowRun.count.mockResolvedValue(0);
      prismaMock.workflowRun.findMany.mockResolvedValue([]);

      const result = await handler(prismaMock, params);

      expect(result.success).toBe(true);
    });
  });

  describe('TC-EXEC-006-U2: Filter by status correctly', () => {
    it('should filter runs by status', async () => {
      const params = {
        projectId: fixtures.project.id,
        status: 'failed',
      };

      prismaMock.workflowRun.count.mockResolvedValue(1);
      prismaMock.workflowRun.findMany.mockResolvedValue([
        {
          ...fixtures.workflowRun,
          status: 'failed',
          workflow: fixtures.workflow,
          coordinator: fixtures.coordinator,
          _count: { componentRuns: 5 },
        },
      ] as any);

      const result = await handler(prismaMock, params);

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].status).toBe('failed');
    });
  });

  describe('TC-EXEC-006-U3: Pagination limits enforced', () => {
    it('should limit results to maximum 100', async () => {
      const params = {
        projectId: fixtures.project.id,
        limit: 500, // Requesting 500
      };

      prismaMock.workflowRun.count.mockResolvedValue(500);
      prismaMock.workflowRun.findMany.mockResolvedValue([]);

      await handler(prismaMock, params);

      // Verify findMany was called with limit capped at 100
      expect(prismaMock.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Should be capped
        })
      );
    });
  });
});
