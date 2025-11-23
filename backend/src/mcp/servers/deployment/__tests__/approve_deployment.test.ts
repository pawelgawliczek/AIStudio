/**
 * Tests for approve_deployment MCP Tool (ST-84)
 *
 * Tests manual approval for direct commit deployments:
 * - Approval creation and validation
 * - Approval expiration
 * - Story status validation
 * - Error handling
 */

import { handler, ApproveDeploymentParams } from '../approve_deployment';
import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../../types';

// Mock PrismaClient
const mockPrisma = {
  story: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $disconnect: jest.fn(),
} as unknown as PrismaClient;

describe('approve_deployment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Approval', () => {
    it('should approve deployment with default expiration (60 minutes)', async () => {
      const storyId = '2e809be4-cc67-4fc7-8c3d-4d337c0043d5';
      const approvedBy = 'pawel';

      const mockStory = {
        id: storyId,
        key: 'ST-84',
        title: 'Test Story',
        status: 'qa',
        manualApproval: false,
        approvedBy: null,
        approvedAt: null,
        approvalExpiresAt: null,
        metadata: {},
      };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      const mockUpdatedStory = {
        id: storyId,
        key: 'ST-84',
        approvedBy,
        approvedAt: now,
        approvalExpiresAt: expiresAt,
      };

      (mockPrisma.story.findUnique as any).mockResolvedValue(mockStory);
      (mockPrisma.story.update as any).mockResolvedValue(mockUpdatedStory);

      const params: ApproveDeploymentParams = {
        storyId,
        approvedBy,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(result.storyId).toBe(storyId);
      expect(result.storyKey).toBe('ST-84');
      expect(result.approvedBy).toBe(approvedBy);
      expect(result.expiresInMinutes).toBe(60);
      expect(result.message).toContain('Deployment approved');
      expect(result.message).toContain('60 minutes');

      // Verify story update was called with correct data
      expect(mockPrisma.story.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: storyId },
          data: expect.objectContaining({
            manualApproval: true,
            approvedBy,
            approvedAt: expect.any(Date),
            approvalExpiresAt: expect.any(Date),
          }),
        })
      );
    });

    it('should approve deployment with custom expiration (120 minutes)', async () => {
      const storyId = '2e809be4-cc67-4fc7-8c3d-4d337c0043d5';
      const approvedBy = 'pawel';
      const expiresInMinutes = 120;

      const mockStory = {
        id: storyId,
        key: 'ST-84',
        title: 'Test Story',
        status: 'done',
        manualApproval: false,
        approvedBy: null,
        approvedAt: null,
        approvalExpiresAt: null,
        metadata: {},
      };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 120 * 60 * 1000);

      const mockUpdatedStory = {
        id: storyId,
        key: 'ST-84',
        approvedBy,
        approvedAt: now,
        approvalExpiresAt: expiresAt,
      };

      (mockPrisma.story.findUnique as any).mockResolvedValue(mockStory);
      (mockPrisma.story.update as any).mockResolvedValue(mockUpdatedStory);

      const params: ApproveDeploymentParams = {
        storyId,
        approvedBy,
        expiresInMinutes,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(result.expiresInMinutes).toBe(120);
    });

    it('should approve deployment with approval reason', async () => {
      const storyId = '2e809be4-cc67-4fc7-8c3d-4d337c0043d5';
      const approvedBy = 'pawel';
      const approvalReason = 'Hotfix for critical bug';

      const mockStory = {
        id: storyId,
        key: 'ST-84',
        title: 'Test Story',
        status: 'qa',
        manualApproval: false,
        approvedBy: null,
        approvedAt: null,
        approvalExpiresAt: null,
        metadata: {},
      };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      const mockUpdatedStory = {
        id: storyId,
        key: 'ST-84',
        approvedBy,
        approvedAt: now,
        approvalExpiresAt: expiresAt,
      };

      (mockPrisma.story.findUnique as any).mockResolvedValue(mockStory);
      (mockPrisma.story.update as any).mockResolvedValue(mockUpdatedStory);

      const params: ApproveDeploymentParams = {
        storyId,
        approvedBy,
        approvalReason,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(result.approvalReason).toBe(approvalReason);

      // Verify metadata includes approval reason
      expect(mockPrisma.story.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              lastManualApproval: expect.objectContaining({
                reason: approvalReason,
              }),
            }),
          }),
        })
      );
    });

    it('should overwrite existing valid approval with warning', async () => {
      const storyId = '2e809be4-cc67-4fc7-8c3d-4d337c0043d5';
      const approvedBy = 'pawel';

      const existingApprovalAt = new Date();
      const existingExpiresAt = new Date(
        existingApprovalAt.getTime() + 30 * 60 * 1000
      );

      const mockStory = {
        id: storyId,
        key: 'ST-84',
        title: 'Test Story',
        status: 'qa',
        manualApproval: true,
        approvedBy: 'previous-user',
        approvedAt: existingApprovalAt,
        approvalExpiresAt: existingExpiresAt,
        metadata: {},
      };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      const mockUpdatedStory = {
        id: storyId,
        key: 'ST-84',
        approvedBy,
        approvedAt: now,
        approvalExpiresAt: expiresAt,
      };

      (mockPrisma.story.findUnique as any).mockResolvedValue(mockStory);
      (mockPrisma.story.update as any).mockResolvedValue(mockUpdatedStory);

      const params: ApproveDeploymentParams = {
        storyId,
        approvedBy,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(result.approvedBy).toBe(approvedBy); // New approver
    });
  });

  describe('Validation Errors', () => {
    it('should fail if storyId is missing', async () => {
      const params = {
        approvedBy: 'pawel',
      } as any;

      await expect(handler(mockPrisma, params)).rejects.toThrow(ValidationError);
    });

    it('should fail if approvedBy is missing', async () => {
      const params = {
        storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
      } as any;

      await expect(handler(mockPrisma, params)).rejects.toThrow(ValidationError);
    });

    it('should fail if storyId is not a valid UUID', async () => {
      const params: ApproveDeploymentParams = {
        storyId: 'invalid-uuid',
        approvedBy: 'pawel',
      };

      await expect(handler(mockPrisma, params)).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, params)).rejects.toThrow('Invalid storyId format');
    });

    it('should fail if approvedBy is empty string', async () => {
      const params: ApproveDeploymentParams = {
        storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
        approvedBy: '   ',
      };

      await expect(handler(mockPrisma, params)).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, params)).rejects.toThrow('approvedBy cannot be empty');
    });

    it('should fail if expiresInMinutes is below minimum (1)', async () => {
      const params: ApproveDeploymentParams = {
        storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
        approvedBy: 'pawel',
        expiresInMinutes: 0,
      };

      await expect(handler(mockPrisma, params)).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, params)).rejects.toThrow('Must be between 1 and 480 minutes');
    });

    it('should fail if expiresInMinutes exceeds maximum (480)', async () => {
      const params: ApproveDeploymentParams = {
        storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
        approvedBy: 'pawel',
        expiresInMinutes: 500,
      };

      await expect(handler(mockPrisma, params)).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, params)).rejects.toThrow('Must be between 1 and 480 minutes');
    });

    it('should fail if story does not exist', async () => {
      (mockPrisma.story.findUnique as any).mockResolvedValue(null);

      const params: ApproveDeploymentParams = {
        storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
        approvedBy: 'pawel',
      };

      await expect(handler(mockPrisma, params)).rejects.toThrow(NotFoundError);
      await expect(handler(mockPrisma, params)).rejects.toThrow('Story with ID 2e809be4-cc67-4fc7-8c3d-4d337c0043d5 not found');
    });

    it('should fail if story is not in deployable status', async () => {
      const mockStory = {
        id: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
        key: 'ST-84',
        title: 'Test Story',
        status: 'planning', // Not deployable
        manualApproval: false,
        approvedBy: null,
        approvedAt: null,
        approvalExpiresAt: null,
        metadata: {},
      };

      (mockPrisma.story.findUnique as any).mockResolvedValue(mockStory);

      const params: ApproveDeploymentParams = {
        storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
        approvedBy: 'pawel',
      };

      await expect(handler(mockPrisma, params)).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, params)).rejects.toThrow('not ready for deployment');
      await expect(handler(mockPrisma, params)).rejects.toThrow('Status: planning');
    });
  });

  describe('Edge Cases', () => {
    it('should handle story with existing metadata gracefully', async () => {
      const storyId = '2e809be4-cc67-4fc7-8c3d-4d337c0043d5';
      const approvedBy = 'pawel';

      const mockStory = {
        id: storyId,
        key: 'ST-84',
        title: 'Test Story',
        status: 'qa',
        manualApproval: false,
        approvedBy: null,
        approvedAt: null,
        approvalExpiresAt: null,
        metadata: {
          existingField: 'existing value',
          previousApprovals: [],
        },
      };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      const mockUpdatedStory = {
        id: storyId,
        key: 'ST-84',
        approvedBy,
        approvedAt: now,
        approvalExpiresAt: expiresAt,
      };

      (mockPrisma.story.findUnique as any).mockResolvedValue(mockStory);
      (mockPrisma.story.update as any).mockResolvedValue(mockUpdatedStory);

      const params: ApproveDeploymentParams = {
        storyId,
        approvedBy,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);

      // Verify existing metadata is preserved
      expect(mockPrisma.story.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              existingField: 'existing value',
              previousApprovals: [],
            }),
          }),
        })
      );
    });

    it('should handle maximum allowed expiration (480 minutes = 8 hours)', async () => {
      const storyId = '2e809be4-cc67-4fc7-8c3d-4d337c0043d5';
      const approvedBy = 'pawel';
      const expiresInMinutes = 480;

      const mockStory = {
        id: storyId,
        key: 'ST-84',
        title: 'Test Story',
        status: 'qa',
        manualApproval: false,
        approvedBy: null,
        approvedAt: null,
        approvalExpiresAt: null,
        metadata: {},
      };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 480 * 60 * 1000);

      const mockUpdatedStory = {
        id: storyId,
        key: 'ST-84',
        approvedBy,
        approvedAt: now,
        approvalExpiresAt: expiresAt,
      };

      (mockPrisma.story.findUnique as any).mockResolvedValue(mockStory);
      (mockPrisma.story.update as any).mockResolvedValue(mockUpdatedStory);

      const params: ApproveDeploymentParams = {
        storyId,
        approvedBy,
        expiresInMinutes,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(result.expiresInMinutes).toBe(480);
    });
  });
});
