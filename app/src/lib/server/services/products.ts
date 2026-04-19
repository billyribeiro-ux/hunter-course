import type { SupabaseClient } from '@supabase/supabase-js';
import type { Stripe } from '../stripe';
import type { Database } from '$lib/types/database.types';

type Admin = SupabaseClient<Database>;

/**
 * Upsert Stripe Product into our local `billing_products` mirror so we can
 * render the pricing page, tier names, etc., without round-tripping to Stripe.
 *
 * Called from webhook handlers (`product.created`, `product.updated`,
 * `product.deleted`) and from the seed script.
 */
export async function upsertProduct(admin: Admin, product: Stripe.Product) {
	const { error } = await admin.from('billing_products').upsert({
		id: product.id,
		active: product.active,
		name: product.name,
		description: product.description ?? null,
		metadata: product.metadata ?? null
	});
	if (error) throw error;
}

export async function deleteProduct(admin: Admin, id: string) {
	const { error } = await admin.from('billing_products').delete().eq('id', id);
	if (error) throw error;
}

export async function upsertPrice(admin: Admin, price: Stripe.Price) {
	const recurring = price.recurring;
	const { error } = await admin.from('billing_prices').upsert({
		id: price.id,
		product_id: typeof price.product === 'string' ? price.product : price.product.id,
		active: price.active,
		currency: price.currency,
		unit_amount: price.unit_amount ?? 0,
		interval: (recurring?.interval as 'month' | 'year' | undefined) ?? null,
		interval_count: recurring?.interval_count ?? null,
		trial_period_days: recurring?.trial_period_days ?? null,
		lookup_key: price.lookup_key ?? null,
		metadata: price.metadata ?? null
	});
	if (error) throw error;
}

export async function deletePrice(admin: Admin, id: string) {
	const { error } = await admin.from('billing_prices').delete().eq('id', id);
	if (error) throw error;
}
