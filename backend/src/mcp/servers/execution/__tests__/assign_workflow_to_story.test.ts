/**
 * Unit Tests for UC-EXEC-005: Assign Workflow to Story
 */

import { handler } from '../assign_workflow_to_story';
import { prismaMock, fixtures } from './test-setup';

describe('UC-EXEC-005: Assign Workflow - Unit Tests', () => {
  describe('TC-EXEC-005-U1: Validate story and workflow exist', () => {
    it('should throw error when story not found', async () => {
      const params = {
        storyId: 'non-existent-story',
        workflowId: fixtures.workflow.id,
      };

      prismaMock.story.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Story with ID non-existent-story not found'
      );
    });

    it('should throw error when workflow not found', async () => {
      const params = {
        storyId: fixtures.story.id,
        workflowId: 'non-existent-workflow',
      };

      prismaMock.story.findUnique.mockResolvedValue(fixtures.story as any);
      prismaMock.workflow.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        /Workflow.*not found/
      );
    });
  });

  describe('TC-EXEC-005-U2: Prevent assigning inactive workflow', () => {
    it('should throw error for inactive workflow', async () => {
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflowInactive.id,
      };

      prismaMock.story.findUnique.mockResolvedValue(fixtures.story as any);
      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflowInactive as any);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        /Cannot assign inactive workflow/
      );
    });
  });

  describe('TC-EXEC-005-U3: Clear assignment with null workflowId', () => {
    it('should clear assignment when workflowId is null', async () => {
      const params = {
        storyId: fixtures.story.id,
        workflowId: null,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        assignedWorkflowId: fixtures.workflow.id,
      } as any);

      prismaMock.story.update.mockResolvedValue({
        ...fixtures.story,
        assignedWorkflowId: null,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.success).toBe(true);
      expect(result.workflow).toBeNull();
      expect(prismaMock.story.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assignedWorkflowId: null },
        })
      );
    });
  });
});
