# E.6 — Optimistic UI for Contacts

> Treat the server's "yes" as assumed. Update the UI first, reconcile on response, roll back only on failure.

## Why this matters

Click "Add contact." Nothing happens for 250ms. Then the new row slides in. That pause is the single most noticeable UX flaw in most CRUD apps — and it's free to fix.

Optimistic UI assumes success: append the contact immediately, mark it pending visually if you want, and reconcile when the server responds. Users experience zero latency on the happy path (which is 99% of the time) and still get a sensible error if the server rejects.

This lesson adds optimistic create / delete to Contactly. The create form becomes instant; undo for delete becomes coherent; failures still get handled.

## The Principal Engineer lens

**Optimism is only safe when the server's answer is almost-always predictable.** Add contact: yes. Delete contact: yes. Upgrade subscription: *no* — too much server-side logic we don't want to guess. Know the difference. Default to pessimistic for anything touching money, identity, or shared state.

Corollary: **reconciliation is the whole game.** An optimistic UI that rolls back only on errors is easy. Rolling back gracefully — without flicker, without lost data, without confusing the user — is the hard part. Invest in that.

## Step 1 — The local state, before and after

`src/routes/(app)/contacts/+page.svelte` today looks something like:

```svelte
<script lang="ts">
	import { listContacts, createContact } from '$lib/remote/contacts.remote.ts';
	let { data } = $props();
	let contacts = $state(data.contacts);

	async function onSubmit(formData: FormData) {
		const result = await createContact(formData);
		if (result.ok) {
			contacts = [result.contact, ...contacts];
		}
	}
</script>
```

Pessimistic: we wait for the server, then render. Swap the order:

```svelte
<script lang="ts">
	import { listContacts, createContact } from '$lib/remote/contacts.remote.ts';
	import { toasts } from '$lib/stores/toasts.svelte.ts';
	import type { Contact } from '$lib/shared/contact-types';

	let { data } = $props();

	interface PendingContact extends Contact {
		pending: true;
		clientId: string;
	}

	// Server data stays reactive; optimistic rows live in a separate overlay.
	let serverContacts = $derived(data.contacts as Contact[]);
	let pending = $state<PendingContact[]>([]);

	let contacts = $derived<(Contact | PendingContact)[]>([...pending, ...serverContacts]);

	async function onSubmit(formData: FormData) {
		const clientId = crypto.randomUUID();
		const optimistic: PendingContact = {
			id: clientId, // temporary; replaced by the server row on success
			name: formData.get('name') as string,
			email: formData.get('email') as string,
			createdAt: new Date().toISOString(),
			pending: true,
			clientId
		};
		pending = [optimistic, ...pending];

		const result = await createContact(formData);
		if (result.ok) {
			// Server now owns this row; drop the optimistic placeholder.
			pending = pending.filter((c) => c.clientId !== clientId);
		} else {
			pending = pending.filter((c) => c.clientId !== clientId);
			toasts.error(result.error);
		}
	}
</script>

{#each contacts as contact (contact.id)}
	<ContactRow {contact} pending={'pending' in contact && contact.pending} />
{/each}
```

Why a derived overlay instead of one mutable `$state` array seeded from `data.contacts`? Seeding `$state` directly from a prop only captures the *initial* value — when `createContact().refresh()` revalidates the server data, a one-time-seeded array would go stale (Svelte even warns about this: `state_referenced_locally`). Keeping `serverContacts` as `$derived(data.contacts)` means it always reflects the latest server truth; the optimistic row lives in a separate `pending` array and the rendered list is a `$derived` merge of the two. The row is visible instantly. When the server confirms, we drop the placeholder and the refreshed server row takes its place — no ID swap, no flicker. On failure, the placeholder is removed and a toast explains why.

## Step 2 — The pending visual

`ContactRow.svelte` gets an optional `pending` prop:

```svelte
<script lang="ts">
	let { contact, pending = false }: { contact: Contact; pending?: boolean } = $props();
</script>

<article class="row" class:pending>
	<h3>{contact.name}</h3>
	<p>{contact.email}</p>
</article>

<style>
	.row.pending {
		opacity: 0.6;
		animation: pulse 1.4s ease-in-out infinite;
	}
	@keyframes pulse {
		50% { opacity: 0.9; }
	}
</style>
```

Subtle — the user notices the subtle fade but mostly experiences the immediate render. Pending state should feel like "this is happening," not "something's broken."

## Step 3 — Optimistic delete with undo

Deletes are higher-stakes — an errant click deletes the wrong contact — but optimism pairs perfectly with an undo toast.

```ts
async function deleteContactOptimistic(contact: Contact) {
	const removed = contact;
	const originalIndex = contacts.findIndex((c) => c.id === contact.id);
	contacts = contacts.filter((c) => c.id !== contact.id);

	// Toast with undo action, 5-second window
	const undoId = toasts.pushWithAction({
		kind: 'info',
		message: `Deleted "${removed.name}".`,
		action: { label: 'Undo', onClick: undo },
		timeoutMs: 5000
	});

	let undone = false;

	function undo() {
		undone = true;
		contacts = [
			...contacts.slice(0, originalIndex),
			removed,
			...contacts.slice(originalIndex)
		];
		toasts.dismiss(undoId);
	}

	// Wait for the toast window before issuing the real delete
	await new Promise((resolve) => setTimeout(resolve, 5000));

	if (undone) return;

	const result = await deleteContact(removed.id);
	if (!result.ok) {
		// Restore and warn
		contacts = [
			...contacts.slice(0, originalIndex),
			removed,
			...contacts.slice(originalIndex)
		];
		toasts.error(`Could not delete "${removed.name}".`);
	}
}
```

Key idea: delete *from the UI* immediately, wait the undo window, then — only if the user didn't press Undo — issue the actual server delete. This avoids the "delete + recreate" pattern which burns IDs and creates audit-log noise.

## Step 4 — Extend the toast store for actions

The Module 13.1 toast store didn't support actions. Add support:

```ts
// src/lib/stores/toasts.svelte.ts (extend the Toast interface)
export interface Toast {
	id: string;
	kind: ToastKind;
	message: string;
	timeoutMs: number;
	action?: { label: string; onClick: () => void };
}

// In the store:
function pushWithAction(args: {
	kind: ToastKind;
	message: string;
	action: { label: string; onClick: () => void };
	timeoutMs?: number;
}): string {
	const id = crypto.randomUUID();
	toasts = [...toasts, { id, ...args, timeoutMs: args.timeoutMs ?? 5000 }];
	if (args.timeoutMs ?? 5000 > 0) setTimeout(() => dismiss(id), args.timeoutMs ?? 5000);
	return id;
}

return {
	// ... existing ...
	pushWithAction
};
```

And in `Toaster.svelte`, render the action button:

```svelte
{#if toast.action}
	<button class="action" onclick={() => { toast.action!.onClick(); toasts.dismiss(toast.id); }}>
		{toast.action.label}
	</button>
{/if}
```

## Step 5 — When optimism is the wrong answer

Don't optimistically render for:

- **Financial operations.** Upgrade/downgrade subscription, charge a card. The server's answer is canonical and users want confirmation.
- **Cross-user operations.** Sharing a contact with another user requires their record to be modified. Race-condition hell if you optimistic-update both sides.
- **Anything with ambiguous success criteria.** If "success" depends on server state (quota check, uniqueness constraint), the optimistic guess might be wrong more often than right.

A good heuristic: if the server can reject for reasons you can't predict locally, stay pessimistic.

## Step 6 — Tests

Playwright, in `tests/contacts-optimistic.spec.ts`:

```ts
test('new contact appears instantly', async ({ page }) => {
	await page.goto('/app');
	await page.getByRole('button', { name: 'New contact' }).click();
	await page.getByLabel('Name').fill('Ada');
	await page.getByLabel('Email').fill('ada@example.com');

	// Watch for the row to appear - should be <50ms regardless of network
	const [row] = await Promise.all([
		page.waitForSelector('[data-testid="contact-row"]:has-text("Ada")'),
		page.getByRole('button', { name: 'Save' }).click()
	]);

	expect(row).toBeTruthy();
	// And it should have a pending class initially
	expect(await row.getAttribute('class')).toContain('pending');
});

test('delete can be undone', async ({ page }) => {
	await page.goto('/app');
	const row = page.getByTestId('contact-row').first();
	const name = await row.getByRole('heading').textContent();

	await row.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByText(`Deleted "${name}"`)).toBeVisible();
	await page.getByRole('button', { name: 'Undo' }).click();

	await expect(row.getByRole('heading', { name: name! })).toBeVisible();
});
```

## Verify

- Adding a contact shows the row instantly, with a subtle pending pulse.
- After ~100ms, the pulse disappears (server responded).
- Triggering a server error (simulate via network-throttle or a forced 500) restores the previous state and shows an error toast.
- Deleting a contact removes it instantly; pressing Undo restores it without hitting the server.
- Letting the undo toast expire: the delete commits server-side.

## Common traps

- **Using server IDs before the server responds.** Generate a `clientId` for optimistic rows; swap on confirmation.
- **Forgetting to keep `{#each}` keyed by a stable key.** If you use array index, the optimistic row and the real row get confused and rendering glitches.
- **Skipping the error path.** Optimism without rollback is a data-corruption vector — the UI shows the action succeeded, the server rejected it, they silently diverge until the next fetch.
- **Optimistic updates on stale data.** If the user's list is 5 minutes old and contains rows since deleted server-side, optimistic updates on those rows might succeed visually but fail in reality. Pair with periodic refresh or `invalidateAll` after writes.
- **Mixing optimism and undo without the delay.** Undo only works if we defer the real delete until after the window. Otherwise "Undo" becomes "Create a new row with the old data" — different audit trail, breaks any server-side `deleted_at` logic.

## Recap

One optimistic pattern; clean rollback on failure; undo for deletes. Contactly now *feels* instant on every write. Users won't notice; that's the point.

Next: [E.7 CSV import for contacts →](./E.7-csv-import.md)
