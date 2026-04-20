# E.4 — Embedded Payment with Stripe Elements

> The moment of truth: real card fields in your own UI, a server-side PaymentIntent, 3DS handling, and the same webhook-driven back end you already built.

## Why this matters

Hosted Checkout does everything in one redirect. Stripe Elements hands you back *the card inputs* (as a Stripe-controlled iframe, keeping you PCI-compliant) while you own everything else — the button, the error placement, the confirmation screen, the cart sidebar beside it.

This lesson wires the final step of the Simpler Trading-style flow: the Payment panel contains a `PaymentElement`, the user clicks "Pay," we confirm server-side, handle 3DS redirects in-place, and surface errors without leaving the page.

## The Principal Engineer lens

**PCI scope is the whole game.** The reason Elements is safe is that the card number never touches your JS or your servers — it's typed into a Stripe-served iframe and tokenised before your code sees it. The moment you copy a card number through your own code, you become PCI DSS Level 1 accountable, which is a $100k+/year compliance cost. Elements (and Checkout) keep you out of PCI scope by design; anything you do must preserve that.

Corollary: **the PaymentIntent is created on the server, not the client.** Amounts, currencies, trial eligibility, coupon validity — server-authoritative. The client only confirms an already-trusted intent.

## Step 1 — Install the Stripe client library

```bash
pnpm --filter app add @stripe/stripe-js@5.3.0
```

Pinned. `@stripe/stripe-js` is the browser loader that fetches `stripe.js` from Stripe's CDN (required — you must not self-host `stripe.js`, that breaks PCI compliance).

## Step 2 — The server-side PaymentIntent endpoint

A new remote command lives at `src/lib/remote/checkout.remote.ts`:

```ts
// src/lib/remote/checkout.remote.ts
import { command, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { stripe } from '$lib/server/stripe';
import { getOrCreateStripeCustomer } from '$lib/server/billing/customers';
import { findTierByLookupKey, listTiers } from '$lib/server/billing/tiers';
import { hasUsedTrial } from '$lib/server/billing/trials';
import { requireUser } from '$lib/server/auth';

const BillingSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1)),
	email: v.pipe(v.string(), v.email()),
	line1: v.pipe(v.string(), v.minLength(1)),
	line2: v.optional(v.string()),
	city: v.pipe(v.string(), v.minLength(1)),
	postalCode: v.pipe(v.string(), v.minLength(1)),
	country: v.pipe(v.string(), v.length(2))
});

const InputSchema = v.object({
	lookupKey: v.pipe(v.string(), v.minLength(1)),
	billing: BillingSchema
});

export const createSubscriptionIntent = command(InputSchema, async (input) => {
	const { locals } = getRequestEvent();
	const user = requireUser(locals);

	const tier = await findTierByLookupKey(input.lookupKey);
	if (!tier) throw error(400, 'Unknown tier');

	const customer = await getOrCreateStripeCustomer(locals.supabaseAdmin, user);

	// Update customer with the freshly collected billing address.
	await stripe.customers.update(customer.stripeCustomerId, {
		name: input.billing.name,
		email: input.billing.email,
		address: {
			line1: input.billing.line1,
			line2: input.billing.line2 || undefined,
			city: input.billing.city,
			postal_code: input.billing.postalCode,
			country: input.billing.country
		}
	});

	const trialEligible = tier.trialDays > 0 && !(await hasUsedTrial(locals.supabaseAdmin, user.id));

	const subscription = await stripe.subscriptions.create(
		{
			customer: customer.stripeCustomerId,
			items: [{ price: tier.stripePriceId }],
			payment_behavior: 'default_incomplete',
			payment_settings: {
				save_default_payment_method: 'on_subscription',
				payment_method_types: ['card']
			},
			trial_period_days: trialEligible ? tier.trialDays : undefined,
			metadata: { user_id: user.id },
			expand: ['latest_invoice.payment_intent', 'pending_setup_intent']
		},
		{ idempotencyKey: `sub-create:${user.id}:${input.lookupKey}` }
	);

	// Two shapes depending on trial vs charge-now:
	// - With trial + card required: Stripe uses a SetupIntent (save card, charge later).
	// - Without trial: a PaymentIntent for the first invoice.
	const setupIntent = subscription.pending_setup_intent;
	const paymentIntent =
		typeof subscription.latest_invoice === 'object' && subscription.latest_invoice
			? subscription.latest_invoice.payment_intent
			: null;

	const clientSecret =
		(typeof setupIntent === 'object' && setupIntent?.client_secret) ||
		(typeof paymentIntent === 'object' && paymentIntent?.client_secret);

	if (!clientSecret) {
		throw error(500, 'Stripe did not return a confirmable intent');
	}

	return {
		clientSecret,
		intentKind: setupIntent ? ('setup' as const) : ('payment' as const),
		subscriptionId: subscription.id
	};
});
```

Two things the Stripe docs can make confusing:

- **With a trial + card required**, Stripe's `subscriptions.create` returns a `pending_setup_intent` — because no money is due yet; we're just saving the card for future charges.
- **Without a trial**, it returns a PaymentIntent on `latest_invoice` — the first invoice is due immediately.

The client handles either shape the same way: pass the `clientSecret` to `stripe.confirmSetup()` or `stripe.confirmPayment()` respectively.

## Step 3 — Mount Stripe.js on the client

`src/lib/stripe-client.ts`:

```ts
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$env/static/public';

let promise: Promise<Stripe | null> | null = null;

export function getStripe() {
	if (!promise) {
		promise = loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY);
	}
	return promise;
}
```

One singleton, loaded lazily. `loadStripe` is idempotent; the library refuses to inject `stripe.js` twice.

## Step 4 — The Payment step component

Replace the placeholder from E.3 with the real thing.

`src/lib/components/checkout/PaymentStep.svelte`:

```svelte
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { getStripe } from '$lib/stripe-client';
	import { cart } from '$lib/stores/cart.svelte.ts';
	import { checkout } from '$lib/stores/checkout.svelte.ts';
	import { toasts } from '$lib/stores/toasts.svelte.ts';
	import { createSubscriptionIntent } from '$lib/remote/checkout.remote.ts';
	import { PUBLIC_APP_URL } from '$env/static/public';
	import type { Stripe, StripeElements } from '@stripe/stripe-js';

	let containerEl: HTMLDivElement;
	let errorEl = $state<string | null>(null);
	let pending = $state(false);
	let intentKind = $state<'setup' | 'payment' | null>(null);

	let stripe: Stripe | null = null;
	let elements: StripeElements | null = null;

	onMount(async () => {
		const subscriptionLine = cart.lines.find((l) => l.kind === 'subscription');
		if (!subscriptionLine) {
			goto('/pricing', { replaceState: true });
			return;
		}

		stripe = await getStripe();
		if (!stripe) {
			errorEl = 'Payment provider failed to load. Please refresh.';
			return;
		}

		const result = await createSubscriptionIntent({
			lookupKey: subscriptionLine.lookupKey,
			billing: checkout.billing
		});

		intentKind = result.intentKind;

		elements = stripe.elements({
			clientSecret: result.clientSecret,
			appearance: {
				theme: 'stripe',
				variables: {
					colorPrimary: '#f59e0b',
					fontFamily: 'system-ui, sans-serif',
					borderRadius: '6px'
				}
			}
		});

		const paymentElement = elements.create('payment', {
			layout: 'tabs'
		});
		paymentElement.mount(containerEl);
	});

	onDestroy(() => {
		elements = null;
	});

	async function pay() {
		if (!stripe || !elements || !intentKind) return;

		pending = true;
		errorEl = null;

		const confirmFn = intentKind === 'setup' ? stripe.confirmSetup : stripe.confirmPayment;

		const { error: stripeError } = await confirmFn.call(stripe, {
			elements,
			confirmParams: {
				return_url: `${PUBLIC_APP_URL}/checkout/complete`
			},
			redirect: 'if_required'
		});

		if (stripeError) {
			errorEl = stripeError.message ?? 'Payment failed.';
			pending = false;
			toasts.error(errorEl);
			return;
		}

		// If we reach here, no redirect was required (card succeeded immediately).
		// The subscription's webhook will finalize server state; bounce to the success page.
		cart.clear();
		checkout.reset();
		goto('/checkout/complete');
	}
</script>

<div class="panel">
	<h2>Payment</h2>

	<div bind:this={containerEl} class="stripe-slot" aria-label="Card details"></div>

	{#if errorEl}
		<p class="error" role="alert">{errorEl}</p>
	{/if}

	<footer class="actions">
		<button type="button" class="back" onclick={() => checkout.goTo('billing')}>
			Back
		</button>
		<button type="button" class="pay" onclick={pay} disabled={pending || !elements}>
			{pending ? 'Processing…' : 'Pay'}
		</button>
	</footer>
</div>

<style>
	.panel {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 2rem;
	}
	.stripe-slot {
		min-height: 200px;
	}
	.error {
		color: #b91c1c;
		background: #fef2f2;
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		margin-top: 1rem;
		font-size: 0.9rem;
	}
	.actions {
		display: flex;
		justify-content: space-between;
		margin-top: 1.5rem;
	}
	.actions button {
		padding: 0.65rem 1.5rem;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
	}
	.back { background: transparent; border: 1px solid #d1d5db; color: #374151; }
	.pay { background: #f59e0b; color: white; border: 0; }
	.pay:disabled { opacity: 0.6; cursor: progress; }
</style>
```

The magic line is `redirect: 'if_required'`. Most cards confirm synchronously. A 3DS-challenge card (test number `4000 0025 0000 3155`) requires a redirect to the bank's auth page; Stripe handles the redirect, and the user lands back at `return_url`.

## Step 5 — The `return_url` landing page

```svelte
<!-- src/routes/checkout/complete/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { cart } from '$lib/stores/cart.svelte.ts';
	import { checkout } from '$lib/stores/checkout.svelte.ts';
	import { toasts } from '$lib/stores/toasts.svelte.ts';

	let status = $state<'processing' | 'succeeded' | 'failed'>('processing');
	let message = $state('Checking your payment…');

	onMount(async () => {
		// Query params Stripe appends: payment_intent, payment_intent_client_secret, redirect_status
		const params = new URL(window.location.href).searchParams;
		const redirectStatus = params.get('redirect_status');

		if (redirectStatus === 'succeeded') {
			status = 'succeeded';
			message = 'Payment successful.';
			cart.clear();
			checkout.reset();
			setTimeout(() => goto('/app'), 1500);
		} else if (redirectStatus === 'processing') {
			status = 'processing';
			message = 'Payment is processing. We\'ll email you when it completes.';
		} else {
			status = 'failed';
			message = 'Payment was not completed. Please try again.';
			toasts.error(message);
		}
	});
</script>

<main class="complete">
	<h1>{message}</h1>
	{#if status === 'succeeded'}
		<p>Redirecting you to the app…</p>
	{:else if status === 'failed'}
		<a href="/checkout#payment" class="retry">Retry payment</a>
	{/if}
</main>
```

Stripe appends `redirect_status=succeeded|processing|failed` to the return URL. We read it, update UI, and redirect or offer retry.

## Step 6 — The webhook is still the source of truth

The 3DS redirect tells the *browser* the payment succeeded. The canonical source-of-truth is the `invoice.paid` / `customer.subscription.updated` webhook from Module 6.3. By the time the user lands on `/checkout/complete`, the webhook has usually already fired and `stripe_subscriptions` is already populated — but don't *depend* on that ordering. The success page should render optimistically; the app's tier-gated features check `getActiveSubscription`, which reads from the DB that the webhook populates.

If the user lands on `/app` and their tier hasn't updated yet, give it 2–3 seconds (the webhook round-trip). A quick poll on the `/api/me` endpoint (or re-invalidating the layout load) is usually enough.

## Step 7 — Handle the "no card needed" trial path

The stepper we built covers the card-required flow. For trials *without* a card (the Pro no-card trial flag from Module 9.2), we skip the Payment step entirely:

```ts
// In checkout.remote.ts, a second command:
export const startTrialNoCard = command(
	v.object({ lookupKey: v.pipe(v.string(), v.minLength(1)) }),
	async (input) => {
		const { locals } = getRequestEvent();
		const user = requireUser(locals);
		const tier = await findTierByLookupKey(input.lookupKey);
		if (!tier || !tier.allowTrialNoCard) throw error(400, 'Ineligible');

		const customer = await getOrCreateStripeCustomer(locals.supabaseAdmin, user);

		const subscription = await stripe.subscriptions.create(
			{
				customer: customer.stripeCustomerId,
				items: [{ price: tier.stripePriceId }],
				trial_period_days: tier.trialDays,
				payment_settings: { payment_method_types: ['card'] },
				trial_settings: {
					end_behavior: { missing_payment_method: 'pause' }
				},
				metadata: { user_id: user.id, no_card_trial: 'true' }
			},
			{ idempotencyKey: `trial-nocard:${user.id}:${input.lookupKey}` }
		);

		return { subscriptionId: subscription.id };
	}
);
```

UI-side, on the pricing page, a "Start free trial — no card" button bypasses `/checkout` entirely and calls this directly. The cart isn't used; the stepper isn't shown. It's a one-click flow.

Full treatment of the toggle is in E.5.

## Step 8 — Test clocks and Elements

Module 9.3's test-clock helpers work identically with the Elements flow — the subscription still lives on a clock customer, still advances with `advanceTestClockByDays`. The only difference is the trigger (custom form vs hosted Checkout).

Run the five scenarios from 9.3 against the new Elements flow and verify webhooks still produce the correct DB state.

## Verify

- On `/checkout#payment`, Stripe Elements renders the card, expiry, CVC in a Stripe-served iframe.
- Inspecting DevTools shows no card digits in the DOM — only an iframe.
- Successful card (`4242 4242 4242 4242`) → "Payment successful" page → redirects to `/app`.
- 3DS-required card (`4000 0025 0000 3155`) → browser redirects to a fake auth page → returns to `/checkout/complete` with success.
- Failing card (`4000 0000 0000 0341`) → error rendered inline below the card form, cart/sidebar remain visible.
- After success, `stripe_subscriptions` row appears in the DB within 2 seconds.

## Common traps

- **Self-hosting `stripe.js`.** Breaks PCI compliance. You must load from `js.stripe.com` via `@stripe/stripe-js`. Never bundle it.
- **Using the publishable key in server code.** It's PUBLIC_ — fine for the client, but for server work (creating intents), always use the secret key.
- **Creating the PaymentIntent on page load.** Users who open `/checkout` and close it without paying create abandoned intents. Create on "Pay" click — or if you need it on load (to pre-mount the element), set `confirmed_at` checks on the webhook side.
- **Mounting the PaymentElement twice.** Hot reloads during dev can re-run `onMount` without tearing down. Stripe throws if the same element mounts twice. Hold a ref and guard.
- **Trusting the `redirect_status` on the return page.** A malicious user can hit `/checkout/complete?redirect_status=succeeded` manually. Treat it as a display hint; verify via the webhook-populated DB state.
- **Forgetting `redirect: 'if_required'`.** Without it, Stripe always redirects, even for cards that don't need 3DS. The in-place success path never triggers.

## Recap

Server creates the intent, client mounts Elements, user pays, 3DS handled, webhook populates DB, success page redirects to the app. Same backend as hosted Checkout; entirely different frontend. The Simpler Trading layout is now fully functional.

Four lessons in. If you made it through, you now have a checkout flow that matches the design standard of the top-tier SaaS products — and you understand every moving piece.

Next: [E.5 One flow, two trials — with and without a card →](./E.5-trial-with-without-card.md)
