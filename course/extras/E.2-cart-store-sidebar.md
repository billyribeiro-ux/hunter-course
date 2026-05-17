# E.2 — The Cart Store and Cart Sidebar Component

> A persistent cart that survives navigation, remembers subscription vs one-off items, and stays visible through every step of checkout. Built with Svelte 5 runes.

## Why this matters

The cart is the model. Everything in the checkout UI — the sidebar summary, the "Edit" affordance, the recurring-total math, the final Stripe `PaymentIntent` request — reads from one shared state. If the model is messy, every screen downstream is messy.

This lesson builds a single cart store that holds mixed items (subscriptions and one-off products), survives navigation, and exposes derived totals cleanly. The sidebar component is ~80 lines and renders state directly — no prop drilling, no hand-wired updates.

## The Principal Engineer lens

**The cart is a client-side state machine, not a database table.** Until the user clicks "Pay," there is no server-side "cart" object. The cart lives in the browser (with `sessionStorage` mirroring for recovery) and converts to a Stripe session only at the final step. This matters because 80% of carts are abandoned; persisting every one server-side is wasted writes.

Corollary: **validate the cart server-side at checkout time, never before.** Prices, trial eligibility, entitlements — all computed fresh on the server when the PaymentIntent is created. The client cart is a UI convenience; the server decides what anything actually costs.

## Step 1 — The shape

A cart holds *line items*. Each line item references a tier (for subscriptions) or a product (for one-offs) and a quantity. Everything else — price, trial eligibility, recurring cadence — is computed.

```ts
// src/lib/shared/cart-types.ts
export type BillingInterval = 'month' | 'year';

export interface SubscriptionLine {
	kind: 'subscription';
	lookupKey: string; // e.g. 'plus_monthly'
	tierId: string; // 'plus' | 'pro'
	interval: BillingInterval;
	quantity: 1; // subscriptions are always qty 1 in Contactly
}

export interface OneOffLine {
	kind: 'one_off';
	productId: string;
	quantity: number;
}

export type CartLine = SubscriptionLine | OneOffLine;

export interface CartSnapshot {
	lines: CartLine[];
	updatedAt: string; // ISO timestamp
}
```

Two kinds of line keeps the door open for one-off products later (courses, add-ons) without forcing the type today.

## Step 2 — The store

`src/lib/stores/cart.svelte.ts`:

```ts
import { browser } from '$app/environment';
import type { CartLine, CartSnapshot, SubscriptionLine } from '$lib/shared/cart-types';

const STORAGE_KEY = 'contactly.cart';

function loadInitial(): CartLine[] {
	if (!browser) return [];
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as CartSnapshot;
		return Array.isArray(parsed.lines) ? parsed.lines : [];
	} catch {
		return [];
	}
}

function createCart() {
	let lines = $state<CartLine[]>(loadInitial());

	if (browser) {
		$effect.root(() => {
			$effect(() => {
				const snapshot: CartSnapshot = { lines, updatedAt: new Date().toISOString() };
				sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
			});
		});
	}

	function addSubscription(line: SubscriptionLine) {
		lines = [
			...lines.filter((l) => l.kind !== 'subscription'),
			line
		];
	}

	function remove(index: number) {
		lines = lines.filter((_, i) => i !== index);
	}

	function clear() {
		lines = [];
	}

	return {
		get lines() {
			return lines;
		},
		get isEmpty() {
			return lines.length === 0;
		},
		get hasSubscription() {
			return lines.some((l) => l.kind === 'subscription');
		},
		addSubscription,
		remove,
		clear
	};
}

export const cart = createCart();
```

Notes:

- **`$effect.root` inside `if (browser)`**. `$effect` requires a parent effect or a root scope; `$effect.root` provides that scope so the persistence effect can run from a module-level factory. The `browser` guard matters because this factory runs once per request during SSR — without the guard you'd allocate one effect root per request on the server, and `sessionStorage` doesn't exist there anyway. We discard the cleanup function `$effect.root` returns: this is a singleton store that lives as long as the page, so there's nothing to dispose.
- **Single subscription enforcement** — `addSubscription` removes any existing subscription before adding the new one. Contactly never lets a user buy Plus *and* Pro simultaneously; swap, don't append.
- **`sessionStorage` not `localStorage`** — cart survives refresh within the tab but doesn't leak across devices or closed tabs. Stale carts are a UX footgun (price changes, expired trials).

## Step 3 — The derived totals

`src/lib/shared/cart-totals.ts`:

```ts
import type { CartLine } from './cart-types';
import { formatUSD } from './money';

export interface PricedLine {
	label: string;
	interval: 'month' | 'year' | null;
	amountCents: number;
	trialDays: number | null;
}

export interface CartTotals {
	lines: PricedLine[];
	subtotalCents: number;
	recurringTotalCents: number;
	recurringInterval: 'month' | 'year' | null;
	dueTodayCents: number;
	hasTrial: boolean;
}

// Pure function. Inputs: cart lines + a priced catalog. Outputs: display-ready totals.
export function priceCart(
	lines: CartLine[],
	catalog: Record<string, { label: string; amountCents: number; trialDays: number | null }>
): CartTotals {
	let subtotalCents = 0;
	let recurringTotalCents = 0;
	let recurringInterval: 'month' | 'year' | null = null;
	let dueTodayCents = 0;
	let hasTrial = false;

	const pricedLines: PricedLine[] = lines.map((line) => {
		if (line.kind === 'subscription') {
			const product = catalog[line.lookupKey];
			subtotalCents += product.amountCents;
			recurringTotalCents += product.amountCents;
			recurringInterval = line.interval;

			const trial = product.trialDays ?? null;
			if (trial && trial > 0) {
				hasTrial = true;
				// due today: $0 when trial is active
			} else {
				dueTodayCents += product.amountCents;
			}

			return {
				label: product.label,
				interval: line.interval,
				amountCents: product.amountCents,
				trialDays: trial
			};
		}

		// one-off line
		const product = catalog[line.productId];
		const line_total = product.amountCents * line.quantity;
		subtotalCents += line_total;
		dueTodayCents += line_total;
		return {
			label: product.label,
			interval: null,
			amountCents: line_total,
			trialDays: null
		};
	});

	return {
		lines: pricedLines,
		subtotalCents,
		recurringTotalCents,
		recurringInterval,
		dueTodayCents,
		hasTrial
	};
}
```

Pure function. Takes cart lines + a priced catalog (loaded from the products service in Module 7.2), returns every number the sidebar displays. Easy to test, easy to reason about.

`formatUSD` is the Module 8.3 helper — `$10.00` not `1000` cents.

## Step 4 — The sidebar component

`src/lib/components/CartSidebar.svelte`:

```svelte
<script lang="ts">
	import { cart } from '$lib/stores/cart.svelte.ts';
	import { priceCart } from '$lib/shared/cart-totals';
	import { formatUSD } from '$lib/shared/money';

	let { catalog, editable = true }: {
		catalog: Record<string, { label: string; amountCents: number; trialDays: number | null }>;
		editable?: boolean;
	} = $props();

	let totals = $derived(priceCart(cart.lines, catalog));
</script>

<aside class="cart-sidebar" aria-label="Shopping cart">
	<header>
		<h2>Shopping cart</h2>
		{#if editable && !cart.isEmpty}
			<a href="/pricing" class="edit-link">Edit</a>
		{/if}
	</header>

	{#if cart.isEmpty}
		<p class="empty">Your cart is empty.</p>
	{:else}
		<ul class="items">
			{#each totals.lines as line, i (i)}
				<li>
					<span class="label">{line.label}</span>
					<span class="amount">{formatUSD(line.amountCents)}</span>
					{#if line.interval}
						<span class="interval">/{line.interval}</span>
					{/if}
				</li>
			{/each}
		</ul>

		<dl class="totals">
			<div>
				<dt>Subtotal</dt>
				<dd>{formatUSD(totals.subtotalCents)}</dd>
			</div>
			{#if totals.hasTrial}
				<div class="due-today-highlight">
					<dt>Due today</dt>
					<dd>{formatUSD(totals.dueTodayCents)}</dd>
				</div>
			{/if}
			{#if totals.recurringTotalCents > 0}
				<div>
					<dt>Recurring total</dt>
					<dd>
						{formatUSD(totals.recurringTotalCents)}
						<span class="interval">/{totals.recurringInterval}</span>
					</dd>
				</div>
			{/if}
		</dl>

		{#if totals.hasTrial}
			<p class="trial-note">
				No charge today. You'll be billed after your trial ends.
			</p>
		{/if}
	{/if}
</aside>

<style>
	.cart-sidebar {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 1.25rem;
		width: 20rem;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 1rem;
	}
	header h2 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}
	.edit-link {
		font-size: 0.85rem;
		color: #6366f1;
		text-decoration: none;
	}
	.items {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
	}
	.items li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.25rem 0.5rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f3f4f6;
	}
	.items .label { grid-column: 1; }
	.items .amount { grid-column: 2; font-weight: 500; }
	.items .interval { grid-column: 3; color: #6b7280; font-size: 0.85rem; }
	.totals {
		margin: 1rem 0 0;
	}
	.totals > div {
		display: flex;
		justify-content: space-between;
		padding: 0.25rem 0;
	}
	.totals dt { color: #374151; }
	.totals dd { margin: 0; font-weight: 500; }
	.due-today-highlight dt,
	.due-today-highlight dd {
		font-weight: 600;
		font-size: 1.05rem;
	}
	.trial-note {
		font-size: 0.85rem;
		color: #6b7280;
		margin-top: 0.75rem;
	}
	.empty {
		color: #6b7280;
		font-size: 0.9rem;
	}
</style>
```

Visual parity with the Simpler Trading screenshot: cart summary card with items, subtotal, tax placeholder (we'll add tax in E.4), and recurring totals block.

## Step 5 — Wire the pricing page to add to cart

The pricing page already has Upgrade buttons (Module 8.4). Change the click behaviour: instead of immediately redirecting to Stripe Checkout, push into the cart and navigate to `/checkout`.

```svelte
<!-- src/routes/(marketing)/pricing/+page.svelte (excerpt) -->
<script lang="ts">
	import { cart } from '$lib/stores/cart.svelte.ts';
	import { goto } from '$app/navigation';

	function addAndCheckout(lookupKey: string, tierId: string, interval: 'month' | 'year') {
		cart.addSubscription({ kind: 'subscription', lookupKey, tierId, interval, quantity: 1 });
		goto('/checkout');
	}
</script>

<!-- ... -->
<button onclick={() => addAndCheckout('plus_monthly', 'plus', 'month')}>
	Upgrade to Plus
</button>
```

The cart store persists via `sessionStorage`, so even if the user hard-refreshes on `/checkout`, their selection survives.

## Step 6 — Use it in the checkout layout

`src/routes/checkout/+layout.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import CartSidebar from '$lib/components/CartSidebar.svelte';
	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<div class="checkout-grid">
	<main>
		{@render children()}
	</main>
	<CartSidebar catalog={data.catalog} />
</div>

<style>
	.checkout-grid {
		display: grid;
		grid-template-columns: 1fr 22rem;
		gap: 2.5rem;
		max-width: 72rem;
		margin: 2rem auto;
		padding: 0 1.5rem;
	}
	@media (max-width: 860px) {
		.checkout-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
```

The catalog is loaded server-side (see Module 7.2 `listTiers`) and passed via the layout loader — freshest prices on every checkout.

## Step 7 — Guard the checkout route

If the cart is empty and someone lands on `/checkout` directly, bounce them to `/pricing`. The guard lives on the client because the cart is client-only state:

```svelte
<!-- src/routes/checkout/+page.svelte -->
<script lang="ts">
	import { cart } from '$lib/stores/cart.svelte.ts';
	import { goto } from '$app/navigation';

	$effect(() => {
		if (cart.isEmpty) {
			goto('/pricing', { replaceState: true });
		}
	});

	// ... rest of the page ...
</script>
```

`replaceState: true` means the user's back button takes them to wherever they were before `/pricing`, not back to `/checkout`.

## Verify

- Click Upgrade to Plus on `/pricing` → lands on `/checkout` with the cart sidebar showing Plus, $10.00/month, recurring total $10.00/month.
- Refresh the `/checkout` page → cart survives; sidebar still shows Plus.
- Open DevTools → Application → Session Storage → see the `contactly.cart` key.
- Close the tab and open a new one → `/checkout` redirects to `/pricing` (empty cart).
- Click Upgrade to Plus, then back to `/pricing`, click Upgrade to Pro → only Pro in the cart (swap, not append).

## Common traps

- **Using `localStorage` instead of `sessionStorage`.** Stale carts across days — users return to last week's $10 monthly subscription, click Pay, find out the price changed. Support-ticket generator.
- **Plain `.ts` for the store file.** `$state` requires `.svelte.ts`. Silent failure: state isn't reactive.
- **Recomputing totals on every render.** Move `priceCart` into `$derived`, not inline in the template. `$derived` memoises until inputs change.
- **Server-trusting client-derived totals.** Never bill from the client's price. When the PaymentIntent is created (E.4), recompute prices server-side and reject if they don't match.
- **Forgetting the `replaceState` on cart-empty redirect.** Without it, the user's back button takes them back to `/checkout`, which redirects them right back to `/pricing`. Navigation loop.

## Recap

Cart store with `sessionStorage` persistence, pure pricing function, 80-line sidebar component rendering the canonical Simpler Trading layout. The data model is sound; the UI reads from it; the server will validate it at checkout. Next: the stepper that drives the user from sign-in to payment.

Next: [E.3 The three-step checkout stepper →](./E.3-checkout-stepper.md)
