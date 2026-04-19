<script lang="ts">
	import { toast, type ToastKind } from '$lib/toast.svelte';

	const kindStyles: Record<ToastKind, string> = {
		success: 'border-success/40 bg-success/10 text-success',
		error: 'border-danger/40 bg-danger/10 text-danger',
		info: 'border-brand-400/40 bg-brand-500/10 text-brand-300'
	};
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
	aria-live="polite"
	aria-atomic="true"
>
	{#each toast.items as item (item.id)}
		<div
			class="pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-[var(--shadow-pop)] backdrop-blur-md {kindStyles[item.kind]}"
			role="status"
		>
			<span>{item.message}</span>
			<button
				type="button"
				onclick={() => toast.dismiss(item.id)}
				class="text-current/70 hover:text-current"
				aria-label="Dismiss notification"
			>
				&times;
			</button>
		</div>
	{/each}
</div>
