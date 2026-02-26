import { test, expect } from '@playwright/test';

// Base URL for the frontend application (can be configured in playwright.config.ts)
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test.describe('Authentication Flow', () => {
  test('should allow login with valid credentials and redirect to dashboard', async ({ page }) => {
    // 1. Navigate to the login page
    await page.goto(`${baseURL}/login`);

    // 2. Fill in the email and password
    // Using locators recommended by Playwright (getByLabel, getByRole)
    await page.getByLabel('Email').fill('admin1'); // Using the mock admin username
    await page.getByLabel('Password').fill('admin123'); // Using the mock admin password

    // 3. Click the login button
    await page.getByRole('button', { name: 'Sign in with Email' }).click();

    // 4. Wait for navigation and assert redirection to dashboard
    // Expect the URL to be the dashboard page
    await expect(page).toHaveURL(`${baseURL}/dashboard`);

    // 5. Assert that a welcome message or dashboard element is visible
    // Using a text selector - adjust if the actual welcome message differs
    await expect(page.locator('h2:has-text("Welcome,")')).toBeVisible();

    // Optional: Assert that the user's name (from mock data) is displayed
    await expect(page.locator('h2')).toContainText('Election Committee'); // Name for admin1
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // 1. Navigate to the login page
    await page.goto(`${baseURL}/login`);

    // 2. Fill in invalid credentials
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    // 3. Click the login button
    await page.getByRole('button', { name: 'Sign in with Email' }).click();

    // 4. Assert that the page is still the login page (or redirected back with error)
    // Check for the error query parameter we added in the server action
    await expect(page).toHaveURL(new RegExp(`${baseURL}/login\\?error=invalid_credentials`));

    // Optional: Assert that an error message is displayed on the page
    // This depends on how errors are rendered in your login form/page
    // await expect(page.locator('.error-message-class')).toContainText('Invalid credentials');
  });

  // Add more tests for other scenarios (e.g., empty fields, certificate login if needed)
});