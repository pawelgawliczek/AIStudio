/**
 * Unit tests for WorkflowRunsController
 * ST-355: Add unit tests for top 20 uncovered backend files
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateWorkflowRunDto, UpdateWorkflowRunDto } from '../dto';
import { TranscriptsService } from '../transcripts.service';
import { WorkflowRunsController } from '../workflow-runs.controller';
import { WorkflowRunsService } from '../workflow-runs.service';

describe('WorkflowRunsController', () => {
  let controller: WorkflowRunsController;
  let mockWorkflowRunsService: any;
  let mockTranscriptsService: any;

  beforeEach(() => {
    mockWorkflowRunsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getResults: jest.fn(),
      getStatus: jest.fn(),
      getArtifacts: jest.fn(),
      getArtifactAccess: jest.fn(),
      updateArtifactContent: jest.fn(),
      getContext: jest.fn(),
      getActiveWorkflowForProject: jest.fn(),
      findProjectWithAccess: jest.fn(),
      findRunWithProject: jest.fn(),
      findArtifactWithRun: jest.fn(),
    };

    mockTranscriptsService = {
      getTranscriptsForRun: jest.fn(),
      getTranscriptByComponentFromMetadata: jest.fn(),
      getTranscriptById: jest.fn(),
    };

    controller = new WorkflowRunsController(
      mockWorkflowRunsService as WorkflowRunsService,
      mockTranscriptsService as TranscriptsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new workflow run', async () => {
      const createDto: CreateWorkflowRunDto = {
        workflowId: 'workflow-1',
        storyId: 'story-1',
        triggeredBy: 'user-1',
      };

      const mockResponse = {
        id: 'run-1',
        workflowId: 'workflow-1',
        storyId: 'story-1',
        status: 'running',
      };

      mockWorkflowRunsService.create.mockResolvedValue(mockResponse);

      const result = await controller.create('project-1', createDto);

      expect(result).toEqual(mockResponse);
      expect(mockWorkflowRunsService.create).toHaveBeenCalledWith(
        'project-1',
        createDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return all workflow runs for a project', async () => {
      const mockRuns = [
        { id: 'run-1', status: 'running' },
        { id: 'run-2', status: 'completed' },
      ];

      mockWorkflowRunsService.findAll.mockResolvedValue(mockRuns);

      const result = await controller.findAll('project-1');

      expect(result).toEqual(mockRuns);
      expect(mockWorkflowRunsService.findAll).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          includeRelations: false,
        }),
      );
    });

    it('should filter by workflowId', async () => {
      mockWorkflowRunsService.findAll.mockResolvedValue([]);

      await controller.findAll('project-1', 'workflow-1');

      expect(mockWorkflowRunsService.findAll).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          workflowId: 'workflow-1',
          includeRelations: false,
        }),
      );
    });

    it('should filter by storyId', async () => {
      mockWorkflowRunsService.findAll.mockResolvedValue([]);

      await controller.findAll('project-1', undefined, 'story-1');

      expect(mockWorkflowRunsService.findAll).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          storyId: 'story-1',
          includeRelations: false,
        }),
      );
    });

    it('should filter by status', async () => {
      mockWorkflowRunsService.findAll.mockResolvedValue([]);

      await controller.findAll(
        'project-1',
        undefined,
        undefined,
        'completed' as any,
      );

      expect(mockWorkflowRunsService.findAll).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          status: 'completed',
          includeRelations: false,
        }),
      );
    });

    it('should include relations when requested', async () => {
      mockWorkflowRunsService.findAll.mockResolvedValue([]);

      await controller.findAll(
        'project-1',
        undefined,
        undefined,
        undefined,
        'true',
      );

      expect(mockWorkflowRunsService.findAll).toHaveBeenCalledWith(
        'project-1',
        { includeRelations: true },
      );
    });
  });

  describe('getActiveWorkflow', () => {
    it('should return active workflow for project', async () => {
      const mockActive = { id: 'run-1', status: 'running' };
      mockWorkflowRunsService.getActiveWorkflowForProject.mockResolvedValue(
        mockActive,
      );

      const result = await controller.getActiveWorkflow('project-1');

      expect(result).toEqual(mockActive);
    });
  });

  describe('findOne', () => {
    it('should return a workflow run by ID', async () => {
      const mockRun = { id: 'run-1', status: 'running' };
      mockWorkflowRunsService.findOne.mockResolvedValue(mockRun);

      const result = await controller.findOne('run-1');

      expect(result).toEqual(mockRun);
      expect(mockWorkflowRunsService.findOne).toHaveBeenCalledWith(
        'run-1',
        false,
      );
    });

    it('should include relations when requested', async () => {
      mockWorkflowRunsService.findOne.mockResolvedValue({});

      await controller.findOne('run-1', 'true');

      expect(mockWorkflowRunsService.findOne).toHaveBeenCalledWith(
        'run-1',
        true,
      );
    });
  });

  describe('getResults', () => {
    it('should return workflow run results', async () => {
      const mockResults = { status: 'completed', data: {} };
      mockWorkflowRunsService.getResults.mockResolvedValue(mockResults);

      const result = await controller.getResults('run-1');

      expect(result).toEqual(mockResults);
    });
  });

  describe('getStatus', () => {
    it('should return workflow run status', async () => {
      const mockStatus = { status: 'running', progress: 50 };
      mockWorkflowRunsService.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus('run-1');

      expect(result).toEqual(mockStatus);
    });
  });

  describe('getArtifacts', () => {
    it('should return artifacts for a workflow run', async () => {
      const mockArtifacts = [
        { id: 'artifact-1', key: 'PLAN' },
        { id: 'artifact-2', key: 'IMPLEMENTATION' },
      ];
      mockWorkflowRunsService.getArtifacts.mockResolvedValue(mockArtifacts);

      const result = await controller.getArtifacts('run-1');

      expect(result).toEqual(mockArtifacts);
      expect(mockWorkflowRunsService.getArtifacts).toHaveBeenCalledWith(
        'run-1',
        false,
        undefined,
      );
    });

    it('should include content when requested', async () => {
      mockWorkflowRunsService.getArtifacts.mockResolvedValue([]);

      await controller.getArtifacts('run-1', 'true');

      expect(mockWorkflowRunsService.getArtifacts).toHaveBeenCalledWith(
        'run-1',
        true,
        undefined,
      );
    });

    it('should filter by definitionKey', async () => {
      mockWorkflowRunsService.getArtifacts.mockResolvedValue([]);

      await controller.getArtifacts('run-1', undefined, 'PLAN');

      expect(mockWorkflowRunsService.getArtifacts).toHaveBeenCalledWith(
        'run-1',
        false,
        'PLAN',
      );
    });
  });

  describe('getArtifactAccess', () => {
    it('should return artifact access rules', async () => {
      const mockAccess = {
        state1: ['PLAN'],
        state2: ['PLAN', 'IMPLEMENTATION'],
      };
      mockWorkflowRunsService.getArtifactAccess.mockResolvedValue(mockAccess);

      const result = await controller.getArtifactAccess('run-1');

      expect(result).toEqual(mockAccess);
    });
  });

  describe('updateArtifactContent', () => {
    it('should update artifact content', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };
      const mockRun = { id: 'run-1', projectId: 'project-1' };
      const mockArtifact = { id: 'artifact-1', workflowRunId: 'run-1' };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(mockRun);
      mockWorkflowRunsService.findArtifactWithRun.mockResolvedValue(
        mockArtifact,
      );
      mockWorkflowRunsService.updateArtifactContent.mockResolvedValue({
        id: 'artifact-1',
        content: 'updated',
      });

      const result = await controller.updateArtifactContent(
        'project-1',
        'run-1',
        'artifact-1',
        { content: 'updated' },
        mockRequest as any,
      );

      expect(result.content).toBe('updated');
      expect(
        mockWorkflowRunsService.updateArtifactContent,
      ).toHaveBeenCalledWith('artifact-1', 'updated', 'run-1');
    });

    it('should throw ForbiddenException when user has no access', async () => {
      const mockRequest = { user: { userId: 'user-1' } };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(null);

      await expect(
        controller.updateArtifactContent(
          'project-1',
          'run-1',
          'artifact-1',
          { content: 'updated' },
          mockRequest as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when run not found', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(null);

      await expect(
        controller.updateArtifactContent(
          'project-1',
          'run-1',
          'artifact-1',
          { content: 'updated' },
          mockRequest as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when run does not belong to project', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };
      const mockRun = { id: 'run-1', projectId: 'project-2' };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(mockRun);

      await expect(
        controller.updateArtifactContent(
          'project-1',
          'run-1',
          'artifact-1',
          { content: 'updated' },
          mockRequest as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getContext', () => {
    it('should return workflow context', async () => {
      const mockContext = { runId: 'run-1', currentState: 'state-1' };
      mockWorkflowRunsService.getContext.mockResolvedValue(mockContext);

      const result = await controller.getContext('run-1');

      expect(result).toEqual(mockContext);
    });
  });

  describe('getTranscriptsForRun', () => {
    it('should return transcripts for a run', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };
      const mockRun = { id: 'run-1', projectId: 'project-1' };
      const mockTranscripts = {
        master: [],
        components: [],
      };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(mockRun);
      mockTranscriptsService.getTranscriptsForRun.mockResolvedValue(
        mockTranscripts,
      );

      const result = await controller.getTranscriptsForRun(
        'project-1',
        'run-1',
        mockRequest as any,
      );

      expect(result).toEqual(mockTranscripts);
    });
  });

  describe('getTranscriptByComponent', () => {
    it('should return transcript for a component', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };
      const mockRun = { id: 'run-1', projectId: 'project-1' };
      const mockTranscript = {
        id: 'transcript-1',
        componentId: 'component-1',
      };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(mockRun);
      mockTranscriptsService.getTranscriptByComponentFromMetadata.mockResolvedValue(
        mockTranscript,
      );

      const result = await controller.getTranscriptByComponent(
        'project-1',
        'run-1',
        'component-1',
        mockRequest as any,
      );

      expect(result).toEqual(mockTranscript);
      expect(
        mockTranscriptsService.getTranscriptByComponentFromMetadata,
      ).toHaveBeenCalledWith('run-1', 'component-1', false);
    });

    it('should include content when requested', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };
      const mockRun = { id: 'run-1', projectId: 'project-1' };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(mockRun);
      mockTranscriptsService.getTranscriptByComponentFromMetadata.mockResolvedValue(
        {},
      );

      await controller.getTranscriptByComponent(
        'project-1',
        'run-1',
        'component-1',
        mockRequest as any,
        'true',
      );

      expect(
        mockTranscriptsService.getTranscriptByComponentFromMetadata,
      ).toHaveBeenCalledWith('run-1', 'component-1', true);
    });
  });

  describe('getMasterTranscript', () => {
    it('should return master transcript by index', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };
      const mockRun = { id: 'run-1', projectId: 'project-1' };
      const mockTranscripts = {
        master: [
          { index: 0, artifactId: 'artifact-1' },
          { index: 1, artifactId: 'artifact-2' },
        ],
        components: [],
      };
      const mockTranscript = {
        id: 'artifact-1',
        content: 'transcript',
      };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(mockRun);
      mockTranscriptsService.getTranscriptsForRun.mockResolvedValue(
        mockTranscripts,
      );
      mockTranscriptsService.getTranscriptById.mockResolvedValue(
        mockTranscript,
      );

      const result = await controller.getMasterTranscript(
        'project-1',
        'run-1',
        '0',
        mockRequest as any,
      );

      expect(result.id).toBe('artifact-1');
      expect(result.index).toBe(0);
    });

    it('should throw NotFoundException when index not found', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };
      const mockRun = { id: 'run-1', projectId: 'project-1' };
      const mockTranscripts = {
        master: [{ index: 0, artifactId: 'artifact-1' }],
        components: [],
      };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(mockRun);
      mockTranscriptsService.getTranscriptsForRun.mockResolvedValue(
        mockTranscripts,
      );

      await expect(
        controller.getMasterTranscript(
          'project-1',
          'run-1',
          '5',
          mockRequest as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTranscript', () => {
    it('should return transcript by artifact ID', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const mockProject = { id: 'project-1' };
      const mockRun = { id: 'run-1', projectId: 'project-1' };
      const mockArtifact = { id: 'artifact-1', workflowRunId: 'run-1' };
      const mockTranscript = { id: 'artifact-1', content: 'transcript' };

      mockWorkflowRunsService.findProjectWithAccess.mockResolvedValue(
        mockProject,
      );
      mockWorkflowRunsService.findRunWithProject.mockResolvedValue(mockRun);
      mockWorkflowRunsService.findArtifactWithRun.mockResolvedValue(
        mockArtifact,
      );
      mockTranscriptsService.getTranscriptById.mockResolvedValue(
        mockTranscript,
      );

      const result = await controller.getTranscript(
        'project-1',
        'run-1',
        'artifact-1',
        mockRequest as any,
      );

      expect(result).toEqual(mockTranscript);
    });
  });

  describe('update', () => {
    it('should update a workflow run', async () => {
      const updateDto: UpdateWorkflowRunDto = {
        status: 'completed',
      };
      const mockUpdated = { id: 'run-1', status: 'completed' };

      mockWorkflowRunsService.update.mockResolvedValue(mockUpdated);

      const result = await controller.update('run-1', updateDto);

      expect(result).toEqual(mockUpdated);
      expect(mockWorkflowRunsService.update).toHaveBeenCalledWith(
        'run-1',
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should delete a workflow run', async () => {
      mockWorkflowRunsService.remove.mockResolvedValue(undefined);

      await controller.remove('run-1');

      expect(mockWorkflowRunsService.remove).toHaveBeenCalledWith('run-1');
    });
  });
});
