import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Supabase Auth email confirmation / magic-link landing page.
 * Exchanges the `code` param for a session cookie, then redirects.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/contacts';

	if (code) {
		await locals.supabase.auth.exchangeCodeForSession(code);
	}

	redirect(303, next);
};
