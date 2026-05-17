# E.3 — The Three-Step Checkout Stepper

> Sign in → Billing → Payment. One route, three panels, a progress indicator, and browser-history-friendly navigation.

## Why this matters

The Simpler Trading layout splits checkout into three visible steps:

1. **Sign In / Register** — identify the user.
2. **Billing Info** — address, name on card, tax region.
3. **Payment** — card fields.

Each step validates independently. Each step has a clear "what do I do here?" affordance. A progress bar at the top shows where the user is. The cart sidebar stays pinned to the right through the whole flow.

This lesson builds the stepper shell. The Stripe Elements bit comes in E.4. Today is pure state management + layout.

## The Principal Engineer lens

**A stepper is a state machine with three states and enforced transitions.** You can only move to `payment` after `billing` is valid, which is only valid after `signin` is satisfied. Never let a user skip ahead; never let them back-nav into a step they've already passed and silently mutate what the next step depends on.

Corollary: **the URL is part of the state.** `/checkout#billing` means "I'm on billing." Reload the page: land back on billing. Browser back button: go to sign-in. This is free UX if you respect the URL; it's a bug if you ignore it.

## Step 1 — The step state

```ts
// src/lib/shared/checkout-steps.ts
export const STEPS = ['signin', 'billing', 'payment'] as const;
export type Step = (typeof STEPS)[number];

export function nextStep(current: Step): Step | null {
	const i = STEPS.indexOf(current);
	return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : null;
}

export function canAdvanceTo(target: Step, completed: Set<Step>): boolean {
	const targetIndex = STEPS.indexOf(target);
	// You can move to any step whose predecessors are all complete.
	return STEPS.slice(0, targetIndex).every((s) => completed.has(s));
}
```

Tiny, pure, testable. The UI reads this and decides whether to render a "Next" button or render step N inline.

## Step 2 — The stepper store

`src/lib/stores/checkout.svelte.ts`:

```ts
import { browser } from '$app/environment';
import type { Step } from '$lib/shared/checkout-steps';

export interface BillingDetails {
	name: string;
	email: string;
	line1: string;
	line2: string;
	city: string;
	postalCode: string;
	country: string; // ISO 3166 alpha-2
}

function emptyBilling(): BillingDetails {
	return {
		name: '',
		email: '',
		line1: '',
		line2: '',
		city: '',
		postalCode: '',
		country: 'US'
	};
}

function createCheckoutStore() {
	let currentStep = $state<Step>('signin');
	let completed = $state<Set<Step>>(new Set());
	let billing = $state<BillingDetails>(emptyBilling());

	function markComplete(step: Step) {
		completed = new Set([...completed, step]);
	}

	function goTo(step: Step) {
		currentStep = step;
		if (browser) {
			history.replaceState({}, '', `#${step}`);
		}
	}

	function reset() {
		currentStep = 'signin';
		completed = new Set();
		billing = emptyBilling();
	}

	return {
		get currentStep() {
			return currentStep;
		},
		get completed() {
			return completed;
		},
		get billing() {
			return billing;
		},
		set billing(value: BillingDetails) {
			billing = value;
		},
		markComplete,
		goTo,
		reset
	};
}

export const checkout = createCheckoutStore();
```

Three pieces of state: which step we're on, which steps are complete, and the billing details (collected in step 2, consumed in step 3).

## Step 3 — The stepper header

`src/lib/components/CheckoutStepper.svelte`:

```svelte
<script lang="ts">
	import { checkout } from '$lib/stores/checkout.svelte.ts';
	import { STEPS, canAdvanceTo, type Step } from '$lib/shared/checkout-steps';

	const LABELS: Record<Step, string> = {
		signin: 'Sign In / Register',
		billing: 'Billing Info',
		payment: 'Payment'
	};

	function handleClick(step: Step) {
		if (canAdvanceTo(step, checkout.completed)) {
			checkout.goTo(step);
		}
	}
</script>

<nav class="stepper" aria-label="Checkout progress">
	<ol>
		{#each STEPS as step (step)}
			{@const isActive = checkout.currentStep === step}
			{@const isComplete = checkout.completed.has(step)}
			{@const isReachable = canAdvanceTo(step, checkout.completed)}

			<li
				class="step"
				class:active={isActive}
				class:complete={isComplete}
				class:reachable={isReachable}
			>
				<button
					type="button"
					disabled={!isReachable}
					onclick={() => handleClick(step)}
					aria-current={isActive ? 'step' : undefined}
				>
					{LABELS[step]}
				</button>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.stepper ol {
		display: flex;
		gap: 2rem;
		list-style: none;
		padding: 0;
		margin: 0 0 2rem;
		border-bottom: 1px solid #e5e7eb;
	}
	.step button {
		appearance: none;
		background: transparent;
		border: 0;
		border-bottom: 2px solid transparent;
		padding: 0.75rem 0;
		font-size: 0.95rem;
		font-weight: 500;
		color: #9ca3af;
		cursor: not-allowed;
		margin-bottom: -1px;
	}
	.step.reachable button {
		cursor: pointer;
		color: #4b5563;
	}
	.step.active button {
		color: #2563eb;
		border-bottom-color: #2563eb;
	}
	.step.complete button {
		color: #059669;
	}
</style>
```

Visual match to the Simpler Trading screenshot's stepper: horizontal list, underline on the active step, muted past steps, clickable once reachable.

## Step 4 — The page that hosts the steps

`src/routes/checkout/+page.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { cart } from '$lib/stores/cart.svelte.ts';
	import { checkout } from '$lib/stores/checkout.svelte.ts';
	import { STEPS, type Step } from '$lib/shared/checkout-steps';
	import { goto } from '$app/navigation';
	import CheckoutStepper from '$lib/components/CheckoutStepper.svelte';
	import SigninStep from '$lib/components/checkout/SigninStep.svelte';
	import BillingStep from '$lib/components/checkout/BillingStep.svelte';
	import PaymentStep from '$lib/components/checkout/PaymentStep.svelte';

	let { data } = $props();

	$effect(() => {
		if (cart.isEmpty) {
			goto('/pricing', { replaceState: true });
		}
	});

	// Restore step from URL hash on mount, then listen for hash changes.
	onMount(() => {
		const fromHash = (window.location.hash.slice(1) as Step) || 'signin';
		if (STEPS.includes(fromHash)) checkout.goTo(fromHash);

		const onHash = () => {
			const next = window.location.hash.slice(1) as Step;
			if (STEPS.includes(next)) checkout.goTo(next);
		};
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	});

	// Pre-fill user data if already signed in.
	$effect(() => {
		if (data.user) {
			checkout.markComplete('signin');
			if (checkout.currentStep === 'signin') checkout.goTo('billing');
		}
	});
</script>

<CheckoutStepper />

{#if checkout.currentStep === 'signin'}
	<SigninStep />
{:else if checkout.currentStep === 'billing'}
	<BillingStep />
{:else if checkout.currentStep === 'payment'}
	<PaymentStep />
{/if}
```

Short, declarative. Step components own their own form state. The stepper component owns the progress UI. The store owns the transitions.

## Step 5 — Step one: sign in / register

`src/lib/components/checkout/SigninStep.svelte`:

```svelte
<script lang="ts">
	import { checkout } from '$lib/stores/checkout.svelte.ts';
	import { loginCommand, signupCommand } from '$lib/remote/auth.remote.ts';
	import { toasts } from '$lib/stores/toasts.svelte.ts';

	let mode = $state<'signin' | 'register'>('signin');
	let email = $state('');
	let password = $state('');
	let pending = $state(false);

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		pending = true;
		try {
			const fn = mode === 'signin' ? loginCommand : signupCommand;
			const result = await fn({ email, password });
			if (!result.ok) {
				toasts.error(result.error);
				return;
			}
			checkout.billing = { ...checkout.billing, email };
			checkout.markComplete('signin');
			checkout.goTo('billing');
		} finally {
			pending = false;
		}
	}
</script>

<div class="panel">
	<div class="left">
		<h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
		<form onsubmit={onSubmit}>
			<label>
				Email
				<input type="email" required bind:value={email} />
			</label>
			<label>
				Password
				<input type="password" minlength="8" required bind:value={password} />
			</label>
			<button type="submit" disabled={pending}>
				{pending ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
			</button>
		</form>
	</div>

	<aside class="right">
		<h3>{mode === 'signin' ? 'New to Contactly?' : 'Already have an account?'}</h3>
		<p>
			{mode === 'signin'
				? 'You need an account to complete your purchase.'
				: 'Sign in to complete your purchase.'}
		</p>
		<button class="ghost" onclick={() => (mode = mode === 'signin' ? 'register' : 'signin')}>
			{mode === 'signin' ? 'Create an account' : 'Sign in instead'}
		</button>
	</aside>
</div>

<style>
	.panel {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 2rem;
	}
	.right {
		border-left: 1px solid #f3f4f6;
		padding-left: 3rem;
	}
	form label {
		display: block;
		margin-bottom: 1rem;
		font-size: 0.85rem;
		color: #374151;
	}
	form input {
		display: block;
		margin-top: 0.25rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		width: 100%;
		font-size: 0.95rem;
	}
	button[type='submit'] {
		background: #f59e0b;
		color: white;
		padding: 0.65rem 1.5rem;
		border: 0;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
	}
	button[type='submit']:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.ghost {
		background: #f59e0b;
		color: white;
		padding: 0.6rem 1.25rem;
		border: 0;
		border-radius: 0.375rem;
		cursor: pointer;
	}
</style>
```

Visual match: left side is the sign-in form, right side is the "New to Contactly?" CTA. The two modes share the panel but swap which side is "primary."

## Step 6 — Step two: billing info

`src/lib/components/checkout/BillingStep.svelte`:

```svelte
<script lang="ts">
	import { checkout } from '$lib/stores/checkout.svelte.ts';

	let billing = $state({ ...checkout.billing });

	function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		checkout.billing = billing;
		checkout.markComplete('billing');
		checkout.goTo('payment');
	}
</script>

<form onsubmit={onSubmit} class="panel">
	<h2>Billing details</h2>

	<div class="row">
		<label>
			Full name
			<input required bind:value={billing.name} autocomplete="name" />
		</label>
		<label>
			Email
			<input type="email" required bind:value={billing.email} autocomplete="email" />
		</label>
	</div>

	<label>
		Address
		<input required bind:value={billing.line1} autocomplete="address-line1" />
	</label>

	<label>
		Address line 2
		<input bind:value={billing.line2} autocomplete="address-line2" />
	</label>

	<div class="row">
		<label>
			City
			<input required bind:value={billing.city} autocomplete="address-level2" />
		</label>
		<label>
			Postal code
			<input required bind:value={billing.postalCode} autocomplete="postal-code" />
		</label>
		<label>
			Country
			<select bind:value={billing.country} required>
				<option value="US">United States</option>
				<option value="GB">United Kingdom</option>
				<option value="CA">Canada</option>
				<option value="AU">Australia</option>
				<!-- ... more ... -->
			</select>
		</label>
	</div>

	<footer class="actions">
		<button type="button" class="back" onclick={() => checkout.goTo('signin')}>
			Back
		</button>
		<button type="submit">Continue to payment</button>
	</footer>
</form>

<style>
	.panel {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 2rem;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	.row:has(select) {
		grid-template-columns: 1fr 1fr 1fr;
	}
	label {
		display: block;
		margin-bottom: 1rem;
		font-size: 0.85rem;
		color: #374151;
	}
	input, select {
		display: block;
		margin-top: 0.25rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		width: 100%;
		font-size: 0.95rem;
	}
	.actions {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.5rem;
	}
	.actions button {
		padding: 0.65rem 1.5rem;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
	}
	.back { background: transparent; border: 1px solid #d1d5db; color: #374151; }
	button[type='submit'] { background: #f59e0b; color: white; border: 0; }
</style>
```

All `autocomplete` attributes are set — browsers (and password managers) autofill billing addresses correctly, which is one of the quiet conversion wins.

## Step 7 — Payment step placeholder

`src/lib/components/checkout/PaymentStep.svelte`:

```svelte
<script lang="ts">
	// E.4 replaces this with the real Stripe Elements form.
</script>

<div class="panel">
	<h2>Payment</h2>
	<p>Card form coming in E.4.</p>
</div>
```

We leave this as a placeholder for now — E.4 wires it to Stripe Elements.

## Step 8 — What still needs to happen server-side

The stepper is purely UI. Before the user clicks "Pay" in E.4, the server still needs to:

- Validate the email on sign-in matches the session user.
- Re-fetch prices from Stripe for the lookup keys in the cart.
- Validate the user is entitled to a trial (from Module 9.4's `hasUsedTrial`).
- Compute final tax (via Stripe Tax, optional).

None of that happens in the client. The client *displays* the totals; the server *computes* them at PaymentIntent-creation time.

## Verify

- `/checkout` loads with the stepper showing Sign In as the current step.
- Complete sign-in → stepper advances to Billing.
- Click on Payment in the stepper before completing Billing → nothing happens (disabled).
- Complete Billing → stepper advances to Payment.
- Hit browser back → go to Billing (URL hash updates).
- Hit refresh on `#billing` → land on Billing (not sign-in).
- Cart sidebar stays visible across all three steps.
- Already-signed-in user lands on Billing immediately.

## Common traps

- **Forgetting to sync the URL hash.** Users who refresh fall back to step one and re-enter data. Use `history.replaceState` on each step change.
- **Letting the user skip to Payment.** Malicious or just curious users poke `#payment` in the URL. Guard server-side — the PaymentIntent endpoint should verify billing + auth, not trust the client.
- **Mounting Stripe Elements on step one.** Elements allocates an iframe; mounting it before the user is on the payment step is wasted work and can leak state if the user bails. Mount only when the payment step renders.
- **Losing state on back-button.** If the browser back button undoes completion, users have to redo work. Completed steps stay marked complete; the user navigates, doesn't re-enter.
- **No `autocomplete` attributes on address fields.** Autofill doesn't work, users sigh, bounce rates creep up.

## Recap

Three-panel stepper, URL-aware, state-machine-driven, visually mirroring the Simpler Trading layout. The scaffolding is complete. Next lesson wires the real payment: Stripe Elements, PaymentIntents, 3DS handling, the money-moving bits.

Next: [E.4 Embedded payment with Stripe Elements →](./E.4-stripe-elements-payment.md)
