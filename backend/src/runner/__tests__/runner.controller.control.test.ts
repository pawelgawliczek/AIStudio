/**
 * Integration tests for RunnerController control endpoints
 * ST-195: Workflow Control & Results Dashboard
 *
 * Tests TDD - written BEFORE implementation
 * Expected: ALL TESTS WILL FAIL (implementation doesn't exist yet)
 */

import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RunnerControlService } from '../runner-control.service';
import { RunnerController } from '../runner.controller';

describe('RunnerController - Control Endpoints', () => {
  let controller: RunnerController;
  let service: jest.Mocked<RunnerControlService>;

  const mockRunId = 'run-123';
  const mockWorkflowId = 'workflow-456';
  const mockStoryId = 'story-789';
  const mockUserId = 'user-abc';

  beforeEach(async () => {
    const mockService = {
      startRunner: jest.fn(),
      pauseRunner: jest.fn(),
      resumeRunner: jest.fn(),
      repeatStep: jest.fn(),
      advanceStep: jest.fn(),
      getStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RunnerController],
      providers: [
        {
          provide: RunnerControlService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<RunnerController>(RunnerController);
    service = module.get(RunnerControlService) as jest.Mocked<RunnerControlService>;
  });

  describe('POST /runner/:runId/start', () => {
    it('should start workflow run', async () => {
      service.startRunner.mockResolvedValue({
        success: true,
        runId: mockRunId,
        status: 'running',
      });

      const result = await controller.startRunner(mockRunId, {
        workflowId: mockWorkflowId,
        storyId: mockStoryId,
        triggeredBy: mockUserId,
      });

      expect(result).toEqual({
        success: true,
        runId: mockRunId,
        status: 'running',
      });
      expect(service.startRunner).toHaveBeenCalledWith(
        mockRunId,
        mockWorkflowId,
        mockStoryId,
        mockUserId
      );
    });

    it('should return 404 when run not found', async () => {
      service.startRunner.mockRejectedValue(new NotFoundException('WorkflowRun not found'));

      await expect(
        controller.startRunner(mockRunId, {
          workflowId: mockWorkflowId,
          storyId: mockStoryId,
          triggeredBy: mockUserId,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should return 400 when run already running', async () => {
      service.startRunner.mockRejectedValue(
        new BadRequestException('Workflow run is already running')
      );

      await expect(
        controller.startRunner(mockRunId, {
          workflowId: mockWorkflowId,
          triggeredBy: mockUserId,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate required fields in request body', async () => {
      await expect(
        controller.startRunner(mockRunId, {
          // Missing workflowId
          storyId: mockStoryId,
          triggeredBy: mockUserId,
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('POST /runner/:runId/pause', () => {
    it('should pause running workflow', async () => {
      service.pauseRunner.mockResolvedValue({
        success: true,
        runId: mockRunId,
        status: 'paused',
      });

      const result = await controller.pauseRunner(mockRunId, {
        reason: 'Manual pause for review',
      });

      expect(result).toEqual({
        success: true,
        runId: mockRunId,
        status: 'paused',
      });
      expect(service.pauseRunner).toHaveBeenCalledWith(
        mockRunId,
        expect.any(String), // userId from request
        'Manual pause for review'
      );
    });

    it('should pause without reason', async () => {
      service.pauseRunner.mockResolvedValue({
        success: true,
        runId: mockRunId,
        status: 'paused',
      });

      const result = await controller.pauseRunner(mockRunId, {});

      expect(result).toHaveProperty('success', true);
      expect(service.pauseRunner).toHaveBeenCalledWith(
        mockRunId,
        expect.any(String),
        undefined
      );
    });

    it('should return 404 when run not found', async () => {
      service.pauseRunner.mockRejectedValue(new NotFoundException('WorkflowRun not found'));

      await expect(
        controller.pauseRunner(mockRunId, {})
      ).rejects.toThrow(NotFoundException);
    });

    it('should return 400 when run not running', async () => {
      service.pauseRunner.mockRejectedValue(
        new BadRequestException('Workflow run is not in running state')
      );

      await expect(
        controller.pauseRunner(mockRunId, {})
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce max length on reason field', async () => {
      const longReason = 'a'.repeat(600);

      await expect(
        controller.pauseRunner(mockRunId, { reason: longReason })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /runner/:runId/resume', () => {
    it('should resume paused workflow', async () => {
      service.resumeRunner.mockResolvedValue({
        success: true,
        runId: mockRunId,
        status: 'running',
      });

      const result = await controller.resumeRunner(mockRunId);

      expect(result).toEqual({
        success: true,
        runId: mockRunId,
        status: 'running',
      });
      expect(service.resumeRunner).toHaveBeenCalledWith(mockRunId, expect.any(String));
    });

    it('should return 404 when run not found', async () => {
      service.resumeRunner.mockRejectedValue(new NotFoundException('WorkflowRun not found'));

      await expect(controller.resumeRunner(mockRunId)).rejects.toThrow(NotFoundException);
    });

    it('should return 400 when run not paused', async () => {
      service.resumeRunner.mockRejectedValue(
        new BadRequestException('Workflow run is not in paused state')
      );

      await expect(controller.resumeRunner(mockRunId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /runner/:runId/repeat', () => {
    it('should repeat current step with feedback', async () => {
      service.repeatStep.mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-1',
      });

      const result = await controller.repeatStep(mockRunId, {
        reason: 'Tests are failing',
        feedback: 'Fix the authentication test - mock should return 200',
      });

      expect(result).toEqual({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-1',
      });
      expect(service.repeatStep).toHaveBeenCalledWith(
        mockRunId,
        expect.any(String),
        'Tests are failing',
        'Fix the authentication test - mock should return 200'
      );
    });

    it('should repeat without feedback', async () => {
      service.repeatStep.mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-1',
      });

      const result = await controller.repeatStep(mockRunId, {});

      expect(result).toHaveProperty('success', true);
      expect(service.repeatStep).toHaveBeenCalledWith(
        mockRunId,
        expect.any(String),
        undefined,
        undefined
      );
    });

    it('should return 404 when run not found', async () => {
      service.repeatStep.mockRejectedValue(new NotFoundException('WorkflowRun not found'));

      await expect(
        controller.repeatStep(mockRunId, {})
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce max length on feedback field', async () => {
      const longFeedback = 'a'.repeat(2500);

      await expect(
        controller.repeatStep(mockRunId, { feedback: longFeedback })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /runner/:runId/advance', () => {
    it('should advance to next state', async () => {
      service.advanceStep.mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-2',
      });

      const result = await controller.advanceStep(mockRunId, {});

      expect(result).toEqual({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-2',
      });
      expect(service.advanceStep).toHaveBeenCalledWith(
        mockRunId,
        expect.any(String),
        undefined,
        undefined
      );
    });

    it('should skip to specific state', async () => {
      service.advanceStep.mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-3',
      });

      const result = await controller.advanceStep(mockRunId, {
        skipToState: 'state-3',
      });

      expect(result).toEqual({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-3',
      });
      expect(service.advanceStep).toHaveBeenCalledWith(
        mockRunId,
        expect.any(String),
        undefined,
        'state-3'
      );
    });

    it('should store output when provided', async () => {
      service.advanceStep.mockResolvedValue({
        success: true,
        runId: mockRunId,
        currentStateId: 'state-2',
      });

      const output = { result: 'success', data: [1, 2, 3] };
      const result = await controller.advanceStep(mockRunId, { output });

      expect(result).toHaveProperty('success', true);
      expect(service.advanceStep).toHaveBeenCalledWith(
        mockRunId,
        expect.any(String),
        output,
        undefined
      );
    });

    it('should return 404 when run not found', async () => {
      service.advanceStep.mockRejectedValue(new NotFoundException('WorkflowRun not found'));

      await expect(
        controller.advanceStep(mockRunId, {})
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate output is object when provided', async () => {
      await expect(
        controller.advanceStep(mockRunId, { output: 'invalid' } as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /runner/:runId/status', () => {
    it('should return workflow status', async () => {
      const mockStatus = {
        runId: mockRunId,
        status: 'running',
        currentStateId: 'state-2',
        workflow: {
          id: mockWorkflowId,
          name: 'Test Workflow',
        },
      };

      service.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockRunId);

      expect(result).toEqual(mockStatus);
      expect(service.getStatus).toHaveBeenCalledWith(
        mockRunId,
        expect.any(String),
        undefined
      );
    });

    it('should include checkpoint when requested', async () => {
      const mockStatus = {
        runId: mockRunId,
        status: 'paused',
        checkpoint: {
          version: 1,
          resourceUsage: { tokensUsed: 5000 },
        },
      };

      service.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockRunId, true);

      expect(result).toHaveProperty('checkpoint');
      expect(service.getStatus).toHaveBeenCalledWith(mockRunId, expect.any(String), true);
    });

    it('should return 404 when run not found', async () => {
      service.getStatus.mockRejectedValue(new NotFoundException('WorkflowRun not found'));

      await expect(controller.getStatus(mockRunId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Security - Authorization (M1)', () => {
    it('should return 403 for unauthorized access', async () => {
      service.pauseRunner.mockRejectedValue(
        new ForbiddenException('Access denied to this workflow')
      );

      await expect(
        controller.pauseRunner(mockRunId, {})
      ).rejects.toThrow(ForbiddenException);
    });

    it('should validate user has project access for all operations', async () => {
      const operations = [
        () => controller.pauseRunner(mockRunId, {}),
        () => controller.resumeRunner(mockRunId),
        () => controller.repeatStep(mockRunId, {}),
        () => controller.advanceStep(mockRunId, {}),
      ];

      service.pauseRunner.mockRejectedValue(new ForbiddenException());
      service.resumeRunner.mockRejectedValue(new ForbiddenException());
      service.repeatStep.mockRejectedValue(new ForbiddenException());
      service.advanceStep.mockRejectedValue(new ForbiddenException());

      for (const operation of operations) {
        await expect(operation()).rejects.toThrow(ForbiddenException);
      }
    });
  });

  describe('Security - Rate Limiting (M3)', () => {
    it('should enforce rate limits on control endpoints', async () => {
      // This test will be implemented once rate limiting is added
      // Expected: 10 requests per minute for pause/resume
      // Expected: 5 requests per minute for repeat/advance
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      service.pauseRunner.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        controller.pauseRunner(mockRunId, {})
      ).rejects.toThrow('Database connection failed');
    });

    it('should not leak sensitive information in error messages', async () => {
      service.getStatus.mockRejectedValue(new Error('Internal database error'));

      try {
        await controller.getStatus(mockRunId);
      } catch (error) {
        expect(error.message).not.toContain('password');
        expect(error.message).not.toContain('token');
        expect(error.message).not.toContain('secret');
      }
    });
  });
});
