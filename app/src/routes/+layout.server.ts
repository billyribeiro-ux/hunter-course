import type { LayoutServerLoad } from './$types';

/**
 * A single source of truth for auth data across every route.
 * We expose only what the client needs — never the service-role client.
 */
export const load: LayoutServerLoad = async ({ locals: { session, user } }) => {
	return { session, user };
};
