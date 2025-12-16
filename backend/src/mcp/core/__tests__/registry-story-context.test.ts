/**
 * Unit Tests for extractStoryContext() helper (ST-262 Phase 2)
 *
 * TDD Implementation - These tests WILL FAIL until extractStoryContext is implemented
 *
 * Tests cover:
 * - Story context extraction from storyId, story, runId, workflowRunId params
 * - Returns { 'story.id': uuid, 'story.key': ST-XXX } or empty object
 * - Never throws - gracefully handles all errors with logging
 * - Edge cases: invalid UUIDs, not found, null/undefined params
 */

import { PrismaClient, prismaMock, resetAllMocks } from '@prisma/client';
import { resolveStory, isUUID } from '../../shared/resolve-identifiers';

// Mock the resolve-identifiers module
jest.mock('../../shared/resolve-identifiers', () => {
  const actual = jest.requireActual('../../shared/resolve-identifiers');
  return {
    ...actual,
    resolveStory: jest.fn(),
    // Keep isUUID from actual implementation
    isUUID: actual.isUUID,
  };
});

// Mock console.warn to verify logging
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

/**
 * Helper to import and call the private extractStoryContext method
 * Uses registry instance to access the private method via type assertion
 */
async function callExtractStoryContext(params: any): Promise<Record<string, string>> {
  // Dynamic import to get the actual implementation
  const { ToolRegistry } = await import('../registry');
  const { TelemetryService } = await import('../../../telemetry/telemetry.service');

  // Create a mock telemetry service
  const mockTelemetry = {
    isEnabled: jest.fn().mockReturnValue(false),
    withSpan: jest.fn().mockImplementation(async (name: string, callback: any) => {
      const mockSpan = {
        setAttributes: jest.fn(),
        setAttribute: jest.fn(),
        recordException: jest.fn(),
        setStatus: jest.fn(),
        end: jest.fn(),
      };
      return await callback(mockSpan);
    }),
  } as unknown as TelemetryService;

  // Create registry instance
  const registry = new ToolRegistry('/fake/path', prismaMock, mockTelemetry);

  // Access the private method via type assertion
  const extractStoryContext = (registry as any).extractStoryContext.bind(registry);

  return await extractStoryContext(params);
}

describe('extractStoryContext - Story Context Extraction (TDD)', () => {
  const mockStory = {
    id: 'b1286e29-414b-406c-87a9-02b28bc3679a',
    key: 'ST-123',
    title: 'Test Story',
    status: 'impl',
    projectId: 'c0000000-0000-4000-a000-000000000000',
  };

  const mockWorkflowRun = {
    id: 'd0000000-0000-4000-a000-000000000001',
    workflowId: 'e0000000-0000-4000-a000-000000000002',
    status: 'running',
    storyId: 'b1286e29-414b-406c-87a9-02b28bc3679a',
    story: mockStory,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetAllMocks();
    mockConsoleWarn.mockClear();
  });

  afterAll(() => {
    mockConsoleWarn.mockRestore();
  });

  describe('Happy Path - Direct Story Parameters', () => {
    it('should extract story.id and story.key from storyId parameter (UUID)', async () => {
      // Mock Prisma to return story
      prismaMock.story.findUnique.mockResolvedValue(mockStory as any);

      const result = await callExtractStoryContext({
        storyId: 'b1286e29-414b-406c-87a9-02b28bc3679a',
      });

      expect(result).toEqual({
        'story.id': 'b1286e29-414b-406c-87a9-02b28bc3679a',
        'story.key': 'ST-123',
      });

      // Verify Prisma was called correctly
      expect(prismaMock.story.findUnique).toHaveBeenCalledWith({
        where: { id: 'b1286e29-414b-406c-87a9-02b28bc3679a' },
        select: {
          id: true,
          key: true,
        },
      });

      // No warnings should be logged on success
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should extract story.id and story.key from story parameter (ST-XXX key)', async () => {
      // Mock resolveStory to handle story key
      (resolveStory as jest.Mock).mockResolvedValue(mockStory);

      const result = await callExtractStoryContext({
        story: 'ST-123',
      });

      expect(result).toEqual({
        'story.id': 'b1286e29-414b-406c-87a9-02b28bc3679a',
        'story.key': 'ST-123',
      });

      // Verify resolveStory was called
      expect(resolveStory).toHaveBeenCalledWith(prismaMock, 'ST-123');

      // No warnings
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should extract story.id and story.key from story parameter (UUID)', async () => {
      // Mock resolveStory to handle UUID
      (resolveStory as jest.Mock).mockResolvedValue(mockStory);

      const result = await callExtractStoryContext({
        story: 'b1286e29-414b-406c-87a9-02b28bc3679a',
      });

      expect(result).toEqual({
        'story.id': 'b1286e29-414b-406c-87a9-02b28bc3679a',
        'story.key': 'ST-123',
      });

      // Verify resolveStory was called
      expect(resolveStory).toHaveBeenCalledWith(prismaMock, 'b1286e29-414b-406c-87a9-02b28bc3679a');

      // No warnings
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });

  describe('Happy Path - Run Parameters', () => {
    it('should extract story.id and story.key from runId parameter', async () => {
      // Mock WorkflowRun lookup
      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      const result = await callExtractStoryContext({
        runId: 'd0000000-0000-4000-a000-000000000001',
      });

      expect(result).toEqual({
        'story.id': 'b1286e29-414b-406c-87a9-02b28bc3679a',
        'story.key': 'ST-123',
      });

      // Verify Prisma was called correctly
      expect(prismaMock.workflowRun.findUnique).toHaveBeenCalledWith({
        where: { id: 'd0000000-0000-4000-a000-000000000001' },
        select: {
          storyId: true,
          story: {
            select: {
              id: true,
              key: true,
            },
          },
        },
      });

      // No warnings
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should extract story.id and story.key from workflowRunId parameter', async () => {
      // Mock WorkflowRun lookup (workflowRunId is alias for runId)
      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);

      const result = await callExtractStoryContext({
        workflowRunId: 'd0000000-0000-4000-a000-000000000001',
      });

      expect(result).toEqual({
        'story.id': 'b1286e29-414b-406c-87a9-02b28bc3679a',
        'story.key': 'ST-123',
      });

      // Should use runId path
      expect(prismaMock.workflowRun.findUnique).toHaveBeenCalledWith({
        where: { id: 'd0000000-0000-4000-a000-000000000001' },
        select: {
          storyId: true,
          story: {
            select: {
              id: true,
              key: true,
            },
          },
        },
      });

      // No warnings
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases - Empty and Invalid Inputs', () => {
    it('should return empty object when no story params present', async () => {
      const result = await callExtractStoryContext({
        someOtherParam: 'value',
        unrelated: 123,
      });

      expect(result).toEqual({});

      // No database calls should be made
      expect(prismaMock.story.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.workflowRun.findUnique).not.toHaveBeenCalled();
      expect(resolveStory).not.toHaveBeenCalled();

      // No warnings for missing params (it's valid to not have story context)
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should return empty object for invalid storyId (not UUID)', async () => {
      const result = await callExtractStoryContext({
        storyId: 'not-a-uuid',
      });

      expect(result).toEqual({});

      // Should log warning about invalid UUID
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[extractStoryContext] Invalid storyId format')
      );
    });

    it('should return empty object when story not found (storyId)', async () => {
      // Mock Prisma to return null (not found)
      prismaMock.story.findUnique.mockResolvedValue(null);

      const result = await callExtractStoryContext({
        storyId: 'f0000000-0000-4000-a000-000000000000',
      });

      expect(result).toEqual({});

      // Should log warning
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[extractStoryContext] Story not found')
      );
    });

    it('should return empty object when story not found (story key)', async () => {
      // Mock resolveStory to return null
      (resolveStory as jest.Mock).mockResolvedValue(null);

      const result = await callExtractStoryContext({
        story: 'ST-999',
      });

      expect(result).toEqual({});

      // Should log warning
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[extractStoryContext] Story not found')
      );
    });

    it('should return empty object when run not found', async () => {
      // Mock WorkflowRun lookup to return null
      prismaMock.workflowRun.findUnique.mockResolvedValue(null);

      const result = await callExtractStoryContext({
        runId: 'f1111111-0000-4000-a000-000000000001',
      });

      expect(result).toEqual({});

      // Should log warning
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[extractStoryContext] WorkflowRun not found')
      );
    });

    it('should return empty object when run has no story (storyId is null)', async () => {
      // Mock WorkflowRun with null storyId
      const runWithoutStory = {
        ...mockWorkflowRun,
        storyId: null,
        story: null,
      };
      prismaMock.workflowRun.findUnique.mockResolvedValue(runWithoutStory as any);

      const result = await callExtractStoryContext({
        runId: 'd0000000-0000-4000-a000-000000000001',
      });

      expect(result).toEqual({});

      // Should log warning about missing story
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[extractStoryContext] WorkflowRun has no associated story')
      );
    });
  });

  describe('Error Handling - Never Throws', () => {
    it('should not throw on database error (storyId lookup)', async () => {
      // Mock Prisma to throw error
      prismaMock.story.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const result = await callExtractStoryContext({
        storyId: 'b1286e29-414b-406c-87a9-02b28bc3679a',
      });

      expect(result).toEqual({});

      // Should log warning with error details
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[extractStoryContext] Error extracting story context'),
        expect.any(Error)
      );
    });

    it('should not throw on database error (story lookup)', async () => {
      // Mock resolveStory to throw error
      (resolveStory as jest.Mock).mockRejectedValue(new Error('Database timeout'));

      const result = await callExtractStoryContext({
        story: 'ST-123',
      });

      expect(result).toEqual({});

      // Should log warning
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[extractStoryContext] Error extracting story context'),
        expect.any(Error)
      );
    });

    it('should not throw on database error (runId lookup)', async () => {
      // Mock WorkflowRun lookup to throw error
      prismaMock.workflowRun.findUnique.mockRejectedValue(new Error('Query timeout'));

      const result = await callExtractStoryContext({
        runId: 'd0000000-0000-4000-a000-000000000001',
      });

      expect(result).toEqual({});

      // Should log warning
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[extractStoryContext] Error extracting story context'),
        expect.any(Error)
      );
    });

    it('should log warning when extraction fails', async () => {
      // Mock to return null (not found scenario)
      prismaMock.story.findUnique.mockResolvedValue(null);

      await callExtractStoryContext({
        storyId: 'f0000000-0000-4000-a000-000000000000',
      });

      // Should have logged warning
      expect(mockConsoleWarn).toHaveBeenCalled();
      expect(mockConsoleWarn.mock.calls[0][0]).toContain('[extractStoryContext]');
    });

    it('should handle null params gracefully', async () => {
      const result = await callExtractStoryContext({
        storyId: null,
        story: null,
        runId: null,
      });

      expect(result).toEqual({});

      // No database calls for null values
      expect(prismaMock.story.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.workflowRun.findUnique).not.toHaveBeenCalled();
      expect(resolveStory).not.toHaveBeenCalled();

      // No warnings for null (treated as missing)
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should handle undefined params gracefully', async () => {
      const result = await callExtractStoryContext({
        storyId: undefined,
        story: undefined,
        runId: undefined,
      });

      expect(result).toEqual({});

      // No database calls for undefined values
      expect(prismaMock.story.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.workflowRun.findUnique).not.toHaveBeenCalled();
      expect(resolveStory).not.toHaveBeenCalled();

      // No warnings for undefined (treated as missing)
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });

  describe('Parameter Priority', () => {
    it('should prioritize storyId over story parameter when both present', async () => {
      // Mock both lookups
      prismaMock.story.findUnique.mockResolvedValue(mockStory as any);
      (resolveStory as jest.Mock).mockResolvedValue({
        ...mockStory,
        key: 'ST-999',
      });

      const result = await callExtractStoryContext({
        storyId: 'b1286e29-414b-406c-87a9-02b28bc3679a',
        story: 'ST-999',
      });

      // Should use storyId (direct UUID lookup)
      expect(result).toEqual({
        'story.id': 'b1286e29-414b-406c-87a9-02b28bc3679a',
        'story.key': 'ST-123',
      });

      // storyId lookup should be called
      expect(prismaMock.story.findUnique).toHaveBeenCalled();

      // story lookup should not be called (lower priority)
      expect(resolveStory).not.toHaveBeenCalled();
    });

    it('should prioritize runId over storyId when both present', async () => {
      // Mock both lookups
      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.story.findUnique.mockResolvedValue({
        ...mockStory,
        key: 'ST-999',
      } as any);

      const result = await callExtractStoryContext({
        runId: 'd0000000-0000-4000-a000-000000000001',
        storyId: 'story-uuid-different',
      });

      // Should use runId (most specific context)
      expect(result).toEqual({
        'story.id': 'b1286e29-414b-406c-87a9-02b28bc3679a',
        'story.key': 'ST-123',
      });

      // runId lookup should be called
      expect(prismaMock.workflowRun.findUnique).toHaveBeenCalled();

      // storyId lookup should not be called (lower priority)
      expect(prismaMock.story.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('UUID Validation', () => {
    it('should validate UUID format for storyId parameter', async () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '12345',
        'ST-123',
        '',
        'invalid-uuid-format',
        '12345678-1234-1234-1234-123456789012', // valid length but wrong format
      ];

      for (const invalidUUID of invalidUUIDs) {
        mockConsoleWarn.mockClear();

        const result = await callExtractStoryContext({
          storyId: invalidUUID,
        });

        expect(result).toEqual({});
        expect(mockConsoleWarn).toHaveBeenCalled();
      }
    });

    it('should accept valid UUID v4 format for storyId', async () => {
      const validUUIDs = [
        'b1286e29-414b-406c-87a9-02b28bc3679a',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '550e8400-e29b-41d4-a716-446655440000',
      ];

      prismaMock.story.findUnique.mockResolvedValue(mockStory as any);

      for (const validUUID of validUUIDs) {
        mockConsoleWarn.mockClear();

        await callExtractStoryContext({
          storyId: validUUID,
        });

        // Should not log warnings about format
        const formatWarnings = mockConsoleWarn.mock.calls.filter(call =>
          call[0].includes('Invalid storyId format')
        );
        expect(formatWarnings).toHaveLength(0);
      }
    });
  });

  describe('Fallback Behavior', () => {
    it('should try story parameter if storyId fails', async () => {
      // Mock storyId lookup to return null
      prismaMock.story.findUnique.mockResolvedValue(null);

      // Mock story lookup to succeed
      (resolveStory as jest.Mock).mockResolvedValue(mockStory);

      const result = await callExtractStoryContext({
        storyId: 'f0000000-0000-4000-a000-000000000000',
        story: 'ST-123',
      });

      // Should NOT fallback - storyId has priority even when it fails
      expect(result).toEqual({});

      // Only storyId lookup should be attempted
      expect(prismaMock.story.findUnique).toHaveBeenCalled();
      expect(resolveStory).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Registry executeTool', () => {
    it('should be called during tool execution to enrich span attributes', async () => {
      // This test verifies that extractStoryContext integrates with executeTool
      // The actual integration happens in registry.ts executeTool method

      // Mock a tool execution with story context
      const { ToolRegistry } = await import('../registry');
      const { TelemetryService } = await import('../../../telemetry/telemetry.service');

      const mockSpan = {
        setAttributes: jest.fn(),
        setAttribute: jest.fn(),
        recordException: jest.fn(),
        setStatus: jest.fn(),
        end: jest.fn(),
      };

      const mockTelemetry = {
        isEnabled: jest.fn().mockReturnValue(true),
        withSpan: jest.fn().mockImplementation(async (name: string, callback: any, attrs?: any) => {
          return await callback(mockSpan);
        }),
      } as unknown as TelemetryService;

      const registry = new ToolRegistry('/fake/path', prismaMock, mockTelemetry);

      // Mock a simple tool
      const mockToolModule = {
        tool: { name: 'get_story', description: 'Get story' },
        handler: jest.fn().mockResolvedValue({ id: 'ST-123' }),
        metadata: { category: 'stories' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      // Mock story lookup
      prismaMock.story.findUnique.mockResolvedValue(mockStory as any);

      // Execute tool with story context
      await registry.executeTool('get_story', { storyId: 'b1286e29-414b-406c-87a9-02b28bc3679a' });

      // Verify withSpan was called with initial attributes
      expect(mockTelemetry.withSpan).toHaveBeenCalledWith(
        'mcp.get_story',
        expect.any(Function),
        expect.objectContaining({
          'tool.name': 'get_story',
          'operation.type': 'mcp_tool',
        })
      );

      // Verify story attributes were added to span
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'story.id': 'b1286e29-414b-406c-87a9-02b28bc3679a',
          'story.key': 'ST-123',
        })
      );
    });
  });
});
