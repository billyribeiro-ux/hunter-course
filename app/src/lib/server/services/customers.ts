import type { SupabaseClient, User } from '@supabase/supabase-js';
import { stripe } from '../stripe';
import type { Database } from '$lib/types/database.types';

type Admin = SupabaseClient<Database>;

/**
 * Returns the Stripe customer ID for a user, creating both the Stripe
 * customer and our `billing_customers` row on first call.
 *
 * Idempotent: safe to call on every checkout/portal request.
 */
export async function getOrCreateStripeCustomer(admin: Admin, user: User): Promise<string> {
	const { data: existing } = await admin
		.from('billing_customers')
		.select('stripe_customer_id')
		.eq('user_id', user.id)
		.maybeSingle();

	if (existing) return existing.stripe_customer_id;

	const fullName =
		(user.user_metadata?.full_name as string | undefined) ??
		user.email?.split('@')[0] ??
		undefined;

	const customer = await stripe.customers.create({
		email: user.email,
		name: fullName,
		metadata: { supabase_user_id: user.id }
	});

	const { error } = await admin
		.from('billing_customers')
		.insert({ user_id: user.id, stripe_customer_id: customer.id });
	if (error) throw error;

	return customer.id;
}

export async function userIdFromStripeCustomer(
	admin: Admin,
	stripeCustomerId: string
): Promise<string | null> {
	const { data } = await admin
		.from('billing_customers')
		.select('user_id')
		.eq('stripe_customer_id', stripeCustomerId)
		.maybeSingle();
	return data?.user_id ?? null;
}
