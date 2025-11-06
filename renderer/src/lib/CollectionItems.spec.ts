import { expect, test } from '@playwright/test';

// This assumes you have a SvelteKit route or test harness that renders CollectionItems.svelte
// and accepts a mock collection via a store or prop.

test.describe('CollectionItems.svelte E2E', () => {
	test.beforeEach(async ({ page }) => {
		// Go to the test page that renders CollectionItems.svelte
		await page.goto('/collection-items-test');

		page.on('console', async (msg) => {
			const msgArgs = msg.args();
			const logValues = await Promise.all(msgArgs.map(async arg => await arg.jsonValue()));
			console.log(...logValues);
		});

		// Wait for the page to be fully loaded
		await page.waitForLoadState('networkidle');
	});

	test('renders folders, files, environments, and sections', async ({ page }) => {
		// Check for environment items
		await expect(page.locator('.environment-item')).toHaveCount(2);
		await expect(page.locator('.environment-item').first()).toContainText('Environments');

		// Check for folder/file specifically
		await expect(page.getByText('File')).toBeVisible();

		// Check for section
		await expect(page.locator('.verb-badge')).toContainText('GET');
	});

	test('clicking chevron toggles visibility of child items', async ({ page }) => {

		// Wait for sections to be visible first (ensures full render)
		const section = page.locator('.verb-badge').filter({ hasText: 'GET' });
		await expect(section).toBeVisible();

		// Find the File item row that contains the chevron - be more specific
		const fileRow = page.locator('.item').filter({ has: page.locator('.item-title', { hasText: 'File' }) });
		const fileChevron = fileRow.locator('.chevron');

		// Ensure chevron is visible, stable and actionable
		await expect(fileChevron).toBeVisible();

		// Click file's chevron to collapse - child sections should disappear
		await fileChevron.click();
		await expect(section).not.toBeVisible();

		// Click chevron again to expand - child sections should reappear
		await fileChevron.click();
		await expect(section).toBeVisible();
	});
});
