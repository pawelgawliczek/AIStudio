/**
 * Unit Tests for UC-EXEC-003: Query Workflow Execution Results
 */

import { handler } from '../get_workflow_run_results';
import { prismaMock, fixtures } from './test-setup';

describe('UC-EXEC-003: Query Workflow Results - Unit Tests', () => {
  describe('TC-EXEC-003-U1: Return error for non-existent runId', () => {
    it('should throw error when workflow run not found', async () => {
      const params = { runId: 'non-existent-run' };

      prismaMock.workflowRun.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Workflow run with ID non-existent-run not found'
      );
    });
  });

  describe('TC-EXEC-003-U2: Calculate progress percentage correctly', () => {
    it('should calculate 60% for 3/5 components completed', async () => {
      const params = { runId: fixtures.workflowRun.id };

      const mockComponentRuns = [
        { ...fixtures.componentRun, id: '1', status: 'completed', component: fixtures.component },
        { ...fixtures.componentRun, id: '2', status: 'completed', component: fixtures.component },
        { ...fixtures.componentRun, id: '3', status: 'completed', component: fixtures.component },
        { ...fixtures.componentRun, id: '4', status: 'running', component: fixtures.component },
        { ...fixtures.componentRun, id: '5', status: 'pending', component: fixtures.component },
      ];

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        componentRuns: mockComponentRuns,
        workflow: fixtures.workflow,
        coordinator: fixtures.coordinator,
        story: fixtures.story,
        epic: fixtures.epic,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.run.progress.componentsCompleted).toBe(3);
      expect(result.run.progress.componentsTotal).toBe(5);
      expect(result.run.progress.percentComplete).toBe(60);
    });
  });
});
