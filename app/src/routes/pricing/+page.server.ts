import { getActiveTier } from '$lib/server/tiers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = locals;
	const currentTier = user ? await getActiveTier(locals.supabaseAdmin, user.id) : null;
	return { currentTier };
};
