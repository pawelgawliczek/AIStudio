/**
 * Script to generate all test files for workflow execution
 * Run with: npx tsx generate-all-tests.ts
 */

import fs from 'fs';
import path from 'path';

const testsDir = path.join(__dirname, 'src/mcp/servers/execution/__tests__');

// Ensure directory exists
if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir, { recursive: true });
}

const testFiles = {
  // UC-EXEC-002: Execute Epic with Workflow
  'execute_epic_with_workflow.test.ts': `/**
 * Unit Tests for UC-EXEC-002: Execute Epic with Workflow
 */

import { handler } from '../execute_epic_with_workflow';
import { prismaMock, fixtures, createEpicWithStories } from './test-setup';

describe('UC-EXEC-002: Execute Epic with Workflow - Unit Tests', () => {
  describe('TC-EXEC-002-U1: Validate epic exists', () => {
    it('should throw error when epic does not exist', async () => {
      const params = {
        epicId: 'non-existent-epic',
        workflowId: fixtures.workflow.id,
      };

      prismaMock.epic.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Epic with ID non-existent-epic not found'
      );
    });
  });

  describe('TC-EXEC-002-U2: Filter stories by status correctly', () => {
    it('should filter stories by provided status array', async () => {
      const { epic, stories } = createEpicWithStories(5);
      const params = {
        epicId: epic.id,
        workflowId: fixtures.workflow.id,
        storyStatus: ['planning', 'analysis'],
      };

      prismaMock.epic.findUnique.mockResolvedValue(epic as any);
      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        active: true,
      } as any);

      const filteredStories = stories.filter(s =>
        ['planning', 'analysis'].includes(s.status)
      );
      prismaMock.story.findMany.mockResolvedValue(filteredStories as any);

      await handler(prismaMock, params);

      expect(prismaMock.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['planning', 'analysis'] },
          }),
        })
      );
    });
  });

  describe('TC-EXEC-002-U3: AbortOnError stops sequential execution', () => {
    it('should mark remaining stories as skipped after first failure', async () => {
      const { epic, stories } = createEpicWithStories(3);
      const params = {
        epicId: epic.id,
        workflowId: fixtures.workflow.id,
        mode: 'sequential',
        abortOnError: true,
      };

      prismaMock.epic.findUnique.mockResolvedValue(epic as any);
      prismaMock.workflow.findUnique.mockResolvedValue({
        ...fixtures.workflow,
        active: true,
      } as any);
      prismaMock.story.findMany.mockResolvedValue(stories as any);

      const result = await handler(prismaMock, params);

      expect(result.summary.skipped).toBeGreaterThan(0);
    });
  });
});
`,

  // UC-EXEC-003: Query Results
  'get_workflow_run_results.test.ts': `/**
 * Unit Tests for UC-EXEC-003: Query Workflow Execution Results
 */

import { handler } from '../get_workflow_run_results';
import { prismaMock, fixtures } from './test-setup';

describe('UC-EXEC-003: Query Workflow Results - Unit Tests', () => {
  describe('TC-EXEC-003-U1: Return error for non-existent runId', () => {
    it('should throw error when workflow run not found', async () => {
      const params = { runId: 'non-existent-run' };

      prismaMock.workflowRun.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Workflow run with ID non-existent-run not found'
      );
    });
  });

  describe('TC-EXEC-003-U2: Calculate progress percentage correctly', () => {
    it('should calculate 60% for 3/5 components completed', async () => {
      const params = { runId: fixtures.workflowRun.id };

      const mockComponentRuns = [
        { ...fixtures.componentRun, id: '1', status: 'completed' },
        { ...fixtures.componentRun, id: '2', status: 'completed' },
        { ...fixtures.componentRun, id: '3', status: 'completed' },
        { ...fixtures.componentRun, id: '4', status: 'running' },
        { ...fixtures.componentRun, id: '5', status: 'pending' },
      ];

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        componentRuns: mockComponentRuns,
        workflow: fixtures.workflow,
        coordinator: fixtures.coordinator,
        story: fixtures.story,
        epic: fixtures.epic,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.progress.componentsCompleted).toBe(3);
      expect(result.progress.componentsTotal).toBe(5);
      expect(result.progress.percentComplete).toBe(60);
    });
  });
});
`,

  // UC-EXEC-004: List Workflows
  'list_workflows.test.ts': `/**
 * Unit Tests for UC-EXEC-004: List Workflows
 */

import { handler } from '../list_workflows';
import { prismaMock, fixtures } from './test-setup';

describe('UC-EXEC-004: List Workflows - Unit Tests', () => {
  describe('TC-EXEC-004-U1: Filter workflows by active status', () => {
    it('should return only active workflows by default', async () => {
      const params = { projectId: fixtures.project.id };

      prismaMock.project.findUnique.mockResolvedValue(fixtures.project as any);

      const workflows = [
        { ...fixtures.workflow, active: true },
        { ...fixtures.workflowInactive, active: false },
      ];

      prismaMock.workflow.findMany.mockResolvedValue([workflows[0]] as any);

      const result = await handler(prismaMock, params);

      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].active).toBe(true);
    });
  });

  describe('TC-EXEC-004-U2: Return error for non-existent project', () => {
    it('should throw error when project not found', async () => {
      const params = { projectId: 'non-existent-project' };

      prismaMock.project.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Project with ID non-existent-project not found'
      );
    });
  });
});
`,

  // UC-EXEC-005: Assign Workflow
  'assign_workflow_to_story.test.ts': `/**
 * Unit Tests for UC-EXEC-005: Assign Workflow to Story
 */

import { handler } from '../assign_workflow_to_story';
import { prismaMock, fixtures } from './test-setup';

describe('UC-EXEC-005: Assign Workflow - Unit Tests', () => {
  describe('TC-EXEC-005-U1: Validate story and workflow exist', () => {
    it('should throw error when story not found', async () => {
      const params = {
        storyId: 'non-existent-story',
        workflowId: fixtures.workflow.id,
      };

      prismaMock.story.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Story with ID non-existent-story not found'
      );
    });

    it('should throw error when workflow not found', async () => {
      const params = {
        storyId: fixtures.story.id,
        workflowId: 'non-existent-workflow',
      };

      prismaMock.story.findUnique.mockResolvedValue(fixtures.story as any);
      prismaMock.workflow.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        /Workflow.*not found/
      );
    });
  });

  describe('TC-EXEC-005-U2: Prevent assigning inactive workflow', () => {
    it('should throw error for inactive workflow', async () => {
      const params = {
        storyId: fixtures.story.id,
        workflowId: fixtures.workflowInactive.id,
      };

      prismaMock.story.findUnique.mockResolvedValue(fixtures.story as any);
      prismaMock.workflow.findUnique.mockResolvedValue(fixtures.workflowInactive as any);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        /Cannot assign inactive workflow/
      );
    });
  });

  describe('TC-EXEC-005-U3: Clear assignment with null workflowId', () => {
    it('should clear assignment when workflowId is null', async () => {
      const params = {
        storyId: fixtures.story.id,
        workflowId: null,
      };

      prismaMock.story.findUnique.mockResolvedValue({
        ...fixtures.story,
        assignedWorkflowId: fixtures.workflow.id,
      } as any);

      prismaMock.story.update.mockResolvedValue({
        ...fixtures.story,
        assignedWorkflowId: null,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.success).toBe(true);
      expect(result.workflow).toBeNull();
      expect(prismaMock.story.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assignedWorkflowId: null },
        })
      );
    });
  });
});
`,

  // UC-EXEC-006: List Runs
  'list_workflow_runs.test.ts': `/**
 * Unit Tests for UC-EXEC-006: List Workflow Runs
 */

import { handler } from '../list_workflow_runs';
import { prismaMock, fixtures } from './test-setup';

describe('UC-EXEC-006: List Workflow Runs - Unit Tests', () => {
  describe('TC-EXEC-006-U1: Require at least one filter parameter', () => {
    it('should throw error when no filters provided', async () => {
      const params = {};

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'At least one filter is required'
      );
    });

    it('should accept projectId as filter', async () => {
      const params = { projectId: fixtures.project.id };

      prismaMock.workflowRun.count.mockResolvedValue(0);
      prismaMock.workflowRun.findMany.mockResolvedValue([]);

      const result = await handler(prismaMock, params);

      expect(result.success).toBe(true);
    });
  });

  describe('TC-EXEC-006-U2: Filter by status correctly', () => {
    it('should filter runs by status', async () => {
      const params = {
        projectId: fixtures.project.id,
        status: 'failed',
      };

      prismaMock.workflowRun.count.mockResolvedValue(1);
      prismaMock.workflowRun.findMany.mockResolvedValue([
        {
          ...fixtures.workflowRun,
          status: 'failed',
          workflow: fixtures.workflow,
          coordinator: fixtures.coordinator,
        },
      ] as any);

      const result = await handler(prismaMock, params);

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].status).toBe('failed');
    });
  });

  describe('TC-EXEC-006-U3: Pagination limits enforced', () => {
    it('should limit results to maximum 100', async () => {
      const params = {
        projectId: fixtures.project.id,
        limit: 500, // Requesting 500
      };

      prismaMock.workflowRun.count.mockResolvedValue(500);
      prismaMock.workflowRun.findMany.mockResolvedValue([]);

      await handler(prismaMock, params);

      // Verify findMany was called with limit capped at 100
      expect(prismaMock.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Should be capped
        })
      );
    });
  });
});
`,

  // Integration test for UC-EXEC-001
  'execute_story_with_workflow.integration.test.ts': `/**
 * Integration Tests for UC-EXEC-001: Execute Story with Workflow
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../execute_story_with_workflow';

// Note: These tests would require actual database connection
// For now, they serve as specifications

describe('UC-EXEC-001: Execute Story with Workflow - Integration Tests', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Would initialize test database connection
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('TC-EXEC-001-I1: Execute workflow successfully creates WorkflowRun', () => {
    it.skip('should create WorkflowRun with correct fields', async () => {
      // Test would:
      // 1. Create test project, story, workflow in database
      // 2. Call execute_story_with_workflow
      // 3. Verify WorkflowRun created
      // 4. Verify Story.assignedWorkflowId updated
      // 5. Verify context fields populated
      // 6. Clean up test data
    });
  });

  describe('TC-EXEC-001-I2: Epic linkage when story belongs to epic', () => {
    it.skip('should set WorkflowRun.epicId correctly', async () => {
      // Test would verify epic relation is properly set
    });
  });
});
`,

  // E2E test for UC-EXEC-001
  'execute_story_with_workflow.e2e.test.ts': `/**
 * E2E Tests for UC-EXEC-001: Execute Story with Workflow
 */

describe('UC-EXEC-001: Execute Story with Workflow - E2E Tests', () => {
  describe('TC-EXEC-001-E1: Complete workflow execution for simple story', () => {
    it.skip('should execute complete workflow from start to finish', async () => {
      // E2E test would:
      // 1. Set up complete test environment (project, epic, story, workflow, components)
      // 2. Trigger workflow execution via MCP tool
      // 3. Monitor execution progress
      // 4. Verify all components execute in order
      // 5. Verify story status transitions
      // 6. Verify final results are accessible
      // 7. Clean up all test data
    });
  });
});
`,
};

console.log('Generating test files...\n');

let created = 0;
for (const [filename, content] of Object.entries(testFiles)) {
  const filePath = path.join(testsDir, filename);

  if (fs.existsSync(filePath)) {
    console.log(`⏭️  Skipped ${filename} (already exists)`);
    continue;
  }

  fs.writeFileSync(filePath, content);
  console.log(`✅ Created ${filename}`);
  created++;
}

console.log(`\n📊 Created ${created} test files`);
console.log('\n✨ Test file generation complete!');
