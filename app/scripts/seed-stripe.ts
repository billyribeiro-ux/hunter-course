#!/usr/bin/env tsx
/**
 * Seeds Stripe with the products and prices this course expects.
 * Idempotent: re-running only creates what's missing. Uses lookup keys so
 * the application never needs to hard-code a price ID.
 *
 * Usage:
 *    pnpm stripe:seed    # reads STRIPE_SECRET_KEY from .env.local
 */
import 'dotenv/config';
import Stripe from 'stripe';

const key = process.env.PRIVATE_STRIPE_SECRET_KEY;
if (!key) {
	console.error('PRIVATE_STRIPE_SECRET_KEY missing — copy .env.example to .env.local first.');
	process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });

interface Plan {
	tier: 'plus' | 'pro';
	name: string;
	description: string;
	monthly: number;   // cents
	yearly: number;    // cents
	trialDays: number;
}

const PLANS: Plan[] = [
	{
		tier: 'plus',
		name: 'Plus',
		description: 'For the standard user.',
		monthly: 1000,  // $10
		yearly: 10000,  // $100 (save $20 vs monthly)
		trialDays: 14
	},
	{
		tier: 'pro',
		name: 'Pro',
		description: 'For the power user.',
		monthly: 2000,  // $20
		yearly: 20000,  // $200
		trialDays: 14
	}
];

async function findProduct(tier: string) {
	const search = await stripe.products.search({ query: `metadata["tier"]:"${tier}"` });
	return search.data[0];
}

async function upsertPlan(plan: Plan) {
	let product = await findProduct(plan.tier);
	if (!product) {
		product = await stripe.products.create({
			name: plan.name,
			description: plan.description,
			metadata: { tier: plan.tier }
		});
		console.log(`created product ${plan.name} (${product.id})`);
	} else {
		console.log(`found product ${plan.name} (${product.id})`);
	}

	for (const [interval, amount] of [
		['month', plan.monthly],
		['year', plan.yearly]
	] as const) {
		const lookupKey = `${plan.tier}_${interval === 'month' ? 'monthly' : 'yearly'}`;
		const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });

		if (existing.data[0]) {
			console.log(`  ✓ ${lookupKey} exists (${existing.data[0].id})`);
			continue;
		}

		const price = await stripe.prices.create({
			product: product.id,
			unit_amount: amount,
			currency: 'usd',
			lookup_key: lookupKey,
			recurring: { interval, trial_period_days: plan.trialDays }
		});
		console.log(`  + ${lookupKey} created ($${amount / 100}, ${price.id})`);
	}
}

async function main() {
	for (const plan of PLANS) await upsertPlan(plan);
	console.log('\nDone. Webhook handlers will mirror these into Supabase on next event.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
