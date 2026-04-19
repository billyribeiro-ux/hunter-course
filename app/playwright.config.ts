import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }
	],
	webServer: process.env.CI
		? {
				command: 'pnpm build && pnpm preview --port 5173',
				port: 5173,
				reuseExistingServer: false,
				stdout: 'pipe',
				stderr: 'pipe'
			}
		: {
				command: 'pnpm dev --port 5173',
				port: 5173,
				reuseExistingServer: true
			}
});
