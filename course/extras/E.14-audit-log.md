# E.14 — Audit Log

> An append-only history table, a Postgres trigger that can't be bypassed, RLS so users see only their own trail, and a Svelte timeline that reads it. Compliance and debugging in one.

## Why this matters

"Who deleted this contact?" "When did this email change?" "Did the customer actually do that, or did our code?" The day you can't answer these is the day you wish you'd had an audit log. It's the feature you regret not building only once — and that once is expensive (a churned enterprise customer, a failed SOC 2 control, an unprovable support dispute).

The naive version — log from application code — is worthless: it captures only the writes you remembered to instrument, misses the SQL console, the migration, the cron job, the bug. A real audit log is enforced by the database, below the application, where nothing can route around it.

## The Principal Engineer lens

**An audit log you can write to is an audit log you can't trust.** The integrity property that makes it worth anything is *append-only, no exceptions* — not even for the app, not even for an admin, not even for the code that writes it. If a compromised credential can rewrite history, the history proves nothing. Enforce immutability in the database with a trigger, not a code review convention.

Corollary: **capture at the lowest layer that sees every write.** Application-level logging captures application writes. A Postgres trigger captures *every* write — app, console, migration, replication. The lower the capture point, the fewer the blind spots. There is exactly one layer with no blind spots, and it isn't your code.

## Step 1 — The append-only table

```sql
-- supabase/migrations/20260518000000_audit_log.sql
create table public.audit_log (
  id          bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  user_id     uuid,                       -- the row owner (for RLS)
  actor_id    uuid,                       -- who caused it (auth.uid())
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  primary key (id, occurred_at)            -- partition key must be in the PK
) partition by range (occurred_at);

-- One partition per month. Create the current + next month up front;
-- a monthly cron (Step 7) rolls new ones forward.
create table public.audit_log_2026_05
  partition of public.audit_log
  for values from ('2026-05-01') to ('2026-06-01');
create table public.audit_log_2026_06
  partition of public.audit_log
  for values from ('2026-06-01') to ('2026-07-01');

create index audit_log_user_occurred_idx
  on public.audit_log (user_id, occurred_at desc);

create index audit_log_record_idx
  on public.audit_log (table_name, record_id, occurred_at desc);
```

`generated always as identity` — the id can't be set or reset by an insert. The PK is `(id, occurred_at)` because Postgres requires the partition key in the primary key. **Why partitioned?** It makes retention a metadata operation (`DROP TABLE` the old month — O(1), no bloat) instead of a giant `DELETE` that fights the immutability guard we're about to add. `old_data`/`new_data` as `jsonb` means one audit table serves every audited table without a schema per table.

## Step 2 — The capture trigger

One generic trigger function, attached to any table we want audited.

```sql
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := coalesce(
    (case when tg_op = 'DELETE' then old.user_id else new.user_id end),
    null
  );

  insert into public.audit_log (
    user_id, actor_id, table_name, record_id, action, old_data, new_data
  ) values (
    v_user_id,
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger trg_audit_contacts
  after insert or update or delete on public.contacts
  for each row execute function public.fn_audit();
```

`after` (not `before`) so it only records writes that actually committed. `security definer` so the function can insert into `audit_log` even though the calling user has no direct write grant on it. `to_jsonb(old/new)` snapshots the whole row — schema-agnostic, future-proof.

## Step 3 — Make it append-only — for everyone

A trigger that captures history is useless if anyone can `UPDATE audit_log` or `DELETE FROM audit_log`. Block it in the database, including for the service role.

```sql
alter table public.audit_log enable row level security;

-- Read: a user sees only their own trail.
create policy "Audit: read own"
  on public.audit_log for select
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies → RLS-bound roles can't mutate it.
-- Be explicit at the grant layer too:
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- The real guarantee, for EVERY role including the service key:
-- a row-level trigger that refuses UPDATE and DELETE outright.
create or replace function public.fn_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only (% blocked)', tg_op;
end;
$$;

create trigger trg_audit_immutable
  before update or delete on public.audit_log
  for each row execute function public.fn_audit_immutable();
```

A row-level `BEFORE UPDATE OR DELETE` trigger fires for **every** role — `authenticated`, the service key, even a superuser running `DELETE FROM audit_log`. That is the property a blanket `CREATE RULE ... DO INSTEAD NOTHING` *seems* to give but botches: a `DO INSTEAD NOTHING` delete rule also silently swallows your own retention job (Step 7), so you'd believe you were purging and never be — a contradiction that ships as "why is this table 400 GB?". The trigger blocks row deletes for everyone *and* is bypassed by `DROP TABLE` on a partition (DDL doesn't fire row triggers) — which is exactly, and only, how retention is allowed to remove data. The capture trigger from Step 2 is the *only* writer; nothing can rewrite or row-delete history. That is what makes the log trustworthy.

## Step 4 — A query to read a record's history

```ts
// src/routes/(app)/contacts/audit.remote.ts
import { query, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { requireUser } from '$lib/server/auth';

export const contactHistory = query(
	v.pipe(v.string(), v.uuid()),
	async (contactId) => {
		const event = getRequestEvent();
		requireUser(event); // RLS does the real scoping

		const { data, error } = await event.locals.supabase
			.from('audit_log')
			.select('id, occurred_at, actor_id, action, old_data, new_data')
			.eq('table_name', 'contacts')
			.eq('record_id', contactId)
			.order('occurred_at', { ascending: false })
			.limit(100);

		if (error) throw new Error(error.message);
		return data;
	}
);
```

No manual `user_id` filter needed — the `Audit: read own` policy already guarantees a user can't read another user's history even by guessing a `record_id`. The query is small because the integrity lives in the database.

## Step 5 — Diff two row snapshots

The raw `old_data`/`new_data` blobs are noise. Users want "what changed." A pure helper turns two snapshots into a field-level diff.

```ts
// src/lib/shared/diff.ts
export interface FieldChange {
	field: string;
	before: unknown;
	after: unknown;
}

const IGNORED = new Set(['updated_at', 'search_tsv']);

export function diffRows(
	oldData: Record<string, unknown> | null,
	newData: Record<string, unknown> | null
): FieldChange[] {
	const keys = new Set([
		...Object.keys(oldData ?? {}),
		...Object.keys(newData ?? {})
	]);
	const changes: FieldChange[] = [];
	for (const field of keys) {
		if (IGNORED.has(field)) continue;
		const before = oldData?.[field] ?? null;
		const after = newData?.[field] ?? null;
		if (JSON.stringify(before) !== JSON.stringify(after)) {
			changes.push({ field, before, after });
		}
	}
	return changes;
}
```

Pure, testable, ignores machine-noise columns (`updated_at`, the `search_tsv` from E.11). The UI shows `phone: "" → "+1 555 0100"`, not a wall of unchanged JSON.

## Step 6 — The audit timeline component

```svelte
<!-- src/lib/components/AuditTimeline.svelte -->
<script lang="ts">
	import { contactHistory } from '$routes/(app)/contacts/audit.remote';
	import { diffRows } from '$lib/shared/diff';

	interface Props {
		contactId: string;
	}
	let { contactId }: Props = $props();

	let historyPromise = $derived(contactHistory(contactId));

	const VERB: Record<string, string> = {
		INSERT: 'created',
		UPDATE: 'edited',
		DELETE: 'deleted'
	};

	function fmt(ts: string): string {
		return new Date(ts).toLocaleString();
	}
</script>

{#await historyPromise}
	<div class="space-y-2">
		{#each { length: 3 } as _, i (i)}
			<div class="h-10 animate-pulse rounded bg-surface-1"></div>
		{/each}
	</div>
{:then events}
	{#if events.length === 0}
		<p class="text-sm text-text-2">No history recorded.</p>
	{:else}
		<ol class="space-y-4 border-l border-border-1 pl-4">
			{#each events as ev (ev.id)}
				{@const changes = diffRows(ev.old_data, ev.new_data)}
				<li>
					<div class="text-sm text-text-1">
						<span class="font-medium">{VERB[ev.action] ?? ev.action}</span>
						<span class="text-text-2">· {fmt(ev.occurred_at)}</span>
					</div>
					{#if ev.action === 'UPDATE'}
						<ul class="mt-1 space-y-0.5 text-xs text-text-2">
							{#each changes as ch (ch.field)}
								<li>
									<span class="font-mono">{ch.field}</span>:
									<span class="line-through">{String(ch.before ?? '∅')}</span>
									→
									<span class="text-text-1">{String(ch.after ?? '∅')}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
{:catch err}
	<p role="alert" class="text-sm text-red-500">Couldn't load history: {err.message}</p>
{/await}
```

`{@const changes = diffRows(...)}` computes the per-event diff inline in the `{#each}` — the right place for a value derived from the loop item. The timeline reads as English: *"edited · 14 May 2026, 09:12 — phone: ∅ → +1 555 0100"*.

## Step 7 — Retention

Audit logs grow forever and most rows are never read. The immutability trigger from Step 3 blocks `DELETE` for *everyone* — deliberately. So retention does not delete rows; it **drops whole monthly partitions**. `DROP TABLE` is DDL: it doesn't fire the row-level immutability trigger, it's O(1) regardless of row count, and it returns the disk immediately with zero vacuum debt.

Two `pg_cron` jobs: one rolls next month's partition forward, one drops partitions past the retention window.

```sql
-- 1. Create next month's partition on the 25th, every month.
select cron.schedule('audit-roll-partition', '0 2 25 * *', $$
  do $body$
  declare
    start_d date := date_trunc('month', now() + interval '1 month');
    part    text := 'audit_log_' || to_char(start_d, 'YYYY_MM');
  begin
    execute format(
      'create table if not exists public.%I partition of public.audit_log
         for values from (%L) to (%L)',
      part, start_d, start_d + interval '1 month'
    );
  end $body$;
$$);

-- 2. Drop partitions older than 24 months, every month.
select cron.schedule('audit-drop-old', '30 3 1 * *', $$
  do $body$
  declare
    r record;
    cutoff date := date_trunc('month', now() - interval '24 months');
  begin
    for r in
      select inhrelid::regclass::text as part
      from pg_inherits
      where inhparent = 'public.audit_log'::regclass
    loop
      if substring(r.part from 'audit_log_(\d{4}_\d{2})') is not null
         and to_date(substring(r.part from 'audit_log_(\d{4}_\d{2})'), 'YYYY_MM') < cutoff
      then
        execute format('drop table %s', r.part);
      end if;
    end loop;
  end $body$;
$$);
```

24 months covers SOC 2 and most disputes. Decide the window deliberately — "forever" is a cost and a liability (you're storing PII you no longer have a reason to keep), not a virtue. Note the design property: the *only* way data ever leaves this table is dropping an entire aged partition. There is no code path, for any role, that deletes an individual audit row. That is what "append-only" has to mean to be worth anything.

## Verify

- Edit a contact's phone → a row appears in `audit_log` with `action='UPDATE'`, correct `old_data`/`new_data`, and `actor_id = auth.uid()`.
- Delete a contact → `action='DELETE'`, full `old_data` snapshot, the row survives in the log after the contact is gone.
- As the service role, `UPDATE audit_log SET action='INSERT'` → raises `audit_log is append-only (UPDATE blocked)`.
- `DELETE FROM audit_log` as the service role *or* as a superuser → same exception. No role can row-delete history.
- Run the `audit-drop-old` job manually → an aged partition is gone (DDL bypasses the trigger); recent rows untouched.
- Sign in as user B, query `contactHistory` with user A's contact id → empty (RLS).
- Change a contact via the SQL editor (not the app) → still audited (trigger is below the app).
- The timeline renders edits as readable field diffs, newest first.

## Common traps

- **Logging from application code.** Misses the console, the migration, the cron, the bug, the breach. Capture in a trigger.
- **An audit table the app can write/edit.** A compromised app key can then rewrite history; the log proves nothing. Trigger-only writes; UPDATE/DELETE blocked by a row trigger for every role.
- **`DO INSTEAD NOTHING` rules for immutability.** They *silently* swallow the write — including your own retention job — so you believe you're purging and aren't, and you believe deletes fail loudly and they don't. A `RAISE EXCEPTION` trigger fails loud; partition `DROP` is the one sanctioned exit.
- **Row-`DELETE` retention on an append-only table.** It either fights the immutability guard or forces you to weaken it. Partition by month; drop whole partitions. Retention with zero `DELETE`s.
- **`before` trigger instead of `after` (for capture).** Records writes that then roll back — phantom history. `after` records only what committed. (The *immutability* guard is correctly `before` — you must reject the mutation before it happens.)
- **No `security definer`.** The trigger fails because the calling user has no insert grant on `audit_log`. Definer rights are required and correct here.
- **Storing per-column instead of `to_jsonb(row)`.** Every new column needs an audit schema change. Snapshot the whole row as `jsonb`; it's schema-proof.
- **No retention policy.** The table outgrows the rest of the database, backups balloon, and you're storing PII you no longer have a reason to keep. Bound it on purpose.
- **Showing raw JSON to users.** Diff it. "phone changed" beats 400 characters of unchanged columns.

## Recap

A monthly-partitioned `jsonb` history table, a `security definer` trigger that captures every write below the app, RLS for per-user reads, UPDATE/DELETE refused for *every* role by a row trigger that fails loud, retention by partition-drop (the one sanctioned exit), a pure diff helper, and a readable Svelte timeline. The question "who changed this, and when?" now has an answer nothing in the system can quietly forge or erase.

Next: [E.15 Error tracking with Sentry →](./E.15-error-tracking-sentry.md)
