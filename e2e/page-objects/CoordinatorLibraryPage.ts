import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Coordinator Library Management
 * Handles coordinator CRUD operations and versioning
 */
export class CoordinatorLibraryPage {
  readonly page: Page;
  readonly projectId: string;

  // Navigation
  readonly url: string;

  // Main elements
  readonly pageTitle: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly coordinatorList: Locator;

  // Coordinator card elements
  readonly coordinatorCards: Locator;

  // Create/Edit Modal elements
  readonly modal: Locator;
  readonly modalTitle: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly domainSelect: Locator;
  readonly coordinatorInstructionsTextarea: Locator;
  readonly decisionStrategySelect: Locator;
  readonly componentSelectionArea: Locator;
  readonly activeCheckbox: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // Validation elements
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page, projectId: string) {
    this.page = page;
    this.projectId = projectId;
    this.url = `/coordinators`; // Global route, not project-scoped

    // Main elements
    this.pageTitle = page.locator('h1:has-text("Coordinator Library")');
    this.createButton = page.locator('button:has-text("Create Coordinator")');
    this.searchInput = page.locator('input[placeholder*="Search coordinators"]');
    this.coordinatorList = page.locator('[data-testid="coordinator-list"]');
    this.coordinatorCards = page.locator('[data-testid^="coordinator-card-"]');

    // Modal elements
    this.modal = page.locator('[role="dialog"]');
    this.modalTitle = this.modal.locator('h2');
    this.nameInput = this.modal.locator('input[name="name"]');
    this.descriptionInput = this.modal.locator('textarea[name="description"]');
    this.domainSelect = this.modal.locator('select[name="domain"]');
    this.coordinatorInstructionsTextarea = this.modal.locator('textarea[name="coordinatorInstructions"]');
    this.decisionStrategySelect = this.modal.locator('select[name="decisionStrategy"]');
    this.componentSelectionArea = this.modal.locator('[data-testid="component-selection"]');
    this.activeCheckbox = this.modal.locator('input[name="active"]');
    this.saveButton = this.modal.locator('button:has-text("Save"), button:has-text("Create")');
    this.cancelButton = this.modal.locator('button:has-text("Cancel")');

    // Validation
    this.errorMessage = page.locator('[role="alert"].error, .error-message');
    this.successMessage = page.locator('[role="alert"].success, .success-message');
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForCoordinatorList() {
    await this.coordinatorList.waitFor({ state: 'visible', timeout: 10000 });
  }

  async openCreateModal() {
    await this.createButton.click();
    await this.modal.waitFor({ state: 'visible' });
    await expect(this.modalTitle).toContainText('Create Coordinator');
  }

  async fillCoordinatorForm(data: {
    name: string;
    description?: string;
    domain: string;
    coordinatorInstructions: string;
    decisionStrategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
    components?: string[];
    active?: boolean;
  }) {
    await this.nameInput.fill(data.name);

    if (data.description) {
      await this.descriptionInput.fill(data.description);
    }

    await this.domainSelect.selectOption(data.domain);
    await this.coordinatorInstructionsTextarea.fill(data.coordinatorInstructions);
    await this.decisionStrategySelect.selectOption(data.decisionStrategy);

    if (data.components && data.components.length > 0) {
      for (const componentName of data.components) {
        const checkbox = this.componentSelectionArea.locator(`input[type="checkbox"][value="${componentName}"]`);
        await checkbox.check();
      }
    }

    if (data.active !== undefined) {
      const isChecked = await this.activeCheckbox.isChecked();
      if (isChecked !== data.active) {
        await this.activeCheckbox.click();
      }
    }
  }

  async saveCoordinator() {
    await this.saveButton.click();
    await this.modal.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async createCoordinator(data: {
    name: string;
    description?: string;
    domain: string;
    coordinatorInstructions: string;
    decisionStrategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
    components?: string[];
    active?: boolean;
  }) {
    await this.openCreateModal();
    await this.fillCoordinatorForm(data);
    await this.saveCoordinator();
  }

  async searchCoordinator(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async getCoordinatorCard(coordinatorName: string): Promise<Locator> {
    return this.page.locator(`[data-testid^="coordinator-card-"]:has-text("${coordinatorName}")`);
  }

  async openEditModal(coordinatorName: string) {
    const card = await this.getCoordinatorCard(coordinatorName);
    await card.locator('button[aria-label="Edit"], button:has-text("Edit")').click();
    await this.modal.waitFor({ state: 'visible' });
    await expect(this.modalTitle).toContainText('Edit Coordinator');
  }

  async editCoordinator(coordinatorName: string, updates: Partial<{
    name: string;
    description: string;
    domain: string;
    coordinatorInstructions: string;
    decisionStrategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
    active: boolean;
  }>) {
    await this.openEditModal(coordinatorName);

    if (updates.name !== undefined) {
      await this.nameInput.fill(updates.name);
    }
    if (updates.description !== undefined) {
      await this.descriptionInput.fill(updates.description);
    }
    if (updates.domain !== undefined) {
      await this.domainSelect.selectOption(updates.domain);
    }
    if (updates.coordinatorInstructions !== undefined) {
      await this.coordinatorInstructionsTextarea.fill(updates.coordinatorInstructions);
    }
    if (updates.decisionStrategy !== undefined) {
      await this.decisionStrategySelect.selectOption(updates.decisionStrategy);
    }
    if (updates.active !== undefined) {
      const isChecked = await this.activeCheckbox.isChecked();
      if (isChecked !== updates.active) {
        await this.activeCheckbox.click();
      }
    }

    await this.saveCoordinator();
  }

  async deleteCoordinator(coordinatorName: string) {
    const card = await this.getCoordinatorCard(coordinatorName);
    await card.locator('button[aria-label="Delete"], button:has-text("Delete")').click();

    // Confirm deletion dialog
    const confirmDialog = this.page.locator('[role="alertdialog"]');
    await confirmDialog.waitFor({ state: 'visible' });
    await confirmDialog.locator('button:has-text("Delete"), button:has-text("Confirm")').click();
    await confirmDialog.waitFor({ state: 'hidden' });
  }

  async getCoordinatorVersion(coordinatorName: string): Promise<string> {
    const card = await this.getCoordinatorCard(coordinatorName);
    const versionBadge = card.locator('[data-testid="coordinator-version"]');
    return await versionBadge.textContent() || '';
  }

  async verifyCoordinatorExists(coordinatorName: string, shouldExist: boolean = true) {
    const card = await this.getCoordinatorCard(coordinatorName);
    if (shouldExist) {
      await expect(card).toBeVisible();
    } else {
      await expect(card).not.toBeVisible();
    }
  }

  async verifyVersionIncrement(coordinatorName: string, expectedVersion: string) {
    const version = await this.getCoordinatorVersion(coordinatorName);
    expect(version).toContain(expectedVersion);
  }

  async getCoordinatorCount(): Promise<number> {
    return await this.coordinatorCards.count();
  }

  async viewVersionHistory(coordinatorName: string) {
    const card = await this.getCoordinatorCard(coordinatorName);
    await card.locator('button[aria-label="Version History"], button:has-text("Versions")').click();
    await this.page.waitForSelector('[data-testid="version-history-modal"]');
  }

  async verifyVersionHistoryContains(versions: string[]) {
    const versionList = this.page.locator('[data-testid="version-list-item"]');
    const count = await versionList.count();

    for (const expectedVersion of versions) {
      let found = false;
      for (let i = 0; i < count; i++) {
        const text = await versionList.nth(i).textContent();
        if (text?.includes(expectedVersion)) {
          found = true;
          break;
        }
      }
      expect(found).toBeTruthy();
    }
  }

  async closeModal() {
    await this.cancelButton.click();
    await this.modal.waitFor({ state: 'hidden' });
  }

  async verifyErrorMessage(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  async verifySuccessMessage(message: string) {
    await expect(this.successMessage).toBeVisible();
    await expect(this.successMessage).toContainText(message);
  }

  async verifyTemplateValidation(coordinatorName: string, expectedComponents: string[]) {
    const card = await this.getCoordinatorCard(coordinatorName);
    await card.click();

    // Wait for coordinator detail view
    await this.page.waitForSelector('[data-testid="coordinator-detail"]');

    // Check template references
    const templatePreview = this.page.locator('[data-testid="template-preview"]');
    const templateText = await templatePreview.textContent();

    for (const component of expectedComponents) {
      expect(templateText).toContain(`{{${component}}}`);
    }
  }
}
