import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Component Library Management
 * Handles component CRUD operations and versioning
 */
export class ComponentLibraryPage {
  readonly page: Page;
  readonly projectId: string;

  // Navigation
  readonly url: string;

  // Main elements
  readonly pageTitle: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly componentList: Locator;

  // Component card elements
  readonly componentCards: Locator;

  // Create/Edit Modal elements
  readonly modal: Locator;
  readonly modalTitle: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly inputInstructionsTextarea: Locator;
  readonly operationInstructionsTextarea: Locator;
  readonly outputInstructionsTextarea: Locator;
  readonly tagsInput: Locator;
  readonly activeCheckbox: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // Validation elements
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page, projectId: string) {
    this.page = page;
    this.projectId = projectId;
    this.url = `/components?projectId=${projectId}`;

    // Main elements
    this.pageTitle = page.locator('h1:has-text("Component Library")');
    this.createButton = page.locator('[data-testid="create-component-button"]');
    this.searchInput = page.locator('input[placeholder*="Search components"]');
    this.componentList = page.locator('[data-testid="component-list"]');
    this.componentCards = page.locator('[data-testid^="component-card-"]');

    // Modal elements
    this.modal = page.locator('[role="dialog"]');
    this.modalTitle = this.modal.locator('h2');
    this.nameInput = this.modal.locator('input[name="name"]');
    this.descriptionInput = this.modal.locator('textarea[name="description"]');
    this.inputInstructionsTextarea = this.modal.locator('textarea[name="inputInstructions"]');
    this.operationInstructionsTextarea = this.modal.locator('textarea[name="operationInstructions"]');
    this.outputInstructionsTextarea = this.modal.locator('textarea[name="outputInstructions"]');
    this.tagsInput = this.modal.locator('input[name="tags"]');
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

  async waitForComponentList() {
    await this.componentList.waitFor({ state: 'visible', timeout: 10000 });
  }

  async openCreateModal() {
    await this.createButton.click();
    await this.modal.waitFor({ state: 'visible' });
    await expect(this.modalTitle).toContainText('Create Component');
    // Wait for MarkdownEditor components to fully mount
    await this.page.waitForTimeout(1000);
    // Wait for MDEditor textareas to be present (indicates editors are mounted)
    await this.page.waitForSelector('.w-md-editor-text-input', { state: 'visible', timeout: 5000 });
  }

  async fillComponentForm(data: {
    name: string;
    description?: string;
    inputInstructions: string;
    operationInstructions: string;
    outputInstructions: string;
    tags?: string[];
    active?: boolean;
  }) {
    await this.nameInput.fill(data.name);

    if (data.description) {
      // For MarkdownEditor, find the textarea with the name attribute and w-md-editor-text-input class
      const descriptionEditor = this.modal.locator('textarea.w-md-editor-text-input[name="description"]');
      await descriptionEditor.waitFor({ state: 'visible', timeout: 10000 });
      await descriptionEditor.fill(data.description);
    }

    // Fill MarkdownEditor fields - target the actual MDEditor textarea elements with correct selector
    const inputEditor = this.modal.locator('textarea.w-md-editor-text-input[name="inputInstructions"]');
    await inputEditor.waitFor({ state: 'visible', timeout: 10000 });
    await inputEditor.fill(data.inputInstructions);

    const operationEditor = this.modal.locator('textarea.w-md-editor-text-input[name="operationInstructions"]');
    await operationEditor.waitFor({ state: 'visible', timeout: 10000 });
    await operationEditor.fill(data.operationInstructions);

    const outputEditor = this.modal.locator('textarea.w-md-editor-text-input[name="outputInstructions"]');
    await outputEditor.waitFor({ state: 'visible', timeout: 10000 });
    await outputEditor.fill(data.outputInstructions);

    if (data.tags && data.tags.length > 0) {
      for (const tag of data.tags) {
        await this.tagsInput.fill(tag);
        await this.page.keyboard.press('Enter');
      }
    }

    if (data.active !== undefined) {
      // Active checkbox is optional in the UI (defaults to true)
      const checkboxCount = await this.activeCheckbox.count();
      if (checkboxCount > 0) {
        const isChecked = await this.activeCheckbox.isChecked();
        if (isChecked !== data.active) {
          await this.activeCheckbox.click();
        }
      }
    }
  }

  async saveComponent() {
    await this.saveButton.click();
    // Wait for network to be idle (ensures API call completed)
    await this.page.waitForLoadState('networkidle');
    // Wait for modal to close (critical - ensures React Query refetch completes and UI updates)
    await this.modal.waitFor({ state: 'hidden', timeout: 15000 });
    // Give React time to re-render the component list after modal closes
    await this.page.waitForTimeout(1000);
  }

  async createComponent(data: {
    name: string;
    description?: string;
    inputInstructions: string;
    operationInstructions: string;
    outputInstructions: string;
    tags?: string[];
    active?: boolean;
  }) {
    await this.openCreateModal();
    await this.fillComponentForm(data);
    await this.saveComponent();
  }

  async searchComponent(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async getComponentCard(componentName: string): Promise<Locator> {
    return this.page.locator(`[data-testid^="component-card-"]:has-text("${componentName}")`);
  }

  async openEditModal(componentName: string) {
    const card = await this.getComponentCard(componentName);
    await card.locator('button[aria-label="Edit"], button:has-text("Edit")').click();
    await this.modal.waitFor({ state: 'visible' });
    await expect(this.modalTitle).toContainText('Edit Component');
  }

  async editComponent(componentName: string, updates: Partial<{
    name: string;
    description: string;
    inputInstructions: string;
    operationInstructions: string;
    outputInstructions: string;
    tags: string[];
    active: boolean;
  }>) {
    await this.openEditModal(componentName);

    if (updates.name !== undefined) {
      await this.nameInput.fill(updates.name);
    }
    if (updates.description !== undefined) {
      await this.descriptionInput.fill(updates.description);
    }
    if (updates.inputInstructions !== undefined) {
      await this.inputInstructionsTextarea.fill(updates.inputInstructions);
    }
    if (updates.operationInstructions !== undefined) {
      await this.operationInstructionsTextarea.fill(updates.operationInstructions);
    }
    if (updates.outputInstructions !== undefined) {
      await this.outputInstructionsTextarea.fill(updates.outputInstructions);
    }
    if (updates.active !== undefined) {
      const isChecked = await this.activeCheckbox.isChecked();
      if (isChecked !== updates.active) {
        await this.activeCheckbox.click();
      }
    }

    await this.saveComponent();
  }

  async deleteComponent(componentName: string) {
    const card = await this.getComponentCard(componentName);
    await card.locator('button[aria-label="Delete"], button:has-text("Delete")').click();

    // Confirm deletion dialog
    const confirmDialog = this.page.locator('[role="alertdialog"]');
    await confirmDialog.waitFor({ state: 'visible' });
    await confirmDialog.locator('button:has-text("Delete"), button:has-text("Confirm")').click();
    await confirmDialog.waitFor({ state: 'hidden' });
  }

  async getComponentVersion(componentName: string): Promise<string> {
    const card = await this.getComponentCard(componentName);
    const versionBadge = card.locator('[data-testid="component-version"]');
    return await versionBadge.textContent() || '';
  }

  async verifyComponentExists(componentName: string, shouldExist: boolean = true) {
    const card = await this.getComponentCard(componentName);
    if (shouldExist) {
      await expect(card).toBeVisible({ timeout: 10000 });
    } else {
      await expect(card).not.toBeVisible({ timeout: 10000 });
    }
  }

  async verifyVersionIncrement(componentName: string, expectedVersion: string) {
    const version = await this.getComponentVersion(componentName);
    expect(version).toContain(expectedVersion);
  }

  async getComponentCount(): Promise<number> {
    return await this.componentCards.count();
  }

  async viewVersionHistory(componentName: string) {
    const card = await this.getComponentCard(componentName);
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
}
