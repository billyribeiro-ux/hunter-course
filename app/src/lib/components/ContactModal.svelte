<script lang="ts">
	import Button from './Button.svelte';
	import Input from './Input.svelte';
	import { createContact, updateContact } from '../../routes/contacts/contacts.remote';
	import { toast } from '$lib/toast.svelte';
	import type { Database } from '$lib/types/database.types';

	type Contact = Database['public']['Tables']['contacts']['Row'];

	interface Props {
		contact: Contact | null;
		onClose: () => void;
	}

	let { contact, onClose }: Props = $props();
	let editing = $derived(contact !== null);
	let formRef = editing ? updateContact.for(contact!.id) : createContact;

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKey} />

<div
	role="dialog"
	aria-modal="true"
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
	onclick={handleBackdrop}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	tabindex="-1"
>
	<div class="card w-full max-w-md p-6 shadow-[var(--shadow-pop)]">
		<div class="mb-5 flex items-start justify-between">
			<div>
				<h2 class="text-lg font-semibold">{editing ? 'Edit contact' : 'New contact'}</h2>
				<p class="mt-1 text-sm text-fg-muted">
					{editing ? 'Save changes when you\'re ready.' : 'Add someone to your contact list.'}
				</p>
			</div>
			<button
				onclick={onClose}
				class="rounded-full p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
				aria-label="Close"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>

		<form
			{...formRef.enhance(async ({ submit, form }) => {
				try {
					const res = await submit();
					if (res?.error) {
						toast.error(res.error);
					} else {
						toast.success(editing ? 'Contact updated.' : 'Contact created.');
						form.reset();
						onClose();
					}
				} catch {
					toast.error('Something went wrong.');
				}
			})}
			class="flex flex-col gap-4"
		>
			{#if editing}
				<input type="hidden" {...formRef.fields.id.as('text', contact!.id)} />
			{/if}
			<Input label="Name" {...formRef.fields.name.as('text', contact?.name ?? '')} />
			<Input label="Email" type="email" {...formRef.fields.email.as('email', contact?.email ?? '')} />
			<Input label="Phone" {...formRef.fields.phone.as('text', contact?.phone ?? '')} />

			<label class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-fg">Notes</span>
				<textarea
					{...formRef.fields.notes.as('text', contact?.notes ?? '')}
					rows="3"
					class="rounded-[var(--radius-control)] border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:bg-surface-1"
				></textarea>
			</label>

			<div class="mt-2 flex justify-end gap-2">
				<Button variant="ghost" onclick={onClose} type="button">Cancel</Button>
				<Button type="submit" loading={!!formRef.pending}>
					{editing ? 'Save changes' : 'Create contact'}
				</Button>
			</div>
		</form>
	</div>
</div>
