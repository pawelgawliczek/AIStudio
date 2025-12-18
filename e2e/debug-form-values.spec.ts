import { test } from '@playwright/test';
import { ComponentLibraryPage } from './page-objects/ComponentLibraryPage';
import { login, TEST_USERS } from './utils/auth.helper';

test('Debug form values before submit', async ({ page }) => {
  await login(page, TEST_USERS.admin);

  const projectId = 'c05feb19-2122-48ed-afd8-1885535c0f0b';
  const componentPage = new ComponentLibraryPage(page, projectId);

  await componentPage.goto();
  await componentPage.openCreateModal();

  // Fill form
  await componentPage.fillComponentForm({
    name: 'Debug Test Component',
    inputInstructions: 'Test input',
    operationInstructions: 'Test operation',
    outputInstructions: 'Test output',
  });

  // Wait a bit for React state to update
  await page.waitForTimeout(2000);

  // Debug: Check form values using page.evaluate
  const formData = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return { error: 'Form not found' };

    const data: any = {};
    const formDataObj = new FormData(form);
    for (const [key, value] of formDataObj.entries()) {
      data[key] = value;
    }

    // Also check textarea values directly
    const textareas = form.querySelectorAll('textarea');
    textareas.forEach((ta: any) => {
      data[`textarea_${ta.name || 'unnamed'}`] = ta.value;
    });

    // Check if form is valid
    data.isValid = form.checkValidity();
    data.validationMessage = form.validationMessage || 'none';

    return data;
  });

  console.log('\\n=== FORM DATA BEFORE SUBMIT ===');
  console.log(JSON.stringify(formData, null, 2));

  // Try to submit and capture any validation errors
  const submitResult = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return { error: 'Form not found' };

    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return { error: 'Submit button not found' };

    // Check if button is disabled
    const isDisabled = (submitButton as HTMLButtonElement).disabled;

    return {
      formValid: form.checkValidity(),
      buttonDisabled: isDisabled,
      buttonText: submitButton.textContent,
    };
  });

  console.log('\\n=== SUBMIT BUTTON STATE ===');
  console.log(JSON.stringify(submitResult, null, 2));

  // Capture network requests
  const requests: string[] = [];
  page.on('request', req => {
    if (req.url().includes('/components') && req.method() === 'POST') {
      requests.push(`POST ${req.url()} - ${req.postData()}`);
    }
  });

  // Capture React Query errors
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Click the submit button
  console.log('\\n=== CLICKING SUBMIT BUTTON ===');
  await componentPage.saveButton.click();

  // Wait for any network activity
  await page.waitForTimeout(3000);

  console.log('\\n=== NETWORK REQUESTS ===');
  if (requests.length === 0) {
    console.log('No POST requests captured');
  } else {
    requests.forEach(req => console.log(req));
  }

  console.log('\\n=== CONSOLE ERRORS ===');
  if (errors.length === 0) {
    console.log('No console errors');
  } else {
    errors.forEach(err => console.log(err));
  }
});
