<script lang="ts">
	import PricingCard from '$lib/components/PricingCard.svelte';
	import { PRICING_ORDERED, type Interval } from '$lib/config/pricing';
	import { getPricing } from './pricing.remote';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	let interval = $state<Interval>('month');

	function amountFor(tier: string, i: Interval, prices: Awaited<ReturnType<typeof getPricing>>) {
		return prices.find((p) => p.tier === tier && p.interval === i)?.unit_amount ?? null;
	}
</script>

<section class="hero-glow pb-6 pt-20">
	<div class="mx-auto max-w-3xl px-6 text-center">
		<p class="text-sm font-medium uppercase tracking-wide text-brand-400">Pricing</p>
		<h1 class="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
			Choose what works for you
		</h1>
		<p class="mx-auto mt-4 max-w-xl text-fg-muted">
			Contactly offers flexible pricing plans to cater to the unique needs of your
			business. Choose from our range of affordable options and get started today.
		</p>

		<div class="mt-8 inline-flex rounded-full border border-border-subtle bg-surface-1 p-1">
			<button
				type="button"
				onclick={() => (interval = 'month')}
				class="h-8 rounded-full px-5 text-sm font-medium transition-colors {interval === 'month'
					? 'bg-brand-500 text-white'
					: 'text-fg-muted hover:text-fg'}"
			>
				Monthly
			</button>
			<button
				type="button"
				onclick={() => (interval = 'year')}
				class="h-8 rounded-full px-5 text-sm font-medium transition-colors {interval === 'year'
					? 'bg-brand-500 text-white'
					: 'text-fg-muted hover:text-fg'}"
			>
				Yearly
			</button>
		</div>
	</div>
</section>

<section class="mx-auto max-w-6xl px-6 pb-24 pt-8">
	{#await getPricing()}
		<div class="grid gap-6 md:grid-cols-3">
			{#each PRICING_ORDERED as tier (tier.tier)}
				<div class="card h-[480px] animate-pulse opacity-50"></div>
			{/each}
		</div>
	{:then prices}
		<div class="grid gap-6 md:grid-cols-3">
			{#each PRICING_ORDERED as tier (tier.tier)}
				<PricingCard
					{tier}
					{interval}
					amount={amountFor(tier.tier, interval, prices)}
					isCurrent={data.currentTier === tier.tier}
					signedIn={!!data.user}
				/>
			{/each}
		</div>
	{/await}
</section>
