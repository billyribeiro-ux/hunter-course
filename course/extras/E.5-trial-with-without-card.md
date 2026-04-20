# E.5 — One Flow, Two Trials: With and Without a Card

> The same Stripe subscription, two acquisition surfaces. Card-required for committed intent; no-card for top-of-funnel. A focused lesson on making both work cleanly.

## Why this matters

Every SaaS founder eventually asks: "Should we require a credit card for the free trial?"

The honest answer is "it depends, and you should support both." Card-required trials convert at ~60% trial-to-paid but attract fewer signups. No-card trials 2-3x your signups but convert at ~10-20%. The right answer varies by product, price point, and acquisition channel.

This lesson is the dedicated walk-through of the mechanics. Module 9.2 covered the basic case; E.5 is the complete picture, including the pricing-page toggle, the two separate Stripe subscription shapes, and the expiration-day UX for each.

## The Principal Engineer lens

**Both trial types are the same Stripe primitive — a `subscription` with `trial_period_days` set.** The only differences are:

- Whether we call `payment_method_collection: 'if_required'` (no card) or not (card-required).
- Whether we pass `trial_settings.end_behavior.missing_payment_method` to control what happens when the trial ends without a card.

Everything downstream — webhooks, DB rows, entitlements, the past-due dunning — is identical. Clean mental model: *trial shape* is a config, not a separate code path.

Corollary: **the two flows look identical in the database.** `trial_end` is set for both. `status = 'trialing'` for both. The only distinguishing field is whether `default_payment_method` is populated. Downstream code doesn't need to care which kind it is.

## Step 1 — Configure the tier flags

In the central tier config (Module 8.3):

```ts
// src/lib/shared/tiers.ts
export const TIERS = {
	plus: {
		id: 'plus',
		label: 'Plus',
		trialDays: 14,
		trialRequiresCard: true, // card-required: shown in checkout stepper
		allowTrialNoCard: false
	},
	pro: {
		id: 'pro',
		label: 'Pro',
		trialDays: 14,
		trialRequiresCard: true, // default flow: card-required
		allowTrialNoCard: true   // optional flow: allow a no-card trial too
	}
} as const;
```

Two boolean flags per tier, clear meanings:

- **`trialRequiresCard`** — governs the default/primary trial path. Used when the user clicks the main Upgrade / Start trial CTA.
- **`allowTrialNoCard`** — whether *as an alternative* the tier supports a no-card trial. If true, a secondary CTA appears.

Pro supports both because Pro is the flagship — we want aggressive top-of-funnel via no-card, plus a committed path via card-required.

## Step 2 — Two buttons on the pricing card

`src/lib/components/TierCard.svelte` (excerpt):

```svelte
<script lang="ts">
	import { cart } from '$lib/stores/cart.svelte.ts';
	import { startTrialNoCard } from '$lib/remote/checkout.remote.ts';
	import { toasts } from '$lib/stores/toasts.svelte.ts';
	import { goto } from '$app/navigation';

	let { tier, interval, lookupKey, trialUsed }: TierCardProps = $props();
	let noCardPending = $state(false);

	async function startNoCardTrial() {
		noCardPending = true;
		try {
			const r = await startTrialNoCard({ lookupKey });
			toasts.success('Trial started. Enjoy Contactly Pro for 14 days.');
			goto('/app');
		} catch {
			toasts.error('Could not start trial. Please try again.');
		} finally {
			noCardPending = false;
		}
	}

	function cardRequiredFlow() {
		cart.addSubscription({ kind: 'subscription', lookupKey, tierId: tier.id, interval, quantity: 1 });
		goto('/checkout');
	}
</script>

<article class="tier">
	<!-- ... tier details ... -->

	{#if trialUsed}
		<button onclick={cardRequiredFlow}>Subscribe to {tier.label}</button>
	{:else if tier.allowTrialNoCard}
		<button class="primary" onclick={startNoCardTrial} disabled={noCardPending}>
			{noCardPending ? 'Starting…' : `Start ${tier.trialDays}-day trial — no card`}
		</button>
		{#if tier.trialRequiresCard}
			<button class="secondary" onclick={cardRequiredFlow}>
				Start trial with card
			</button>
		{/if}
	{:else if tier.trialRequiresCard}
		<button class="primary" onclick={cardRequiredFlow}>
			Start {tier.trialDays}-day trial
		</button>
	{:else}
		<button onclick={cardRequiredFlow}>Subscribe to {tier.label}</button>
	{/if}
</article>
```

Three branches, matching the three legitimate states:

- **`trialUsed` already**: no more trials; direct subscribe.
- **No-card trial allowed**: primary CTA is the no-card path; secondary CTA (if card-required is also supported) shown below for users who prefer to pre-commit.
- **Card-required only**: single primary CTA that leads into the Extras stepper (or hosted Checkout).

## Step 3 — Server-side: the two subscription shapes

Recapping the two shapes from E.4:

```ts
// Card-required trial (the default path)
await stripe.subscriptions.create({
	customer: customerId,
	items: [{ price: priceId }],
	trial_period_days: 14,
	payment_behavior: 'default_incomplete',
	payment_settings: { save_default_payment_method: 'on_subscription' },
	expand: ['pending_setup_intent']
});

// No-card trial
await stripe.subscriptions.create({
	customer: customerId,
	items: [{ price: priceId }],
	trial_period_days: 14,
	payment_settings: { payment_method_types: ['card'] },
	trial_settings: {
		end_behavior: { missing_payment_method: 'pause' }
	}
});
```

Three concrete behavioural differences:

| | Card-required | No card |
|---|---|---|
| Saves card at start | Yes (SetupIntent) | No |
| At trial end if no card | N/A (card is on file) | Subscription pauses; access revoked |
| Trial-end email | "We'll charge your card tomorrow" | "Add a card to continue" |

`missing_payment_method: 'pause'` is the critical setting. Without it, the subscription tries to collect money at trial-end, fails (no payment method), goes `past_due`, and eventually cancels — a noisy failure path. With `pause`, it quietly stops; the user can return, add a card, and resume.

## Step 4 — The `trial_will_end` webhook, two contexts

Stripe fires `customer.subscription.trial_will_end` 3 days before trial-end for both shapes. The message you send differs:

```ts
// In the webhook handler:
case 'customer.subscription.trial_will_end': {
	const sub = event.data.object as Stripe.Subscription;
	const hasCard = !!sub.default_payment_method;

	if (hasCard) {
		await sendEmail(userId, {
			template: 'trial-ending-card',
			context: { trialEndAt: sub.trial_end, amountDue: sub.plan?.amount }
		});
	} else {
		await sendEmail(userId, {
			template: 'trial-ending-no-card',
			context: { trialEndAt: sub.trial_end, addCardUrl: `${PUBLIC_APP_URL}/app/billing/portal` }
		});
	}
	break;
}
```

Same event; branching on whether a default payment method exists. The template names and CTAs differ; the transport is the same.

## Step 5 — The expiration experience

Day 14 hits. Now what?

**Card-required path**: Stripe charges the card. Success → `invoice.paid` → subscription becomes `active`. Failure → `invoice.payment_failed` → `past_due` → Module 9.5's banner appears.

**No-card path**: Stripe looks for a payment method, finds none, and — because of `missing_payment_method: 'pause'` — sets `pause_collection: { behavior: 'void' }` on the subscription. Status stays `active` but invoices aren't generated.

The subscription model in Module 7.4 needs one extra check:

```ts
// src/lib/server/billing/subscriptions.ts (excerpt)
export async function getActiveSubscription(admin, userId) {
	const sub = await fetchLatestSubscription(admin, userId);
	if (!sub) return null;

	// Active and actively collecting: true active state
	if (sub.status === 'active' && !sub.pause_collection) return sub;

	// Trialing: still active
	if (sub.status === 'trialing') return sub;

	// Paused (no-card trial ended without card): treat as not-active
	if (sub.pause_collection) return null;

	return null;
}
```

Entitlements automatically drop to Free when the subscription pauses. No extra logic needed at call sites.

## Step 6 — The "add card to resume" flow

A paused subscription can be resumed by adding a payment method. The simplest path is the Stripe Customer Portal (Module 9.8) — it has built-in "Add payment method" UI.

Make the experience explicit in our app:

```svelte
<!-- PausedSubscriptionBanner.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="banner" role="status">
	<strong>Your trial has ended.</strong>
	<p>Add a payment method to continue using Contactly Pro.</p>
	<button onclick={() => goto('/app/billing/portal')}>
		Add payment method
	</button>
</div>
```

Render it in the `(app)` layout when `subscription.pause_collection` is set. Users don't have to wonder why features stopped working — the banner explains and offers the fix.

## Step 7 — Distinguishing the two in analytics

Set `metadata.trial_type` on each subscription so your analytics downstream can distinguish:

```ts
await stripe.subscriptions.create({
	// ...
	metadata: {
		user_id: user.id,
		trial_type: withCard ? 'card_required' : 'no_card'
	}
});
```

Then query `stripe_subscriptions.metadata->>'trial_type'` to compare conversion rates. After 30 days you'll have real data on which flow wins for your product — not assumptions.

## Step 8 — The honest pros/cons table

Paste this in your `docs/trial-strategy.md` so future-you (or your co-founder) can revisit the decision:

| Dimension | Card required | No card |
|---|---|---|
| Trial signups (relative) | 1x | 3x |
| Trial → paid conversion | 55–70% | 10–25% |
| Support burden | low | low |
| Fraud risk | low (card deters) | medium (email farms) |
| Dev complexity | simple | slightly more (pause handling) |
| User trust on first signup | mixed (hesitation) | high (no obstacle) |
| Ideal for | high-priced B2B | PLG B2C |

Product strategy, not a tech decision — but the tech has to support whichever you pick.

## Step 9 — Regression tests

Both paths should be covered by the test-clock scenarios from Module 9.3. The critical additions:

```ts
test('no-card trial pauses at end', async () => {
	const { subId, clockId, userId } = await setupNoCardTrial('pro_monthly');
	await advanceTestClockByDays(clockId, 15);
	const dbSub = await getSubscription(userId);
	expect(dbSub.status).toBe('active');
	expect(dbSub.pause_collection).toBeTruthy();
	expect(await getUserTier(userId)).toBe('free'); // dropped back
});

test('card-required trial charges at end', async () => {
	const { subId, clockId, userId } = await setupCardTrial('pro_monthly');
	await advanceTestClockByDays(clockId, 15);
	const dbSub = await getSubscription(userId);
	expect(dbSub.status).toBe('active');
	expect(dbSub.pause_collection).toBeNull();
	expect(await getUserTier(userId)).toBe('pro'); // promoted
});
```

Two tests, two shapes, end-to-end confidence.

## Verify

- On `/pricing` the Pro card shows two CTAs: primary "Start 14-day trial — no card" and secondary "Start trial with card."
- Clicking the no-card CTA: one API call, goes straight to `/app`, subscription exists in DB with status `trialing`, no payment method.
- Clicking the card CTA: goes to `/checkout`, collects payment, subscription exists in DB with `trialing` and a `default_payment_method`.
- After 14 days (via test clock), no-card subscription is paused; user drops to Free tier; banner appears offering to add a card.
- After 14 days for the card subscription: an invoice is paid, user remains on Pro.

## Common traps

- **Forgetting `missing_payment_method: 'pause'`.** The no-card trial will try to charge (nothing), go past_due, fire dunning emails at a user who never gave you a card. Bad experience.
- **Treating paused subs as active.** Without the `pause_collection` check in `getActiveSubscription`, users continue seeing Pro features after their trial ended without paying. Silent revenue leak.
- **One CTA with a toggle.** "Card required ☑" checkbox confuses users. Two separate buttons, labelled clearly, is better UX.
- **Different table rows per trial type.** The whole point of supporting both is that the database layer doesn't care. Resist the urge to add a `trial_kind` column; use Stripe metadata.
- **No-card trials without email verification.** Users make 100 fake accounts to extend their trial forever. Pair no-card with Supabase email confirmation (Module 12.6) and `hasUsedTrial` (Module 9.4).

## Recap

Two flags on each tier. Two Stripe subscription shapes. Same webhooks, same DB, same entitlements. The user-facing difference is which button they click on `/pricing`; the developer-facing difference is a `pause_collection` check. You now have a supple trial strategy that can adapt to whatever your product needs.

Next: [E.6 Optimistic UI for contacts →](./E.6-optimistic-ui.md)
