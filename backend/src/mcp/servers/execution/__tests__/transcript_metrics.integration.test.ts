/**
 * Integration Test Suite: Universal Transcript Metrics (ST-117)
 * Tests the complete flow from get_transcript_metrics to record_component_complete
 * Focus: End-to-end data flow, transcriptMetrics parameter handling
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as readline from 'readline';
import { handler as getTranscriptMetricsHandler } from '../get_transcript_metrics';
import { handler as recordComponentCompleteHandler } from '../record_component_complete';
import { prismaMock, fixtures } from './test-setup';

// Mock modules
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('os');
jest.mock('readline');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsPromises = fsPromises as jest.Mocked<typeof fsPromises>;
const mockOs = os as jest.Mocked<typeof os>;
const mockReadline = readline as jest.Mocked<typeof readline>;

describe('ST-117: Universal Transcript Metrics Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SSH_CONNECTION;
    delete process.env.PROJECT_HOST_PATH;

    mockOs.homedir.mockReturnValue('/Users/testuser');
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ========== REMOTE MODE INTEGRATION ==========

  describe('Remote Mode Flow (MCP runs via SSH)', () => {
    beforeEach(() => {
      process.env.SSH_CONNECTION = '192.168.1.1 12345 192.168.1.2 22';
    });

    it('ST-117-INT-R1: should provide command that outputs metrics for record_component_complete', async () => {
      // ========== ARRANGE ==========
      const projectPath = '/Users/pawelgawliczek/projects/AIStudio';

      // ========== ACT ==========
      // Step 1: Call get_transcript_metrics (runs on MCP server)
      const metricsResult = await getTranscriptMetricsHandler(prismaMock as any, { projectPath });

      // ========== ASSERT ==========
      // Should return command for local execution
      expect(metricsResult.success).toBe(true);
      expect(metricsResult.runLocally).toBe(true);
      expect(metricsResult.command).toContain('npx tsx scripts/parse-transcript.ts');

      // The command should be executable and output JSON that can be parsed
      // In real scenario, Claude would run: metricsResult.command
      // Then parse the JSON output and pass to record_component_complete
    });

    it('ST-117-INT-R2: should handle transcriptMetrics parameter in record_component_complete', async () => {
      // ========== ARRANGE ==========
      // Simulated output from running parse-transcript.ts locally
      const transcriptMetrics = {
        inputTokens: 3000,
        outputTokens: 1300,
        cacheCreationTokens: 150,
        cacheReadTokens: 500,
        totalTokens: 4300,
        model: 'claude-3-5-sonnet-20241022',
      };

      const mockComponentRun = {
        ...fixtures.componentRun,
        id: 'comprun-001',
        workflowRunId: 'run-001',
        componentId: 'comp-001',
        status: 'running',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        finishedAt: null,
        executionOrder: 1,
        metadata: {},
        sessionId: null,
      };

      prismaMock.componentRun.findFirst.mockResolvedValue(mockComponentRun as any);
      prismaMock.component.findUnique.mockResolvedValue({ ...fixtures.component, name: 'Test Component' } as any);
      prismaMock.componentRun.update.mockResolvedValue({
        ...mockComponentRun,
        status: 'completed',
        finishedAt: new Date('2025-01-01T10:05:00Z'),
        totalTokens: 3000,
        tokensInput: 3000,
        tokensOutput: 1300,
      } as any);
      prismaMock.componentRun.findMany.mockResolvedValue([mockComponentRun] as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      // ========== ACT ==========
      // Step 2: Pass transcriptMetrics to record_component_complete
      const result = await recordComponentCompleteHandler(prismaMock as any, {
        runId: 'run-001',
        componentId: 'comp-001',
        transcriptMetrics,
      });

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('transcript_metrics');

      // Verify ComponentRun was updated with metrics
      expect(prismaMock.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokensInput: 3000,
            tokensOutput: 1300,
          }),
        })
      );
    });

    it('ST-117-INT-R3: should store cache tokens in metadata', async () => {
      // ========== ARRANGE ==========
      const transcriptMetrics = {
        inputTokens: 3000,
        outputTokens: 1300,
        cacheCreationTokens: 150,
        cacheReadTokens: 500,
        totalTokens: 4300,
      };

      const mockComponentRun = {
        ...fixtures.componentRun,
        id: 'comprun-001',
        workflowRunId: 'run-001',
        componentId: 'comp-001',
        status: 'running',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        metadata: { existingField: 'value' },
      };

      prismaMock.componentRun.findFirst.mockResolvedValue(mockComponentRun as any);
      prismaMock.component.findUnique.mockResolvedValue({ ...fixtures.component, name: 'Test' } as any);
      prismaMock.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' } as any);
      prismaMock.componentRun.findMany.mockResolvedValue([mockComponentRun] as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      // ========== ACT ==========
      const result = await recordComponentCompleteHandler(prismaMock as any, {
        runId: 'run-001',
        componentId: 'comp-001',
        transcriptMetrics,
      });

      // ========== ASSERT ==========
      expect(result.success).toBe(true);

      // Verify cache tokens were stored in metadata
      const updateCall = (prismaMock.componentRun.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.metadata).toEqual(
        expect.objectContaining({
          existingField: 'value',
          cacheTokens: {
            creation: 150,
            read: 500,
          },
        })
      );
    });
  });

  // ========== LOCAL MODE INTEGRATION ==========
  // Note: Full local mode parsing requires actual filesystem access.
  // These tests verify the integration between components when metrics are available.

  describe('Local Mode Flow (MCP runs locally)', () => {
    it('ST-117-INT-L1: should return error when no transcript files found locally', async () => {
      // ========== ARRANGE ==========
      const projectPath = '/Users/testuser/projects/MyProject';

      mockFs.existsSync.mockReturnValue(false);

      // ========== ACT ==========
      const result = await getTranscriptMetricsHandler(prismaMock as any, { projectPath });

      // ========== ASSERT ==========
      expect(result.success).toBe(false);
      expect(result.runLocally).toBe(false);
      expect(result.error).toContain('No transcript files found');
    });

    it('ST-117-INT-L2: should integrate transcript metrics with record_component_complete', async () => {
      // This test simulates the full flow where:
      // 1. get_transcript_metrics returns metrics (mocked as if local parsing succeeded)
      // 2. Those metrics are passed to record_component_complete

      // ========== ARRANGE ==========
      // Simulated successful local metrics (as if transcript was parsed)
      const localMetrics = {
        inputTokens: 3000,
        outputTokens: 1300,
        cacheCreationTokens: 150,
        cacheReadTokens: 500,
        totalTokens: 4300,
        model: 'claude-3-5-sonnet-20241022',
      };

      const mockComponentRun = {
        ...fixtures.componentRun,
        id: 'comprun-001',
        workflowRunId: 'run-001',
        componentId: 'comp-001',
        status: 'running',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        metadata: {},
      };

      prismaMock.componentRun.findFirst.mockResolvedValue(mockComponentRun as any);
      prismaMock.component.findUnique.mockResolvedValue({ ...fixtures.component, name: 'Test' } as any);
      prismaMock.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' } as any);
      prismaMock.componentRun.findMany.mockResolvedValue([mockComponentRun] as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      // ========== ACT ==========
      // Pass local metrics to record_component_complete
      const result = await recordComponentCompleteHandler(prismaMock as any, {
        runId: 'run-001',
        componentId: 'comp-001',
        transcriptMetrics: {
          inputTokens: localMetrics.inputTokens,
          outputTokens: localMetrics.outputTokens,
          cacheCreationTokens: localMetrics.cacheCreationTokens,
          cacheReadTokens: localMetrics.cacheReadTokens,
          totalTokens: localMetrics.totalTokens,
        },
      });

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('transcript_metrics');

      // Verify ComponentRun was updated with correct metrics
      expect(prismaMock.componentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokensInput: 3000,
            tokensOutput: 1300,
          }),
        })
      );
    });
  });

  // ========== PRIORITY HANDLING ==========

  describe('Data Source Priority', () => {
    const mockComponentRun = {
      ...fixtures.componentRun,
      id: 'comprun-001',
      workflowRunId: 'run-001',
      componentId: 'comp-001',
      status: 'running',
      startedAt: new Date('2025-01-01T10:00:00Z'),
      metadata: {},
    };

    beforeEach(() => {
      prismaMock.componentRun.findFirst.mockResolvedValue(mockComponentRun as any);
      prismaMock.component.findUnique.mockResolvedValue({ ...fixtures.component, name: 'Test' } as any);
      prismaMock.componentRun.update.mockResolvedValue({ ...mockComponentRun, status: 'completed' } as any);
      prismaMock.componentRun.findMany.mockResolvedValue([mockComponentRun] as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);
    });

    it('ST-117-INT-P1: contextOutput should take priority over transcriptMetrics', async () => {
      // ========== ARRANGE ==========
      const contextOutput = `## Token Usage

| Category | Tokens |
|----------|--------|
| Input | 5,000 |
| Output | 2,500 |
| System prompt | 1,000 |
| System tools | 500 |`;

      const transcriptMetrics = {
        inputTokens: 3000,
        outputTokens: 1300,
        totalTokens: 4300,
      };

      // ========== ACT ==========
      const result = await recordComponentCompleteHandler(prismaMock as any, {
        runId: 'run-001',
        componentId: 'comp-001',
        contextOutput,
        transcriptMetrics,
      });

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('context');
      // contextOutput metrics should be used, not transcriptMetrics
    });

    it('ST-117-INT-P2: transcriptMetrics should be used when no contextOutput', async () => {
      // ========== ARRANGE ==========
      const transcriptMetrics = {
        inputTokens: 3000,
        outputTokens: 1300,
        totalTokens: 4300,
      };

      // ========== ACT ==========
      const result = await recordComponentCompleteHandler(prismaMock as any, {
        runId: 'run-001',
        componentId: 'comp-001',
        transcriptMetrics,
      });

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('transcript_metrics');
    });

    it('ST-117-INT-P3: dataSource should be none when no metrics provided', async () => {
      // ========== ARRANGE & ACT ==========
      const result = await recordComponentCompleteHandler(prismaMock as any, {
        runId: 'run-001',
        componentId: 'comp-001',
      });

      // ========== ASSERT ==========
      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('none');
    });
  });

  // ========== WORKFLOW AGGREGATION ==========

  describe('Workflow Metrics Aggregation', () => {
    it('ST-117-INT-A1: should aggregate transcriptMetrics into workflow totals', async () => {
      // ========== ARRANGE ==========
      const mockComponentRun1 = {
        ...fixtures.componentRun,
        id: 'comprun-001',
        workflowRunId: 'run-001',
        componentId: 'comp-001',
        status: 'running',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        metadata: {},
      };

      const completedRuns = [
        { ...mockComponentRun1, status: 'completed', totalTokens: 5000, durationSeconds: 100 },
      ];

      prismaMock.componentRun.findFirst.mockResolvedValue(mockComponentRun1 as any);
      prismaMock.component.findUnique.mockResolvedValue({ ...fixtures.component, name: 'Test' } as any);
      prismaMock.componentRun.update.mockResolvedValue({
        ...mockComponentRun1,
        status: 'completed',
        totalTokens: 3000,
        durationSeconds: 50,
      } as any);
      prismaMock.componentRun.findMany.mockResolvedValue([
        ...completedRuns,
        { ...mockComponentRun1, status: 'completed', totalTokens: 3000, durationSeconds: 50 },
      ] as any);
      prismaMock.workflowRun.update.mockResolvedValue({} as any);

      // ========== ACT ==========
      const result = await recordComponentCompleteHandler(prismaMock as any, {
        runId: 'run-001',
        componentId: 'comp-001',
        transcriptMetrics: {
          inputTokens: 3000,
          outputTokens: 1300,
          totalTokens: 4300,
        },
      });

      // ========== ASSERT ==========
      expect(result.success).toBe(true);

      // Verify WorkflowRun was updated with aggregated totals
      expect(prismaMock.workflowRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-001' },
          data: expect.objectContaining({
            totalTokens: expect.any(Number),
            durationSeconds: expect.any(Number),
          }),
        })
      );
    });
  });
});
