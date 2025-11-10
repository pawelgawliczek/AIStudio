import { Page } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

export const TEST_USERS = {
  admin: {
    email: 'admin@aistudio.local',
    password: 'Admin123!',
    name: 'Admin User',
    role: 'admin',
  },
  pm: {
    email: 'pm@aistudio.local',
    password: 'PM123!',
    name: 'PM User',
    role: 'pm',
  },
  dev: {
    email: 'dev@aistudio.local',
    password: 'Dev123!',
    name: 'Developer User',
    role: 'dev',
  },
};

/**
 * Login helper function
 * @param page - Playwright page object
 * @param user - Test user credentials
 */
export async function login(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Logout helper function
 * @param page - Playwright page object
 */
export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login', { timeout: 10000 });
}

/**
 * Get auth token from local storage
 * @param page - Playwright page object
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('auth_token'));
}
