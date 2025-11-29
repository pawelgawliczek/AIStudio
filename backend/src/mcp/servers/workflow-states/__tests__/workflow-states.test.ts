/**
 * Unit Tests for ST-144: Workflow State Management Tools
 */

import { handler as createHandler } from '../create_workflow_state';
import { handler as listHandler } from '../list_workflow_states';
import { handler as updateHandler } from '../update_workflow_state';
import { handler as deleteHandler } from '../delete_workflow_state';
import { handler as reorderHandler } from '../reorder_workflow_states';
import {
  prismaMock,
  resetPrismaMock,
  fixtures,
  createWorkflowStateWithComponent,
  createMultipleStates,
  createStateWithActiveRuns,
} from './test-setup';

describe('ST-144: Workflow State Management Tools', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // =========================================================================
  // CREATE WORKFLOW STATE TESTS
  // =========================================================================
  describe('create_workflow_state', () => {
    it('should create a workflow state successfully', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        name: 'analysis',
        order: 1,
        componentId: fixtures.component.id,
        preExecutionInstructions: 'Read the story',
        requiresApproval: false,
        mandatory: true,
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);
      prismaMock.component.findUnique.mockResolvedValue(fixtures.component as any);
      prismaMock.workflowState.findFirst.mockResolvedValue(null); // No duplicates
      prismaMock.workflowState.create.mockResolvedValue(
        createWorkflowStateWithComponent() as any,
      );

      const result = await createHandler(prismaMock, params);

      expect(result.name).toBe('analysis');
      expect(result.order).toBe(1);
      expect(result.requiresApproval).toBe(false);
      expect(result.mandatory).toBe(true);
    });

    it('should throw error for non-existent workflow', async () => {
      const params = {
        workflowId: 'non-existent',
        name: 'test',
        order: 1,
      };

      prismaMock.workflow.findUnique.mockResolvedValue(null);

      await expect(createHandler(prismaMock, params)).rejects.toThrow(
        'Workflow with ID non-existent not found',
      );
    });

    it('should throw error for duplicate name in workflow', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        name: 'analysis',
        order: 2,
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);
      prismaMock.workflowState.findFirst.mockResolvedValueOnce(
        fixtures.workflowState as any,
      ); // Name exists

      await expect(createHandler(prismaMock, params)).rejects.toThrow(
        'State with name "analysis" already exists',
      );
    });

    it('should throw error for duplicate order in workflow', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        name: 'new-state',
        order: 1, // Same as existing
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);
      prismaMock.workflowState.findFirst
        .mockResolvedValueOnce(null) // No name duplicate
        .mockResolvedValueOnce(fixtures.workflowState as any); // Order exists

      await expect(createHandler(prismaMock, params)).rejects.toThrow(
        'State with order 1 already exists',
      );
    });

    it('should throw error for invalid order (negative)', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        name: 'test',
        order: -1, // Invalid: must be >= 1
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);

      await expect(createHandler(prismaMock, params)).rejects.toThrow(
        'Order must be a positive integer',
      );
    });

    it('should throw error for non-existent component', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        name: 'test',
        order: 1,
        componentId: 'non-existent',
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);
      prismaMock.component.findUnique.mockResolvedValue(null);

      await expect(createHandler(prismaMock, params)).rejects.toThrow(
        'Component with ID non-existent not found',
      );
    });
  });

  // =========================================================================
  // LIST WORKFLOW STATES TESTS
  // =========================================================================
  describe('list_workflow_states', () => {
    it('should list states ordered by execution order', async () => {
      const params = { workflowId: fixtures.workflow.id };
      const states = createMultipleStates();

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);
      prismaMock.workflowState.count.mockResolvedValue(3);
      prismaMock.workflowState.findMany.mockResolvedValue(states as any);

      const result = await listHandler(prismaMock, params);

      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.data[0].order).toBe(1);
      expect(result.data[1].order).toBe(2);
      expect(result.data[2].order).toBe(3);
    });

    it('should throw error for non-existent workflow', async () => {
      const params = { workflowId: 'non-existent' };

      prismaMock.workflow.findUnique.mockResolvedValue(null);

      await expect(listHandler(prismaMock, params)).rejects.toThrow(
        'Workflow with ID non-existent not found',
      );
    });

    it('should support pagination', async () => {
      const params = { workflowId: fixtures.workflow.id, page: 2, pageSize: 1 };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);
      prismaMock.workflowState.count.mockResolvedValue(3);
      prismaMock.workflowState.findMany.mockResolvedValue([
        fixtures.workflowStateSecond,
      ] as any);

      const result = await listHandler(prismaMock, params);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(1);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });
  });

  // =========================================================================
  // UPDATE WORKFLOW STATE TESTS
  // =========================================================================
  describe('update_workflow_state', () => {
    it('should update state fields successfully', async () => {
      const params = {
        workflowStateId: fixtures.workflowState.id,
        name: 'updated-analysis',
        requiresApproval: true,
      };

      prismaMock.workflowState.findUnique.mockResolvedValue(
        fixtures.workflowState as any,
      );
      prismaMock.workflowState.findFirst.mockResolvedValue(null); // No duplicates
      prismaMock.workflowState.update.mockResolvedValue({
        ...fixtures.workflowState,
        name: 'updated-analysis',
        requiresApproval: true,
      } as any);

      const result = await updateHandler(prismaMock, params);

      expect(result.name).toBe('updated-analysis');
      expect(result.requiresApproval).toBe(true);
    });

    it('should throw error for non-existent state', async () => {
      const params = {
        workflowStateId: 'non-existent',
        name: 'test',
      };

      prismaMock.workflowState.findUnique.mockResolvedValue(null);

      await expect(updateHandler(prismaMock, params)).rejects.toThrow(
        'WorkflowState with ID non-existent not found',
      );
    });

    it('should throw error for duplicate name on update', async () => {
      const params = {
        workflowStateId: fixtures.workflowState.id,
        name: 'implementation', // Already exists in workflow
      };

      prismaMock.workflowState.findUnique.mockResolvedValue(
        fixtures.workflowState as any,
      );
      prismaMock.workflowState.findFirst.mockResolvedValue(
        fixtures.workflowStateSecond as any,
      ); // Name exists

      await expect(updateHandler(prismaMock, params)).rejects.toThrow(
        'State with name "implementation" already exists',
      );
    });

    it('should allow setting componentId to null', async () => {
      const params = {
        workflowStateId: fixtures.workflowState.id,
        componentId: null, // Clear component
      };

      prismaMock.workflowState.findUnique.mockResolvedValue(
        fixtures.workflowState as any,
      );
      prismaMock.workflowState.update.mockResolvedValue({
        ...fixtures.workflowState,
        componentId: null,
      } as any);

      const result = await updateHandler(prismaMock, params);

      expect(result.componentId).toBeUndefined();
    });
  });

  // =========================================================================
  // DELETE WORKFLOW STATE TESTS
  // =========================================================================
  describe('delete_workflow_state', () => {
    it('should delete state and normalize orders', async () => {
      const params = {
        workflowStateId: fixtures.workflowState.id,
        confirm: true,
      };

      const stateWithCounts = {
        ...fixtures.workflowState,
        _count: { breakpointsAtState: 0, workflowRunsAtState: 0 },
      };

      prismaMock.workflowState.findUnique.mockResolvedValue(stateWithCounts as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        // Mock transaction execution
        return fn({
          runnerBreakpoint: { deleteMany: jest.fn() },
          workflowState: {
            delete: jest.fn(),
            findMany: jest.fn().mockResolvedValue([
              fixtures.workflowStateSecond,
              fixtures.workflowStateThird,
            ]),
            update: jest.fn(),
          },
        });
      });

      const result = await deleteHandler(prismaMock, params);

      expect(result.id).toBe(fixtures.workflowState.id);
      expect(result.name).toBe('analysis');
      expect(result.cascadeDeleted.breakpoints).toBe(0);
    });

    it('should throw error if confirm is missing', async () => {
      const params = {
        workflowStateId: fixtures.workflowState.id,
        // confirm not provided
      } as any;

      await expect(deleteHandler(prismaMock, params)).rejects.toThrow(
        'Missing required fields: confirm',
      );
    });

    it('should block deletion if workflow runs are at this state', async () => {
      const params = {
        workflowStateId: fixtures.workflowState.id,
        confirm: true,
      };

      prismaMock.workflowState.findUnique.mockResolvedValue(
        createStateWithActiveRuns() as any,
      );

      await expect(deleteHandler(prismaMock, params)).rejects.toThrow(
        'Cannot delete state "analysis": 2 workflow run(s) are currently at this state',
      );
    });

    it('should throw error for non-existent state', async () => {
      const params = {
        workflowStateId: 'non-existent',
        confirm: true,
      };

      prismaMock.workflowState.findUnique.mockResolvedValue(null);

      await expect(deleteHandler(prismaMock, params)).rejects.toThrow(
        'WorkflowState with ID non-existent not found',
      );
    });
  });

  // =========================================================================
  // REORDER WORKFLOW STATES TESTS
  // =========================================================================
  describe('reorder_workflow_states', () => {
    it('should reorder states successfully', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        stateOrder: [
          { stateId: fixtures.workflowState.id, newOrder: 3 },
          { stateId: fixtures.workflowStateSecond.id, newOrder: 1 },
          { stateId: fixtures.workflowStateThird.id, newOrder: 2 },
        ],
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);
      prismaMock.workflowState.findMany.mockResolvedValue(
        createMultipleStates() as any,
      );
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          workflowState: {
            update: jest.fn(),
            findMany: jest.fn().mockResolvedValue([
              { ...fixtures.workflowStateSecond, order: 1 },
              { ...fixtures.workflowStateThird, order: 2 },
              { ...fixtures.workflowState, order: 3 },
            ]),
          },
        });
      });

      const result = await reorderHandler(prismaMock, params);

      expect(result.success).toBe(true);
      expect(result.reorderedCount).toBe(3);
      expect(result.states[0].order).toBe(1);
    });

    it('should throw error for non-existent workflow', async () => {
      const params = {
        workflowId: 'non-existent',
        stateOrder: [{ stateId: 'state-1', newOrder: 1 }],
      };

      prismaMock.workflow.findUnique.mockResolvedValue(null);

      await expect(reorderHandler(prismaMock, params)).rejects.toThrow(
        'Workflow with ID non-existent not found',
      );
    });

    it('should throw error for duplicate orders', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        stateOrder: [
          { stateId: fixtures.workflowState.id, newOrder: 1 },
          { stateId: fixtures.workflowStateSecond.id, newOrder: 1 }, // Duplicate!
        ],
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);

      await expect(reorderHandler(prismaMock, params)).rejects.toThrow(
        'Duplicate orders detected',
      );
    });

    it('should throw error for invalid order (negative)', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        stateOrder: [{ stateId: fixtures.workflowState.id, newOrder: -1 }],
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);

      await expect(reorderHandler(prismaMock, params)).rejects.toThrow(
        'must be a positive integer',
      );
    });

    it('should throw error for states not belonging to workflow', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        stateOrder: [
          { stateId: fixtures.workflowState.id, newOrder: 1 },
          { stateId: 'foreign-state', newOrder: 2 }, // Not in workflow
        ],
      };

      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflow as any);
      prismaMock.workflowState.findMany.mockResolvedValue([
        fixtures.workflowState,
      ] as any); // Only one found

      await expect(reorderHandler(prismaMock, params)).rejects.toThrow(
        'States not found or do not belong to this workflow',
      );
    });

    it('should throw error for empty stateOrder array', async () => {
      const params = {
        workflowId: fixtures.workflow.id,
        stateOrder: [],
      };

      await expect(reorderHandler(prismaMock, params)).rejects.toThrow(
        'stateOrder must be a non-empty array',
      );
    });
  });
});
