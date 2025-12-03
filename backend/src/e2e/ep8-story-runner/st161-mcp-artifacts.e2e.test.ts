/**
 * ST-161: MCP Artifact System E2E Tests
 *
 * Tests artifact lifecycle via real MCP commands:
 * - Artifact Definitions: create, list, update, set_access, delete
 * - Artifacts: upload, get, list
 * - Artifact Sessions: open, save, close (interactive editing)
 *
 * The artifact system allows workflows to produce and consume typed documents
 * (markdown, json, code, etc.) with access control per workflow state.
 */

import { PrismaClient } from '@prisma/client';
import { MCPTestRunner, createMCPTestRunner } from './helpers/mcp-test-runner';

// Increase timeout for real CLI operations
jest.setTimeout(300000);

describe('ST-161: MCP Artifact System E2E Tests', () => {
  let prisma: PrismaClient;
  let runner: MCPTestRunner;

  // Test context
  const ctx: {
    projectId?: string;
    epicId?: string;
    storyId?: string;
    agentId?: string;
    pmId?: string;
    teamId?: string;
    stateId?: string;
    runId?: string;
    artifactDefId?: string;
    artifactId?: string;
    sessionJobId?: string;
  } = {};

  const testPrefix = `_ST161_ARTIFACT_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-161: MCP Artifact System E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test prefix: ${testPrefix}`);
    console.log('');

    prisma = new PrismaClient();
    runner = await createMCPTestRunner(prisma);
    console.log(`Environment: ${runner.getEnvironment().toUpperCase()}`);
  });

  afterAll(async () => {
    console.log('\n[CLEANUP] Starting cleanup...');

    try {
      // Close any open sessions
      if (ctx.sessionJobId) {
        await runner.execute('close_artifact_session', {
          jobId: ctx.sessionJobId,
          reason: 'Test cleanup',
        });
      }

      // Delete artifact definitions (cascades to artifacts)
      if (ctx.artifactDefId) {
        await runner.execute('delete_artifact_definition', {
          definitionId: ctx.artifactDefId,
          confirm: true,
        });
      }

      // Delete workflow run
      if (ctx.runId) {
        await prisma.workflowRun.delete({ where: { id: ctx.runId } }).catch(() => {});
      }

      // Delete workflow state
      if (ctx.stateId) {
        await prisma.workflowState.delete({ where: { id: ctx.stateId } }).catch(() => {});
      }

      // Delete team/workflow
      if (ctx.teamId) {
        await prisma.workflow.delete({ where: { id: ctx.teamId } }).catch(() => {});
      }

      // Delete PM
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

      // Delete project
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
  // SETUP: Create project/team/workflow for artifact tests
  // ==========================================================================
  describe('Setup', () => {
    it('should create project', async () => {
      const result = await runner.execute<{ id: string }>('create_project', {
        name: `${testPrefix}_Project`,
        description: 'Artifact test project',
      });

      expect(result.success).toBe(true);
      ctx.projectId = result.result!.id;
      console.log(`    ✓ Project: ${ctx.projectId}`);
    });

    it('should create epic and story', async () => {
      const epicResult = await runner.execute<{ id: string }>('create_epic', {
        projectId: ctx.projectId,
        title: `${testPrefix}_Epic`,
      });
      expect(epicResult.success).toBe(true);
      ctx.epicId = epicResult.result!.id;

      const storyResult = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_Story`,
        type: 'feature',
      });
      expect(storyResult.success).toBe(true);
      ctx.storyId = storyResult.result!.id;

      console.log(`    ✓ Epic: ${ctx.epicId}`);
      console.log(`    ✓ Story: ${ctx.storyId}`);
    });

    it('should create agent and PM', async () => {
      const agentResult = await runner.execute<{ id: string }>('create_agent', {
        projectId: ctx.projectId,
        name: `${testPrefix}_Agent`,
        inputInstructions: 'Input',
        operationInstructions: 'Operation',
        outputInstructions: 'Output',
        config: { modelId: 'claude-sonnet-4-20250514' },
        tools: ['Read'],
      });
      expect(agentResult.success).toBe(true);
      ctx.agentId = agentResult.result!.id;

      const pmResult = await runner.execute<{ id: string }>('create_project_manager', {
        projectId: ctx.projectId,
        name: `${testPrefix}_PM`,
        description: 'Test PM',
        domain: 'software-development',
        coordinatorInstructions: 'Coordinate',
        config: { modelId: 'claude-sonnet-4-20250514' },
        tools: ['Task'],
        decisionStrategy: 'sequential',
      });
      expect(pmResult.success).toBe(true);
      ctx.pmId = pmResult.result!.id;

      console.log(`    ✓ Agent: ${ctx.agentId}`);
      console.log(`    ✓ PM: ${ctx.pmId}`);
    });

    it('should create team with workflow state', async () => {
      const teamResult = await runner.execute<{ id: string }>('create_team', {
        projectId: ctx.projectId,
        coordinatorId: ctx.pmId,
        name: `${testPrefix}_Team`,
        triggerConfig: { type: 'manual' },
      });
      expect(teamResult.success).toBe(true);
      ctx.teamId = teamResult.result!.id;

      const stateResult = await runner.execute<{ id: string }>('create_workflow_state', {
        workflowId: ctx.teamId,
        name: `${testPrefix}_State`,
        order: 1,
        componentId: ctx.agentId,
      });
      expect(stateResult.success).toBe(true);
      ctx.stateId = stateResult.result!.id;

      console.log(`    ✓ Team: ${ctx.teamId}`);
      console.log(`    ✓ State: ${ctx.stateId}`);
    });

    it('should start workflow run', async () => {
      const result = await runner.execute<{ runId: string }>('start_team_run', {
        teamId: ctx.teamId,
        triggeredBy: 'st161-artifact-test',
        context: { storyId: ctx.storyId },
      });

      expect(result.success).toBe(true);
      ctx.runId = result.result!.runId;
      console.log(`    ✓ Workflow Run: ${ctx.runId}`);
    });
  });

  // ==========================================================================
  // ARTIFACT DEFINITIONS
  // ==========================================================================
  describe('Artifact Definitions', () => {
    it('should create artifact definition', async () => {
      const result = await runner.execute<{
        id: string;
        key: string;
        name: string;
        type: string;
      }>('create_artifact_definition', {
        workflowId: ctx.teamId,
        name: 'Architecture Document',
        key: 'ARCH_DOC',
        type: 'markdown',
        description: 'Architecture analysis document',
        isMandatory: true,
      });

      expect(result.success).toBe(true);
      expect(result.result?.key).toBe('ARCH_DOC');
      expect(result.result?.type).toBe('markdown');
      ctx.artifactDefId = result.result!.id;

      console.log(`    ✓ Artifact Definition created: ${ctx.artifactDefId}`);
      console.log(`    ✓ Key: ${result.result?.key}, Type: ${result.result?.type}`);
    });

    it('should list artifact definitions for workflow', async () => {
      const result = await runner.execute<{
        data: Array<{ id: string; key: string; name: string }>;
      }>('list_artifact_definitions', {
        workflowId: ctx.teamId,
      });

      expect(result.success).toBe(true);
      const found = result.result?.data.find((d) => d.id === ctx.artifactDefId);
      expect(found).toBeDefined();
      expect(found?.key).toBe('ARCH_DOC');

      console.log(`    ✓ Found definition in list of ${result.result?.data.length}`);
    });

    it('should update artifact definition', async () => {
      const result = await runner.execute<{ id: string; description: string }>(
        'update_artifact_definition',
        {
          definitionId: ctx.artifactDefId,
          description: 'Updated: Comprehensive architecture analysis',
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.description).toBe('Updated: Comprehensive architecture analysis');

      console.log(`    ✓ Artifact Definition updated`);
    });

    it('should set artifact access for state (write)', async () => {
      const result = await runner.execute<{ success: boolean }>('set_artifact_access', {
        definitionId: ctx.artifactDefId,
        stateId: ctx.stateId,
        accessType: 'write',
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Write access set for state`);
    });

    it('should set artifact access for state (read)', async () => {
      // Create another state that reads this artifact
      const state2Result = await runner.execute<{ id: string }>('create_workflow_state', {
        workflowId: ctx.teamId,
        name: `${testPrefix}_State_2`,
        order: 2,
        componentId: ctx.agentId,
      });

      expect(state2Result.success).toBe(true);
      const state2Id = state2Result.result!.id;

      const accessResult = await runner.execute<{ success: boolean }>('set_artifact_access', {
        definitionId: ctx.artifactDefId,
        stateId: state2Id,
        accessType: 'read',
      });

      expect(accessResult.success).toBe(true);
      console.log(`    ✓ Read access set for state 2`);

      // Cleanup state 2
      await runner.execute('delete_workflow_state', {
        workflowStateId: state2Id,
        confirm: true,
      });
    });
  });

  // ==========================================================================
  // ARTIFACTS (upload, get, list)
  // ==========================================================================
  describe('Artifacts', () => {
    it('should upload artifact', async () => {
      const markdownContent = `# Architecture Document

## Overview
This is the architecture analysis for ${testPrefix}.

## Components
- Component A: Handles input processing
- Component B: Core business logic
- Component C: Output formatting

## Data Flow
1. Input received
2. Validation
3. Processing
4. Output

## Decisions
- Use event-driven architecture
- Implement retry logic for reliability
`;

      const result = await runner.execute<{
        id: string;
        version: number;
        contentType: string;
      }>('upload_artifact', {
        workflowRunId: ctx.runId,
        definitionKey: 'ARCH_DOC',
        content: markdownContent,
        contentType: 'text/markdown',
      });

      expect(result.success).toBe(true);
      expect(result.result?.version).toBe(1);
      ctx.artifactId = result.result!.id;

      console.log(`    ✓ Artifact uploaded: ${ctx.artifactId}`);
      console.log(`    ✓ Version: ${result.result?.version}`);
    });

    it('should get artifact by ID', async () => {
      const result = await runner.execute<{
        id: string;
        content: string;
        version: number;
        definition: { key: string };
      }>('get_artifact', {
        artifactId: ctx.artifactId,
        includeContent: true,
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBe(ctx.artifactId);
      expect(result.result?.content).toContain('Architecture Document');
      expect(result.result?.definition?.key).toBe('ARCH_DOC');

      console.log(`    ✓ Artifact retrieved with content`);
    });

    it('should get artifact by definition key + run ID', async () => {
      const result = await runner.execute<{
        id: string;
        content: string;
      }>('get_artifact', {
        definitionKey: 'ARCH_DOC',
        workflowRunId: ctx.runId,
        includeContent: true,
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBe(ctx.artifactId);
      expect(result.result?.content).toContain('## Overview');

      console.log(`    ✓ Artifact retrieved by key + run`);
    });

    it('should list artifacts for workflow run', async () => {
      const result = await runner.execute<{
        data: Array<{ id: string; version: number }>;
      }>('list_artifacts', {
        workflowRunId: ctx.runId,
        includeContent: false,
      });

      expect(result.success).toBe(true);
      const found = result.result?.data.find((a) => a.id === ctx.artifactId);
      expect(found).toBeDefined();

      console.log(`    ✓ Found artifact in list of ${result.result?.data.length}`);
    });

    it('should upload new version of artifact', async () => {
      const updatedContent = `# Architecture Document (v2)

## Overview
Updated architecture for ${testPrefix}.

## Changes in v2
- Added caching layer
- Improved error handling
`;

      const result = await runner.execute<{
        id: string;
        version: number;
      }>('upload_artifact', {
        workflowRunId: ctx.runId,
        definitionKey: 'ARCH_DOC',
        content: updatedContent,
      });

      expect(result.success).toBe(true);
      expect(result.result?.version).toBe(2);

      console.log(`    ✓ Artifact updated to version ${result.result?.version}`);
    });
  });

  // ==========================================================================
  // ARTIFACT SESSIONS (interactive editing)
  // ==========================================================================
  describe('Artifact Sessions', () => {
    it('should open artifact session', async () => {
      const result = await runner.execute<{
        jobId: string;
        status: string;
      }>('open_artifact_session', {
        workflowRunId: ctx.runId,
        definitionKey: 'ARCH_DOC',
        discussionPrompt: 'Review and improve the architecture document',
        maxTurns: 5,
      });

      expect(result.success).toBe(true);
      expect(result.result?.jobId).toBeDefined();
      ctx.sessionJobId = result.result!.jobId;

      console.log(`    ✓ Artifact session opened: ${ctx.sessionJobId}`);
    });

    it('should close artifact session without saving', async () => {
      const result = await runner.execute<{ success: boolean }>('close_artifact_session', {
        jobId: ctx.sessionJobId,
        reason: 'Test complete - closing without changes',
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Artifact session closed`);

      ctx.sessionJobId = undefined;
    });

    // Note: save_artifact_changes requires an actual session with output
    // which is complex to test without a real interactive session
  });

  // ==========================================================================
  // ACCESS CONTROL
  // ==========================================================================
  describe('Access Control', () => {
    it('should remove artifact access', async () => {
      const result = await runner.execute<{ success: boolean }>('remove_artifact_access', {
        definitionId: ctx.artifactDefId,
        stateId: ctx.stateId,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Artifact access removed`);
    });

    it('should set required access type', async () => {
      const result = await runner.execute<{ success: boolean }>('set_artifact_access', {
        definitionId: ctx.artifactDefId,
        stateId: ctx.stateId,
        accessType: 'required',
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Required access set (state must consume this artifact)`);
    });
  });

  // ==========================================================================
  // CLEANUP
  // ==========================================================================
  describe('Cleanup', () => {
    it('should delete artifact definition (cascades to artifacts)', async () => {
      const result = await runner.execute<{ success: boolean }>('delete_artifact_definition', {
        definitionId: ctx.artifactDefId,
        confirm: true,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Artifact definition deleted`);

      ctx.artifactDefId = undefined;
      ctx.artifactId = undefined;
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================
  describe('Error Handling', () => {
    it('should fail to upload artifact for non-existent definition', async () => {
      const result = await runner.execute('upload_artifact', {
        workflowRunId: ctx.runId,
        definitionKey: 'NON_EXISTENT_KEY',
        content: 'Test content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      console.log(`    ✓ Correctly rejected non-existent definition key`);
    });

    it('should fail to get artifact for non-existent ID', async () => {
      const result = await runner.execute('get_artifact', {
        artifactId: '00000000-0000-0000-0000-000000000000',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      console.log(`    ✓ Correctly rejected non-existent artifact ID`);
    });

    it('should fail to delete definition without confirmation', async () => {
      // Create a temp definition to test
      const createResult = await runner.execute<{ id: string }>('create_artifact_definition', {
        workflowId: ctx.teamId,
        name: 'Temp Definition',
        key: 'TEMP_DEF',
        type: 'markdown',
      });

      if (createResult.success) {
        const deleteResult = await runner.execute('delete_artifact_definition', {
          definitionId: createResult.result!.id,
          confirm: false, // Should fail
        });

        expect(deleteResult.success).toBe(false);
        console.log(`    ✓ Correctly rejected delete without confirmation`);

        // Cleanup
        await runner.execute('delete_artifact_definition', {
          definitionId: createResult.result!.id,
          confirm: true,
        });
      }
    });
  });
});
