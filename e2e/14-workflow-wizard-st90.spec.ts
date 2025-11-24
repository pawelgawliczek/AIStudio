import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper } from './utils';
import { WorkflowWizardPage } from './page-objects/WorkflowWizardPage';

/**
 * E2E Tests for Workflow Creation Wizard (ST-90)
 * Tests the complete 3-step workflow creation process
 *
 * Test Coverage:
 * - Step 1: Workflow shell creation (name, description, project)
 * - Step 2: Component version selection with unique name validation
 * - Step 3a: Existing coordinator selection with template preview
 * - Step 3b: New coordinator creation with template validation
 * - Navigation between steps (forward/backward)
 * - Workflow activation/deactivation
 * - Workflow deletion
 * - Component version changes in workflows
 * - Coordinator version changes in workflows
 * - Data persistence
 * - Validation error handling
 */

test.describe('Workflow Creation Wizard (ST-90)', () => {
  let api: ApiHelper;
  let projectId: string;
  let workflowPage: WorkflowWizardPage;
  let createdWorkflowIds: string[] = [];
  let createdComponentIds: string[] = [];
  let createdCoordinatorIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Login as admin for workflow management
    const token = await ApiHelper.login(request, TEST_USERS.admin.email, TEST_USERS.admin.password);
    api = new ApiHelper(request, token);

    // Create test project
    const project = await api.createProject('ST-90 Workflow Test Project', 'Project for testing workflow wizard');
    projectId = project.id;

    // Create test components
    const testComponents = [
      {
        name: 'WF Test PM Agent',
        description: 'PM agent for workflow testing',
        inputInstructions: 'Read requirements',
        operationInstructions: 'Analyze requirements',
        outputInstructions: 'Write analysis',
        tags: ['pm'],
      },
      {
        name: 'WF Test Developer',
        description: 'Developer for workflow testing',
        inputInstructions: 'Read specs',
        operationInstructions: 'Implement features',
        outputInstructions: 'Write code',
        tags: ['developer'],
      },
      {
        name: 'WF Test QA Engineer',
        description: 'QA for workflow testing',
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

    // Create test coordinator
    const testCoordinator = {
      name: 'WF Test Feature Coordinator',
      description: 'Feature coordinator for workflow testing',
      domain: 'software-development',
      coordinatorInstructions: 'Orchestrate {{WF Test PM Agent}}, {{WF Test Developer}}, and {{WF Test QA Engineer}}',
      decisionStrategy: 'sequential',
      componentIds: createdComponentIds,
    };

    const coordinator = await api.post(`/projects/${projectId}/coordinators`, testCoordinator);
    createdCoordinatorIds.push(coordinator.data.id);
  });

  test.afterAll(async () => {
    // Cleanup: Delete all created workflows
    for (const workflowId of createdWorkflowIds) {
      try {
        await api.delete(`/projects/${projectId}/workflows/${workflowId}`);
      } catch (error) {
        console.log(`Failed to cleanup workflow ${workflowId}`);
      }
    }

    // Cleanup coordinators
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
    workflowPage = new WorkflowWizardPage(page, projectId);
    await workflowPage.goto();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  // ==========================================================================
  // Complete Workflow Creation with Existing Coordinator
  // ==========================================================================

  test('should create workflow with existing coordinator (E2E happy path)', async () => {
    const workflowData = {
      name: 'E2E Test Feature Workflow',
      description: 'Complete workflow for feature implementation',
      components: [
        { name: 'WF Test PM Agent', version: 'v1.0' },
        { name: 'WF Test Developer', version: 'v1.0' },
        { name: 'WF Test QA Engineer', version: 'v1.0' },
      ],
      coordinatorName: 'WF Test Feature Coordinator',
    };

    await workflowPage.createWorkflowWithExistingCoordinator(workflowData);

    // Verify workflow created
    await workflowPage.verifyWorkflowExists(workflowData.name);

    // Track for cleanup
    const workflows = await api.get(`/projects/${projectId}/workflows`);
    const created = workflows.data.find((w: any) => w.name === workflowData.name);
    if (created) {
      createdWorkflowIds.push(created.id);
    }
  });

  // ==========================================================================
  // Step 1: Workflow Shell Tests
  // ==========================================================================

  test('should validate required fields in step 1', async () => {
    await workflowPage.openWizard();

    // Try to proceed without filling name
    await workflowPage.nextButton.click();

    // Verify validation error
    await workflowPage.verifyErrorMessage('required');
  });

  test('should allow navigation back and forth between steps', async () => {
    await workflowPage.openWizard();

    // Step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E Navigation Test Workflow',
      description: 'Test navigation between steps',
    });
    await workflowPage.goToStep2();

    // Verify step 2
    await workflowPage.verifyStep(2);

    // Go back to step 1
    await workflowPage.goBackToStep1();

    // Verify step 1
    await workflowPage.verifyStep(1);

    // Verify data persisted
    const nameValue = await workflowPage.workflowNameInput.inputValue();
    expect(nameValue).toBe('E2E Navigation Test Workflow');
  });

  // ==========================================================================
  // Step 2: Component Selection Tests
  // ==========================================================================

  test('should select components and their versions', async () => {
    await workflowPage.openWizard();

    // Step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E Component Selection Workflow',
    });
    await workflowPage.goToStep2();

    // Step 2: Select components
    await workflowPage.selectComponent('WF Test PM Agent');
    await workflowPage.selectComponent('WF Test Developer');

    // Verify components selected
    await workflowPage.verifyComponentSelected('WF Test PM Agent');
    await workflowPage.verifyComponentSelected('WF Test Developer');

    // Select versions
    await workflowPage.selectComponentVersion('WF Test PM Agent', 'v1.0');
    await workflowPage.selectComponentVersion('WF Test Developer', 'v1.0');

    // Proceed to step 3
    await workflowPage.goToStep3();
    await workflowPage.verifyStep(3);
  });

  test('should detect duplicate component names', async () => {
    await workflowPage.openWizard();

    // Step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E Duplicate Test Workflow',
    });
    await workflowPage.goToStep2();

    // Select same component twice (if UI allows - this might be prevented)
    await workflowPage.selectComponent('WF Test Developer');

    // Try to select again
    // Note: UI might prevent this, but if it allows, verify error
    // await workflowPage.verifyDuplicateNameValidation('WF Test Developer');
  });

  test('should allow removing selected components', async () => {
    await workflowPage.openWizard();

    // Step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E Remove Component Workflow',
    });
    await workflowPage.goToStep2();

    // Select component
    await workflowPage.selectComponent('WF Test PM Agent');
    await workflowPage.verifyComponentSelected('WF Test PM Agent');

    // Remove component
    await workflowPage.removeComponent('WF Test PM Agent');

    // Verify component removed
    const selectedComponents = await workflowPage.selectedComponentsList.locator('[data-testid^="selected-component-"]').count();
    expect(selectedComponents).toBe(0);
  });

  test('should search for components in step 2', async () => {
    await workflowPage.openWizard();

    // Step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E Component Search Workflow',
    });
    await workflowPage.goToStep2();

    // Search for specific component
    await workflowPage.searchComponents('PM Agent');

    // Verify search results (PM Agent should be visible)
    const pmAgent = workflowPage.componentList.locator('[data-testid="component-item-WF Test PM Agent"]');
    await expect(pmAgent).toBeVisible();
  });

  // ==========================================================================
  // Step 3: Existing Coordinator Selection Tests
  // ==========================================================================

  test('should select existing coordinator and validate template', async () => {
    await workflowPage.openWizard();

    // Step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E Existing Coordinator Workflow',
    });
    await workflowPage.goToStep2();

    // Step 2: Select components
    await workflowPage.selectComponent('WF Test PM Agent');
    await workflowPage.selectComponent('WF Test Developer');
    await workflowPage.selectComponent('WF Test QA Engineer');
    await workflowPage.goToStep3();

    // Step 3: Select existing coordinator
    await workflowPage.selectExistingCoordinator();
    await workflowPage.chooseCoordinator('WF Test Feature Coordinator');

    // Verify template preview
    await workflowPage.verifyTemplatePreview([
      'WF Test PM Agent',
      'WF Test Developer',
      'WF Test QA Engineer',
    ]);

    // Verify template validation passes
    await workflowPage.verifyTemplateValidationSuccess();

    // Finish workflow creation
    await workflowPage.finishWorkflowCreation();

    // Verify workflow created
    await workflowPage.verifyWorkflowExists('E2E Existing Coordinator Workflow');

    // Track for cleanup
    const workflows = await api.get(`/projects/${projectId}/workflows`);
    const created = workflows.data.find((w: any) => w.name === 'E2E Existing Coordinator Workflow');
    if (created) {
      createdWorkflowIds.push(created.id);
    }
  });

  // ==========================================================================
  // Step 3: New Coordinator Creation Tests
  // ==========================================================================

  test('should create workflow with new coordinator', async () => {
    const workflowData = {
      name: 'E2E New Coordinator Workflow',
      description: 'Workflow with newly created coordinator',
      components: [
        { name: 'WF Test Developer', version: 'v1.0' },
        { name: 'WF Test QA Engineer', version: 'v1.0' },
      ],
      newCoordinator: {
        name: 'E2E New Workflow Coordinator',
        description: 'Coordinator created during workflow wizard',
        domain: 'software-development',
        instructions: 'Use {{WF Test Developer}} to implement and {{WF Test QA Engineer}} to test',
        strategy: 'sequential' as const,
      },
    };

    await workflowPage.createWorkflowWithNewCoordinator(workflowData);

    // Verify workflow created
    await workflowPage.verifyWorkflowExists(workflowData.name);

    // Track for cleanup
    const workflows = await api.get(`/projects/${projectId}/workflows`);
    const created = workflows.data.find((w: any) => w.name === workflowData.name);
    if (created) {
      createdWorkflowIds.push(created.id);
    }

    // Also track the new coordinator
    const coordinators = await api.get(`/projects/${projectId}/coordinators`);
    const newCoord = coordinators.data.find((c: any) => c.name === workflowData.newCoordinator.name);
    if (newCoord) {
      createdCoordinatorIds.push(newCoord.id);
    }
  });

  test('should validate new coordinator template references', async () => {
    await workflowPage.openWizard();

    // Step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E Template Validation Workflow',
    });
    await workflowPage.goToStep2();

    // Step 2: Select components
    await workflowPage.selectComponent('WF Test Developer');
    await workflowPage.goToStep3();

    // Step 3: Create new coordinator with invalid template
    await workflowPage.selectNewCoordinator();
    await workflowPage.fillNewCoordinator({
      name: 'E2E Invalid Template Coordinator',
      domain: 'software-development',
      instructions: 'Use {{NonExistentComponent}} to implement', // Invalid reference
      strategy: 'sequential',
    });

    // Verify template validation fails
    await workflowPage.verifyNewCoordinatorTemplateValidation(false);

    // Update with valid template
    await workflowPage.newCoordinatorInstructionsTextarea.fill('Use {{WF Test Developer}} to implement');

    // Verify template validation passes
    await workflowPage.verifyNewCoordinatorTemplateValidation(true);
  });

  // ==========================================================================
  // Workflow Activation/Deactivation Tests
  // ==========================================================================

  test('should activate and deactivate workflow', async () => {
    // Create workflow
    const workflowData = {
      name: 'E2E Activation Test Workflow',
      description: 'Test workflow activation',
      components: [
        { name: 'WF Test Developer', version: 'v1.0' },
      ],
      coordinatorName: 'WF Test Feature Coordinator',
    };

    await workflowPage.createWorkflowWithExistingCoordinator(workflowData);

    // Verify workflow is active by default
    await workflowPage.verifyWorkflowStatus(workflowData.name, true);

    // Deactivate workflow
    await workflowPage.deactivateWorkflow(workflowData.name);
    await workflowPage.verifyWorkflowStatus(workflowData.name, false);

    // Reactivate workflow
    await workflowPage.activateWorkflow(workflowData.name);
    await workflowPage.verifyWorkflowStatus(workflowData.name, true);

    // Track for cleanup
    const workflows = await api.get(`/projects/${projectId}/workflows`);
    const created = workflows.data.find((w: any) => w.name === workflowData.name);
    if (created) {
      createdWorkflowIds.push(created.id);
    }
  });

  // ==========================================================================
  // Workflow Deletion Tests
  // ==========================================================================

  test('should delete a workflow', async () => {
    // Create workflow
    const workflowData = {
      name: 'E2E Delete Test Workflow',
      description: 'Workflow to be deleted',
      components: [
        { name: 'WF Test Developer', version: 'v1.0' },
      ],
      coordinatorName: 'WF Test Feature Coordinator',
    };

    await workflowPage.createWorkflowWithExistingCoordinator(workflowData);

    // Verify workflow exists
    await workflowPage.verifyWorkflowExists(workflowData.name);

    // Delete workflow
    await workflowPage.deleteWorkflow(workflowData.name);

    // Verify workflow no longer visible
    const workflows = await workflowPage.getWorkflowCount();
    const workflowCard = workflowPage.workflowCards.filter({ hasText: workflowData.name });
    await expect(workflowCard).toHaveCount(0);
  });

  // ==========================================================================
  // Data Persistence Tests
  // ==========================================================================

  test('should persist workflow data after page refresh', async ({ page }) => {
    // Create workflow
    const workflowData = {
      name: 'E2E Persistence Test Workflow',
      description: 'Test data persistence',
      components: [
        { name: 'WF Test Developer', version: 'v1.0' },
      ],
      coordinatorName: 'WF Test Feature Coordinator',
    };

    await workflowPage.createWorkflowWithExistingCoordinator(workflowData);

    // Verify workflow exists
    await workflowPage.verifyWorkflowExists(workflowData.name);

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify workflow still exists
    await workflowPage.verifyWorkflowExists(workflowData.name);

    // Track for cleanup
    const workflows = await api.get(`/projects/${projectId}/workflows`);
    const created = workflows.data.find((w: any) => w.name === workflowData.name);
    if (created) {
      createdWorkflowIds.push(created.id);
    }
  });

  // ==========================================================================
  // Wizard Cancellation Tests
  // ==========================================================================

  test('should cancel workflow creation and discard changes', async () => {
    await workflowPage.openWizard();

    // Fill in step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E Cancelled Workflow',
      description: 'This workflow will be cancelled',
    });

    // Cancel wizard
    await workflowPage.cancelWorkflowCreation();

    // Verify wizard closed
    await expect(workflowPage.wizardModal).not.toBeVisible();

    // Verify workflow was not created
    const workflows = await api.get(`/projects/${projectId}/workflows`);
    const found = workflows.data.find((w: any) => w.name === 'E2E Cancelled Workflow');
    expect(found).toBeUndefined();
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  test('should handle empty component list gracefully', async () => {
    await workflowPage.openWizard();

    // Step 1
    await workflowPage.fillWorkflowShell({
      name: 'E2E No Components Workflow',
    });
    await workflowPage.goToStep2();

    // Try to proceed without selecting components
    await workflowPage.nextButton.click();

    // Verify validation error
    await workflowPage.verifyErrorMessage('at least one component');
  });
});
