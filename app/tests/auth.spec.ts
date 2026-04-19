import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
	test('guest can see pricing', async ({ page }) => {
		await page.goto('/pricing');
		await expect(page.getByRole('heading', { name: /choose what works/i })).toBeVisible();
		await expect(page.getByText('$0')).toBeVisible();
	});

	test('guest gets redirected from /contacts', async ({ page }) => {
		await page.goto('/contacts');
		await expect(page).toHaveURL(/\/login/);
	});

	test('registered user can log in', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill('demo@contactly.app');
		await page.getByLabel('Password').fill('Password123!');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(/\/contacts/);
	});
});
