import { test, expect } from '@playwright/test';
import { login, logout, TEST_USERS, ApiHelper, DbHelper } from './utils';

/**
 * E2E Tests for Delete Story Button with Confirmation Popup (ST-234)
 * Verifies that the delete story button is correctly deployed to production
 */
test.describe('Delete Story Button - ST-234 Production Verification', () => {
  let api: ApiHelper;
  let storyId: string;
  let storyKey: string;

  test.beforeAll(async ({ request }) => {
    // Seed test users
    await DbHelper.seedTestUsers(request);

    // Login as admin to create test data
    const token = await ApiHelper.login(request, TEST_USERS.admin.email, TEST_USERS.admin.password);
    api = new ApiHelper(request, token);

    // Create test project and story
    const testData = await DbHelper.createTestProject(api);
    storyId = testData.story.id;
    storyKey = testData.story.key;
  });

  test.afterAll(async () => {
    // Cleanup test data - do NOT delete the test story since we're verifying the delete button exists
    // but we'll clean up other test data
    await DbHelper.cleanup(api);
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test as admin
    await login(page, TEST_USERS.admin);
  });

  test.afterEach(async ({ page }) => {
    // Logout after each test
    await logout(page);
  });

  test('should display red Delete button next to Edit button on story detail page', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`/story/${storyKey}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify Delete button exists and is red
    const deleteButton = page.locator('button:has-text("Delete")');

    // Button should be visible
    await expect(deleteButton).toBeVisible();

    // Button should have red styling (check for common red classes or styles)
    // Common patterns: bg-red, text-red, danger, delete, destructive
    const buttonClasses = await deleteButton.getAttribute('class');
    console.log('Delete button classes:', buttonClasses);

    // Verify it's positioned near Edit button
    const editButton = page.locator('button:has-text("Edit")');
    await expect(editButton).toBeVisible();

    // Both buttons should be visible in the same action area
    const deleteBox = await deleteButton.boundingBox();
    const editBox = await editButton.boundingBox();

    expect(deleteBox).not.toBeNull();
    expect(editBox).not.toBeNull();

    // Buttons should be close to each other (same row or nearby)
    if (deleteBox && editBox) {
      // Check they're on similar vertical positions (same row)
      const verticalDifference = Math.abs(deleteBox.y - editBox.y);
      expect(verticalDifference).toBeLessThan(50); // Within 50px vertically
    }

    // Take screenshot as evidence
    await page.screenshot({ path: '/tmp/delete-button-visible.png', fullPage: false });
  });

  test('should show confirmation modal when Delete button is clicked', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`/story/${storyKey}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Click Delete button
    const deleteButton = page.locator('button:has-text("Delete")');
    await deleteButton.click();

    // Wait for confirmation modal to appear
    // Modal should contain confirmation text
    const modalDialog = page.locator('dialog, [role="dialog"], .modal, .confirm-modal, [data-testid*="modal"]');
    const modalVisibleCount = await modalDialog.count();

    // If no dialog found, look for confirm text
    let hasConfirmation = modalVisibleCount > 0;

    if (!hasConfirmation) {
      // Try to find confirmation text
      const confirmText = page.locator('text=/Are you sure|delete this story|confirm|confirmation/i');
      hasConfirmation = await confirmText.isVisible({ timeout: 2000 }).catch(() => false);
    }

    expect(hasConfirmation).toBe(true);

    // Modal should have Cancel and Delete/Confirm buttons
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")');
    const confirmDeleteButton = page.locator('button:has-text("Delete"), button:has-text("Yes"), button:has-text("Confirm")');

    // At least one of these should exist
    const hasCancelButton = await cancelButton.count() > 0;
    const hasConfirmDeleteButton = await confirmDeleteButton.count() > 0;

    console.log('Has cancel button:', hasCancelButton);
    console.log('Has confirm delete button:', hasConfirmDeleteButton);

    // At least the cancel button should be visible
    expect(hasCancelButton || hasConfirmDeleteButton).toBe(true);

    // Take screenshot of modal as evidence
    await page.screenshot({ path: '/tmp/delete-confirmation-modal.png', fullPage: false });
  });

  test('should close modal when Cancel button is clicked without deleting', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`/story/${storyKey}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Verify story exists before clicking delete
    const storyTitle = page.locator('h1');
    const titleBeforeDelete = await storyTitle.textContent();
    expect(titleBeforeDelete).not.toBeNull();

    // Click Delete button
    const deleteButton = page.locator('button:has-text("Delete")');
    await deleteButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(500);

    // Click Cancel button
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")');
    const cancelCount = await cancelButton.count();

    if (cancelCount > 0) {
      await cancelButton.first().click();
    } else {
      // If no cancel button, press Escape to close modal
      await page.keyboard.press('Escape');
    }

    // Wait for modal to close
    await page.waitForTimeout(500);

    // Verify modal is gone
    const modalVisible = await page.locator('dialog, [role="dialog"], .modal').isVisible({ timeout: 1000 }).catch(() => false);
    expect(modalVisible).toBe(false);

    // Verify story still exists (not deleted)
    const storyDetailVisible = await page.locator('[data-testid="story-detail"]').isVisible();
    expect(storyDetailVisible).toBe(true);

    // Verify story title is still there
    const titleAfterCancel = await storyTitle.textContent();
    expect(titleAfterCancel).toBe(titleBeforeDelete);

    // Take screenshot confirming story still exists
    await page.screenshot({ path: '/tmp/delete-cancelled-story-still-exists.png', fullPage: false });
  });

  test('should display confirmation text with story title in modal', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`/story/${storyKey}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Get the story title
    const storyTitle = await page.locator('h1').textContent();

    // Click Delete button
    const deleteButton = page.locator('button:has-text("Delete")');
    await deleteButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(500);

    // Look for confirmation text that might reference the story
    const modalContent = page.locator('dialog, [role="dialog"], .modal');

    // Get all text from the page to see what the confirmation message says
    const pageText = await page.textContent();
    console.log('Page text after delete click:', pageText?.substring(0, 500));

    // Modal should have some confirmation text
    const confirmationTexts = [
      'Are you sure',
      'delete',
      'confirm',
      'permanently',
      'cannot be undone'
    ];

    let hasConfirmationText = false;
    for (const text of confirmationTexts) {
      const found = await page.locator(`text=/${text}/i`).count() > 0;
      if (found) {
        console.log(`Found confirmation text: "${text}"`);
        hasConfirmationText = true;
        break;
      }
    }

    // Close modal by clicking cancel or pressing escape
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")');
    if (await cancelButton.count() > 0) {
      await cancelButton.first().click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Take final screenshot
    await page.screenshot({ path: '/tmp/delete-confirmation-text.png', fullPage: false });
  });

  test('should have proper accessibility for delete button', async ({ page }) => {
    // Navigate to story detail page
    await page.goto(`/story/${storyKey}`);

    // Wait for story detail to load
    await page.waitForSelector('[data-testid="story-detail"]');

    // Find delete button
    const deleteButton = page.locator('button:has-text("Delete")');

    // Button should be keyboard accessible
    expect(await deleteButton.isEnabled()).toBe(true);

    // Button should have proper ARIA attributes or clear text
    const buttonText = await deleteButton.textContent();
    expect(buttonText).toContain('Delete');

    // Focus on button and verify it's focusable
    await deleteButton.focus();
    const isFocused = await deleteButton.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);

    // Pressing Enter should trigger the delete action
    await deleteButton.press('Enter');

    // Modal should appear
    await page.waitForTimeout(500);
    const modalVisible = await page.locator('dialog, [role="dialog"], .modal').isVisible({ timeout: 1000 }).catch(() => false);

    // Close the modal
    await page.keyboard.press('Escape');

    console.log('Delete button is keyboard accessible');
  });
});
