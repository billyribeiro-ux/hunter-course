import { error, redirect } from '@sveltejs/kit';
import { PRICING, type Interval, type Tier } from '$lib/config/pricing';
import { getOrCreateStripeCustomer } from '$lib/server/services/customers';
import { hasUsedTrial, getActiveTier } from '$lib/server/tiers';
import { stripe } from '$lib/server/stripe';
import type { RequestHandler } from './$types';

/**
 * Creates a Stripe Checkout session and redirects the user to it.
 *
 * Why a dedicated API route (not a remote command)?
 *  - We need a GET redirect (form POSTs leave users on the page).
 *  - We want to share this with the pricing page CTA and the billing-portal
 *    "change plan" flow.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user, supabaseAdmin } = locals;
	if (!user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);

	const tier = url.searchParams.get('tier') as Tier | null;
	const interval = (url.searchParams.get('interval') ?? 'month') as Interval;

	if (!tier || !(tier in PRICING) || tier === 'free') error(400, 'Invalid tier');
	if (interval !== 'month' && interval !== 'year') error(400, 'Invalid interval');

	// Prevent a user from checking out into the tier they already have.
	const currentTier = await getActiveTier(supabaseAdmin, user.id);
	if (currentTier === tier) redirect(303, '/account');

	const lookupKey = PRICING[tier].lookupKeys![interval];
	const { data: prices, error: pricesErr } = await supabaseAdmin
		.from('billing_prices')
		.select('id')
		.eq('lookup_key', lookupKey)
		.eq('active', true)
		.limit(1);
	if (pricesErr || !prices?.[0]) error(500, 'Price not found — run `pnpm stripe:seed`.');

	const customerId = await getOrCreateStripeCustomer(supabaseAdmin, user);

	const trialDays = PRICING[tier].freeTrialDays;
	const userHasUsedTrial = await hasUsedTrial(supabaseAdmin, user.id);

	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		customer: customerId,
		line_items: [{ price: prices[0].id, quantity: 1 }],
		success_url: `${url.origin}/account?checkout=success`,
		cancel_url: `${url.origin}/pricing?checkout=cancel`,
		allow_promotion_codes: true,
		subscription_data: trialDays && !userHasUsedTrial ? { trial_period_days: trialDays } : undefined,
		client_reference_id: user.id
	});

	redirect(303, session.url!);
};
