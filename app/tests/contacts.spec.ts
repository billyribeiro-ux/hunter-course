import { test, expect } from '@playwright/test';

test.describe('Contacts CRUD', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill('demo@contactly.app');
		await page.getByLabel('Password').fill('Password123!');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await page.waitForURL(/\/contacts/);
	});

	test('creates, edits, and deletes a contact', async ({ page }) => {
		await page.getByRole('button', { name: /new contact/i }).click();
		await page.getByLabel('Name').fill('Katherine Johnson');
		await page.getByLabel('Email').fill('katherine@nasa.gov');
		await page.getByRole('button', { name: /create contact/i }).click();

		await expect(page.getByText('Katherine Johnson')).toBeVisible();

		// Edit
		await page.getByText('Katherine Johnson').locator('..').locator('..').getByRole('button', { name: 'Edit' }).click();
		await page.getByLabel('Name').fill('Katherine G. Johnson');
		await page.getByRole('button', { name: /save changes/i }).click();
		await expect(page.getByText('Katherine G. Johnson')).toBeVisible();

		// Delete
		await page.getByText('Katherine G. Johnson').locator('..').locator('..').getByRole('button', { name: 'Delete' }).click();
		await page.getByRole('button', { name: /confirm delete/i }).click();
		await expect(page.getByText('Katherine G. Johnson')).not.toBeVisible();
	});
});
