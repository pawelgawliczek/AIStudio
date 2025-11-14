/**
 * Script to create comprehensive test cases for UC-EXEC-001 through UC-EXEC-006
 * Run with: npx tsx create-test-cases.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const projectId = '345a29ee-d6ab-477d-8079-c5dda0844d77';

// Use case IDs
const useCases = {
  'UC-EXEC-001': '5df30fc7-9323-45a3-9ecd-51527545da8a',
  'UC-EXEC-002': '3000defd-607b-4578-b4ae-e2a8d01b0975',
  'UC-EXEC-003': '14e9981c-53ab-438c-a16e-c13c9fc2964b',
  'UC-EXEC-004': '00022577-8190-4367-8433-ecb08beb4e3e',
  'UC-EXEC-005': '03e3458a-5518-4de5-b0a5-ef72e03ded18',
  'UC-EXEC-006': '9b8f542c-ecbe-405a-942a-d7b9ed105103',
};

const testCases = [
  // UC-EXEC-001: Execute Story with Workflow - Unit Tests
  {
    key: 'TC-EXEC-001-U1',
    useCaseId: useCases['UC-EXEC-001'],
    title: 'Unit: Validate story exists before execution',
    description: 'Test that execute_story_with_workflow validates story existence and returns appropriate error when story not found',
    testLevel: 'unit',
    priority: 'critical',
    preconditions: '- Database with test fixtures\n- No story with specified ID exists',
    testSteps: '1. Call handler with non-existent storyId\n2. Expect error thrown\n3. Verify error message contains story ID\n4. Verify no WorkflowRun created',
    expectedResults: 'Error: Story with ID {id} not found',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_story_with_workflow.test.ts',
  },
  {
    key: 'TC-EXEC-001-U2',
    useCaseId: useCases['UC-EXEC-001'],
    title: 'Unit: Validate workflow exists and is active',
    description: 'Test that inactive or non-existent workflows are rejected',
    testLevel: 'unit',
    priority: 'critical',
    preconditions: '- Story exists\n- Workflow either doesn\'t exist or is inactive',
    testSteps: '1. Call handler with valid story but invalid/inactive workflow\n2. Expect error thrown\n3. Verify appropriate error message',
    expectedResults: 'Error: Workflow not found or not active',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_story_with_workflow.test.ts',
  },
  {
    key: 'TC-EXEC-001-U3',
    useCaseId: useCases['UC-EXEC-001'],
    title: 'Unit: Validate story is not in done status',
    description: 'Test that completed stories cannot be executed',
    testLevel: 'unit',
    priority: 'high',
    preconditions: '- Story exists with status=done',
    testSteps: '1. Call handler with done story\n2. Expect error thrown\n3. Verify error mentions story is completed',
    expectedResults: 'Error: Cannot execute workflow on completed story',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_story_with_workflow.test.ts',
  },
  {
    key: 'TC-EXEC-001-U4',
    useCaseId: useCases['UC-EXEC-001'],
    title: 'Unit: Detect concurrent execution conflicts',
    description: 'Test that concurrent executions on same story are prevented',
    testLevel: 'unit',
    priority: 'critical',
    preconditions: '- Story has existing WorkflowRun with status=running',
    testSteps: '1. Call handler for story with existing run\n2. Expect error thrown\n3. Verify error includes existing runId',
    expectedResults: 'Error: Story already has running execution',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_story_with_workflow.test.ts',
  },

  // UC-EXEC-001: Integration Tests
  {
    key: 'TC-EXEC-001-I1',
    useCaseId: useCases['UC-EXEC-001'],
    title: 'Integration: Execute workflow successfully creates WorkflowRun',
    description: 'Test complete flow from execute_story_with_workflow to WorkflowRun creation',
    testLevel: 'integration',
    priority: 'critical',
    preconditions: '- Valid story and workflow\n- No existing runs',
    testSteps: '1. Call execute_story_with_workflow\n2. Verify WorkflowRun created with correct fields\n3. Verify Story.assignedWorkflowId updated\n4. Verify story context in run',
    expectedResults: 'WorkflowRun created, linked to story, status=running',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_story_with_workflow.integration.test.ts',
  },
  {
    key: 'TC-EXEC-001-I2',
    useCaseId: useCases['UC-EXEC-001'],
    title: 'Integration: Epic linkage when story belongs to epic',
    description: 'Test that WorkflowRun.epicId is set when story has epicId',
    testLevel: 'integration',
    priority: 'high',
    preconditions: '- Story belongs to epic',
    testSteps: '1. Execute workflow on story with epicId\n2. Verify WorkflowRun.epicId set correctly\n3. Verify epic relation accessible',
    expectedResults: 'WorkflowRun.epicId matches story.epicId',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_story_with_workflow.integration.test.ts',
  },

  // UC-EXEC-001: E2E Tests
  {
    key: 'TC-EXEC-001-E1',
    useCaseId: useCases['UC-EXEC-001'],
    title: 'E2E: Complete workflow execution for simple story',
    description: 'End-to-end test of workflow execution from trigger to completion',
    testLevel: 'e2e',
    priority: 'critical',
    preconditions: '- Test project, story, and workflow\n- Components configured',
    testSteps: '1. Execute story with workflow\n2. Monitor execution progress\n3. Verify all components execute\n4. Verify story status updated\n5. Verify results accessible',
    expectedResults: 'Complete execution, all components run, story progressed',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_story_with_workflow.e2e.test.ts',
  },

  // UC-EXEC-002: Execute Epic - Unit Tests
  {
    key: 'TC-EXEC-002-U1',
    useCaseId: useCases['UC-EXEC-002'],
    title: 'Unit: Validate epic exists',
    description: 'Test that execute_epic_with_workflow validates epic existence',
    testLevel: 'unit',
    priority: 'critical',
    preconditions: '- No epic with specified ID',
    testSteps: '1. Call handler with non-existent epicId\n2. Expect error thrown',
    expectedResults: 'Error: Epic with ID {id} not found',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_epic_with_workflow.test.ts',
  },
  {
    key: 'TC-EXEC-002-U2',
    useCaseId: useCases['UC-EXEC-002'],
    title: 'Unit: Filter stories by status correctly',
    description: 'Test that story status filtering works as expected',
    testLevel: 'unit',
    priority: 'high',
    preconditions: '- Epic with stories in various statuses',
    testSteps: '1. Call with storyStatus filter\n2. Verify only matching stories selected',
    expectedResults: 'Only stories with specified status included',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_epic_with_workflow.test.ts',
  },
  {
    key: 'TC-EXEC-002-U3',
    useCaseId: useCases['UC-EXEC-002'],
    title: 'Unit: AbortOnError stops sequential execution',
    description: 'Test that abortOnError=true stops after first failure in sequential mode',
    testLevel: 'unit',
    priority: 'high',
    preconditions: '- Epic with multiple stories\n- First story will fail',
    testSteps: '1. Execute with mode=sequential, abortOnError=true\n2. First story fails\n3. Verify remaining stories marked as skipped',
    expectedResults: 'Execution stops, remaining stories skipped',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_epic_with_workflow.test.ts',
  },

  // UC-EXEC-002: Integration Tests
  {
    key: 'TC-EXEC-002-I1',
    useCaseId: useCases['UC-EXEC-002'],
    title: 'Integration: Sequential execution maintains order',
    description: 'Test that stories execute one-by-one in sequential mode',
    testLevel: 'integration',
    priority: 'critical',
    preconditions: '- Epic with 3+ stories',
    testSteps: '1. Execute with mode=sequential\n2. Monitor execution timing\n3. Verify stories start after previous completes',
    expectedResults: 'Stories execute sequentially, not overlapping',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_epic_with_workflow.integration.test.ts',
  },
  {
    key: 'TC-EXEC-002-I2',
    useCaseId: useCases['UC-EXEC-002'],
    title: 'Integration: Parallel execution starts all at once',
    description: 'Test that parallel mode starts all stories simultaneously',
    testLevel: 'integration',
    priority: 'high',
    preconditions: '- Epic with 3+ stories',
    testSteps: '1. Execute with mode=parallel\n2. Check all WorkflowRuns created immediately\n3. Verify all have similar startedAt timestamps',
    expectedResults: 'All stories started within ~1 second',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_epic_with_workflow.integration.test.ts',
  },

  // UC-EXEC-002: E2E Test
  {
    key: 'TC-EXEC-002-E1',
    useCaseId: useCases['UC-EXEC-002'],
    title: 'E2E: Execute epic with mixed story outcomes',
    description: 'End-to-end test with some stories succeeding, some failing',
    testLevel: 'e2e',
    priority: 'high',
    preconditions: '- Epic with stories that will succeed/fail',
    testSteps: '1. Execute epic with parallel mode\n2. Wait for all completions\n3. Verify summary shows correct counts\n4. Verify each story has appropriate status',
    expectedResults: 'Summary accurate, failed stories identified',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/execute_epic_with_workflow.e2e.test.ts',
  },

  // UC-EXEC-003: Query Results - Unit Tests
  {
    key: 'TC-EXEC-003-U1',
    useCaseId: useCases['UC-EXEC-003'],
    title: 'Unit: Return error for non-existent runId',
    description: 'Test that get_workflow_run_results validates runId exists',
    testLevel: 'unit',
    priority: 'critical',
    preconditions: '- No WorkflowRun with specified ID',
    testSteps: '1. Call handler with non-existent runId\n2. Expect error thrown',
    expectedResults: 'Error: Workflow run with ID {id} not found',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/get_workflow_run_results.test.ts',
  },
  {
    key: 'TC-EXEC-003-U2',
    useCaseId: useCases['UC-EXEC-003'],
    title: 'Unit: Calculate progress percentage correctly',
    description: 'Test progress calculation for various completion states',
    testLevel: 'unit',
    priority: 'medium',
    preconditions: '- WorkflowRun with partial component completion',
    testSteps: '1. Mock run with 3/5 components completed\n2. Call handler\n3. Verify percentComplete = 60',
    expectedResults: 'Correct percentage calculation',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/get_workflow_run_results.test.ts',
  },

  // UC-EXEC-003: Integration Test
  {
    key: 'TC-EXEC-003-I1',
    useCaseId: useCases['UC-EXEC-003'],
    title: 'Integration: Fetch complete run with all relations',
    description: 'Test that all related data is properly loaded',
    testLevel: 'integration',
    priority: 'high',
    preconditions: '- WorkflowRun with story, epic, components',
    testSteps: '1. Call get_workflow_run_results\n2. Verify workflow details included\n3. Verify story details included\n4. Verify epic details included (if applicable)\n5. Verify componentRuns array populated',
    expectedResults: 'All relations loaded, no N+1 queries',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/get_workflow_run_results.integration.test.ts',
  },

  // UC-EXEC-003: E2E Test
  {
    key: 'TC-EXEC-003-E1',
    useCaseId: useCases['UC-EXEC-003'],
    title: 'E2E: Query results during and after execution',
    description: 'Test querying results at different execution stages',
    testLevel: 'e2e',
    priority: 'medium',
    preconditions: '- Active workflow execution',
    testSteps: '1. Start execution\n2. Query results while running\n3. Verify partial results shown\n4. Wait for completion\n5. Query again\n6. Verify full results with metrics',
    expectedResults: 'Results available at all stages, complete at end',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/get_workflow_run_results.e2e.test.ts',
  },

  // UC-EXEC-004: List Workflows - Unit Tests
  {
    key: 'TC-EXEC-004-U1',
    useCaseId: useCases['UC-EXEC-004'],
    title: 'Unit: Filter workflows by active status',
    description: 'Test that only active workflows returned by default',
    testLevel: 'unit',
    priority: 'high',
    preconditions: '- Project with active and inactive workflows',
    testSteps: '1. Call list_workflows without activeOnly param\n2. Verify only active workflows returned',
    expectedResults: 'No inactive workflows in results',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflows.test.ts',
  },
  {
    key: 'TC-EXEC-004-U2',
    useCaseId: useCases['UC-EXEC-004'],
    title: 'Unit: Return error for non-existent project',
    description: 'Test project validation',
    testLevel: 'unit',
    priority: 'critical',
    preconditions: '- No project with specified ID',
    testSteps: '1. Call with non-existent projectId\n2. Expect error thrown',
    expectedResults: 'Error: Project with ID {id} not found',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflows.test.ts',
  },

  // UC-EXEC-004: Integration Test
  {
    key: 'TC-EXEC-004-I1',
    useCaseId: useCases['UC-EXEC-004'],
    title: 'Integration: Include component details for each workflow',
    description: 'Test that component information is properly fetched',
    testLevel: 'integration',
    priority: 'high',
    preconditions: '- Workflows with components configured',
    testSteps: '1. Call list_workflows\n2. Verify each workflow has components array\n3. Verify component count matches\n4. Verify component names/descriptions included',
    expectedResults: 'Complete component information for decision-making',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflows.integration.test.ts',
  },

  // UC-EXEC-004: E2E Test
  {
    key: 'TC-EXEC-004-E1',
    useCaseId: useCases['UC-EXEC-004'],
    title: 'E2E: Agent selects workflow based on story complexity',
    description: 'End-to-end workflow selection based on complexity scores',
    testLevel: 'e2e',
    priority: 'medium',
    preconditions: '- Multiple workflows for different complexity levels',
    testSteps: '1. Create stories with various BC/TC scores\n2. Agent lists workflows\n3. Agent selects appropriate workflow for each\n4. Verify selections match complexity guidelines',
    expectedResults: 'Optimal workflow selected for each story type',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflows.e2e.test.ts',
  },

  // UC-EXEC-005: Assign Workflow - Unit Tests
  {
    key: 'TC-EXEC-005-U1',
    useCaseId: useCases['UC-EXEC-005'],
    title: 'Unit: Validate story and workflow exist',
    description: 'Test validation of both story and workflow',
    testLevel: 'unit',
    priority: 'critical',
    preconditions: '- Either story or workflow doesn\'t exist',
    testSteps: '1. Call with invalid story or workflow\n2. Expect error thrown',
    expectedResults: 'Appropriate error for missing entity',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/assign_workflow_to_story.test.ts',
  },
  {
    key: 'TC-EXEC-005-U2',
    useCaseId: useCases['UC-EXEC-005'],
    title: 'Unit: Prevent assigning inactive workflow',
    description: 'Test that inactive workflows cannot be assigned',
    testLevel: 'unit',
    priority: 'high',
    preconditions: '- Workflow exists but is inactive',
    testSteps: '1. Call with inactive workflow\n2. Expect error thrown',
    expectedResults: 'Error: Cannot assign inactive workflow',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/assign_workflow_to_story.test.ts',
  },
  {
    key: 'TC-EXEC-005-U3',
    useCaseId: useCases['UC-EXEC-005'],
    title: 'Unit: Clear assignment with null workflowId',
    description: 'Test clearing workflow assignment',
    testLevel: 'unit',
    priority: 'medium',
    preconditions: '- Story has assigned workflow',
    testSteps: '1. Call with workflowId=null\n2. Verify Story.assignedWorkflowId cleared\n3. Verify confirmation message',
    expectedResults: 'Assignment cleared successfully',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/assign_workflow_to_story.test.ts',
  },

  // UC-EXEC-005: Integration Test
  {
    key: 'TC-EXEC-005-I1',
    useCaseId: useCases['UC-EXEC-005'],
    title: 'Integration: Assignment persists across queries',
    description: 'Test that assigned workflow is retrievable',
    testLevel: 'integration',
    priority: 'high',
    preconditions: '- Valid story and workflow',
    testSteps: '1. Assign workflow to story\n2. Fetch story separately\n3. Verify assignedWorkflowId set\n4. Verify workflow relation loadable',
    expectedResults: 'Assignment persists in database',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/assign_workflow_to_story.integration.test.ts',
  },

  // UC-EXEC-005: E2E Test
  {
    key: 'TC-EXEC-005-E1',
    useCaseId: useCases['UC-EXEC-005'],
    title: 'E2E: Assigned workflow used in execution',
    description: 'Test that execution uses pre-assigned workflow',
    testLevel: 'e2e',
    priority: 'high',
    preconditions: '- Story with assigned workflow',
    testSteps: '1. Assign workflow to story\n2. Execute story without specifying workflow\n3. Verify assigned workflow used\n4. Verify execution succeeds',
    expectedResults: 'Pre-assigned workflow used automatically',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/assign_workflow_to_story.e2e.test.ts',
  },

  // UC-EXEC-006: List Runs - Unit Tests
  {
    key: 'TC-EXEC-006-U1',
    useCaseId: useCases['UC-EXEC-006'],
    title: 'Unit: Require at least one filter parameter',
    description: 'Test that at least projectId, workflowId, or storyId is required',
    testLevel: 'unit',
    priority: 'critical',
    preconditions: '- No filters provided',
    testSteps: '1. Call with empty params\n2. Expect error thrown',
    expectedResults: 'Error: At least one filter is required',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflow_runs.test.ts',
  },
  {
    key: 'TC-EXEC-006-U2',
    useCaseId: useCases['UC-EXEC-006'],
    title: 'Unit: Filter by status correctly',
    description: 'Test status filtering works',
    testLevel: 'unit',
    priority: 'high',
    preconditions: '- WorkflowRuns with various statuses',
    testSteps: '1. Call with status=failed\n2. Verify only failed runs returned',
    expectedResults: 'Only runs matching status filter',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflow_runs.test.ts',
  },
  {
    key: 'TC-EXEC-006-U3',
    useCaseId: useCases['UC-EXEC-006'],
    title: 'Unit: Pagination limits enforced',
    description: 'Test that limit cannot exceed 100',
    testLevel: 'unit',
    priority: 'medium',
    preconditions: '- Many WorkflowRuns exist',
    testSteps: '1. Call with limit=500\n2. Verify only 100 results returned',
    expectedResults: 'Maximum 100 results despite larger limit',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflow_runs.test.ts',
  },

  // UC-EXEC-006: Integration Test
  {
    key: 'TC-EXEC-006-I1',
    useCaseId: useCases['UC-EXEC-006'],
    title: 'Integration: Load all related entities efficiently',
    description: 'Test that workflow, coordinator, story, epic are included without N+1 queries',
    testLevel: 'integration',
    priority: 'high',
    preconditions: '- WorkflowRuns with various relations',
    testSteps: '1. Call list_workflow_runs\n2. Monitor query count\n3. Verify all relations loaded\n4. Verify reasonable query count',
    expectedResults: 'All data loaded efficiently',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflow_runs.integration.test.ts',
  },

  // UC-EXEC-006: E2E Test
  {
    key: 'TC-EXEC-006-E1',
    useCaseId: useCases['UC-EXEC-006'],
    title: 'E2E: Query runs for project across time',
    description: 'Test querying historical runs with various filters',
    testLevel: 'e2e',
    priority: 'medium',
    preconditions: '- Project with execution history',
    testSteps: '1. Query all runs for project\n2. Filter by workflow\n3. Filter by status\n4. Paginate through results\n5. Verify metrics accurate',
    expectedResults: 'Complete execution history accessible',
    testFilePath: 'backend/src/mcp/servers/execution/__tests__/list_workflow_runs.e2e.test.ts',
  },
];

async function main() {
  console.log('Creating test cases for UC-EXEC-001 through UC-EXEC-006...\n');

  // Get or create system user
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@aistudio.local' },
  });

  if (!systemUser) {
    console.log('Creating system user...');
    systemUser = await prisma.user.create({
      data: {
        name: 'System User',
        email: 'system@aistudio.local',
        password: 'N/A',
        role: 'admin',
      },
    });
    console.log(`✅ System user created: ${systemUser.id}\n`);
  }

  let created = 0;
  let skipped = 0;

  for (const tc of testCases) {
    try {
      // Check if test case already exists
      const existing = await prisma.testCase.findFirst({
        where: {
          projectId,
          key: tc.key,
        },
      });

      if (existing) {
        console.log(`⏭️  Skipped ${tc.key} (already exists)`);
        skipped++;
        continue;
      }

      // Create test case
      await prisma.testCase.create({
        data: {
          projectId,
          useCaseId: tc.useCaseId,
          key: tc.key,
          title: tc.title,
          description: tc.description,
          testLevel: tc.testLevel as any,
          priority: tc.priority as any,
          preconditions: tc.preconditions,
          testSteps: tc.testSteps,
          expectedResults: tc.expectedResults,
          testFilePath: tc.testFilePath,
          status: 'pending',
          createdById: systemUser.id,
        },
      });

      console.log(`✅ Created ${tc.key}: ${tc.title}`);
      created++;
    } catch (error: any) {
      console.error(`❌ Failed to create ${tc.key}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total:   ${testCases.length}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
