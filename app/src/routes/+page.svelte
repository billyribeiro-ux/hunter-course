<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<section class="hero-glow">
	<div class="mx-auto max-w-4xl px-6 pb-24 pt-24 text-center">
		<span class="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-1 px-3 py-1 text-xs text-fg-muted">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-success"></span>
			Principal Engineer Level 7+ · May 2026 Edition
		</span>
		<h1 class="text-5xl font-semibold tracking-tight md:text-6xl">
			Contacts,
			<span class="gradient-text">done right.</span>
		</h1>
		<p class="mx-auto mt-5 max-w-2xl text-lg text-fg-muted">
			Contactly is a lightweight contact-management SaaS demonstrating every
			piece of a production app — tiered pricing, free trials, granular access,
			and a real CI/CD pipeline — built with the May 2026 web stack.
		</p>
		<div class="mt-9 flex flex-wrap justify-center gap-3">
			{#if data.user}
				<Button href="/contacts" size="lg">Go to contacts</Button>
				<Button href="/pricing" variant="secondary" size="lg">See pricing</Button>
			{:else}
				<Button href="/register" size="lg">Get started free</Button>
				<Button href="/pricing" variant="secondary" size="lg">See pricing</Button>
			{/if}
		</div>
	</div>
</section>

<section class="mx-auto max-w-5xl px-6 pb-24">
	<div class="grid gap-6 md:grid-cols-3">
		{#each [
			{ title: 'Tiered pricing', body: 'Free, Plus, Pro — with gracefully restricted UI and upgrade CTAs, not hidden features.' },
			{ title: 'Free trials', body: 'Both with and without a payment method. Multi-trial abuse blocked.' },
			{ title: 'Self-service portal', body: 'Upgrade, downgrade, pause, or cancel — straight from Stripe Customer Portal.' }
		] as feature}
			<div class="card p-6">
				<h3 class="text-lg font-semibold">{feature.title}</h3>
				<p class="mt-2 text-sm text-fg-muted">{feature.body}</p>
			</div>
		{/each}
	</div>
</section>
