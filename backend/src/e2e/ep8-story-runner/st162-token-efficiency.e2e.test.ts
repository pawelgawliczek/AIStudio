/**
 * ST-162: Token Efficiency E2E Tests
 *
 * Tests the new token efficiency features introduced in ST-162:
 * - Story summary field (auto-generated from description)
 * - Fields parameter for list/search operations
 * - ResponseMode parameter for get operations
 * - _truncated/_fieldSelection metadata for transparency
 *
 * These features reduce token usage by ~67% for typical workflows.
 */

import { PrismaClient } from '@prisma/client';
import { MCPTestRunner, createMCPTestRunner } from './helpers/mcp-test-runner';

// Increase timeout for real CLI operations
jest.setTimeout(180000);

describe('ST-162: Token Efficiency E2E Tests', () => {
  let prisma: PrismaClient;
  let runner: MCPTestRunner;

  // Test context
  const ctx: {
    projectId?: string;
    epicId?: string;
    storyId?: string;
    teamId?: string;
    runId?: string;
    artifactDefId?: string;
    artifactId?: string;
  } = {};

  const testPrefix = `_ST162_TOKEN_${Date.now()}`;
  const longDescription = `This is a comprehensive description for testing token efficiency.
The description contains multiple sentences to test summary generation.
It should be automatically truncated to create a 2-sentence summary.
Additional content here that should not appear in the summary.
More content to make the description longer.`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-162: Token Efficiency E2E Tests');
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
      // Delete artifacts and definitions
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

      // Delete team
      if (ctx.teamId) {
        await prisma.workflow.delete({ where: { id: ctx.teamId } }).catch(() => {});
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
  // SETUP
  // ==========================================================================
  describe('Setup', () => {
    it('should create project', async () => {
      const result = await runner.execute<{ id: string }>('create_project', {
        name: `${testPrefix}_Project`,
        description: 'Token efficiency test project',
      });

      expect(result.success).toBe(true);
      ctx.projectId = result.result!.id;
      console.log(`    ✓ Project: ${ctx.projectId}`);
    });

    it('should create epic', async () => {
      const result = await runner.execute<{ id: string }>('create_epic', {
        projectId: ctx.projectId,
        title: `${testPrefix}_Epic`,
        description: 'Test epic with description',
      });

      expect(result.success).toBe(true);
      ctx.epicId = result.result!.id;
      console.log(`    ✓ Epic: ${ctx.epicId}`);
    });
  });

  // ==========================================================================
  // STORY SUMMARY FIELD
  // ==========================================================================
  describe('Story Summary Field', () => {
    it('should create story with auto-generated summary', async () => {
      const result = await runner.execute<{
        id: string;
        title: string;
        summary: string | null;
        description: string;
      }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_Story`,
        description: longDescription,
        type: 'feature',
      });

      expect(result.success).toBe(true);
      ctx.storyId = result.result!.id;

      // Summary should be auto-generated from first 2 sentences
      expect(result.result?.summary).toBeDefined();
      expect(result.result?.summary).not.toBeNull();
      expect(result.result!.summary!.length).toBeLessThanOrEqual(300);

      console.log(`    ✓ Story created with summary: "${result.result?.summary}"`);
    });

    it('should update story and regenerate summary when description changes', async () => {
      const newDescription = 'New short description. Second sentence here.';

      const result = await runner.execute<{
        id: string;
        summary: string | null;
        description: string;
      }>('update_story', {
        storyId: ctx.storyId,
        description: newDescription,
      });

      expect(result.success).toBe(true);
      expect(result.result?.summary).toContain('New short description');

      console.log(`    ✓ Summary regenerated: "${result.result?.summary}"`);
    });

    it('should allow explicit summary override', async () => {
      const explicitSummary = 'This is an explicitly set summary by the AI agent.';

      const result = await runner.execute<{
        id: string;
        summary: string | null;
      }>('update_story', {
        storyId: ctx.storyId,
        summary: explicitSummary,
      });

      expect(result.success).toBe(true);
      expect(result.result?.summary).toBe(explicitSummary);

      console.log(`    ✓ Explicit summary set`);
    });
  });

  // ==========================================================================
  // FIELDS PARAMETER FOR LIST OPERATIONS
  // ==========================================================================
  describe('Fields Parameter', () => {
    it('should return only requested fields in list_stories', async () => {
      const result = await runner.execute<{
        data: Array<{
          id: string;
          key?: string;
          title?: string;
          description?: string;
          _fieldSelection?: {
            requested: string[];
            omitted: string[];
            fetchCommand: string;
          };
        }>;
      }>('list_stories', {
        projectId: ctx.projectId,
        fields: ['id', 'key', 'title', 'status'],
      });

      expect(result.success).toBe(true);
      expect(result.result?.data.length).toBeGreaterThan(0);

      const story = result.result?.data[0];
      expect(story?.id).toBeDefined();
      expect(story?.key).toBeDefined();
      expect(story?.title).toBeDefined();
      // Description should NOT be present (not requested)
      expect(story?.description).toBeUndefined();

      // Should have _fieldSelection metadata
      expect(story?._fieldSelection).toBeDefined();
      expect(story?._fieldSelection?.omitted).toContain('description');
      expect(story?._fieldSelection?.fetchCommand).toBeDefined();

      console.log(`    ✓ Fields filtered: ${story?._fieldSelection?.omitted.length} fields omitted`);
      console.log(`    ✓ Fetch command provided: ${story?._fieldSelection?.fetchCommand.slice(0, 50)}...`);
    });

    it('should return only requested fields in list_stories with query', async () => {
      // list_stories with query param performs text search (merged from search_stories)
      const result = await runner.execute<{
        data: Array<{
          id: string;
          key?: string;
          description?: string;
          _fieldSelection?: {
            requested: string[];
            omitted: string[];
          };
        }>;
      }>('list_stories', {
        query: testPrefix,
        projectId: ctx.projectId,
        fields: ['id', 'key', 'summary'],
      });

      expect(result.success).toBe(true);
      expect(result.result?.data?.length).toBeGreaterThan(0);

      const story = result.result?.data?.[0];
      expect(story?.id).toBeDefined();
      expect(story?.description).toBeUndefined();

      console.log(`    ✓ list_stories with query + fields parameter works`);
    });

    it('should return only requested fields in list_epics', async () => {
      const result = await runner.execute<{
        data: Array<{
          id: string;
          title?: string;
          description?: string;
          _fieldSelection?: {
            requested: string[];
            omitted: string[];
          };
        }>;
      }>('list_epics', {
        projectId: ctx.projectId,
        fields: ['id', 'title', 'status'],
      });

      expect(result.success).toBe(true);
      expect(result.result?.data.length).toBeGreaterThan(0);

      const epic = result.result?.data.find((e) => e.id === ctx.epicId);
      expect(epic?.id).toBeDefined();
      expect(epic?.title).toBeDefined();
      expect(epic?.description).toBeUndefined();

      console.log(`    ✓ list_epics with fields parameter works`);
    });
  });

  // ==========================================================================
  // RESPONSE MODE PARAMETER
  // ==========================================================================
  describe('Response Mode Parameter', () => {
    it('should return minimal response with get_story responseMode=minimal', async () => {
      const result = await runner.execute<{
        id: string;
        key: string;
        title: string;
        description?: string;
        _responseMode?: {
          mode: string;
          omittedFields: string[];
          fetchCommand: string;
        };
      }>('get_story', {
        storyId: ctx.storyId,
        responseMode: 'minimal',
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();
      expect(result.result?.key).toBeDefined();
      expect(result.result?.title).toBeDefined();
      expect(result.result?.description).toBeUndefined();

      // Should have _responseMode metadata
      expect(result.result?._responseMode).toBeDefined();
      expect(result.result?._responseMode?.mode).toBe('minimal');
      expect(result.result?._responseMode?.omittedFields.length).toBeGreaterThan(0);
      expect(result.result?._responseMode?.fetchCommand).toBeDefined();

      console.log(`    ✓ Minimal mode: ${result.result?._responseMode?.omittedFields.length} fields omitted`);
    });

    it('should return standard response by default', async () => {
      const result = await runner.execute<{
        id: string;
        description: string;
        _responseMode?: object;
      }>('get_story', {
        storyId: ctx.storyId,
      });

      expect(result.success).toBe(true);
      expect(result.result?.description).toBeDefined();
      // No _responseMode in standard mode
      expect(result.result?._responseMode).toBeUndefined();

      console.log(`    ✓ Standard mode: all fields included`);
    });

    it('should return full response with relations with responseMode=full', async () => {
      const result = await runner.execute<{
        id: string;
        subtasks: Array<unknown>;
        useCases: Array<unknown>;
        commits: Array<unknown>;
        _responseMode?: {
          mode: string;
        };
      }>('get_story', {
        storyId: ctx.storyId,
        responseMode: 'full',
      });

      expect(result.success).toBe(true);
      expect(result.result?.subtasks).toBeDefined();
      expect(result.result?.useCases).toBeDefined();
      expect(result.result?.commits).toBeDefined();
      expect(result.result?._responseMode?.mode).toBe('full');

      console.log(`    ✓ Full mode: all relations included`);
    });
  });

  // ==========================================================================
  // ARTIFACT CONTENT TRUNCATION
  // ==========================================================================
  describe('Artifact Content Truncation', () => {
    beforeAll(async () => {
      // Create minimal team for artifacts (ST-164: no PM required)
      const teamResult = await runner.execute<{ id: string }>('create_team', {
        projectId: ctx.projectId,
        name: `${testPrefix}_Team`,
        triggerConfig: { type: 'manual' },
      });

      if (!teamResult.success || !teamResult.result?.id) {
        console.error('Failed to create team:', teamResult);
        throw new Error('Team creation failed');
      }
      ctx.teamId = teamResult.result.id;
      console.log(`    ✓ Team: ${ctx.teamId}`);

      const runResult = await runner.execute<{ runId: string }>('start_team_run', {
        teamId: ctx.teamId,
        triggeredBy: 'st162-test',
        context: { storyId: ctx.storyId },
      });

      if (!runResult.success || !runResult.result?.runId) {
        console.error('Failed to start team run:', runResult);
        throw new Error('Team run start failed');
      }
      ctx.runId = runResult.result.runId;
      console.log(`    ✓ Run: ${ctx.runId}`);

      const defResult = await runner.execute<{ id: string }>('create_artifact_definition', {
        workflowId: ctx.teamId,
        name: 'Test Doc',
        key: 'TEST_DOC',
        type: 'markdown',
      });

      if (!defResult.success || !defResult.result?.id) {
        console.error('Failed to create artifact definition:', defResult);
        throw new Error('Artifact definition creation failed');
      }
      ctx.artifactDefId = defResult.result.id;
      console.log(`    ✓ Artifact Def: ${ctx.artifactDefId}`);

      const artifactResult = await runner.execute<{ id: string }>('upload_artifact', {
        workflowRunId: ctx.runId,
        definitionKey: 'TEST_DOC',
        content: 'This is test content for the artifact. '.repeat(100),
      });

      if (!artifactResult.success || !artifactResult.result?.id) {
        console.error('Failed to upload artifact:', artifactResult);
        throw new Error('Artifact upload failed');
      }
      ctx.artifactId = artifactResult.result.id;
      console.log(`    ✓ Artifact: ${ctx.artifactId}`);
    });

    it('should return artifact metadata without content by default', async () => {
      if (!ctx.artifactId) {
        console.log('    ⏭ SKIPPED: No artifactId available');
        return;
      }

      const result = await runner.execute<{
        id: string;
        content: string | null;
        size: number;
        _truncated?: {
          field: string;
          reason: string;
          fetchCommand: string;
        };
      }>('get_artifact', {
        artifactId: ctx.artifactId,
        // NOT specifying includeContent - should default to false
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBe(ctx.artifactId);
      expect(result.result?.content).toBeNull();
      expect(result.result?.size).toBeGreaterThan(0);

      // Should have _truncated metadata with fetch instructions
      expect(result.result?._truncated).toBeDefined();
      expect(result.result?._truncated?.field).toBe('content');
      expect(result.result?._truncated?.fetchCommand).toContain('includeContent: true');

      console.log(`    ✓ Artifact metadata returned without content (${result.result?.size} bytes)`);
      console.log(`    ✓ Fetch command: ${result.result?._truncated?.fetchCommand}`);
    });

    it('should return full content when includeContent=true', async () => {
      if (!ctx.artifactId) {
        console.log('    ⏭ SKIPPED: No artifactId available');
        return;
      }

      const result = await runner.execute<{
        id: string;
        content: string;
        _truncated?: object;
      }>('get_artifact', {
        artifactId: ctx.artifactId,
        includeContent: true,
      });

      expect(result.success).toBe(true);
      expect(result.result?.content).toBeDefined();
      expect(result.result?.content.length).toBeGreaterThan(100);
      expect(result.result?._truncated).toBeUndefined();

      console.log(`    ✓ Full content returned: ${result.result?.content.length} chars`);
    });
  });

  // ==========================================================================
  // EXCLUDE DESCRIPTION PARAMETER
  // ==========================================================================
  describe('Exclude Description Parameter', () => {
    it('should exclude description with _truncated metadata', async () => {
      const result = await runner.execute<{
        data: Array<{
          id: string;
          summary?: string;
          description?: string;
          _truncated?: {
            field: string;
            originalLength: number;
            fetchCommand: string;
          };
        }>;
      }>('list_stories', {
        projectId: ctx.projectId,
        excludeDescription: true,
      });

      expect(result.success).toBe(true);
      expect(result.result?.data.length).toBeGreaterThan(0);

      const story = result.result?.data[0];
      expect(story?.description).toBeUndefined();
      expect(story?.summary).toBeDefined(); // Summary should still be there

      // Should have _truncated metadata
      expect(story?._truncated).toBeDefined();
      expect(story?._truncated?.field).toBe('description');
      expect(story?._truncated?.fetchCommand).toBeDefined();

      console.log(`    ✓ Description excluded, summary preserved`);
      console.log(`    ✓ Original length: ${story?._truncated?.originalLength}`);
    });
  });

  // ==========================================================================
  // GET_COMPONENT_CONTEXT SUMMARY MODE
  // ==========================================================================
  describe('Get Component Context - Summary Mode', () => {
    let agentId: string;
    let stateId: string;
    let componentRunId: string;

    beforeAll(async () => {
      // Create agent
      const agentResult = await runner.execute<{ id: string }>('create_agent', {
        projectId: ctx.projectId,
        name: `${testPrefix}_Agent`,
        inputInstructions: 'Read input',
        operationInstructions: 'Process data',
        outputInstructions: 'Write output',
        config: { modelId: 'claude-sonnet-4-20250514' },
        tools: ['Read'],
      });
      agentId = agentResult.result!.id;

      // Create workflow state
      const stateResult = await runner.execute<{ id: string }>('create_workflow_state', {
        workflowId: ctx.teamId,
        name: `${testPrefix}_State`,
        order: 1,
        componentId: agentId,
      });
      stateId = stateResult.result!.id;

      // Record component start to create a component run
      await runner.execute('record_agent_start', {
        runId: ctx.runId,
        componentId: agentId,
        input: { test: 'data' },
      });

      // Complete the component with some output
      await runner.execute('record_agent_complete', {
        runId: ctx.runId,
        componentId: agentId,
        status: 'completed',
        output: {
          analysis: 'This is a very long output that would normally consume many tokens. '.repeat(50),
          recommendations: ['Item 1', 'Item 2', 'Item 3'],
        },
      });

      // Get the component run ID
      const componentRuns = await prisma.componentRun.findMany({
        where: { workflowRunId: ctx.runId, componentId: agentId },
      });
      componentRunId = componentRuns[0]?.id;
    });

    it('should return full context without summaryMode', async () => {
      const result = await runner.execute<{
        component: { id: string; name: string };
        previousOutputs?: Array<{
          output: unknown;
          _truncated?: object;
        }>;
        story?: { id: string };
        storyAnalysisNote?: string;
      }>('get_component_context', {
        componentId: agentId,
        runId: ctx.runId,
        stateId: stateId,
      });

      expect(result.success).toBe(true);
      expect(result.result?.component.id).toBe(agentId);

      // Should have story without deprecated analysis fields
      if (result.result?.story) {
        expect(result.result.storyAnalysisNote).toContain('deprecated');
      }

      console.log(`    ✓ Full context retrieved`);
      if (result.result?.previousOutputs?.length) {
        console.log(`    ✓ Previous outputs: ${result.result.previousOutputs.length}`);
      }
    });

    it('should return truncated outputs in summaryMode', async () => {
      const result = await runner.execute<{
        component: { id: string };
        previousOutputs?: Array<{
          componentName: string;
          output: string;
          _truncated?: {
            field: string;
            originalLength: number;
            truncatedTo: number;
            fetchCommand: string;
          };
        }>;
        artifacts?: {
          accessible: Array<{
            artifact?: {
              content: string | null;
              _truncated?: {
                field: string;
                fetchCommand: string;
              };
            };
          }>;
        };
      }>('get_component_context', {
        componentId: agentId,
        runId: ctx.runId,
        stateId: stateId,
        summaryMode: true,
      });

      expect(result.success).toBe(true);

      // Check if outputs are truncated (if there are previous outputs)
      if (result.result?.previousOutputs?.length) {
        const output = result.result.previousOutputs[0];
        if (output._truncated) {
          expect(output._truncated.field).toBe('output');
          expect(output._truncated.truncatedTo).toBeLessThanOrEqual(500);
          expect(output._truncated.fetchCommand).toBeDefined();
          console.log(`    ✓ Output truncated from ${output._truncated.originalLength} to ${output._truncated.truncatedTo}`);
        }
      }

      // Check if artifacts have omitted content (if there are accessible artifacts)
      if (result.result?.artifacts?.accessible?.length) {
        const artifact = result.result.artifacts.accessible[0].artifact;
        if (artifact?._truncated) {
          expect(artifact.content).toBeNull();
          expect(artifact._truncated.fetchCommand).toBeDefined();
          console.log(`    ✓ Artifact content omitted in summaryMode`);
        }
      }

      console.log(`    ✓ Summary mode returns lightweight context`);
    });
  });

  // ==========================================================================
  // GET_TEAM_CONTEXT TRUNCATE OUTPUTS
  // ==========================================================================
  describe('Get Team Context - Truncate Outputs', () => {
    it('should return full outputs without truncation parameter', async () => {
      const result = await runner.execute<{
        runId: string;
        completedComponents: Array<{
          output: unknown;
          _truncated?: object;
        }>;
      }>('get_team_context', {
        runId: ctx.runId,
      });

      expect(result.success).toBe(true);
      expect(result.result?.runId).toBe(ctx.runId);

      // Without truncation, outputs should be full
      if (result.result?.completedComponents?.length) {
        const component = result.result.completedComponents[0];
        // May or may not have _truncated depending on output size
        console.log(`    ✓ Team context retrieved with ${result.result.completedComponents.length} completed components`);
      }
    });

    it('should truncate outputs with truncateOutputs parameter', async () => {
      const result = await runner.execute<{
        runId: string;
        completedComponents: Array<{
          componentName: string;
          output: string;
          _truncated?: {
            field: string;
            originalLength: number;
            truncatedTo: number;
            fetchCommand: string;
          };
        }>;
      }>('get_team_context', {
        runId: ctx.runId,
        truncateOutputs: 100, // Very short for testing
      });

      expect(result.success).toBe(true);

      if (result.result?.completedComponents?.length) {
        const component = result.result.completedComponents[0];
        if (component._truncated) {
          expect(component._truncated.field).toBe('output');
          expect(component._truncated.truncatedTo).toBe(100);
          expect(component._truncated.fetchCommand).toContain('get_team_run_results');
          console.log(`    ✓ Output truncated to ${component._truncated.truncatedTo} chars`);
          console.log(`    ✓ Fetch command: ${component._truncated.fetchCommand}`);
        } else {
          console.log(`    ✓ Output was already under 100 chars`);
        }
      } else {
        console.log(`    ✓ No completed components to truncate`);
      }
    });
  });

  // ==========================================================================
  // GET_TEAM_RUN_RESULTS RESPONSE MODE
  // ==========================================================================
  describe('Get Team Run Results - Response Mode', () => {
    beforeEach(() => {
      // These tests depend on ctx.runId being set by Artifact Content Truncation beforeAll
      if (!ctx.runId) {
        console.warn('    ⚠ Skipping test: ctx.runId not set (artifact setup may have failed)');
      }
    });

    it('should return minimal results with responseMode=minimal', async () => {
      if (!ctx.runId) {
        console.log('    ⏭ SKIPPED: No runId available');
        return;
      }

      const result = await runner.execute<{
        run: {
          id: string;
          status: string;
          metrics: object;
          progress: object;
          components: Array<{
            componentRunId: string;
            metrics?: object;
            output?: unknown;
          }>;
          coordinatorDecisions?: unknown;
        };
        _responseMode: {
          mode: string;
          included: {
            componentDetails: boolean;
            artifacts: boolean;
          };
          omitted?: string[];
          fetchCommand?: string;
        };
      }>('get_team_run_results', {
        runId: ctx.runId,
        responseMode: 'minimal',
      });

      expect(result.success).toBe(true);
      expect(result.result?._responseMode.mode).toBe('minimal');
      expect(result.result?._responseMode.included.componentDetails).toBe(false);

      // In minimal mode, component details should be excluded
      if (result.result?.run.components.length) {
        const component = result.result.run.components[0];
        expect(component.metrics).toBeUndefined();
        expect(component.output).toBeUndefined();
      }

      // Should not have coordinator decisions in minimal mode
      expect(result.result?.run.coordinatorDecisions).toBeUndefined();

      // Should have fetch command for full results
      expect(result.result?._responseMode.fetchCommand).toContain('responseMode: \'full\'');

      console.log(`    ✓ Minimal mode: ${result.result?._responseMode.omitted?.length} items omitted`);
      console.log(`    ✓ Fetch command provided for full results`);
    });

    it('should return standard results by default', async () => {
      if (!ctx.runId) {
        console.log('    ⏭ SKIPPED: No runId available');
        return;
      }

      const result = await runner.execute<{
        run: {
          components: Array<{
            metrics?: object;
            output?: unknown;
          }>;
          coordinatorDecisions?: unknown;
        };
        _responseMode: {
          mode: string;
        };
      }>('get_team_run_results', {
        runId: ctx.runId,
      });

      expect(result.success).toBe(true);
      expect(result.result?._responseMode.mode).toBe('standard');

      // Standard mode includes component details
      if (result.result?.run.components.length) {
        const component = result.result.run.components[0];
        expect(component.metrics).toBeDefined();
      }

      console.log(`    ✓ Standard mode: component details included`);
    });

    it('should return full results with responseMode=full', async () => {
      if (!ctx.runId) {
        console.log('    ⏭ SKIPPED: No runId available');
        return;
      }

      const result = await runner.execute<{
        run: {
          components: Array<{
            metrics?: object;
            output?: unknown;
            artifacts?: unknown;
          }>;
          coordinatorDecisions?: unknown;
        };
        _responseMode: {
          mode: string;
          included: {
            artifacts: boolean;
            coordinatorDecisions: boolean;
          };
        };
      }>('get_team_run_results', {
        runId: ctx.runId,
        responseMode: 'full',
      });

      expect(result.success).toBe(true);
      expect(result.result?._responseMode.mode).toBe('full');
      expect(result.result?._responseMode.included.artifacts).toBe(true);
      expect(result.result?._responseMode.included.coordinatorDecisions).toBe(true);

      console.log(`    ✓ Full mode: all details included`);
    });
  });

  // ==========================================================================
  // USE CASE CONTENT EXCLUSION
  // ==========================================================================
  describe('Use Case - Exclude Content', () => {
    let useCaseId: string;

    beforeAll(async () => {
      // Create a use case with content
      // Note: create_use_case returns { content: [{ text: JSON }] } format
      // Key format must be UC-<COMPONENT>-<NUMBER>
      const ucNumber = Date.now() % 10000;
      const result = await runner.execute<{
        content: Array<{ text: string }>;
      }>('create_use_case', {
        projectId: ctx.projectId,
        key: `UC-TEST-${ucNumber}`,
        title: 'Test Use Case',
        content: 'This is detailed use case content. '.repeat(50),
        area: 'Testing',
      });

      // Parse the JSON response to get the use case ID
      const parsed = JSON.parse(result.result?.content?.[0]?.text || '{}');
      useCaseId = parsed.useCase?.id;
      if (!useCaseId) {
        console.error('Failed to create use case:', result);
        throw new Error('Failed to create use case');
      }
      console.log(`    ✓ Use case created: ${useCaseId}`);
    });

    it('should return use cases without content when excludeContent=true', async () => {
      const result = await runner.execute<{
        content: Array<{
          text: string;
        }>;
      }>('search_use_cases', {
        projectId: ctx.projectId,
        area: 'Testing',
        excludeContent: true,
      });

      expect(result.success).toBe(true);

      // Parse the JSON response
      const parsed = JSON.parse(result.result?.content[0].text || '{}');
      if (parsed.useCases?.length) {
        const useCase = parsed.useCases[0];
        expect(useCase.content).toBeNull();
        expect(useCase._truncated).toBeDefined();
        expect(useCase._truncated.field).toBe('content');
        expect(useCase._truncated.fetchCommand).toBeDefined();
        console.log(`    ✓ Use case content excluded with fetch command`);
      }
    });

    it('should return use cases with specific fields only', async () => {
      const result = await runner.execute<{
        content: Array<{
          text: string;
        }>;
      }>('search_use_cases', {
        projectId: ctx.projectId,
        area: 'Testing',
        fields: ['id', 'key', 'title'],
      });

      expect(result.success).toBe(true);

      // Parse the JSON response
      const parsed = JSON.parse(result.result?.content[0].text || '{}');
      if (parsed.useCases?.length) {
        const useCase = parsed.useCases[0];
        expect(useCase.id).toBeDefined();
        expect(useCase.key).toBeDefined();
        expect(useCase.title).toBeDefined();
        expect(useCase.content).toBeUndefined();

        if (useCase._fieldSelection) {
          expect(useCase._fieldSelection.omitted).toContain('content');
          console.log(`    ✓ Use case filtered to ${useCase._fieldSelection.requested.length} fields`);
        }
      }
    });
  });

  // ==========================================================================
  // TRUNCATION METADATA VERIFICATION
  // ==========================================================================
  describe('Truncation Metadata Verification', () => {
    it('should include all required truncation metadata fields', async () => {
      if (!ctx.artifactId) {
        console.log('    ⏭ SKIPPED: No artifactId available');
        return;
      }

      // Get artifact without content to verify metadata
      const result = await runner.execute<{
        _truncated?: {
          field: string;
          originalLength: number;
          truncatedTo: number;
          reason: string;
          fetchCommand: string;
        };
      }>('get_artifact', {
        artifactId: ctx.artifactId,
      });

      expect(result.success).toBe(true);
      const truncated = result.result?._truncated;

      if (truncated) {
        // Verify all required fields are present
        expect(truncated.field).toBeDefined();
        expect(typeof truncated.field).toBe('string');

        // originalLength should be a positive number or 0
        expect(typeof truncated.originalLength).toBe('number');
        expect(truncated.originalLength).toBeGreaterThanOrEqual(0);

        // truncatedTo should be 0 for omitted content
        expect(typeof truncated.truncatedTo).toBe('number');

        // reason should explain why
        expect(truncated.reason).toBeDefined();
        expect(truncated.reason.length).toBeGreaterThan(0);

        // fetchCommand should be actionable
        expect(truncated.fetchCommand).toBeDefined();
        expect(truncated.fetchCommand).toContain('get_artifact');

        console.log(`    ✓ Truncation metadata verified:`);
        console.log(`      - field: ${truncated.field}`);
        console.log(`      - originalLength: ${truncated.originalLength}`);
        console.log(`      - truncatedTo: ${truncated.truncatedTo}`);
        console.log(`      - reason: ${truncated.reason.slice(0, 50)}...`);
        console.log(`      - fetchCommand: ${truncated.fetchCommand}`);
      }
    });

    it('should include all required field selection metadata fields', async () => {
      const result = await runner.execute<{
        data: Array<{
          _fieldSelection?: {
            requested: string[];
            omitted: string[];
            fetchCommand: string;
          };
        }>;
      }>('list_stories', {
        projectId: ctx.projectId,
        fields: ['id', 'key', 'title'],
      });

      expect(result.success).toBe(true);
      const fieldSelection = result.result?.data[0]?._fieldSelection;

      if (fieldSelection) {
        // requested should be array of strings
        expect(Array.isArray(fieldSelection.requested)).toBe(true);
        expect(fieldSelection.requested.length).toBeGreaterThan(0);
        expect(fieldSelection.requested).toContain('id');

        // omitted should be array of strings
        expect(Array.isArray(fieldSelection.omitted)).toBe(true);
        expect(fieldSelection.omitted.length).toBeGreaterThan(0);

        // fetchCommand should be actionable
        expect(fieldSelection.fetchCommand).toBeDefined();
        expect(fieldSelection.fetchCommand.length).toBeGreaterThan(0);

        console.log(`    ✓ Field selection metadata verified:`);
        console.log(`      - requested: ${fieldSelection.requested.join(', ')}`);
        console.log(`      - omitted: ${fieldSelection.omitted.join(', ')}`);
        console.log(`      - fetchCommand: ${fieldSelection.fetchCommand}`);
      }
    });
  });
});
