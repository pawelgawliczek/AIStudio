import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'create_test_case',
  description: 'Create a new test case linked to a use case. Test cases define the specific tests (unit/integration/e2e) needed to verify use case functionality.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'UUID of the project'
      },
      useCaseId: {
        type: 'string',
        description: 'UUID of the use case this test covers'
      },
      key: {
        type: 'string',
        description: 'Unique test case key within project (e.g., TC-EXEC-001, TC-AUTH-101)'
      },
      title: {
        type: 'string',
        description: 'Test case title (e.g., "Unit test for execute_story_with_workflow validation")'
      },
      description: {
        type: 'string',
        description: 'Detailed description of what this test case validates'
      },
      testLevel: {
        type: 'string',
        enum: ['unit', 'integration', 'e2e'],
        description: 'Test level: unit (isolated functions), integration (component interactions), e2e (full user flows)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Test priority (default: medium)'
      },
      preconditions: {
        type: 'string',
        description: 'Prerequisites that must be met before running this test'
      },
      testSteps: {
        type: 'string',
        description: 'Step-by-step instructions for executing the test'
      },
      expectedResults: {
        type: 'string',
        description: 'Expected outcomes when test passes'
      },
      testFilePath: {
        type: 'string',
        description: 'Path to test file (e.g., backend/src/mcp/servers/execution/__tests__/execute_story.test.ts)'
      },
      status: {
        type: 'string',
        enum: ['pending', 'in_progress', 'implemented', 'automated', 'deprecated'],
        description: 'Implementation status (default: pending)'
      },
      testData: {
        type: 'object',
        description: 'Optional JSON test data (fixtures, mocks, sample inputs)'
      },
      createdById: {
        type: 'string',
        description: 'UUID of user creating this test case (defaults to system user if not provided)'
      }
    },
    required: ['projectId', 'useCaseId', 'key', 'title', 'testLevel']
  }
};

export const metadata = {
  category: 'test-coverage',
  domain: 'qa',
  tags: ['testing', 'test-case', 'quality', 'tdd'],
  version: '1.0.0',
  since: '2025-11-14'
};

export async function handler(prisma: PrismaClient, params: any) {
  const {
    projectId,
    useCaseId,
    key,
    title,
    description,
    testLevel,
    priority = 'medium',
    preconditions,
    testSteps,
    expectedResults,
    testFilePath,
    status = 'pending',
    testData,
    createdById
  } = params;

  // Validate project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  });

  if (!project) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  // Validate use case exists and belongs to project
  const useCase = await prisma.useCase.findUnique({
    where: { id: useCaseId },
    select: {
      id: true,
      key: true,
      title: true,
      projectId: true
    }
  });

  if (!useCase) {
    throw new Error(`Use case with ID ${useCaseId} not found`);
  }

  if (useCase.projectId !== projectId) {
    throw new Error(
      `Use case ${useCase.key} does not belong to project ${project.name}`
    );
  }

  // Check if test case key already exists in project
  const existingTestCase = await prisma.testCase.findFirst({
    where: {
      projectId,
      key
    }
  });

  if (existingTestCase) {
    throw new Error(
      `Test case with key ${key} already exists in project ${project.name}`
    );
  }

  // Get or create system user for createdBy if not provided
  let creatorId = createdById;
  if (!creatorId) {
    // Find or create a system user
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@aistudio.local' }
    });

    if (!systemUser) {
      // Create system user if doesn't exist
      systemUser = await prisma.user.create({
        data: {
          name: 'System User',
          email: 'system@aistudio.local',
          password: 'N/A', // System user doesn't need password
          role: 'admin'
        }
      });
    }

    creatorId = systemUser.id;
  }

  // Create test case
  const testCase = await prisma.testCase.create({
    data: {
      projectId,
      useCaseId,
      key,
      title,
      description,
      testLevel,
      priority,
      preconditions,
      testSteps,
      expectedResults,
      testFilePath,
      status,
      testData,
      createdById: creatorId
    }
  });

  return {
    success: true,
    message: `Test case ${key} created successfully`,
    testCase: {
      id: testCase.id,
      key: testCase.key,
      title: testCase.title,
      description: testCase.description,
      testLevel: testCase.testLevel,
      priority: testCase.priority,
      status: testCase.status,
      testFilePath: testCase.testFilePath,
      createdAt: testCase.createdAt,
      useCase: {
        id: useCase.id,
        key: useCase.key,
        title: useCase.title
      },
      project: {
        id: project.id,
        name: project.name
      }
    }
  };
}
