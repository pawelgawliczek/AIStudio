/**
 * Test Suite: update_workflow_status.ts (TC-EXEC-004)
 * Coverage Target: 80%+ of 409 LOC
 * Focus: Status transitions, orchestrator transcript parsing, metadata cleanup
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';
import { TranscriptsService } from '../../../../workflow-runs/transcripts.service';
import { ValidationError, NotFoundError } from '../../../types';
import { handler } from '../update_workflow_status';
import { fixtures, prismaMock, resetPrismaMock } from './test-setup';

// Mock fs module
jest.mock('fs');
jest.mock('readline');

// Mock TranscriptsService for ST-248 tests
jest.mock('../../../../workflow-runs/transcripts.service');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockReadline = readline as jest.Mocked<typeof readline>;

describe('update_workflow_status', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();

    // Default mock behavior for fs operations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);
  });

  // ========== VALIDATION TESTS ==========

  describe('Input Validation', () => {
    it('TC-EXEC-004-V1: should throw ValidationError when runId is missing', async () => {
      // ========== ARRANGE ==========
      const params = { status: 'completed' };

      // ========== ACT & ASSERT ==========
      await expect(handler(prismaMock as any, params)).rejects.toThrow(ValidationError);
      await expect(handler(prismaMock as any, params)).rejects.toThrow('Missing required parameter: runId');
    });

    it('TC-EXEC-004-V2: should throw ValidationError when status is missing', async () => {
      // ========== ARRANGE ==========
      const params = { runId: 'run-001' };

      // ========== ACT & ASSERT ==========
      await expect(handler(prismaMock as any, params)).rejects.toThrow(ValidationError);
      await expect(handler(prismaMock as any, params)).rejects.toThrow('Missing required parameter: status');
    });

    it('TC-EXEC-004-V3: should throw ValidationError for invalid status', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'invalid',
      };

      // ========== ACT & ASSERT ==========
      await expect(handler(prismaMock as any, params)).rejects.toThrow(ValidationError);
      await expect(handler(prismaMock as any, params)).rejects.toThrow('Invalid status value');
    });

    it('TC-EXEC-004-V4: should throw NotFoundError when workflow run not found', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'nonexistent-run',
        status: 'completed',
      };
      prismaMock.workflowRun.findUnique.mockResolvedValue(null);

      // ========== ACT & ASSERT ==========
      await expect(handler(prismaMock as any, params)).rejects.toThrow(NotFoundError);
    });
  });

  // ========== STATUS TRANSITION TESTS ==========

  describe('UC-EXEC-004: Workflow Lifecycle Management', () => {
    const FIXED_START_TIME = new Date('2025-01-01T10:00:00.000Z');

    const mockWorkflowRun = {
      ...fixtures.workflowRun,
      id: 'run-001',
      status: 'running' as const,
      startedAt: FIXED_START_TIME,
      finishedAt: null,
      workflow: fixtures.workflow,
      metadata: {},
    };

    it('TC-EXEC-004-U1: should parse orchestrator transcript and update metrics on completion', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'completed',
        summary: 'Workflow completed successfully',
      };

      const transcriptDir = '/tmp/transcripts';
      const transcriptFile = 'orchestrator.jsonl';
      const transcriptPath = path.join(transcriptDir, transcriptFile);

      const workflowWithTracking = {
        ...mockWorkflowRun,
        metadata: {
          _transcriptTracking: {
            transcriptDirectory: transcriptDir,
            orchestratorTranscript: transcriptFile,
          },
        },
      };

      // Mock orchestrator transcript content
      const transcriptLines = [
        JSON.stringify({
          type: 'user',
          timestamp: '2025-01-01T10:01:00Z',
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2025-01-01T10:02:00Z',
          usage: {
            input_tokens: 2000,
            output_tokens: 1000,
            cache_read_input_tokens: 500,
          },
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'execute_component',
              },
            ],
          },
        }),
        JSON.stringify({
          type: 'user',
          timestamp: '2025-01-01T10:03:00Z',
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2025-01-01T10:04:00Z',
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_creation_input_tokens: 200,
          },
          message: {
            content: [{
              type: 'tool_use',
              name: 'check_status',
            }],
          },
        }),
      ];

      const mockReadStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of transcriptLines) {
            yield line;
          }
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.createReadStream.mockReturnValue(mockReadStream as any);
      mockReadline.createInterface.mockReturnValue({
        [Symbol.asyncIterator]: mockReadStream[Symbol.asyncIterator],
      } as any);

      const orchestratorComponentRun = {
        id: 'orchestrator-comp-001',
        workflowRunId: 'run-001',
        componentId: 'orchestrator-001',
        executionOrder: 0,
        status: 'running' as const,
        startedAt: FIXED_START_TIME,
        finishedAt: null,
        metadata: {},
        totalTokens: 0,
        cost: 0,
      };

      const agentComponentRun = {
        id: 'agent-comp-001',
        workflowRunId: 'run-001',
        componentId: 'agent-001',
        executionOrder: 1,
        status: 'completed' as const,
        startedAt: FIXED_START_TIME,
        finishedAt: new Date('2025-01-01T10:05:00Z'),
        totalTokens: 5000,
        cost: 50,
      };

      const updatedOrchestratorComponentRun = {
        ...orchestratorComponentRun,
        status: 'completed' as const,
        finishedAt: new Date(),
        totalTokens: 4500,
        tokensInput: 3000,
        tokensOutput: 1500,
        cost: 0.03165,
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(workflowWithTracking as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...workflowWithTracking, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...workflowWithTracking, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(orchestratorComponentRun as any);
      prismaMock.componentRun.update.mockResolvedValue(updatedOrchestratorComponentRun as any);
      prismaMock.componentRun.findMany.mockResolvedValue([updatedOrchestratorComponentRun, agentComponentRun] as any);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.orchestratorMetrics).toBeDefined();
      expect(result.orchestratorMetrics.tokensInput).toBe(3000); // 2000 + 1000
      expect(result.orchestratorMetrics.tokensOutput).toBe(1500); // 1000 + 500
      expect(result.orchestratorMetrics.totalTokens).toBe(4500);
      expect(result.orchestratorMetrics.toolCalls).toBe(2);
      expect(result.orchestratorMetrics.userPrompts).toBe(2);
      expect(result.orchestratorMetrics.iterations).toBe(2);

      // Verify cost calculation: (3000 * $3/M) + (1500 * $15/M) + (500 * $0.30/M)
      // = $0.009 + $0.0225 + $0.00015 = $0.03165
      expect(result.orchestratorMetrics.costUsd).toBeCloseTo(0.03165, 4);

      // Verify orchestrator ComponentRun was updated
      expect(prismaMock.componentRun.update).toHaveBeenCalledWith({
        where: { id: orchestratorComponentRun.id },
        data: expect.objectContaining({
          status: 'completed',
          success: true,
          tokensInput: 3000,
          tokensOutput: 1500,
          totalTokens: 4500,
          toolCalls: 2,
          userPrompts: 2,
          systemIterations: 2,
        }),
      });

      // Verify finalMetrics aggregation
      expect(result.finalMetrics).toBeDefined();
      expect(result.finalMetrics.orchestratorTokens).toBe(4500);
      expect(result.finalMetrics.agentTokens).toBe(5000);
      expect(result.finalMetrics.totalTokens).toBe(9500); // orchestrator + agent
    });

    it('TC-EXEC-004-U2: should clean up _transcriptTracking metadata on terminal states', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'completed',
      };

      const workflowWithInternalData = {
        ...mockWorkflowRun,
        metadata: {
          _transcriptTracking: {
            transcriptDirectory: '/tmp/transcripts',
            orchestratorTranscript: 'file.jsonl',
          },
          userDefinedData: 'should be kept',
          otherField: 123,
        },
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(workflowWithInternalData as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...workflowWithInternalData, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...workflowWithInternalData, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(null);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      // ========== ACT ==========
      await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      // Verify that the second update (final metrics) cleaned the metadata
      const finalUpdate = (prismaMock.workflowRun.update as jest.Mock).mock.calls[1][0];
      expect(finalUpdate.data.metadata).toBeDefined();
      expect(finalUpdate.data.metadata._transcriptTracking).toBeUndefined();
      expect(finalUpdate.data.metadata.userDefinedData).toBe('should be kept');
      expect(finalUpdate.data.metadata.otherField).toBe(123);
    });

    it('TC-EXEC-004-I1: should separate orchestrator vs agent metrics correctly', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'completed',
      };

      // Orchestrator (executionOrder=0)
      const orchestratorRun = {
        id: 'orchestrator-run',
        workflowRunId: 'run-001',
        componentId: 'orchestrator-001',
        executionOrder: 0,
        status: 'completed' as const,
        totalTokens: 2000,
        tokensInput: 1500,
        tokensOutput: 500,
        cost: 10.5,
        userPrompts: 3,
        systemIterations: 5,
        toolCalls: 8,
        startedAt: FIXED_START_TIME,
        finishedAt: new Date(),
      };

      // Agent 1 (executionOrder=1)
      const agent1Run = {
        id: 'agent1-run',
        workflowRunId: 'run-001',
        componentId: 'agent-001',
        executionOrder: 1,
        status: 'completed' as const,
        totalTokens: 3000,
        tokensInput: 2000,
        tokensOutput: 1000,
        cost: 15.75,
        userPrompts: 0, // Agents don't count user prompts
        systemIterations: 10,
        startedAt: FIXED_START_TIME,
        finishedAt: new Date(),
      };

      // Agent 2 (executionOrder=2)
      const agent2Run = {
        id: 'agent2-run',
        workflowRunId: 'run-001',
        componentId: 'agent-002',
        executionOrder: 2,
        status: 'completed' as const,
        totalTokens: 5000,
        tokensInput: 3500,
        tokensOutput: 1500,
        cost: 25.25,
        userPrompts: 0, // Agents don't count user prompts
        systemIterations: 15,
        startedAt: FIXED_START_TIME,
        finishedAt: new Date(),
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(orchestratorRun as any);
      prismaMock.componentRun.update.mockResolvedValue(orchestratorRun as any);
      prismaMock.componentRun.findMany.mockResolvedValue([orchestratorRun, agent1Run, agent2Run] as any);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result.finalMetrics).toBeDefined();

      // Orchestrator metrics (executionOrder=0)
      expect(result.finalMetrics.orchestratorTokens).toBe(2000);
      expect(result.finalMetrics.orchestratorCost).toBe(10.5);

      // Agent metrics (executionOrder>0, sum of agent1 and agent2)
      expect(result.finalMetrics.agentTokens).toBe(8000); // 3000 + 5000
      expect(result.finalMetrics.agentCost).toBe(41); // 15.75 + 25.25

      // Total metrics (orchestrator + all agents)
      expect(result.finalMetrics.totalTokens).toBe(10000); // 2000 + 3000 + 5000
      expect(result.finalMetrics.totalCost).toBe(51.5); // 10.5 + 15.75 + 25.25

      // Component counts (only agents)
      expect(result.finalMetrics.totalComponents).toBe(2);
      expect(result.finalMetrics.componentsCompleted).toBe(2);
      expect(result.finalMetrics.componentsFailed).toBe(0);

      // Verify backward compatibility with coordinatorMetrics JSONB
      const finalUpdate = (prismaMock.workflowRun.update as jest.Mock).mock.calls[1][0];
      expect(finalUpdate.data.coordinatorMetrics).toBeDefined();
      expect(finalUpdate.data.totalTokens).toBe(10000);
      expect(finalUpdate.data.estimatedCost).toBe(51.5);
    });

    it('TC-EXEC-004-U3: should set finishedAt for terminal states only', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'paused',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({
        ...mockWorkflowRun,
        status: 'paused',
        finishedAt: null,
      } as any);

      // ========== ACT ==========
      const result1 = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result1.status).toBe('paused');
      const pauseUpdate = (prismaMock.workflowRun.update as jest.Mock).mock.calls[0][0];
      expect(pauseUpdate.data.finishedAt).toBeUndefined();

      jest.clearAllMocks();

      // Test terminal state (completed)
      const completedParams = { runId: 'run-001', status: 'completed' };
      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(null);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      const result2 = await handler(prismaMock as any, completedParams);
      expect(result2.status).toBe('completed');
      const completedUpdate = (prismaMock.workflowRun.update as jest.Mock).mock.calls[0][0];
      expect(completedUpdate.data.finishedAt).toBeInstanceOf(Date);
    });

    it('TC-EXEC-004-U4: should handle missing orchestrator transcript gracefully', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'completed',
      };

      const workflowWithInvalidTracking = {
        ...mockWorkflowRun,
        metadata: {
          _transcriptTracking: {
            transcriptDirectory: '/nonexistent/dir',
          },
        },
      };

      mockFs.existsSync.mockReturnValue(false);

      prismaMock.workflowRun.findUnique.mockResolvedValue(workflowWithInvalidTracking as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...workflowWithInvalidTracking, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...workflowWithInvalidTracking, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(null);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      // Should have default orchestrator metrics with zeros
      expect(result.orchestratorMetrics.tokensInput).toBe(0);
      expect(result.orchestratorMetrics.tokensOutput).toBe(0);
      expect(result.orchestratorMetrics.totalTokens).toBe(0);
      expect(result.orchestratorMetrics.costUsd).toBe(0);
    });

    it('TC-EXEC-004-U5: should handle malformed transcript lines gracefully', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'completed',
      };

      const transcriptDir = '/tmp/transcripts';
      const transcriptFile = 'orchestrator.jsonl';
      const transcriptPath = path.join(transcriptDir, transcriptFile);

      const workflowWithTracking = {
        ...mockWorkflowRun,
        metadata: {
          _transcriptTracking: {
            transcriptDirectory: transcriptDir,
            orchestratorTranscript: transcriptFile,
          },
        },
      };

      // Mix of valid and malformed lines
      const transcriptLines = [
        '{ invalid json',
        JSON.stringify({
          type: 'assistant',
          timestamp: '2025-01-01T10:01:00Z',
          usage: { input_tokens: 1000, output_tokens: 500 },
          message: { content: [] },
        }),
        'another bad line',
        JSON.stringify({
          type: 'user',
          timestamp: '2025-01-01T10:02:00Z',
        }),
      ];

      const mockReadStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of transcriptLines) {
            yield line;
          }
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.createReadStream.mockReturnValue(mockReadStream as any);
      mockReadline.createInterface.mockReturnValue({
        [Symbol.asyncIterator]: mockReadStream[Symbol.asyncIterator],
      } as any);

      prismaMock.workflowRun.findUnique.mockResolvedValue(workflowWithTracking as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...workflowWithTracking, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...workflowWithTracking, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(null);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      // Should only count valid lines
      expect(result.orchestratorMetrics.tokensInput).toBe(1000);
      expect(result.orchestratorMetrics.tokensOutput).toBe(500);
      expect(result.orchestratorMetrics.userPrompts).toBe(1);
    });
  });

  // ========== ST-248: Master Transcript Upload Tests ==========

  describe('ST-248: Master Transcript Upload', () => {
    const FIXED_START_TIME = new Date('2025-01-01T10:00:00.000Z');

    const mockWorkflowRun = {
      ...fixtures.workflowRun,
      id: 'run-001',
      status: 'running' as const,
      startedAt: FIXED_START_TIME,
      finishedAt: null,
      workflow: fixtures.workflow,
      metadata: {},
      masterTranscriptPaths: ['/tmp/master.jsonl'],
    };

    let mockUploadMasterTranscripts: jest.Mock;

    beforeEach(() => {
      // Reset TranscriptsService mock
      mockUploadMasterTranscripts = jest.fn().mockResolvedValue(['artifact-001']);
      (TranscriptsService as jest.Mock).mockImplementation(() => ({
        uploadMasterTranscripts: mockUploadMasterTranscripts,
      }));
    });

    it('TC-ST248-01: should upload master transcripts on workflow completion', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'completed',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(null);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(mockUploadMasterTranscripts).toHaveBeenCalledWith('run-001');
      expect(result.masterTranscripts).toBeDefined();
      expect(result.masterTranscripts.uploaded).toBe(1);
      expect(result.masterTranscripts.artifactIds).toEqual(['artifact-001']);
    });

    it('TC-ST248-02: should upload master transcripts on workflow failure', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'failed',
        errorMessage: 'Component failed',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'failed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'failed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(null);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(mockUploadMasterTranscripts).toHaveBeenCalledWith('run-001');
      expect(result.masterTranscripts).toBeDefined();
    });

    it('TC-ST248-03: should not upload master transcripts for non-terminal states', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'paused',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update.mockResolvedValue({ ...mockWorkflowRun, status: 'paused' } as any);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(mockUploadMasterTranscripts).not.toHaveBeenCalled();
      expect(result.masterTranscripts).toBeNull();
    });

    it('TC-ST248-04: should handle transcript upload failure gracefully', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'completed',
      };

      // Mock upload failure
      mockUploadMasterTranscripts.mockRejectedValue(new Error('Upload failed'));

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(null);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      // Workflow should still complete successfully
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      // masterTranscripts should indicate failure
      expect(result.masterTranscripts).toBeDefined();
      expect(result.masterTranscripts.uploaded).toBe(0);
    });

    it('TC-ST248-05: should handle no transcripts to upload', async () => {
      // ========== ARRANGE ==========
      const params = {
        runId: 'run-001',
        status: 'completed',
      };

      // Mock no transcripts returned
      mockUploadMasterTranscripts.mockResolvedValue([]);

      prismaMock.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun as any);
      prismaMock.workflowRun.update
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any)
        .mockResolvedValueOnce({ ...mockWorkflowRun, status: 'completed', finishedAt: new Date() } as any);
      prismaMock.componentRun.findFirst.mockResolvedValue(null);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      // ========== ACT ==========
      const result = await handler(prismaMock as any, params);

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(result.masterTranscripts).toBeDefined();
      expect(result.masterTranscripts.uploaded).toBe(0);
      expect(result.masterTranscripts.artifactIds).toBeUndefined();
    });
  });
});
