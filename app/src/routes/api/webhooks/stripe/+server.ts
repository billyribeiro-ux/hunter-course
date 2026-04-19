import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { stripe } from '$lib/server/stripe';
import type { Stripe } from 'stripe';
import {
	upsertProduct,
	deleteProduct,
	upsertPrice,
	deletePrice
} from '$lib/server/services/products';
import {
	upsertSubscription,
	markSubscriptionCanceled
} from '$lib/server/services/subscriptions';
import type { RequestHandler } from './$types';

/**
 * Stripe → our app. The single place where our billing mirror is written.
 *
 * Events we care about:
 *   - product.*    — keep product catalog in sync
 *   - price.*      — keep price catalog in sync
 *   - customer.subscription.*  — keep entitlements in sync
 *
 * Webhook signatures are verified with our endpoint secret. Un-signed or
 * forged requests are rejected with 400.
 */
const HANDLED = new Set([
	'product.created',
	'product.updated',
	'product.deleted',
	'price.created',
	'price.updated',
	'price.deleted',
	'customer.subscription.created',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	'customer.subscription.paused',
	'customer.subscription.resumed'
]);

export const POST: RequestHandler = async ({ request, locals }) => {
	const signature = request.headers.get('stripe-signature');
	if (!signature) error(400, 'Missing signature');

	const payload = await request.text();
	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(payload, signature, env.PRIVATE_STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		error(400, `Invalid signature: ${(err as Error).message}`);
	}

	if (!HANDLED.has(event.type)) {
		return new Response(null, { status: 204 });
	}

	const admin = locals.supabaseAdmin;

	try {
		switch (event.type) {
			case 'product.created':
			case 'product.updated':
				await upsertProduct(admin, event.data.object);
				break;
			case 'product.deleted':
				await deleteProduct(admin, event.data.object.id);
				break;
			case 'price.created':
			case 'price.updated':
				await upsertPrice(admin, event.data.object);
				break;
			case 'price.deleted':
				await deletePrice(admin, event.data.object.id);
				break;
			case 'customer.subscription.created':
			case 'customer.subscription.updated':
			case 'customer.subscription.paused':
			case 'customer.subscription.resumed':
				await upsertSubscription(admin, event.data.object);
				break;
			case 'customer.subscription.deleted':
				await markSubscriptionCanceled(admin, event.data.object.id);
				break;
		}
	} catch (err) {
		console.error(`[webhook] ${event.type} failed:`, err);
		// 500 triggers a Stripe retry, which is exactly what we want.
		error(500, 'Webhook handler error');
	}

	return new Response(JSON.stringify({ received: true }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};
