import { query, getRequestEvent } from '$app/server';
import { tierByLookupKey } from '$lib/config/pricing';

/**
 * Pricing data is the same for every visitor — load once per request and
 * let the query cache dedupe repeat calls across components.
 */
export const getPricing = query(async () => {
	const { locals } = getRequestEvent();
	const { data, error } = await locals.supabaseAdmin
		.from('billing_prices')
		.select('id, unit_amount, currency, interval, lookup_key, product_id')
		.eq('active', true);

	if (error) throw error;

	return (data ?? [])
		.filter((p) => p.lookup_key && p.interval)
		.map((p) => {
			const tier = tierByLookupKey(p.lookup_key!)?.tier;
			return tier
				? {
						price_id: p.id,
						tier,
						interval: p.interval as 'month' | 'year',
						unit_amount: p.unit_amount,
						currency: p.currency
					}
				: null;
		})
		.filter((p): p is NonNullable<typeof p> => p !== null);
});
