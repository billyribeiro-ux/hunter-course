# E.7 — CSV Import for Contacts

> A bulk import that respects tier limits, surfaces validation errors inline, and refuses to half-import a file.

## Why this matters

Users bring their own data. A contacts app with no import path loses to one that has a working import path — every time. "I'll type 200 names in by hand" isn't a product strategy.

This lesson builds a CSV importer that parses client-side, validates each row, shows errors with row numbers, and either imports the whole file or none of it. It also respects the Plus / Pro contact limits from Module 10.1 — you can't import 10,000 contacts on a Free plan.

## The Principal Engineer lens

**Bulk operations fail atomically or not at all.** Importing 500 rows, succeeding on 447, failing on 53 isn't an "import" — it's a data-integrity nightmare. The user doesn't know which 53 rows are missing; some of the 447 might reference the 53 and now orphan. Atomic = all-or-nothing = sanity.

Corollary: **validate on the client first, but treat the server as the real validator.** Client-side validation catches 90% of errors fast (bad emails, missing required fields). Server-side catches the other 10% (uniqueness conflicts, entitlement limits). Never trust the client to be the last word.

## Step 1 — The UI entry point

`src/routes/(app)/contacts/import/+page.svelte`:

```svelte
<script lang="ts">
	import { parseCsv, type ParseResult } from '$lib/shared/csv';
	import { importContacts } from '$lib/remote/contacts.remote.ts';
	import { toasts } from '$lib/stores/toasts.svelte.ts';

	let file = $state<File | null>(null);
	let parseResult = $state<ParseResult | null>(null);
	let importing = $state(false);

	async function onFile(e: Event) {
		const input = e.target as HTMLInputElement;
		file = input.files?.[0] ?? null;
		if (!file) return;
		const text = await file.text();
		parseResult = parseCsv(text);
	}

	async function onImport() {
		if (!parseResult || parseResult.errors.length > 0) return;
		importing = true;
		try {
			const result = await importContacts({ rows: parseResult.rows });
			if (result.ok) {
				toasts.success(`Imported ${result.count} contacts.`);
				window.location.href = '/app';
			} else {
				toasts.error(result.error);
			}
		} finally {
			importing = false;
		}
	}
</script>

<h1>Import contacts</h1>

<input type="file" accept=".csv,text/csv" onchange={onFile} />

{#if parseResult}
	<section class="summary">
		<p>Parsed {parseResult.rows.length} rows; {parseResult.errors.length} errors.</p>

		{#if parseResult.errors.length > 0}
			<ul class="errors">
				{#each parseResult.errors as err, i (i)}
					<li>Row {err.row}: {err.message}</li>
				{/each}
			</ul>
		{/if}

		<button
			onclick={onImport}
			disabled={importing || parseResult.errors.length > 0}
		>
			{importing ? 'Importing…' : 'Import contacts'}
		</button>
	</section>
{/if}
```

## Step 2 — The parser

`src/lib/shared/csv.ts`:

```ts
export interface ParsedRow {
	name: string;
	email: string;
	phone?: string;
	notes?: string;
}

export interface ParseError {
	row: number;
	message: string;
}

export interface ParseResult {
	rows: ParsedRow[];
	errors: ParseError[];
}

export function parseCsv(text: string): ParseResult {
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (lines.length < 2) {
		return { rows: [], errors: [{ row: 0, message: 'File has no data rows' }] };
	}

	const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
	const required = ['name', 'email'];
	const missing = required.filter((r) => !header.includes(r));
	if (missing.length) {
		return { rows: [], errors: [{ row: 1, message: `Missing column(s): ${missing.join(', ')}` }] };
	}

	const rows: ParsedRow[] = [];
	const errors: ParseError[] = [];
	const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	for (let i = 1; i < lines.length; i++) {
		const rowNum = i + 1;
		const cells = splitLine(lines[i]);
		const record = Object.fromEntries(header.map((h, j) => [h, (cells[j] ?? '').trim()]));

		if (!record.name) {
			errors.push({ row: rowNum, message: 'name is required' });
			continue;
		}
		if (!record.email) {
			errors.push({ row: rowNum, message: 'email is required' });
			continue;
		}
		if (!emailRe.test(record.email)) {
			errors.push({ row: rowNum, message: `invalid email: ${record.email}` });
			continue;
		}

		rows.push({
			name: record.name,
			email: record.email,
			phone: record.phone || undefined,
			notes: record.notes || undefined
		});
	}

	return { rows, errors };
}

// Minimal CSV line splitter that respects quotes but not newlines-in-quotes (for simplicity).
function splitLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"' && inQuotes && line[i + 1] === '"') {
			current += '"';
			i++;
			continue;
		}
		if (ch === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (ch === ',' && !inQuotes) {
			result.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	result.push(current);
	return result;
}
```

Explicit limits of this parser:

- **No multiline cells** (no `\n` inside quoted fields). For production, use `papaparse@5.5.0`. We inline the parser here to keep dependency count low; swap for papaparse when you hit the first multiline-cell user.
- **Latin-1 / UTF-8 auto-detect not handled.** If users import Excel exports, they may have BOMs or CP-1252 encoding. Strip the BOM (`text.replace(/^\uFEFF/, '')`) at the top of `parseCsv`.

## Step 3 — The server-side importer

`src/lib/remote/contacts.remote.ts` (new command):

```ts
const ImportInputSchema = v.object({
	rows: v.pipe(v.array(v.object({
		name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
		email: v.pipe(v.string(), v.email()),
		phone: v.optional(v.string()),
		notes: v.optional(v.string())
	})), v.maxLength(1000)) // hard cap per import
});

export const importContacts = command(ImportInputSchema, async (input) => {
	const { locals } = getRequestEvent();
	const user = requireUser(locals);

	const tier = locals.tier;
	const limit = contactsLimit(tier); // from Module 10.1 entitlements
	const currentCount = await countContacts(locals.supabaseAdmin, user.id);

	if (limit !== null && currentCount + input.rows.length > limit) {
		const headroom = Math.max(0, limit - currentCount);
		throw error(402, {
			code: 'ENTITLEMENT_DENIED',
			message: `Your plan allows ${limit} contacts. You can import at most ${headroom} more.`,
			upgradeTo: tier === 'free' ? 'plus' : 'pro'
		});
	}

	// Atomic insert — all rows or none. Supabase's .insert takes an array.
	const toInsert = input.rows.map((row) => ({
		user_id: user.id,
		name: row.name,
		email: row.email,
		phone: row.phone ?? null,
		notes: row.notes ?? null
	}));

	const { data, error: dbError } = await locals.supabaseAdmin
		.from('contacts')
		.insert(toInsert)
		.select('id');

	if (dbError) {
		return { ok: false, error: dbError.message };
	}

	return { ok: true, count: data.length };
});
```

Three things to note:

- **Hard cap of 1000 rows per import.** Reason: a single Supabase insert of 10,000 rows can exceed API limits and also ties up a single transaction for seconds. 1000 is a sweet spot.
- **Entitlement check before the insert.** 402 if the import would exceed the tier's contact cap. Reuse the exact same entitlement code as single-row creates.
- **Atomic by nature.** Supabase wraps multi-row inserts in a single transaction. All rows land or the whole operation errors.

## Step 4 — The limit-exceeded CTA

When the server throws 402, the UI should offer an upgrade:

```svelte
<!-- In the import page -->
{#if importError?.code === 'ENTITLEMENT_DENIED'}
	<div class="upgrade-prompt">
		<p>{importError.message}</p>
		<a href="/pricing" class="upgrade">Upgrade plan</a>
	</div>
{/if}
```

Reuse the `UpgradeModal` from Module 10.3 if it fits the design.

## Step 5 — The downloadable template

Give users a one-click template so they don't have to guess the column names:

```svelte
<a href="/import-template.csv" download>Download CSV template</a>
```

`static/import-template.csv`:

```csv
name,email,phone,notes
Ada Lovelace,ada@example.com,+1-555-0100,Algorithms person
```

Tiny file, enormous time-saver for first-time importers.

## Step 6 — Progress for large imports

For imports near the 1000-row limit, client-side parsing blocks the UI briefly. If users complain, move parsing into a Web Worker:

```ts
// src/lib/workers/csv-parser.ts
import { parseCsv } from '$lib/shared/csv';

self.onmessage = (e: MessageEvent<string>) => {
	const result = parseCsv(e.data);
	self.postMessage(result);
};
```

Usage:

```ts
const worker = new Worker(new URL('$lib/workers/csv-parser.ts', import.meta.url), { type: 'module' });
worker.postMessage(text);
worker.onmessage = (e) => { parseResult = e.data; };
```

Not needed until you have real complaints; mentioned for when you do.

## Verify

- Upload a valid CSV with name/email columns → parses, preview shows row count, Import button enabled.
- Upload a CSV missing the `email` column → single header error shown; Import disabled.
- Upload a CSV with some invalid rows → row-number errors; Import disabled until corrected.
- As a Free user, try to import 60 contacts (Free limit is 50) → server returns 402 with headroom info; upgrade CTA appears.
- As a Plus user, import 200 → succeeds; contacts appear on `/app` reload.

## Common traps

- **Parsing on the server.** Double-round-trip for nothing; fail-fast is better on the client. Re-validate server-side for safety, not for first-check UX.
- **Skipping the entitlement check before insert.** Free users can import past their limit; you've now got users with more rows than the pricing page promised. Revenue trust broken.
- **Silent BOM.** Excel adds a UTF-8 BOM. Without stripping it, the first column name becomes `\uFEFFname` and nothing matches. Strip once at parser entry.
- **No max row limit.** A user uploads a 500k-row CSV; your serverless function times out; everybody's day gets worse. Hard cap (1000) in the schema.
- **Returning partial success.** "342 imported, 8 failed" is a support nightmare. Validate upfront; import all or none.

## Recap

Import is a deceptively complex feature done right: parse, validate, preview, atomic insert, entitlement-aware. Contactly now grows with its users — they bring data, the app accepts it, the tier limits enforce themselves.

Next: [E.8 Keyboard shortcuts →](./E.8-keyboard-shortcuts.md)
