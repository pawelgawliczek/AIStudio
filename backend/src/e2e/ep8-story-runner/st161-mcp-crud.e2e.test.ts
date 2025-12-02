/**
 * ST-161: MCP CRUD Operations E2E Tests
 *
 * Tests full CRUD lifecycle for all entities via real MCP commands:
 * - Projects: create, get, list, update (no delete - cascades everything)
 * - Epics: create, get, list, delete
 * - Stories: create, get, list, update, search, delete
 * - Agents: create, get, list, update, activate/deactivate
 * - Project Managers: create, get, list, update, activate/deactivate
 * - Teams: create, list, update
 * - Workflow States: create, list, update, reorder, delete
 */

import { PrismaClient } from '@prisma/client';
import { MCPTestRunner, createMCPTestRunner } from './helpers/mcp-test-runner';

// Increase timeout for real CLI operations
jest.setTimeout(180000);

describe('ST-161: MCP CRUD Operations E2E Tests', () => {
  let prisma: PrismaClient;
  let runner: MCPTestRunner;

  // Test context - IDs created during tests
  const ctx: {
    projectId?: string;
    epicId?: string;
    storyId?: string;
    agentId?: string;
    pmId?: string;
    teamId?: string;
    stateIds: string[];
  } = { stateIds: [] };

  const testPrefix = `_ST161_CRUD_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-161: MCP CRUD Operations E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test prefix: ${testPrefix}`);
    console.log('');

    prisma = new PrismaClient();
    runner = await createMCPTestRunner(prisma);
    console.log(`Environment: ${runner.getEnvironment().toUpperCase()}`);
  });

  afterAll(async () => {
    // Cleanup in reverse order
    console.log('\n[CLEANUP] Starting cleanup...');

    try {
      // Delete workflow states
      for (const stateId of ctx.stateIds) {
        await prisma.workflowState.delete({ where: { id: stateId } }).catch(() => {});
      }

      // Delete team/workflow
      if (ctx.teamId) {
        await prisma.workflow.delete({ where: { id: ctx.teamId } }).catch(() => {});
      }

      // Delete PM (coordinator)
      if (ctx.pmId) {
        await prisma.component.delete({ where: { id: ctx.pmId } }).catch(() => {});
      }

      // Delete agent
      if (ctx.agentId) {
        await prisma.component.delete({ where: { id: ctx.agentId } }).catch(() => {});
      }

      // Delete story
      if (ctx.storyId) {
        await prisma.story.delete({ where: { id: ctx.storyId } }).catch(() => {});
      }

      // Delete epic
      if (ctx.epicId) {
        await prisma.epic.delete({ where: { id: ctx.epicId } }).catch(() => {});
      }

      // Delete project (this should cascade)
      if (ctx.projectId) {
        await prisma.project.delete({ where: { id: ctx.projectId } }).catch(() => {});
      }

      console.log('[CLEANUP] Cleanup complete');
    } catch (err) {
      console.error('[CLEANUP] Error during cleanup:', err);
    }

    await prisma.$disconnect();

    console.log('\n============================================================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('============================================================\n');
  });

  // ==========================================================================
  // PROJECT CRUD
  // ==========================================================================
  describe('Project CRUD', () => {
    it('should create project', async () => {
      const result = await runner.execute<{ id: string; name: string }>('create_project', {
        name: `${testPrefix}_Project`,
        description: 'CRUD test project',
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();
      expect(result.result?.name).toBe(`${testPrefix}_Project`);

      ctx.projectId = result.result!.id;
      console.log(`    ✓ Project created: ${ctx.projectId}`);
    });

    it('should get project by ID', async () => {
      const result = await runner.execute<{ id: string; name: string; description: string }>(
        'get_project',
        { projectId: ctx.projectId },
      );

      expect(result.success).toBe(true);
      expect(result.result?.id).toBe(ctx.projectId);
      expect(result.result?.name).toBe(`${testPrefix}_Project`);
      expect(result.result?.description).toBe('CRUD test project');

      console.log(`    ✓ Project retrieved: ${result.result?.name}`);
    });

    it('should list projects and find our test project', async () => {
      const result = await runner.execute<{ data: Array<{ id: string; name: string }> }>(
        'list_projects',
        {},
      );

      expect(result.success).toBe(true);
      expect(result.result?.data).toBeDefined();

      const found = result.result?.data.find((p) => p.id === ctx.projectId);
      expect(found).toBeDefined();

      console.log(`    ✓ Project found in list of ${result.result?.data.length} projects`);
    });

    // Note: update_project doesn't exist in current MCP tools
    // Projects are typically immutable after creation
  });

  // ==========================================================================
  // EPIC CRUD
  // ==========================================================================
  describe('Epic CRUD', () => {
    it('should create epic', async () => {
      const result = await runner.execute<{ id: string; title: string }>('create_epic', {
        projectId: ctx.projectId,
        title: `${testPrefix}_Epic`,
        description: 'CRUD test epic',
        priority: 5,
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();
      ctx.epicId = result.result!.id;

      console.log(`    ✓ Epic created: ${ctx.epicId}`);
    });

    it('should list epics for project', async () => {
      const result = await runner.execute<{ data: Array<{ id: string; title: string }> }>(
        'list_epics',
        { projectId: ctx.projectId },
      );

      expect(result.success).toBe(true);
      const found = result.result?.data.find((e) => e.id === ctx.epicId);
      expect(found).toBeDefined();

      console.log(`    ✓ Epic found in list of ${result.result?.data.length} epics`);
    });

    // Note: update_epic and get_epic don't exist - epics are simple containers
  });

  // ==========================================================================
  // STORY CRUD
  // ==========================================================================
  describe('Story CRUD', () => {
    it('should create story', async () => {
      const result = await runner.execute<{ id: string; title: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_Story`,
        description: 'CRUD test story',
        type: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();
      ctx.storyId = result.result!.id;

      console.log(`    ✓ Story created: ${ctx.storyId}`);
    });

    it('should get story by ID', async () => {
      const result = await runner.execute<{
        id: string;
        title: string;
        status: string;
        description: string;
      }>('get_story', { storyId: ctx.storyId });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBe(ctx.storyId);
      expect(result.result?.title).toBe(`${testPrefix}_Story`);
      expect(result.result?.status).toBe('planning');

      console.log(`    ✓ Story retrieved: ${result.result?.title} (${result.result?.status})`);
    });

    it('should update story status and description', async () => {
      const result = await runner.execute<{ id: string; status: string; description: string }>(
        'update_story',
        {
          storyId: ctx.storyId,
          status: 'analysis',
          description: 'Updated description via MCP',
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.status).toBe('analysis');
      expect(result.result?.description).toBe('Updated description via MCP');

      console.log(`    ✓ Story updated: status=${result.result?.status}`);
    });

    it('should list stories for project', async () => {
      const result = await runner.execute<{ data: Array<{ id: string }> }>('list_stories', {
        projectId: ctx.projectId,
      });

      expect(result.success).toBe(true);
      const found = result.result?.data.find((s) => s.id === ctx.storyId);
      expect(found).toBeDefined();

      console.log(`    ✓ Story found in list of ${result.result?.data.length} stories`);
    });

    it('should search stories by title', async () => {
      // search_stories returns an array directly, not { data: [...] }
      const result = await runner.execute<Array<{ id: string; title: string }>>(
        'search_stories',
        {
          query: testPrefix,
          projectId: ctx.projectId,
        },
      );

      expect(result.success).toBe(true);
      const stories = Array.isArray(result.result) ? result.result : [];
      expect(stories.length).toBeGreaterThan(0);

      const found = stories.find((s) => s.id === ctx.storyId);
      expect(found).toBeDefined();

      console.log(`    ✓ Story found via search: ${found?.title}`);
    });

    it('should get story with subtasks and use cases', async () => {
      const result = await runner.execute<{
        id: string;
        subtasks?: Array<unknown>;
        useCases?: Array<unknown>;
      }>('get_story', {
        storyId: ctx.storyId,
        includeSubtasks: true,
        includeUseCases: true,
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBe(ctx.storyId);
      // These may be empty arrays but should be present
      expect(result.result?.subtasks).toBeDefined();
      expect(result.result?.useCases).toBeDefined();

      console.log(
        `    ✓ Story with relations: ${result.result?.subtasks?.length} subtasks, ${result.result?.useCases?.length} use cases`,
      );
    });
  });

  // ==========================================================================
  // AGENT CRUD
  // ==========================================================================
  describe('Agent CRUD', () => {
    it('should create agent', async () => {
      const result = await runner.execute<{ id: string; name: string; active: boolean }>(
        'create_agent',
        {
          projectId: ctx.projectId,
          name: `${testPrefix}_Agent`,
          inputInstructions: 'Read story context',
          operationInstructions: 'Analyze requirements',
          outputInstructions: 'Produce analysis document',
          config: { modelId: 'claude-sonnet-4-20250514' },
          tools: ['Read', 'Grep'],
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();
      expect(result.result?.active).toBe(true);
      ctx.agentId = result.result!.id;

      console.log(`    ✓ Agent created: ${ctx.agentId}`);
    });

    it('should get agent by ID', async () => {
      // get_agent returns { component: {...} }
      const result = await runner.execute<{
        component: {
          id: string;
          name: string;
          inputInstructions: string;
          active: boolean;
        };
      }>('get_agent', { componentId: ctx.agentId });

      expect(result.success).toBe(true);
      expect(result.result?.component?.id).toBe(ctx.agentId);
      expect(result.result?.component?.name).toBe(`${testPrefix}_Agent`);
      expect(result.result?.component?.inputInstructions).toBe('Read story context');

      console.log(`    ✓ Agent retrieved: ${result.result?.component?.name}`);
    });

    it('should update agent instructions', async () => {
      const result = await runner.execute<{ id: string; operationInstructions: string }>(
        'update_agent',
        {
          componentId: ctx.agentId,
          operationInstructions: 'Updated: Analyze requirements thoroughly',
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.operationInstructions).toBe(
        'Updated: Analyze requirements thoroughly',
      );

      console.log(`    ✓ Agent updated`);
    });

    it('should list agents for project', async () => {
      const result = await runner.execute<{ data: Array<{ id: string; name: string }> }>(
        'list_agents',
        { projectId: ctx.projectId },
      );

      expect(result.success).toBe(true);
      const found = result.result?.data.find((a) => a.id === ctx.agentId);
      expect(found).toBeDefined();

      console.log(`    ✓ Agent found in list of ${result.result?.data.length} agents`);
    });

    it('should deactivate agent', async () => {
      const result = await runner.execute<{ success: boolean; component: { active: boolean } }>(
        'deactivate_agent',
        { componentId: ctx.agentId },
      );

      expect(result.success).toBe(true);
      expect(result.result?.component?.active).toBe(false);

      console.log(`    ✓ Agent deactivated`);
    });

    it('should activate agent', async () => {
      const result = await runner.execute<{ success: boolean; component: { active: boolean } }>(
        'activate_agent',
        { componentId: ctx.agentId },
      );

      expect(result.success).toBe(true);
      expect(result.result?.component?.active).toBe(true);

      console.log(`    ✓ Agent activated`);
    });

    it('should get agent usage stats', async () => {
      // get_agent_usage returns { componentId, workflows: [...], executionCount }
      const result = await runner.execute<{
        componentId: string;
        workflows: Array<{ id: string; name: string }>;
        executionCount: number;
      }>('get_agent_usage', { componentId: ctx.agentId });

      expect(result.success).toBe(true);
      expect(result.result?.componentId).toBe(ctx.agentId);
      expect(Array.isArray(result.result?.workflows)).toBe(true);
      expect(typeof result.result?.executionCount).toBe('number');

      console.log(
        `    ✓ Agent usage: ${result.result?.workflows?.length || 0} workflows, ${result.result?.executionCount} executions`,
      );
    });
  });

  // ==========================================================================
  // PROJECT MANAGER CRUD
  // ==========================================================================
  describe('Project Manager CRUD', () => {
    it('should create project manager', async () => {
      const result = await runner.execute<{ id: string; name: string; active: boolean }>(
        'create_project_manager',
        {
          projectId: ctx.projectId,
          name: `${testPrefix}_PM`,
          description: 'CRUD test PM',
          domain: 'software-development',
          coordinatorInstructions: 'Orchestrate analysis and implementation',
          config: { modelId: 'claude-sonnet-4-20250514' },
          tools: ['Read', 'Task'],
          decisionStrategy: 'sequential',
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();
      ctx.pmId = result.result!.id;

      console.log(`    ✓ PM created: ${ctx.pmId}`);
    });

    it('should get project manager by ID', async () => {
      // get_project_manager returns { coordinator: {...} }
      const result = await runner.execute<{
        coordinator: {
          id: string;
          name: string;
          operationInstructions: string;
        };
      }>('get_project_manager', { coordinatorId: ctx.pmId });

      expect(result.success).toBe(true);
      expect(result.result?.coordinator?.id).toBe(ctx.pmId);
      expect(result.result?.coordinator?.name).toBe(`${testPrefix}_PM`);

      console.log(`    ✓ PM retrieved: ${result.result?.coordinator?.name}`);
    });

    it('should update project manager', async () => {
      const result = await runner.execute<{ id: string; description: string }>(
        'update_project_manager',
        {
          coordinatorId: ctx.pmId,
          description: 'Updated PM description',
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.description).toBe('Updated PM description');

      console.log(`    ✓ PM updated`);
    });

    it('should list project managers', async () => {
      const result = await runner.execute<{ data: Array<{ id: string }> }>(
        'list_project_managers',
        { projectId: ctx.projectId },
      );

      expect(result.success).toBe(true);
      const found = result.result?.data.find((pm) => pm.id === ctx.pmId);
      expect(found).toBeDefined();

      console.log(`    ✓ PM found in list of ${result.result?.data.length} PMs`);
    });

    it('should deactivate project manager', async () => {
      const result = await runner.execute<{ success: boolean }>('deactivate_project_manager', {
        coordinatorId: ctx.pmId,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ PM deactivated`);
    });

    it('should activate project manager', async () => {
      const result = await runner.execute<{ success: boolean }>('activate_project_manager', {
        coordinatorId: ctx.pmId,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ PM activated`);
    });
  });

  // ==========================================================================
  // TEAM/WORKFLOW CRUD
  // ==========================================================================
  describe('Team CRUD', () => {
    it('should create team', async () => {
      const result = await runner.execute<{ id: string; name: string }>('create_team', {
        projectId: ctx.projectId,
        coordinatorId: ctx.pmId,
        name: `${testPrefix}_Team`,
        description: 'CRUD test team',
        triggerConfig: { type: 'manual' },
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();
      ctx.teamId = result.result!.id;

      console.log(`    ✓ Team created: ${ctx.teamId}`);
    });

    it('should list teams for project', async () => {
      // list_teams returns { workflows: [...] }
      const result = await runner.execute<{ workflows: Array<{ id: string; name: string }> }>(
        'list_teams',
        { projectId: ctx.projectId },
      );

      expect(result.success).toBe(true);
      const workflows = result.result?.workflows || [];
      const found = workflows.find((t) => t.id === ctx.teamId);
      expect(found).toBeDefined();

      console.log(`    ✓ Team found in list of ${workflows.length} teams`);
    });

    it('should update team', async () => {
      const result = await runner.execute<{ id: string; description: string }>('update_team', {
        workflowId: ctx.teamId,
        description: 'Updated team description',
      });

      expect(result.success).toBe(true);
      expect(result.result?.description).toBe('Updated team description');

      console.log(`    ✓ Team updated`);
    });
  });

  // ==========================================================================
  // WORKFLOW STATE CRUD
  // ==========================================================================
  describe('Workflow State CRUD', () => {
    it('should create first workflow state', async () => {
      const result = await runner.execute<{ id: string; name: string; order: number }>(
        'create_workflow_state',
        {
          workflowId: ctx.teamId,
          name: `${testPrefix}_State_1`,
          order: 1,
          componentId: ctx.agentId,
          preExecutionInstructions: 'Prepare for analysis',
          postExecutionInstructions: 'Validate analysis output',
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.order).toBe(1);
      ctx.stateIds.push(result.result!.id);

      console.log(`    ✓ State 1 created: ${result.result?.id}`);
    });

    it('should create second workflow state', async () => {
      const result = await runner.execute<{ id: string; name: string; order: number }>(
        'create_workflow_state',
        {
          workflowId: ctx.teamId,
          name: `${testPrefix}_State_2`,
          order: 2,
          componentId: ctx.agentId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.order).toBe(2);
      ctx.stateIds.push(result.result!.id);

      console.log(`    ✓ State 2 created: ${result.result?.id}`);
    });

    it('should create third workflow state', async () => {
      const result = await runner.execute<{ id: string; name: string; order: number }>(
        'create_workflow_state',
        {
          workflowId: ctx.teamId,
          name: `${testPrefix}_State_3`,
          order: 3,
          componentId: ctx.agentId,
          requiresApproval: true,
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.order).toBe(3);
      ctx.stateIds.push(result.result!.id);

      console.log(`    ✓ State 3 created (requires approval): ${result.result?.id}`);
    });

    it('should list workflow states in order', async () => {
      const result = await runner.execute<{ data: Array<{ id: string; order: number }> }>(
        'list_workflow_states',
        { workflowId: ctx.teamId },
      );

      expect(result.success).toBe(true);
      expect(result.result?.data.length).toBe(3);

      // Verify order
      const orders = result.result?.data.map((s) => s.order);
      expect(orders).toEqual([1, 2, 3]);

      console.log(`    ✓ Listed ${result.result?.data.length} states in correct order`);
    });

    it('should update workflow state', async () => {
      const result = await runner.execute<{ id: string; preExecutionInstructions: string }>(
        'update_workflow_state',
        {
          workflowStateId: ctx.stateIds[0],
          preExecutionInstructions: 'Updated: Prepare thoroughly',
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.preExecutionInstructions).toBe('Updated: Prepare thoroughly');

      console.log(`    ✓ State updated`);
    });

    it('should reorder workflow states', async () => {
      // Swap state 1 and state 2
      const result = await runner.execute<{ success: boolean }>('reorder_workflow_states', {
        workflowId: ctx.teamId,
        stateOrder: [
          { stateId: ctx.stateIds[0], newOrder: 2 },
          { stateId: ctx.stateIds[1], newOrder: 1 },
          { stateId: ctx.stateIds[2], newOrder: 3 },
        ],
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ States reordered`);

      // Verify new order
      const listResult = await runner.execute<{ data: Array<{ id: string; order: number }> }>(
        'list_workflow_states',
        { workflowId: ctx.teamId },
      );

      const state1 = listResult.result?.data.find((s) => s.id === ctx.stateIds[0]);
      const state2 = listResult.result?.data.find((s) => s.id === ctx.stateIds[1]);
      expect(state1?.order).toBe(2);
      expect(state2?.order).toBe(1);

      console.log(`    ✓ Reorder verified: State1 now order 2, State2 now order 1`);
    });

    it('should delete workflow state', async () => {
      const stateToDelete = ctx.stateIds[2]; // Delete state 3

      const result = await runner.execute<{ success: boolean }>('delete_workflow_state', {
        workflowStateId: stateToDelete,
        confirm: true,
      });

      expect(result.success).toBe(true);
      ctx.stateIds = ctx.stateIds.filter((id) => id !== stateToDelete);

      console.log(`    ✓ State deleted`);

      // Verify deletion
      const listResult = await runner.execute<{ data: Array<{ id: string }> }>(
        'list_workflow_states',
        { workflowId: ctx.teamId },
      );
      expect(listResult.result?.data.length).toBe(2);

      console.log(`    ✓ Verified: ${listResult.result?.data.length} states remaining`);
    });
  });

  // ==========================================================================
  // STORY DELETE (cleanup test)
  // ==========================================================================
  describe('Delete Operations', () => {
    it('should delete story', async () => {
      const result = await runner.execute<{ success: boolean }>('delete_story', {
        storyId: ctx.storyId,
        confirm: true,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Story deleted`);

      // Clear from context so cleanup doesn't try again
      ctx.storyId = undefined;
    });

    it('should delete epic', async () => {
      const result = await runner.execute<{ success: boolean }>('delete_epic', {
        epicId: ctx.epicId,
        confirm: true,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Epic deleted`);

      ctx.epicId = undefined;
    });
  });
});
