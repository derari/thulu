import { test, expect } from '@playwright/test';

test.describe('Application', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Thulu/i);
  });

  test('should have main content visible', async ({ page }) => {
    await page.goto('/');

    const mainContent = page.locator('main, body');
    await expect(mainContent).toBeVisible();
  });
});

