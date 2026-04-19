import type { SupabaseClient } from '@supabase/supabase-js';
import type { Stripe } from '../stripe';
import type { Database } from '$lib/types/database.types';
import { userIdFromStripeCustomer } from './customers';

type Admin = SupabaseClient<Database>;

/**
 * Mirrors a Stripe Subscription into `billing_subscriptions`. Called from
 * webhook handlers for `customer.subscription.created|updated|deleted`.
 *
 * Stores **exactly** what the UI needs. The source of truth is still
 * Stripe — never edit this table from the app, only from webhooks.
 */
export async function upsertSubscription(admin: Admin, sub: Stripe.Subscription) {
	const stripeCustomerId =
		typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
	const userId = await userIdFromStripeCustomer(admin, stripeCustomerId);
	if (!userId) {
		// Webhook fired before we stored the customer mapping — unusual but
		// possible on race. Log + skip; Stripe will retry.
		throw new Error(`No user mapping for Stripe customer ${stripeCustomerId}`);
	}

	const priceId = sub.items.data[0]?.price.id;
	if (!priceId) throw new Error('Subscription has no price item.');

	const toIso = (ts: number | null | undefined) =>
		ts ? new Date(ts * 1000).toISOString() : null;

	const { error } = await admin.from('billing_subscriptions').upsert({
		id: sub.id,
		user_id: userId,
		status: sub.status,
		price_id: priceId,
		quantity: sub.items.data[0]?.quantity ?? null,
		cancel_at_period_end: sub.cancel_at_period_end,
		current_period_start: toIso(sub.current_period_start)!,
		current_period_end: toIso(sub.current_period_end)!,
		trial_start: toIso(sub.trial_start),
		trial_end: toIso(sub.trial_end),
		cancel_at: toIso(sub.cancel_at),
		canceled_at: toIso(sub.canceled_at),
		metadata: sub.metadata ?? null
	});
	if (error) throw error;
}

export async function markSubscriptionCanceled(admin: Admin, id: string) {
	const { error } = await admin
		.from('billing_subscriptions')
		.update({ status: 'canceled', canceled_at: new Date().toISOString() })
		.eq('id', id);
	if (error) throw error;
}
