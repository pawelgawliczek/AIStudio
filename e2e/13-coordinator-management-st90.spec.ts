import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper } from './utils';
import { CoordinatorLibraryPage } from './page-objects/CoordinatorLibraryPage';

/**
 * E2E Tests for Coordinator Management (ST-90)
 * Tests CRUD operations and versioning for workflow coordinators
 *
 * Test Coverage:
 * - Coordinator creation with all required fields
 * - Coordinator listing and search
 * - Coordinator editing with version increment (v1.0 → v1.1)
 * - Coordinator deletion
 * - Coordinator activation/deactivation
 * - Version history tracking
 * - Template validation (component references)
 * - Decision strategy configuration
 * - Data persistence after page refresh
 */

test.describe('Coordinator Management (ST-90)', () => {
  let api: ApiHelper;
  let projectId: string;
  let coordinatorPage: CoordinatorLibraryPage;
  let createdCoordinatorIds: string[] = [];
  let createdComponentIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Login as admin for coordinator management
    const token = await ApiHelper.login(request, TEST_USERS.admin.email, TEST_USERS.admin.password);
    api = new ApiHelper(request, token);

    // Create test project
    const project = await api.createProject('ST-90 Coordinator Test Project', 'Project for testing coordinator management');
    projectId = project.id;

    // Create test components for coordinator template testing
    const testComponents = [
      {
        name: 'Test PM Agent',
        description: 'PM agent for testing',
        inputInstructions: 'Read requirements',
        operationInstructions: 'Analyze requirements',
        outputInstructions: 'Write analysis',
        tags: ['pm'],
      },
      {
        name: 'Test Developer',
        description: 'Developer for testing',
        inputInstructions: 'Read specs',
        operationInstructions: 'Implement features',
        outputInstructions: 'Write code',
        tags: ['developer'],
      },
      {
        name: 'Test QA Engineer',
        description: 'QA for testing',
        inputInstructions: 'Read implementation',
        operationInstructions: 'Write tests',
        outputInstructions: 'Save test results',
        tags: ['qa'],
      },
    ];

    for (const comp of testComponents) {
      const created = await api.post(`/projects/${projectId}/components`, comp);
      createdComponentIds.push(created.data.id);
    }
  });

  test.afterAll(async () => {
    // Cleanup: Delete all created coordinators
    for (const coordinatorId of createdCoordinatorIds) {
      try {
        await api.delete(`/projects/${projectId}/coordinators/${coordinatorId}`);
      } catch (error) {
        console.log(`Failed to cleanup coordinator ${coordinatorId}`);
      }
    }

    // Cleanup components
    for (const componentId of createdComponentIds) {
      try {
        await api.delete(`/projects/${projectId}/components/${componentId}`);
      } catch (error) {
        console.log(`Failed to cleanup component ${componentId}`);
      }
    }

    // Delete test project
    if (projectId) {
      await api.deleteProject(projectId);
    }
  });

  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.admin);
    coordinatorPage = new CoordinatorLibraryPage(page, projectId);
    await coordinatorPage.goto();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  // ==========================================================================
  // Coordinator Creation Tests
  // ==========================================================================

  test('should create a new coordinator with all required fields', async () => {
    const coordinatorData = {
      name: 'E2E Test Feature Coordinator',
      description: 'Test coordinator for E2E testing',
      domain: 'software-development',
      coordinatorInstructions: 'Orchestrate {{Test PM Agent}}, {{Test Developer}}, and {{Test QA Engineer}} to implement features',
      decisionStrategy: 'sequential' as const,
      components: ['Test PM Agent', 'Test Developer', 'Test QA Engineer'],
      active: true,
    };

    await coordinatorPage.createCoordinator(coordinatorData);

    // Verify coordinator appears in list
    await coordinatorPage.verifyCoordinatorExists(coordinatorData.name, true);

    // Verify version is v1.0 for new coordinator
    const version = await coordinatorPage.getCoordinatorVersion(coordinatorData.name);
    expect(version).toContain('v1.0');

    // Track for cleanup
    const coordinators = await api.get(`/projects/${projectId}/coordinators`);
    const created = coordinators.data.find((c: any) => c.name === coordinatorData.name);
    if (created) {
      createdCoordinatorIds.push(created.id);
    }
  });

  test('should show validation error for duplicate coordinator name', async () => {
    const coordinatorData = {
      name: 'E2E Duplicate Coordinator',
      description: 'First coordinator',
      domain: 'software-development',
      coordinatorInstructions: 'Use {{Test Developer}} to implement',
      decisionStrategy: 'sequential' as const,
    };

    // Create first coordinator
    await coordinatorPage.createCoordinator(coordinatorData);
    await coordinatorPage.verifyCoordinatorExists(coordinatorData.name, true);

    // Try to create duplicate
    await coordinatorPage.openCreateModal();
    await coordinatorPage.fillCoordinatorForm(coordinatorData);
    await coordinatorPage.saveCoordinator();

    // Verify error message
    await coordinatorPage.verifyErrorMessage('already exists');

    // Cleanup
    const coordinators = await api.get(`/projects/${projectId}/coordinators`);
    const created = coordinators.data.find((c: any) => c.name === coordinatorData.name);
    if (created) {
      createdCoordinatorIds.push(created.id);
    }
  });

  test('should show validation error for missing required fields', async () => {
    await coordinatorPage.openCreateModal();

    // Try to save without filling any fields
    await coordinatorPage.saveCoordinator();

    // Verify validation errors appear
    await coordinatorPage.verifyErrorMessage('required');
  });

  // ==========================================================================
  // Coordinator Editing Tests
  // ==========================================================================

  test('should edit coordinator and increment version to v1.1', async () => {
    // Create coordinator
    const coordinatorData = {
      name: 'E2E Version Test Coordinator',
      description: 'Coordinator for version testing',
      domain: 'software-development',
      coordinatorInstructions: 'Original instructions with {{Test Developer}}',
      decisionStrategy: 'sequential' as const,
    };

    await coordinatorPage.createCoordinator(coordinatorData);
    await coordinatorPage.verifyCoordinatorExists(coordinatorData.name, true);

    // Verify initial version is v1.0
    await coordinatorPage.verifyVersionIncrement(coordinatorData.name, 'v1.0');

    // Edit coordinator
    await coordinatorPage.editCoordinator(coordinatorData.name, {
      description: 'Updated description',
      coordinatorInstructions: 'Updated instructions with {{Test Developer}} and {{Test QA Engineer}}',
    });

    // Verify version incremented to v1.1
    await coordinatorPage.verifyVersionIncrement(coordinatorData.name, 'v1.1');

    // Track for cleanup
    const coordinators = await api.get(`/projects/${projectId}/coordinators`);
    const created = coordinators.data.find((c: any) => c.name === coordinatorData.name);
    if (created) {
      createdCoordinatorIds.push(created.id);
    }
  });

  test('should maintain multiple versions in version history', async () => {
    // Create coordinator
    const coordinatorData = {
      name: 'E2E Multi-Version Coordinator',
      description: 'Coordinator for multiple version testing',
      domain: 'software-development',
      coordinatorInstructions: 'Version 1.0 with {{Test Developer}}',
      decisionStrategy: 'sequential' as const,
    };

    await coordinatorPage.createCoordinator(coordinatorData);

    // Edit coordinator multiple times
    await coordinatorPage.editCoordinator(coordinatorData.name, {
      description: 'Version 1.1 update',
    });

    await coordinatorPage.editCoordinator(coordinatorData.name, {
      description: 'Version 1.2 update',
    });

    // View version history
    await coordinatorPage.viewVersionHistory(coordinatorData.name);

    // Verify all versions present
    await coordinatorPage.verifyVersionHistoryContains(['v1.0', 'v1.1', 'v1.2']);

    // Track for cleanup
    const coordinators = await api.get(`/projects/${projectId}/coordinators`);
    const created = coordinators.data.find((c: any) => c.name === coordinatorData.name);
    if (created) {
      createdCoordinatorIds.push(created.id);
    }
  });

  // ==========================================================================
  // Template Validation Tests
  // ==========================================================================

  test('should validate coordinator template references', async () => {
    // Create coordinator with valid component references
    const coordinatorData = {
      name: 'E2E Template Validation Coordinator',
      description: 'Test template validation',
      domain: 'software-development',
      coordinatorInstructions: 'Use {{Test PM Agent}} and {{Test Developer}} to implement',
      decisionStrategy: 'sequential' as const,
      components: ['Test PM Agent', 'Test Developer'],
    };

    await coordinatorPage.createCoordinator(coordinatorData);

    // Verify template validation
    await coordinatorPage.verifyTemplateValidation(
      coordinatorData.name,
      ['Test PM Agent', 'Test Developer']
    );

    // Track for cleanup
    const coordinators = await api.get(`/projects/${projectId}/coordinators`);
    const created = coordinators.data.find((c: any) => c.name === coordinatorData.name);
    if (created) {
      createdCoordinatorIds.push(created.id);
    }
  });

  // ==========================================================================
  // Decision Strategy Tests
  // ==========================================================================

  test('should create coordinators with different decision strategies', async () => {
    const strategies: Array<'sequential' | 'adaptive' | 'parallel' | 'conditional'> = [
      'sequential',
      'adaptive',
      'parallel',
      'conditional',
    ];

    for (const strategy of strategies) {
      const coordinatorData = {
        name: `E2E ${strategy} Coordinator`,
        description: `Test ${strategy} strategy`,
        domain: 'software-development',
        coordinatorInstructions: `Use ${strategy} strategy with {{Test Developer}}`,
        decisionStrategy: strategy,
      };

      await coordinatorPage.createCoordinator(coordinatorData);
      await coordinatorPage.verifyCoordinatorExists(coordinatorData.name, true);

      // Track for cleanup
      const coordinators = await api.get(`/projects/${projectId}/coordinators`);
      const created = coordinators.data.find((c: any) => c.name === coordinatorData.name);
      if (created) {
        createdCoordinatorIds.push(created.id);
      }
    }
  });

  // ==========================================================================
  // Coordinator Search and Filter Tests
  // ==========================================================================

  test('should search coordinators by name', async () => {
    // Create multiple coordinators
    const coordinators = [
      {
        name: 'E2E Search Coordinator A',
        description: 'First search test',
        domain: 'software-development',
        coordinatorInstructions: 'Instructions A',
        decisionStrategy: 'sequential' as const,
      },
      {
        name: 'E2E Search Coordinator B',
        description: 'Second search test',
        domain: 'software-development',
        coordinatorInstructions: 'Instructions B',
        decisionStrategy: 'sequential' as const,
      },
    ];

    for (const coord of coordinators) {
      await coordinatorPage.createCoordinator(coord);
    }

    // Search for specific coordinator
    await coordinatorPage.searchCoordinator('Coordinator A');

    // Verify only matching coordinator visible
    await coordinatorPage.verifyCoordinatorExists('E2E Search Coordinator A', true);

    // Track for cleanup
    const allCoordinators = await api.get(`/projects/${projectId}/coordinators`);
    for (const coord of coordinators) {
      const created = allCoordinators.data.find((c: any) => c.name === coord.name);
      if (created) {
        createdCoordinatorIds.push(created.id);
      }
    }
  });

  // ==========================================================================
  // Coordinator Deletion Tests
  // ==========================================================================

  test('should delete a coordinator', async () => {
    // Create coordinator
    const coordinatorData = {
      name: 'E2E Delete Test Coordinator',
      description: 'Coordinator to be deleted',
      domain: 'software-development',
      coordinatorInstructions: 'Instructions',
      decisionStrategy: 'sequential' as const,
    };

    await coordinatorPage.createCoordinator(coordinatorData);
    await coordinatorPage.verifyCoordinatorExists(coordinatorData.name, true);

    // Delete coordinator
    await coordinatorPage.deleteCoordinator(coordinatorData.name);

    // Verify coordinator no longer visible
    await coordinatorPage.verifyCoordinatorExists(coordinatorData.name, false);
  });

  // ==========================================================================
  // Data Persistence Tests
  // ==========================================================================

  test('should persist coordinator data after page refresh', async ({ page }) => {
    // Create coordinator
    const coordinatorData = {
      name: 'E2E Persistence Test Coordinator',
      description: 'Test data persistence',
      domain: 'software-development',
      coordinatorInstructions: 'Persistent instructions',
      decisionStrategy: 'sequential' as const,
    };

    await coordinatorPage.createCoordinator(coordinatorData);
    await coordinatorPage.verifyCoordinatorExists(coordinatorData.name, true);

    // Refresh page
    await page.reload();
    await coordinatorPage.waitForCoordinatorList();

    // Verify coordinator still exists
    await coordinatorPage.verifyCoordinatorExists(coordinatorData.name, true);

    // Track for cleanup
    const coordinators = await api.get(`/projects/${projectId}/coordinators`);
    const created = coordinators.data.find((c: any) => c.name === coordinatorData.name);
    if (created) {
      createdCoordinatorIds.push(created.id);
    }
  });

  // ==========================================================================
  // Coordinator Activation/Deactivation Tests
  // ==========================================================================

  test('should activate and deactivate a coordinator', async () => {
    // Create coordinator
    const coordinatorData = {
      name: 'E2E Activation Test Coordinator',
      description: 'Test activation toggle',
      domain: 'software-development',
      coordinatorInstructions: 'Instructions',
      decisionStrategy: 'sequential' as const,
      active: true,
    };

    await coordinatorPage.createCoordinator(coordinatorData);

    // Deactivate coordinator
    await coordinatorPage.editCoordinator(coordinatorData.name, {
      active: false,
    });

    // Reactivate coordinator
    await coordinatorPage.editCoordinator(coordinatorData.name, {
      active: true,
    });

    // Track for cleanup
    const coordinators = await api.get(`/projects/${projectId}/coordinators`);
    const created = coordinators.data.find((c: any) => c.name === coordinatorData.name);
    if (created) {
      createdCoordinatorIds.push(created.id);
    }
  });
});
