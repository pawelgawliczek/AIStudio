import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Workflow Creation Wizard
 * Handles 3-step workflow creation process:
 * Step 1: Workflow shell (name, description, project)
 * Step 2: Component version selection
 * Step 3: Coordinator selection/creation
 */
export class WorkflowWizardPage {
  readonly page: Page;
  readonly projectId: string;

  // Navigation
  readonly url: string;

  // Wizard Modal
  readonly wizardModal: Locator;
  readonly wizardTitle: Locator;
  readonly stepIndicator: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly finishButton: Locator;
  readonly cancelButton: Locator;

  // Step 1: Workflow Shell
  readonly workflowNameInput: Locator;
  readonly workflowDescriptionInput: Locator;
  readonly projectSelect: Locator;

  // Step 2: Component Selection
  readonly componentSearchInput: Locator;
  readonly componentList: Locator;
  readonly selectedComponentsList: Locator;
  readonly versionDropdowns: Locator;

  // Step 3: Coordinator Selection
  readonly coordinatorSelectionTabs: Locator;
  readonly existingCoordinatorTab: Locator;
  readonly newCoordinatorTab: Locator;
  readonly coordinatorSelect: Locator;
  readonly coordinatorTemplatePreview: Locator;

  // Step 3: New Coordinator Form
  readonly newCoordinatorNameInput: Locator;
  readonly newCoordinatorDescriptionInput: Locator;
  readonly newCoordinatorDomainSelect: Locator;
  readonly newCoordinatorInstructionsTextarea: Locator;
  readonly newCoordinatorStrategySelect: Locator;
  readonly templateValidationIndicator: Locator;

  // Workflow List Page
  readonly workflowListTitle: Locator;
  readonly createWorkflowButton: Locator;
  readonly workflowCards: Locator;

  // Validation elements
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly validationErrors: Locator;

  constructor(page: Page, projectId: string) {
    this.page = page;
    this.projectId = projectId;
    this.url = `/workflows`; // Global route, not project-scoped

    // Wizard Modal
    this.wizardModal = page.locator('[data-testid="workflow-wizard-modal"]');
    this.wizardTitle = this.wizardModal.locator('h2');
    this.stepIndicator = this.wizardModal.locator('[data-testid="step-indicator"]');
    this.nextButton = this.wizardModal.locator('button:has-text("Next")');
    this.backButton = this.wizardModal.locator('button:has-text("Back")');
    this.finishButton = this.wizardModal.locator('button:has-text("Finish"), button:has-text("Create Workflow")');
    this.cancelButton = this.wizardModal.locator('button:has-text("Cancel")');

    // Step 1: Workflow Shell
    this.workflowNameInput = this.wizardModal.locator('input[name="name"]');
    this.workflowDescriptionInput = this.wizardModal.locator('textarea[name="description"]');
    this.projectSelect = this.wizardModal.locator('select[name="projectId"]');

    // Step 2: Component Selection
    this.componentSearchInput = this.wizardModal.locator('input[placeholder*="Search components"]');
    this.componentList = this.wizardModal.locator('[data-testid="available-components-list"]');
    this.selectedComponentsList = this.wizardModal.locator('[data-testid="selected-components-list"]');
    this.versionDropdowns = this.wizardModal.locator('select[name^="componentVersion-"]');

    // Step 3: Coordinator Selection
    this.coordinatorSelectionTabs = this.wizardModal.locator('[role="tablist"]');
    this.existingCoordinatorTab = this.wizardModal.locator('button[role="tab"]:has-text("Existing Coordinator")');
    this.newCoordinatorTab = this.wizardModal.locator('button[role="tab"]:has-text("New Coordinator")');
    this.coordinatorSelect = this.wizardModal.locator('select[name="coordinatorId"]');
    this.coordinatorTemplatePreview = this.wizardModal.locator('[data-testid="template-preview"]');

    // Step 3: New Coordinator Form
    this.newCoordinatorNameInput = this.wizardModal.locator('input[name="coordinatorName"]');
    this.newCoordinatorDescriptionInput = this.wizardModal.locator('textarea[name="coordinatorDescription"]');
    this.newCoordinatorDomainSelect = this.wizardModal.locator('select[name="coordinatorDomain"]');
    this.newCoordinatorInstructionsTextarea = this.wizardModal.locator('textarea[name="coordinatorInstructions"]');
    this.newCoordinatorStrategySelect = this.wizardModal.locator('select[name="coordinatorStrategy"]');
    this.templateValidationIndicator = this.wizardModal.locator('[data-testid="template-validation"]');

    // Workflow List Page
    this.workflowListTitle = page.locator('h1:has-text("Workflows")');
    this.createWorkflowButton = page.locator('button:has-text("Create Workflow")');
    this.workflowCards = page.locator('[data-testid^="workflow-card-"]');

    // Validation
    this.errorMessage = page.locator('[role="alert"].error, .error-message');
    this.successMessage = page.locator('[role="alert"].success, .success-message');
    this.validationErrors = this.wizardModal.locator('[data-testid="validation-error"]');
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');
  }

  async openWizard() {
    await this.createWorkflowButton.click();
    await this.wizardModal.waitFor({ state: 'visible' });
    await expect(this.wizardTitle).toContainText('Create Workflow');
  }

  async verifyStep(stepNumber: number) {
    const stepText = await this.stepIndicator.textContent();
    expect(stepText).toContain(`Step ${stepNumber}`);
  }

  // ========================================================================
  // Step 1: Workflow Shell
  // ========================================================================

  async fillWorkflowShell(data: {
    name: string;
    description?: string;
    projectId?: string;
  }) {
    await this.verifyStep(1);
    await this.workflowNameInput.fill(data.name);

    if (data.description) {
      await this.workflowDescriptionInput.fill(data.description);
    }

    if (data.projectId) {
      await this.projectSelect.selectOption(data.projectId);
    }
  }

  async goToStep2() {
    await this.nextButton.click();
    await this.verifyStep(2);
  }

  // ========================================================================
  // Step 2: Component Selection
  // ========================================================================

  async searchComponents(query: string) {
    await this.componentSearchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  async selectComponent(componentName: string) {
    const component = this.componentList.locator(`[data-testid="component-item-${componentName}"]`);
    await component.locator('input[type="checkbox"]').check();
  }

  async selectComponentVersion(componentName: string, version: string) {
    const versionDropdown = this.selectedComponentsList
      .locator(`[data-testid="selected-component-${componentName}"]`)
      .locator('select[name^="componentVersion-"]');
    await versionDropdown.selectOption({ label: version });
  }

  async verifyComponentSelected(componentName: string) {
    const selectedComponent = this.selectedComponentsList
      .locator(`[data-testid="selected-component-${componentName}"]`);
    await expect(selectedComponent).toBeVisible();
  }

  async verifyDuplicateNameValidation(componentName: string) {
    const errorMsg = this.selectedComponentsList
      .locator(`[data-testid="duplicate-error-${componentName}"]`);
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('duplicate');
  }

  async removeComponent(componentName: string) {
    const removeButton = this.selectedComponentsList
      .locator(`[data-testid="selected-component-${componentName}"]`)
      .locator('button[aria-label="Remove"]');
    await removeButton.click();
  }

  async goToStep3() {
    await this.nextButton.click();
    await this.verifyStep(3);
  }

  async goBackToStep1() {
    await this.backButton.click();
    await this.verifyStep(1);
  }

  // ========================================================================
  // Step 3: Coordinator Selection (Existing)
  // ========================================================================

  async selectExistingCoordinator() {
    await this.existingCoordinatorTab.click();
    await expect(this.coordinatorSelect).toBeVisible();
  }

  async chooseCoordinator(coordinatorName: string) {
    await this.coordinatorSelect.selectOption({ label: coordinatorName });
  }

  async verifyTemplatePreview(expectedComponents: string[]) {
    const templateText = await this.coordinatorTemplatePreview.textContent();

    for (const component of expectedComponents) {
      expect(templateText).toContain(`{{${component}}}`);
    }
  }

  async verifyTemplateValidationSuccess() {
    await expect(this.templateValidationIndicator).toContainText('valid');
  }

  async verifyTemplateValidationError(expectedError: string) {
    await expect(this.templateValidationIndicator).toContainText(expectedError);
  }

  // ========================================================================
  // Step 3: Coordinator Creation (New)
  // ========================================================================

  async selectNewCoordinator() {
    await this.newCoordinatorTab.click();
    await expect(this.newCoordinatorNameInput).toBeVisible();
  }

  async fillNewCoordinator(data: {
    name: string;
    description?: string;
    domain: string;
    instructions: string;
    strategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
  }) {
    await this.newCoordinatorNameInput.fill(data.name);

    if (data.description) {
      await this.newCoordinatorDescriptionInput.fill(data.description);
    }

    await this.newCoordinatorDomainSelect.selectOption(data.domain);
    await this.newCoordinatorInstructionsTextarea.fill(data.instructions);
    await this.newCoordinatorStrategySelect.selectOption(data.strategy);
  }

  async verifyNewCoordinatorTemplateValidation(isValid: boolean) {
    const validationStatus = await this.templateValidationIndicator.textContent();

    if (isValid) {
      expect(validationStatus).toContain('valid');
    } else {
      expect(validationStatus).toContain('invalid');
    }
  }

  // ========================================================================
  // Finish Workflow Creation
  // ========================================================================

  async finishWorkflowCreation() {
    await this.finishButton.click();
    await this.wizardModal.waitFor({ state: 'hidden', timeout: 15000 });
  }

  async cancelWorkflowCreation() {
    await this.cancelButton.click();
    await this.wizardModal.waitFor({ state: 'hidden' });
  }

  // ========================================================================
  // Complete Workflow Creation (E2E Helper)
  // ========================================================================

  async createWorkflowWithExistingCoordinator(data: {
    name: string;
    description?: string;
    components: Array<{ name: string; version: string }>;
    coordinatorName: string;
  }) {
    await this.openWizard();

    // Step 1: Workflow Shell
    await this.fillWorkflowShell({
      name: data.name,
      description: data.description,
    });
    await this.goToStep2();

    // Step 2: Component Selection
    for (const comp of data.components) {
      await this.selectComponent(comp.name);
      await this.selectComponentVersion(comp.name, comp.version);
    }
    await this.goToStep3();

    // Step 3: Select Existing Coordinator
    await this.selectExistingCoordinator();
    await this.chooseCoordinator(data.coordinatorName);

    // Finish
    await this.finishWorkflowCreation();
  }

  async createWorkflowWithNewCoordinator(data: {
    name: string;
    description?: string;
    components: Array<{ name: string; version: string }>;
    newCoordinator: {
      name: string;
      description?: string;
      domain: string;
      instructions: string;
      strategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
    };
  }) {
    await this.openWizard();

    // Step 1: Workflow Shell
    await this.fillWorkflowShell({
      name: data.name,
      description: data.description,
    });
    await this.goToStep2();

    // Step 2: Component Selection
    for (const comp of data.components) {
      await this.selectComponent(comp.name);
      await this.selectComponentVersion(comp.name, comp.version);
    }
    await this.goToStep3();

    // Step 3: Create New Coordinator
    await this.selectNewCoordinator();
    await this.fillNewCoordinator(data.newCoordinator);

    // Finish
    await this.finishWorkflowCreation();
  }

  // ========================================================================
  // Workflow List Verification
  // ========================================================================

  async verifyWorkflowExists(workflowName: string) {
    const workflow = await this.getWorkflowCard(workflowName);
    await expect(workflow).toBeVisible();
  }

  async getWorkflowCard(workflowName: string): Promise<Locator> {
    return this.page.locator(`[data-testid^="workflow-card-"]:has-text("${workflowName}")`);
  }

  async getWorkflowCount(): Promise<number> {
    return await this.workflowCards.count();
  }

  async activateWorkflow(workflowName: string) {
    const card = await this.getWorkflowCard(workflowName);
    const activateButton = card.locator('button:has-text("Activate")');
    await activateButton.click();
  }

  async deactivateWorkflow(workflowName: string) {
    const card = await this.getWorkflowCard(workflowName);
    const deactivateButton = card.locator('button:has-text("Deactivate")');
    await deactivateButton.click();
  }

  async verifyWorkflowStatus(workflowName: string, isActive: boolean) {
    const card = await this.getWorkflowCard(workflowName);
    const statusBadge = card.locator('[data-testid="workflow-status"]');

    if (isActive) {
      await expect(statusBadge).toContainText('Active');
    } else {
      await expect(statusBadge).toContainText('Inactive');
    }
  }

  async deleteWorkflow(workflowName: string) {
    const card = await this.getWorkflowCard(workflowName);
    await card.locator('button[aria-label="Delete"]').click();

    const confirmDialog = this.page.locator('[role="alertdialog"]');
    await confirmDialog.waitFor({ state: 'visible' });
    await confirmDialog.locator('button:has-text("Delete"), button:has-text("Confirm")').click();
    await confirmDialog.waitFor({ state: 'hidden' });
  }

  async verifyErrorMessage(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  async verifySuccessMessage(message: string) {
    await expect(this.successMessage).toBeVisible();
    await expect(this.successMessage).toContainText(message);
  }
}
