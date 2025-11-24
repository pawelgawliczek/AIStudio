import { test } from '@playwright/test';
import { login, TEST_USERS } from './utils/auth.helper';
import { ComponentLibraryPage } from './page-objects/ComponentLibraryPage';

test('Debug component creation - console logs', async ({ page }) => {
  // Capture console messages
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  // Login and navigate
  await login(page, TEST_USERS.admin);

  // Create project ID (hardcoded for quick test)
  const projectId = 'c05feb19-2122-48ed-afd8-1885535c0f0b';
  const componentPage = new ComponentLibraryPage(page, projectId);

  await componentPage.goto();
  await page.waitForTimeout(2000);

  // Open modal
  await componentPage.openCreateModal();
  await page.waitForTimeout(1000);

  // Fill form
  await componentPage.fillComponentForm({
    name: 'Debug Test Component',
    inputInstructions: 'Test input',
    operationInstructions: 'Test operation',
    outputInstructions: 'Test output',
  });

  await page.waitForTimeout(1000);

  // Click create button
  console.log('About to click Create button...');
  await componentPage.saveButton.click();

  // Wait a bit to capture any errors
  await page.waitForTimeout(5000);

  // Print all console messages
  console.log('\n=== BROWSER CONSOLE MESSAGES ===');
  consoleMessages.forEach(msg => console.log(msg));

  console.log('\n=== ERRORS ===');
  if (errors.length === 0) {
    console.log('No errors captured');
  } else {
    errors.forEach(err => console.log(err));
  }
});
