<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	interface BaseProps {
		variant?: Variant;
		size?: Size;
		loading?: boolean;
		full?: boolean;
		children: Snippet;
		class?: string;
	}

	type Props =
		| (BaseProps & { href: string } & Omit<HTMLAnchorAttributes, 'class' | 'children'>)
		| (BaseProps & { href?: undefined } & Omit<HTMLButtonAttributes, 'class' | 'children'>);

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		full = false,
		href,
		children,
		class: className,
		...rest
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-50';

	const sizes: Record<Size, string> = {
		sm: 'h-8 px-3 text-sm rounded-[0.5rem]',
		md: 'h-10 px-4 text-sm rounded-[var(--radius-control)]',
		lg: 'h-12 px-6 text-base rounded-[var(--radius-control)]'
	};

	const variants: Record<Variant, string> = {
		primary:
			'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-[0_4px_14px_-4px_var(--color-brand-500)]',
		secondary:
			'bg-surface-2 text-fg hover:bg-surface-3 border border-border-subtle',
		ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
		danger: 'bg-danger text-white hover:brightness-110'
	};

	let classes = $derived(
		cn(base, sizes[size], variants[variant], full && 'w-full', className)
	);
</script>

{#if href}
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>
		{#if loading}
			<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="4" />
				<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
			</svg>
		{/if}
		{@render children()}
	</a>
{:else}
	<button class={classes} disabled={loading || (rest as HTMLButtonAttributes).disabled} {...rest as HTMLButtonAttributes}>
		{#if loading}
			<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="4" />
				<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
			</svg>
		{/if}
		{@render children()}
	</button>
{/if}
