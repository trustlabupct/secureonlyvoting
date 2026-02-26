import { test, expect } from '@playwright/test';

// Base URLs
const frontendURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const backendURL = process.env.BACKEND_URL || 'http://localhost:3001';

// Test credentials
const adminCredentials = { email: 'hr@example.com', password: 'admin123' };
const userCredentials = { email: 'elections@example.com', password: 'admin123' };

test.describe('Frontend Voting End-to-End Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as admin user for setup
    await page.goto(`${frontendURL}/login`);
    await page.getByLabel('Email').fill(adminCredentials.email);
    await page.getByLabel('Password').fill(adminCredentials.password);
    await page.getByRole('button', { name: 'Sign in with Email' }).click();
    await expect(page).toHaveURL(`${frontendURL}/dashboard`);
  });

  test.describe('Yes/No Voting Mechanism', () => {
    test('should create and vote on yes/no poll', async ({ page }) => {
      // Navigate to create poll page
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      // Fill in poll details
      await page.getByLabel('Poll Title').fill('E2E Yes/No Frontend Test');
      await page.getByLabel('Description').fill('Testing yes/no voting from frontend');
      
      // Set voting mechanism to yes/no
      await page.getByLabel('Voting Mechanism').selectOption('yes-no');
      
      // Set dates (start now, end in 1 hour)
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      
      // Set visibility to public
      await page.getByLabel('Visibility').selectOption('public');
      
      // Create poll
      await page.getByRole('button', { name: 'Create Poll' }).click();
      
      // Should be redirected to dashboard
      await expect(page).toHaveURL(`${frontendURL}/dashboard`);
      
      // Find the created poll
      await expect(page.locator('text=E2E Yes/No Frontend Test')).toBeVisible();
      
      // Click on the poll to vote
      await page.locator('text=E2E Yes/No Frontend Test').click();
      
      // Should see voting options
      await expect(page.locator('text=Yes')).toBeVisible();
      await expect(page.locator('text=No')).toBeVisible();
      
      // Vote "Yes"
      await page.getByRole('button', { name: 'Yes' }).click();
      
      // Should see confirmation
      await expect(page.locator('text=Vote submitted successfully')).toBeVisible();
      
      // Should now see results
      await expect(page.locator('text=Results')).toBeVisible();
    });
  });

  test.describe('Multiple Choice Voting', () => {
    test('should create and vote on multiple choice poll', async ({ page }) => {
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('E2E Multiple Choice Frontend Test');
      await page.getByLabel('Description').fill('Testing multiple choice voting');
      await page.getByLabel('Voting Mechanism').selectOption('multiple-choice');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      
      // Add custom options
      await page.getByLabel('Option 1').fill('Frontend Option A');
      await page.getByLabel('Option 2').fill('Frontend Option B');
      await page.getByRole('button', { name: 'Add Option' }).click();
      await page.getByLabel('Option 3').fill('Frontend Option C');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      await expect(page).toHaveURL(`${frontendURL}/dashboard`);
      
      // Vote on the poll
      await page.locator('text=E2E Multiple Choice Frontend Test').click();
      
      // Select one option
      await page.getByRole('radio', { name: 'Frontend Option B' }).check();
      await page.getByRole('button', { name: 'Submit Vote' }).click();
      
      await expect(page.locator('text=Vote submitted successfully')).toBeVisible();
    });
  });

  test.describe('Multiple Selection Voting', () => {
    test('should create and vote on multiple selection poll', async ({ page }) => {
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('E2E Multiple Selection Frontend Test');
      await page.getByLabel('Description').fill('Testing multiple selection voting');
      await page.getByLabel('Voting Mechanism').selectOption('multiple-selection');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      
      // Add options
      await page.getByLabel('Option 1').fill('Feature Alpha');
      await page.getByLabel('Option 2').fill('Feature Beta');
      await page.getByRole('button', { name: 'Add Option' }).click();
      await page.getByLabel('Option 3').fill('Feature Gamma');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      await expect(page).toHaveURL(`${frontendURL}/dashboard`);
      
      // Vote on the poll - select multiple options
      await page.locator('text=E2E Multiple Selection Frontend Test').click();
      
      await page.getByRole('checkbox', { name: 'Feature Alpha' }).check();
      await page.getByRole('checkbox', { name: 'Feature Gamma' }).check();
      await page.getByRole('button', { name: 'Submit Vote' }).click();
      
      await expect(page.locator('text=Vote submitted successfully')).toBeVisible();
    });
  });

  test.describe('Rating Scale Voting', () => {
    test('should create and vote on rating scale poll', async ({ page }) => {
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('E2E Rating Scale Frontend Test');
      await page.getByLabel('Description').fill('Testing rating scale voting');
      await page.getByLabel('Voting Mechanism').selectOption('rating');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      
      // Configure rating scale
      await page.getByLabel('Min Rating').fill('1');
      await page.getByLabel('Max Rating').fill('5');
      
      // Add items to rate
      await page.getByLabel('Option 1').fill('User Interface');
      await page.getByLabel('Option 2').fill('Performance');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      await expect(page).toHaveURL(`${frontendURL}/dashboard`);
      
      // Vote on the poll
      await page.locator('text=E2E Rating Scale Frontend Test').click();
      
      // Rate each item
      await page.locator('[data-testid="rating-user-interface"] button[value="4"]').click();
      await page.locator('[data-testid="rating-performance"] button[value="5"]').click();
      
      await page.getByRole('button', { name: 'Submit Vote' }).click();
      await expect(page.locator('text=Vote submitted successfully')).toBeVisible();
    });
  });

  test.describe('Ranking Voting', () => {
    test('should create and vote on ranking poll', async ({ page }) => {
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('E2E Ranking Frontend Test');
      await page.getByLabel('Description').fill('Testing ranking voting');
      await page.getByLabel('Voting Mechanism').selectOption('ranking');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      
      // Add options to rank
      await page.getByLabel('Option 1').fill('Priority Alpha');
      await page.getByLabel('Option 2').fill('Priority Beta');
      await page.getByRole('button', { name: 'Add Option' }).click();
      await page.getByLabel('Option 3').fill('Priority Gamma');
      await page.getByRole('button', { name: 'Add Option' }).click();
      await page.getByLabel('Option 4').fill('Priority Delta');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      await expect(page).toHaveURL(`${frontendURL}/dashboard`);
      
      // Vote on the poll - drag and drop ranking
      await page.locator('text=E2E Ranking Frontend Test').click();
      
      // Use drag and drop to reorder items
      // This assumes we have a drag-and-drop ranking interface
      const sourceItem = page.locator('[data-testid="ranking-item-priority-gamma"]');
      const targetItem = page.locator('[data-testid="ranking-item-priority-alpha"]');
      
      await sourceItem.dragTo(targetItem);
      
      await page.getByRole('button', { name: 'Submit Vote' }).click();
      await expect(page.locator('text=Vote submitted successfully')).toBeVisible();
    });
  });

  test.describe('Text Response Voting', () => {
    test('should create and vote on text response poll', async ({ page }) => {
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('E2E Text Response Frontend Test');
      await page.getByLabel('Description').fill('Testing text response voting');
      await page.getByLabel('Voting Mechanism').selectOption('text-response');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      
      // Add questions
      await page.getByLabel('Question 1').fill('What features would you like to see?');
      await page.getByLabel('Question 2').fill('Any other feedback?');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      await expect(page).toHaveURL(`${frontendURL}/dashboard`);
      
      // Vote on the poll
      await page.locator('text=E2E Text Response Frontend Test').click();
      
      // Fill in text responses
      await page.getByLabel('What features would you like to see?').fill('Better mobile support and dark mode');
      await page.getByLabel('Any other feedback?').fill('Great system overall!');
      
      await page.getByRole('button', { name: 'Submit Vote' }).click();
      await expect(page.locator('text=Vote submitted successfully')).toBeVisible();
    });
  });

  test.describe('Permission Testing', () => {
    test('should respect visibility permissions', async ({ page, context }) => {
      // Create admin-only poll
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('Admin Only Frontend Test');
      await page.getByLabel('Description').fill('Testing admin-only visibility');
      await page.getByLabel('Voting Mechanism').selectOption('yes-no');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('admin-only');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      
      // Logout and login as regular user
      await page.getByRole('button', { name: 'Logout' }).click();
      
      await page.goto(`${frontendURL}/login`);
      await page.getByLabel('Email').fill(userCredentials.email);
      await page.getByLabel('Password').fill(userCredentials.password);
      await page.getByRole('button', { name: 'Sign in with Email' }).click();
      
      // Should not see admin-only poll
      await expect(page.locator('text=Admin Only Frontend Test')).not.toBeVisible();
    });

    test('should show results based on results visibility', async ({ page }) => {
      // Create poll with voter-only results
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('Voter Only Results Test');
      await page.getByLabel('Description').fill('Testing voter-only results');
      await page.getByLabel('Voting Mechanism').selectOption('yes-no');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      await page.getByLabel('Results Visibility').selectOption('voter-only');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      
      // View poll without voting - should not see results
      await page.locator('text=Voter Only Results Test').click();
      await expect(page.locator('text=Results will be shown after you vote')).toBeVisible();
      
      // Vote and then should see results
      await page.getByRole('button', { name: 'Yes' }).click();
      await expect(page.locator('text=Results')).toBeVisible();
    });
  });

  test.describe('Real-time Features', () => {
    test('should show real-time vote updates', async ({ page, context }) => {
      // Create a poll
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('Real-time Test Poll');
      await page.getByLabel('Description').fill('Testing real-time updates');
      await page.getByLabel('Voting Mechanism').selectOption('multiple-choice');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      
      await page.getByLabel('Option 1').fill('Real-time A');
      await page.getByLabel('Option 2').fill('Real-time B');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      
      // Open poll in first tab
      await page.locator('text=Real-time Test Poll').click();
      
      // Open second tab with different user
      const secondPage = await context.newPage();
      await secondPage.goto(`${frontendURL}/login`);
      await secondPage.getByLabel('Email').fill(userCredentials.email);
      await secondPage.getByLabel('Password').fill(userCredentials.password);
      await secondPage.getByRole('button', { name: 'Sign in with Email' }).click();
      
      // Navigate to the same poll
      await secondPage.goto(`${frontendURL}/dashboard`);
      await secondPage.locator('text=Real-time Test Poll').click();
      
      // Vote from second tab
      await secondPage.getByRole('radio', { name: 'Real-time A' }).check();
      await secondPage.getByRole('button', { name: 'Submit Vote' }).click();
      
      // First tab should show updated results (if real-time is implemented)
      await page.waitForTimeout(2000); // Wait for potential real-time update
      // This would test WebSocket or polling updates
    });
  });

  test.describe('Error Handling', () => {
    test('should handle voting on closed polls', async ({ page }) => {
      // Create a poll that ends quickly
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('Quick Expiry Test');
      await page.getByLabel('Description').fill('Testing expired poll handling');
      await page.getByLabel('Voting Mechanism').selectOption('yes-no');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 3000); // Expires in 3 seconds
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      
      // Wait for poll to expire
      await page.waitForTimeout(4000);
      
      // Try to vote - should show error
      await page.locator('text=Quick Expiry Test').click();
      await expect(page.locator('text=This poll has ended')).toBeVisible();
    });

    test('should handle duplicate voting attempts', async ({ page }) => {
      // Create poll and vote
      await page.goto(`${frontendURL}/admin/polls/create`);
      
      await page.getByLabel('Poll Title').fill('Duplicate Vote Test');
      await page.getByLabel('Description').fill('Testing duplicate vote prevention');
      await page.getByLabel('Voting Mechanism').selectOption('yes-no');
      
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      await page.getByLabel('Start Time').fill(now.toISOString().slice(0, 16));
      await page.getByLabel('End Time').fill(endTime.toISOString().slice(0, 16));
      await page.getByLabel('Visibility').selectOption('public');
      
      await page.getByRole('button', { name: 'Create Poll' }).click();
      
      // Vote once
      await page.locator('text=Duplicate Vote Test').click();
      await page.getByRole('button', { name: 'Yes' }).click();
      
      // Try to vote again - should show already voted message
      await page.reload();
      await expect(page.locator('text=You have already voted')).toBeVisible();
    });
  });
});