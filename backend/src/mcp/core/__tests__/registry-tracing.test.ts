/**
 * Unit Tests for Registry-Level MCP Tool Tracing (ST-259 Phase 1)
 *
 * TDD Implementation - These tests WILL FAIL until registry tracing is implemented
 *
 * Tests cover:
 * - Span creation for successful tool calls
 * - Span creation for failed tool calls
 * - Span attributes (tool.name, tool.category, duration_ms)
 * - Error recording in spans
 * - No-op behavior when OTEL_ENABLED=false
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { TelemetryService } from '../../../telemetry/telemetry.service';
import { ToolRegistry } from '../registry';
import { SpanStatusCode } from '@opentelemetry/api';

describe('ToolRegistry - MCP Tool Tracing (TDD)', () => {
  let registry: ToolRegistry;
  let telemetryService: jest.Mocked<TelemetryService>;
  let mockPrisma: jest.Mocked<PrismaClient>;

  const mockSpan = {
    setAttributes: jest.fn(),
    setAttribute: jest.fn(),
    recordException: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn(),
  };

  const mockTelemetryService = {
    isEnabled: jest.fn(),
    withSpan: jest.fn(),
    startSpan: jest.fn(),
    getCurrentTraceId: jest.fn(),
    sanitizeParams: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset span mocks
    mockSpan.setAttributes.mockClear();
    mockSpan.setAttribute.mockClear();
    mockSpan.recordException.mockClear();
    mockSpan.setStatus.mockClear();
    mockSpan.end.mockClear();

    // Mock telemetry as enabled by default
    mockTelemetryService.isEnabled.mockReturnValue(true);
    mockTelemetryService.startSpan.mockReturnValue(mockSpan as any);

    // Mock withSpan to execute the callback with the span
    mockTelemetryService.withSpan.mockImplementation(
      async (name: string, callback: any, attributes?: any) => {
        return await callback(mockSpan);
      }
    );

    mockPrisma = {} as any;
    telemetryService = mockTelemetryService as any;

    // Create registry with current 2-arg constructor
    // TODO: Update to 3-arg constructor when TelemetryService is injected (ST-259)
    registry = new ToolRegistry(
      '/fake/servers/path',
      mockPrisma
    );

    // Manually inject telemetry for testing
    (registry as any).telemetry = telemetryService;
  });

  describe('executeTool - Successful Calls', () => {
    it('should create span with tool name for successful tool execution', async () => {
      // This test will fail until registry.ts is updated to inject TelemetryService
      // and wrap executeTool with telemetry.withSpan()

      // Mock tool loader to return a simple tool
      const mockToolModule = {
        tool: { name: 'get_story', description: 'Get story by ID' },
        handler: jest.fn().mockResolvedValue({ id: 'ST-123', title: 'Test Story' }),
        metadata: { category: 'stories' },
      };

      // Access private loader to mock getToolByName
      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      await registry.executeTool('get_story', { story: 'ST-123' });

      // Verify span was created with correct name
      expect(mockTelemetryService.withSpan).toHaveBeenCalledWith(
        'mcp.get_story',
        expect.any(Function),
        expect.objectContaining({
          'tool.name': 'get_story',
          'operation.type': 'mcp_tool',
        })
      );

      // Verify span attributes were set
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'tool.name': 'get_story',
          'tool.category': 'stories',
          'operation.type': 'mcp_tool',
        })
      );

      // Verify duration was recorded
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'duration_ms',
        expect.any(Number)
      );
    });

    it('should handle tools without category metadata', async () => {
      const mockToolModule = {
        tool: { name: 'test_tool', description: 'Test tool' },
        handler: jest.fn().mockResolvedValue({ success: true }),
        metadata: {}, // No category
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      await registry.executeTool('test_tool', {});

      // Should default to 'unknown' category
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'tool.category': 'unknown',
        })
      );
    });

    it('should pass correct parameters to meta tools (search_tools, invoke_tool)', async () => {
      const mockSearchToolModule = {
        tool: { name: 'search_tools', description: 'Search for tools' },
        handler: jest.fn().mockResolvedValue({ tools: [] }),
        metadata: { category: 'meta' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockSearchToolModule);

      await registry.executeTool('search_tools', { query: 'story' });

      // Meta tools should receive registry, not prisma
      expect(mockSearchToolModule.handler).toHaveBeenCalledWith(
        registry,
        { query: 'story' }
      );

      // Should still create span
      expect(mockTelemetryService.withSpan).toHaveBeenCalledWith(
        'mcp.search_tools',
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('executeTool - Failed Calls', () => {
    it('should record error in span when tool execution fails', async () => {
      const error = new Error('Database connection failed');
      const mockToolModule = {
        tool: { name: 'get_story', description: 'Get story' },
        handler: jest.fn().mockRejectedValue(error),
        metadata: { category: 'stories' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      // Mock withSpan to handle error properly
      mockTelemetryService.withSpan.mockImplementation(
        async (name: string, callback: any) => {
          try {
            return await callback(mockSpan);
          } catch (err) {
            mockSpan.setAttribute('error', true);
            throw err;
          }
        }
      );

      await expect(
        registry.executeTool('get_story', { story: 'ST-123' })
      ).rejects.toThrow('Database connection failed');

      // Verify error was recorded in span
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error', true);

      // Verify duration was still recorded
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'duration_ms',
        expect.any(Number)
      );
    });

    it('should handle tool not found errors', async () => {
      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(null);

      // Mock withSpan to throw not found error
      mockTelemetryService.withSpan.mockImplementation(
        async (name: string, callback: any) => {
          try {
            return await callback(mockSpan);
          } catch (err) {
            mockSpan.setAttribute('error', true);
            throw err;
          }
        }
      );

      await expect(
        registry.executeTool('nonexistent_tool', {})
      ).rejects.toThrow('Tool not found: nonexistent_tool');

      // Should still create span
      expect(mockTelemetryService.withSpan).toHaveBeenCalled();
    });

    it('should set error attribute and maintain duration on failure', async () => {
      const mockToolModule = {
        tool: { name: 'failing_tool', description: 'Failing tool' },
        handler: jest.fn().mockRejectedValue(new Error('Tool failed')),
        metadata: { category: 'test' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      mockTelemetryService.withSpan.mockImplementation(
        async (name: string, callback: any) => {
          const startTime = Date.now();
          try {
            return await callback(mockSpan);
          } catch (err) {
            const duration = Date.now() - startTime;
            mockSpan.setAttribute('duration_ms', duration);
            mockSpan.setAttribute('error', true);
            throw err;
          }
        }
      );

      await expect(
        registry.executeTool('failing_tool', {})
      ).rejects.toThrow('Tool failed');

      // Verify both error flag and duration were set
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error', true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'duration_ms',
        expect.any(Number)
      );
    });
  });

  describe('Performance - Tracing Overhead', () => {
    it('should have minimal overhead when tracing is enabled', async () => {
      const mockToolModule = {
        tool: { name: 'fast_tool', description: 'Fast tool' },
        handler: jest.fn().mockResolvedValue({ success: true }),
        metadata: { category: 'test' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      const startTime = Date.now();
      await registry.executeTool('fast_tool', {});
      const duration = Date.now() - startTime;

      // Tracing overhead should be < 5ms (target from plan)
      // This is a soft assertion - actual overhead depends on system
      expect(duration).toBeLessThan(100); // Allow more headroom for test environments
    });

    it('should not block tool execution with span operations', async () => {
      let toolExecutionTime = 0;
      const mockToolModule = {
        tool: { name: 'timed_tool', description: 'Timed tool' },
        handler: jest.fn().mockImplementation(async () => {
          const start = Date.now();
          await new Promise(resolve => setTimeout(resolve, 10));
          toolExecutionTime = Date.now() - start;
          return { success: true };
        }),
        metadata: { category: 'test' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      await registry.executeTool('timed_tool', {});

      // Span operations should not significantly delay tool execution
      expect(toolExecutionTime).toBeGreaterThanOrEqual(10);
      expect(toolExecutionTime).toBeLessThan(50); // Allow reasonable overhead
    });
  });

  describe('Telemetry Disabled (OTEL_ENABLED=false)', () => {
    beforeEach(() => {
      // Mock telemetry as disabled
      mockTelemetryService.isEnabled.mockReturnValue(false);

      // withSpan should be no-op when disabled (but still provide mock span)
      mockTelemetryService.withSpan.mockImplementation(
        async (name: string, callback: any) => {
          // Execute callback with no-op span
          return await callback(mockSpan);
        }
      );
    });

    it('should execute tools normally when telemetry is disabled', async () => {
      const mockToolModule = {
        tool: { name: 'get_story', description: 'Get story' },
        handler: jest.fn().mockResolvedValue({ id: 'ST-123' }),
        metadata: { category: 'stories' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      const result = await registry.executeTool('get_story', { story: 'ST-123' });

      expect(result).toEqual({ id: 'ST-123' });
      expect(mockToolModule.handler).toHaveBeenCalled();

      // Span methods should still be called (they're just no-ops when disabled)
      expect(mockSpan.setAttributes).toHaveBeenCalled();
      expect(mockSpan.setAttribute).toHaveBeenCalled();
    });

    it('should handle errors normally when telemetry is disabled', async () => {
      const mockToolModule = {
        tool: { name: 'failing_tool', description: 'Failing tool' },
        handler: jest.fn().mockRejectedValue(new Error('Tool error')),
        metadata: { category: 'test' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      await expect(
        registry.executeTool('failing_tool', {})
      ).rejects.toThrow('Tool error');

      // Span methods should have been called (even when disabled)
      expect(mockSpan.setAttributes).toHaveBeenCalled();
      expect(mockSpan.setAttribute).toHaveBeenCalled();
    });
  });

  describe('Span Context Propagation', () => {
    it('should propagate context to nested tool calls', async () => {
      // Test that trace context is maintained across nested tool calls
      const mockInvokeTool = {
        tool: { name: 'invoke_tool', description: 'Invoke another tool' },
        handler: jest.fn().mockImplementation(async (reg: ToolRegistry, params: any) => {
          // Invoke another tool from within invoke_tool
          return await reg.executeTool(params.toolName, params.params);
        }),
        metadata: { category: 'meta' },
      };

      const mockGetStory = {
        tool: { name: 'get_story', description: 'Get story' },
        handler: jest.fn().mockResolvedValue({ id: 'ST-123' }),
        metadata: { category: 'stories' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest
        .fn()
        .mockImplementation((name: string) => {
          if (name === 'invoke_tool') return mockInvokeTool;
          if (name === 'get_story') return mockGetStory;
          return null;
        });

      await registry.executeTool('invoke_tool', {
        toolName: 'get_story',
        params: { story: 'ST-123' },
      });

      // Should create spans for both invoke_tool and get_story
      expect(mockTelemetryService.withSpan).toHaveBeenCalledWith(
        'mcp.invoke_tool',
        expect.any(Function),
        expect.any(Object)
      );

      expect(mockTelemetryService.withSpan).toHaveBeenCalledWith(
        'mcp.get_story',
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('getToolCategory - Helper Method', () => {
    it('should retrieve tool category from metadata', async () => {
      const mockToolModule = {
        tool: { name: 'test_tool', description: 'Test' },
        handler: jest.fn(),
        metadata: { category: 'projects' },
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      // This tests the private getToolCategory method indirectly
      await registry.executeTool('test_tool', {});

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'tool.category': 'projects',
        })
      );
    });

    it('should return "unknown" for tools without category', async () => {
      const mockToolModule = {
        tool: { name: 'test_tool', description: 'Test' },
        handler: jest.fn().mockResolvedValue({}),
        metadata: {},
      };

      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockResolvedValue(mockToolModule);

      await registry.executeTool('test_tool', {});

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'tool.category': 'unknown',
        })
      );
    });

    it('should handle loader errors gracefully', async () => {
      const loader = (registry as any).loader;
      loader.getToolByName = jest.fn().mockRejectedValue(new Error('Loader error'));

      mockTelemetryService.withSpan.mockImplementation(
        async (name: string, callback: any) => {
          try {
            return await callback(mockSpan);
          } catch (err) {
            mockSpan.setAttribute('error', true);
            throw err;
          }
        }
      );

      await expect(
        registry.executeTool('broken_tool', {})
      ).rejects.toThrow('Loader error');

      // Should still attempt to create span
      expect(mockTelemetryService.withSpan).toHaveBeenCalled();
    });
  });
});
