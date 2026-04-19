import { redirect } from '@sveltejs/kit';
import { getActiveTier } from '$lib/server/tiers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, supabase, supabaseAdmin } = locals;
	if (!user) redirect(303, '/login');

	const [{ data: profile }, tier] = await Promise.all([
		supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
		getActiveTier(supabaseAdmin, user.id)
	]);

	return { profile, tier, user };
};
