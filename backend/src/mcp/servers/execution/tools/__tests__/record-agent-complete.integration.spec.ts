/**
 * Integration Tests for record_agent_complete with Transcript Tailing (ST-176)
 *
 * Tests integration between record_agent_complete MCP tool and TranscriptTailService:
 * - Stop transcript tailing when agent completes
 * - Broadcast transcript:complete event
 * - Handle tailing cleanup errors gracefully
 * - Verify ComponentRun status update
 *
 * @see ST-176: Real-Time Agent Transcript Streaming in Web GUI
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../../prisma/prisma.service';

// Mock dependencies
const mockTranscriptTailService = {
  startTailing: jest.fn(),
  stopTailing: jest.fn(),
};

const mockWebSocketGateway = {
  broadcastComponentCompleted: jest.fn(),
  broadcastTranscriptComplete: jest.fn(),
};

const mockPrisma = {
  componentRun: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  workflowRun: {
    findUnique: jest.fn(),
  },
};

// Import after mocks
import { RecordAgentCompleteTool } from '../record-agent-complete.tool';
import { TranscriptTailService } from '../../../../../workflow-runs/transcript-tail.service';
import { AppWebSocketGateway } from '../../../../../websocket/websocket.gateway';

describe('RecordAgentCompleteTool - Transcript Tailing Integration (ST-176)', () => {
  let tool: RecordAgentCompleteTool;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordAgentCompleteTool,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: TranscriptTailService,
          useValue: mockTranscriptTailService,
        },
        {
          provide: AppWebSocketGateway,
          useValue: mockWebSocketGateway,
        },
      ],
    }).compile();

    tool = module.get<RecordAgentCompleteTool>(RecordAgentCompleteTool);

    // Setup default mocks
    mockPrisma.componentRun.findUnique.mockResolvedValue({
      id: 'component-run-789',
      componentId: 'component-456',
      workflowRunId: 'run-123',
      status: 'running',
      transcriptPath: '/path/to/transcript.jsonl',
    });

    mockPrisma.workflowRun.findUnique.mockResolvedValue({
      id: 'run-123',
      status: 'running',
      projectId: 'proj-123',
    });

    mockPrisma.componentRun.update.mockResolvedValue({
      id: 'component-run-789',
      status: 'completed',
    });
  });

  describe('Stop Tailing on Agent Complete', () => {
    const toolInput = {
      runId: 'run-123',
      componentId: 'component-456',
      status: 'completed' as const,
    };

    it('should stop transcript tailing when agent completes', async () => {
      await tool.execute(toolInput);

      expect(mockTranscriptTailService.stopTailing).toHaveBeenCalledWith('component-run-789');
    });

    it('should stop tailing BEFORE updating ComponentRun status', async () => {
      const callOrder: string[] = [];

      mockTranscriptTailService.stopTailing.mockImplementation(async () => {
        callOrder.push('stopTailing');
      });

      mockPrisma.componentRun.update.mockImplementation(async () => {
        callOrder.push('update');
        return { id: 'component-run-789', status: 'completed' };
      });

      await tool.execute(toolInput);

      expect(callOrder).toEqual(['stopTailing', 'update']);
    });

    it('should stop tailing when status is "failed"', async () => {
      await tool.execute({
        ...toolInput,
        status: 'failed',
        errorMessage: 'Agent crashed',
      });

      expect(mockTranscriptTailService.stopTailing).toHaveBeenCalledWith('component-run-789');
    });

    it('should not stop tailing if ComponentRun not found', async () => {
      mockPrisma.componentRun.findUnique.mockResolvedValue(null);

      await expect(tool.execute(toolInput)).rejects.toThrow('ComponentRun not found');
      expect(mockTranscriptTailService.stopTailing).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Broadcasts', () => {
    const toolInput = {
      runId: 'run-123',
      componentId: 'component-456',
      status: 'completed' as const,
    };

    it('should broadcast transcript:complete event', async () => {
      await tool.execute(toolInput);

      expect(mockWebSocketGateway.broadcastTranscriptComplete).toHaveBeenCalledWith(
        'component-run-789',
        expect.any(Number) // totalLines (calculated from file or estimated)
      );
    });

    it('should broadcast transcript:complete AFTER stopping tailing', async () => {
      const callOrder: string[] = [];

      mockTranscriptTailService.stopTailing.mockImplementation(async () => {
        callOrder.push('stopTailing');
      });

      mockWebSocketGateway.broadcastTranscriptComplete.mockImplementation(() => {
        callOrder.push('broadcastComplete');
      });

      await tool.execute(toolInput);

      expect(callOrder).toEqual(['stopTailing', 'broadcastComplete']);
    });

    it('should broadcast component:completed event', async () => {
      await tool.execute(toolInput);

      expect(mockWebSocketGateway.broadcastComponentCompleted).toHaveBeenCalledWith(
        'run-123',
        expect.any(String), // projectId
        expect.objectContaining({
          componentRunId: 'component-run-789',
          status: 'completed',
        })
      );
    });

    it('should broadcast component:completed AFTER transcript:complete', async () => {
      const callOrder: string[] = [];

      mockWebSocketGateway.broadcastTranscriptComplete.mockImplementation(() => {
        callOrder.push('transcriptComplete');
      });

      mockWebSocketGateway.broadcastComponentCompleted.mockImplementation(() => {
        callOrder.push('componentCompleted');
      });

      await tool.execute(toolInput);

      expect(callOrder).toEqual(['transcriptComplete', 'componentCompleted']);
    });
  });

  describe('Error Handling', () => {
    const toolInput = {
      runId: 'run-123',
      componentId: 'component-456',
      status: 'completed' as const,
    };

    it('should handle tailing cleanup errors gracefully', async () => {
      mockTranscriptTailService.stopTailing.mockRejectedValue(
        new Error('Watcher already closed')
      );

      // Should not throw - cleanup errors are logged but not critical
      await expect(tool.execute(toolInput)).resolves.not.toThrow();
    });

    it('should log tailing cleanup errors', async () => {
      const loggerSpy = jest.spyOn((tool as any).logger, 'warn');

      mockTranscriptTailService.stopTailing.mockRejectedValue(
        new Error('Cleanup failed')
      );

      await tool.execute(toolInput);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to stop transcript tailing'),
        expect.any(Error)
      );
    });

    it('should still update ComponentRun even if tailing cleanup fails', async () => {
      mockTranscriptTailService.stopTailing.mockRejectedValue(
        new Error('Cleanup failed')
      );

      const result = await tool.execute(toolInput);

      expect(result.success).toBe(true);
      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith({
        where: { id: 'component-run-789' },
        data: expect.objectContaining({
          status: 'completed',
        }),
      });
    });

    it('should still broadcast events if tailing cleanup fails', async () => {
      mockTranscriptTailService.stopTailing.mockRejectedValue(
        new Error('Cleanup failed')
      );

      await tool.execute(toolInput);

      expect(mockWebSocketGateway.broadcastTranscriptComplete).toHaveBeenCalled();
      expect(mockWebSocketGateway.broadcastComponentCompleted).toHaveBeenCalled();
    });
  });

  describe('Component Summary (ST-147)', () => {
    const toolInput = {
      runId: 'run-123',
      componentId: 'component-456',
      status: 'completed' as const,
      componentSummary: 'Implemented user authentication with JWT tokens',
    };

    it('should store component summary in ComponentRun', async () => {
      await tool.execute(toolInput);

      expect(mockPrisma.componentRun.update).toHaveBeenCalledWith({
        where: { id: 'component-run-789' },
        data: expect.objectContaining({
          componentSummary: toolInput.componentSummary,
        }),
      });
    });

    it('should include summary in broadcast data', async () => {
      await tool.execute(toolInput);

      expect(mockWebSocketGateway.broadcastComponentCompleted).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          componentSummary: toolInput.componentSummary,
        })
      );
    });
  });

  describe('Multiple Agents', () => {
    it('should handle concurrent agent completions', async () => {
      mockPrisma.componentRun.findUnique
        .mockResolvedValueOnce({ id: 'run-1', transcriptPath: '/path/1.jsonl' })
        .mockResolvedValueOnce({ id: 'run-2', transcriptPath: '/path/2.jsonl' });

      await Promise.all([
        tool.execute({
          runId: 'run-123',
          componentId: 'component-1',
          status: 'completed',
        }),
        tool.execute({
          runId: 'run-123',
          componentId: 'component-2',
          status: 'completed',
        }),
      ]);

      expect(mockTranscriptTailService.stopTailing).toHaveBeenCalledTimes(2);
      expect(mockTranscriptTailService.stopTailing).toHaveBeenCalledWith('run-1');
      expect(mockTranscriptTailService.stopTailing).toHaveBeenCalledWith('run-2');
    });

    it('should broadcast separate transcript:complete events', async () => {
      mockPrisma.componentRun.findUnique
        .mockResolvedValueOnce({ id: 'run-1' })
        .mockResolvedValueOnce({ id: 'run-2' });

      await Promise.all([
        tool.execute({
          runId: 'run-123',
          componentId: 'component-1',
          status: 'completed',
        }),
        tool.execute({
          runId: 'run-123',
          componentId: 'component-2',
          status: 'completed',
        }),
      ]);

      expect(mockWebSocketGateway.broadcastTranscriptComplete).toHaveBeenCalledTimes(2);
      expect(mockWebSocketGateway.broadcastTranscriptComplete).toHaveBeenCalledWith('run-1', expect.any(Number));
      expect(mockWebSocketGateway.broadcastTranscriptComplete).toHaveBeenCalledWith('run-2', expect.any(Number));
    });
  });

  describe('Transcript Not Present', () => {
    it('should skip tailing cleanup if no transcriptPath', async () => {
      mockPrisma.componentRun.findUnique.mockResolvedValue({
        id: 'component-run-789',
        transcriptPath: null, // No transcript
      });

      await tool.execute({
        runId: 'run-123',
        componentId: 'component-456',
        status: 'completed',
      });

      expect(mockTranscriptTailService.stopTailing).not.toHaveBeenCalled();
      expect(mockWebSocketGateway.broadcastTranscriptComplete).not.toHaveBeenCalled();
    });

    it('should still update ComponentRun when no transcript', async () => {
      mockPrisma.componentRun.findUnique.mockResolvedValue({
        id: 'component-run-789',
        transcriptPath: null,
      });

      await tool.execute({
        runId: 'run-123',
        componentId: 'component-456',
        status: 'completed',
      });

      expect(mockPrisma.componentRun.update).toHaveBeenCalled();
      expect(mockWebSocketGateway.broadcastComponentCompleted).toHaveBeenCalled();
    });
  });
});
