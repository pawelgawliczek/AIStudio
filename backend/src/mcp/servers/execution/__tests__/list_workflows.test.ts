/**
 * Unit Tests for UC-EXEC-004: List Workflows
 */

import { handler } from '../list_workflows';
import { prismaMock, fixtures } from './test-setup';

describe('UC-EXEC-004: List Workflows - Unit Tests', () => {
  describe('TC-EXEC-004-U1: Filter workflows by active status', () => {
    it('should return only active workflows by default', async () => {
      const params = { projectId: fixtures.project.id };

      prismaMock.project.findUnique.mockResolvedValue(fixtures.project as any);

      const workflows = [
        {
          ...fixtures.workflow,
          active: true,
          coordinator: {
            ...fixtures.coordinator,
            componentIds: ['comp-1', 'comp-2'],
          },
          _count: { workflowRuns: 5, stories: 3 },
        },
      ];

      prismaMock.workflow.findMany.mockResolvedValue(workflows as any);

      prismaMock.component.findMany.mockResolvedValue([
        { id: 'comp-1', name: 'Component 1', description: 'Test component 1' },
        { id: 'comp-2', name: 'Component 2', description: 'Test component 2' },
      ] as any);

      const result = await handler(prismaMock, params);

      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].active).toBe(true);
    });
  });

  describe('TC-EXEC-004-U2: Return error for non-existent project', () => {
    it('should throw error when project not found', async () => {
      const params = { projectId: 'non-existent-project' };

      prismaMock.project.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Project with ID non-existent-project not found'
      );
    });
  });
});
