# E.12 — Cursor Pagination & Infinite Scroll

> Keyset pagination that stays O(log n) at page 10,000, an `IntersectionObserver` attachment, and a list that never double-loads or skips a row.

## Why this matters

`getContacts` currently does `select(...).limit(50)` — or worse, no limit at all. The first feels fine until a power user has 4,000 contacts and the page ships 4,000 rows on every load. The fix everyone reaches for — `OFFSET`/`LIMIT` pagination — is *also* wrong: `OFFSET 100000` makes Postgres scan and discard 100,000 rows on every page. It gets slower the deeper you go.

Keyset (cursor) pagination is the correct answer: each page is `WHERE (created_at, id) < (last_seen)` — index-backed, constant time, page 1 and page 10,000 cost the same.

## The Principal Engineer lens

**OFFSET pagination is a performance trap that hides until production.** It demos perfectly (page 2 is fast) and dies silently (page 500 times out for your most engaged user — the one you least want to lose). Choose the access pattern that's flat, not the one that's convenient.

Corollary: **a cursor must be stable and unique.** Paginating by `created_at` alone breaks the instant two rows share a timestamp — you skip one and duplicate another. The cursor is always `(sort_key, tiebreaker_primary_key)`. No exceptions.

## Step 1 — A keyset query

The cursor is the `(created_at, id)` of the last row the client has seen. Newest-first means "older than the cursor."

```ts
// add to src/routes/(app)/contacts/contacts.remote.ts
import * as v from 'valibot';

const PAGE = 30;

const CursorSchema = v.optional(
	v.object({
		// MUST be strictly validated: this value is interpolated into a
		// PostgREST `.or()` filter string below. An ISO 8601 timestamp
		// contains no `,` `(` `)` `.`-as-operator — the only characters
		// that could break out of the filter. `id` is uuid-validated for
		// the same reason. See the note after this block.
		createdAt: v.pipe(v.string(), v.isoTimestamp()),
		id: v.pipe(v.string(), v.uuid())
	})
);

export const pageContacts = query(CursorSchema, async (cursor) => {
	const event = getRequestEvent();
	const user = requireUser(event);

	let q = event.locals.supabase
		.from('contacts')
		.select('id, full_name, email, avatar_path, created_at')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE + 1); // fetch one extra to know if there's a next page

	if (cursor) {
		// (created_at, id) < (cursor.createdAt, cursor.id), newest-first
		q = q.or(
			`created_at.lt.${cursor.createdAt},` +
				`and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
		);
	}

	const { data, error } = await q;
	if (error) throw new Error(error.message);

	const hasMore = data.length > PAGE;
	const rows = hasMore ? data.slice(0, PAGE) : data;
	const last = rows.at(-1);

	return {
		rows,
		nextCursor: hasMore && last ? { createdAt: last.created_at, id: last.id } : null
	};
});
```

Three things make this correct, fast, and *safe*:

- **`limit(PAGE + 1)`** — fetching one extra row is how you know whether a "next page" exists without a second `count(*)` query (which would itself be O(n)).
- **The composite `or(...)`** — `created_at < X OR (created_at = X AND id < Y)`. This is the keyset predicate; it's exactly served by the `(user_id, created_at desc)` index from Module 4.1 (extend it to include `id` for the perfect tiebreak).
- **The cursor is a string built into a PostgREST filter — so it is a injection sink.** PostgREST's `.or()` argument is parsed: `,` separates terms, `()` groups, `.` separates `column.op.value`. An attacker who controls `createdAt` and can put a `,` or `)` in it can append filter terms — e.g. smuggle `,user_id.neq.<uuid>` to widen the result set past what the caller should see. The defence is **not** "RLS will save us" (RLS constrains rows, not which filter PostgREST parses); the defence is making the value structurally incapable of containing those metacharacters. `v.isoTimestamp()` guarantees `createdAt` matches `YYYY-MM-DDTHH:MM:SS(.sss)Z` — digits, `-`, `T`, `:`, `.`, `Z` only, no `,` `(` `)`. `v.uuid()` guarantees `id` is hex + hyphens. With both strictly validated, the interpolation is provably safe. *Never interpolate into a query-language string without proving the input alphabet excludes that language's metacharacters — "it's just a date" is how injection ships.*

## Step 2 — Extend the index for the tiebreaker

```sql
-- supabase/migrations/20260514000000_contacts_keyset_idx.sql
drop index if exists contacts_user_id_created_at_idx;
create index contacts_user_id_created_at_id_idx
  on public.contacts (user_id, created_at desc, id desc);
```

The index column order mirrors the query's `ORDER BY` exactly. Postgres walks the index forward from the cursor and stops after 31 rows — it never sorts, never scans the table.

## Step 3 — A reusable pagination store

The list, the cursor, and the loading state are one cohesive unit. A `.svelte.ts` factory keeps the component thin.

```ts
// src/lib/stores/paginated.svelte.ts
type Cursor = { createdAt: string; id: string } | undefined;

interface Page<T> {
	rows: T[];
	nextCursor: { createdAt: string; id: string } | null;
}

export function createPaginated<T>(fetchPage: (cursor: Cursor) => Promise<Page<T>>) {
	let rows = $state<T[]>([]);
	let cursor = $state<Cursor>(undefined);
	let done = $state(false);
	let loading = $state(false);
	let failed = $state(false);

	async function loadMore() {
		if (loading || done) return;
		loading = true;
		failed = false;
		try {
			const page = await fetchPage(cursor);
			rows = [...rows, ...page.rows];
			if (page.nextCursor) {
				cursor = page.nextCursor;
			} else {
				done = true;
			}
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	function reset() {
		rows = [];
		cursor = undefined;
		done = false;
		failed = false;
	}

	return {
		get rows() {
			return rows;
		},
		get done() {
			return done;
		},
		get loading() {
			return loading;
		},
		get failed() {
			return failed;
		},
		loadMore,
		reset
	};
}
```

`loadMore` is idempotent under concurrency: the `if (loading || done) return` guard means a scroll event firing twice (they always do) can't double-append a page.

## Step 4 — An `IntersectionObserver` attachment

Infinite scroll = "load more when a sentinel element scrolls into view." In Svelte 5 the idiomatic primitive for DOM lifecycle is an **attachment** — a function that runs when the element mounts and returns its own cleanup.

```ts
// src/lib/attachments/onVisible.ts
import type { Attachment } from 'svelte/attachments';

export function onVisible(callback: () => void): Attachment {
	return (element) => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) callback();
			},
			{ rootMargin: '200px' } // fire 200px before it's actually visible
		);
		observer.observe(element);
		return () => observer.disconnect();
	};
}
```

`rootMargin: '200px'` triggers the next fetch *before* the user hits the bottom, so the new rows are usually there by the time they'd have seen the spinner. The returned function is the teardown — Svelte calls it when the element leaves the DOM. No `onMount`/`onDestroy` bookkeeping.

## Step 5 — The infinite list component

```svelte
<!-- src/routes/(app)/contacts/InfiniteContacts.svelte -->
<script lang="ts">
	import { createPaginated } from '$lib/stores/paginated.svelte.ts';
	import { pageContacts } from './contacts.remote';
	import { onVisible } from '$lib/attachments/onVisible';
	import ContactRow from './ContactRow.svelte';

	type Contact = {
		id: string;
		full_name: string;
		email: string | null;
		avatar_path: string | null;
		created_at: string;
	};

	const list = createPaginated<Contact>((cursor) => pageContacts(cursor));

	// Kick off the first page.
	list.loadMore();
</script>

<ul class="divide-y divide-border-1 rounded-xl border border-border-1">
	{#each list.rows as c (c.id)}
		<li><ContactRow contact={c} /></li>
	{/each}
</ul>

{#if list.failed}
	<div class="mt-4 text-center">
		<p class="text-sm text-red-500">Couldn't load more.</p>
		<button
			type="button"
			class="mt-2 rounded-lg border border-border-1 px-3 py-1.5 text-sm"
			onclick={() => list.loadMore()}
		>
			Retry
		</button>
	</div>
{:else if list.loading}
	<div class="mt-4 space-y-2">
		{#each { length: 3 } as _, i (i)}
			<div class="h-14 animate-pulse rounded-lg bg-surface-1"></div>
		{/each}
	</div>
{:else if !list.done}
	<!-- sentinel: when this scrolls near the viewport, fetch the next page -->
	<div {@attach onVisible(() => list.loadMore())} class="h-px"></div>
{:else if list.rows.length > 0}
	<p class="mt-6 text-center text-sm text-text-2">That's everyone.</p>
{/if}
```

`{@attach ...}` is Svelte 5's attachment syntax. The sentinel `<div>` only exists while there's more to load — when `list.done` flips true, the sentinel unmounts, the observer auto-disconnects via the attachment's cleanup, and the "That's everyone" line replaces it. No dangling observers.

## Step 6 — Combining with search (E.11)

Search and pagination compose: when the search term changes, `reset()` the store and load the first page of *results*. The keyset predicate is identical; only the base query gains the `textSearch` filter. Wire it by keying the component on the term so a new term remounts a fresh paginated store:

```svelte
{#key term}
	<InfiniteContacts {term} />
{/key}
```

`{#key term}` tears down and rebuilds the list when `term` changes — the cleanest way to reset paginated state without a manual `reset()` + refetch dance.

## Verify

- Load the page with 5,000 contacts → first 30 render immediately; the rest stream in as you scroll.
- Scroll fast to the bottom repeatedly → no duplicate rows, no skipped rows (the `(created_at, id)` cursor guarantees it).
- `EXPLAIN ANALYZE` page 1 and page 200 → identical plan, identical timing (index scan, ~1 ms). OFFSET would have degraded linearly.
- Throttle the network, scroll down → skeleton rows show, then real rows; a failed fetch shows Retry and recovers.
- Scroll to the very end → "That's everyone"; the sentinel is gone from the DOM (check devtools).
- Two contacts created in the same millisecond both appear exactly once.

## Common traps

- **`OFFSET`/`LIMIT` pagination.** Flat in the demo, O(n) in production, slowest for your most engaged users. Keyset or nothing.
- **Cursor on a non-unique column.** `ORDER BY created_at` alone skips/dupes rows on timestamp ties. Always `(sort_key, pk)`.
- **No concurrency guard on `loadMore`.** Scroll events fire in bursts; without the `loading` guard you fetch the same page three times and append it three times.
- **Observing without disconnecting.** An `IntersectionObserver` that outlives its element leaks and keeps firing. The attachment's returned cleanup is mandatory, not optional.
- **`count(*)` for "has next page."** That count is itself O(n). Fetch `LIMIT n+1` and check for the extra row instead.
- **Index column order not matching `ORDER BY`.** The index must be `(user_id, created_at desc, id desc)` to serve the keyset walk; any other order forces a sort.

## Recap

Keyset cursor, `LIMIT n+1` for next-page detection, a tiebreaker-correct composite index, a concurrency-safe paginated store, and an `IntersectionObserver` attachment that cleans itself up. The list is now flat-time at any depth and composes cleanly with search.

Next: [E.13 Realtime contact sync →](./E.13-realtime-sync.md)
