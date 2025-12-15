/**
 * ST-239: TDD Tests for metrics-aggregation.service.ts
 * Integration tests for metrics aggregation service
 * Tests aggregation by workflow, story, epic, and agent
 */

import { Test, TestingModule } from '@nestjs/testing';
import { v4 as uuidv4 } from 'uuid';
import { ComprehensiveMetricsCalculator } from '../../calculators/comprehensive-metrics.calculator';
import { MetricsAggregationService } from '../metrics-aggregation.service';

describe('MetricsAggregationService', () => {
  let service: MetricsAggregationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsAggregationService,
        ComprehensiveMetricsCalculator,
      ],
    }).compile();

    service = module.get<MetricsAggregationService>(MetricsAggregationService);
  });

  describe('aggregateByWorkflow', () => {
    it('should group workflow runs by workflow ID', () => {
      const workflow1Id = uuidv4();
      const workflow2Id = uuidv4();

      const workflowRuns = [
        createWorkflowRun({ workflowId: workflow1Id, workflow: { name: 'Workflow 1' } }),
        createWorkflowRun({ workflowId: workflow1Id, workflow: { name: 'Workflow 1' } }),
        createWorkflowRun({ workflowId: workflow2Id, workflow: { name: 'Workflow 2' } }),
      ];

      const result = service.aggregateByWorkflow(workflowRuns);

      expect(result).toHaveLength(2);
      const workflow1 = result.find(r => r.workflowId === workflow1Id);
      const workflow2 = result.find(r => r.workflowId === workflow2Id);
      expect(workflow1?.totalRuns).toBe(2);
      expect(workflow2?.totalRuns).toBe(1);
    });

    it('should include workflow name', () => {
      const workflowId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({ workflowId, workflow: { name: 'Test Workflow' } }),
      ];

      const result = service.aggregateByWorkflow(workflowRuns);

      expect(result[0].workflowName).toBe('Test Workflow');
    });

    it('should calculate metrics for each workflow', () => {
      const workflowId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({
          workflowId,
          componentRuns: [
            createComponentRun({ tokensInput: 1000, tokensOutput: 500 }),
          ],
        }),
      ];

      const result = service.aggregateByWorkflow(workflowRuns);

      expect(result[0].metrics).toBeDefined();
      expect(result[0].metrics.tokens).toBeDefined();
      expect(result[0].metrics.tokens.totalTokens).toBe(1500);
    });

    it('should handle workflow runs with no workflow reference', () => {
      const workflowRuns = [
        createWorkflowRun({ workflow: null }),
      ];

      const result = service.aggregateByWorkflow(workflowRuns);

      expect(result[0].workflowName).toBe('Unknown');
    });

    it('should handle empty workflow runs array', () => {
      const workflowRuns: any[] = [];

      const result = service.aggregateByWorkflow(workflowRuns);

      expect(result).toEqual([]);
    });
  });

  describe('aggregateByStory', () => {
    it('should group workflow runs by story ID', () => {
      const story1Id = uuidv4();
      const story2Id = uuidv4();

      const workflowRuns = [
        createWorkflowRun({ storyId: story1Id, story: { key: 'ST-1', title: 'Story 1' } }),
        createWorkflowRun({ storyId: story1Id, story: { key: 'ST-1', title: 'Story 1' } }),
        createWorkflowRun({ storyId: story2Id, story: { key: 'ST-2', title: 'Story 2' } }),
      ];

      const result = service.aggregateByStory(workflowRuns);

      expect(result).toHaveLength(2);
      const story1 = result.find(r => r.storyId === story1Id);
      expect(story1?.storyKey).toBe('ST-1');
    });

    it('should include story metadata', () => {
      const storyId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({
          storyId,
          story: {
            key: 'ST-123',
            title: 'Test Story',
            businessComplexity: 5,
            technicalComplexity: 7,
          },
        }),
      ];

      const result = service.aggregateByStory(workflowRuns);

      expect(result[0].storyKey).toBe('ST-123');
      expect(result[0].storyTitle).toBe('Test Story');
      expect(result[0].businessComplexity).toBe(5);
      expect(result[0].technicalComplexity).toBe(7);
    });

    it('should skip workflow runs without story ID', () => {
      const storyId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({ storyId: null }),
        createWorkflowRun({ storyId, story: { key: 'ST-1', title: 'Story 1' } }),
      ];

      const result = service.aggregateByStory(workflowRuns);

      expect(result).toHaveLength(1);
      expect(result[0].storyId).toBe(storyId);
    });

    it('should use default complexity when not provided', () => {
      const workflowRuns = [
        createWorkflowRun({
          storyId: uuidv4(),
          story: { key: 'ST-1', title: 'Story 1' },
        }),
      ];

      const result = service.aggregateByStory(workflowRuns);

      expect(result[0].businessComplexity).toBe(3);
      expect(result[0].technicalComplexity).toBe(3);
    });

    it('should calculate metrics for each story', () => {
      const storyId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({
          storyId,
          story: { key: 'ST-1', title: 'Story 1' },
          componentRuns: [
            createComponentRun({ tokensInput: 2000, tokensOutput: 1000 }),
          ],
        }),
      ];

      const result = service.aggregateByStory(workflowRuns);

      expect(result[0].metrics).toBeDefined();
      expect(result[0].metrics.tokens.totalTokens).toBe(3000);
    });
  });

  describe('aggregateByEpic', () => {
    it('should group workflow runs by epic ID', () => {
      const epic1Id = uuidv4();
      const epic2Id = uuidv4();

      const workflowRuns = [
        createWorkflowRun({
          story: {
            epicId: epic1Id,
            epic: { key: 'EP-1', title: 'Epic 1' },
          },
        }),
        createWorkflowRun({
          story: {
            epicId: epic1Id,
            epic: { key: 'EP-1', title: 'Epic 1' },
          },
        }),
        createWorkflowRun({
          story: {
            epicId: epic2Id,
            epic: { key: 'EP-2', title: 'Epic 2' },
          },
        }),
      ];

      const result = service.aggregateByEpic(workflowRuns);

      expect(result).toHaveLength(2);
      const epic1 = result.find(r => r.epicId === epic1Id);
      const epic2 = result.find(r => r.epicId === epic2Id);
      expect(epic1).toBeDefined();
      expect(epic2).toBeDefined();
    });

    it('should include epic metadata', () => {
      const epicId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({
          story: {
            epicId,
            epic: { key: 'EP-123', title: 'Test Epic' },
          },
        }),
      ];

      const result = service.aggregateByEpic(workflowRuns);

      expect(result[0].epicKey).toBe('EP-123');
      expect(result[0].epicTitle).toBe('Test Epic');
    });

    it('should count unique stories per epic', () => {
      const epicId = uuidv4();
      const story1Id = uuidv4();
      const story2Id = uuidv4();

      const workflowRuns = [
        createWorkflowRun({
          storyId: story1Id,
          story: { epicId, epic: { key: 'EP-1', title: 'Epic 1' } },
        }),
        createWorkflowRun({
          storyId: story1Id,
          story: { epicId, epic: { key: 'EP-1', title: 'Epic 1' } },
        }),
        createWorkflowRun({
          storyId: story2Id,
          story: { epicId, epic: { key: 'EP-1', title: 'Epic 1' } },
        }),
      ];

      const result = service.aggregateByEpic(workflowRuns);

      expect(result[0].totalStories).toBe(2); // 2 unique stories
    });

    it('should skip workflow runs without epic ID', () => {
      const epicId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({ story: { epicId: null } }),
        createWorkflowRun({
          story: {
            epicId,
            epic: { key: 'EP-1', title: 'Epic 1' },
          },
        }),
      ];

      const result = service.aggregateByEpic(workflowRuns);

      expect(result).toHaveLength(1);
      expect(result[0].epicId).toBe(epicId);
    });

    it('should calculate metrics for each epic', () => {
      const epicId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({
          story: {
            epicId,
            epic: { key: 'EP-1', title: 'Epic 1' },
          },
          componentRuns: [
            createComponentRun({ tokensInput: 3000, tokensOutput: 1500 }),
          ],
        }),
      ];

      const result = service.aggregateByEpic(workflowRuns);

      expect(result[0].metrics).toBeDefined();
      expect(result[0].metrics.tokens.totalTokens).toBe(4500);
    });
  });

  describe('aggregateByAgent', () => {
    it('should group by component/agent', () => {
      const component1Id = uuidv4();
      const component2Id = uuidv4();

      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ componentId: component1Id, component: { name: 'PM Agent' } }),
            createComponentRun({ componentId: component2Id, component: { name: 'Developer Agent' } }),
          ],
        }),
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ componentId: component1Id, component: { name: 'PM Agent' } }),
          ],
        }),
      ];

      const result = service.aggregateByAgent(workflowRuns);

      expect(result).toHaveLength(2);
      const pmAgent = result.find((r) => r.agentName === 'PM Agent');
      const devAgent = result.find((r) => r.agentName === 'Developer Agent');

      expect(pmAgent).toBeDefined();
      expect(pmAgent!.totalExecutions).toBe(2);
      expect(devAgent).toBeDefined();
      expect(devAgent!.totalExecutions).toBe(1);
    });

    it('should include agent name from component', () => {
      const componentId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ componentId, component: { name: 'Architect Agent' } }),
          ],
        }),
      ];

      const result = service.aggregateByAgent(workflowRuns);

      expect(result[0].agentName).toBe('Architect Agent');
      expect(result[0].componentId).toBe(componentId);
    });

    it('should handle component runs without component reference', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [createComponentRun({ component: null })],
        }),
      ];

      const result = service.aggregateByAgent(workflowRuns);

      expect(result[0].agentName).toBe('Unknown Agent');
    });

    it('should calculate metrics for each agent', () => {
      const componentId = uuidv4();
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({
              componentId,
              component: { name: 'Test Agent' },
              tokensInput: 1000,
              tokensOutput: 500,
            }),
          ],
        }),
      ];

      const result = service.aggregateByAgent(workflowRuns);

      expect(result[0].metrics).toBeDefined();
      expect(result[0].metrics.tokens.totalTokens).toBe(1500);
    });

    it('should handle empty component runs', () => {
      const workflowRuns = [createWorkflowRun({ componentRuns: [] })];

      const result = service.aggregateByAgent(workflowRuns);

      expect(result).toEqual([]);
    });
  });

  describe('calculateDailyMetrics', () => {
    it('should group metrics by date', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const workflowRuns = [
        createWorkflowRun({
          startedAt: today,
          componentRuns: [
            createComponentRun({ tokensInput: 1000, tokensOutput: 500, linesAdded: 100 }),
          ],
        }),
        createWorkflowRun({
          startedAt: yesterday,
          componentRuns: [
            createComponentRun({ tokensInput: 2000, tokensOutput: 1000, linesAdded: 200 }),
          ],
        }),
      ];

      const result = service.calculateDailyMetrics(workflowRuns);

      const todayKey = today.toISOString().split('T')[0];
      const yesterdayKey = yesterday.toISOString().split('T')[0];

      expect(result[todayKey]).toBeDefined();
      expect(result[yesterdayKey]).toBeDefined();
    });

    it('should calculate tokensPerLOC for each day', () => {
      const today = new Date();
      const workflowRuns = [
        createWorkflowRun({
          startedAt: today,
          componentRuns: [
            createComponentRun({ tokensInput: 1000, tokensOutput: 500, linesAdded: 100, linesModified: 50 }),
          ],
        }),
      ];

      const result = service.calculateDailyMetrics(workflowRuns);
      const todayKey = today.toISOString().split('T')[0];

      // Total tokens: 1500, Total LOC: 150
      expect(result[todayKey].tokensPerLOC).toBeCloseTo(10, 1);
    });
  });
});

// Test helper functions
function createWorkflowRun(partial: Partial<any> = {}): any {
  return {
    id: uuidv4(),
    workflowId: partial.workflowId || uuidv4(),
    storyId: partial.storyId !== undefined ? partial.storyId : uuidv4(),
    workflow: partial.workflow !== undefined ? partial.workflow : { name: 'Default Workflow' },
    story: partial.story !== undefined ? partial.story : { key: 'ST-999', title: 'Default Story' },
    componentRuns: partial.componentRuns || [],
    startedAt: partial.startedAt || new Date(),
    ...partial,
  };
}

function createComponentRun(partial: Partial<any> = {}): any {
  return {
    id: uuidv4(),
    componentId: partial.componentId || uuidv4(),
    component: partial.component !== undefined ? partial.component : { name: 'Default Component' },
    tokensInput: partial.tokensInput ?? 0,
    tokensOutput: partial.tokensOutput ?? 0,
    tokensCacheRead: partial.tokensCacheRead ?? 0,
    tokensCacheWrite: partial.tokensCacheWrite ?? 0,
    cacheHits: partial.cacheHits ?? 0,
    cacheMisses: partial.cacheMisses ?? 0,
    linesAdded: partial.linesAdded ?? 0,
    linesModified: partial.linesModified ?? 0,
    linesDeleted: partial.linesDeleted ?? 0,
    testsAdded: partial.testsAdded ?? 0,
    filesModified: partial.filesModified ?? [],
    durationSeconds: partial.durationSeconds ?? 0,
    userPrompts: partial.userPrompts ?? 0,
    systemIterations: partial.systemIterations ?? 0,
    humanInterventions: partial.humanInterventions ?? 0,
    totalTurns: partial.totalTurns ?? 0,
    manualPrompts: partial.manualPrompts ?? 0,
    autoContinues: partial.autoContinues ?? 0,
    cost: partial.cost ?? 0,
    ...partial,
  };
}
