<script lang="ts">
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		data: { user: import('@supabase/supabase-js').User | null };
		children: Snippet;
	}

	let { data, children }: Props = $props();
</script>

<div class="flex min-h-screen flex-col">
	<Nav user={data.user} />
	<main class="flex-1">
		{@render children()}
	</main>
	<footer class="border-t border-border-subtle py-8 text-center text-sm text-fg-subtle">
		<p>Built with SvelteKit remote functions, Supabase, and Stripe.</p>
	</footer>
</div>

<Toast />
