/**
 * Unit Tests for UC-EXEC-002: Execute Epic with Workflow
 */

import { handler } from '../execute_epic_with_workflow';
import { prismaMock, fixtures, createEpicWithStories } from './test-setup';

describe('UC-EXEC-002: Execute Epic with Workflow - Unit Tests', () => {
  describe('TC-EXEC-002-U1: Validate epic exists', () => {
    it('should throw error when epic does not exist', async () => {
      const params = {
        epicId: 'non-existent-epic',
        workflowId: fixtures.workflow.id,
      };

      prismaMock.epic.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Epic with ID non-existent-epic not found'
      );
    });
  });

  describe('TC-EXEC-002-U2: Filter stories by status correctly', () => {
    it('should filter stories by provided status array', async () => {
      const { epic, stories } = createEpicWithStories(5);
      const params = {
        epicId: epic.id,
        workflowId: fixtures.workflow.id,
        storyStatus: ['planning', 'analysis'],
      };

      prismaMock.epic.findUnique.mockResolvedValue(epic as any);
      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        active: true,
      } as any);

      const filteredStories = stories.filter(s =>
        ['planning', 'analysis'].includes(s.status)
      );
      prismaMock.story.findMany.mockResolvedValue(filteredStories as any);

      await handler(prismaMock, params);

      expect(prismaMock.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['planning', 'analysis'] },
          }),
        })
      );
    });
  });

  describe('TC-EXEC-002-U3: AbortOnError stops sequential execution', () => {
    it('should mark remaining stories as skipped after first failure', async () => {
      const { epic, stories } = createEpicWithStories(3);
      const params = {
        epicId: epic.id,
        workflowId: fixtures.workflow.id,
        mode: 'sequential',
        abortOnError: true,
      };

      prismaMock.epic.findUnique.mockResolvedValue(epic as any);
      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        active: true,
      } as any);
      prismaMock.story.findMany.mockResolvedValue(stories as any);

      const result = await handler(prismaMock, params);

      expect(result.summary.skipped).toBeGreaterThan(0);
    });
  });
});
