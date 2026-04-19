<script lang="ts">
	import Button from './Button.svelte';
	import type { Interval, TierConfig } from '$lib/config/pricing';

	interface Props {
		tier: TierConfig;
		/** Unit amount in cents for the chosen interval, as loaded from billing_prices */
		amount: number | null;
		interval: Interval;
		/** Whether this is the user's current active subscription */
		isCurrent: boolean;
		/** Whether the user is signed in (otherwise CTAs route to /register) */
		signedIn: boolean;
	}

	let { tier, amount, interval, isCurrent, signedIn }: Props = $props();

	let priceDisplay = $derived(
		tier.tier === 'free'
			? '$0'
			: amount == null
				? '—'
				: `$${(amount / 100).toFixed(0)}`
	);

	let cadence = $derived(
		tier.tier === 'free' ? '/forever' : interval === 'month' ? '/month' : '/year'
	);

	let href = $derived(
		!signedIn ? '/register' : tier.tier === 'free' ? '/contacts' : `/api/checkout?tier=${tier.tier}&interval=${interval}`
	);
</script>

<div
	class="card relative flex flex-col p-8 transition-transform hover:-translate-y-0.5 {isCurrent
		? 'ring-2 ring-brand-400'
		: ''}"
>
	{#if isCurrent}
		<span class="absolute -top-3 right-6 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-medium text-white">
			Current plan
		</span>
	{/if}

	<h3 class="text-lg font-semibold">{tier.name}</h3>
	<p class="mt-1 text-sm text-fg-muted">{tier.tagline}</p>

	<div class="mt-6 flex items-baseline gap-1">
		<span class="text-5xl font-bold tracking-tight">{priceDisplay}</span>
		<span class="text-sm text-fg-muted">{cadence}</span>
	</div>

	<ul class="mt-7 space-y-3 text-sm">
		{#each tier.features as feature (feature.label)}
			<li class="flex items-center gap-2.5">
				{#if feature.included}
					<span class="inline-flex h-5 w-5 items-center justify-center rounded-[0.35rem] bg-success/20 text-success">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
					</span>
					<span>{feature.label}</span>
				{:else}
					<span class="inline-flex h-5 w-5 items-center justify-center rounded-[0.35rem] bg-danger/15 text-danger">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</span>
					<span class="text-fg-subtle line-through">{feature.label}</span>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="mt-8">
		<Button {href} full disabled={isCurrent}>
			{#if isCurrent}Active plan{:else}{tier.cta}{/if}
		</Button>
	</div>
</div>
