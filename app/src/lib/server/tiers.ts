import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { tierByLookupKey, PRICING, type Tier } from '$lib/config/pricing';

type Admin = SupabaseClient<Database>;

const ACTIVE_STATUSES = new Set(['trialing', 'active']);

/**
 * Returns the tier the user is currently entitled to.
 *
 * Principal Engineer note: we never ask Stripe directly from render paths.
 * Every entitlement decision reads from our `billing_subscriptions` mirror.
 * The mirror is the cache; Stripe webhooks are the write-through.
 *
 * If an active subscription exists but its price has a null `lookup_key` —
 * or a lookup_key that doesn't map to a tier — that's a billing-correctness
 * incident, not a "fall back to free" situation. Loudly: a paying user would
 * silently lose entitlements. We log and throw so the caller can decide
 * (most call sites bubble to a 500 + alert).
 */
export async function getActiveTier(admin: Admin, userId: string): Promise<Tier> {
	const { data } = await admin
		.from('billing_subscriptions')
		.select('status, price_id, billing_prices:billing_prices!inner(lookup_key)')
		.eq('user_id', userId);

	const active = (data ?? []).find((s) => ACTIVE_STATUSES.has(s.status));
	if (!active) return 'free';

	const lookupKey = (
		active.billing_prices as unknown as { lookup_key: string | null }
	)?.lookup_key;

	if (!lookupKey) {
		console.error(
			`[tiers] active subscription for user=${userId} price=${active.price_id} has null lookup_key — entitlements unresolved`
		);
		throw new Error('Unresolved tier: subscription price has no lookup_key');
	}

	const tier = tierByLookupKey(lookupKey)?.tier;
	if (!tier) {
		console.error(
			`[tiers] active subscription for user=${userId} price=${active.price_id} has unmapped lookup_key=${lookupKey}`
		);
		throw new Error(`Unresolved tier: unknown lookup_key ${lookupKey}`);
	}

	return tier;
}

/**
 * Check whether the user has already consumed a free trial so we can
 * block "free trial hoppers" who try to abuse multiple tiers.
 */
export async function hasUsedTrial(admin: Admin, userId: string): Promise<boolean> {
	const { data } = await admin
		.from('billing_subscriptions')
		.select('trial_start')
		.eq('user_id', userId)
		.not('trial_start', 'is', null)
		.limit(1);
	return (data?.length ?? 0) > 0;
}

export function tierLimit(tier: Tier) {
	return PRICING[tier].contactLimit;
}
