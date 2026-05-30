import type { LayoutServerLoad } from './$types';

/**
 * A single source of truth for auth data across every route.
 *
 * Project the full Supabase `User` down to only the fields the browser
 * actually needs. The raw object carries `phone`, `app_metadata`,
 * `confirmation_sent_at`, `recovery_sent_at`, etc. — none of which the
 * UI uses and all of which are needless attack surface in a JS payload.
 */
export const load: LayoutServerLoad = async ({ locals: { session, user } }) => {
	return {
		session,
		user: user
			? {
					id: user.id,
					email: user.email ?? null,
					fullName: (user.user_metadata?.full_name as string | undefined) ?? null
				}
			: null
	};
};
