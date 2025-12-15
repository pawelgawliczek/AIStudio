/**
 * Unit Tests for UC-EXEC-001: Execute Story with Workflow
 * Tests validation logic and error handling
 */

import { handler } from '../execute_story_with_workflow';
import { prismaMock, fixtures, requiredTranscriptParams } from './test-setup';

describe('UC-EXEC-001: Execute Story with Workflow - Unit Tests', () => {
  describe('TC-EXEC-001-U1: Validate story exists before execution', () => {
    it('should throw error when story does not exist', async () => {
      // Arrange
      const params = {
        storyId: 'non-existent-story',
        workflowId: fixtures.workflow.id,
      };

      prismaMock.story.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Story with ID non-existent-story not found'
      );

      // Verify no WorkflowRun was created
      expect(prismaMock.workflowRun.create).not.toHaveBeenCalled();
    });

    it('should query story with correct parameters', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
      };

      prismaMock.story.findUnique.mockResolvedValue(null);

      // Act
      try {
        await handler(prismaMock, params);
      } catch (e) {
        // Expected to throw
      }

      // Assert
      expect(prismaMock.story.findUnique).toHaveBeenCalledWith({
        where: { id: fixtures.story.id },
        include: {
          project: true,
          epic: true,
        },
      });
    });
  });

  describe('TC-EXEC-001-U2: Validate workflow exists and is active', () => {
    it('should throw error when workflow does not exist', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: 'non-existent-workflow',
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: fixtures.project,
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(handler(prismaMock, params)).rejects.toThrow(
        /Workflow.*not found/
      );
    });

    it('should throw error when workflow is inactive', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflowInactive.id,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: fixtures.project,
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflowInactive,
      } as any);

      // Act & Assert
      await expect(handler(prismaMock, params)).rejects.toThrow(
        /not active/
      );
    });

    it('should accept active workflow', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
        ...requiredTranscriptParams,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: fixtures.project,
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        project: fixtures.project,
        states: [fixtures.workflowState],
      } as any);

      prismaMock.workflowRun.findFirst.mockResolvedValue(null);

      prismaMock.component.findMany.mockResolvedValue([
        { id: 'comp-1', name: 'Component 1', description: 'Test component 1' },
        { id: 'comp-2', name: 'Component 2', description: 'Test component 2' },
      ] as any);

      prismaMock.workflowRun.create.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue(fixtures.workflowRun as any);
      prismaMock.story.update.mockResolvedValue(fixtures.story as any);

      // Act - Should not throw
      const result = await handler(prismaMock, params);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('TC-EXEC-001-U3: Validate story is not in done status', () => {
    it('should throw error when story status is done', async () => {
      // Arrange
      const params = {
        storyId: fixtures.storyDone.id,
        workflowId: fixtures.workflow.id,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.storyDone,
        project: fixtures.project,
        epic: fixtures.epic,
      } as any);

      // Act & Assert
      await expect(handler(prismaMock, params)).rejects.toThrow(
        /Cannot execute workflow on completed story/
      );
    });

    it('should accept story with status planning', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
        ...requiredTranscriptParams,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        status: 'planning',
        project: fixtures.project,
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        project: fixtures.project,
        states: [fixtures.workflowState],
      } as any);

      prismaMock.workflowRun.findFirst.mockResolvedValue(null);

      prismaMock.component.findMany.mockResolvedValue([
        { id: 'comp-1', name: 'Component 1', description: 'Test component 1' },
        { id: 'comp-2', name: 'Component 2', description: 'Test component 2' },
      ] as any);

      prismaMock.workflowRun.create.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue(fixtures.workflowRun as any);
      prismaMock.story.update.mockResolvedValue(fixtures.story as any);

      // Act
      const result = await handler(prismaMock, params);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('TC-EXEC-001-U4: Detect concurrent execution conflicts', () => {
    it('should throw error when story has running execution', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: fixtures.project,
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
      } as any);

      // Mock existing running workflow
      prismaMock.workflowRun.findFirst.mockResolvedValue({
        ...fixtures.workflowRun,
        status: 'running',
      } as any);

      // Act & Assert
      await expect(handler(prismaMock, params)).rejects.toThrow(
        /already has a running workflow execution/
      );

      // Verify error includes runId
      try {
        await handler(prismaMock, params);
      } catch (error: any) {
        expect(error.message).toContain(fixtures.workflowRun.id);
      }
    });

    it('should allow execution when no conflicting run exists', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
        ...requiredTranscriptParams,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: fixtures.project,
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        project: fixtures.project,
        states: [fixtures.workflowState],
      } as any);

      prismaMock.workflowRun.findFirst.mockResolvedValue(null);

      prismaMock.component.findMany.mockResolvedValue([
        { id: 'comp-1', name: 'Component 1', description: 'Test component 1' },
        { id: 'comp-2', name: 'Component 2', description: 'Test component 2' },
      ] as any);

      prismaMock.workflowRun.create.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue(fixtures.workflowRun as any);
      prismaMock.story.update.mockResolvedValue(fixtures.story as any);

      // Act
      const result = await handler(prismaMock, params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.runId).toBe(fixtures.workflowRun.id);
    });

    it('should allow execution when previous run is completed', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
        ...requiredTranscriptParams,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: fixtures.project,
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        project: fixtures.project,
        states: [fixtures.workflowState],
      } as any);

      // Previous run is completed (not running/pending/paused)
      prismaMock.workflowRun.findFirst.mockResolvedValue(null);

      prismaMock.component.findMany.mockResolvedValue([
        { id: 'comp-1', name: 'Component 1', description: 'Test component 1' },
        { id: 'comp-2', name: 'Component 2', description: 'Test component 2' },
      ] as any);

      prismaMock.workflowRun.create.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
      } as any);

      prismaMock.workflowRun.update.mockResolvedValue(fixtures.workflowRun as any);
      prismaMock.story.update.mockResolvedValue(fixtures.story as any);

      // Act
      const result = await handler(prismaMock, params);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('TC-EXEC-001-U7: Path resolution priority for transcript tracking', () => {
    it('should prioritize params.cwd over all other paths', async () => {
      // Arrange
      const customCwd = '/custom/path';
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
        cwd: customCwd,
        sessionId: requiredTranscriptParams.sessionId,
        transcriptPath: requiredTranscriptParams.transcriptPath,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: { ...fixtures.project, hostPath: '/opt/stack/AIStudio', localPath: '/app' },
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        project: { ...fixtures.project, hostPath: '/opt/stack/AIStudio', localPath: '/app' },
        states: [fixtures.workflowState],
      } as any);

      prismaMock.workflowRun.findFirst.mockResolvedValue(null);
      prismaMock.component.findMany.mockResolvedValue([]);
      prismaMock.workflowRun.create.mockResolvedValue({
        id: 'run-001',
        workflowId: fixtures.workflow.id,
        projectId: fixtures.project.id,
        status: 'running',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        metadata: {
          _transcriptTracking: {
            projectPath: customCwd,
          },
        },
        workflow: fixtures.workflow,
      } as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);
      prismaMock.story.update.mockResolvedValue(fixtures.story as any);

      // Act
      await handler(prismaMock, params);

      // Assert - verify cwd was passed to start_workflow_run
      expect(prismaMock.workflowRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              _transcriptTracking: expect.objectContaining({
                projectPath: customCwd,
              }),
            }),
          }),
        })
      );
    });

    it('should use project.hostPath when cwd not provided', async () => {
      // Arrange
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
        ...requiredTranscriptParams,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: { ...fixtures.project, hostPath: '/opt/stack/AIStudio', localPath: '/app' },
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        project: { ...fixtures.project, hostPath: '/opt/stack/AIStudio', localPath: '/app' },
        states: [fixtures.workflowState],
      } as any);

      prismaMock.workflowRun.findFirst.mockResolvedValue(null);
      prismaMock.component.findMany.mockResolvedValue([]);
      prismaMock.workflowRun.create.mockResolvedValue({
        id: 'run-001',
        workflowId: fixtures.workflow.id,
        projectId: fixtures.project.id,
        status: 'running',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        metadata: {
          _transcriptTracking: {
            projectPath: '/opt/stack/AIStudio',
          },
        },
        workflow: fixtures.workflow,
      } as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);
      prismaMock.story.update.mockResolvedValue(fixtures.story as any);

      // Act
      await handler(prismaMock, params);

      // Assert - should use hostPath from database
      expect(prismaMock.workflowRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              _transcriptTracking: expect.objectContaining({
                projectPath: '/opt/stack/AIStudio',
              }),
            }),
          }),
        })
      );
    });

    it('should fallback to localPath when hostPath is null', async () => {
      // Arrange - don't include cwd to test fallback behavior
      // Clear PROJECT_HOST_PATH env var to test true fallback to localPath
      const originalProjectHostPath = process.env.PROJECT_HOST_PATH;
      delete process.env.PROJECT_HOST_PATH;

      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflow.id,
        sessionId: requiredTranscriptParams.sessionId,
        transcriptPath: requiredTranscriptParams.transcriptPath,
        // Note: deliberately NOT including cwd to test hostPath -> localPath fallback
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        project: { ...fixtures.project, hostPath: null, localPath: '/app' },
        epic: fixtures.epic,
      } as any);

      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        project: { ...fixtures.project, hostPath: null, localPath: '/app' },
        states: [fixtures.workflowState],
      } as any);

      prismaMock.workflowRun.findFirst.mockResolvedValue(null);
      prismaMock.component.findMany.mockResolvedValue([]);
      prismaMock.workflowRun.create.mockResolvedValue({
        id: 'run-001',
        workflowId: fixtures.workflow.id,
        projectId: fixtures.project.id,
        status: 'running',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        metadata: {
          _transcriptTracking: {
            projectPath: '/app',
          },
        },
        workflow: fixtures.workflow,
      } as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);
      prismaMock.story.update.mockResolvedValue(fixtures.story as any);

      try {
        // Act
        await handler(prismaMock, params);

        // Assert - should fallback to localPath
        expect(prismaMock.workflowRun.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              metadata: expect.objectContaining({
                _transcriptTracking: expect.objectContaining({
                  projectPath: '/app',
                }),
              }),
            }),
          })
        );
      } finally {
        // Restore env var
        if (originalProjectHostPath !== undefined) {
          process.env.PROJECT_HOST_PATH = originalProjectHostPath;
        }
      }
    });
  });
});
