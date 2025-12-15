/**
 * Unit Tests for record_component_start
 * ST-69: Fix missing executionOrder field causing component work logs to not display
 */

import * as fs from 'fs';
import { handler } from '../record_component_start';
import { prismaMock, fixtures } from './test-setup';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('record_component_start - Unit Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);
  });

  describe('Input Validation', () => {
    it('should throw error when runId is missing', async () => {
      const params = {
        componentId: fixtures.component.id,
      };

      await expect(handler(prismaMock, params)).rejects.toThrow('runId is required');
    });

    it('should throw error when componentId is missing', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
      };

      await expect(handler(prismaMock, params)).rejects.toThrow('componentId is required');
    });

    it('should throw error when workflow run not found', async () => {
      const params = {
        runId: 'non-existent-run',
        componentId: fixtures.component.id,
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Workflow run with ID non-existent-run not found'
      );
    });

    it('should throw error when workflow run is not in running state', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: fixtures.component.id,
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        status: 'completed',
      } as any);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        `Workflow run ${fixtures.workflowRun.id} is not in running state. Current status: completed`
      );
    });

    it('should throw error when component not found', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: 'non-existent-component',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue(fixtures.workflowRun as any);
      prismaMock.component.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Component with ID non-existent-component not found'
      );
    });
  });

  describe('ST-69: Auto-increment executionOrder', () => {
    it('should set executionOrder to 1 for first component (after orchestrator)', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: fixtures.component.id,
        input: { test: 'data' },
      };

      // Mock workflow run with orchestrator (executionOrder=0)
      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {
          _transcriptTracking: {
            transcriptDirectory: '/test/transcripts',
          },
        },
      } as any);

      prismaMock.component.findUnique.mockResolvedValue(fixtures.component as any);

      // Mock existing component runs: only orchestrator with executionOrder=0
      prismaMock.componentRun.findMany.mockResolvedValue([
        {
          ...fixtures.componentRun,
          executionOrder: 0, // Orchestrator
        } as any,
      ]);

      const createdComponentRun = {
        ...fixtures.componentRun,
        id: 'new-comp-run-001',
        executionOrder: 1, // First regular component
        status: 'running',
        startedAt: new Date(),
      };

      prismaMock.componentRun.create.mockResolvedValue(createdComponentRun as any);

      const result = await handler(prismaMock, params);

      expect(result.success).toBe(true);
      expect(result.componentRunId).toBe('new-comp-run-001');
      expect(prismaMock.componentRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            executionOrder: 1, // ST-69: Should be set to 1
          }),
        })
      );
    });

    it('should set executionOrder to 2 for second component', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: 'comp-test-002',
        input: { test: 'data' },
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {},
      } as any);

      prismaMock.component.findUnique.mockResolvedValue({
        ...fixtures.component,
        id: 'comp-test-002',
        name: 'Second Component',
      } as any);

      // Mock existing component runs: orchestrator (0) and first component (1)
      prismaMock.componentRun.findMany.mockResolvedValue([
        {
          ...fixtures.componentRun,
          executionOrder: 1, // Highest existing order
        } as any,
      ]);

      const createdComponentRun = {
        ...fixtures.componentRun,
        id: 'new-comp-run-002',
        executionOrder: 2,
        status: 'running',
      };

      prismaMock.componentRun.create.mockResolvedValue(createdComponentRun as any);

      const result = await handler(prismaMock, params);

      expect(result.success).toBe(true);
      expect(prismaMock.componentRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            executionOrder: 2, // ST-69: Should increment to 2
          }),
        })
      );
    });

    it('should set executionOrder to 3 for third component', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: 'comp-test-003',
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {},
      } as any);

      prismaMock.component.findUnique.mockResolvedValue({
        ...fixtures.component,
        id: 'comp-test-003',
        name: 'Third Component',
      } as any);

      // Mock existing component runs: highest order is 2
      prismaMock.componentRun.findMany.mockResolvedValue([
        {
          ...fixtures.componentRun,
          executionOrder: 2, // Highest existing order
        } as any,
      ]);

      const createdComponentRun = {
        ...fixtures.componentRun,
        id: 'new-comp-run-003',
        executionOrder: 3,
        status: 'running',
      };

      prismaMock.componentRun.create.mockResolvedValue(createdComponentRun as any);

      await handler(prismaMock, params);

      expect(prismaMock.componentRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            executionOrder: 3, // ST-69: Should increment to 3
          }),
        })
      );
    });

    it('should handle null executionOrder in existing runs', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: fixtures.component.id,
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {},
      } as any);

      prismaMock.component.findUnique.mockResolvedValue(fixtures.component as any);

      // Mock existing component runs with null executionOrder (legacy data)
      prismaMock.componentRun.findMany.mockResolvedValue([
        {
          ...fixtures.componentRun,
          executionOrder: null, // Legacy data before ST-69 fix
        } as any,
      ]);

      const createdComponentRun = {
        ...fixtures.componentRun,
        id: 'new-comp-run-004',
        executionOrder: 1, // Should treat null as 0 and increment to 1
        status: 'running',
      };

      prismaMock.componentRun.create.mockResolvedValue(createdComponentRun as any);

      await handler(prismaMock, params);

      expect(prismaMock.componentRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            executionOrder: 1, // ST-69: Should handle null gracefully
          }),
        })
      );
    });

    it('should query existing runs in descending order by executionOrder', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: fixtures.component.id,
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {},
      } as any);

      prismaMock.component.findUnique.mockResolvedValue(fixtures.component as any);
      prismaMock.componentRun.findMany.mockResolvedValue([]);
      prismaMock.componentRun.create.mockResolvedValue({
        ...fixtures.componentRun,
        executionOrder: 1,
      } as any);

      await handler(prismaMock, params);

      expect(prismaMock.componentRun.findMany).toHaveBeenCalledWith({
        where: {
          workflowRunId: fixtures.workflowRun.id,
          executionOrder: { not: null }, // ST-69: Exclude NULL values
        },
        orderBy: { executionOrder: 'desc' },
        take: 1,
      });
    });
  });

  // ST-215: Transcript tracking feature was removed during refactor to shared agent-tracking module
  describe.skip('Transcript Tracking (Deprecated)', () => {
    it('should track existing transcripts when directory exists', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: fixtures.component.id,
      };

      const transcriptDir = '/test/transcripts';
      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {
          _transcriptTracking: {
            transcriptDirectory: transcriptDir,
          },
        },
      } as any);

      prismaMock.component.findUnique.mockResolvedValue(fixtures.component as any);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      // Mock fs to return existing transcripts
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'transcript1.jsonl',
        'transcript2.jsonl',
        'other.txt', // Should be filtered out
      ] as any);

      const createdComponentRun = {
        ...fixtures.componentRun,
        executionOrder: 1,
        metadata: {
          _transcriptTracking: {
            existingTranscriptsBeforeAgent: ['transcript1.jsonl', 'transcript2.jsonl'],
            transcriptDirectory: transcriptDir,
          },
        },
      };

      prismaMock.componentRun.create.mockResolvedValue(createdComponentRun as any);

      const result = await handler(prismaMock, params);

      expect(result.existingTranscripts).toBe(2);
      expect(mockFs.existsSync).toHaveBeenCalledWith(transcriptDir);
      expect(mockFs.readdirSync).toHaveBeenCalledWith(transcriptDir);
    });

    it('should handle missing transcript directory gracefully', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: fixtures.component.id,
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {
          _transcriptTracking: {
            transcriptDirectory: '/non/existent',
          },
        },
      } as any);

      prismaMock.component.findUnique.mockResolvedValue(fixtures.component as any);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      mockFs.existsSync.mockReturnValue(false);

      const createdComponentRun = {
        ...fixtures.componentRun,
        executionOrder: 1,
      };

      prismaMock.componentRun.create.mockResolvedValue(createdComponentRun as any);

      const result = await handler(prismaMock, params);

      expect(result.existingTranscripts).toBe(0);
    });
  });

  describe('Component Run Creation', () => {
    it('should create component run with all required fields', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: fixtures.component.id,
        input: { testKey: 'testValue' },
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {},
      } as any);

      prismaMock.component.findUnique.mockResolvedValue(fixtures.component as any);
      prismaMock.componentRun.findMany.mockResolvedValue([]);

      const createdComponentRun = {
        ...fixtures.componentRun,
        id: 'new-run-123',
        executionOrder: 1,
        status: 'running',
        inputData: { testKey: 'testValue' },
        startedAt: new Date(),
      };

      prismaMock.componentRun.create.mockResolvedValue(createdComponentRun as any);

      const result = await handler(prismaMock, params);

      expect(prismaMock.componentRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workflowRunId: params.runId,
            componentId: params.componentId,
            executionOrder: 1,
            status: 'running',
            inputData: { testKey: 'testValue' },
            userPrompts: 0,
            systemIterations: 1,
            humanInterventions: 0,
            iterationLog: [],
          }),
        })
      );

      expect(result.success).toBe(true);
      expect(result.componentRunId).toBe('new-run-123');
      expect(result.componentName).toBe(fixtures.component.name);
    });

    it('should use empty object for input when not provided', async () => {
      const params = {
        runId: fixtures.workflowRun.id,
        componentId: fixtures.component.id,
        // No input provided
      };

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        metadata: {},
      } as any);

      prismaMock.component.findUnique.mockResolvedValue(fixtures.component as any);
      prismaMock.componentRun.findMany.mockResolvedValue([]);
      prismaMock.componentRun.create.mockResolvedValue({
        ...fixtures.componentRun,
        executionOrder: 1,
      } as any);

      await handler(prismaMock, params);

      expect(prismaMock.componentRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inputData: {}, // Should default to empty object
          }),
        })
      );
    });
  });
});
