/**
 * Integration Tests for record_agent_start with Transcript Tailing (ST-176)
 *
 * Tests integration between record_agent_start MCP tool and TranscriptTailService:
 * - Start transcript tailing when agent starts
 * - Handle transcriptPath parameter
 * - Error handling when tailing fails
 * - Verify ComponentRun record creation with transcript metadata
 *
 * @see ST-176: Real-Time Agent Transcript Streaming in Web GUI
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { AppWebSocketGateway } from '../../../../../websocket/websocket.gateway';
import { TranscriptTailService } from '../../../../../workflow-runs/transcript-tail.service';
// eslint-disable-next-line import/no-unresolved
import { RecordAgentStartTool } from '../record-agent-start.tool';
// Mock dependencies
const mockTranscriptTailService = {
  startTailing: jest.fn(),
  stopTailing: jest.fn(),
};

const mockWebSocketGateway = {
  broadcastComponentStarted: jest.fn(),
};

const mockPrisma = {
  componentRun: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  workflowRun: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  component: {
    findUnique: jest.fn(),
  },
};

describe('RecordAgentStartTool - Transcript Tailing Integration (ST-176)', () => {
  let tool: RecordAgentStartTool;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordAgentStartTool,
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

    tool = module.get<RecordAgentStartTool>(RecordAgentStartTool);

    // Setup default mocks
    mockPrisma.workflowRun.findUnique.mockResolvedValue({
      id: 'run-123',
      status: 'running',
    });

    mockPrisma.component.findUnique.mockResolvedValue({
      id: 'component-456',
      name: 'TestAgent',
    });

    mockPrisma.componentRun.create.mockResolvedValue({
      id: 'component-run-789',
      componentId: 'component-456',
      workflowRunId: 'run-123',
      status: 'running',
      sessionId: 'session-abc',
      transcriptPath: '/path/to/transcript.jsonl',
    });
  });

  describe('Start Tailing on Agent Start', () => {
    const toolInput = {
      runId: 'run-123',
      componentId: 'component-456',
      input: {},
    };

    it('should start transcript tailing when transcriptPath provided', async () => {
      const transcriptPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';

      await tool.execute({
        ...toolInput,
        transcriptPath,
      });

      expect(mockTranscriptTailService.startTailing).toHaveBeenCalledWith(
        'component-run-789',
        transcriptPath
      );
    });

    it('should not start tailing when transcriptPath is null', async () => {
      await tool.execute(toolInput);

      expect(mockTranscriptTailService.startTailing).not.toHaveBeenCalled();
    });

    it('should not start tailing when transcriptPath is empty string', async () => {
      await tool.execute({
        ...toolInput,
        transcriptPath: '',
      });

      expect(mockTranscriptTailService.startTailing).not.toHaveBeenCalled();
    });

    it('should store transcriptPath in ComponentRun record', async () => {
      const transcriptPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';

      await tool.execute({
        ...toolInput,
        transcriptPath,
      });

      expect(mockPrisma.componentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transcriptPath,
        }),
      });
    });

    it('should start tailing AFTER creating ComponentRun record', async () => {
      const transcriptPath = '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl';
      const callOrder: string[] = [];

      mockPrisma.componentRun.create.mockImplementation(async () => {
        callOrder.push('create');
        return {
          id: 'component-run-789',
          transcriptPath,
        };
      });

      mockTranscriptTailService.startTailing.mockImplementation(async () => {
        callOrder.push('startTailing');
      });

      await tool.execute({
        ...toolInput,
        transcriptPath,
      });

      expect(callOrder).toEqual(['create', 'startTailing']);
    });
  });

  describe('Error Handling', () => {
    const toolInput = {
      runId: 'run-123',
      componentId: 'component-456',
      transcriptPath: '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl',
    };

    it('should handle file not found error from tailing service', async () => {
      mockTranscriptTailService.startTailing.mockRejectedValue(
        new Error('ENOENT: no such file')
      );

      // Should not throw - tailing failure is not critical
      await expect(tool.execute(toolInput)).resolves.not.toThrow();
    });

    it('should handle path traversal error from tailing service', async () => {
      mockTranscriptTailService.startTailing.mockRejectedValue(
        new Error('Transcript path not in allowed directory')
      );

      // Should not throw - validation error logged but agent continues
      await expect(tool.execute(toolInput)).resolves.not.toThrow();
    });

    it('should log tailing errors', async () => {
      const loggerSpy = jest.spyOn((tool as any).logger, 'warn');

      mockTranscriptTailService.startTailing.mockRejectedValue(
        new Error('File watcher error')
      );

      await tool.execute(toolInput);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start transcript tailing'),
        expect.any(Error)
      );
    });

    it('should still create ComponentRun even if tailing fails', async () => {
      mockTranscriptTailService.startTailing.mockRejectedValue(
        new Error('Tailing failed')
      );

      const result = await tool.execute(toolInput);

      expect(result).toHaveProperty('componentRunId', 'component-run-789');
      expect(mockPrisma.componentRun.create).toHaveBeenCalled();
    });

    it('should not fail agent execution if tailing fails', async () => {
      mockTranscriptTailService.startTailing.mockRejectedValue(
        new Error('Tailing failed')
      );

      const result = await tool.execute(toolInput);

      expect(result.success).toBe(true);
      expect(mockWebSocketGateway.broadcastComponentStarted).toHaveBeenCalled();
    });
  });

  describe('Transcript Metadata', () => {
    const toolInput = {
      runId: 'run-123',
      componentId: 'component-456',
      sessionId: 'session-abc',
      transcriptPath: '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl',
    };

    it('should store sessionId for transcript tracking', async () => {
      await tool.execute(toolInput);

      expect(mockPrisma.componentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'session-abc',
        }),
      });
    });

    it('should accept transcriptPath as absolute path', async () => {
      const absolutePath = '/opt/stack/AIStudio/.claude/projects/agent-123.jsonl';

      await tool.execute({
        ...toolInput,
        transcriptPath: absolutePath,
      });

      expect(mockTranscriptTailService.startTailing).toHaveBeenCalledWith(
        expect.any(String),
        absolutePath
      );
    });
  });

  describe('WebSocket Broadcast', () => {
    const toolInput = {
      runId: 'run-123',
      componentId: 'component-456',
      transcriptPath: '/Users/pawelgawliczek/.claude/projects/AIStudio/agent-123.jsonl',
    };

    it('should broadcast component:started event', async () => {
      await tool.execute(toolInput);

      expect(mockWebSocketGateway.broadcastComponentStarted).toHaveBeenCalledWith(
        'run-123',
        expect.any(String), // projectId
        expect.objectContaining({
          componentRunId: 'component-run-789',
          componentName: 'TestAgent',
        })
      );
    });

    it('should include transcriptPath in broadcast data', async () => {
      await tool.execute(toolInput);

      expect(mockWebSocketGateway.broadcastComponentStarted).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          transcriptPath: toolInput.transcriptPath,
        })
      );
    });
  });

  describe('Multiple Agents', () => {
    it('should handle concurrent agent starts', async () => {
      const transcriptPath1 = '/path/to/agent-1.jsonl';
      const transcriptPath2 = '/path/to/agent-2.jsonl';

      mockPrisma.componentRun.create
        .mockResolvedValueOnce({ id: 'run-1', transcriptPath: transcriptPath1 })
        .mockResolvedValueOnce({ id: 'run-2', transcriptPath: transcriptPath2 });

      await Promise.all([
        tool.execute({
          runId: 'run-123',
          componentId: 'component-1',
          transcriptPath: transcriptPath1,
        }),
        tool.execute({
          runId: 'run-123',
          componentId: 'component-2',
          transcriptPath: transcriptPath2,
        }),
      ]);

      expect(mockTranscriptTailService.startTailing).toHaveBeenCalledTimes(2);
      expect(mockTranscriptTailService.startTailing).toHaveBeenCalledWith('run-1', transcriptPath1);
      expect(mockTranscriptTailService.startTailing).toHaveBeenCalledWith('run-2', transcriptPath2);
    });
  });
});
