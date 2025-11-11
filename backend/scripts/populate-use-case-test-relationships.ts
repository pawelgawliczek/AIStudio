import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Mapping of Use Cases to Test Cases
 *
 * This script populates the database with the relationship between use cases
 * and the automated test cases we've created.
 */
const useCaseToTestCaseMapping = [
  // UC-PM-001: Create Project
  {
    useCaseKey: 'UC-PM-001',
    testCases: [
      {
        key: 'TC-PM-001-01',
        title: 'Should create project with valid data',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/projects/projects.service.spec.ts',
        description: 'Tests ProjectsService.create() with valid project data',
      },
      {
        key: 'TC-PM-001-02',
        title: 'Should reject duplicate project name',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/projects/projects.service.spec.ts',
        description: 'Tests ProjectsService.create() validation for unique project names',
      },
    ],
  },

  // UC-PM-002: Create Epic
  {
    useCaseKey: 'UC-PM-002',
    testCases: [
      {
        key: 'TC-PM-002-01',
        title: 'Should create epic with auto-generated key',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/epics/epics.service.spec.ts',
        description: 'Tests EpicsService.create() with key auto-generation',
      },
      {
        key: 'TC-PM-002-02',
        title: 'Should validate project exists before creating epic',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/epics/epics.service.spec.ts',
        description: 'Tests EpicsService.create() project validation',
      },
    ],
  },

  // UC-PM-003: Create Story
  {
    useCaseKey: 'UC-PM-003',
    testCases: [
      {
        key: 'TC-PM-003-01',
        title: 'Should create story with auto-generated key',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/stories/stories.service.spec.ts',
        description: 'Tests StoriesService.create() with key auto-generation',
      },
      {
        key: 'TC-PM-003-02',
        title: 'Should validate project and epic before creating story',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/stories/stories.service.spec.ts',
        description: 'Tests StoriesService.create() validation logic',
      },
      {
        key: 'TC-PM-003-03',
        title: 'Should create story without epic',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/stories/stories.service.spec.ts',
        description: 'Tests StoriesService.create() with optional epic',
      },
    ],
  },

  // UC-PM-004: Assign Story to Framework
  {
    useCaseKey: 'UC-PM-004',
    testCases: [
      {
        key: 'TC-PM-004-01',
        title: 'Should assign framework to story',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/stories/stories.service.spec.ts',
        description: 'Tests StoriesService.assignFramework()',
      },
      {
        key: 'TC-PM-004-02',
        title: 'Should validate framework exists before assignment',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/stories/stories.service.spec.ts',
        description: 'Tests StoriesService.assignFramework() validation',
      },
    ],
  },

  // UC-BA-001: Analyze Story Requirements
  // (Covered by subtasks service)
  {
    useCaseKey: 'UC-BA-001',
    testCases: [
      {
        key: 'TC-BA-001-01',
        title: 'Should create subtask for story analysis',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/subtasks/subtasks.service.spec.ts',
        description: 'Tests SubtasksService.create() for BA subtasks',
      },
    ],
  },

  // UC-BA-002: Create Use Case
  {
    useCaseKey: 'UC-BA-002',
    testCases: [
      {
        key: 'TC-BA-002-01',
        title: 'Should create use case with initial version',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/use-cases/use-cases.service.spec.ts',
        description: 'Tests UseCasesService.create() with versioning',
      },
      {
        key: 'TC-BA-002-02',
        title: 'Should validate project exists',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/use-cases/use-cases.service.spec.ts',
        description: 'Tests UseCasesService.create() project validation',
      },
      {
        key: 'TC-BA-002-03',
        title: 'Should reject duplicate use case key',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/use-cases/use-cases.service.spec.ts',
        description: 'Tests UseCasesService.create() uniqueness validation',
      },
    ],
  },

  // UC-BA-004: Search Use Case Library
  {
    useCaseKey: 'UC-BA-004',
    testCases: [
      {
        key: 'TC-BA-004-01',
        title: 'Should search use cases by text query',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/use-cases/use-cases.service.spec.ts',
        description: 'Tests UseCasesService.search() with text query',
      },
      {
        key: 'TC-BA-004-02',
        title: 'Should filter use cases by area',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/use-cases/use-cases.service.spec.ts',
        description: 'Tests UseCasesService.search() with area filter',
      },
      {
        key: 'TC-BA-004-03',
        title: 'Should filter use cases by story',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/use-cases/use-cases.service.spec.ts',
        description: 'Tests UseCasesService.search() with story filter',
      },
      {
        key: 'TC-BA-004-04',
        title: 'Should apply pagination to search results',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/use-cases/use-cases.service.spec.ts',
        description: 'Tests UseCasesService.search() pagination',
      },
    ],
  },

  // UC-BA-006: Maintain Layers and Components
  {
    useCaseKey: 'UC-BA-006',
    testCases: [
      {
        key: 'TC-BA-006-01',
        title: 'Should create layer with validation',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/layers/layers.service.spec.ts',
        description: 'Tests LayersService.create() with validation',
      },
      {
        key: 'TC-BA-006-02',
        title: 'Should create component with layer relationships',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/components/components.service.spec.ts',
        description: 'Tests ComponentsService.create() with layers',
      },
      {
        key: 'TC-BA-006-03',
        title: 'Should validate layer IDs when creating component',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/components/components.service.spec.ts',
        description: 'Tests ComponentsService.create() layer validation',
      },
    ],
  },

  // UC-QA-001: Test Story Implementation
  {
    useCaseKey: 'UC-QA-001',
    testCases: [
      {
        key: 'TC-QA-001-01',
        title: 'Should report test execution',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/test-executions/test-executions.service.spec.ts',
        description: 'Tests TestExecutionsService.reportExecution()',
      },
      {
        key: 'TC-QA-001-02',
        title: 'Should update test case status to automated',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/test-executions/test-executions.service.spec.ts',
        description: 'Tests automatic status update on execution',
      },
    ],
  },

  // UC-QA-003: Manage Test Case Coverage
  {
    useCaseKey: 'UC-QA-003',
    testCases: [
      {
        key: 'TC-QA-003-01',
        title: 'Should create test case for use case',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/test-cases/test-cases.service.spec.ts',
        description: 'Tests TestCasesService.create()',
      },
      {
        key: 'TC-QA-003-02',
        title: 'Should get coverage statistics for use case',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/test-cases/test-cases.service.spec.ts',
        description: 'Tests TestCasesService.getUseCaseCoverage()',
      },
      {
        key: 'TC-QA-003-03',
        title: 'Should identify coverage gaps',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/test-cases/test-cases.service.spec.ts',
        description: 'Tests TestCasesService.getCoverageGaps()',
      },
      {
        key: 'TC-QA-003-04',
        title: 'Should filter test cases by multiple criteria',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/test-cases/test-cases.service.spec.ts',
        description: 'Tests TestCasesService.findAll() with filters',
      },
    ],
  },

  // UC-DEV-003: Link Commit to Story
  {
    useCaseKey: 'UC-DEV-003',
    testCases: [
      {
        key: 'TC-DEV-003-01',
        title: 'Should link new commit to story',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/commits/commits.service.spec.ts',
        description: 'Tests CommitsService.linkCommit() for new commits',
      },
      {
        key: 'TC-DEV-003-02',
        title: 'Should update existing commit with story link',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/commits/commits.service.spec.ts',
        description: 'Tests CommitsService.linkCommit() for existing commits',
      },
      {
        key: 'TC-DEV-003-03',
        title: 'Should track file changes in commit',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/commits/commits.service.spec.ts',
        description: 'Tests CommitsService.linkCommit() with file tracking',
      },
    ],
  },

  // UC-METRICS-002: View Project Tracker
  {
    useCaseKey: 'UC-METRICS-002',
    testCases: [
      {
        key: 'TC-METRICS-002-01',
        title: 'Should get agent runs for project',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/runs/runs.service.spec.ts',
        description: 'Tests RunsService.findByProject()',
      },
      {
        key: 'TC-METRICS-002-02',
        title: 'Should track run metrics',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/runs/runs.service.spec.ts',
        description: 'Tests RunsService.create() with metrics',
      },
    ],
  },

  // Story Workflow State Machine
  {
    useCaseKey: 'UC-INT-001',
    testCases: [
      {
        key: 'TC-INT-001-01',
        title: 'Should validate story status transitions',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/stories/stories.service.spec.ts',
        description: 'Tests StoriesService.updateStatus() workflow validation',
      },
      {
        key: 'TC-INT-001-02',
        title: 'Should allow admin to override workflow',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/stories/stories.service.spec.ts',
        description: 'Tests StoriesService.updateStatus() admin override',
      },
      {
        key: 'TC-INT-001-03',
        title: 'Should require complexity before implementation',
        testLevel: 'unit' as const,
        testFilePath: 'backend/src/stories/stories.service.spec.ts',
        description: 'Tests StoriesService.updateStatus() complexity validation',
      },
    ],
  },
];

interface UseCaseTestRelationship {
  useCaseKey: string;
  testCases: Array<{
    key: string;
    title: string;
    testLevel: 'unit' | 'integration' | 'e2e';
    testFilePath: string;
    description: string;
  }>;
}

async function populateTestCaseRelationships() {
  console.log('🚀 Starting test case relationship population...\n');

  // Get the first project (or you can specify a project ID)
  const project = await prisma.project.findFirst();

  if (!project) {
    console.error('❌ No project found. Please create a project first.');
    return;
  }

  console.log(`📦 Using project: ${project.name} (${project.id})\n`);

  // Get a user to assign as creator
  const user = await prisma.user.findFirst();

  if (!user) {
    console.error('❌ No user found. Please create a user first.');
    return;
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const mapping of useCaseToTestCaseMapping as UseCaseTestRelationship[]) {
    try {
      // Find or create the use case
      let useCase = await prisma.useCase.findUnique({
        where: {
          projectId_key: {
            projectId: project.id,
            key: mapping.useCaseKey,
          },
        },
      });

      if (!useCase) {
        console.log(`⚠️  Use case ${mapping.useCaseKey} not found, creating it...`);

        // Extract title from use case key (you may want to customize this)
        const title = mapping.useCaseKey.replace(/UC-([A-Z]+)-(\d+)/, (_, area, num) => {
          return `${area} Use Case ${num}`;
        });

        useCase = await prisma.useCase.create({
          data: {
            projectId: project.id,
            key: mapping.useCaseKey,
            title,
            area: mapping.useCaseKey.split('-')[1], // Extract area from key
          },
        });

        // Create initial version
        await prisma.useCaseVersion.create({
          data: {
            useCaseId: useCase.id,
            version: 1,
            content: `Auto-generated use case for ${mapping.useCaseKey}`,
            summary: `Use case created by test relationship population script`,
            createdById: user.id,
          },
        });

        console.log(`   ✅ Created use case ${mapping.useCaseKey}`);
      }

      // Create test cases
      for (const testCase of mapping.testCases) {
        // Check if test case already exists
        const existing = await prisma.testCase.findUnique({
          where: {
            projectId_key: {
              projectId: project.id,
              key: testCase.key,
            },
          },
        });

        if (existing) {
          console.log(`   ⏭️  Test case ${testCase.key} already exists, skipping`);
          totalSkipped++;
          continue;
        }

        await prisma.testCase.create({
          data: {
            projectId: project.id,
            useCaseId: useCase.id,
            key: testCase.key,
            title: testCase.title,
            description: testCase.description,
            testLevel: testCase.testLevel,
            priority: 'high',
            status: 'automated',
            testFilePath: testCase.testFilePath,
            testSteps: 'Automated test - see test file for details',
            expectedResults: 'Test should pass',
            createdById: user.id,
          },
        });

        console.log(`   ✅ Created test case ${testCase.key}`);
        totalCreated++;
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${mapping.useCaseKey}:`, error);
      totalErrors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Created: ${totalCreated} test cases`);
  console.log(`   ⏭️  Skipped: ${totalSkipped} test cases (already exist)`);
  console.log(`   ❌ Errors: ${totalErrors}`);
  console.log('\n✨ Done!');
}

// Run the script
populateTestCaseRelationships()
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
