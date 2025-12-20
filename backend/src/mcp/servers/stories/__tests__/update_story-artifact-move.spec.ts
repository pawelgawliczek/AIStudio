/**
 * ST-363: update_story Artifact Move Integration Tests
 *
 * Tests that update_story correctly detects epicId changes and triggers
 * artifact move requests via the internal API.
 *
 * Test Categories:
 * - Integration: epicId change detection and move triggering
 * - Edge Cases: null to epic, epic to null, epic to different epic
 * - Error Handling: API failures don't block story update
 */

import { PrismaClient } from '@prisma/client';
import { updateStory } from '../update_story';
import { requestArtifactMove } from '../../../../mcp/services/websocket-gateway.instance';

// Mock the requestArtifactMove function
jest.mock('../../../../mcp/services/websocket-gateway.instance', () => ({
  requestArtifactMove: jest.fn(),
}));

describe('update_story - Artifact Move Integration (ST-363)', () => {
  let prisma: PrismaClient;
  const mockRequestArtifactMove = requestArtifactMove as jest.MockedFunction<typeof requestArtifactMove>;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Epic Assignment - Story without Epic to Story with Epic', () => {
    it('should trigger artifact move when assigning story to epic', async () => {
      // Mock story without epic
      const mockStory = {
        id: 'story-uuid-1',
        key: 'ST-123',
        title: 'Test Story',
        epicId: null,
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock epic
      const mockEpic = {
        id: 'epic-uuid-1',
        key: 'EP-1',
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValue(mockEpic as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockEpic.id,
      } as any);

      mockRequestArtifactMove.mockResolvedValue(undefined);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockEpic.id,
      });

      expect(mockRequestArtifactMove).toHaveBeenCalledWith({
        storyKey: 'ST-123',
        storyId: 'story-uuid-1',
        epicKey: 'EP-1',
        oldPath: 'docs/ST-123',
        newPath: 'docs/EP-1/ST-123',
      });
    });

    it('should not trigger move if epicId does not change', async () => {
      const mockStory = {
        id: 'story-uuid-2',
        key: 'ST-456',
        title: 'Test Story',
        epicId: 'epic-uuid-2',
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue(mockStory as any);

      await updateStory(prisma, {
        story: mockStory.id,
        title: 'Updated Title', // Only title changes
      });

      expect(mockRequestArtifactMove).not.toHaveBeenCalled();
    });

    it('should handle multiple epic assignments to different epics', async () => {
      const mockStory = {
        id: 'story-uuid-3',
        key: 'ST-789',
        epicId: null,
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEpic1 = { id: 'epic-uuid-3', key: 'EP-10' };
      const mockEpic2 = { id: 'epic-uuid-4', key: 'EP-20' };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockEpic1.id,
      } as any);

      // First assignment
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValueOnce(mockEpic1 as any);
      mockRequestArtifactMove.mockResolvedValue(undefined);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockEpic1.id,
      });

      expect(mockRequestArtifactMove).toHaveBeenCalledWith(
        expect.objectContaining({
          epicKey: 'EP-10',
          newPath: 'docs/EP-10/ST-789',
        })
      );

      // Update mock to simulate story now in epic 1
      mockStory.epicId = mockEpic1.id;
      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);

      // Second assignment to different epic
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValueOnce(mockEpic2 as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockEpic2.id,
      } as any);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockEpic2.id,
      });

      expect(mockRequestArtifactMove).toHaveBeenCalledTimes(2);
      expect(mockRequestArtifactMove).toHaveBeenLastCalledWith(
        expect.objectContaining({
          epicKey: 'EP-20',
          newPath: 'docs/EP-20/ST-789',
        })
      );
    });
  });

  describe('Epic Unassignment - Story with Epic to Unassigned', () => {
    it('should trigger move to unassigned when removing epic', async () => {
      const mockStory = {
        id: 'story-uuid-4',
        key: 'ST-100',
        epicId: 'epic-uuid-5',
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: null,
      } as any);

      mockRequestArtifactMove.mockResolvedValue(undefined);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: null,
      });

      expect(mockRequestArtifactMove).toHaveBeenCalledWith({
        storyKey: 'ST-100',
        storyId: 'story-uuid-4',
        epicKey: null,
        oldPath: 'docs/ST-100',
        newPath: 'docs/unassigned/ST-100',
      });
    });

    it('should use unassigned path when epicKey is null', async () => {
      const mockStory = {
        id: 'story-uuid-5',
        key: 'ST-200',
        epicId: 'epic-uuid-6',
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: null,
      } as any);

      mockRequestArtifactMove.mockResolvedValue(undefined);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: null,
      });

      const call = mockRequestArtifactMove.mock.calls[0][0];
      expect(call.epicKey).toBeNull();
      expect(call.newPath).toBe('docs/unassigned/ST-200');
    });
  });

  describe('Epic to Epic - Moving Story Between Epics', () => {
    it('should trigger move when changing from one epic to another', async () => {
      const mockStory = {
        id: 'story-uuid-6',
        key: 'ST-300',
        epicId: 'epic-uuid-7',
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNewEpic = {
        id: 'epic-uuid-8',
        key: 'EP-99',
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValue(mockNewEpic as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockNewEpic.id,
      } as any);

      mockRequestArtifactMove.mockResolvedValue(undefined);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockNewEpic.id,
      });

      expect(mockRequestArtifactMove).toHaveBeenCalledWith({
        storyKey: 'ST-300',
        storyId: 'story-uuid-6',
        epicKey: 'EP-99',
        oldPath: 'docs/ST-300',
        newPath: 'docs/EP-99/ST-300',
      });
    });
  });

  describe('Error Handling', () => {
    it('should not block story update if artifact move request fails', async () => {
      const mockStory = {
        id: 'story-uuid-7',
        key: 'ST-400',
        epicId: null,
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEpic = {
        id: 'epic-uuid-9',
        key: 'EP-50',
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValue(mockEpic as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockEpic.id,
      } as any);

      // Simulate API failure
      mockRequestArtifactMove.mockRejectedValue(new Error('API error'));

      // Should not throw
      const result = await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockEpic.id,
      });

      // Story update should still succeed
      expect(result).toBeDefined();
      expect(result.id).toBe(mockStory.id);
    });

    it('should handle case when epic is not found', async () => {
      const mockStory = {
        id: 'story-uuid-8',
        key: 'ST-500',
        epicId: null,
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: 'epic-uuid-10',
      } as any);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: 'epic-uuid-10',
      });

      // Should not trigger move if epic not found
      expect(mockRequestArtifactMove).not.toHaveBeenCalled();
    });

    it('should log warning on artifact move failure but continue', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockStory = {
        id: 'story-uuid-9',
        key: 'ST-600',
        epicId: null,
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEpic = {
        id: 'epic-uuid-11',
        key: 'EP-60',
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValue(mockEpic as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockEpic.id,
      } as any);

      mockRequestArtifactMove.mockRejectedValue(new Error('Network timeout'));

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockEpic.id,
      });

      // Should log warning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ST-363] Failed to request artifact move')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Fire-and-Forget Pattern', () => {
    it('should not wait for artifact move to complete', async () => {
      const mockStory = {
        id: 'story-uuid-10',
        key: 'ST-700',
        epicId: null,
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEpic = {
        id: 'epic-uuid-12',
        key: 'EP-70',
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValue(mockEpic as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockEpic.id,
      } as any);

      // Simulate slow artifact move
      let moveCompleted = false;
      mockRequestArtifactMove.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        moveCompleted = true;
      });

      const result = await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockEpic.id,
      });

      // Should return immediately without waiting for move
      expect(result).toBeDefined();
      expect(moveCompleted).toBe(false);
    });
  });

  describe('Path Calculation', () => {
    it('should always use docs/ST-XXX as oldPath for direct story', async () => {
      const mockStory = {
        id: 'story-uuid-11',
        key: 'ST-800',
        epicId: null,
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEpic = {
        id: 'epic-uuid-13',
        key: 'EP-80',
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValue(mockEpic as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockEpic.id,
      } as any);

      mockRequestArtifactMove.mockResolvedValue(undefined);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockEpic.id,
      });

      expect(mockRequestArtifactMove).toHaveBeenCalledWith(
        expect.objectContaining({
          oldPath: 'docs/ST-800',
        })
      );
    });

    it('should use docs/EP-XXX/ST-YYY as newPath when assigning to epic', async () => {
      const mockStory = {
        id: 'story-uuid-12',
        key: 'ST-900',
        epicId: null,
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEpic = {
        id: 'epic-uuid-14',
        key: 'EP-90',
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.epic, 'findUnique').mockResolvedValue(mockEpic as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: mockEpic.id,
      } as any);

      mockRequestArtifactMove.mockResolvedValue(undefined);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: mockEpic.id,
      });

      expect(mockRequestArtifactMove).toHaveBeenCalledWith(
        expect.objectContaining({
          newPath: 'docs/EP-90/ST-900',
        })
      );
    });

    it('should use docs/unassigned/ST-YYY as newPath when removing epic', async () => {
      const mockStory = {
        id: 'story-uuid-13',
        key: 'ST-1000',
        epicId: 'epic-uuid-15',
        projectId: 'project-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.story, 'findUnique').mockResolvedValue(mockStory as any);
      jest.spyOn(prisma.story, 'update').mockResolvedValue({
        ...mockStory,
        epicId: null,
      } as any);

      mockRequestArtifactMove.mockResolvedValue(undefined);

      await updateStory(prisma, {
        story: mockStory.id,
        epicId: null,
      });

      expect(mockRequestArtifactMove).toHaveBeenCalledWith(
        expect.objectContaining({
          newPath: 'docs/unassigned/ST-1000',
        })
      );
    });
  });
});
