/**
 * Unit tests for RunnerControlService
 * ST-195: Workflow Control & Results Dashboard
 *
 * Tests TDD - written BEFORE implementation
 * Expected: ALL TESTS WILL FAIL (implementation doesn't exist yet)
 */

import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RunnerControlService } from '../runner-control.service';

describe('RunnerControlService', () => {
  let service: RunnerControlService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';
  const mockProjectId = 'project-456';
  const mockRunId = 'run-789';
  const mockWorkflowId = 'workflow-abc';
  const mockStoryId = 'story-def';

  beforeEach(async () => {
    const mockPrisma = {
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      workflow: {
        findUnique: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunnerControlService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<RunnerControlService>(RunnerControlService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('startRunner', () => {
    it('should start workflow run', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        workflowId: mockWorkflowId,
        status: 'pending',
        workflow: {
          id: mockWorkflowId,
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue({ ...mockWorkflowRun, status: 'running' } as any);

      const result = await service.startRunner(mockRunId, mockWorkflowId, mockStoryId, mockUserId);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('runId', mockRunId);
      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: mockRunId },
        data: expect.objectContaining({
          status: 'running',
        }),
      });
    });

    it('should throw NotFoundException when run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(
        service.startRunner(mockRunId, mockWorkflowId, mockStoryId, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when run already running', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        workflowId: mockWorkflowId,
        status: 'running',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      await expect(
        service.startRunner(mockRunId, mockWorkflowId, mockStoryId, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('pauseRunner', () => {
    it('should pause running workflow', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue({ ...mockWorkflowRun, status: 'paused' } as any);

      const result = await service.pauseRunner(mockRunId, mockUserId, 'Testing pause');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('status', 'paused');
      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: mockRunId },
        data: expect.objectContaining({
          status: 'paused',
        }),
      });
    });

    it('should throw NotFoundException when run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(
        service.pauseRunner(mockRunId, mockUserId, 'Testing')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when run not running', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'paused',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      await expect(
        service.pauseRunner(mockRunId, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should truncate long reason strings', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue({ ...mockWorkflowRun, status: 'paused' } as any);

      const longReason = 'a'.repeat(1000);
      await service.pauseRunner(mockRunId, mockUserId, longReason);

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const metadata = updateCall.data.metadata;
      expect(metadata.pauseReason.length).toBeLessThanOrEqual(500);
    });
  });

  describe('resumeRunner', () => {
    it('should resume paused workflow', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'paused',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue({ ...mockWorkflowRun, status: 'running' } as any);

      const result = await service.resumeRunner(mockRunId, mockUserId);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('status', 'running');
      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: mockRunId },
        data: expect.objectContaining({
          status: 'running',
        }),
      });
    });

    it('should throw NotFoundException when run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(
        service.resumeRunner(mockRunId, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when run not paused', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      await expect(
        service.resumeRunner(mockRunId, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('repeatStep', () => {
    it('should repeat current step with feedback', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        currentStateId: 'state-1',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue(mockWorkflowRun as any);

      const feedback = 'Fix the authentication tests';
      const result = await service.repeatStep(mockRunId, mockUserId, 'Testing repeat', feedback);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('currentStateId', 'state-1');
      expect(prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: mockRunId },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            repeatFeedback: feedback,
          }),
        }),
      });
    });

    it('should throw NotFoundException when run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(
        service.repeatStep(mockRunId, mockUserId, 'Testing', 'Feedback')
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow repeat without feedback', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        currentStateId: 'state-1',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue(mockWorkflowRun as any);

      const result = await service.repeatStep(mockRunId, mockUserId);

      expect(result).toHaveProperty('success', true);
    });

    it('should truncate long feedback strings', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        currentStateId: 'state-1',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue(mockWorkflowRun as any);

      const longFeedback = 'a'.repeat(3000);
      await service.repeatStep(mockRunId, mockUserId, 'Testing', longFeedback);

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const metadata = updateCall.data.metadata;
      expect(metadata.repeatFeedback.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('advanceStep', () => {
    it('should advance to next state', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        currentStateId: 'state-1',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
          states: [
            { id: 'state-1', order: 1 },
            { id: 'state-2', order: 2 },
          ],
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue({
        ...mockWorkflowRun,
        currentStateId: 'state-2',
      } as any);

      const result = await service.advanceStep(mockRunId, mockUserId);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('currentStateId', 'state-2');
    });

    it('should throw NotFoundException when run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(
        service.advanceStep(mockRunId, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip to specific state when skipToState provided', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        currentStateId: 'state-1',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
          states: [
            { id: 'state-1', order: 1 },
            { id: 'state-2', order: 2 },
            { id: 'state-3', order: 3 },
          ],
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue({
        ...mockWorkflowRun,
        currentStateId: 'state-3',
      } as any);

      const result = await service.advanceStep(mockRunId, mockUserId, null, 'state-3');

      expect(result).toHaveProperty('currentStateId', 'state-3');
    });

    it('should store output when provided', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        currentStateId: 'state-1',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
          states: [
            { id: 'state-1', order: 1 },
            { id: 'state-2', order: 2 },
          ],
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue(mockWorkflowRun as any);

      const output = { result: 'success', data: [1, 2, 3] };
      await service.advanceStep(mockRunId, mockUserId, output);

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const metadata = updateCall.data.metadata;
      expect(metadata.lastOutput).toEqual(output);
    });
  });

  describe('getStatus', () => {
    it('should return workflow status', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        currentStateId: 'state-2',
        workflow: {
          id: mockWorkflowId,
          name: 'Test Workflow',
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
        metadata: {
          checkpoint: {
            resourceUsage: {
              tokensUsed: 10000,
              agentSpawns: 3,
            },
          },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      const result = await service.getStatus(mockRunId, mockUserId);

      expect(result).toHaveProperty('runId', mockRunId);
      expect(result).toHaveProperty('status', 'running');
      expect(result).toHaveProperty('currentStateId', 'state-2');
    });

    it('should include checkpoint when requested', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'paused',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
        metadata: {
          checkpoint: {
            version: 1,
            resourceUsage: { tokensUsed: 5000 },
          },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      const result = await service.getStatus(mockRunId, mockUserId, true);

      expect(result).toHaveProperty('checkpoint');
      expect(result.checkpoint).toHaveProperty('version', 1);
    });

    it('should throw NotFoundException when run not found', async () => {
      prisma.workflowRun.findUnique.mockResolvedValue(null);

      await expect(
        service.getStatus(mockRunId, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Security - Authorization (M1)', () => {
    it('should deny access to workflow in different project', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        workflow: {
          projectId: 'different-project',
          project: { id: 'different-project' },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.project.findFirst.mockResolvedValue(null); // User has no access

      await expect(
        service.pauseRunner(mockRunId, mockUserId, 'Testing')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow access to workflow in same project', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.project.findFirst.mockResolvedValue({ id: mockProjectId } as any); // User has access
      prisma.workflowRun.update.mockResolvedValue({ ...mockWorkflowRun, status: 'paused' } as any);

      await expect(
        service.pauseRunner(mockRunId, mockUserId, 'Testing')
      ).resolves.not.toThrow();
    });
  });

  describe('Security - Input Validation (M2)', () => {
    it('should reject invalid UUID for runId', async () => {
      await expect(
        service.pauseRunner('invalid-uuid', mockUserId, 'Testing')
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty userId', async () => {
      await expect(
        service.pauseRunner(mockRunId, '', 'Testing')
      ).rejects.toThrow(BadRequestException);
    });

    it('should sanitize user input in reason/feedback fields', async () => {
      const mockWorkflowRun = {
        id: mockRunId,
        status: 'running',
        workflow: {
          projectId: mockProjectId,
          project: { id: mockProjectId },
        },
      };

      prisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prisma.workflowRun.update.mockResolvedValue({ ...mockWorkflowRun, status: 'paused' } as any);

      const maliciousReason = '<script>alert("xss")</script>';
      await service.pauseRunner(mockRunId, mockUserId, maliciousReason);

      const updateCall = (prisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const metadata = updateCall.data.metadata;
      expect(metadata.pauseReason).not.toContain('<script>');
    });
  });
});
