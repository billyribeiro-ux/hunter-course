import { redirect } from '@sveltejs/kit';
import { getActiveTier, tierLimit } from '$lib/server/tiers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, supabase, supabaseAdmin } = locals;
	if (!user) redirect(303, '/login');

	const tier = await getActiveTier(supabaseAdmin, user.id);
	const limit = tierLimit(tier);

	const { count } = await supabase
		.from('contacts')
		.select('id', { count: 'exact', head: true });

	return { tier, limit, count: count ?? 0 };
};
