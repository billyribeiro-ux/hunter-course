# E.11 — Full-Text Contact Search

> Postgres `tsvector`, a generated column, a GIN index, a debounced URL-synced search box. Sub-10 ms search that survives a refresh and a shared link.

## Why this matters

Right now the contacts page loads every row and the user scrolls. At 30 contacts that's fine. At 3,000 it's a scroll of despair. Every CRM that survives contact with real users has search — and the difference between good search and bad search is whether it's *instant* and whether the URL remembers it.

`WHERE full_name ILIKE '%query%'` is the bad version: it can't use an index, scans every row, and misses "Jon" when the user typed "John." We'll build the good version with Postgres full-text search.

## The Principal Engineer lens

**Search belongs in the database, not the application.** The instinct to pull all rows and filter in JS is the single most common scaling mistake in CRUD apps. Postgres has a mature full-text engine; using it means search stays O(log n) as the table grows, and the network ships only the matches.

Corollary: **search state is URL state.** A search the user can't bookmark, share, or restore with the back button is a search that fights the user. The query string is the single source of truth; the input box is just a view of it.

## Step 1 — A generated `tsvector` column

Don't compute the search vector in application code — let Postgres maintain it automatically with a generated column.

```sql
-- supabase/migrations/20260512000000_contacts_search.sql
alter table public.contacts
  add column search_tsv tsvector
  generated always as (
    to_tsvector(
      'simple',
      coalesce(full_name, '') || ' ' ||
      coalesce(email, '')     || ' ' ||
      coalesce(phone, '')     || ' ' ||
      coalesce(notes, '')
    )
  ) stored;

create index contacts_search_tsv_idx
  on public.contacts using gin (search_tsv);
```

`generated always as ... stored` means the vector is recomputed by Postgres on every insert/update — never stale, never the app's job. The GIN index makes `@@` lookups index-backed. We use the `'simple'` dictionary (not `'english'`) deliberately: names and emails aren't English prose; stemming "Rogers" to "roger" would surprise users.

## Step 2 — The search query

A remote `query` that takes the search term. Empty term → recent list (the existing behaviour); non-empty → ranked full-text match.

```ts
// add to src/routes/(app)/contacts/contacts.remote.ts
import * as v from 'valibot';

export const searchContacts = query(
	v.optional(v.pipe(v.string(), v.maxLength(120)), ''),
	async (term) => {
		const event = getRequestEvent();
		const user = requireUser(event);
		const trimmed = term.trim();

		let q = event.locals.supabase
			.from('contacts')
			.select('id, full_name, email, phone, avatar_path, created_at')
			.eq('user_id', user.id);

		if (trimmed) {
			// websearch_to_tsquery handles "quoted phrases", -negation, OR
			q = q
				.textSearch('search_tsv', trimmed, {
					type: 'websearch',
					config: 'simple'
				})
				.limit(50);
		} else {
			q = q.order('created_at', { ascending: false }).limit(50);
		}

		const { data, error } = await q;
		if (error) throw new Error(error.message);
		return data;
	}
);
```

`websearch` query type is the one to use: it parses Google-style input (`"exact phrase"`, `-exclude`, bare `OR`) and never throws on malformed input — `textSearch('plain', ...)` throws on a stray `&`. Capping at 50 keeps the payload bounded; search that returns 5,000 rows is not search.

## Step 3 — Debounced, URL-synced search input

The component owns no search state of its own. It reads the URL and writes the URL; the data follows.

```svelte
<!-- src/lib/components/ContactSearch.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let value = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout>;

	function commit(next: string) {
		const url = new URL(page.url);
		if (next) url.searchParams.set('q', next);
		else url.searchParams.delete('q');
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(() => commit(value.trim()), 250);
	}

	function onClear() {
		value = '';
		clearTimeout(timer);
		commit('');
	}
</script>

<div class="relative">
	<input
		type="search"
		placeholder="Search contacts…"
		bind:value
		oninput={onInput}
		class="w-full rounded-lg border border-border-1 bg-surface-0 px-3 py-2 pr-9 text-text-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
		aria-label="Search contacts"
	/>
	{#if value}
		<button
			type="button"
			onclick={onClear}
			aria-label="Clear search"
			class="absolute right-2 top-1/2 -translate-y-1/2 text-text-2 hover:text-text-1"
		>
			×
		</button>
	{/if}
</div>
```

`replaceState: true` means typing doesn't push 12 history entries; `keepFocus` keeps the cursor in the box across the navigation; `noScroll` stops the page jumping. The 250 ms debounce means a fast typist triggers one query, not eight.

## Step 4 — Render from the URL

The page reads `q` from the URL and feeds the query. Because `searchContacts` is a remote `query`, SvelteKit re-runs it whenever its argument changes.

```svelte
<!-- src/routes/(app)/contacts/+page.svelte (excerpt) -->
<script lang="ts">
	import { page } from '$app/state';
	import { searchContacts } from './contacts.remote';
	import ContactSearch from '$lib/components/ContactSearch.svelte';
	import ContactRow from './ContactRow.svelte';

	let term = $derived(page.url.searchParams.get('q') ?? '');
	let resultsPromise = $derived(searchContacts(term));
</script>

<ContactSearch />

{#await resultsPromise}
	<div class="mt-6 space-y-2">
		{#each { length: 5 } as _, i (i)}
			<div class="h-14 animate-pulse rounded-lg bg-surface-1"></div>
		{/each}
	</div>
{:then contacts}
	{#if contacts.length === 0}
		<p class="mt-10 text-center text-sm text-text-2">
			{term ? `No contacts match "${term}".` : 'No contacts yet.'}
		</p>
	{:else}
		<ul class="mt-6 divide-y divide-border-1 rounded-xl border border-border-1">
			{#each contacts as c (c.id)}
				<ContactRow contact={c} />
			{/each}
		</ul>
	{/if}
{:catch err}
	<p role="alert" class="mt-6 text-sm text-red-500">Search failed: {err.message}</p>
{/await}
```

`term` is `$derived` from the URL; `resultsPromise` is `$derived` from `term`. Type in the box → debounced `goto` updates the URL → `term` recomputes → `searchContacts` re-runs → `{#await}` swaps the list. One reactive chain, zero manual wiring.

## Step 5 — Highlight the match (optional polish)

Showing *why* a row matched builds trust. A tiny client-side highlighter on the name is enough.

```svelte
<!-- inside ContactRow.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	let { contact } = $props();
	let term = $derived((page.url.searchParams.get('q') ?? '').trim());

	let parts = $derived.by(() => {
		if (!term) return [{ text: contact.full_name, hit: false }];
		const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
		return contact.full_name
			.split(re)
			.filter(Boolean)
			.map((text: string) => ({ text, hit: re.test(text) }));
	});
</script>

<span>
	{#each parts as part, i (i)}
		{#if part.hit}<mark class="bg-brand-500/20">{part.text}</mark>{:else}{part.text}{/if}
	{/each}
</span>
```

`$derived.by` is the block form of `$derived` — use it when the computation needs statements, not just an expression. The regex special-chars are escaped so a search for `a.b` doesn't become a wildcard.

## Verify

- Type "joh" → "John", "Johnny", "Johnson" all match within ~250 ms of stopping.
- Reload the page with `?q=joh` in the URL → the box is pre-filled and results are filtered.
- Search, then press the browser back button → the search clears, list returns.
- Search `"john smith"` (quoted) → only rows with that phrase, not all Johns and all Smiths.
- `EXPLAIN ANALYZE` the underlying query at 10k rows → it uses `contacts_search_tsv_idx`, runs in single-digit ms.
- Search `&&&` → no crash (websearch tolerates garbage); empty result.

## Common traps

- **`ILIKE '%term%'`.** Can't use an index, scans the whole table, O(n). The reason your app is slow at 5k rows.
- **`to_tsquery` instead of `websearch_to_tsquery`.** `to_tsquery` throws on user input containing spaces or operators. `websearch` is the only safe one for a raw search box.
- **`'english'` config on names.** Stems surnames ("Downing" → "down"), produces baffling matches. `'simple'` for identity data.
- **Search state in component `$state` only.** Refresh loses it, back button breaks, the URL can't be shared. URL is the source of truth.
- **No debounce.** Every keystroke is a query; a 10-character name is 10 round trips and a flickering list.
- **Recomputing the tsvector in app code on write.** Drifts the moment one code path forgets. A `generated always` column can't drift.

## Recap

A generated `tsvector`, a GIN index, a `websearch` query, a debounced URL-synced box, optional match highlighting. Search is now index-backed, shareable, restore-on-refresh, and stays fast as the table grows past anything a JS filter could survive.

Next: [E.12 Cursor pagination & infinite scroll →](./E.12-cursor-pagination.md)
