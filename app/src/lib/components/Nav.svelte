<script lang="ts">
	import { page } from '$app/state';
	import type { User } from '@supabase/supabase-js';
	import Logo from './Logo.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import Button from './Button.svelte';

	interface Props {
		user: User | null;
	}

	let { user }: Props = $props();

	const links: ReadonlyArray<{ href: string; label: string; auth?: boolean }> = [
		{ href: '/', label: 'Home' },
		{ href: '/pricing', label: 'Pricing' },
		{ href: '/contacts', label: 'Contacts', auth: true }
	];

	let current = $derived(page.url.pathname);
</script>

<header class="sticky top-0 z-40 border-b border-border-subtle/80 bg-surface-0/80 backdrop-blur-md">
	<nav class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
		<Logo />

		<ul class="hidden items-center gap-1 md:flex">
			{#each links as link (link.href)}
				{#if !link.auth || user}
					{@const active = current === link.href}
					<li>
						<a
							href={link.href}
							class="rounded-full px-3 py-1.5 text-sm transition-colors {active
								? 'bg-surface-2 text-fg'
								: 'text-fg-muted hover:bg-surface-2 hover:text-fg'}"
						>
							{link.label}
						</a>
					</li>
				{/if}
			{/each}
		</ul>

		<div class="flex items-center gap-2">
			<ThemeToggle />
			{#if user}
				<Button href="/account" variant="secondary" size="sm">Account</Button>
			{:else}
				<Button href="/login" variant="ghost" size="sm">Login</Button>
				<Button href="/register" variant="primary" size="sm">Register</Button>
			{/if}
		</div>
	</nav>
</header>
