<script lang="ts">
	import Button from './Button.svelte';

	interface Props {
		message: string;
	}

	let { message }: Props = $props();
</script>

<div class="card mb-6 flex flex-wrap items-center justify-between gap-3 border-brand-400/30 bg-brand-500/5 p-4">
	<div class="flex items-center gap-3">
		<span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
		</span>
		<p class="text-sm text-fg">{message}</p>
	</div>
	<Button href="/pricing" size="sm">Upgrade plan</Button>
</div>
