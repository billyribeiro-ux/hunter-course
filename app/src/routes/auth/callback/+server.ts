import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Supabase Auth email confirmation / magic-link landing page.
 * Exchanges the `code` param for a session cookie, then redirects.
 *
 * `next` is attacker-controlled (it arrives via email link). Reject any
 * value that isn't an absolute same-origin path — `startsWith('/')` and
 * not `startsWith('//')` blocks scheme-relative open-redirects like
 * `//evil.com`. Same guard as register/login (Module 3.1, 3.2).
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const rawNext = url.searchParams.get('next');
	const next =
		rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/contacts';

	if (code) {
		await locals.supabase.auth.exchangeCodeForSession(code);
	}

	redirect(303, next);
};
