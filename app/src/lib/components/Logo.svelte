<script lang="ts">
	interface Props {
		size?: number;
		withText?: boolean;
		class?: string;
	}

	let { size = 32, withText = true, class: className = '' }: Props = $props();
</script>

<a href="/" class="group inline-flex items-center gap-2.5 {className}">
	<span
		class="relative inline-flex items-center justify-center rounded-[0.55rem] bg-brand-500 text-white shadow-[0_6px_18px_-6px_var(--color-brand-500)] transition-transform group-hover:scale-[1.03]"
		style="width: {size}px; height: {size}px;"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size * 0.58}
			height={size * 0.58}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
			<circle cx="12" cy="7" r="4" />
		</svg>
	</span>
	{#if withText}
		<span class="text-xl font-semibold tracking-tight">Contactly</span>
	{/if}
</a>
