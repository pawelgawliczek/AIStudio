/**
 * Unit Tests for TranscriptsService (ST-173 Phase 2-3)
 *
 * TDD Implementation - These tests WILL FAIL until TranscriptsService is implemented
 *
 * Service Layer Requirements from ARCH_REVIEW:
 * - Business logic separation from MCP tools
 * - Quota enforcement (10MB per run, 100MB per project)
 * - Sensitive data redaction
 * - Encryption at rest
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';

// Service under test (will fail until implemented)
class TranscriptsService {
  constructor(
    private prisma: PrismaService,
    private remoteRunner: any,
    private securityService?: any,
  ) {}

  async uploadAgentTranscript(
    workflowRunId: string,
    componentId: string,
    transcriptPath: string,
  ): Promise<any> {
    throw new Error('Not implemented');
  }

  async uploadMasterTranscripts(workflowRunId: string): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async getTranscriptsForRun(runId: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async getTranscriptById(artifactId: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async validateQuota(workflowRunId: string, newSize: number): Promise<void> {
    throw new Error('Not implemented');
  }
}

describe('TranscriptsService - Business Logic (TDD)', () => {
  let service: TranscriptsService;
  let prismaService: jest.Mocked<PrismaService>;
  let mockRemoteRunner: any;

  const mockPrismaService = {
    artifact: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    artifactDefinition: {
      findFirst: jest.fn(),
    },
    workflowRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    componentRun: {
      update: jest.fn(),
    },
  };

  const mockRemoteRunnerService = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'RemoteRunner',
          useValue: mockRemoteRunnerService,
        },
      ],
    }).compile();

    service = module.get<TranscriptsService>(TranscriptsService);
    prismaService = module.get(PrismaService) as any;
    mockRemoteRunner = mockRemoteRunnerService;
  });

  describe('uploadAgentTranscript - Test Case 8: Quota Enforcement', () => {
    it('should enforce 10MB per-run quota', async () => {
      const runId = 'run-123';
      const componentId = 'comp-456';
      const transcriptPath = '/path/to/transcript.jsonl';

      // Mock existing transcripts total: 9MB
      mockPrismaService.artifact.aggregate.mockResolvedValue({
        _sum: { size: 9 * 1024 * 1024 },
      } as any);

      // Mock new transcript: 2MB (would exceed 10MB limit)
      mockRemoteRunner.execute.mockResolvedValue({
        content: 'x'.repeat(2 * 1024 * 1024),
        size: 2 * 1024 * 1024,
      });

      await expect(
        service.uploadAgentTranscript(runId, componentId, transcriptPath)
      ).rejects.toThrow(/Workflow run transcript quota exceeded.*10MB/i);

      // Should check quota BEFORE reading file
      expect(mockPrismaService.artifact.aggregate).toHaveBeenCalledWith({
        where: {
          workflowRunId: runId,
          definition: { key: 'TRANSCRIPT' },
        },
        _sum: { size: true },
      });
    });

    it('should enforce 100MB per-project quota', async () => {
      const runId = 'run-123';
      const projectId = 'proj-456';
      const componentId = 'comp-789';
      const transcriptPath = '/path/to/transcript.jsonl';

      // Mock workflow run
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        projectId,
        workflowId: 'wf-123',
      } as any);

      // Mock existing transcripts in run: 5MB (below run quota)
      mockPrismaService.artifact.aggregate
        .mockResolvedValueOnce({
          _sum: { size: 5 * 1024 * 1024 },
        } as any)
        // Mock project-wide transcripts: 98MB
        .mockResolvedValueOnce({
          _sum: { size: 98 * 1024 * 1024 },
        } as any);

      // Mock new transcript: 3MB (would exceed 100MB project limit)
      mockRemoteRunner.execute.mockResolvedValue({
        content: 'x'.repeat(3 * 1024 * 1024),
        size: 3 * 1024 * 1024,
      });

      await expect(
        service.uploadAgentTranscript(runId, componentId, transcriptPath)
      ).rejects.toThrow(/Project transcript quota exceeded.*100MB/i);
    });

    it('should accept uploads within quota', async () => {
      const runId = 'run-123';
      const projectId = 'proj-456';
      const componentId = 'comp-789';
      const transcriptPath = '/path/to/transcript.jsonl';

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        projectId,
        workflowId: 'wf-123',
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-123',
        key: 'TRANSCRIPT',
      } as any);

      // Mock existing quotas (well within limits)
      mockPrismaService.artifact.aggregate
        .mockResolvedValueOnce({ _sum: { size: 1 * 1024 * 1024 } } as any)
        .mockResolvedValueOnce({ _sum: { size: 10 * 1024 * 1024 } } as any);

      // Mock new transcript: 500KB
      const content = 'x'.repeat(500 * 1024);
      mockRemoteRunner.execute.mockResolvedValue({
        content,
        size: content.length,
      });

      mockPrismaService.artifact.create.mockResolvedValue({
        id: 'artifact-123',
        content,
        size: content.length,
      } as any);

      const result = await service.uploadAgentTranscript(runId, componentId, transcriptPath);

      expect(result).toHaveProperty('id', 'artifact-123');
      expect(mockPrismaService.artifact.create).toHaveBeenCalled();
    });
  });

  describe('uploadAgentTranscript - Test Case 6: API Key Redaction', () => {
    it('should redact API keys before storing', async () => {
      const contentWithKey = `Using API key: sk-1234567890abcdef1234567890abcdef
Another key: AKIA1234567890ABCDEF
And a JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U`;

      const runId = 'run-123';
      const componentId = 'comp-456';
      const transcriptPath = '/path/to/transcript.jsonl';

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        projectId: 'proj-123',
        workflowId: 'wf-123',
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-123',
      } as any);

      mockPrismaService.artifact.aggregate.mockResolvedValue({
        _sum: { size: 0 },
      } as any);

      mockRemoteRunner.execute.mockResolvedValue({
        content: contentWithKey,
        size: contentWithKey.length,
      });

      mockPrismaService.artifact.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'artifact-123',
          content: args.data.content,
        });
      });

      await service.uploadAgentTranscript(runId, componentId, transcriptPath);

      const createCall = mockPrismaService.artifact.create.mock.calls[0][0];
      const storedContent = createCall.data.content;

      // Should redact API keys
      expect(storedContent).toContain('[REDACTED-KEY]');
      expect(storedContent).not.toContain('sk-1234567890abcdef1234567890abcdef');
      expect(storedContent).not.toContain('AKIA1234567890ABCDEF');
      expect(storedContent).toContain('[REDACTED-JWT]');
    });

    it('should redact email addresses', async () => {
      const contentWithEmail = 'Contact: user@example.com for support';

      const runId = 'run-123';
      const componentId = 'comp-456';
      const transcriptPath = '/path/to/transcript.jsonl';

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        projectId: 'proj-123',
        workflowId: 'wf-123',
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-123',
      } as any);

      mockPrismaService.artifact.aggregate.mockResolvedValue({
        _sum: { size: 0 },
      } as any);

      mockRemoteRunner.execute.mockResolvedValue({
        content: contentWithEmail,
        size: contentWithEmail.length,
      });

      mockPrismaService.artifact.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'artifact-123',
          content: args.data.content,
        });
      });

      await service.uploadAgentTranscript(runId, componentId, transcriptPath);

      const createCall = mockPrismaService.artifact.create.mock.calls[0][0];
      const storedContent = createCall.data.content;

      expect(storedContent).toContain('[REDACTED-EMAIL]');
      expect(storedContent).not.toContain('user@example.com');
    });

    it('should track redaction in metadata', async () => {
      const contentWithSecrets = 'Password: secret123 and API key: sk-test';

      const runId = 'run-123';
      const componentId = 'comp-456';
      const transcriptPath = '/path/to/transcript.jsonl';

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        projectId: 'proj-123',
        workflowId: 'wf-123',
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-123',
      } as any);

      mockPrismaService.artifact.aggregate.mockResolvedValue({
        _sum: { size: 0 },
      } as any);

      mockRemoteRunner.execute.mockResolvedValue({
        content: contentWithSecrets,
        size: contentWithSecrets.length,
      });

      mockPrismaService.artifact.create.mockResolvedValue({
        id: 'artifact-123',
      } as any);

      await service.uploadAgentTranscript(runId, componentId, transcriptPath);

      expect(mockPrismaService.artifact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              redactionApplied: true,
            }),
          }),
        })
      );
    });
  });

  describe('uploadMasterTranscripts - Batch Upload', () => {
    it('should upload all master transcripts from WorkflowRun', async () => {
      const runId = 'run-123';
      const transcriptPaths = [
        '/path/to/transcript-0.jsonl',
        '/path/to/transcript-1.jsonl',
      ];

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: transcriptPaths,
        workflowId: 'wf-123',
        projectId: 'proj-123',
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-123',
      } as any);

      mockPrismaService.artifact.aggregate.mockResolvedValue({
        _sum: { size: 0 },
      } as any);

      mockRemoteRunner.execute
        .mockResolvedValueOnce({
          content: 'transcript 0 content',
          size: 19,
        })
        .mockResolvedValueOnce({
          content: 'transcript 1 content',
          size: 19,
        });

      mockPrismaService.artifact.create
        .mockResolvedValueOnce({ id: 'artifact-0' } as any)
        .mockResolvedValueOnce({ id: 'artifact-1' } as any);

      const artifactIds = await service.uploadMasterTranscripts(runId);

      expect(artifactIds).toEqual(['artifact-0', 'artifact-1']);
      expect(mockRemoteRunner.execute).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.artifact.create).toHaveBeenCalledTimes(2);
    });

    it('should continue on individual upload failure', async () => {
      const runId = 'run-123';
      const transcriptPaths = [
        '/path/to/transcript-0.jsonl',
        '/path/to/transcript-1.jsonl',
        '/path/to/transcript-2.jsonl',
      ];

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: transcriptPaths,
        workflowId: 'wf-123',
        projectId: 'proj-123',
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-123',
      } as any);

      mockPrismaService.artifact.aggregate.mockResolvedValue({
        _sum: { size: 0 },
      } as any);

      // First upload succeeds, second fails, third succeeds
      mockRemoteRunner.execute
        .mockResolvedValueOnce({ content: 'content 0', size: 9 })
        .mockRejectedValueOnce(new Error('Agent offline'))
        .mockResolvedValueOnce({ content: 'content 2', size: 9 });

      mockPrismaService.artifact.create
        .mockResolvedValueOnce({ id: 'artifact-0' } as any)
        .mockResolvedValueOnce({ id: 'artifact-2' } as any);

      const artifactIds = await service.uploadMasterTranscripts(runId);

      // Should return only successful uploads
      expect(artifactIds).toEqual(['artifact-0', 'artifact-2']);
      expect(artifactIds).toHaveLength(2);
    });

    it('should store artifact IDs in WorkflowRun metadata', async () => {
      const runId = 'run-123';

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        masterTranscriptPaths: ['/path/to/transcript.jsonl'],
        workflowId: 'wf-123',
        projectId: 'proj-123',
        metadata: { existing: 'data' },
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-123',
      } as any);

      mockPrismaService.artifact.aggregate.mockResolvedValue({
        _sum: { size: 0 },
      } as any);

      mockRemoteRunner.execute.mockResolvedValue({
        content: 'content',
        size: 7,
      });

      mockPrismaService.artifact.create.mockResolvedValue({
        id: 'artifact-123',
      } as any);

      await service.uploadMasterTranscripts(runId);

      expect(mockPrismaService.workflowRun.update).toHaveBeenCalledWith({
        where: { id: runId },
        data: {
          metadata: {
            existing: 'data',
            masterTranscriptArtifactIds: ['artifact-123'],
          },
        },
      });
    });
  });

  describe('getTranscriptsForRun - Grouping Master vs Agent', () => {
    it('should group transcripts by master vs agent', async () => {
      const runId = 'run-123';

      mockPrismaService.artifact.findMany.mockResolvedValue([
        {
          id: 'artifact-0',
          createdByComponentId: null, // Master
          contentPreview: 'Master transcript...',
          size: 1024,
          createdAt: new Date('2025-12-01'),
        },
        {
          id: 'artifact-1',
          createdByComponentId: 'comp-123', // Agent
          contentPreview: 'Agent transcript...',
          size: 2048,
          createdAt: new Date('2025-12-02'),
          component: { name: 'Developer' },
        },
        {
          id: 'artifact-2',
          createdByComponentId: null, // Master (after compaction)
          contentPreview: 'Master transcript 2...',
          size: 1536,
          createdAt: new Date('2025-12-03'),
        },
      ] as any);

      const result = await service.getTranscriptsForRun(runId);

      expect(result).toEqual({
        master: [
          expect.objectContaining({ artifactId: 'artifact-0', index: 0 }),
          expect.objectContaining({ artifactId: 'artifact-2', index: 1 }),
        ],
        agents: [
          expect.objectContaining({
            artifactId: 'artifact-1',
            componentId: 'comp-123',
            componentName: 'Developer',
          }),
        ],
      });
    });

    it('should handle workflow with no transcripts', async () => {
      const runId = 'run-123';

      mockPrismaService.artifact.findMany.mockResolvedValue([]);

      const result = await service.getTranscriptsForRun(runId);

      expect(result).toEqual({
        master: [],
        agents: [],
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle RemoteRunner offline gracefully', async () => {
      const runId = 'run-123';
      const componentId = 'comp-456';
      const transcriptPath = '/path/to/transcript.jsonl';

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        projectId: 'proj-123',
        workflowId: 'wf-123',
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-123',
      } as any);

      mockPrismaService.artifact.aggregate.mockResolvedValue({
        _sum: { size: 0 },
      } as any);

      mockRemoteRunner.execute.mockRejectedValue(new Error('Agent offline'));

      // Should NOT throw - just return null
      const result = await service.uploadAgentTranscript(runId, componentId, transcriptPath);

      expect(result).toBeNull();

      // Should update ComponentRun metadata with failure
      expect(mockPrismaService.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            metadata: expect.objectContaining({
              transcriptUploadFailed: true,
              transcriptUploadError: 'Agent offline',
            }),
          },
        })
      );
    });

    it('should handle missing artifact definition', async () => {
      const runId = 'run-123';
      const componentId = 'comp-456';
      const transcriptPath = '/path/to/transcript.jsonl';

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        projectId: 'proj-123',
        workflowId: 'wf-123',
      } as any);

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadAgentTranscript(runId, componentId, transcriptPath)
      ).rejects.toThrow(/TRANSCRIPT artifact definition not found/i);
    });
  });
});
