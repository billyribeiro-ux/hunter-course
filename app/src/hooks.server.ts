import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { env as pubEnv } from '$env/dynamic/public';
import type { Database } from '$lib/types/database.types';

/**
 * 1. Attach two Supabase clients to `event.locals`:
 *    - `supabase`:      user-scoped, respects RLS, cookie-backed.
 *    - `supabaseAdmin`: service-role, BYPASSES RLS. Handle with care.
 *
 * 2. Also attach `safeGetSession`, which validates the JWT against
 *    Supabase Auth — never trust `getSession()` alone on the server.
 */
const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient<Database>(
		pubEnv.PUBLIC_SUPABASE_URL,
		pubEnv.PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet) => {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, { ...options, path: '/' });
					});
				}
			}
		}
	);

	event.locals.supabaseAdmin = createClient<Database>(
		pubEnv.PUBLIC_SUPABASE_URL,
		env.PRIVATE_SUPABASE_SERVICE_ROLE,
		{ auth: { autoRefreshToken: false, persistSession: false } }
	);

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) return { session: null, user: null };

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
	});
};

/**
 * Populate `event.locals.session` and `event.locals.user` once per request
 * so every `+page.server.ts`/remote function can read them synchronously.
 */
const auth: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;
	return resolve(event);
};

export const handle = sequence(supabase, auth);
