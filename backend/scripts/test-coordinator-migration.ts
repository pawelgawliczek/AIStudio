/**
 * Comprehensive test suite to verify coordinator schema migration is safe
 * Tests that coordinators work correctly when stored in components table
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<{ passed: boolean; message: string; details?: any }>
) {
  console.log(`\n🧪 Running: ${name}`);
  try {
    const result = await testFn();
    results.push({ name, ...result });
    if (result.passed) {
      console.log(`✅ PASSED: ${result.message}`);
    } else {
      console.log(`❌ FAILED: ${result.message}`);
    }
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      message: `Error: ${error.message}`,
      details: error.stack,
    });
    console.log(`❌ ERROR: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting Coordinator Schema Migration Tests\n');
  console.log('=' .repeat(60));

  // Test 1: Verify coordinator exists in components table
  await runTest('Coordinator exists in components table', async () => {
    const coordinator = await prisma.component.findFirst({
      where: {
        tags: { has: 'coordinator' },
      },
    });

    return {
      passed: !!coordinator,
      message: coordinator
        ? `Found coordinator: "${coordinator.name}" (ID: ${coordinator.id})`
        : 'No coordinator found in components table',
      details: coordinator ? { id: coordinator.id, name: coordinator.name, tags: coordinator.tags } : undefined,
    };
  });

  // Test 2: Verify coordinator has correct tags
  await runTest('Coordinator has required tags', async () => {
    const coordinator = await prisma.component.findFirst({
      where: {
        tags: { has: 'coordinator' },
      },
    });

    if (!coordinator) {
      return { passed: false, message: 'No coordinator found' };
    }

    const hasCoordinatorTag = coordinator.tags.includes('coordinator');
    const hasOrchestratorTag = coordinator.tags.includes('orchestrator');

    return {
      passed: hasCoordinatorTag && hasOrchestratorTag,
      message: `Tags: ${coordinator.tags.join(', ')}`,
      details: {
        hasCoordinatorTag,
        hasOrchestratorTag,
        allTags: coordinator.tags,
      },
    };
  });

  // Test 3: Verify coordinator fields are accessible from config
  await runTest('Coordinator config contains expected fields', async () => {
    const coordinator = await prisma.component.findFirst({
      where: {
        tags: { has: 'coordinator' },
      },
    });

    if (!coordinator) {
      return { passed: false, message: 'No coordinator found' };
    }

    const config = coordinator.config as any;
    const hasExpectedFields =
      config &&
      (config.componentIds !== undefined ||
       config.decisionStrategy !== undefined ||
       config.domain !== undefined);

    return {
      passed: hasExpectedFields,
      message: hasExpectedFields
        ? 'Config contains coordinator-specific fields'
        : 'Config missing coordinator fields',
      details: {
        componentIds: config?.componentIds,
        decisionStrategy: config?.decisionStrategy,
        domain: config?.domain,
      },
    };
  });

  // Test 4: Verify workflows can reference coordinator
  await runTest('Workflows can query coordinator from components', async () => {
    const workflow = await prisma.workflow.findFirst({
      include: {
        coordinator: {
          select: {
            id: true,
            name: true,
            tags: true,
            config: true,
          },
        },
      },
    });

    if (!workflow) {
      return { passed: false, message: 'No workflow found for testing' };
    }

    const coordinatorValid =
      workflow.coordinator &&
      workflow.coordinator.tags.includes('coordinator');

    return {
      passed: coordinatorValid,
      message: coordinatorValid
        ? `Workflow "${workflow.name}" successfully references coordinator "${workflow.coordinator.name}"`
        : 'Workflow coordinator reference invalid',
      details: {
        workflowId: workflow.id,
        coordinatorId: workflow.coordinatorId,
        coordinatorName: workflow.coordinator?.name,
        coordinatorTags: workflow.coordinator?.tags,
      },
    };
  });

  // Test 5: Verify workflow runs can reference coordinator
  await runTest('Workflow runs can query coordinator', async () => {
    const workflowRun = await prisma.workflowRun.findFirst({
      include: {
        coordinator: {
          select: {
            id: true,
            name: true,
            tags: true,
          },
        },
      },
    });

    if (!workflowRun) {
      return { passed: false, message: 'No workflow run found for testing' };
    }

    const coordinatorValid =
      workflowRun.coordinator &&
      workflowRun.coordinator.tags.includes('coordinator');

    return {
      passed: coordinatorValid,
      message: coordinatorValid
        ? `Workflow run references coordinator "${workflowRun.coordinator.name}"`
        : 'Workflow run coordinator reference invalid',
      details: {
        workflowRunId: workflowRun.id,
        coordinatorId: workflowRun.coordinatorId,
        coordinatorName: workflowRun.coordinator?.name,
      },
    };
  });

  // Test 6: Verify component runs with executionOrder=0
  await runTest('Coordinator component runs exist (executionOrder=0)', async () => {
    const coordinatorRuns = await prisma.componentRun.findMany({
      where: {
        executionOrder: 0,
      },
      take: 5,
      include: {
        component: {
          select: {
            name: true,
            tags: true,
          },
        },
      },
    });

    const allValid = coordinatorRuns.every((cr) =>
      cr.component.tags.includes('coordinator')
    );

    return {
      passed: coordinatorRuns.length > 0 && allValid,
      message: coordinatorRuns.length > 0
        ? `Found ${coordinatorRuns.length} coordinator runs (executionOrder=0)`
        : 'No coordinator component runs found',
      details: {
        count: coordinatorRuns.length,
        sampleRuns: coordinatorRuns.slice(0, 3).map((cr) => ({
          id: cr.id,
          componentName: cr.component.name,
          executionOrder: cr.executionOrder,
          status: cr.status,
        })),
      },
    };
  });

  // Test 7: Verify no orphaned coordinator_agents references
  await runTest('No references to old coordinator_agents table', async () => {
    try {
      // Try to query the old table - should fail
      await prisma.$queryRaw`SELECT COUNT(*) FROM coordinator_agents`;
      return {
        passed: false,
        message: 'coordinator_agents table still exists!',
      };
    } catch (error: any) {
      // Expected to fail - table should not exist
      const tableDoesNotExist = error.message.includes('does not exist') || error.message.includes('no such table');
      return {
        passed: tableDoesNotExist,
        message: tableDoesNotExist
          ? 'coordinator_agents table successfully removed'
          : `Unexpected error: ${error.message}`,
      };
    }
  });

  // Test 8: Verify workflow state queries work
  await runTest('Workflow state queries work correctly', async () => {
    const workflowRun = await prisma.workflowRun.findFirst({
      include: {
        coordinator: {
          select: {
            id: true,
            name: true,
            config: true,
          },
        },
        componentRuns: {
          take: 5,
          select: {
            id: true,
            executionOrder: true,
            status: true,
          },
        },
      },
    });

    if (!workflowRun) {
      return { passed: false, message: 'No workflow run found' };
    }

    const config = workflowRun.coordinator?.config as any;
    const componentIds = config?.componentIds || [];

    return {
      passed: true,
      message: 'Workflow state queries executing successfully',
      details: {
        workflowRunId: workflowRun.id,
        coordinatorName: workflowRun.coordinator?.name,
        componentIdsInConfig: componentIds.length,
        componentRunsCount: workflowRun.componentRuns.length,
      },
    };
  });

  // Test 9: Test coordinator creation (simulated)
  await runTest('Can create new coordinator as component', async () => {
    try {
      const testCoordinator = await prisma.component.create({
        data: {
          projectId: '345a29ee-d6ab-477d-8079-c5dda0844d77',
          name: 'Test Coordinator (Migration Verification)',
          description: 'Temporary test coordinator',
          inputInstructions: 'Test input',
          operationInstructions: 'Test operation',
          outputInstructions: 'Test output',
          config: {
            domain: 'testing',
            decisionStrategy: 'sequential',
            componentIds: [],
          },
          tools: ['test_tool'],
          tags: ['coordinator', 'orchestrator', 'testing', 'temp'],
          active: false, // Inactive so it won't interfere
        },
      });

      // Clean up immediately
      await prisma.component.delete({
        where: { id: testCoordinator.id },
      });

      return {
        passed: true,
        message: 'Successfully created and deleted test coordinator',
        details: {
          testCoordinatorId: testCoordinator.id,
        },
      };
    } catch (error: any) {
      return {
        passed: false,
        message: `Failed to create test coordinator: ${error.message}`,
      };
    }
  });

  // Test 10: Verify foreign key constraints
  await runTest('Foreign key constraints are valid', async () => {
    try {
      // Test workflow → component (coordinator) FK
      const workflowCount = await prisma.workflow.count({
        where: {
          coordinator: {
            tags: { has: 'coordinator' },
          },
        },
      });

      // Test workflow_run → component (coordinator) FK
      const workflowRunCount = await prisma.workflowRun.count({
        where: {
          coordinator: {
            tags: { has: 'coordinator' },
          },
        },
      });

      return {
        passed: workflowCount > 0 && workflowRunCount > 0,
        message: 'Foreign key constraints working correctly',
        details: {
          workflowsWithCoordinator: workflowCount,
          workflowRunsWithCoordinator: workflowRunCount,
        },
      };
    } catch (error: any) {
      return {
        passed: false,
        message: `Foreign key constraint error: ${error.message}`,
      };
    }
  });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');

  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed).length;
  const totalTests = results.length;

  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.message}`);
      });
  }

  console.log('\n' + '='.repeat(60));

  if (failedTests === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Schema migration is safe.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED! Review the issues above.\n');
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('❌ Test suite failed with error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
