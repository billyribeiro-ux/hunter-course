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
 * Two safety belts:
 *  1. Signature verification — `stripe.webhooks.constructEvent` rejects
 *     any payload not HMAC'd with our endpoint secret. Unsigned or forged
 *     requests get a 400 before any DB writes.
 *  2. Replay protection — every accepted event id is inserted into
 *     `stripe_events`; if the insert hits the primary-key conflict, we
 *     return 200 without re-running the handler. Stripe delivers
 *     at-least-once, so this is the difference between idempotent-by-luck
 *     (every handler happens to be an upsert) and idempotent-by-design
 *     (no handler ever runs twice for the same event).
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

	// Replay guard. `insert ... select` semantics via the client: we insert,
	// and if the PK already exists we treat it as already-processed and exit.
	// Doing this BEFORE the handler runs means a duplicate event never
	// re-triggers side effects, even non-idempotent ones we might add later.
	const { error: dupErr } = await admin
		.from('stripe_events')
		.insert({ id: event.id, type: event.type });
	if (dupErr) {
		// Postgres unique-violation code = '23505'.
		const isDuplicate =
			(dupErr as { code?: string }).code === '23505' ||
			/duplicate key/i.test(dupErr.message);
		if (isDuplicate) {
			return new Response(JSON.stringify({ received: true, duplicate: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		}
		// Any other DB error: tell Stripe to retry.
		console.error('[webhook] could not record event id:', dupErr);
		error(500, 'Could not record event');
	}

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
		// Roll back the replay-guard row so Stripe's retry actually re-runs
		// the handler instead of hitting the dedupe and silently passing.
		await admin.from('stripe_events').delete().eq('id', event.id);
		error(500, 'Webhook handler error');
	}

	return new Response(JSON.stringify({ received: true }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};
