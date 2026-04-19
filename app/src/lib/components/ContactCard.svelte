<script lang="ts">
	import { deleteContact } from '../../routes/contacts/contacts.remote';
	import { toast } from '$lib/toast.svelte';
	import type { Database } from '$lib/types/database.types';

	type Contact = Database['public']['Tables']['contacts']['Row'];

	interface Props {
		contact: Contact;
		onEdit: () => void;
	}

	let { contact, onEdit }: Props = $props();
	let confirming = $state(false);
	let busy = $state(false);

	async function doDelete() {
		busy = true;
		try {
			await deleteContact(contact.id);
			toast.success(`Deleted ${contact.name}`);
		} catch {
			toast.error('Could not delete contact.');
		} finally {
			busy = false;
			confirming = false;
		}
	}

	let initials = $derived(
		contact.name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);
</script>

<div class="card flex flex-col p-5">
	<div class="flex items-start gap-3">
		<span class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/15 text-brand-400 font-medium">
			{initials}
		</span>
		<div class="min-w-0 flex-1">
			<p class="truncate font-medium">{contact.name}</p>
			{#if contact.email}
				<p class="truncate text-sm text-fg-muted">{contact.email}</p>
			{/if}
			{#if contact.phone}
				<p class="truncate text-sm text-fg-subtle">{contact.phone}</p>
			{/if}
		</div>
	</div>

	{#if contact.notes}
		<p class="mt-3 line-clamp-2 text-sm text-fg-muted">{contact.notes}</p>
	{/if}

	<div class="mt-4 flex gap-2">
		<button
			type="button"
			onclick={onEdit}
			class="flex-1 rounded-[var(--radius-control)] border border-border-subtle py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
		>
			Edit
		</button>
		{#if confirming}
			<button
				type="button"
				onclick={doDelete}
				disabled={busy}
				class="flex-1 rounded-[var(--radius-control)] bg-danger py-1.5 text-sm text-white transition-colors hover:brightness-110 disabled:opacity-50"
			>
				{busy ? 'Deleting…' : 'Confirm delete'}
			</button>
			<button
				type="button"
				onclick={() => (confirming = false)}
				class="rounded-[var(--radius-control)] border border-border-subtle px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
			>
				Cancel
			</button>
		{:else}
			<button
				type="button"
				onclick={() => (confirming = true)}
				class="rounded-[var(--radius-control)] border border-border-subtle px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
			>
				Delete
			</button>
		{/if}
	</div>
</div>
