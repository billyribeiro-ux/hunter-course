<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'class'> {
		label?: string;
		hint?: string;
		error?: string;
		class?: string;
	}

	let { label, hint, error, class: className, id, ...rest }: Props = $props();

	const inputId = id ?? `input-${crypto.randomUUID()}`;
</script>

<div class={cn('flex flex-col gap-1.5', className)}>
	{#if label}
		<label for={inputId} class="text-sm font-medium text-fg">{label}</label>
	{/if}
	<input
		id={inputId}
		class={cn(
			'h-10 w-full rounded-[var(--radius-control)] border bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors',
			error
				? 'border-danger focus:border-danger'
				: 'border-border-subtle focus:border-brand-400 focus:bg-surface-1'
		)}
		aria-invalid={!!error}
		aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
		{...rest}
	/>
	{#if error}
		<p id="{inputId}-error" class="text-xs text-danger">{error}</p>
	{:else if hint}
		<p id="{inputId}-hint" class="text-xs text-fg-subtle">{hint}</p>
	{/if}
</div>
