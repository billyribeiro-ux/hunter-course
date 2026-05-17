# E.13 — Realtime Contact Sync

> Supabase Realtime over a Postgres `CHANGES` channel, scoped by RLS, reconciled into a Svelte 5 `$state` list — so a contact added on your phone appears on your laptop without a refresh.

## Why this matters

A user has Contactly open on two tabs. They add a contact in one. The other tab is now lying — it shows stale data until a manual refresh. For a contacts app that's a papercut; for anything collaborative it's a dealbreaker.

Realtime closes the gap: the server pushes row changes to every subscribed client, and the UI reconciles them in place. The hard part isn't the subscription — it's doing the reconciliation without races, leaks, or the security hole of broadcasting one user's rows to another.

## The Principal Engineer lens

**A realtime channel is an open socket you are responsible for closing.** Every subscription is a resource with a lifecycle that must be tied to a component's lifecycle. The classic bug isn't "realtime doesn't work" — it's "realtime works, then the user navigates away ten times, and now there are ten dead channels and the tab is using 400 MB."

Corollary: **the database, not the channel config, enforces who sees what.** Supabase Realtime respects RLS on the `postgres_changes` stream *only if you enable it*. A realtime feature shipped without verifying RLS-on-replication is a feature that streams every user's contacts to every connected client. Verify it explicitly; never assume.

## Step 1 — Enable replication with RLS

Realtime needs the table added to the `supabase_realtime` publication, and — critically — RLS enforced on the replication stream.

```sql
-- supabase/migrations/20260516000000_contacts_realtime.sql
alter publication supabase_realtime add table public.contacts;
```

Then in the Supabase dashboard → **Database → Replication → `supabase_realtime`** → confirm `contacts` is listed, and under **Realtime settings** ensure **"Enable RLS for Realtime"** is on. With it on, the same `auth.uid() = user_id` policy from Module 4.1 filters the change stream — a client only ever receives rows it could already `SELECT`.

This is the security checkpoint. Do not skip the dashboard verification.

## Step 2 — A realtime store keyed to the user

The subscription, the reconciliation, and the lifecycle live in one `.svelte.ts` factory. It takes an initial list (from the existing query) and keeps it live.

```ts
// src/lib/stores/liveContacts.svelte.ts
import { browser } from '$app/environment';
import { getSupabaseClient } from '$lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Contact {
	id: string;
	full_name: string;
	email: string | null;
	avatar_path: string | null;
	created_at: string;
}

export function createLiveContacts(userId: string, initial: Contact[]) {
	let contacts = $state<Contact[]>(initial);

	function upsert(row: Contact) {
		const i = contacts.findIndex((c) => c.id === row.id);
		if (i === -1) {
			contacts = [row, ...contacts];
		} else {
			contacts = contacts.map((c) => (c.id === row.id ? row : c));
		}
	}

	function remove(id: string) {
		contacts = contacts.filter((c) => c.id !== id);
	}

	function subscribe(): () => void {
		if (!browser) return () => {};
		const supabase = getSupabaseClient();

		const channel: RealtimeChannel = supabase
			.channel(`contacts:${userId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'contacts',
					filter: `user_id=eq.${userId}`
				},
				(payload) => {
					if (payload.eventType === 'DELETE') {
						remove((payload.old as { id: string }).id);
					} else {
						upsert(payload.new as Contact);
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}

	return {
		get contacts() {
			return contacts;
		},
		subscribe
	};
}
```

`subscribe()` returns its own teardown — the same self-cleaning contract as the attachment in E.12. The `filter: user_id=eq.${userId}` is defence in depth on top of RLS-on-replication: belt *and* braces, because a streamed row leak is silent.

## Step 3 — Wire it with a single `$effect`

The component creates the store from server data and ties the subscription to its lifecycle with one effect.

```svelte
<!-- src/routes/(app)/contacts/LiveContactList.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { createLiveContacts, type Contact } from '$lib/stores/liveContacts.svelte.ts';
	import ContactRow from './ContactRow.svelte';

	interface Props {
		userId: string;
		initial: Contact[];
	}
	let { userId, initial }: Props = $props();

	// Seed the live store once from the initial server data. `untrack`
	// states the one-time capture is deliberate (mount this component
	// under {#key userId} so a new user gets a fresh store).
	const live = untrack(() => createLiveContacts(userId, initial));

	$effect(() => {
		// subscribe() returns the teardown; returning it from $effect
		// means Svelte calls it on unmount or before re-run.
		return live.subscribe();
	});
</script>

<ul class="divide-y divide-border-1 rounded-xl border border-border-1">
	{#each live.contacts as c (c.id)}
		<li><ContactRow contact={c} /></li>
	{:else}
		<li class="p-6 text-center text-sm text-text-2">No contacts yet.</li>
	{/each}
</ul>
```

This is the whole integration. `$effect` returning `live.subscribe()` (which itself returns the channel teardown) means the socket opens on mount and closes on unmount — automatically, every time, including hot-reload during dev. There is no `onMount`/`onDestroy` pair to keep in sync.

Two deliberate choices the Svelte compiler will ask you about:

- **`untrack(() => createLiveContacts(...))`.** Seeding a store from a prop at component top level triggers Svelte's `state_referenced_locally` warning — it's reminding you that a plain read captures only the *initial* value. Here that's exactly what we want: the socket, not the prop, keeps the list live afterwards. `untrack` makes that intent explicit. Mount this component under `{#key userId}` so switching users tears down the old store and socket and builds a fresh one.
- **`subscribe()` inside `$effect`.** The autofixer flags "function called in `$effect`" as a heuristic. It doesn't apply: `subscribe()` sets up a socket and returns a teardown — the canonical effect shape — not a synchronous state reassignment.

## Step 4 — Reconcile, don't replace

Note what `upsert`/`remove` do *not* do: they never blow away the whole list and refetch. An INSERT prepends one row; an UPDATE maps one row; a DELETE filters one row. The user's scroll position, selection, and any optimistic rows from E.6 survive. Full-refetch-on-any-change is the lazy version and it visibly janks.

The keyed `{#each ... (c.id)}` is what makes this cheap: Svelte diffs by `id` and touches only the changed `<li>`.

## Step 5 — Compose with optimistic UI (E.6)

E.6 added an optimistic placeholder on create. Realtime will *also* deliver that same INSERT a beat later. Without care you get a flash of two rows. The fix is already in place: the optimistic row uses a temporary `clientId`; the realtime row arrives with the real `id`. Drop the placeholder when its server row arrives:

```ts
// in the optimistic create handler, after the server confirms:
pending = pending.filter((p) => p.clientId !== clientId);
// the realtime INSERT (or the create() return) supplies the canonical row
```

Because the canonical row flows in through the same `upsert`, and the placeholder is removed by `clientId`, there's never a duplicate — the realtime path and the optimistic path converge on one row keyed by the real `id`.

## Step 6 — Handle reconnects

Sockets drop: laptop sleeps, wifi flips, tunnel hiccups. Supabase auto-reconnects, but rows changed *during* the gap were missed. The robust pattern: on `SUBSCRIBED` (including re-subscribe after a drop), re-run the base query once to resync, then resume streaming.

```ts
// extend the .subscribe() callback
.subscribe((status) => {
	if (status === 'SUBSCRIBED') {
		// onResync() refetches page 1 and replaces the head of the list
		onResync?.();
	}
});
```

Pass an `onResync` callback into `createLiveContacts` that calls the existing `getContacts`/`pageContacts` query. Realtime is an optimisation over polling, not a guarantee of perfect delivery — a resync-on-reconnect makes it correct, not just fast.

## Verify

- Open Contactly in two tabs. Add a contact in tab A → it appears in tab B within ~1 s, no refresh.
- Edit a contact in tab A → tab B's row updates in place; scroll position unchanged.
- Delete in tab A → row vanishes from tab B.
- Open devtools → Network → WS: exactly one realtime socket. Navigate away and back five times → still exactly one (no leaked channels).
- Sign in as user B in another browser; add a contact as user A → user B receives nothing (RLS-on-replication verified).
- Put the laptop to sleep, add a contact elsewhere, wake it → the missed row appears after the reconnect resync.

## Common traps

- **RLS-on-replication left off.** The default in some setups streams *all* rows. Every client gets every user's contacts. Verify in the dashboard, then verify again with a second account.
- **Subscribing in `onMount` without unsubscribing.** Each navigation leaks a channel; memory and socket count climb until the tab dies. Tie it to `$effect`'s return.
- **Refetching the entire list on every change event.** Works, janks, wastes bandwidth, fights optimistic UI. Reconcile per-row.
- **Unkeyed `{#each}`.** Without `(c.id)` Svelte can't diff; a single update re-renders and flickers the whole list.
- **Assuming delivery is guaranteed.** It isn't — reconnects drop events. The `SUBSCRIBED` resync is what makes realtime *correct* rather than merely *usually correct*.
- **One channel name shared across users.** `channel('contacts')` collides across sessions in the same browser profile. Scope the name: `contacts:${userId}`.

## Recap

Replication enabled with RLS, a user-scoped channel, per-row reconciliation into `$state`, lifecycle tied to a single `$effect`, optimistic-UI convergence by id, and a resync-on-reconnect for correctness. Two tabs now agree without anyone pressing refresh — and exactly one socket is doing the work.

Next: [E.14 Audit log →](./E.14-audit-log.md)
