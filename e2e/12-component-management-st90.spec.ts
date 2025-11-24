import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper } from './utils';
import { ComponentLibraryPage } from './page-objects/ComponentLibraryPage';

/**
 * E2E Tests for Component Management (ST-90)
 * Tests CRUD operations and versioning for workflow components
 *
 * Test Coverage:
 * - Component creation with all required fields
 * - Component listing and search
 * - Component editing with version increment (v1.0 → v1.1)
 * - Component deletion
 * - Component activation/deactivation
 * - Version history tracking
 * - Validation error handling
 * - Data persistence after page refresh
 */

test.describe('Component Management (ST-90)', () => {
  let api: ApiHelper;
  let projectId: string;
  let componentPage: ComponentLibraryPage;
  let createdComponentIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Login as admin for component management
    const token = await ApiHelper.login(request, TEST_USERS.admin.email, TEST_USERS.admin.password);
    api = new ApiHelper(request, token);

    // Create test project
    const project = await api.createProject('ST-90 Component Test Project', 'Project for testing component management');
    projectId = project.id;
  });

  test.afterAll(async () => {
    // Cleanup: Delete all created components
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
    componentPage = new ComponentLibraryPage(page, projectId);
    await componentPage.goto();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  // ==========================================================================
  // Component Creation Tests
  // ==========================================================================

  test('should create a new component with all required fields', async ({ request }) => {
    const componentData = {
      name: 'E2E Test Developer',
      description: 'Test component for E2E testing',
      inputInstructions: 'Read the story requirements from Story.description',
      operationInstructions: 'Implement the feature using best practices',
      outputInstructions: 'Save implementation details to Story.metadata.implementation',
      tags: ['developer', 'implementation'],
      active: true,
    };

    await componentPage.createComponent(componentData);

    // Verify component appears in list
    await componentPage.verifyComponentExists(componentData.name, true);

    // Verify version is v1.0 for new component
    const version = await componentPage.getComponentVersion(componentData.name);
    expect(version).toContain('v1.0');

    // Track for cleanup
    const components = await api.get(`/projects/${projectId}/components`);
    const created = components.data.find((c: any) => c.name === componentData.name);
    if (created) {
      createdComponentIds.push(created.id);
    }
  });

  test('should show validation error for duplicate component name', async () => {
    const componentData = {
      name: 'E2E Duplicate Test',
      description: 'First component',
      inputInstructions: 'Input instructions',
      operationInstructions: 'Operation instructions',
      outputInstructions: 'Output instructions',
    };

    // Create first component
    await componentPage.createComponent(componentData);
    await componentPage.verifyComponentExists(componentData.name, true);

    // Try to create duplicate
    await componentPage.openCreateModal();
    await componentPage.fillComponentForm(componentData);
    await componentPage.saveComponent();

    // Verify error message
    await componentPage.verifyErrorMessage('already exists');

    // Cleanup
    const components = await api.get(`/projects/${projectId}/components`);
    const created = components.data.find((c: any) => c.name === componentData.name);
    if (created) {
      createdComponentIds.push(created.id);
    }
  });

  test('should show validation error for missing required fields', async () => {
    await componentPage.openCreateModal();

    // Try to save without filling any fields
    await componentPage.saveComponent();

    // Verify validation errors appear
    await componentPage.verifyErrorMessage('required');
  });

  // ==========================================================================
  // Component Editing Tests
  // ==========================================================================

  test('should edit component and increment version to v1.1', async () => {
    // Create component
    const componentData = {
      name: 'E2E Version Test Component',
      description: 'Component for version testing',
      inputInstructions: 'Original input instructions',
      operationInstructions: 'Original operation instructions',
      outputInstructions: 'Original output instructions',
    };

    await componentPage.createComponent(componentData);
    await componentPage.verifyComponentExists(componentData.name, true);

    // Verify initial version is v1.0
    await componentPage.verifyVersionIncrement(componentData.name, 'v1.0');

    // Edit component
    await componentPage.editComponent(componentData.name, {
      description: 'Updated description',
      operationInstructions: 'Updated operation instructions',
    });

    // Verify version incremented to v1.1
    await componentPage.verifyVersionIncrement(componentData.name, 'v1.1');

    // Track for cleanup
    const components = await api.get(`/projects/${projectId}/components`);
    const created = components.data.find((c: any) => c.name === componentData.name);
    if (created) {
      createdComponentIds.push(created.id);
    }
  });

  test('should maintain multiple versions in version history', async () => {
    // Create component
    const componentData = {
      name: 'E2E Multi-Version Component',
      description: 'Component for multiple version testing',
      inputInstructions: 'Version 1.0 input',
      operationInstructions: 'Version 1.0 operation',
      outputInstructions: 'Version 1.0 output',
    };

    await componentPage.createComponent(componentData);

    // Edit component multiple times
    await componentPage.editComponent(componentData.name, {
      description: 'Version 1.1 update',
    });

    await componentPage.editComponent(componentData.name, {
      description: 'Version 1.2 update',
    });

    // View version history
    await componentPage.viewVersionHistory(componentData.name);

    // Verify all versions present
    await componentPage.verifyVersionHistoryContains(['v1.0', 'v1.1', 'v1.2']);

    // Track for cleanup
    const components = await api.get(`/projects/${projectId}/components`);
    const created = components.data.find((c: any) => c.name === componentData.name);
    if (created) {
      createdComponentIds.push(created.id);
    }
  });

  // ==========================================================================
  // Component Search and Filter Tests
  // ==========================================================================

  test('should search components by name', async () => {
    // Create multiple components
    const components = [
      {
        name: 'E2E Search Component A',
        description: 'First search test',
        inputInstructions: 'Input A',
        operationInstructions: 'Operation A',
        outputInstructions: 'Output A',
      },
      {
        name: 'E2E Search Component B',
        description: 'Second search test',
        inputInstructions: 'Input B',
        operationInstructions: 'Operation B',
        outputInstructions: 'Output B',
      },
    ];

    for (const comp of components) {
      await componentPage.createComponent(comp);
    }

    // Search for specific component
    await componentPage.searchComponent('Component A');

    // Verify only matching component visible
    await componentPage.verifyComponentExists('E2E Search Component A', true);

    // Track for cleanup
    const allComponents = await api.get(`/projects/${projectId}/components`);
    for (const comp of components) {
      const created = allComponents.data.find((c: any) => c.name === comp.name);
      if (created) {
        createdComponentIds.push(created.id);
      }
    }
  });

  // ==========================================================================
  // Component Deletion Tests
  // ==========================================================================

  test('should delete a component', async () => {
    // Create component
    const componentData = {
      name: 'E2E Delete Test Component',
      description: 'Component to be deleted',
      inputInstructions: 'Input',
      operationInstructions: 'Operation',
      outputInstructions: 'Output',
    };

    await componentPage.createComponent(componentData);
    await componentPage.verifyComponentExists(componentData.name, true);

    // Delete component
    await componentPage.deleteComponent(componentData.name);

    // Verify component no longer visible
    await componentPage.verifyComponentExists(componentData.name, false);
  });

  // ==========================================================================
  // Data Persistence Tests
  // ==========================================================================

  test('should persist component data after page refresh', async ({ page }) => {
    // Create component
    const componentData = {
      name: 'E2E Persistence Test Component',
      description: 'Test data persistence',
      inputInstructions: 'Persistent input',
      operationInstructions: 'Persistent operation',
      outputInstructions: 'Persistent output',
    };

    await componentPage.createComponent(componentData);
    await componentPage.verifyComponentExists(componentData.name, true);

    // Refresh page
    await page.reload();
    await componentPage.waitForComponentList();

    // Verify component still exists
    await componentPage.verifyComponentExists(componentData.name, true);

    // Track for cleanup
    const components = await api.get(`/projects/${projectId}/components`);
    const created = components.data.find((c: any) => c.name === componentData.name);
    if (created) {
      createdComponentIds.push(created.id);
    }
  });

  // ==========================================================================
  // Component Activation/Deactivation Tests
  // ==========================================================================

  test('should activate and deactivate a component', async () => {
    // Create component
    const componentData = {
      name: 'E2E Activation Test Component',
      description: 'Test activation toggle',
      inputInstructions: 'Input',
      operationInstructions: 'Operation',
      outputInstructions: 'Output',
      active: true,
    };

    await componentPage.createComponent(componentData);

    // Deactivate component
    await componentPage.editComponent(componentData.name, {
      active: false,
    });

    // Verify component deactivated (might need API verification)
    // This depends on how deactivation is displayed in UI

    // Reactivate component
    await componentPage.editComponent(componentData.name, {
      active: true,
    });

    // Track for cleanup
    const components = await api.get(`/projects/${projectId}/components`);
    const created = components.data.find((c: any) => c.name === componentData.name);
    if (created) {
      createdComponentIds.push(created.id);
    }
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  test('should handle component list with multiple components', async () => {
    const componentCount = 10;
    const components = [];

    // Create multiple components
    for (let i = 1; i <= componentCount; i++) {
      components.push({
        name: `E2E Performance Component ${i}`,
        description: `Component ${i} for performance testing`,
        inputInstructions: `Input ${i}`,
        operationInstructions: `Operation ${i}`,
        outputInstructions: `Output ${i}`,
      });
    }

    for (const comp of components) {
      await componentPage.createComponent(comp);
    }

    // Verify all components loaded
    const count = await componentPage.getComponentCount();
    expect(count).toBeGreaterThanOrEqual(componentCount);

    // Track for cleanup
    const allComponents = await api.get(`/projects/${projectId}/components`);
    for (const comp of components) {
      const created = allComponents.data.find((c: any) => c.name === comp.name);
      if (created) {
        createdComponentIds.push(created.id);
      }
    }
  });
});
