/**
 * Test Setup for Git Tools Tests
 * Provides common test utilities and mocks
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

export type MockPrisma = DeepMockProxy<PrismaClient>;

// Mock Prisma Client
export const prismaMock = mockDeep<PrismaClient>() as MockPrisma;

// Export a reset function that can be called in beforeEach hooks
export function resetPrismaMock() {
  mockReset(prismaMock);
}

// Test Fixtures
export const fixtures = {
  story: {
    id: 'story-test-001',
    projectId: 'proj-test-001',
    epicId: 'epic-test-001',
    key: 'ST-42',
    title: 'Implement User Authentication',
    description: 'Add user authentication feature',
    type: 'feature' as const,
    status: 'planning' as const,
    businessImpact: 5,
    technicalComplexity: 5,
    assignedWorkflowId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  project: {
    id: 'proj-test-001',
    name: 'Test Project',
    description: 'Test project for git tests',
    localPath: '/app',
    hostPath: '/opt/stack/AIStudio',
    status: 'active' as const,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  worktree: {
    id: 'worktree-test-001',
    storyId: 'story-test-001',
    branchName: 'st-42-implement-user-authentication',
    worktreePath: '/opt/stack/worktrees/st-42-implement-user-authentication',
    baseBranch: 'main',
    status: 'active' as const,
    hostType: 'local' as const,
    hostName: 'test-hostname',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
};
