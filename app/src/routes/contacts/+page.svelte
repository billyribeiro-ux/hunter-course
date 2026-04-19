<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import ContactModal from '$lib/components/ContactModal.svelte';
	import ContactCard from '$lib/components/ContactCard.svelte';
	import UpgradeCTA from '$lib/components/UpgradeCTA.svelte';
	import { getContacts } from './contacts.remote';
	import type { Database } from '$lib/types/database.types';
	import type { PageData } from './$types';

	type Contact = Database['public']['Tables']['contacts']['Row'];

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let editing = $state<Contact | null>(null);
	let creating = $state(false);

	function startCreate() {
		editing = null;
		creating = true;
	}

	function startEdit(c: Contact) {
		creating = false;
		editing = c;
	}

	function closeModal() {
		creating = false;
		editing = null;
	}
</script>

<section class="mx-auto max-w-5xl px-6 pb-24 pt-12">
	<header class="flex items-end justify-between gap-4 pb-6">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Your contacts</h1>
			<p class="mt-1 text-sm text-fg-muted">
				{data.limit === Infinity
					? 'Unlimited contacts on your plan.'
					: `${data.count} of ${data.limit} contacts used on the ${data.tier} plan.`}
			</p>
		</div>
		<Button onclick={startCreate} disabled={data.count >= data.limit}>+ New contact</Button>
	</header>

	{#if data.count >= data.limit && data.limit !== Infinity}
		<UpgradeCTA
			message={`You've hit your ${data.tier}-plan limit of ${data.limit} contacts.`}
		/>
	{/if}

	{#await getContacts()}
		<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
				<div class="card h-32 animate-pulse opacity-50"></div>
			{/each}
		</div>
	{:then contacts}
		{#if contacts.length === 0}
			<div class="card flex flex-col items-center justify-center gap-3 p-16 text-center">
				<p class="text-fg-muted">No contacts yet.</p>
				<Button onclick={startCreate}>Add your first contact</Button>
			</div>
		{:else}
			<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
				{#each contacts as contact (contact.id)}
					<ContactCard {contact} onEdit={() => startEdit(contact)} />
				{/each}
			</div>
		{/if}
	{/await}
</section>

{#if creating || editing}
	<ContactModal contact={editing} onClose={closeModal} />
{/if}
